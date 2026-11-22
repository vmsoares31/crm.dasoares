import extenso from "extenso";
import type { Centavos } from "./tipos";

export function valorPorExtenso(c: Centavos): string {
  const abs = Math.abs(Math.round(c));
  const txt = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return extenso(txt, { mode: "currency" });
}
