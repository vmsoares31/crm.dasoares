"use client";

import { useActionState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          <Card key={s.titulo}>
            <CardHeader>
              <CardTitle><h2>{s.titulo}</h2></CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              {s.campos.map(([nome, rotulo]) => (
                <label key={nome} className="space-y-1.5 text-sm font-medium">
                  <span>{rotulo}</span>
                  <input name={nome} defaultValue={valores[nome] ?? ""} className="campo w-full font-normal" />
                </label>
              ))}
            </CardContent>
          </Card>
        ))}
        {!somenteLeitura && <Button type="submit" disabled={pendente}>Salvar</Button>}
      </fieldset>
      {estado.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado.ok && <Mensagem tipo="ok">Cadastro salvo.</Mensagem>}
    </form>
  );
}
