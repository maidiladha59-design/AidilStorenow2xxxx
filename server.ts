import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

/**
 * Klien Supabase untuk Server Component, Server Action, dan Route Handler.
 * Menghormati session user yang sedang login lewat cookie — TETAP memakai
 * anon key, jadi tunduk pada Row Level Security seperti user biasa.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as CookieOptions)
            );
          } catch {
            // Dipanggil dari Server Component tanpa akses write cookie —
            // aman diabaikan selama ada middleware yang me-refresh session.
          }
        },
      },
    }
  );
}
