-- 0003_seed_parametros.sql — carga inicial do escritório, carteiras e permissões.

-- Escritório (linha única). CRC em branco para o Victor preencher (spec §6.1).
insert into public.escritorio (
  razao_social, cnpj, logradouro, numero, complemento, bairro, cidade, uf, cep,
  telefone, email, inscricao_municipal, responsavel_tecnico, crc, cidade_foro
) values (
  'D. A. SOARES CONTABILIDADE LTDA.', '01496613000124', 'Rua Cantagalo', '222', '1º andar',
  'Tatuapé', 'São Paulo', 'SP', '03319000',
  '(11) 2227-7480', 'diretoria@dasoares.com.br', '25188348', 'Victor Martins Soares', '',
  'São Paulo'
)
on conflict (unico) do nothing;

-- Carteiras
insert into public.carteiras (nome, saida) values
  ('Cora', 'csv_cora'),
  ('Banco 2', 'lista_manual')
on conflict (nome) do nothing;

-- Permissões por papel
insert into public.permissoes (papel, acao)
select 'administrador', a
from unnest(array[
  'usuarios.gerenciar', 'escritorio.editar', 'clientes.editar',
  'contratos.editar', 'financeiro.operar', 'reajuste.aplicar'
]) as a
union all
select 'colaborador', a
from unnest(array[
  'clientes.editar', 'contratos.editar', 'financeiro.operar', 'reajuste.aplicar'
]) as a
on conflict (papel, acao) do nothing;
