"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { salvarEscritorio, type Resultado } from "./actions";

const SECOES: { titulo: string; campos: [string, string][] }[] = [
  {
    titulo: "Dados da contratada",
    campos: [
      ["razao_social", "Razão social"], ["cnpj", "CNPJ"], ["telefone", "Telefone"], ["email", "E-mail"],
      ["inscricao_municipal", "Inscrição municipal"], ["responsavel_tecnico", "Responsável técnico"],
      ["crc", "CRC"], ["cidade_foro", "Cidade do foro"],
    ],
  },
  {
    titulo: "Endereço",
    campos: [
      ["logradouro", "Logradouro"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"],
      ["cidade", "Cidade"], ["uf", "UF"], ["cep", "CEP"],
    ],
  },
  {
    titulo: "Parâmetros financeiros",
    campos: [
      ["multa_pct", "Multa (%)"], ["juros_mes_pct", "Juros ao mês (%)"], ["nome_cobranca", "Nome da cobrança"],
      ["dia_vencimento_padrao", "Dia de vencimento padrão"], ["indicacao_pct", "Benefício de indicação (%)"],
      ["notificar_em", "Lembretes do Cora (notificar em)"],
    ],
  },
];

export function FormularioEscritorio({
  valores,
  somenteLeitura,
}: {
  valores: Record<string, string>;
  somenteLeitura: boolean;
}) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(salvarEscritorio, {});
  return (
    <form action={acao} className="space-y-6">
      <fieldset disabled={somenteLeitura} className="space-y-6">
        {SECOES.map((s) => (
          <section key={s.titulo} className="space-y-3 rounded-lg border p-4">
            <h2 className="font-medium">{s.titulo}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {s.campos.map(([nome, rotulo]) => (
                <label key={nome} className="space-y-1 text-sm">
                  <span>{rotulo}</span>
                  <input name={nome} defaultValue={valores[nome] ?? ""} className="block w-full rounded border px-3 py-2 disabled:bg-muted" />
                </label>
              ))}
            </div>
          </section>
        ))}
        {!somenteLeitura && <Button type="submit" disabled={pendente}>Salvar</Button>}
      </fieldset>
      {estado.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
      {estado.ok && <p role="status" className="text-sm text-green-700">Cadastro salvo.</p>}
    </form>
  );
}
