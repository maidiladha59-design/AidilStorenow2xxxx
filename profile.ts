"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().min(2, "Nama minimal 2 karakter"),
  whatsapp: z.string().min(9, "Nomor WhatsApp tidak valid"),
});

export async function updateProfile(input: { fullName: string; whatsapp: string }) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, whatsapp: parsed.data.whatsapp, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false as const, error: "Gagal menyimpan profil." };

  revalidatePath("/profile");
  return { ok: true as const };
}

export async function changePassword(newPassword: string) {
  if (newPassword.length < 8) {
    return { ok: false as const, error: "Password minimal 8 karakter." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false as const, error: "Gagal mengubah password." };
  return { ok: true as const };
}
