const formatter = new Intl.NumberFormat("en-US");

export function money(amount: number): string {
  return `${formatter.format(Math.round(amount))} Ks`;
}
