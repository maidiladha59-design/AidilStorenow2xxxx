// File ini akan digantikan otomatis oleh:
//   npx supabase gen types typescript --project-id <project-id> > types/supabase.ts
// setelah schema.sql dijalankan di project Supabase yang sebenarnya.
// Untuk sementara, pakai tipe longgar agar proyek tetap bisa di-build.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
