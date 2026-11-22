# CRM D.A. Soares — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema web interno (login, perfis) para clientes, contratos, extras, indicação, fechamento financeiro mensal com CSV do Cora, baixa manual, inadimplência e geração do contrato padrão — pronto para fechar a competência 01/2027.

**Architecture:** Next.js (App Router, TypeScript) com Server Actions; Supabase (Postgres + Auth + Storage, região sa-east-1) como banco; toda regra de negócio em funções puras em `src/domain/` (testadas com Vitest), chamadas por Server Actions finas em `src/app/**/actions.ts` que leem/gravam via `src/db/`. Publicação como imagem Docker (Next standalone + LibreOffice para PDF) no Easypanel.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind CSS 4 + shadcn/ui, @supabase/ssr + @supabase/supabase-js, Zod, Vitest, Playwright (smoke), docxtemplater + pizzip, exceljs, `extenso` (valor por extenso), Supabase CLI (migrations), Docker.

**Spec:** `docs/superpowers/specs/2026-11-22-crm-design.md` (ler junto com este plano; números de seção §x referem-se a ele).

## Global Constraints

- Interface 100% em português do Brasil; moeda "R$ 1.250,00"; datas "dd/mm/aaaa"; fuso `America/Sao_Paulo`.
- Dinheiro sempre em **centavos inteiros** (`number`, tipo `Centavos`) no código e `bigint` no banco. Nunca float para valores.
- Supabase: projeto na região **sa-east-1**. Nada de Vercel; deploy só via Easypanel (Docker).
- Sem cadastro público. Só Administrador cria usuários.
- Perfis iniciais: `administrador`, `colaborador`; permissões em tabela (não hard-coded em telas).
- Parâmetros padrão do escritório: multa **2%**, juros **1% a.m.**, nome da cobrança **"Serviços contábeis"**, dia de vencimento **20**, benefício de indicação **50%**, `notificar_em` vazio.
- Cora: valor mínimo **R$ 20,00**; tipos aceitos `boleto`, `boleto_pix`, `pix`; cartão nunca vai ao CSV.
- Primeira competência real: **01/2027**. Nenhum histórico financeiro importado.
- Cláusula 6 do contrato (sócios fiadores) **não muda**.
- Toda ação financeira (abrir/regerar mês, emitir, baixar, cancelar, dispensar saldo, reajustar) grava em `auditoria`.
- Repositório em `C:\Users\victo\OneDrive\Astúcia\Claude\CRM` (git init no Task 1).

## Review Focus

1. **Regerar um mês já parcialmente emitido** → cobranças emitidas/pagas ficam intactas, só as "prevista" são refeitas, extras e créditos não são cobrados duas vezes. Teste em Task 11 (`regerarCompetencia preserva emitidas`).
2. **Cliente sem dados obrigatórios no fechamento** (sem honorário, vencimento, carteira ou tipo) → fica fora do mês e aparece numa lista "não gerados: motivo", em vez de quebrar ou gerar cobrança de R$ 0,00. Teste em Task 10.
3. **CPF/CNPJ com máscara, e-mail vazio ou nome com acento/aspas/ponto-e-vírgula no CSV** → CSV válido (campo citado), dígitos só no documento. Teste em Task 12.
4. **Cobrança cancelada que tinha desconto de indicação** → crédito volta ao saldo do indicador. Teste em Task 13.
5. **Mês de 30/31 dias e fevereiro com "último dia" e vencimento dia 31 em mês curto** → vencimento cai no último dia do mês. Teste em Task 4 (`dataVencimento`).

---

## Estrutura de arquivos

```
CRM/
  Dockerfile, .dockerignore, next.config.ts, vitest.config.ts, playwright.config.ts, .env.example
  supabase/migrations/0001_schema.sql, 0002_rls.sql, 0003_seed_parametros.sql
  templates/contrato-padrao.docx              (gerado no Task 9)
  scripts/preparar-modelo-contrato.ts         (Task 9)
  scripts/importar-dominio.ts                 (Task 7)
  src/domain/                                 (puro, sem I/O)
    dinheiro.ts  datas.ts  documentos.ts  extenso.ts
    permissoes.ts  completude.ts  parcelas.ts  fechamento.ts
    descricao.ts  cora-csv.ts  encargos.ts  indicacao.ts  reajuste.ts
    contrato-campos.ts  dominio-parser.ts  painel.ts
  src/db/          (acesso Supabase por entidade: clientes.ts, contratos.ts, cobrancas.ts, ...)
  src/lib/supabase/{server.ts,client.ts,middleware.ts}, src/lib/auditoria.ts, src/lib/pdf.ts
  src/app/(auth)/login, src/app/(app)/{inicio,clientes,contratos,extras,indicacoes,financeiro,escritorio,usuarios}
  tests/domain/*.test.ts, tests/fixtures/*, tests/e2e/smoke.spec.ts
```

## Tipos de domínio compartilhados (`src/domain/tipos.ts`, criado no Task 4)

```ts
export type Centavos = number;
export type Competencia = `${number}-${string}`;           // "2027-01"
export type DataISO = string;                              // "2027-01-20"
export type Regime = 'mei' | 'simples_nacional' | 'lucro_presumido' | 'lucro_real';
export type TipoCobranca = 'boleto' | 'boleto_pix' | 'pix' | 'cartao';
export type SaidaCarteira = 'csv_cora' | 'lista_manual';
export type SituacaoCliente = 'a_revisar' | 'ativo' | 'inativo';
export type SituacaoContrato = 'em_negociacao' | 'fechado' | 'encerrado';
export type SituacaoCobranca = 'prevista' | 'emitida' | 'paga' | 'paga_parcial'
  | 'cancelada' | 'quitada_por_credito';                  // "atrasada" é derivada
export type TipoItem = 'mensalidade' | 'extra' | 'parcela_adicional' | 'desconto_indicacao';

export interface ParcelaAdicional { mes: number; valor: Centavos;
  forma: 'junto_mensalidade' | 'data_propria'; dia: number | null } // dia null = último dia
export interface ItemCobranca { tipo: TipoItem; descricao: string; valor: Centavos; refId?: string }
```

