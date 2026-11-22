"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { enviarModelo, restaurarModeloPadrao, type Resultado } from "./actions";

export function ModeloContrato({ caminho, somenteLeitura }: { caminho: string | null; somenteLeitura: boolean }) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(enviarModelo, {});
  const [estadoRestaurar, restaurar, restaurando] = useActionState<Resultado, FormData>(
    async () => restaurarModeloPadrao(),
    {},
  );
  const erro = estado.erro ?? estadoRestaurar.erro;
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h2 className="font-medium">Modelo de contrato</h2>
      <p className="text-sm">
        {caminho ? <>Modelo personalizado: <code>{caminho}</code></> : "Modelo padrão do sistema (templates/contrato-padrao.docx)"}
      </p>
      {!somenteLeitura && (
        <>
          <form action={acao} className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm"><span>Substituir modelo (.docx, até 5 MB)</span>
              <input type="file" name="modelo" accept=".docx" required className="block" /></label>
            <Button type="submit" disabled={pendente}>Enviar</Button>
          </form>
          {caminho && (
            <form action={restaurar}>
              <Button type="submit" variant="outline" disabled={restaurando}>Voltar ao modelo padrão</Button>
            </form>
          )}
        </>
      )}
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
      {(estado.ok || estadoRestaurar.ok) && <p role="status" className="text-sm text-green-700">Modelo atualizado.</p>}
    </section>
  );
}
