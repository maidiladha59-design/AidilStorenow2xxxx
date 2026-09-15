"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const materialFileSchema = z.object({
  path: z.string(),
  name: z.string(),
  size: z.number(),
});

const addToCartSchema = z.object({
  productId: z.string().uuid(),
  variationId: z.string().uuid().nullable(),
  quantity: z.number().int().positive().default(1),
  configuration: z.record(z.string(), z.any()).default({}),
  materialStatus: z.enum(["available", "unavailable"]),
  materialText: z.string().nullable(),
  materialFiles: z.array(materialFileSchema).default([]),
  deadlineAt: z.string().nullable(),
  notes: z.string().nullable(),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;

export async function addToCart(input: AddToCartInput) {
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Data pesanan tidak valid. Periksa kembali isian kamu." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, error: "Kamu harus login terlebih dahulu.", requiresLogin: true };
  }

  // Materi kosong wajib jika status "unavailable" — dijaga di server, bukan cuma di UI
  const materialText = data.materialStatus === "unavailable" ? null : data.materialText;
  const materialFiles = data.materialStatus === "unavailable" ? [] : data.materialFiles;

  const { error } = await supabase.from("cart_items").insert({
    user_id: user.id,
    product_id: data.productId,
    variation_id: data.variationId,
    quantity: data.quantity,
    configuration: data.configuration,
    material_status: data.materialStatus,
    material_text: materialText,
    material_files: materialFiles,
    deadline_at: data.deadlineAt,
    notes: data.notes,
  });

  if (error) {
    return { ok: false as const, error: "Gagal menambahkan ke keranjang. Coba lagi." };
  }

  revalidatePath("/cart");
  return { ok: true as const };
}

export async function removeCartItem(cartItemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  const { error } = await supabase.from("cart_items").delete().eq("id", cartItemId).eq("user_id", user.id);
  if (error) return { ok: false as const, error: "Gagal menghapus item." };

  revalidatePath("/cart");
  return { ok: true as const };
}

export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  if (quantity < 1) return { ok: false as const, error: "Jumlah minimal 1." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq("id", cartItemId)
    .eq("user_id", user.id);
  if (error) return { ok: false as const, error: "Gagal mengubah jumlah." };

  revalidatePath("/cart");
  return { ok: true as const };
}
