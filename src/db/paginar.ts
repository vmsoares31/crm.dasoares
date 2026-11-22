import "server-only";

const TAMANHO = 1000; // limite máximo de linhas por requisição do PostgREST

/** Busca todas as linhas de uma consulta paginando de 1000 em 1000. */
export async function buscarTodas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += TAMANHO) {
    const { data, error } = await consulta(de, de + TAMANHO - 1);
    if (error) throw new Error(error.message);
    const lote = data ?? [];
    todas.push(...lote);
    if (lote.length < TAMANHO) return todas;
  }
}
