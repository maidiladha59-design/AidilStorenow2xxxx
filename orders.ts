"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOrderNumber } from "@/lib/utils";
import { redirect } from "next/navigation";

type CheckoutInput = {
  voucherCode: string | null;
  agreement: boolean;
};

export async function createOrderFromCart(input: CheckoutInput) {
  if (!input.agreement) {
    return { ok: false as const, error: "Kamu harus menyetujui bahwa data pesanan sudah benar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Kamu harus login terlebih dahulu." };

  const { data: profile } = await supabase.from("profiles").select("is_suspended").eq("id", user.id).single();
  if (profile?.is_suspended) {
    return { ok: false as const, error: "Akunmu sedang ditangguhkan. Hubungi bantuan untuk info lebih lanjut." };
  }

  const { data: cartItems } = await supabase
    .from("cart_items")
    .select(
      "id, quantity, configuration, material_status, material_text, material_files, deadline_at, notes, product_id, variation_id, product:products(name, base_price, express_fee_percent, revision_limit), variation:product_variations(name, price)"
    )
    .eq("user_id", user.id);

  if (!cartItems || cartItems.length === 0) {
    return { ok: false as const, error: "Keranjang kosong." };
  }

  let subtotal = 0;
  let expressFee = 0;
  const now = Date.now();

  for (const item of cartItems) {
    const materialFiles = Array.isArray(item.material_files)
      ? (item.material_files as { path: string }[])
      : [];
    if (materialFiles.some((file) => !file.path.startsWith(`${user.id}/`))) {
      return { ok: false as const, error: "Ada file materi yang bukan milik akunmu." };
    }
  }

  const itemsToInsert = cartItems.map((item) => {
    const product = item.product as unknown as {
      name: string;
      base_price: number;
      express_fee_percent: number | null;
      revision_limit: number;
    };
    const variation = item.variation as unknown as { name: string; price: number } | null;
    const unitPrice = variation?.price ?? product.base_price;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;

    const isUrgent = item.deadline_at ? new Date(item.deadline_at).getTime() - now < 24 * 60 * 60 * 1000 : false;
    const lineExpressFee = isUrgent && product.express_fee_percent ? (lineTotal * product.express_fee_percent) / 100 : 0;
    expressFee += lineExpressFee;

    return {
      product_id: item.product_id,
      variation_id: item.variation_id,
      product_name_snapshot: variation ? `${product.name} — ${variation.name}` : product.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      configuration: item.configuration,
      material_status: item.material_status,
      material_text: item.material_text,
      material_files: item.material_files,
      deadline_at: item.deadline_at,
      notes: item.notes,
      revision_limit: product.revision_limit,
    };
  });

  // Voucher (opsional) — validasi dasar; perhitungan lengkap per kategori/produk
  // spesifik disempurnakan saat admin voucher management dibangun (Fase 3).
  let discountAmount = 0;
  let voucherId: string | null = null;

  if (input.voucherCode) {
    const { data: voucher } = await supabase
      .from("vouchers")
      .select("*")
      .eq("code", input.voucherCode.toUpperCase())
      .eq("is_active", true)
      .single();

    if (!voucher) {
      return { ok: false as const, error: "Kode voucher tidak ditemukan atau tidak aktif." };
    }
    const nowDate = new Date();
    if (nowDate < new Date(voucher.start_date) || nowDate > new Date(voucher.end_date)) {
      return { ok: false as const, error: "Voucher sudah tidak berlaku." };
    }
    if (subtotal < voucher.minimum_purchase) {
      return { ok: false as const, error: `Minimal belanja untuk voucher ini adalah Rp${voucher.minimum_purchase.toLocaleString("id-ID")}.` };
    }

    discountAmount =
      voucher.discount_type === "percentage" ? (subtotal * voucher.discount_amount) / 100 : voucher.discount_amount;
    if (voucher.maximum_discount) discountAmount = Math.min(discountAmount, voucher.maximum_discount);
    voucherId = voucher.id;
  }

  const total = Math.max(subtotal + expressFee - discountAmount, 0);
  const orderNumber = generateOrderNumber();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      user_id: user.id,
      status: "PENDING_PAYMENT",
      subtotal,
      express_fee: expressFee,
      discount_amount: discountAmount,
      voucher_id: voucherId,
      total,
      customer_agreement: true,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return { ok: false as const, error: "Gagal membuat pesanan. Coba lagi." };
  }

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemsToInsert.map((item) => ({ ...item, order_id: order.id })));

  if (itemsError) {
    return { ok: false as const, error: "Gagal menyimpan detail pesanan." };
  }

  const admin = createAdminClient();
  await admin.from("order_status_history").insert({
    order_id: order.id,
    status: "PENDING_PAYMENT",
    note: "Pesanan dibuat oleh customer.",
  });

  if (voucherId) {
    await admin.from("voucher_usages").insert({ voucher_id: voucherId, user_id: user.id, order_id: order.id });
  }

  await supabase.from("cart_items").delete().eq("user_id", user.id);

  redirect(`/orders/${order.id}`);
}
