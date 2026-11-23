-- 0009_indicacoes.sql — registro de indicação e regra única (reavaliável) de liberação do crédito.
-- SECURITY INVOKER: as políticas RLS do chamador continuam valendo.
-- As regras espelham src/domain/indicacao.ts (cobrancaQueLibera, creditoDaIndicacao; testadas
-- em tests/domain/indicacao.test.ts).
--
-- Concorrência (ordem de travas, sempre nesta ordem, nunca o inverso):
--   1. linhas de cobranças (FOR UPDATE em baixa/cancelamento; DELETE na regeração)
--   2. linha do cliente indicado: FOR SHARE em registrar_baixa, cancelar_cobranca e
--      gravar_competencia (antes de procurar a indicação); FOR UPDATE em registrar_indicacao
--   3. linha da indicação (FOR UPDATE em reavaliar_credito_indicacao)
--   registrar_indicacao não trava cobranças (só lê) e trava apenas a indicação que acabou de
--   criar, então não há ciclo. A trava do cliente (2) serializa "registrar indicação" com
--   "baixa/cancelamento/regeração" do mesmo cliente: quem vier depois enxerga o commit do
--   outro (READ COMMITTED: cada comando seguinte usa um snapshot novo) e a liberação não se
--   perde. Várias FOR SHARE simultâneas não conflitam entre si; a indicação (3) serializa as
--   reavaliações.

