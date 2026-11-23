import { redirect } from "next/navigation";

import { hojeSP } from "@/domain/datas";

/** /financeiro abre o fechamento do mês corrente (ou o informado em ?competencia=AAAA-MM). */
export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ competencia?: string }> }) {
  const sp = await searchParams;
  const competencia = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.competencia ?? "") ? sp.competencia! : hojeSP().slice(0, 7);
  redirect(`/financeiro/${competencia}`);
}
