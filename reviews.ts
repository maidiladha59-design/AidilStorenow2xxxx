"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitReview(input: { orderItemId: string; productId: string; rating: number; comment: string; imageUrl: string | null }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  if (input.rating < 1 || input.rating > 5) return { ok: false as const, error: "Rating tidak valid." };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("order_item_id", input.orderItemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return { ok: false as const, error: "Kamu sudah memberi ulasan untuk item ini." };

  const { error } = await supabase.from("reviews").insert({
    order_item_id: input.orderItemId,
    user_id: user.id,
    product_id: input.productId,
    rating: input.rating,
    comment: input.comment || null,
    image_url: input.imageUrl,
    status: "pending",
  });
  if (error) return { ok: false as const, error: "Gagal mengirim ulasan." };

  revalidatePath(`/orders`);
  return { ok: true as const };
}
