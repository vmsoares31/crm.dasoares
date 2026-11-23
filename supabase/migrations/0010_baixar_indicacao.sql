-- 0010_baixar_indicacao.sql — encerrar ("baixar") uma indicação cujo indicado nunca pagou.
-- SECURITY INVOKER: as políticas RLS do chamador continuam valendo.
--
-- O movimento 'gerado' permanece (histórico). Ele nunca entrou no saldo disponível
-- (saldo = liberado − usado + estornado), portanto não é preciso estornar nada ao baixar.
-- Só se baixa indicação sem 'liberado'; depois de baixada, reavaliar_credito_indicacao nunca libera.
-- Ordem de travas: ver cabeçalho da 0009; baixar_indicacao trava apenas a linha da indicação (3).

alter table public.indicacoes
  add column baixada_em timestamptz,
  add column baixada_por uuid,
  add column motivo_baixa text;

-- ---------------------------------------------------------------------------
-- reavaliar_credito_indicacao: igual à 0009, mas nunca libera para indicação baixada.
-- ---------------------------------------------------------------------------
create or replace function public.reavaliar_credito_indicacao(p_indicacao_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ind public.indicacoes%rowtype;
  v_primeira public.cobrancas%rowtype;
  v_credito bigint;
  v_honorario bigint;
  v_pct numeric;
begin
  select * into v_ind from public.indicacoes where id = p_indicacao_id for update;
  if not found then
    raise exception 'Indicação não encontrada.' using errcode = 'P0002';
  end if;

  if v_ind.baixada_em is not null then
    return 0;
  end if;

  if exists (select 1 from public.creditos_movimentos
              where indicacao_id = v_ind.id and tipo = 'liberado') then
    return 0;
  end if;

  select * into v_primeira
    from public.cobrancas
   where cliente_id = v_ind.indicado_id and situacao <> 'cancelada'
   order by vencimento, criado_em, id
   limit 1;
  if not found or v_primeira.situacao <> 'paga' then
    return 0;
  end if;

  select coalesce(sum(valor), 0) into v_credito
    from public.creditos_movimentos where indicacao_id = v_ind.id and tipo = 'gerado';
  if v_credito = 0 then
    select ct.honorario into v_honorario from public.contratos ct where ct.id = v_primeira.contrato_id;
    select e.indicacao_pct into v_pct from public.escritorio e limit 1;
    v_credito := floor((coalesce(v_honorario, 0) * round(coalesce(v_pct, 0) * 100) + 5000) / 10000)::bigint;
  end if;
  if v_credito <= 0 then
    return 0;
  end if;

  insert into public.creditos_movimentos (cliente_id, indicacao_id, tipo, valor, cobranca_id)
  values (v_ind.indicador_id, v_ind.id, 'liberado', v_credito, v_primeira.id);
  return v_credito;
end;
$$;

revoke all on function public.reavaliar_credito_indicacao(uuid) from public, anon;
grant execute on function public.reavaliar_credito_indicacao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- baixar_indicacao(indicacao, motivo)
-- ---------------------------------------------------------------------------
create or replace function public.baixar_indicacao(p_indicacao_id uuid, p_motivo text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ind public.indicacoes%rowtype;
begin
  select * into v_ind from public.indicacoes where id = p_indicacao_id for update;
  if not found then
    raise exception 'Indicação não encontrada.' using errcode = 'P0002';
  end if;
  if v_ind.baixada_em is not null then
    raise exception 'Indicação já baixada.' using errcode = '22023';
  end if;
  if exists (select 1 from public.creditos_movimentos
              where indicacao_id = v_ind.id and tipo = 'liberado') then
    raise exception 'Crédito já liberado: a indicação não pode ser baixada.' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo.' using errcode = '22023';
  end if;

  update public.indicacoes
     set baixada_em = now(),
         baixada_por = auth.uid(),
         motivo_baixa = trim(p_motivo),
         atualizado_em = now(),
         atualizado_por = auth.uid()
   where id = v_ind.id;
end;
$$;

revoke all on function public.baixar_indicacao(uuid, text) from public, anon;
grant execute on function public.baixar_indicacao(uuid, text) to authenticated;
