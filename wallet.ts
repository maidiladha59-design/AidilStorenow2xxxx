"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function requestTopup(input: { amount: number; method: "bank_jago" | "dana" | "gopay" | "qris"; proofFileUrl: string }) {
  if (input.amount < 10000) {
    return { ok: false as const, error: "Minimal top up Rp10.000." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Belum login." };

  if (!input.proofFileUrl.startsWith(`${user.id}/`)) {
    return { ok: false as const, error: "File bukti top up tidak valid." };
  }

  const { error } = await supabase.from("wallet_topup_requests").insert({
    user_id: user.id,
    amount: input.amount,
    method: input.method,
    proof_file_url: input.proofFileUrl,
    status: "PAYMENT_REVIEW",
  });

  if (error) return { ok: false as const, error: "Gagal mengirim permintaan top up." };

  revalidatePath("/profile");
  return { ok: true as const };
}
