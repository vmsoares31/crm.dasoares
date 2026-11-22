-- 0004_guarda_ultimo_admin.sql — impede remover, rebaixar ou desativar o último administrador ativo.

create or replace function private.tg_guarda_ultimo_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.papel = 'administrador' and old.ativo
     and (tg_op = 'DELETE' or new.papel <> 'administrador' or not new.ativo) then
    if not exists (
      select 1 from public.perfis p
      where p.papel = 'administrador' and p.ativo and p.usuario_id <> old.usuario_id
    ) then
      raise exception 'Não é possível remover, rebaixar ou desativar o último administrador ativo.'
        using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.tg_guarda_ultimo_admin() from public;

create trigger tg_guarda_ultimo_admin
  before update or delete on public.perfis
  for each row execute function private.tg_guarda_ultimo_admin();
