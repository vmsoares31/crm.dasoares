# Publicação do CRM no Easypanel

Guia passo a passo para colocar o CRM no ar em **https://crm.dasoares.com.br**.
Nunca cole senhas ou chaves reais neste arquivo: use os valores do painel do Supabase na hora de preencher o Easypanel.

## 1. Valores que você vai precisar (Supabase de produção)

No painel do Supabase, projeto de produção, menu **Project Settings > API**:

| Nome | Onde achar | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://<ref>.supabase.co`) | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave `anon` / publishable | Pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` | **Secreta.** Só vai no ambiente do servidor; nunca em Build Args |

O `<ref>` é o código do projeto (a parte antes de `.supabase.co`).

## 2. Banco de dados de produção

1. Aplique as migrações **na ordem**, de `0001` a `0011`, na pasta `supabase/migrations/`
   (`0001_schema`, `0002_rls`, `0003_seed_parametros`, `0004_guarda_ultimo_admin`, `0005_storage_modelo_admin`,
   `0006_salvar_contrato`, `0007_competencia`, `0008_baixa`, `0009_indicacoes`, `0010_baixar_indicacao`,
   `0011_correcoes_finais`). No painel: **SQL Editor**, cole o conteúdo de cada arquivo e execute, um por vez.
   Ou, pela linha de comando: `supabase link --project-ref <ref>` e `supabase db push`.
2. Se alguma migração der erro, pare e avise: não pule nenhuma.

## 3. Supabase Auth (produção)

Em **Authentication**:

- **URL Configuration > Site URL**: `https://crm.dasoares.com.br`
- **URL Configuration > Redirect URLs**: adicione
  `https://crm.dasoares.com.br/auth/callback` e `https://crm.dasoares.com.br/definir-senha`
- **Sign In / Providers > Email**: desative **"Allow new users to sign up"** (cadastro público desligado:
  só administradores criam usuários).

## 4. Criar o serviço no Easypanel

1. No Easypanel, abra o projeto e clique em **+ Serviço > App**. Nome sugerido: `crm`.
2. **Fonte (Source) > GitHub**: repositório `vmsoares31/crm.dasoares`, branch `main`.
   (Se o repositório for privado, conecte a conta GitHub ao Easypanel quando ele pedir.)
3. **Build**: tipo **Dockerfile**, arquivo `Dockerfile` (raiz do repositório).
4. **Build Args** (aba Build; valores usados na construção da imagem; o build falha com mensagem clara se faltar algum dos dois primeiros):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon>
   NEXT_PUBLIC_SITE_URL=https://crm.dasoares.com.br
   ```
5. **Ambiente (Environment)**, valores usados com o sistema rodando:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon>
   SUPABASE_SERVICE_ROLE_KEY=<chave service_role>
   NEXT_PUBLIC_SITE_URL=https://crm.dasoares.com.br
   TZ=America/Sao_Paulo
   ```
6. **Domínios e porta**: adicione o domínio `crm.dasoares.com.br`, **porta do contêiner `3000`**, e ligue o **HTTPS**
   (certificado automático). O servidor já escuta em `0.0.0.0:3000`.
7. Clique em **Implantar (Deploy)**. O primeiro build demora alguns minutos.

> Se alterar qualquer `NEXT_PUBLIC_*`, é preciso **reconstruir** (novo deploy), não basta reiniciar.

## 5. DNS

No provedor do domínio `dasoares.com.br`, crie um registro:

- Tipo **A**, nome **crm**, valor **IP do servidor (VPS) do Easypanel**.

Aguarde a propagação (de minutos a algumas horas). O HTTPS só é emitido depois que o DNS aponta para o servidor.

## 6. Primeiro administrador

No seu computador, na pasta do projeto, com um arquivo `.env.local` apontando para o Supabase **de produção**
(`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`):

```
npx tsx scripts/criar-admin.ts seu-email@dasoares.com.br "Seu Nome"
```

O Supabase envia um convite por e-mail; abra o link, defina a senha (`/definir-senha`) e entre.
(Alternativa: acrescentar `--senha <senha com 8+ caracteres>` para criar já com senha.)
Depois, apague o `.env.local` de produção ou volte-o para o de desenvolvimento.

## 7. Importar os clientes do Domínio

Com o relatório "Empresas – Dados Cadastrais" convertido em texto (`pdftotext -layout -enc UTF-8`):

```
npx tsx scripts/importar-dominio.ts relatorio.txt --projeto <ref> --dry     # simulação, nada é gravado
npx tsx scripts/importar-dominio.ts relatorio.txt --projeto <ref>           # importação real
```

O `--projeto <ref>` é uma trava de segurança: o script recusa rodar se o `.env.local` apontar para outro projeto.
Os clientes entram como "a revisar"; nada importado é confirmado automaticamente.

## 8. Checklist de entrada no ar

- [ ] `https://crm.dasoares.com.br/api/saude` responde `{"ok":true}`.
- [ ] Login com o administrador funciona (e o link de "Esqueci minha senha" volta para o domínio correto).
- [ ] Cadastro público desligado no Supabase (tentar criar conta deve falhar).
- [ ] **Escritório**: preencher o **CRC** (e demais dados do escritório).
- [ ] **Cliente "Inativa"**: conferir o cliente importado com situação "Inativa" no Domínio **antes** de confirmar os clientes; decidir se entra ou não.
- [ ] Revisar e confirmar os clientes importados (um a um ou em massa).
- [ ] **Contrato de teste**: gerar um contrato e abrir o PDF para validar o LibreOffice, as fontes e o modelo no servidor.
- [ ] **CSV Cora**: abrir um mês, baixar o CSV e fazer o **teste de upload** no Cora (confirmar que o arquivo é aceito; lembre do valor mínimo de R$ 20).
- [ ] Marcar uma cobrança como emitida, dar baixa e conferir o painel (Recebido).
- [ ] Remover/cancelar qualquer dado de teste criado nas etapas acima.
- [ ] Fazer um backup do banco (Supabase > Database > Backups) antes de começar a usar de verdade.

## 9. Teste de fumaça (opcional, só em desenvolvimento)

`npm run test:e2e` roda o fluxo principal (login, cobrança, CSV, emitida, baixa, painel) em um ambiente já ligado.
Variáveis: `BASE_URL`, `E2E_EMAIL`, `E2E_SENHA` e `E2E_COMPETENCIA` (padrão `2099-12`). Sem `E2E_EMAIL` o teste é ignorado.
**Nunca use contra a produção**: ele abre um mês e dá baixa em uma cobrança.
