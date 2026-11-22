export type Acao =
  | "usuarios.gerenciar"
  | "escritorio.editar"
  | "clientes.editar"
  | "contratos.editar"
  | "financeiro.operar"
  | "reajuste.aplicar";

export type Papel = "administrador" | "colaborador";

export type PerfilResumo = { id: string; papel: Papel; ativo: boolean };

export function pode(permissoes: string[], acao: Acao): boolean {
  return permissoes.includes(acao);
}

/**
 * Verdadeiro se a alteração (novo papel e/ou novo estado ativo) no usuário
 * `alvoId` deixaria o sistema sem nenhum administrador ativo.
 */
export function alteracaoDeixaSemAdministrador(
  perfis: PerfilResumo[],
  alvoId: string,
  alteracao: { papel?: Papel; ativo?: boolean },
): boolean {
  const restantes = perfis
    .map((p) => (p.id === alvoId ? { ...p, ...alteracao } : p))
    .filter((p) => p.papel === "administrador" && p.ativo);
  return restantes.length === 0;
}
