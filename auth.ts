"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Nama lengkap minimal 2 karakter"),
    email: z.string().email("Email tidak valid"),
    whatsapp: z.string().min(9, "Nomor WhatsApp tidak valid"),
    password: z.string().min(8, "Password minimal 8 karakter"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak sama",
    path: ["confirmPassword"],
  });

export async function registerCustomer(input: z.infer<typeof registerSchema>) {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });

  if (error) return { ok: false as const, error: error.message.includes("already") ? "Email sudah terdaftar." : "Gagal mendaftar." };
  if (!data.user) return { ok: false as const, error: "Gagal mendaftar." };

  // Simpan whatsapp — trigger handle_new_user sudah membuat baris profiles,
  // di sini kita lengkapi field yang tidak bisa diisi trigger.
  await supabase.from("profiles").update({ whatsapp: parsed.data.whatsapp }).eq("id", data.user.id);

  redirect("/login?registered=1");
}

export async function loginCustomer(input: { email: string; password: string; next?: string }) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });

  if (error) return { ok: false as const, error: "Email atau password salah." };

  redirect(input.next || "/");
}

export async function logoutCustomer() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(email: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  });
  if (error) return { ok: false as const, error: "Gagal mengirim email reset password." };
  return { ok: true as const };
}
