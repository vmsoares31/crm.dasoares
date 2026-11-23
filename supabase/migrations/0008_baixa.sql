-- 0008_baixa.sql — baixa manual, cancelamento, dispensa de saldo e liberação do crédito de
-- indicação, cada operação numa única transação.
-- SECURITY INVOKER: as políticas RLS do chamador continuam valendo.
-- As regras espelham src/domain/{baixa,indicacao}.ts (testadas em tests/domain).

-- ---------------------------------------------------------------------------
-- Dispensa de saldo: a cobrança continua 'paga_parcial' (o recebido continua verdadeiro),
-- com saldo_dispensado = true (v_cobrancas já zera saldo_aberto e tira do atraso) e o motivo.
-- ---------------------------------------------------------------------------
alter table public.cobrancas add column if not exists motivo_dispensa text;

-- ---------------------------------------------------------------------------
-- registrar_baixa(cobranca, data, valor)
--   Só cobrança 'emitida' ou 'paga_parcial' com saldo não dispensado.
--   Insere o pagamento, acumula valor_recebido e define a situação:
--     recebido >= total → 'paga' (excedente = acréscimo de multa/juros) e pago_em = data;
--     senão → 'paga_parcial'.
--   Se ficou 'paga', é a primeira cobrança do cliente (a mais antiga não cancelada, por
--   vencimento) e o cliente foi indicado (tabela indicacoes) sem crédito liberado ainda,
--   grava o movimento 'liberado' para o indicador. Valor: o 'gerado' registrado na indicação;
--   na falta dele, indicacao_pct do escritório sobre o honorário do contrato da cobrança
--   (ao centavo, meio para cima — igual a creditoDaIndicacao).
--   Retorna {"situacao", "valor_recebido", "credito_liberado", "indicador_id"}.
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
  v_primeira uuid;
  v_ind public.indicacoes%rowtype;
  v_credito bigint := 0;
  v_honorario bigint;
  v_pct numeric;
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
    select * into v_ind from public.indicacoes where indicado_id = v_cob.cliente_id for update;
    if found then
      select id into v_primeira
        from public.cobrancas
       where cliente_id = v_cob.cliente_id and situacao <> 'cancelada'
       order by vencimento, criado_em, id
       limit 1;

      if v_primeira = p_cobranca_id
         and not exists (select 1 from public.creditos_movimentos
                          where indicacao_id = v_ind.id and tipo = 'liberado') then
        select coalesce(sum(valor), 0) into v_credito
          from public.creditos_movimentos where indicacao_id = v_ind.id and tipo = 'gerado';
        if v_credito = 0 then
          select ct.honorario into v_honorario from public.contratos ct where ct.id = v_cob.contrato_id;
          select e.indicacao_pct into v_pct from public.escritorio e limit 1;
          v_credito := floor((coalesce(v_honorario, 0) * round(coalesce(v_pct, 0) * 100) + 5000) / 10000)::bigint;
        end if;
        if v_credito > 0 then
          insert into public.creditos_movimentos (cliente_id, indicacao_id, tipo, valor, cobranca_id)
          values (v_ind.indicador_id, v_ind.id, 'liberado', v_credito, p_cobranca_id);
        end if;
      end if;
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
-- cancelar_cobranca(cobranca, motivo)
--   Cancela com motivo qualquer cobrança sem pagamento: prevista, emitida ou quitada por
--   crédito. 'paga_parcial' não é cancelável (já há dinheiro recebido): use dispensar_saldo.
--   Extras vinculados voltam a 'pendente' (mesma regra de 0007) e o crédito de indicação
--   usado pela cobrança volta ao saldo do cliente com um movimento 'estornado'.
--   Retorna {"estornado": valor}.
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

  return jsonb_build_object('estornado', v_estorno);
end;
$$;

revoke all on function public.cancelar_cobranca(uuid, text) from public, anon;
grant execute on function public.cancelar_cobranca(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancelar_cobranca_prevista (0007, "excluir cliente do mês"): mesma assinatura e mesmo
-- comportamento, agora delegando a cancelar_cobranca depois de exigir 'prevista'.
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
end;
$$;

revoke all on function public.cancelar_cobranca_prevista(uuid, text) from public, anon;
grant execute on function public.cancelar_cobranca_prevista(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- dispensar_saldo(cobranca, motivo): encerra o saldo de uma cobrança 'paga_parcial'.
-- Não libera crédito de indicação (a liberação exige pagamento integral, §6.7).
-- ---------------------------------------------------------------------------
create or replace function public.dispensar_saldo(
  p_cobranca_id uuid,
  p_motivo text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cob public.cobrancas%rowtype;
begin
  if nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo.' using errcode = '22023';
  end if;
  select * into v_cob from public.cobrancas where id = p_cobranca_id for update;
  if not found then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0002';
  end if;
  if v_cob.situacao <> 'paga_parcial' or v_cob.saldo_dispensado then
    raise exception 'Só é possível dispensar o saldo de cobranças pagas parcialmente.' using errcode = '22023';
  end if;

  update public.cobrancas
     set saldo_dispensado = true, motivo_dispensa = trim(p_motivo)
   where id = p_cobranca_id;
end;
$$;

revoke all on function public.dispensar_saldo(uuid, text) from public, anon;
grant execute on function public.dispensar_saldo(uuid, text) to authenticated;