---

### Task 1: Projeto, ferramentas e container

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts` (`output: 'standalone'`), `vitest.config.ts`, `Dockerfile`, `.dockerignore`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/api/saude/route.ts`
- Test: `tests/domain/sanidade.test.ts`

**Interfaces:**
- Produces: `npm run dev|build|test|lint`; `GET /api/saude` → `{ ok: true }`; imagem Docker que escuta `PORT` (padrão 3000).

- [ ] **Step 1:** `git init` em `CRM/`; `.gitignore` inclui `node_modules`, `.next`, `.env*` (exceto `.env.example`), `Empresas CRM.*`.
- [ ] **Step 2:** `npx create-next-app@15` (TS, App Router, Tailwind, ESLint, `src/`), `npx shadcn@latest init`, instalar Vitest. `lang="pt-BR"` no `<html>`.
- [ ] **Step 3:** Teste `sanidade.test.ts`: `expect(1 + 1).toBe(2)`; `npm test` → PASS.
- [ ] **Step 4:** `Dockerfile` multi-stage: build com `node:22-bookworm-slim`; runtime `node:22-bookworm-slim` + `apt-get install -y libreoffice-writer-nogui fonts-dejavu` + `TZ=America/Sao_Paulo`; copia `.next/standalone`, `.next/static`, `public`, `templates`.
- [ ] **Step 5:** `docker build -t crm . && docker run -p 3000:3000 crm` → `curl localhost:3000/api/saude` retorna `{"ok":true}`. (Se Docker não estiver instalado na máquina, registrar e validar no Task 17 no Easypanel.)
- [ ] **Step 6:** Commit `chore: scaffold Next.js, Vitest e Dockerfile`.

