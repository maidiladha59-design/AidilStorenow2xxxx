"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export type ProductFormInput = {
  name: string;
  slug: string;
  categoryId: string | null;
  description: string;
  shortDescription: string;
  priceType: "fixed" | "per_page" | "per_slide" | "per_question" | "per_sheet" | "custom";
  basePrice: number;
  priceUnit: string | null;
  estimatedTime: string;
  revisionLimit: number;
  isDigital: boolean;
  status: "draft" | "published" | "archived";
  featured: boolean;
  popular: boolean;
  image: string | null;
  expressFeePercent: number | null;
};

export async function createProduct(input: ProductFormInput) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  const { data, error } = await db
    .from("products")
    .insert({
      name: input.name,
      slug: input.slug,
      category_id: input.categoryId,
      description: input.description,
      short_description: input.shortDescription,
      price_type: input.priceType,
      base_price: input.basePrice,
      price_unit: input.priceUnit,
      estimated_time: input.estimatedTime,
      revision_limit: input.revisionLimit,
      is_digital: input.isDigital,
      status: input.status,
      featured: input.featured,
      popular: input.popular,
      image: input.image,
      express_fee_percent: input.expressFeePercent,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false as const, error: "Gagal membuat produk. Cek kembali slug (harus unik)." };

  revalidatePath("/admin/products");
  redirect(`/admin/products/${data.id}/edit`);
}

export async function updateProduct(id: string, input: ProductFormInput) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  const { error } = await db
    .from("products")
    .update({
      name: input.name,
      slug: input.slug,
      category_id: input.categoryId,
      description: input.description,
      short_description: input.shortDescription,
      price_type: input.priceType,
      base_price: input.basePrice,
      price_unit: input.priceUnit,
      estimated_time: input.estimatedTime,
      revision_limit: input.revisionLimit,
      is_digital: input.isDigital,
      status: input.status,
      featured: input.featured,
      popular: input.popular,
      image: input.image,
      express_fee_percent: input.expressFeePercent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { ok: false as const, error: "Gagal menyimpan perubahan." };

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}/edit`);
  return { ok: true as const };
}

export async function addVariation(productId: string, input: { name: string; price: number; description: string; extraFee: number }) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  const { error } = await db.from("product_variations").insert({
    product_id: productId,
    name: input.name,
    price: input.price,
    description: input.description || null,
    extra_fee: input.extraFee,
  });
  if (error) return { ok: false as const, error: "Gagal menambah variasi." };

  revalidatePath(`/admin/products/${productId}/edit`);
  return { ok: true as const };
}

export async function deleteVariation(variationId: string, productId: string) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  await db.from("product_variations").delete().eq("id", variationId);
  revalidatePath(`/admin/products/${productId}/edit`);
  return { ok: true as const };
}

export async function addConfigField(
  productId: string,
  input: { fieldKey: string; fieldLabel: string; fieldType: "number" | "text" | "select" | "textarea" | "date"; options: string | null; isRequired: boolean }
) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  const { error } = await db.from("product_configuration_fields").insert({
    product_id: productId,
    field_key: input.fieldKey,
    field_label: input.fieldLabel,
    field_type: input.fieldType,
    options: input.options ? input.options.split(",").map((s) => s.trim()) : null,
    is_required: input.isRequired,
  });
  if (error) return { ok: false as const, error: "Gagal menambah field." };

  revalidatePath(`/admin/products/${productId}/edit`);
  return { ok: true as const };
}

export async function deleteConfigField(fieldId: string, productId: string) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  await db.from("product_configuration_fields").delete().eq("id", fieldId);
  revalidatePath(`/admin/products/${productId}/edit`);
  return { ok: true as const };
}

export async function createCategory(input: { name: string; slug: string; icon: string | null }) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  const { error } = await db.from("categories").insert({ name: input.name, slug: input.slug, icon: input.icon });
  if (error) return { ok: false as const, error: "Gagal membuat kategori. Cek slug (harus unik)." };

  revalidatePath("/admin/categories");
  return { ok: true as const };
}

export async function toggleCategoryActive(id: string, isActive: boolean) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  await db.from("categories").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/admin/categories");
  return { ok: true as const };
}

export async function toggleCustomerSuspend(userId: string, suspend: boolean) {
  const admin = await requireAdmin();
  if (!admin) return { ok: false as const, error: "Tidak diizinkan." };

  const db = createAdminClient();
  await db.from("profiles").update({ is_suspended: suspend }).eq("id", userId);
  revalidatePath("/admin/customers");
  return { ok: true as const };
}
