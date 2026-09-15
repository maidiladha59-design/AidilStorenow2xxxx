"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: adminUser } = await supabase.from("admin_users").select("id, role, is_active").eq("id", user.id).single();
  if (!adminUser || !adminUser.is_active) return null;
  return adminUser;
}

export type VoucherInput = {
  code: string;
  discountType: "percentage" | "fixed";
  discountAmount: number;
  minimumPurchase: number;
  maximumDiscount: number | null;
  startDate: string;
  endDate: string;
  usageLimit: number | null;
  userUsageLimit: number;
};

export async function createVoucher(input: VoucherInput) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  const { error } = await db.from("vouchers").insert({
    code: input.code.toUpperCase(),
    discount_type: input.discountType,
    discount_amount: input.discountAmount,
    minimum_purchase: input.minimumPurchase,
    maximum_discount: input.maximumDiscount,
    start_date: input.startDate,
    end_date: input.endDate,
    usage_limit: input.usageLimit,
    user_usage_limit: input.userUsageLimit,
  });
  if (error) return { ok: false as const, error: "Gagal membuat voucher. Cek kembali kode (harus unik)." };

  revalidatePath("/admin/vouchers");
  return { ok: true as const };
}

export async function toggleVoucherActive(id: string, isActive: boolean) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  await db.from("vouchers").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/vouchers");
  return { ok: true as const };
}

export type PromoInput = {
  type: "product_promo" | "flash_sale" | "discount_campaign" | "bundle" | "student_promo";
  name: string;
  description: string;
  discountType: "percentage" | "fixed" | null;
  discountAmount: number | null;
  startDate: string;
  endDate: string;
};

export async function createPromo(input: PromoInput) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  const { error } = await db.from("promos").insert({
    type: input.type,
    name: input.name,
    description: input.description || null,
    discount_type: input.discountType,
    discount_amount: input.discountAmount,
    start_date: input.startDate,
    end_date: input.endDate,
  });
  if (error) return { ok: false as const, error: "Gagal membuat promo." };

  revalidatePath("/admin/promos");
  return { ok: true as const };
}

export async function togglePromoActive(id: string, isActive: boolean) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  await db.from("promos").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/promos");
  return { ok: true as const };
}

export async function moderateReview(id: string, status: "approved" | "hidden") {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  await db.from("reviews").update({ status }).eq("id", id);
  revalidatePath("/admin/reviews");
  return { ok: true as const };
}

export async function updatePaymentMethod(input: {
  type: "bank_jago" | "dana" | "gopay" | "qris";
  isEnabled: boolean;
  accountNumber: string | null;
  accountName: string | null;
  qrisImageUrl: string | null;
}) {
  const admin = await requireAdmin();
  if (!admin || admin.role !== "SUPER_ADMIN") return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  const { error } = await db.from("payment_methods").upsert(
    {
      type: input.type,
      is_enabled: input.isEnabled,
      account_number: input.accountNumber,
      account_name: input.accountName,
      qris_image_url: input.qrisImageUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "type" }
  );
  if (error) return { ok: false as const, error: "Gagal menyimpan pengaturan." };

  revalidatePath("/admin/settings");
  revalidatePath("/orders");
  revalidatePath("/profile");
  return { ok: true as const };
}
