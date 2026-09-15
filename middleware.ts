import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const CUSTOMER_PROTECTED = ["/orders", "/downloads", "/wishlist", "/profile", "/notifications", "/checkout", "/cart"];
const ADMIN_PROTECTED = ["/admin"];
const ADMIN_PUBLIC = ["/admin/login"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isAdminRoute = ADMIN_PROTECTED.some((p) => path.startsWith(p)) &&
    !ADMIN_PUBLIC.some((p) => path.startsWith(p));
  const isCustomerRoute = CUSTOMER_PROTECTED.some((p) => path.startsWith(p));

  if (!user && (isAdminRoute || isCustomerRoute)) {
    const redirectPath = isAdminRoute ? "/admin/login" : "/login";
    const url = request.nextUrl.clone();
    url.pathname = redirectPath;
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Catatan: pengecekan role admin (SUPER_ADMIN/ADMIN/STAFF) untuk
  // membedakan akses antar sub-halaman /admin/* dilakukan di layout
  // /app/admin/layout.tsx dengan query ke tabel admin_users, karena
  // middleware sebaiknya tetap ringan (hanya cek "sudah login atau belum").

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};
