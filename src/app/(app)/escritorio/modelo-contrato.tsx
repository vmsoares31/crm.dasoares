"use client";

import { useActionState } from "react";

import { Mensagem } from "@/components/mensagem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { enviarModelo, restaurarModeloPadrao, type Resultado } from "./actions";

export function ModeloContrato({ caminho, somenteLeitura }: { caminho: string | null; somenteLeitura: boolean }) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(enviarModelo, {});
  const [estadoRestaurar, restaurar, restaurando] = useActionState<Resultado, FormData>(
    async () => restaurarModeloPadrao(),
    {},
  );
  const erro = estado.erro ?? estadoRestaurar.erro;
  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Modelo de contrato</h2></CardTitle>
        <CardDescription>
          {caminho ? <>Modelo personalizado: <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{caminho}</code></> : "Modelo padrão do sistema (templates/contrato-padrao.docx)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!somenteLeitura && (
          <>
            <form action={acao} className="flex flex-wrap items-end gap-3">
              <label className="space-y-1.5 text-sm font-medium"><span>Substituir modelo (.docx, até 5 MB)</span>
                <input type="file" name="modelo" accept=".docx" required className="block text-sm font-normal text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-accent-foreground hover:file:bg-accent/80" /></label>
              <Button type="submit" disabled={pendente}>Enviar</Button>
            </form>
            {caminho && (
              <form action={restaurar}>
                <Button type="submit" variant="outline" disabled={restaurando}>Voltar ao modelo padrão</Button>
              </form>
            )}
          </>
        )}
        {erro && <Mensagem tipo="erro">{erro}</Mensagem>}
        {(estado.ok || estadoRestaurar.ok) && <Mensagem tipo="ok">Modelo atualizado.</Mensagem>}
      </CardContent>
    </Card>
  );
}
