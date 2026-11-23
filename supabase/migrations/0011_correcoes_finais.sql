-- 0011_correcoes_finais.sql — correções da revisão final.
-- SECURITY INVOKER em todas as funções: as políticas RLS do chamador continuam valendo.
--
-- I1  Parcelas adicionais atualizadas no lugar (salvar_contrato faz upsert por id) e FK
--     cobrancas.parcela_id ON DELETE RESTRICT: salvar o contrato não desvincula mais as
--     cobranças já geradas das suas parcelas (o que permitia cobrar a parcela avulsa duas vezes).
-- I2  cobrancas.excluida_do_mes: "Excluir do mês" (cancelar_cobranca_prevista) marca true; o
--     "Cancelar" geral (cancelar_cobranca) deixa false. A unicidade por contrato/competência/
--     origem/parcela passa a valer só entre cobranças não canceladas, e abrir/regerar gera a
--     substituta de uma cobrança cancelada que não foi excluída do mês (reemissão).
-- I4  salvar_contrato rejeita honorário <= 0.
--
-- Concorrência: a ordem de travas descrita em 0009 continua valendo. salvar_contrato trava a
-- linha do contrato e depois (só) cobranças canceladas das parcelas removidas — o mesmo que o
-- ON DELETE SET NULL antigo já fazia —, e nenhuma função trava cobranças antes de contratos.
-- O novo teste em gravar_competencia é só leitura.

-- ---------------------------------------------------------------------------
-- I2: coluna excluida_do_mes e unicidade só entre não canceladas
-- ---------------------------------------------------------------------------
alter table public.cobrancas
  add column excluida_do_mes boolean not null default false;

comment on column public.cobrancas.excluida_do_mes is
  'true = cancelada por "Excluir do mês": não é gerada de novo na competência. '
  'Cancelada pelo "Cancelar" geral fica false e abrir/regerar gera a substituta.';

-- Exclusões do mês anteriores a esta migration: identificadas pela auditoria da ação.
update public.cobrancas c
   set excluida_do_mes = true
 where c.situacao = 'cancelada'
   and exists (
     select 1 from public.auditoria a
      where a.acao = 'cobranca.excluir_do_mes'
        and a.entidade = 'cobrancas'
        and a.entidade_id = c.id
   );

drop index if exists public.cobrancas_unica_idx;
-- não duplicar cobranças ao reabrir/regerar o mês (canceladas não contam: podem ser reemitidas)
create unique index cobrancas_unica_idx on public.cobrancas (
  contrato_id, competencia, origem,
  coalesce(parcela_id, '00000000-0000-0000-0000-000000000000'::uuid)
) where situacao <> 'cancelada';

-- ---------------------------------------------------------------------------
-- I1: FK cobrancas.parcela_id → ON DELETE RESTRICT
-- ---------------------------------------------------------------------------
do $$
declare
  v_nome text;
begin
  for v_nome in
    select con.conname
      from pg_constraint con
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
     where con.conrelid = 'public.cobrancas'::regclass
       and con.contype = 'f'
       and con.confrelid = 'public.parcelas_adicionais'::regclass
       and att.attname = 'parcela_id'
  loop
    execute format('alter table public.cobrancas drop constraint %I', v_nome);
  end loop;
end;
$$;

alter table public.cobrancas
  add constraint cobrancas_parcela_id_fkey
  foreign key (parcela_id) references public.parcelas_adicionais (id) on delete restrict;

