"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
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
    <form action={acao} className="flex flex-wrap items-end gap-3 py-2">
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="id" value={socio?.id ?? ""} />
      <label className="space-y-1 text-sm"><span>Nome</span>
        <input name="nome" required defaultValue={socio?.nome ?? ""} className="block rounded border px-3 py-2" /></label>
      <label className="space-y-1 text-sm"><span>CPF</span>
        <input name="cpf" defaultValue={socio?.cpf ? formatarDocumento(socio.cpf) : ""} className="block rounded border px-3 py-2" /></label>
      <label className="space-y-1 text-sm"><span>Participação (%)</span>
        <input name="participacao" defaultValue={socio?.participacao != null ? String(socio.participacao).replace(".", ",") : ""} className="block w-28 rounded border px-3 py-2" /></label>
      <label className="flex items-center gap-2 pb-2 text-sm">
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
      <li className="border-b">
        <FormularioSocio clienteId={clienteId} socio={socio} aoConcluir={() => setEditando(false)} />
        <button type="button" onClick={() => setEditando(false)} className="pb-2 text-sm underline">Cancelar</button>
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-3 border-b py-2 text-sm">
      <span className="font-medium">{socio.nome}</span>
      <span>{socio.cpf ? formatarDocumento(socio.cpf) : "sem CPF"}</span>
      <span>{socio.participacao != null ? `${String(socio.participacao).replace(".", ",")}%` : ""}</span>
      {socio.administrador && <span className="rounded bg-muted px-2 py-0.5 text-xs">Administrador</span>}
      <button type="button" onClick={() => setEditando(true)} className="underline">Editar</button>
      <button
        type="button"
        disabled={pendente}
        className="underline"
        onClick={() => {
          if (!confirm(`Remover o sócio ${socio.nome}?`)) return;
          iniciar(async () => {
            const r = await removerSocio(clienteId, socio.id);
            setErro(r.erro ?? null);
          });
        }}
      >
        Remover
      </button>
      {erro && <span role="alert" className="text-destructive">{erro}</span>}
    </li>
  );
}

export function Socios({ clienteId, socios, somenteLeitura }: { clienteId: string; socios: SocioVista[]; somenteLeitura: boolean }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">Sócios</h2>
      {socios.length === 0 && <p className="text-sm text-muted-foreground">Nenhum sócio cadastrado.</p>}
      <ul>
        {socios.map((s) =>
          somenteLeitura ? (
            <li key={s.id} className="border-b py-2 text-sm">
              {s.nome} — {s.cpf ? formatarDocumento(s.cpf) : "sem CPF"}
              {s.administrador && " (administrador)"}
            </li>
          ) : (
            <LinhaSocio key={s.id} clienteId={clienteId} socio={s} />
          ),
        )}
      </ul>
      {!somenteLeitura && <FormularioSocio key={socios.length} clienteId={clienteId} />}
    </section>
  );
}
