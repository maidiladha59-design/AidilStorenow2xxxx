# AIDIL STORE — Solusi Digital

## Status: Fase 1–4 ✅ (sudah diaudit dan diperketat)

**Catatan pengujian:** saya sudah melakukan audit statis terhadap source code dan SQL.
Build penuh tetap perlu dijalankan di komputer kamu karena dependency npm tidak tersedia
di environment audit ini.

### Fondasi (Fase 1)
- Next.js 15 (App Router) + TypeScript + Tailwind, design token brand (navy/blue/gold/red, font Sora + Inter)
- `supabase/schema.sql` — skema lengkap: produk, variasi, field konfigurasi dinamis,
  order, order_items, payment, wallet_ledger, voucher, promo, wishlist, banner, chat,
  review, notifikasi, admin_users + Row Level Security, trigger otomatis bikin profil saat user baru daftar
- `supabase/schema-fase3.sql` — migrasi tambahan: wallet_topup_requests, metode
  pembayaran "wallet", fungsi `apply_wallet_transaction` (atomik, SECURITY DEFINER)
- `lib/supabase/{client,server,admin}.ts` — client browser, server (RLS), admin (service role, dijaga `server-only`)
- `middleware.ts`, Navbar, Footer, Home page dengan statistik dari database

### Customer core (Fase 2)
- `/products`, `/products/[slug]`, flow pemesanan lengkap (modal materi → konfigurasi → deadline → catatan)
- `/cart`, `/checkout`, `/orders`, `/orders/[id]` dengan timeline status

### Pembayaran, wallet, akun (Fase 3)
- `/login`, `/register`, `/forgot-password`, Google OAuth (`app/auth/callback`)
- Panel pembayaran di halaman order: transfer manual (Bank Jago/DANA/GoPay/QRIS) + upload bukti, atau bayar pakai saldo
- `/profile` — edit profil, ganti password, top up saldo, riwayat wallet
- Admin: `/admin/login`, dashboard, verifikasi pembayaran & top up, kelola produk/kategori/pelanggan/order

### Produk digital, chat, review, marketplace lengkap (Fase 4)
- `/digital-products`, `/downloads` dengan signed URL (link download berlaku 5 menit, ada limit & expiry)
- `/wishlist` + tombol hati di kartu & detail produk
- `/notifications`
- Chat per-order (customer ↔ admin) di halaman detail order masing-masing, termasuk upload gambar/dokumen
- Revisi (ajukan revisi dari halaman order, kuota otomatis berkurang) & review (submit setelah selesai, moderasi admin)
- Admin: voucher, promo, moderasi review, pengaturan metode pembayaran (SUPER_ADMIN only)
- Halaman statis: `/how-to-order`, `/about`, `/contact`, `/help`

## Yang BELUM dibuat (jujur, supaya tidak ada ekspektasi salah)
- **Admin: manajemen banner, file/media library, admin lain (SUPER_ADMIN kelola staff)** —
  tabel `banners` sudah ada di skema, tapi belum ada UI admin untuk mengisinya
- **Halaman publik untuk banner** — belum ditampilkan di homepage (hero masih statis)
- **Payment gateway otomatis** — arsitektur sudah disiapkan (kolom `gateway_*` di
  tabel `payments`), tapi integrasi nyata (Midtrans/Xendit/dll) belum dikerjakan
- Realtime chat (saat ini refresh manual via server action, bukan WebSocket/Supabase Realtime)
- Notifikasi push/email — saat ini hanya tersimpan di tabel `notifications` dan dibaca lewat `/notifications`

## Perbaikan penting hasil audit
- RLS diaktifkan pada tabel internal yang sebelumnya belum terlindungi.
- `profiles.wallet_balance` dan `is_suspended` tidak lagi dapat diubah customer melalui update profil.
- RPC wallet dibatasi ke `service_role`; pembayaran wallet dilakukan lewat server.
- Approval top up dibuat atomik agar request yang sama tidak dapat menambah saldo dua kali.
- Payment proof dan material path divalidasi agar berasal dari folder user yang sedang login.
- Signed URL hasil pengerjaan sekarang diverifikasi terhadap order dan item sebelum dibuat.
- Riwayat status/revisi memakai RLS; mutasi sensitif dilakukan dari server/admin.
- Storage policy dibuat lebih spesifik untuk `materials`, `payment-proofs`, `chat-files`, `results`, dan `digital-products`.

## Cara menjalankan

1. Buat project Supabase, jalankan `supabase/schema.sql`, lalu jalankan `supabase/schema-fase3.sql`
   (baca komentar di dalamnya — ada satu baris `alter type` yang harus dijalankan terpisah).
2. Buat 5 bucket Storage **privat**: `materials`, `payment-proofs`, `digital-products`, `results`, `chat-files`.
   Jalankan blok **Storage policies** di `supabase/schema-fase3.sql` setelah bucket dibuat.
   Jangan memakai policy generik lama di bawah ini karena `chat-files` menggunakan folder `orderId`,
   bukan `userId`. Bucket `digital-products` tidak diberi akses customer langsung; akses download
   dilakukan melalui signed URL server.
3. Aktifkan provider Google di Supabase Auth (Authentication → Providers) jika ingin
   Google OAuth berfungsi, dan tambahkan `<site-url>/auth/callback` ke Redirect URLs.
4. Buat akun admin pertama secara manual: daftar lewat `/register` seperti biasa
   (atau lewat Supabase Dashboard), lalu insert manual ke tabel `admin_users`:
   ```sql
   insert into admin_users (id, full_name, role) values ('<user-id-dari-auth.users>', 'Nama Admin', 'SUPER_ADMIN');
   ```
5. Salin `.env.example` → `.env.local`, isi semua variabel.
6. `npm install`
7. `npm run dev`
8. (Opsional) `npx supabase gen types typescript --project-id <project-id> > types/supabase.ts`

## Struktur folder penting
- `app/(customer)/` — semua halaman customer (Navbar & Footer otomatis lewat layout grup ini)
- `app/admin/(dashboard)/` — halaman admin yang butuh login (sidebar otomatis lewat layout grup ini)
- `app/admin/login/` — di luar grup dashboard, sengaja tanpa sidebar
- `lib/actions/` — server actions customer; `lib/actions/admin/` — server actions khusus admin (selalu verifikasi role dulu)
