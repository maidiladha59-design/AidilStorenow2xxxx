"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function adminLogin(input: { email: string; password: string }) {
  const supabase = await createClient();

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (signInError || !signInData.user) {
    return { ok: false as const, error: "Email atau password salah." };
  }

  const { data: adminUser } = await supabase
    .from("admin_users")
    .select("id, is_active")
    .eq("id", signInData.user.id)
    .single();

  if (!adminUser || !adminUser.is_active) {
    await supabase.auth.signOut();
    return { ok: false as const, error: "Akun ini tidak memiliki akses admin." };
  }

  redirect("/admin");
}

export async function adminLogout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
