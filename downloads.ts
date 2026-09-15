"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getSignedDownloadUrl(purchaseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Kamu harus login." };

  const { data: purchase } = await supabase
    .from("digital_product_purchases")
    .select("id, user_id, product_id, download_count")
    .eq("id", purchaseId)
    .eq("user_id", user.id)
    .single();

  if (!purchase) return { ok: false as const, error: "Produk tidak ditemukan atau bukan milikmu." };

  const admin = createAdminClient();
  const { data: file } = await admin
    .from("digital_product_files")
    .select("storage_path, download_limit, expires_at")
    .eq("product_id", purchase.product_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!file) return { ok: false as const, error: "File belum tersedia untuk produk ini." };

  if (file.expires_at && new Date(file.expires_at) < new Date()) {
    return { ok: false as const, error: "Masa akses download untuk produk ini sudah berakhir." };
  }
  if (file.download_limit && purchase.download_count >= file.download_limit) {
    return { ok: false as const, error: "Batas download untuk produk ini sudah tercapai." };
  }

  const { data: signed, error: signError } = await admin.storage
    .from("digital-products")
    .createSignedUrl(file.storage_path, 60 * 5); // berlaku 5 menit

  if (signError || !signed) return { ok: false as const, error: "Gagal membuat link download." };

  await admin
    .from("digital_product_purchases")
    .update({ download_count: purchase.download_count + 1 })
    .eq("id", purchaseId);

  return { ok: true as const, url: signed.signedUrl };
}


export async function getResultFileUrl(orderId: string, path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Kamu harus login." };

  if (!path.startsWith(`${orderId}/`)) {
    return { ok: false as const, error: "File hasil tidak valid." };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();
  if (!order) return { ok: false as const, error: "Pesanan tidak ditemukan." };

  const { data: items } = await supabase
    .from("order_items")
    .select("result_files")
    .eq("order_id", orderId);

  const allowed = (items ?? []).some((item) =>
    Array.isArray(item.result_files) &&
    (item.result_files as { path?: string }[]).some((f) => f.path === path)
  );
  if (!allowed) return { ok: false as const, error: "File hasil tidak ditemukan." };

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from("results")
    .createSignedUrl(path, 60 * 5);

  if (error || !signed) return { ok: false as const, error: "Gagal membuka file hasil." };
  return { ok: true as const, url: signed.signedUrl };
}