-- ---------------------------------------------------------------------------
-- salvar_contrato (0006): mesma assinatura, retorno, campos e histórico de valores.
-- Mudanças:
--   - p_parcelas: cada elemento pode trazer "id". Com id: atualiza a parcela no lugar (precisa
--     ser deste contrato); sem id: insere. Parcelas do contrato ausentes da lista são removidas.
--   - Remover parcela com cobrança não cancelada falha ('Parcela já cobrada: ...'); cobranças
--     canceladas da parcela removida perdem o vínculo (parcela_id = null) antes da remoção.
--   - Honorário informado precisa ser maior que zero.
-- ---------------------------------------------------------------------------
create or replace function public.salvar_contrato(
  p_contrato_id uuid,
  p_campos jsonb,
  p_parcelas jsonb,
  p_motivo text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_atual public.contratos%rowtype;
  v_honorario bigint := (p_campos->>'honorario')::bigint;
  v_total bigint := coalesce((p_campos->>'parcela_adicional_total')::bigint, 0);
  v_parcelas jsonb := coalesce(p_parcelas, '[]'::jsonb);
  v_ids uuid[];
  v_removidas uuid[];
begin
  select * into v_atual from public.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
  end if;
  if v_honorario is not null and v_honorario <= 0 then
    raise exception 'Informe um honorário maior que zero.' using errcode = '22023';
  end if;

  update public.contratos set
    situacao = p_campos->>'situacao',
    honorario = v_honorario,
    dia_vencimento = (p_campos->>'dia_vencimento')::int,
    data_inicio = (p_campos->>'data_inicio')::date,
    carteira_id = (p_campos->>'carteira_id')::uuid,
    tipo_cobranca = p_campos->>'tipo_cobranca',
    email_cobranca = p_campos->>'email_cobranca',
    parcela_adicional_total = v_total,
    legado = coalesce((p_campos->>'legado')::boolean, false),
    encerrado_em = (p_campos->>'encerrado_em')::date
  where id = p_contrato_id;

  -- ids enviados (parcelas existentes); repetidos ou de outro contrato são rejeitados
  select coalesce(array_agg((x->>'id')::uuid), '{}') into v_ids
    from jsonb_array_elements(v_parcelas) x
   where nullif(x->>'id', '') is not null;
  if cardinality(v_ids) <> (select count(distinct i) from unnest(v_ids) i) then
    raise exception 'Parcela repetida.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_ids) i
     where not exists (select 1 from public.parcelas_adicionais p where p.id = i and p.contrato_id = p_contrato_id)
  ) then
    raise exception 'Parcela não pertence a este contrato. Recarregue a página e tente novamente.' using errcode = '22023';
  end if;

  -- remoção: parcelas do contrato que não vieram na lista
  select coalesce(array_agg(p.id), '{}') into v_removidas
    from public.parcelas_adicionais p
   where p.contrato_id = p_contrato_id
     and not (p.id = any (v_ids));
  if cardinality(v_removidas) > 0 then
    if exists (
      select 1 from public.cobrancas c
       where c.parcela_id = any (v_removidas) and c.situacao <> 'cancelada'
    ) then
      raise exception 'Parcela já cobrada: cancele a cobrança antes de removê-la.' using errcode = '22023';
    end if;
    update public.cobrancas set parcela_id = null
     where parcela_id = any (v_removidas) and situacao = 'cancelada';
    delete from public.parcelas_adicionais where id = any (v_removidas);
  end if;

  -- atualização no lugar (as cobranças continuam vinculadas à mesma parcela)
  update public.parcelas_adicionais p set
    mes = (x->>'mes')::int,
    valor = (x->>'valor')::bigint,
    forma = x->>'forma',
    dia = (x->>'dia')::int
  from jsonb_array_elements(v_parcelas) x
  where nullif(x->>'id', '') is not null
    and p.id = (x->>'id')::uuid
    and p.contrato_id = p_contrato_id;

  -- parcelas novas
  insert into public.parcelas_adicionais (contrato_id, mes, valor, forma, dia)
  select p_contrato_id, (x->>'mes')::int, (x->>'valor')::bigint, x->>'forma', (x->>'dia')::int
    from jsonb_array_elements(v_parcelas) x
   where nullif(x->>'id', '') is null;

  if v_atual.honorario is distinct from v_honorario then
    insert into public.historico_valores (contrato_id, campo, de, para, motivo)
    values (p_contrato_id, 'honorario', v_atual.honorario, v_honorario, nullif(trim(p_motivo), ''));
  end if;
  if v_atual.parcela_adicional_total is distinct from v_total then
    insert into public.historico_valores (contrato_id, campo, de, para, motivo)
    values (p_contrato_id, 'parcela_adicional_total', v_atual.parcela_adicional_total, v_total, nullif(trim(p_motivo), ''));
  end if;
