export function formatMoney(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}
