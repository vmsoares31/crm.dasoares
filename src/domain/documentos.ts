export function somenteDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

function digito(base: number[], pesos: number[]): number {
  const soma = base.reduce((acc, n, i) => acc + n * pesos[i], 0);
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}

export function cpfValido(s: string): boolean {
  const d = somenteDigitos(s);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const n = d.split("").map(Number);
  const d1 = digito(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === n[9] && d2 === n[10];
}

export function cnpjValido(s: string): boolean {
  const d = somenteDigitos(s);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const n = d.split("").map(Number);
  const d1 = digito(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digito(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === n[12] && d2 === n[13];
}

/** Formata CPF (11 dígitos) ou CNPJ (14); outros tamanhos voltam só com dígitos. */
export function formatarDocumento(s: string): string {
  const d = somenteDigitos(s);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
}
