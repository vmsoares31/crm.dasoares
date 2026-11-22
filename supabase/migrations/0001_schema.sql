-- 0001_schema.sql — esquema do CRM D.A. Soares
-- Dinheiro sempre em bigint (centavos). Competência no formato 'AAAA-MM'.
-- Toda tabela tem: id, criado_em, criado_por, atualizado_em, atualizado_por.
-- criado_por/atualizado_por recebem auth.uid() por padrão; atualizado_em/atualizado_por
-- são mantidos pelo trigger private.tg_atualizado().

-- Schema não exposto pela API, para funções auxiliares (triggers e RLS).
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Trigger de auditoria de linha
-- ---------------------------------------------------------------------------
create or replace function private.tg_atualizado()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- criação é imutável
  new.criado_em := old.criado_em;
  new.criado_por := old.criado_por;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usuários e permissões
-- ---------------------------------------------------------------------------
create table public.perfis (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  id uuid not null default gen_random_uuid() unique,
  nome text not null,
  papel text not null check (papel in ('administrador', 'colaborador')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create table public.permissoes (
  papel text not null check (papel in ('administrador', 'colaborador')),
  acao text not null,
  id uuid not null default gen_random_uuid() unique,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (papel, acao)
);

-- ---------------------------------------------------------------------------
-- Escritório (linha única) e parâmetros
-- ---------------------------------------------------------------------------
create table public.escritorio (
  id uuid primary key default gen_random_uuid(),
  unico boolean not null default true unique check (unico),
  razao_social text not null,
  cnpj text not null check (cnpj ~ '^[0-9]{14}$'),
  logradouro text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null default '',
  uf text not null default '',
  cep text not null default '',
  telefone text not null default '',
  email text not null default '',
  inscricao_municipal text not null default '',
  responsavel_tecnico text not null default '',
  crc text not null default '',
  cidade_foro text not null default '',
  multa_pct numeric not null default 2 check (multa_pct >= 0),
  juros_mes_pct numeric not null default 1 check (juros_mes_pct >= 0),
  nome_cobranca text not null default 'Serviços contábeis',
  dia_vencimento_padrao int not null default 20 check (dia_vencimento_padrao between 1 and 31),
  indicacao_pct numeric not null default 50 check (indicacao_pct between 0 and 100),
  notificar_em text not null default '',
  modelo_contrato_path text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create table public.carteiras (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  saida text not null check (saida in ('csv_cora', 'lista_manual')),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

create table public.servicos_extras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor bigint not null check (valor >= 0),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);

-- ---------------------------------------------------------------------------
-- Clientes e sócios
-- ---------------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  codigo_dominio int unique,
  razao_social text not null,
  nome_fantasia text,
  documento text unique check (documento ~ '^[0-9]+$'), -- só dígitos (CPF/CNPJ)
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  telefone text,
  email text,
  inscricao_estadual text,
  inscricao_municipal text,
  regime text check (regime in ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real')),
  situacao text not null default 'a_revisar' check (situacao in ('a_revisar', 'ativo', 'inativo')),
  indicado_por uuid references public.clientes (id) on delete set null,
  campos_suspeitos text[] not null default '{}',
  observacoes text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index clientes_indicado_por_idx on public.clientes (indicado_por);
create index clientes_situacao_idx on public.clientes (situacao);

create table public.socios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null,
  cpf text,
  participacao numeric,
  administrador boolean not null default false,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index socios_cliente_id_idx on public.socios (cliente_id);
-- no máximo 1 sócio administrador por cliente
create unique index socios_um_administrador_idx on public.socios (cliente_id) where administrador;

-- ---------------------------------------------------------------------------
-- Contratos
-- ---------------------------------------------------------------------------
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  situacao text not null default 'em_negociacao'
    check (situacao in ('em_negociacao', 'fechado', 'encerrado')),
  honorario bigint check (honorario >= 0),
  dia_vencimento int check (dia_vencimento between 1 and 31),
  data_inicio date,
  carteira_id uuid references public.carteiras (id) on delete restrict,
  tipo_cobranca text check (tipo_cobranca in ('boleto', 'boleto_pix', 'pix', 'cartao')),
  email_cobranca text,
  parcela_adicional_total bigint not null default 0 check (parcela_adicional_total >= 0),
  legado boolean not null default false,
  encerrado_em date,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index contratos_cliente_id_idx on public.contratos (cliente_id);
create index contratos_carteira_id_idx on public.contratos (carteira_id);
-- no máximo 1 contrato não encerrado por cliente
create unique index contratos_um_vigente_idx on public.contratos (cliente_id)
  where situacao <> 'encerrado';

create table public.parcelas_adicionais (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  mes int not null check (mes between 1 and 12),
  valor bigint not null check (valor >= 0),
  forma text not null default 'junto_mensalidade'
    check (forma in ('junto_mensalidade', 'data_propria')),
  dia int check (dia between 1 and 31), -- null = último dia do mês
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index parcelas_adicionais_contrato_id_idx on public.parcelas_adicionais (contrato_id);

create table public.historico_valores (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  campo text not null,
  de bigint,
  para bigint,
  motivo text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index historico_valores_contrato_id_idx on public.historico_valores (contrato_id);

create table public.contrato_documentos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos (id) on delete cascade,
  docx_path text not null,
  pdf_path text,
  gerado_em timestamptz not null default now(),
  gerado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index contrato_documentos_contrato_id_idx on public.contrato_documentos (contrato_id);

-- ---------------------------------------------------------------------------
-- Cobranças
-- ---------------------------------------------------------------------------
create table public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  contrato_id uuid not null references public.contratos (id) on delete restrict,
  competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  origem text not null check (origem in ('mensal', 'parcela_avulsa')),
  parcela_id uuid references public.parcelas_adicionais (id) on delete set null,
  vencimento date not null,
  total bigint not null,
  situacao text not null default 'prevista'
    check (situacao in ('prevista', 'emitida', 'paga', 'paga_parcial', 'cancelada', 'quitada_por_credito')),
  emitida_em timestamptz,
  pago_em date,
  valor_recebido bigint not null default 0,
  saldo_dispensado boolean not null default false,
  motivo_cancelamento text,
  descricao text not null default '',
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index cobrancas_cliente_id_idx on public.cobrancas (cliente_id);
create index cobrancas_parcela_id_idx on public.cobrancas (parcela_id);
create index cobrancas_competencia_idx on public.cobrancas (competencia);
create index cobrancas_situacao_vencimento_idx on public.cobrancas (situacao, vencimento);
-- não duplicar cobranças ao reabrir/regerar o mês
create unique index cobrancas_unica_idx on public.cobrancas (
  contrato_id, competencia, origem,
  coalesce(parcela_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create table public.cobranca_itens (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid not null references public.cobrancas (id) on delete cascade,
  tipo text not null check (tipo in ('mensalidade', 'extra', 'parcela_adicional', 'desconto_indicacao')),
  descricao text not null,
  valor bigint not null, -- desconto é negativo
  ref_id uuid,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index cobranca_itens_cobranca_id_idx on public.cobranca_itens (cobranca_id);

create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  cobranca_id uuid not null references public.cobrancas (id) on delete restrict,
  data date not null,
  valor bigint not null check (valor > 0),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index pagamentos_cobranca_id_idx on public.pagamentos (cobranca_id);

-- ---------------------------------------------------------------------------
-- Serviços extras lançados
-- ---------------------------------------------------------------------------
create table public.lancamentos_extras (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  servico_id uuid references public.servicos_extras (id) on delete set null,
  descricao text not null,
  valor bigint not null check (valor >= 0),
  data date not null default current_date,
  competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'incluido', 'cancelado')),
  cobranca_id uuid references public.cobrancas (id) on delete set null,
  observacao text,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index lancamentos_extras_cliente_id_idx on public.lancamentos_extras (cliente_id);
create index lancamentos_extras_servico_id_idx on public.lancamentos_extras (servico_id);
create index lancamentos_extras_cobranca_id_idx on public.lancamentos_extras (cobranca_id);
create index lancamentos_extras_competencia_idx on public.lancamentos_extras (competencia, situacao);

-- ---------------------------------------------------------------------------
-- Indicações e créditos
-- ---------------------------------------------------------------------------
create table public.indicacoes (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.clientes (id) on delete restrict,
  indicado_id uuid not null unique references public.clientes (id) on delete restrict,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  check (indicador_id <> indicado_id)
);
create index indicacoes_indicador_id_idx on public.indicacoes (indicador_id);

create table public.creditos_movimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  indicacao_id uuid references public.indicacoes (id) on delete restrict,
  tipo text not null check (tipo in ('gerado', 'liberado', 'usado', 'estornado')),
  valor bigint not null check (valor >= 0),
  cobranca_id uuid references public.cobrancas (id) on delete cascade,
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index creditos_movimentos_cliente_id_idx on public.creditos_movimentos (cliente_id);
create index creditos_movimentos_indicacao_id_idx on public.creditos_movimentos (indicacao_id);
create index creditos_movimentos_cobranca_id_idx on public.creditos_movimentos (cobranca_id);

-- ---------------------------------------------------------------------------
-- Auditoria (somente inserção)
-- ---------------------------------------------------------------------------
create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid default auth.uid(),
  acao text not null,
  entidade text not null,
  entidade_id uuid,
  dados jsonb,
  em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  criado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index auditoria_entidade_idx on public.auditoria (entidade, entidade_id);
create index auditoria_em_idx on public.auditoria (em desc);

-- ---------------------------------------------------------------------------
-- Triggers de atualizado_em / atualizado_por
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'perfis', 'permissoes', 'escritorio', 'carteiras', 'servicos_extras', 'clientes',
    'socios', 'contratos', 'parcelas_adicionais', 'historico_valores', 'contrato_documentos',
    'lancamentos_extras', 'cobrancas', 'cobranca_itens', 'pagamentos', 'indicacoes',
    'creditos_movimentos', 'auditoria'
  ] loop
    execute format(
      'create trigger tg_atualizado before update on public.%I
         for each row execute function private.tg_atualizado()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- View: cobranças com atraso e saldo em aberto (respeita RLS do chamador)
-- Data de referência no fuso America/Sao_Paulo. Saldo dispensado encerra o atraso.
-- ---------------------------------------------------------------------------
create view public.v_cobrancas
with (security_invoker = true)
as
select
  c.*,
  (
    c.situacao in ('emitida', 'paga_parcial')
    and not c.saldo_dispensado
    and c.vencimento < (now() at time zone 'America/Sao_Paulo')::date
  ) as atrasada,
  case
    when c.situacao in ('emitida', 'paga_parcial') and not c.saldo_dispensado
      then greatest(c.total - c.valor_recebido, 0)
    else 0
  end::bigint as saldo_aberto
from public.cobrancas c;
