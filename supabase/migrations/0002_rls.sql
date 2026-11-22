-- 0002_rls.sql — RLS em todas as tabelas, grants e bucket de contratos.
-- Regra geral: usuário autenticado com perfil ativo lê e escreve.
-- perfis, permissoes e escritorio: escrita só por administrador ativo.
-- auditoria: somente inserção (do próprio usuário) e leitura.

-- ---------------------------------------------------------------------------
-- Funções auxiliares (schema private, não exposto pela API).
-- SECURITY DEFINER para ler perfis sem recursão de RLS; search_path fixo.
-- ---------------------------------------------------------------------------
create or replace function private.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.usuario_id = auth.uid() and p.ativo
  );
$$;

create or replace function private.tem_papel(p_papel text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.usuario_id = auth.uid() and p.ativo and p.papel = p_papel
  );
$$;

create or replace function private.tem_permissao(p_acao text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    join public.permissoes pe on pe.papel = p.papel
    where p.usuario_id = auth.uid() and p.ativo and pe.acao = p_acao
  );
$$;

revoke all on function private.usuario_ativo() from public;
revoke all on function private.tem_papel(text) from public;
revoke all on function private.tem_permissao(text) from public;
revoke all on function private.tg_atualizado() from public;
grant usage on schema private to authenticated;
grant execute on function private.usuario_ativo() to authenticated;
grant execute on function private.tem_papel(text) to authenticated;
grant execute on function private.tem_permissao(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Grants: só authenticated acessa; anon não acessa nada no public.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.v_cobrancas from authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- RLS ligado em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.permissoes enable row level security;
alter table public.escritorio enable row level security;
alter table public.carteiras enable row level security;
alter table public.servicos_extras enable row level security;
alter table public.clientes enable row level security;
alter table public.socios enable row level security;
alter table public.contratos enable row level security;
alter table public.parcelas_adicionais enable row level security;
alter table public.historico_valores enable row level security;
alter table public.contrato_documentos enable row level security;
alter table public.lancamentos_extras enable row level security;
alter table public.cobrancas enable row level security;
alter table public.cobranca_itens enable row level security;
alter table public.pagamentos enable row level security;
alter table public.indicacoes enable row level security;
alter table public.creditos_movimentos enable row level security;
alter table public.auditoria enable row level security;

-- ---------------------------------------------------------------------------
-- perfis: cada um vê o próprio; ativos veem todos; escrita só administrador
-- ---------------------------------------------------------------------------
create policy perfis_select on public.perfis for select to authenticated
  using (usuario_id = (select auth.uid()) or (select private.usuario_ativo()));
create policy perfis_insert on public.perfis for insert to authenticated
  with check ((select private.tem_papel('administrador')));
create policy perfis_update on public.perfis for update to authenticated
  using ((select private.tem_papel('administrador')))
  with check ((select private.tem_papel('administrador')));
create policy perfis_delete on public.perfis for delete to authenticated
  using ((select private.tem_papel('administrador')));

-- ---------------------------------------------------------------------------
-- permissoes e escritorio: leitura por ativos; escrita só administrador
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['permissoes', 'escritorio'] loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using ((select private.usuario_ativo()))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check ((select private.tem_papel(''administrador'')))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using ((select private.tem_papel(''administrador'')))
         with check ((select private.tem_papel(''administrador'')))', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated
         using ((select private.tem_papel(''administrador'')))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas de negócio: usuário ativo lê e escreve
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'carteiras', 'servicos_extras', 'clientes', 'socios', 'contratos',
    'parcelas_adicionais', 'historico_valores', 'contrato_documentos',
    'lancamentos_extras', 'cobrancas', 'cobranca_itens', 'pagamentos',
    'indicacoes', 'creditos_movimentos'
  ] loop
    execute format(
      'create policy %1$s_select on public.%1$I for select to authenticated
         using ((select private.usuario_ativo()))', t);
    execute format(
      'create policy %1$s_insert on public.%1$I for insert to authenticated
         with check ((select private.usuario_ativo()))', t);
    execute format(
      'create policy %1$s_update on public.%1$I for update to authenticated
         using ((select private.usuario_ativo()))
         with check ((select private.usuario_ativo()))', t);
    execute format(
      'create policy %1$s_delete on public.%1$I for delete to authenticated
         using ((select private.usuario_ativo()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- auditoria: ativo lê; insere apenas em nome próprio; sem update/delete
-- ---------------------------------------------------------------------------
create policy auditoria_select on public.auditoria for select to authenticated
  using ((select private.usuario_ativo()));
create policy auditoria_insert on public.auditoria for insert to authenticated
  with check (
    (select private.usuario_ativo())
    and usuario_id = (select auth.uid())
  );
revoke update, delete on public.auditoria from authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado "contratos" (modelo e documentos gerados)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contratos', 'contratos', false)
on conflict (id) do update set public = false;

create policy contratos_select on storage.objects for select to authenticated
  using (bucket_id = 'contratos' and (select private.usuario_ativo()));
create policy contratos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'contratos' and (select private.usuario_ativo()));
create policy contratos_update on storage.objects for update to authenticated
  using (bucket_id = 'contratos' and (select private.usuario_ativo()))
  with check (bucket_id = 'contratos' and (select private.usuario_ativo()));
create policy contratos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'contratos' and (select private.usuario_ativo()));
