"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleWishlist(productId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Kamu harus login.", requiresLogin: true };

  const { data: existing } = await supabase
    .from("wishlists")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await supabase.from("wishlists").delete().eq("id", existing.id);
    revalidatePath("/wishlist");
    return { ok: true as const, wishlisted: false };
  }

  await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId });
  revalidatePath("/wishlist");
  return { ok: true as const, wishlisted: true };
}
