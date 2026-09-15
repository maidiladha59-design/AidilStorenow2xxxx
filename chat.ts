"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function sendCustomerChatMessage(orderId: string, input: { messageType: "text" | "image" | "document"; content?: string; fileUrl?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  const { data: order } = await supabase.from("orders").select("id").eq("id", orderId).eq("user_id", user.id).single();
  if (!order) return { ok: false as const, error: "Pesanan tidak ditemukan." };

  const { error } = await supabase.from("order_chat_messages").insert({
    order_id: orderId,
    sender_type: "customer",
    sender_id: user.id,
    message_type: input.messageType,
    content: input.content ?? null,
    file_url: input.fileUrl ?? null,
  });
  if (error) return { ok: false as const, error: "Gagal mengirim pesan." };

  revalidatePath(`/orders/${orderId}`);
  return { ok: true as const };
}

export async function sendAdminChatMessage(orderId: string, input: { messageType: "text" | "image" | "document"; content?: string; fileUrl?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  const { data: adminUser } = await supabase.from("admin_users").select("id, is_active").eq("id", user.id).single();
  if (!adminUser || !adminUser.is_active) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  const { error } = await db.from("order_chat_messages").insert({
    order_id: orderId,
    sender_type: "admin",
    sender_id: user.id,
    message_type: input.messageType,
    content: input.content ?? null,
    file_url: input.fileUrl ?? null,
  });
  if (error) return { ok: false as const, error: "Gagal mengirim pesan." };

  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true as const };
}

export async function getChatFileUrl(orderId: string, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  // Validasi: pemanggil harus pemilik order (customer) ATAU admin aktif.
  const { data: order } = await supabase.from("orders").select("user_id").eq("id", orderId).single();
  const { data: adminUser } = await supabase.from("admin_users").select("id, is_active").eq("id", user.id).maybeSingle();
  const isOwner = order?.user_id === user.id;
  const isAdmin = adminUser?.is_active;
  if (!isOwner && !isAdmin) return { ok: false as const, error: "Tidak diizinkan." };

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage.from("chat-files").createSignedUrl(path, 60 * 5);
  if (error || !signed) return { ok: false as const, error: "Gagal membuka file." };

  return { ok: true as const, url: signed.signedUrl };
}
