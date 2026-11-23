-- 0007_competencia.sql — abrir/regerar a competência, editar itens e excluir cliente do mês,
-- cada operação numa única transação.
-- SECURITY INVOKER: as políticas RLS do chamador continuam valendo.

-- ---------------------------------------------------------------------------
-- gravar_competencia
--   p_regerar = true: apaga as cobranças prevista/quitada_por_credito da competência
--     (restritas a p_clientes, se informado), devolvendo antes os extras delas a 'pendente';
--     itens e movimentos 'usado' caem em cascata.
--   Depois insere as cobranças de p_cobrancas com seus itens, marca os extras incluídos
--   (precisam estar 'pendente' na competência) e grava o movimento 'usado' do crédito.
--   p_cobrancas: [{cliente_id, contrato_id, origem, parcela_id, vencimento, total, situacao,
--                  descricao, credito_usado, itens: [{tipo, descricao, valor, ref_id}]}]
--   Retorna {"inseridas": n, "removidas": m}.
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

    delete from public.cobrancas c
     where c.competencia = p_competencia
       and c.situacao in ('prevista', 'quitada_por_credito')
       and (p_clientes is null or c.cliente_id = any (p_clientes));
    get diagnostics v_removidas = row_count;
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

  return jsonb_build_object('inseridas', v_inseridas, 'removidas', v_removidas);
end;
$$;

revoke all on function public.gravar_competencia(text, boolean, jsonb, uuid[]) from public, anon;
grant execute on function public.gravar_competencia(text, boolean, jsonb, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- editar_cobranca: troca os itens de uma cobrança prevista, recalcula o total e
-- devolve a 'pendente' os extras vinculados que saíram da cobrança.
-- O desconto de indicação precisa continuar igual ao crédito usado registrado.
-- p_itens: [{tipo, descricao, valor, ref_id}]
-- ---------------------------------------------------------------------------
create or replace function public.editar_cobranca(
  p_cobranca_id uuid,
  p_itens jsonb,
  p_descricao text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_situacao text;
  v_total bigint;
  v_desconto bigint;
  v_usado bigint;
begin
  select situacao into v_situacao from public.cobrancas where id = p_cobranca_id for update;
  if not found then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0002';
  end if;
  if v_situacao <> 'prevista' then
    raise exception 'Só é possível editar cobranças previstas.' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_itens, '[]'::jsonb)) = 0 then
    raise exception 'A cobrança precisa ter ao menos um item.' using errcode = '22023';
  end if;

  select coalesce(sum((x->>'valor')::bigint), 0),
         coalesce(sum(case when x->>'tipo' = 'desconto_indicacao' then -(x->>'valor')::bigint else 0 end), 0)
    into v_total, v_desconto
    from jsonb_array_elements(p_itens) x;
  select coalesce(sum(valor), 0) into v_usado
    from public.creditos_movimentos where cobranca_id = p_cobranca_id and tipo = 'usado';
  if v_desconto <> v_usado then
    raise exception 'O desconto de indicação não pode ser alterado na edição.' using errcode = '22023';
  end if;
  if v_total <= 0 then
    raise exception 'O total da cobrança precisa ser maior que zero.' using errcode = '22023';
  end if;

  update public.lancamentos_extras
     set situacao = 'pendente', cobranca_id = null
   where cobranca_id = p_cobranca_id
     and situacao = 'incluido'
     and id not in (
       select (x->>'ref_id')::uuid from jsonb_array_elements(p_itens) x
        where x->>'tipo' = 'extra' and x->>'ref_id' is not null
     );

  delete from public.cobranca_itens where cobranca_id = p_cobranca_id;
  insert into public.cobranca_itens (cobranca_id, tipo, descricao, valor, ref_id)
  select p_cobranca_id, x->>'tipo', x->>'descricao', (x->>'valor')::bigint, (x->>'ref_id')::uuid
    from jsonb_array_elements(p_itens) x;

  update public.cobrancas
     set total = v_total, descricao = coalesce(p_descricao, '')
   where id = p_cobranca_id;
end;
$$;

revoke all on function public.editar_cobranca(uuid, jsonb, text) from public, anon;
grant execute on function public.editar_cobranca(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancelar_cobranca_prevista ("excluir cliente do mês"): cancela com motivo uma
-- cobrança prevista, devolve seus extras a 'pendente' e estorna o crédito usado.
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
  v_cob public.cobrancas%rowtype;
  v_usado bigint;
begin
  if nullif(trim(coalesce(p_motivo, '')), '') is null then
    raise exception 'Informe o motivo.' using errcode = '22023';
  end if;
  select * into v_cob from public.cobrancas where id = p_cobranca_id for update;
  if not found then
    raise exception 'Cobrança não encontrada.' using errcode = 'P0002';
  end if;
  if v_cob.situacao <> 'prevista' then
    raise exception 'Só é possível excluir do mês cobranças previstas.' using errcode = '22023';
  end if;

  update public.cobrancas
     set situacao = 'cancelada', motivo_cancelamento = trim(p_motivo)
   where id = p_cobranca_id;

  update public.lancamentos_extras
     set situacao = 'pendente', cobranca_id = null
   where cobranca_id = p_cobranca_id and situacao = 'incluido';

  select coalesce(sum(valor), 0) into v_usado
    from public.creditos_movimentos where cobranca_id = p_cobranca_id and tipo = 'usado';
  if v_usado > 0 then
    insert into public.creditos_movimentos (cliente_id, tipo, valor, cobranca_id)
    values (v_cob.cliente_id, 'estornado', v_usado, p_cobranca_id);
  end if;
end;
$$;

revoke all on function public.cancelar_cobranca_prevista(uuid, text) from public, anon;
grant execute on function public.cancelar_cobranca_prevista(uuid, text) to authenticated;
