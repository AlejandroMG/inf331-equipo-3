/** Montos en CLP enteros: 12000 → "$12.000". */
export function formatClp(amount: number): string {
  return '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
