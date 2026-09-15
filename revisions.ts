"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function requestRevision(input: { orderItemId: string; orderId: string; description: string; files: { path: string; name: string }[] }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  const { data: item } = await supabase
    .from("order_items")
    .select("id, revision_used, revision_limit, order_id, orders!inner(user_id)")
    .eq("id", input.orderItemId)
    .single();

  if (!item || (item.orders as unknown as { user_id: string }).user_id !== user.id) {
    return { ok: false as const, error: "Item pesanan tidak ditemukan." };
  }
  if (item.order_id !== input.orderId) {
    return { ok: false as const, error: "Order tidak cocok dengan item pesanan." };
  }
  if (item.revision_used >= item.revision_limit) {
    return { ok: false as const, error: "Kuota revisi telah habis." };
  }
  if (!input.description.trim()) {
    return { ok: false as const, error: "Jelaskan revisi yang kamu inginkan." };
  }

  if (input.files.some((file) => !file.path.startsWith(`${input.orderId}/`))) {
    return { ok: false as const, error: "File revisi tidak valid." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("order_revisions").insert({
    order_item_id: input.orderItemId,
    description: input.description,
    files: input.files,
  });
  if (error) return { ok: false as const, error: "Gagal mengajukan revisi." };

  await admin.from("order_items").update({ revision_used: item.revision_used + 1 }).eq("id", input.orderItemId);
  await admin.from("orders").update({ status: "REVISION_REQUESTED" }).eq("id", input.orderId);
  await admin.from("order_status_history").insert({
    order_id: input.orderId,
    status: "REVISION_REQUESTED",
    note: "Customer mengajukan revisi.",
  });

  revalidatePath(`/orders/${input.orderId}`);
  return { ok: true as const };
}
