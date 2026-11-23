-- 0006_salvar_contrato.sql — grava contrato, parcelas e histórico de valores numa única transação.
-- SECURITY INVOKER: as políticas RLS do chamador continuam valendo.
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
begin
  select * into v_atual from public.contratos where id = p_contrato_id for update;
  if not found then
    raise exception 'Contrato não encontrado.' using errcode = 'P0002';
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

  delete from public.parcelas_adicionais where contrato_id = p_contrato_id;
  insert into public.parcelas_adicionais (contrato_id, mes, valor, forma, dia)
  select p_contrato_id, (x->>'mes')::int, (x->>'valor')::bigint, x->>'forma', (x->>'dia')::int
  from jsonb_array_elements(coalesce(p_parcelas, '[]'::jsonb)) x;

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
