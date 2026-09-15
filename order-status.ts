export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Menunggu Pembayaran",
  PAYMENT_REVIEW: "Pembayaran Diperiksa",
  PAYMENT_VERIFIED: "Pembayaran Terverifikasi",
  PROCESSING: "Diproses",
  REVISION_REQUESTED: "Revisi Diajukan",
  REVISION_PROCESSING: "Revisi Diproses",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  REFUNDED: "Dikembalikan",
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  PENDING_PAYMENT: "bg-gold-500/15 text-gold-500",
  PAYMENT_REVIEW: "bg-gold-500/15 text-gold-500",
  PAYMENT_VERIFIED: "bg-signal-500/10 text-signal-600",
  PROCESSING: "bg-signal-500/10 text-signal-600",
  REVISION_REQUESTED: "bg-flag-500/10 text-flag-500",
  REVISION_PROCESSING: "bg-flag-500/10 text-flag-500",
  COMPLETED: "bg-emerald-500/10 text-emerald-600",
  CANCELLED: "bg-ink-900/10 text-ink-500",
  REFUNDED: "bg-ink-900/10 text-ink-500",
};

export const ORDER_TIMELINE_STEPS = [
  { key: "created", label: "Pesanan dibuat" },
  { key: "PAYMENT_VERIFIED", label: "Pembayaran diverifikasi" },
  { key: "PROCESSING", label: "Pesanan diproses" },
  { key: "REVISION_REQUESTED", label: "Revisi" },
  { key: "COMPLETED", label: "Pesanan selesai" },
];