end;
$$;

revoke all on function public.salvar_contrato(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.salvar_contrato(uuid, jsonb, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancelar_cobranca_prevista (0008, "excluir cliente do mês"): mesma assinatura, validações e
-- delegação a cancelar_cobranca. Novo: marca excluida_do_mes = true (a linha já está travada
-- pelo FOR UPDATE daqui — trava (1) do cabeçalho de 0009).
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_cobranca_prevista(
  p_cobranca_id uuid,
  p_motivo text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_situacao text;
begin
  if nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo.' using errcode = '22023';
  end if;
  select situacao into v_situacao from public.cobrancas where id = p_cobranca_id for update;
  if not found then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0002';
  end if;
  if v_situacao <> 'prevista' then
    raise exception 'Só é possível excluir do mês cobranças previstas.' using errcode = '22023';
  end if;
  perform public.cancelar_cobranca(p_cobranca_id, p_motivo);
  update public.cobrancas set excluida_do_mes = true where id = p_cobranca_id;
end;
$$;

revoke all on function public.cancelar_cobranca_prevista(uuid, text) from public, anon;
grant execute on function public.cancelar_cobranca_prevista(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- gravar_competencia (0009): mesma assinatura, validações, comportamento, travas e retorno.
-- Novo: como a unicidade não conta mais canceladas, recusa inserir cobrança cuja chave
-- (contrato, competência, origem, parcela) tem cobrança excluída do mês — espelha
-- planejarCompetencia (bloqueiaChave) e pega um plano feito antes de uma exclusão concorrente.
-- ---------------------------------------------------------------------------
create or replace function public.gravar_competencia(
  p_competencia text,
  p_regerar boolean,
  p_cobrancas jsonb,
  p_clientes uuid[] default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_removidas int := 0;
  v_inseridas int := 0;
  v_cob jsonb;
  v_item jsonb;
  v_id uuid;
  v_cliente uuid;
  v_total bigint;
  v_soma bigint;
  v_credito bigint;
  v_saldo bigint;
  v_n int;
  v_clientes_removidos uuid[] := '{}';
  v_indicacao uuid;
begin
  if p_competencia is null or p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Competência inválida.' using errcode = '22023';
  end if;

  if p_regerar then
    update public.lancamentos_extras e
       set situacao = 'pendente', cobranca_id = null
      from public.cobrancas c
     where e.cobranca_id = c.id
       and c.competencia = p_competencia
       and c.situacao in ('prevista', 'quitada_por_credito')
       and (p_clientes is null or c.cliente_id = any (p_clientes));

    with removidas as (
      delete from public.cobrancas c
       where c.competencia = p_competencia
         and c.situacao in ('prevista', 'quitada_por_credito')
         and (p_clientes is null or c.cliente_id = any (p_clientes))
      returning c.cliente_id
    )
    select count(*)::int, coalesce(array_agg(distinct cliente_id), '{}')
      into v_removidas, v_clientes_removidos
      from removidas;
  end if;

  for v_cob in select * from jsonb_array_elements(coalesce(p_cobrancas, '[]'::jsonb)) loop
    v_cliente := (v_cob->>'cliente_id')::uuid;
    v_total := (v_cob->>'total')::bigint;
    v_credito := coalesce((v_cob->>'credito_usado')::bigint, 0);

    if p_clientes is not null and not (v_cliente = any (p_clientes)) then
      raise exception 'Cobrança fora do escopo informado.' using errcode = '22023';
    end if;
    if v_cob->>'situacao' not in ('prevista', 'quitada_por_credito') then
      raise exception 'Situação inicial inválida.' using errcode = '22023';
    end if;
    select coalesce(sum((x->>'valor')::bigint), 0) into v_soma
      from jsonb_array_elements(coalesce(v_cob->'itens', '[]'::jsonb)) x;
    if v_soma <> v_total then
      raise exception 'Total da cobrança não confere com os itens.' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.cobrancas c
       where c.contrato_id = (v_cob->>'contrato_id')::uuid
         and c.competencia = p_competencia
         and c.origem = v_cob->>'origem'
         and c.parcela_id is not distinct from (v_cob->>'parcela_id')::uuid
         and c.situacao = 'cancelada'
         and c.excluida_do_mes
    ) then
      raise exception 'As cobranças desta competência mudaram durante a operação. Recarregue a página e tente novamente.'
        using errcode = '40001';
    end if;

    insert into public.cobrancas (cliente_id, contrato_id, competencia, origem, parcela_id, vencimento,
                                  total, situacao, descricao)
    values (v_cliente, (v_cob->>'contrato_id')::uuid, p_competencia, v_cob->>'origem',
            (v_cob->>'parcela_id')::uuid, (v_cob->>'vencimento')::date, v_total,
            v_cob->>'situacao', coalesce(v_cob->>'descricao', ''))
    returning id into v_id;

    for v_item in select * from jsonb_array_elements(coalesce(v_cob->'itens', '[]'::jsonb)) loop
      insert into public.cobranca_itens (cobranca_id, tipo, descricao, valor, ref_id)
      values (v_id, v_item->>'tipo', v_item->>'descricao', (v_item->>'valor')::bigint, (v_item->>'ref_id')::uuid);

      if v_item->>'tipo' = 'extra' and v_item->>'ref_id' is not null then
        update public.lancamentos_extras
           set situacao = 'incluido', cobranca_id = v_id
         where id = (v_item->>'ref_id')::uuid
           and cliente_id = v_cliente
           and competencia = p_competencia
           and situacao = 'pendente';
        get diagnostics v_n = row_count;
        if v_n = 0 then
          raise exception 'Um extra deixou de estar pendente durante a operação. Tente novamente.'
            using errcode = '40001';
        end if;
      end if;
    end loop;

    if v_credito > 0 then
      insert into public.creditos_movimentos (cliente_id, tipo, valor, cobranca_id)
      values (v_cliente, 'usado', v_credito, v_id);

      select coalesce(sum(case when tipo in ('liberado', 'estornado') then valor
                               when tipo = 'usado' then -valor else 0 end), 0)
        into v_saldo
        from public.creditos_movimentos where cliente_id = v_cliente;
      if v_saldo < 0 then
        raise exception 'Saldo de crédito insuficiente. Tente novamente.' using errcode = '40001';
      end if;
    end if;

    v_inseridas := v_inseridas + 1;
  end loop;

  -- Reavalia a liberação do crédito dos indicados que perderam cobranças na regeração: uma
  -- cobrança apagada podia ser a "primeira" na frente de outra já paga. Feito depois das
  -- inserções, para que uma cobrança regerada no lugar da apagada continue bloqueando.
  if cardinality(v_clientes_removidos) > 0 then
    -- trava (2), em ordem de id (ver cabeçalho de 0009)
    perform 1 from public.clientes where id = any (v_clientes_removidos) order by id for share;
    for v_indicacao in
      select i.id from public.indicacoes i where i.indicado_id = any (v_clientes_removidos) order by i.id
    loop
      perform public.reavaliar_credito_indicacao(v_indicacao);
    end loop;
  end if;

  return jsonb_build_object('inseridas', v_inseridas, 'removidas', v_removidas);
end;
$$;

revoke all on function public.gravar_competencia(text, boolean, jsonb, uuid[]) from public, anon;
grant execute on function public.gravar_competencia(text, boolean, jsonb, uuid[]) to authenticated;