-- ---------------------------------------------------------------------------
-- reavaliar_credito_indicacao(indicacao)
--   Idempotente. Libera o crédito (movimento 'liberado' para o indicador) se e somente se:
--     - ainda não há 'liberado' para a indicação; e
--     - a primeira cobrança do indicado (a mais antiga não cancelada, por vencimento, criação
--       e id) está 'paga'.
--   Valor: o 'gerado' registrado na indicação; na falta dele (indicações gravadas antes desta
--   migration), indicacao_pct do escritório sobre o honorário do contrato da cobrança (ao
--   centavo, meio para cima — igual a creditoDaIndicacao).
--   Trava a linha da indicação (FOR UPDATE) para que duas reavaliações simultâneas não liberem
--   duas vezes. Retorna o valor liberado agora (0 se nada mudou).
--   Chamada por registrar_indicacao, registrar_baixa e cancelar_cobranca.
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
-- registrar_indicacao(indicador, indicado)
--   Numa transação: grava indicacoes, clientes.indicado_por do indicado e o movimento 'gerado'
--   do indicador = indicacao_pct do escritório sobre o honorário do contrato vigente (não
--   encerrado) do indicado. Depois reavalia a liberação (o 1º pagamento pode já ter ocorrido).
--   Retorna {"indicacao_id", "gerado", "liberado"}.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_indicacao(
  p_indicador_id uuid,
  p_indicado_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_honorario bigint;
  v_pct numeric;
  v_gerado bigint;
  v_id uuid;
  v_liberado bigint;
begin
  if p_indicador_id is null or p_indicado_id is null then
    raise exception 'Informe o cliente indicador e o cliente indicado.' using errcode = '22023';
  end if;
  if p_indicador_id = p_indicado_id then
    raise exception 'Um cliente não pode indicar a si mesmo.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.clientes where id = p_indicador_id) then
    raise exception 'Cliente indicador não encontrado.' using errcode = 'P0002';
  end if;
  -- trava o indicado: duas indicações simultâneas do mesmo cliente esperam uma pela outra
  perform 1 from public.clientes where id = p_indicado_id for update;
  if not found then
    raise exception 'Cliente indicado não encontrado.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.indicacoes where indicado_id = p_indicado_id) then
    raise exception 'Este cliente já foi indicado.' using errcode = '22023';
  end if;

  select ct.honorario into v_honorario
    from public.contratos ct
   where ct.cliente_id = p_indicado_id and ct.situacao <> 'encerrado'
     and ct.honorario is not null and ct.honorario > 0
   order by ct.criado_em desc, ct.id
   limit 1;
  if v_honorario is null then
    raise exception 'Indicado precisa ter contrato com honorário' using errcode = '22023';
  end if;

  select e.indicacao_pct into v_pct from public.escritorio e limit 1;
  v_gerado := floor((v_honorario * round(coalesce(v_pct, 0) * 100) + 5000) / 10000)::bigint;

  begin
    insert into public.indicacoes (indicador_id, indicado_id)
    values (p_indicador_id, p_indicado_id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Este cliente já foi indicado.' using errcode = '22023';
  end;

  update public.clientes set indicado_por = p_indicador_id where id = p_indicado_id;

  if v_gerado > 0 then
    insert into public.creditos_movimentos (cliente_id, indicacao_id, tipo, valor)
    values (p_indicador_id, v_id, 'gerado', v_gerado);
  end if;

  v_liberado := public.reavaliar_credito_indicacao(v_id);

  return jsonb_build_object('indicacao_id', v_id, 'gerado', v_gerado, 'liberado', v_liberado);
end;
$$;

revoke all on function public.registrar_indicacao(uuid, uuid) from public, anon;
grant execute on function public.registrar_indicacao(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- registrar_baixa (0008): mesma assinatura, validações e retorno; a liberação do crédito
-- passa a delegar a reavaliar_credito_indicacao (regra única).
-- ---------------------------------------------------------------------------
create or replace function public.registrar_baixa(
  p_cobranca_id uuid,
  p_data date,
  p_valor bigint
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cob public.cobrancas%rowtype;
  v_recebido bigint;
  v_situacao text;
  v_ind public.indicacoes%rowtype;
  v_credito bigint := 0;
begin
  if p_valor is null or p_valor <= 0 then
    raise exception 'Informe um valor recebido maior que zero.' using errcode = '22023';
  end if;
  if p_data is null then
    raise exception 'Informe a data do pagamento.' using errcode = '22023';
  end if;
  if p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A data do pagamento não pode ser futura.' using errcode = '22023';
  end if;

  select * into v_cob from public.cobrancas where id = p_cobranca_id for update;
  if not found then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0002';
  end if;
  if v_cob.situacao = 'prevista' then
    raise exception 'Marque a cobrança como emitida antes de dar baixa.' using errcode = '22023';
  end if;
  if v_cob.situacao not in ('emitida', 'paga_parcial') or v_cob.saldo_dispensado then
    raise exception 'Esta cobrança não aceita baixa.' using errcode = '22023';
  end if;

  insert into public.pagamentos (cobranca_id, data, valor) values (p_cobranca_id, p_data, p_valor);

  v_recebido := v_cob.valor_recebido + p_valor;
  v_situacao := case when v_recebido >= v_cob.total then 'paga' else 'paga_parcial' end;

  update public.cobrancas
     set valor_recebido = v_recebido,
         situacao = v_situacao,
         pago_em = case when v_situacao = 'paga' then p_data else null end
   where id = p_cobranca_id;

  if v_situacao = 'paga' then
    -- trava (2): espera um registrar_indicacao em andamento deste cliente (ver cabeçalho)
    perform 1 from public.clientes where id = v_cob.cliente_id for share;
    select * into v_ind from public.indicacoes where indicado_id = v_cob.cliente_id;
    if found then
      v_credito := public.reavaliar_credito_indicacao(v_ind.id);
    end if;
  end if;

  return jsonb_build_object(
    'situacao', v_situacao,
    'valor_recebido', v_recebido,
    'credito_liberado', v_credito,
    'indicador_id', case when v_credito > 0 then v_ind.indicador_id end
  );
end;
$$;

revoke all on function public.registrar_baixa(uuid, date, bigint) from public, anon;
grant execute on function public.registrar_baixa(uuid, date, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- cancelar_cobranca (0008): mesma assinatura, validações e retorno ({"estornado"}).
-- Novo: se a cobrança é de um cliente indicado, reavalia a liberação — cancelar a 1ª cobrança
-- em aberto pode tornar a seguinte (já paga) a primeira, e o crédito não pode se perder.
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_cobranca(
  p_cobranca_id uuid,
  p_motivo text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cob public.cobrancas%rowtype;
  v_usado bigint;
  v_estornado bigint;
  v_estorno bigint;
  v_indicacao uuid;
begin
  if nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo.' using errcode = '22023';
  end if;
  select * into v_cob from public.cobrancas where id = p_cobranca_id for update;
  if not found then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0002';
  end if;
  if v_cob.situacao = 'paga_parcial' then
    raise exception 'Cobrança com pagamento registrado não pode ser cancelada. Use “Dispensar saldo”.'
      using errcode = '22023';
  end if;
  if v_cob.situacao not in ('prevista', 'emitida', 'quitada_por_credito') then
    raise exception 'Só é possível cancelar cobranças ainda não pagas.' using errcode = '22023';
  end if;
  if exists (select 1 from public.pagamentos where cobranca_id = p_cobranca_id) then
    raise exception 'Cobrança com pagamento registrado não pode ser cancelada.' using errcode = '22023';
  end if;

  update public.cobrancas
     set situacao = 'cancelada', motivo_cancelamento = trim(p_motivo)
   where id = p_cobranca_id;

  update public.lancamentos_extras
     set situacao = 'pendente', cobranca_id = null
   where cobranca_id = p_cobranca_id and situacao = 'incluido';

  -- estorna o que foi usado e ainda não estornado (idempotente)
  select coalesce(sum(valor) filter (where tipo = 'usado'), 0),
         coalesce(sum(valor) filter (where tipo = 'estornado'), 0)
    into v_usado, v_estornado
    from public.creditos_movimentos
   where cobranca_id = p_cobranca_id and cliente_id = v_cob.cliente_id;
  v_estorno := greatest(v_usado - v_estornado, 0);
  if v_estorno > 0 then
    insert into public.creditos_movimentos (cliente_id, tipo, valor, cobranca_id)
    values (v_cob.cliente_id, 'estornado', v_estorno, p_cobranca_id);
  end if;

  -- trava (2): espera um registrar_indicacao em andamento deste cliente (ver cabeçalho)
  perform 1 from public.clientes where id = v_cob.cliente_id for share;
  select id into v_indicacao from public.indicacoes where indicado_id = v_cob.cliente_id;
  if found then
    perform public.reavaliar_credito_indicacao(v_indicacao);
  end if;

  return jsonb_build_object('estornado', v_estorno);
end;
$$;

revoke all on function public.cancelar_cobranca(uuid, text) from public, anon;
grant execute on function public.cancelar_cobranca(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- gravar_competencia (0007): mesma assinatura, validações, comportamento e retorno.
-- Novo: depois de apagar (regerar) e inserir, reavalia a liberação do crédito das indicações
-- cujos indicados tiveram cobranças apagadas.
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
    -- trava (2), em ordem de id (ver cabeçalho)
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
