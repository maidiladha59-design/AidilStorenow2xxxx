import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Klien Supabase dengan SERVICE ROLE KEY — melewati Row Level Security.
 *
 * ATURAN KERAS:
 * - Import "server-only" di atas membuat build GAGAL jika file ini
 *   ter-bundle ke Client Component secara tidak sengaja.
 * - Jangan pernah panggil dari kode yang bisa dijalankan di browser.
 * - Hanya dipakai untuk operasi admin yang memang butuh bypass RLS,
 *   misalnya: generate signed URL download produk digital, verifikasi
 *   pembayaran oleh admin, atau job internal (webhook, cron).
 * - Untuk permintaan atas nama user biasa, selalu pakai
 *   lib/supabase/server.ts (anon key + RLS), bukan file ini.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
