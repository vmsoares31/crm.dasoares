"use client";

import { useActionState, useState, useTransition } from "react";

import { Selo } from "@/components/situacao-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDocumento } from "@/domain/documentos";
import { removerSocio, salvarSocio, type Resultado } from "../actions";

export type SocioVista = { id: string; nome: string; cpf: string | null; participacao: number | null; administrador: boolean };

function FormularioSocio({ clienteId, socio, aoConcluir }: { clienteId: string; socio?: SocioVista; aoConcluir?: () => void }) {
  const [estado, acao, pendente] = useActionState<Resultado, FormData>(async (anterior, dados) => {
    const r = await salvarSocio(anterior, dados);
    if (r.ok) aoConcluir?.();
    return r;
  }, {});
  return (
    <form action={acao} className="flex flex-wrap items-end gap-3 py-3">
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="id" value={socio?.id ?? ""} />
      <label className="space-y-1.5 text-sm font-medium"><span>Nome</span>
        <input name="nome" required defaultValue={socio?.nome ?? ""} className="campo font-normal" /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>CPF</span>
        <input name="cpf" defaultValue={socio?.cpf ? formatarDocumento(socio.cpf) : ""} className="campo w-44 font-normal tabular-nums" /></label>
      <label className="space-y-1.5 text-sm font-medium"><span>Participação (%)</span>
        <input name="participacao" defaultValue={socio?.participacao != null ? String(socio.participacao).replace(".", ",") : ""} className="campo w-28 font-normal tabular-nums" /></label>
      <label className="flex items-center gap-2 pb-2.5 text-sm">
        <input type="checkbox" name="administrador" defaultChecked={socio?.administrador ?? false} /> Sócio administrador</label>
      <Button type="submit" disabled={pendente}>{socio ? "Salvar" : "Adicionar sócio"}</Button>
      {estado.erro && <p role="alert" className="w-full text-sm text-destructive">{estado.erro}</p>}
    </form>
  );
}

function LinhaSocio({ clienteId, socio }: { clienteId: string; socio: SocioVista }) {
  const [editando, setEditando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  if (editando) {
    return (
      <li className="pb-3">
        <FormularioSocio clienteId={clienteId} socio={socio} aoConcluir={() => setEditando(false)} />
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(false)}>Cancelar</Button>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
      <span className="font-semibold text-heading">{socio.nome}</span>
      <span className="text-muted-foreground tabular-nums">{socio.cpf ? formatarDocumento(socio.cpf) : "sem CPF"}</span>
      <span className="tabular-nums">{socio.participacao != null ? `${String(socio.participacao).replace(".", ",")}%` : ""}</span>
      {socio.administrador && <Selo tom="info">Administrador</Selo>}
      <span className="ml-auto flex gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(true)}>Editar</Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pendente}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            if (!confirm(`Remover o sócio ${socio.nome}?`)) return;
            iniciar(async () => {
              const r = await removerSocio(clienteId, socio.id);
              setErro(r.erro ?? null);
            });
          }}
        >
          Remover
        </Button>
      </span>
      {erro && <span role="alert" className="w-full text-destructive">{erro}</span>}
    </li>
  );
}

export function Socios({ clienteId, socios, somenteLeitura }: { clienteId: string; socios: SocioVista[]; somenteLeitura: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Sócios</h2></CardTitle>
      </CardHeader>
      <CardContent>
        {socios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum sócio cadastrado.</p>}
        <ul className="divide-y">
          {socios.map((s) =>
            somenteLeitura ? (
              <li key={s.id} className="py-3 text-sm">
                {s.nome} — {s.cpf ? formatarDocumento(s.cpf) : "sem CPF"}
                {s.administrador && " (administrador)"}
              </li>
            ) : (
              <LinhaSocio key={s.id} clienteId={clienteId} socio={s} />
            ),
          )}
        </ul>
        {!somenteLeitura && (
          <div className={socios.length > 0 ? "mt-1 border-t pt-2" : ""}>
            <FormularioSocio key={socios.length} clienteId={clienteId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
