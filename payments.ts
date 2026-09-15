"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type PaymentMethod = "bank_jago" | "dana" | "gopay" | "qris";

export async function submitOrderPayment(input: {
  orderId: string;
  method: PaymentMethod;
  proofFileUrl: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, total")
    .eq("id", input.orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) return { ok: false as const, error: "Pesanan tidak ditemukan." };
  if (!["PENDING_PAYMENT"].includes(order.status)) {
    return { ok: false as const, error: "Pesanan ini tidak sedang menunggu pembayaran." };
  }

  const expectedPrefix = `${user.id}/`;
  if (!input.proofFileUrl.startsWith(expectedPrefix)) {
    return { ok: false as const, error: "File bukti pembayaran tidak valid." };
  }

  const admin = createAdminClient();
  const { error: paymentError } = await admin.from("payments").insert({
    order_id: order.id,
    method: input.method,
    amount: order.total,
    status: "PAYMENT_REVIEW",
    proof_file_url: input.proofFileUrl,
  });
  if (paymentError) return { ok: false as const, error: "Gagal menyimpan bukti pembayaran." };

  await admin.from("orders").update({ status: "PAYMENT_REVIEW" }).eq("id", order.id);
  await admin.from("order_status_history").insert({
    order_id: order.id,
    status: "PAYMENT_REVIEW",
    note: "Customer mengunggah bukti pembayaran.",
  });

  revalidatePath(`/orders/${order.id}`);
  return { ok: true as const };
}

export async function payWithWallet(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, total, order_number")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .single();

  if (!order) return { ok: false as const, error: "Pesanan tidak ditemukan." };
  if (order.status !== "PENDING_PAYMENT") {
    return { ok: false as const, error: "Pesanan ini tidak sedang menunggu pembayaran." };
  }

  const admin = createAdminClient();
  const { error: rpcError } = await admin.rpc("apply_wallet_transaction", {
    p_user_id: user.id,
    p_type: "purchase",
    p_amount: -order.total,
    p_reference_order_id: order.id,
    p_note: `Pembayaran ${order.order_number} pakai saldo`,
  });

  if (rpcError) {
    const isInsufficient = rpcError.message?.toLowerCase().includes("saldo");
    return {
      ok: false as const,
      error: isInsufficient ? "Saldo tidak mencukupi." : "Gagal memproses pembayaran dari saldo.",
    };
  }

  const { error: paymentInsertError } = await admin.from("payments").insert({
    order_id: order.id,
    method: "wallet",
    amount: order.total,
    status: "PAYMENT_VERIFIED",
    verified_at: new Date().toISOString(),
  });
  if (paymentInsertError) {
    // Kembalikan saldo bila pencatatan pembayaran gagal.
    await admin.rpc("apply_wallet_transaction", {
      p_user_id: user.id,
      p_type: "refund",
      p_amount: order.total,
      p_reference_order_id: order.id,
      p_note: "Rollback pembayaran wallet karena pencatatan payment gagal",
    });
    return { ok: false as const, error: "Gagal mencatat pembayaran wallet." };
  }

  await finalizeVerifiedOrder(order.id);

  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/profile");
  return { ok: true as const };
}

/**
 * Dipanggil setelah pembayaran terverifikasi (baik instan via wallet, maupun
 * setelah admin menyetujui bukti transfer manual). Memakai admin client
 * karena perlu update lintas tabel yang tidak semuanya boleh ditulis customer.
 */
export async function finalizeVerifiedOrder(orderId: string) {
  const admin = createAdminClient();

  await admin.from("orders").update({ status: "PAYMENT_VERIFIED" }).eq("id", orderId);
  await admin.from("order_status_history").insert({
    order_id: orderId,
    status: "PAYMENT_VERIFIED",
    note: "Pembayaran terverifikasi.",
  });

  const { data: order } = await admin.from("orders").select("user_id, order_number").eq("id", orderId).single();
  const { data: items } = await admin
    .from("order_items")
    .select("id, product_id, products(is_digital)")
    .eq("order_id", orderId);

  if (order) {
    await admin.from("notifications").insert({
      user_id: order.user_id,
      type: "payment_approved",
      title: "Pembayaran terverifikasi",
      body: `Pembayaran untuk pesanan ${order.order_number} telah diverifikasi dan mulai diproses.`,
      reference_order_id: orderId,
    });

    const digitalItems = (items ?? []).filter(
      (i) => (i.products as unknown as { is_digital: boolean } | null)?.is_digital
    );
    if (digitalItems.length > 0) {
      await admin.from("digital_product_purchases").insert(
        digitalItems.map((i) => ({
          user_id: order.user_id,
          order_item_id: i.id,
          product_id: i.product_id,
        }))
      );
      // Produk digital tidak perlu tahap "diproses manual" — langsung selesai.
      await admin.from("orders").update({ status: "COMPLETED" }).eq("id", orderId);
      await admin.from("order_status_history").insert({
        order_id: orderId,
        status: "COMPLETED",
        note: "Produk digital — akses download diberikan otomatis.",
      });
    } else {
      await admin.from("orders").update({ status: "PROCESSING" }).eq("id", orderId);
      await admin.from("order_status_history").insert({
        order_id: orderId,
        status: "PROCESSING",
        note: "Pesanan mulai dikerjakan.",
      });
    }
  }
}
