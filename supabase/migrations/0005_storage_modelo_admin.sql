-- 0005_storage_modelo_admin.sql — objetos em contratos/modelo/ só podem ser
-- gravados (insert/update/delete) por administrador; demais prefixos mantêm
-- as políticas de usuário ativo (0002).

drop policy if exists contratos_insert on storage.objects;
drop policy if exists contratos_update on storage.objects;
drop policy if exists contratos_delete on storage.objects;

create policy contratos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'contratos'
    and (select private.usuario_ativo())
    and (name not like 'modelo/%' or (select private.tem_papel('administrador')))
  );

create policy contratos_update on storage.objects for update to authenticated
  using (
    bucket_id = 'contratos'
    and (select private.usuario_ativo())
    and (name not like 'modelo/%' or (select private.tem_papel('administrador')))
  )
  with check (
    bucket_id = 'contratos'
    and (select private.usuario_ativo())
    and (name not like 'modelo/%' or (select private.tem_papel('administrador')))
  );

create policy contratos_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'contratos'
    and (select private.usuario_ativo())
    and (name not like 'modelo/%' or (select private.tem_papel('administrador')))
  );