### Task 2: Supabase — esquema, RLS e auditoria

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_seed_parametros.sql`, `src/db/database.types.ts` (gerado), `src/lib/supabase/{server.ts,client.ts}`, `src/lib/auditoria.ts`

**Interfaces:**
- Produces tabelas (todas com `id uuid`, `criado_em`, `criado_por`, `atualizado_em`, `atualizado_por`):
  - `perfis(usuario_id pk→auth.users, nome, papel text check in ('administrador','colaborador'), ativo bool)`
  - `permissoes(papel, acao text, pk(papel,acao))`
  - `escritorio` (linha única: razão social, cnpj, endereço completo, telefone, email, inscricao_municipal, responsavel_tecnico, crc, cidade_foro, multa_pct numeric default 2, juros_mes_pct numeric default 1, nome_cobranca default 'Serviços contábeis', dia_vencimento_padrao int default 20, indicacao_pct numeric default 50, notificar_em text default '', modelo_contrato_path text)
  - `carteiras(nome, saida text check in ('csv_cora','lista_manual'), ativa)`
  - `servicos_extras(nome, valor bigint, ativo)`
  - `clientes(codigo_dominio int unique null, razao_social, nome_fantasia, documento text unique /*só dígitos*/, logradouro, numero, complemento, bairro, cidade, uf, cep, telefone, email, inscricao_estadual, inscricao_municipal, regime null, situacao default 'a_revisar', indicado_por uuid→clientes null, campos_suspeitos text[] default '{}', observacoes)`
  - `socios(cliente_id, nome, cpf, participacao numeric, administrador bool)` — índice único parcial: 1 administrador por cliente
  - `contratos(cliente_id, situacao, honorario bigint, dia_vencimento int check 1..31, data_inicio date, carteira_id, tipo_cobranca, email_cobranca, parcela_adicional_total bigint default 0, legado bool default false, encerrado_em date)` — índice único parcial: 1 contrato com situação ≠ 'encerrado' por cliente
  - `parcelas_adicionais(contrato_id, mes int 1..12, valor bigint, forma, dia int null)`
  - `historico_valores(contrato_id, campo text, de bigint, para bigint, motivo)`
  - `contrato_documentos(contrato_id, docx_path, pdf_path, gerado_em, gerado_por)`
  - `lancamentos_extras(cliente_id, servico_id null, descricao, valor bigint, data date, competencia text, situacao check in ('pendente','incluido','cancelado'), cobranca_id null, observacao)`
  - `cobrancas(cliente_id, contrato_id, competencia text, origem check in ('mensal','parcela_avulsa'), parcela_id null, vencimento date, total bigint, situacao, emitida_em, pago_em date, valor_recebido bigint, saldo_dispensado bool, motivo_cancelamento, descricao text)` — único `(contrato_id, competencia, origem, coalesce(parcela_id,'0…'))`
  - `cobranca_itens(cobranca_id on delete cascade, tipo, descricao, valor bigint, ref_id uuid null)`
  - `pagamentos(cobranca_id, data date, valor bigint)`
  - `indicacoes(indicador_id, indicado_id unique, criado_em)`
  - `creditos_movimentos(cliente_id, indicacao_id null, tipo check in ('gerado','liberado','usado','estornado'), valor bigint, cobranca_id null on delete cascade)`
  - `auditoria(usuario_id, acao text, entidade text, entidade_id uuid, dados jsonb, em timestamptz)`
  - view `v_cobrancas` = cobrancas + `atrasada bool` (`situacao in ('emitida','paga_parcial') and vencimento < current_date`) + `saldo_aberto`
- Produces: `registrarAuditoria(acao: string, entidade: string, entidadeId: string, dados?: object): Promise<void>`; `createServerClient()` / `createBrowserClient()`.

- [ ] **Step 1:** **Pedir confirmação ao Victor** antes de criar o projeto Supabase (nome `crm-dasoares`, região sa-east-1, plano Free); depois criar via MCP Supabase ou painel.
- [ ] **Step 2:** Escrever `0001_schema.sql` com as tabelas acima; `0002_rls.sql`: RLS ligado em todas; política `authenticated` com `perfis.ativo = true` para leitura/escrita; `perfis` e `permissoes` só escrita por papel `administrador`; `escritorio` escrita só administrador. Bucket privado `contratos`.
- [ ] **Step 3:** `0003_seed_parametros.sql`: linha de `escritorio` com dados da D.A. Soares (§6.1, CRC vazio); carteiras "Cora" (`csv_cora`) e "Banco 2" (`lista_manual`); permissões: administrador = todas as ações, colaborador = todas exceto `usuarios.gerenciar` e `escritorio.editar`.
- [ ] **Step 4:** Aplicar migrations; rodar `get_advisors` (security) → sem alertas de RLS desligado.
- [ ] **Step 5:** Gerar `database.types.ts`; `npx tsc --noEmit` → sem erros.
- [ ] **Step 6:** Commit `feat(db): esquema, RLS e seed do escritório`.

### Task 3: Login, perfis e gestão de usuários

**Files:**
- Create: `src/middleware.ts`, `src/lib/supabase/middleware.ts`, `src/domain/permissoes.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/recuperar-senha/page.tsx`, `src/app/(app)/layout.tsx` (menu lateral), `src/app/(app)/usuarios/{page.tsx,actions.ts}`
- Test: `tests/domain/permissoes.test.ts`

**Interfaces:**
- Produces: `pode(permissoes: string[], acao: Acao): boolean`; `exigirPermissao(acao: Acao): Promise<Usuario>` (server, lança se não puder); `type Acao = 'usuarios.gerenciar' | 'escritorio.editar' | 'clientes.editar' | 'contratos.editar' | 'financeiro.operar' | 'reajuste.aplicar'`.

- [ ] **Step 1:** Teste: `pode(['clientes.editar'], 'usuarios.gerenciar') === false`; `pode(['usuarios.gerenciar'], 'usuarios.gerenciar') === true`.
- [ ] **Step 2:** Rodar → FAIL. Implementar `pode`. Rodar → PASS.
- [ ] **Step 3:** Middleware redireciona não autenticado para `/login`; usuário com `perfis.ativo=false` é deslogado.
- [ ] **Step 4:** Tela de usuários (só administrador): convidar por e-mail (`auth.admin.inviteUserByEmail` com service role no servidor), mudar papel, desativar. Primeiro administrador (Victor) criado por script `scripts/criar-admin.ts <email>`.
- [ ] **Step 5:** Verificação manual: login com admin → vê "Usuários"; login com colaborador → menu sem "Usuários" e `/usuarios` retorna 403.
- [ ] **Step 6:** Commit `feat(auth): login, perfis e usuários`.

### Task 4: Utilitários de domínio (dinheiro, datas, documentos, extenso)

**Files:**
- Create: `src/domain/tipos.ts`, `dinheiro.ts`, `datas.ts`, `documentos.ts`, `extenso.ts`
- Test: `tests/domain/utilitarios.test.ts`

**Interfaces:**
- Produces:
  - `formatarBRL(c: Centavos): string` → `"R$ 1.250,00"`; `formatarValorCora(c): string` → `"1250,00"`; `parseBRL(s: string): Centavos`
  - `arredondarParaCimaReal(c: Centavos): Centavos`
  - `aplicarPercentual(c: Centavos, pct: number): Centavos` (arredonda meio para cima ao centavo)
  - `dataVencimento(competencia: Competencia, dia: number | null): DataISO` (null ou dia > último dia → último dia do mês)
  - `formatarData(d: DataISO): string` → `"20/01/2027"`; `dataPorExtenso(d): string` → `"01 de agosto de 2026"`; `hojeSP(): DataISO`
  - `somenteDigitos(s): string`; `cpfValido(s): boolean`; `cnpjValido(s): boolean`; `formatarDocumento(s): string`
  - `valorPorExtenso(c: Centavos): string` → `"duzentos e vinte reais"` (usa pacote `extenso`)

- [ ] **Step 1:** Testes:
  - `formatarBRL(125000) === 'R$ 1.250,00'`; `formatarValorCora(125000) === '1250,00'`; `parseBRL('1.250,00') === 125000`
  - `arredondarParaCimaReal(5237) === 5300`; `arredondarParaCimaReal(5300) === 5300`
  - `aplicarPercentual(30000, 50) === 15000`; `aplicarPercentual(22000, 5.5) === 1210`
  - `dataVencimento('2027-02', 31) === '2027-02-28'`; `dataVencimento('2026-11', null) === '2026-11-30'`; `dataVencimento('2027-01', 20) === '2027-01-20'`
  - `dataPorExtenso('2026-08-01') === '01 de agosto de 2026'`
  - `cnpjValido('22.184.118/0001-50') === true`; `cnpjValido('61.431.938/0001-51') === false`; `cpfValido('384.992.448-31') === true`
  - `valorPorExtenso(22000) === 'duzentos e vinte reais'`; `valorPorExtenso(25050) === 'duzentos e cinquenta reais e cinquenta centavos'`
- [ ] **Step 2:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 3:** Commit `feat(domain): dinheiro, datas, documentos, extenso`.

### Task 5: Cadastro do escritório (dados, carteiras, extras, parâmetros, modelo)

**Files:**
- Create: `src/app/(app)/escritorio/{page.tsx,actions.ts}`, `src/app/(app)/escritorio/carteiras/*`, `src/app/(app)/escritorio/servicos-extras/*`, `src/db/escritorio.ts`, `src/db/servicos-extras.ts`, `src/db/carteiras.ts`

**Interfaces:**
- Produces: `obterEscritorio(): Promise<Escritorio>`; `listarServicosExtras({ativos?}): Promise<ServicoExtra[]>`; `listarCarteiras(): Promise<Carteira[]>`.

- [ ] **Step 1:** Formulário com validação Zod (CNPJ válido, UF 2 letras, CEP 8 dígitos, percentuais ≥ 0). Gravar exige `escritorio.editar`.
- [ ] **Step 2:** CRUD de carteiras (nome, saída) e de serviços extras (nome, valor em R$, ativo).
- [ ] **Step 3:** Upload do modelo `.docx` (substitui `escritorio.modelo_contrato_path`; padrão = `templates/contrato-padrao.docx`).
- [ ] **Step 4:** Verificação manual: alterar CRC e salvar → recarregar mostra o valor; colaborador vê a tela só leitura.
- [ ] **Step 5:** Commit `feat(escritorio): cadastro, carteiras, extras e modelo`.

### Task 6: Clientes, sócios, completude e edição em massa

**Files:**
- Create: `src/domain/completude.ts`, `src/db/clientes.ts`, `src/app/(app)/clientes/{page.tsx,[id]/page.tsx,novo/page.tsx,actions.ts}`, `src/app/(app)/clientes/edicao-em-massa/{page.tsx,actions.ts}`
- Test: `tests/domain/completude.test.ts`

**Interfaces:**
- Consumes: `cnpjValido`, `cpfValido` (Task 4).
- Produces: `pendenciasCadastro(c: ClienteCompleto): Pendencia[]` com `type Pendencia = 'honorario'|'vencimento'|'regime'|'carteira'|'tipo_cobranca'|'socio_administrador'|'email'|'documento_invalido'`; `ClienteCompleto = Cliente & { socios: Socio[]; contrato: Contrato | null }`.

- [ ] **Step 1:** Testes: cliente sem contrato → contém `'honorario'`, `'vencimento'`, `'carteira'`, `'tipo_cobranca'`; sem sócio administrador → `'socio_administrador'`; tudo preenchido → `[]`; CNPJ inválido → `'documento_invalido'`.
- [ ] **Step 2:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 3:** Lista de clientes com busca (nome/CNPJ) e filtros (regime, carteira, situação, "com pendências"); ficha do cliente com sócios (marcar administrador), indicado por, campos suspeitos destacados em amarelo; botão "Confirmar cadastro" muda `a_revisar` → `ativo` (só permitido se não houver `documento_invalido`).
- [ ] **Step 4:** Edição em massa: tabela uma linha por cliente com colunas regime, honorário, dia vencimento, carteira, tipo de cobrança, e-mail de cobrança; salvar cria/atualiza contrato `legado=true, situacao='fechado'` quando o cliente não tem contrato. Salva só linhas alteradas.
- [ ] **Step 5:** Verificação manual: editar 3 linhas na tabela e salvar → os 3 contratos aparecem na ficha; contador de pendências cai.
- [ ] **Step 6:** Commit `feat(clientes): cadastro, sócios, pendências e edição em massa`.

### Task 7: Importação do relatório do Domínio

**Files:**
- Create: `src/domain/dominio-parser.ts`, `scripts/importar-dominio.ts`
- Test: `tests/domain/dominio-parser.test.ts`, `tests/fixtures/dominio-paginas.txt` (3 páginas copiadas do `pdftotext -layout`: D.A. Soares, CATITA, QUARTTO STAY)

**Interfaces:**
- Produces: `parsePaginaDominio(texto: string): EmpresaImportada`; `EmpresaImportada = { codigo: number; razaoSocial; nomeFantasia; documento; logradouro; numero; complemento; bairro; cidade; uf; cep; telefone; email; inscricaoEstadual; inscricaoMunicipal; situacao: 'Ativa'|'Inativa'|null; socios: {cpf; nome; participacao: number; saida: DataISO|null}[]; camposSuspeitos: string[] }`.

- [ ] **Step 1:** Gerar o texto: `pdftotext -layout "Empresas CRM.pdf" tmp/empresas.txt`; separar páginas pelo cabeçalho `Empresa:`. Copiar 3 páginas para a fixture.
- [ ] **Step 2:** Testes:
  - D.A. Soares: `documento === '01496613000124'`, `cep === '03319000'`, `email === 'diretoria@dasoares.com.br'`, sócio `VICTOR MARTINS SOARES` 100.
  - QUARTTO STAY: `email === ''` e `camposSuspeitos` contém `'email'` (valor era um CNPJ); só sócios sem data de saída (`PEDRO HENRIQUE MARTINS SOARES`, `BEATRIZ MORAES DE MELO CAUTELLA`) têm `saida === null`.
  - CATITA: `razaoSocial === 'CATITA IMOVEIS LTDA EPP'`, `bairro === 'CIDADE LÍDER'`.
- [ ] **Step 3:** Rodar → FAIL. Implementar: ler os campos da **coluna esquerda** pelo rótulo no início da linha (prefixo `1` opcional); a coluna direita está desalinhada e é ignorada, exceto `Situação`, inferida pelo valor `Ativa`/`Inativa` presente na página. Validar documento (Task 4), e-mail (regex), CEP (8 dígitos); inválido → campo vazio + `camposSuspeitos`. Rodar → PASS.
- [ ] **Step 4:** Script `importar-dominio.ts <txt>`: página com documento `01496613000124` → ignora (escritório já semeado); demais → upsert em `clientes` por `documento` com `situacao='a_revisar'` (página "Inativa" → `inativo`), sócios sem saída. Imprime resumo: importados, inativos, com campos suspeitos.
- [ ] **Step 5:** Rodar contra o banco de desenvolvimento → resumo bate com 140 empresas (133 ativas, 1 inativa, 6–7 sem situação). Conferir no app 3 clientes por amostragem (incluindo um da PICONT, ex.: ANDREWS BORGES).
- [ ] **Step 6:** Commit `feat(import): importador do relatório de empresas do Domínio` (sem commitar o PDF/TXT).

### Task 8: Contratos e parcela adicional

**Files:**
- Create: `src/domain/parcelas.ts`, `src/db/contratos.ts`, `src/app/(app)/contratos/{page.tsx,[id]/page.tsx,actions.ts}`, componente `ParcelasAdicionaisEditor.tsx`
- Test: `tests/domain/parcelas.test.ts`

**Interfaces:**
- Produces:
  - `atalhoParcelas(atalho: 'unica_dezembro' | '2x_nov_ultimo_dia_dez' | '2x_junto_nov_dez', total: Centavos): ParcelaAdicional[]`
  - `validarParcelas(parcelas: ParcelaAdicional[], total: Centavos): string[]` (erros)
  - `textoParcelaAdicional(parcelas: ParcelaAdicional[], diaVencimento: number): string` (usado no Task 9)

- [ ] **Step 1:** Testes:
  - `atalhoParcelas('unica_dezembro', 25000)` → `[{mes:12, valor:25000, forma:'junto_mensalidade', dia:null}]`
  - `atalhoParcelas('2x_nov_ultimo_dia_dez', 25001)` → `[{mes:11, valor:12501, forma:'data_propria', dia:null}, {mes:12, valor:12500, forma:'junto_mensalidade', dia:null}]` (centavo extra na 1ª)
  - `atalhoParcelas('2x_junto_nov_dez', 30000)` → duas `junto_mensalidade` de 15000 em 11 e 12
  - `validarParcelas` com soma ≠ total → erro `'Soma das parcelas difere do valor total'`; dois itens no mesmo mês → erro
  - `textoParcelaAdicional([{mes:12,valor:25000,forma:'junto_mensalidade',dia:null}], 20)` === `'no mês de dezembro de cada ano, a ser pago até o dia 20 daquele mês, juntamente com os honorários mensais, uma parcela adicional, no valor inicial de R$ 250,00 (duzentos e cinquenta reais)'`
  - `textoParcelaAdicional(atalhoParcelas('2x_nov_ultimo_dia_dez', 30000), 20)` === `'em 2 (duas) parcelas anuais, a primeira no último dia do mês de novembro e a segunda até o dia 20 de dezembro, juntamente com os honorários mensais, uma parcela adicional, no valor inicial total de R$ 300,00 (trezentos reais), sendo R$ 150,00 (cento e cinquenta reais) cada parcela'`
- [ ] **Step 2:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 3:** Tela do contrato: honorário, dia, início, carteira, tipo de cobrança, e-mail de cobrança, situação, flag "contrato anterior (sem documento no CRM)", editor de parcelas com os 3 atalhos + edição livre. Mudança de honorário ou parcela grava `historico_valores`. Contrato `fechado` exige cliente `ativo`.
- [ ] **Step 4:** Commit `feat(contratos): contrato e parcela adicional`.

### Task 9: Geração do contrato (.docx + PDF)

**Files:**
- Create: `scripts/preparar-modelo-contrato.ts`, `templates/contrato-padrao.docx`, `src/domain/contrato-campos.ts`, `src/lib/pdf.ts`, `src/app/(app)/contratos/[id]/gerar/actions.ts`
- Test: `tests/domain/contrato-campos.test.ts`, `tests/contrato-render.test.ts`

**Interfaces:**
- Consumes: `textoParcelaAdicional` (Task 8), `valorPorExtenso`, `dataPorExtenso`, `formatarDocumento` (Task 4), `obterEscritorio` (Task 5).
- Produces: `camposContrato(escritorio, cliente: ClienteCompleto, contrato, parcelas, hoje: DataISO): CamposContrato` (objeto plano com as tags abaixo); `renderizarContrato(modelo: Buffer, campos: CamposContrato): Buffer`; `converterParaPdf(docx: Buffer): Promise<Buffer>` (LibreOffice `soffice --headless --convert-to pdf` em diretório temporário).
- Tags do modelo: `{contratante_razao} {contratante_cnpj} {contratante_endereco} {contratante_bairro} {contratante_cidade} {contratante_uf} {contratante_cep} {contratante_email} {contratante_telefone} {socio_admin_nome} {socio_admin_cpf} {contratada_razao} {contratada_cnpj} {contratada_endereco} {contratada_bairro} {contratada_cidade} {contratada_uf} {contratada_cep} {responsavel_tecnico} {crc} {regime} {honorario} {honorario_extenso} {dia_vencimento} {texto_parcela_adicional} {data_inicio} {cidade_foro} {data_contrato_extenso}`.

- [ ] **Step 1:** `preparar-modelo-contrato.ts` lê `../Contrato_ANDREWS_BORGES.docx`, junta os runs de cada parágrafo afetado e troca os textos fixos pelas tags: dados do contratante/contratada no cabeçalho; "Simples Nacional" na cl. 3.4 → `{regime}`; valor e extenso e "dia 20" na cl. 4; trecho da cl. 4.7 de "no mês de dezembro" até "(duzentos e cinquenta reais)" → `{texto_parcela_adicional}`; "01/08/2026" na cl. 5 → `{data_inicio}`; "São Paulo, 01 de Agosto de 2026." → `{cidade_foro}, {data_contrato_extenso}.`; assinaturas "Picont Contabilidade Ltda"/"Victor Martins Soares"/"Andrews Borges Ltda"/"Andrews Borges" → `{contratada_razao}`/`{responsavel_tecnico}`/`{contratante_razao}`/`{socio_admin_nome}`. Cláusula 6 e Anexos intocados. Grava `templates/contrato-padrao.docx`.
- [ ] **Step 2:** Teste `contrato-render.test.ts`: renderizar o modelo com campos de um cliente fictício (CNPJ 11.222.333/0001-81, regime Lucro Presumido, honorário 35000) e extrair texto (`word/document.xml`): contém `'Lucro Presumido'`, `'R$ 350,00 (trezentos e cinquenta reais)'`, `'D. A. SOARES CONTABILIDADE LTDA.'`, o texto da cl. 6 original; **não** contém `'PICONT'`, `'Picont'`, `'ANDREWS'`, `'22.184.118'`, `'37.781.049'`, `'{'`.
- [ ] **Step 3:** Teste `camposContrato`: `regime` 'simples_nacional' → `'Simples Nacional'`; `honorario_extenso` de 22000 → `'duzentos e vinte reais'`; sem sócio administrador → lança `'Cliente sem sócio administrador'`.
- [ ] **Step 4:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 5:** Botão "Gerar contrato" na tela do contrato (habilitado só com cliente `ativo`, contrato `fechado`, sem pendências): gera .docx e PDF, salva no bucket `contratos/{cliente_id}/{timestamp}.{docx,pdf}`, registra em `contrato_documentos`, lista versões com download.
- [ ] **Step 6:** Verificação manual: gerar para um cliente de teste, abrir o PDF e conferir cabeçalho, cl. 3.4, 4, 4.7, 5 e assinaturas.
- [ ] **Step 7:** Commit `feat(contratos): geração do contrato padrão em docx e pdf`.

### Task 10: Lançamento de extras e montagem das cobranças do mês (domínio)

**Files:**
- Create: `src/domain/fechamento.ts`, `src/domain/descricao.ts`, `src/db/extras.ts`, `src/app/(app)/extras/{page.tsx,actions.ts}`
- Test: `tests/domain/fechamento.test.ts`, `tests/domain/descricao.test.ts`

**Interfaces:**
- Consumes: `dataVencimento`, `aplicarPercentual` (Task 4); `ParcelaAdicional` (tipos).
- Produces:
  - `montarDescricao(itens: ItemCobranca[]): string`
  - `montarCobrancasDoMes(entrada: EntradaFechamento): ResultadoFechamento`
  ```ts
  interface ContratoFechamento { clienteId; contratoId; clienteNome; honorario: Centavos | null;
    diaVencimento: number | null; carteiraId: string | null; tipoCobranca: TipoCobranca | null;
    parcelas: (ParcelaAdicional & { id: string })[] }
  interface ExtraPendente { id; clienteId; descricao; valor: Centavos }
  interface EntradaFechamento { competencia: Competencia; contratos: ContratoFechamento[];
    extras: ExtraPendente[]; saldoCredito: Record<string, Centavos> }
  interface CobrancaMontada { clienteId; contratoId; origem: 'mensal' | 'parcela_avulsa';
    parcelaId: string | null; vencimento: DataISO; itens: ItemCobranca[]; total: Centavos;
    situacao: 'prevista' | 'quitada_por_credito'; creditoUsado: Centavos; descricao: string }
  interface ResultadoFechamento { cobrancas: CobrancaMontada[];
    naoGerados: { clienteId; clienteNome; motivo: string }[] }
  ```

Regras (§6.4–6.6, §6.8): cobrança `mensal` = mensalidade + extras do cliente + parcelas do mês com `junto_mensalidade` − desconto de indicação; parcela `data_propria` do mês → cobrança `parcela_avulsa` com `dataVencimento(competencia, parcela.dia)` sem desconto. Desconto: `d = min(saldo, total)`; se `d === total` → total 0, `quitada_por_credito`; senão se `total − d < 2000` → `d = max(0, total − 2000)`. Contrato sem honorário, dia, carteira ou tipo → `naoGerados` com motivo listando o que falta.

- [ ] **Step 1:** Testes `descricao`: `montarDescricao([mensalidade 22000, extra 'Recálculo de guia' 5000, desconto −15000])` === `'Mensalidade R$ 220,00 + Recálculo de guia R$ 50,00 − Desconto indicação R$ 150,00'`.
- [ ] **Step 2:** Testes `fechamento` (competência `'2027-12'`, honorário 22000, dia 20):
  - só mensalidade → 1 cobrança, total 22000, vencimento `'2027-12-20'`
  - com extra 5000 → itens mensalidade+extra, total 27000
  - parcela `{mes:12, junto_mensalidade, 25000}` → item `parcela_adicional` na mensal, total 47000
  - parcela `{mes:11, data_propria, dia:null, 12500}` em `'2027-11'` → 2 cobranças, a avulsa com vencimento `'2027-11-30'`, total 12500
  - saldo 15000 → item desconto −15000, total 7000, `creditoUsado` 15000
  - saldo 30000 com total 22000 → total 0, `quitada_por_credito`, `creditoUsado` 22000
  - saldo 21000 com total 22000 → `creditoUsado` 2000, total 20000
  - honorário 1500 com saldo 1000 → `creditoUsado` 0, total 1500
  - contrato sem carteira → em `naoGerados` com motivo contendo `'carteira'`, nenhuma cobrança
- [ ] **Step 3:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 4:** Tela de extras: lançar (cliente, serviço da tabela preenche valor editável, data, competência padrão = mês aberto, observação), listar por competência, cancelar se `pendente`.
- [ ] **Step 5:** Commit `feat(financeiro): extras e montagem das cobranças do mês`.

### Task 11: Abrir, revisar e regerar a competência

**Files:**
- Create: `src/db/cobrancas.ts`, `src/app/(app)/financeiro/[competencia]/{page.tsx,actions.ts}`
- Test: `tests/integracao/competencia.test.ts` (contra o banco de desenvolvimento, com schema de teste limpo por `beforeEach`)

**Interfaces:**
- Consumes: `montarCobrancasDoMes` (Task 10).
- Produces: `abrirCompetencia(competencia): Promise<ResultadoFechamento>`; `regerarCompetencia(competencia): Promise<ResultadoFechamento>`; `editarCobranca(id, itens: ItemCobranca[]): Promise<void>` (só `prevista`).

Regras: abrir = carregar contratos `fechado` de clientes `ativo`, extras `pendente` da competência, saldo de crédito; gravar cobranças + itens; marcar extras `incluido` com `cobranca_id`; gravar movimento `usado` por crédito consumido. Regerar = apagar só cobranças `prevista`/`quitada_por_credito` da competência (itens e movimentos `usado` caem em cascata; extras voltam a `pendente`) e montar de novo para os contratos que não têm cobrança emitida/paga naquela competência/origem.

- [ ] **Step 1:** Testes: `abrirCompetencia` duas vezes → mesmo número de cobranças (sem duplicar); `regerarCompetencia preserva emitidas` — emitir 1 de 3, adicionar extra ao cliente emitido e a outro, regerar → cobrança emitida inalterada, extra do cliente emitido continua `pendente`, extra do outro incluído.
- [ ] **Step 2:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 3:** Tela do mês: botão "Abrir mês"/"Regerar previstas", lista "não gerados: motivo", tabela de cobranças com itens expansíveis, edição de itens de uma prevista, excluir cliente do mês (cancelar com motivo). Grava auditoria.
- [ ] **Step 4:** Commit `feat(financeiro): abrir, revisar e regerar competência`.

### Task 12: Exportação (CSV Cora, lista manual) e marcar emitidas

**Files:**
- Create: `src/domain/cora-csv.ts`, `src/app/(app)/financeiro/[competencia]/exportar/{page.tsx,actions.ts,route.ts}`
- Test: `tests/domain/cora-csv.test.ts`

**Interfaces:**
- Produces:
  - `gerarCsvCora(linhas: LinhaCora[], hoje: DataISO): { csv: string; erros: { cobrancaId: string; erro: string }[] }`
  - `LinhaCora = { cobrancaId; nomePagador; documento; valor: Centavos; vencimento: DataISO; nomeCobranca; descricao; tipo: TipoCobranca; email; notificarEm: string; multaPct: number; jurosPct: number }`
  - `sugerirVencimento(hoje: DataISO): DataISO` → hoje + 3 dias corridos
  - `separarPorSaida(cobrancas, carteiras): { cora: Cobranca[]; manual: Cobranca[] }` (cartão ou carteira `lista_manual` → manual)

Formato: cabeçalho exato `nome_do_pagador;cpf_cnpj;valor;vencimento;nome_cobranca;descricao;tipo_cobranca;email;notificar_em;multa;juros_mensal;desconto;desconto_valido_ate`; separador `;`; UTF-8 com BOM; `\r\n`; campos com `;`, `"` ou quebra de linha entre aspas (aspas dobradas); `multa` = `"2%"`, `juros_mensal` = `"1%"`; `desconto` e `desconto_valido_ate` vazios.

- [ ] **Step 1:** Testes:
  - linha padrão → `'Renato Goncalves Anestesia Veterinaria Ltda;40342580000110;200,58;20/01/2027;Serviços contábeis;Mensalidade R$ 200,58;boleto_pix;renatogmedvet@gmail.com;;2%;1%;;'`
  - documento `'40.342.580/0001-10'` → `40342580000110`
  - nome `'ACME; "Filial"'` → `"ACME; ""Filial"""`
  - valor 1999 → em `erros` com `'Valor abaixo de R$ 20,00'`, fora do csv
  - vencimento < hoje → erro `'Vencimento no passado'`
  - tipo `cartao` → erro `'Cartão não vai ao arquivo do Cora'`
  - csv começa com `'\uFEFF'`
  - `sugerirVencimento('2027-01-21') === '2027-01-24'`
- [ ] **Step 2:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 3:** Tela de exportação: filtros (carteira, tipo, situação `prevista`), seleção por checkbox; cobranças com vencimento passado mostram aviso e botão "Aplicar nova data" (sugerida, editável, individual ou em lote); botões "Baixar CSV Cora" e "Lista manual (Excel)" (exceljs, mesmas colunas + carteira) e "Imprimir lista".
- [ ] **Step 4:** "Marcar como emitidas" (selecionadas ou "todas do último arquivo"): `prevista` → `emitida`, `emitida_em = now()`, auditoria.
- [ ] **Step 5:** **Validação real:** Victor faz upload de um CSV com 1 cobrança de teste no Cora Web (ou o primeiro lote real) → aceito sem erro. Se o Cora recusar o separador/codificação, ajustar só as constantes de formato em `cora-csv.ts` e o teste de cabeçalho.
- [ ] **Step 6:** Commit `feat(financeiro): exportação Cora, lista manual e emissão`.

### Task 13: Baixa manual, cancelamento, inadimplência e liberação de crédito

**Files:**
- Create: `src/domain/encargos.ts`, `src/domain/indicacao.ts`, `src/app/(app)/financeiro/cobrancas/[id]/{page.tsx,actions.ts}`, `src/app/(app)/financeiro/inadimplencia/page.tsx`
- Test: `tests/domain/encargos.test.ts`, `tests/domain/indicacao.test.ts`, `tests/integracao/baixa.test.ts`

**Interfaces:**
- Produces:
  - `valorAtualizado(valor: Centavos, vencimento: DataISO, hoje: DataISO, multaPct: number, jurosMesPct: number): { multa: Centavos; juros: Centavos; total: Centavos; diasAtraso: number }` — juros pró-rata `valor * jurosMes * dias/30`
  - `situacaoAposBaixa(total: Centavos, recebidoAcumulado: Centavos): 'paga' | 'paga_parcial'`
  - `creditoDaIndicacao(honorarioIndicado: Centavos, pct: number): Centavos`
  - `deveLiberarCredito(cobrancaPaga: { clienteId; situacao }, ehPrimeiraCobrancaDoCliente: boolean, indicacao: Indicacao | null, jaLiberado: boolean): boolean`
  - `registrarBaixa(cobrancaId, data: DataISO, valor: Centavos)`; `cancelarCobranca(id, motivo)`; `dispensarSaldo(id, motivo)`

- [ ] **Step 1:** Testes:
  - `valorAtualizado(22000, '2027-01-20', '2027-01-20', 2, 1).total === 22000` (no dia, sem encargos)
  - `valorAtualizado(22000, '2027-01-20', '2027-02-19', 2, 1)` → `multa 440, juros 220, total 22660, diasAtraso 30`
  - `situacaoAposBaixa(22000, 22000) === 'paga'`; `(22000, 23000) === 'paga'`; `(22000, 10000) === 'paga_parcial'`
  - `creditoDaIndicacao(30000, 50) === 15000`
  - `deveLiberarCredito` → true só se situação `paga`, é a primeira cobrança do indicado, existe indicação e ainda não liberado; `paga_parcial` → false
- [ ] **Step 2:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 3:** Teste de integração: baixa integral da 1ª cobrança do indicado → movimento `liberado` 15000 no indicador; cancelar cobrança do indicador que tinha `usado` 15000 → movimento `estornado` e saldo volta a 15000; baixa parcial → `v_cobrancas.saldo_aberto` = restante e continua atrasada após o vencimento.
- [ ] **Step 4:** Rodar → FAIL. Implementar ações (com auditoria). Rodar → PASS.
- [ ] **Step 5:** Tela da cobrança: itens, histórico de pagamentos, botões "Dar baixa" (data, valor padrão = saldo), "Cancelar" (motivo; só se não paga), "Dispensar saldo" (motivo; só `paga_parcial`). Tela de inadimplência: atrasadas com dias de atraso e valor atualizado, agrupável por cliente com total devido.
- [ ] **Step 6:** Commit `feat(financeiro): baixa manual, inadimplência e crédito de indicação`.

### Task 14: Indicações

**Files:**
- Create: `src/db/indicacoes.ts`, `src/app/(app)/indicacoes/{page.tsx,actions.ts}`; bloco "Indicações" na ficha do cliente

**Interfaces:**
- Consumes: `creditoDaIndicacao` (Task 13).
- Produces: `registrarIndicacao(indicadorId, indicadoId)` — grava `indicacoes`, `clientes.indicado_por` e movimento `gerado` com `creditoDaIndicacao(honorário do contrato do indicado, escritorio.indicacao_pct)`; `extratoCredito(clienteId): { movimentos; saldoDisponivel: Centavos }` (liberado − usado + estornado).

- [ ] **Step 1:** Teste de integração: indicar cliente sem contrato → erro `'Indicado precisa ter contrato com honorário'`; indicar o próprio cliente → erro; indicado já indicado → erro; caso válido → movimento `gerado` 15000 e saldo disponível 0 até a liberação.
- [ ] **Step 2:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 3:** Telas: lista de indicações (indicador, indicado, valor, situação: aguardando 1º pagamento / liberado / usado), extrato de crédito na ficha do cliente.
- [ ] **Step 4:** Commit `feat(indicacao): registro e extrato de créditos`.

### Task 15: Reajuste anual

**Files:**
- Create: `src/domain/reajuste.ts`, `src/app/(app)/escritorio/reajuste/{page.tsx,actions.ts}`
- Test: `tests/domain/reajuste.test.ts`

**Interfaces:**
- Consumes: `aplicarPercentual`, `arredondarParaCimaReal` (Task 4).
- Produces: `previaReajusteContratos(contratos, pct): { contratoId; honorarioDe; honorarioPara; parcelaDe; parcelaPara; parcelas: ParcelaAdicional[] }[]` (parcelas reproporcionadas mantendo a soma); `reajustarTabelaExtras(servicos, pct): { id; de; para }[]` com arredondamento para cima ao real.

- [ ] **Step 1:** Testes: `reajustarTabelaExtras([{valor:5000}], 4.75)` → `para 5300` (52,375 → 53,00); `previaReajusteContratos` honorário 22000, 5% → 23100; parcela 2x 12500+12500, 5% → soma 26250, 13125+13125.
- [ ] **Step 2:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 3:** Tela: percentual → prévia em tabela com campo "novo valor" editável por linha → "Aplicar" (selecionados ou todos) grava contratos + `historico_valores` + auditoria. Aba separada para a tabela de extras.
- [ ] **Step 4:** Commit `feat(reajuste): reajuste anual de honorários, parcela adicional e extras`.

### Task 16: Painéis (Início e Financeiro mensal)

**Files:**
- Create: `src/domain/painel.ts`, `src/app/(app)/inicio/page.tsx`, `src/app/(app)/financeiro/page.tsx`
- Test: `tests/domain/painel.test.ts`

**Interfaces:**
- Produces: `resumoFinanceiro(cobrancas: CobrancaComItens[], hoje: DataISO): { previsto; emitido; recebido; emAberto; atrasado; extras; descontosIndicacao; parcelasAdicionais; naoEmitidas: number; porCarteira: Record<string, {previsto; recebido}> }` (todos `Centavos`, exceto contagem).

- [ ] **Step 1:** Teste com 4 cobranças fixas (1 prevista 22000, 1 emitida vencida 30000, 1 paga 22000 com extra 5000, 1 paga_parcial 20000 recebido 10000, desconto −15000 em uma): conferir cada total — `recebido 32000`, `atrasado` inclui 30000 e o saldo 10000 se vencido, `descontosIndicacao 15000`, `naoEmitidas 1`.
- [ ] **Step 2:** Rodar → FAIL. Implementar. Rodar → PASS.
- [ ] **Step 3:** Financeiro: seletor de mês, cartões com os totais (seguir a skill `dataviz` para cartões e gráfico de barras por carteira), lista "não emitidas", atalho para inadimplência. Início: clientes ativos, a revisar, incompletos, contratos fechados não-legados sem documento, indicações aguardando pagamento — cada um com link para a lista filtrada.
- [ ] **Step 4:** Commit `feat(paineis): início e financeiro mensal`.

### Task 17: Publicação no Easypanel e teste de fumaça

**Files:**
- Create: `tests/e2e/smoke.spec.ts`, `playwright.config.ts`, `docs/deploy-easypanel.md`

**Interfaces:**
- Consumes: tudo.

- [ ] **Step 1:** Smoke (Playwright, contra ambiente de desenvolvimento): login → abrir cliente → abrir competência de teste → exportar CSV → marcar emitida → dar baixa → painel mostra recebido.
- [ ] **Step 2:** Rodar → PASS.
- [ ] **Step 3:** **Pedir ao Victor:** criar repositório privado no GitHub (ou autorizar `gh repo create --private`) e acesso ao Easypanel/VPS + domínio desejado. Não publicar nada sem essa confirmação.
- [ ] **Step 4:** Easypanel: serviço "App" a partir do repositório (Dockerfile), variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TZ=America/Sao_Paulo`; domínio com HTTPS; Supabase Auth `Site URL` = domínio.
- [ ] **Step 5:** Em produção: `/api/saude` ok; gerar um contrato de teste (valida LibreOffice no container); rodar importação do Domínio no banco de produção; criar usuário do Victor.
- [ ] **Step 6:** `docs/deploy-easypanel.md` com o passo a passo e as variáveis. Commit `chore(deploy): Easypanel e smoke test`.

---

## Cobertura do spec

| Spec | Task |
|---|---|
| §5 perfis, login, auditoria | 2, 3 |
| §6.1 escritório, carteiras, extras, parâmetros, modelo | 2, 5 |
| §6.2 clientes, sócios, pendências, edição em massa | 6 |
| §6.3 contratos, parcela adicional, geração, legado | 8, 9 |
| §6.4 extras | 10 |
| §6.5 indicação | 10 (desconto), 13 (liberação), 14 |
| §6.6 fechamento | 10, 11, 12 |
| §6.7 baixa, parcial, inadimplência | 13 |
| §6.8 CSV Cora, mínimo R$ 20 | 10, 12 |
| §6.9 reajuste | 15 |
| §6.10 painéis | 16 |
| §7 importação | 7 |
| §8 publicação | 1, 17 |
