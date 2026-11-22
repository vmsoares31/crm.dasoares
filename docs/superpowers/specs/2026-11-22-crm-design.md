# CRM D.A. Soares — Design

Data: 22/11/2026 · Responsável: Victor Martins Soares (D.A. Soares Contabilidade)

## 1. Intenção e o porquê

O escritório controla hoje clientes, contratos e financeiro em uma planilha Excel e emite boletos em lote no banco Cora a partir de uma planilha modelo. A partir de janeiro/2027 todas as carteiras da PICONT migram para a D.A. Soares, haverá dois bancos (cada cliente numa carteira) e o escritório quer lançar um programa de indicação. O Excel não sustenta isso.

O CRM é um sistema web interno, com login, onde o escritório:

1. mantém o cadastro dos clientes ativos e dos contratos;
2. lança serviços extras;
3. faz o fechamento financeiro mensal (gera as cobranças, exporta para o banco, marca como emitida, dá baixa manual, controla inadimplência);
4. controla as indicações e aplica o benefício automaticamente;
5. gera o contrato padrão já preenchido quando um cliente novo fecha.

Usuários: equipe interna do escritório. Cliente final não acessa.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Substituir a planilha Excel do financeiro como fonte da verdade de contratos, cobranças e recebimentos.
- Fechamento mensal em poucos cliques: gerar → revisar → exportar CSV do Cora → marcar emitidas.
- Contrato gerado sem digitação manual, com os dados do escritório vindos do cadastro (não fixos).
- Visão mensal do financeiro e da inadimplência num painel.

**Não-objetivos (fora desta versão)**
- Emitir boletos via API do banco ou receber retorno/conciliação automática (a baixa é manual; importação de extrato pode vir depois).
- Portal ou acesso do cliente.
- Integração com Acessórias, Nibo, Domínio ou Jettax (o Nibo continua para envio de documentos e recebimento).
- Emissão de nota fiscal de serviço.
- Processamento de cartão (cartão é só um tipo de cobrança registrado; a emissão é manual).

**Anti-objetivos (seria fracasso mesmo funcionando)**
- O fechamento do mês ficar mais lento ou trabalhoso que o Excel atual.
- O CSV gerado ser rejeitado pelo Cora ou exigir correção manual antes do upload.
- Contrato sair com dados errados ou da PICONT.
- Desconto de indicação concedido por cliente indicado que nunca pagou.

## 3. Restrições

- **Stack decidida:** Next.js (interface e servidor) + Supabase (Postgres, Auth, Storage) na região **São Paulo (sa-east-1)**; publicação via **Easypanel** (container Docker numa VPS). Não usar Vercel.
- Interface inteira em português do Brasil; moeda R$; datas dd/mm/aaaa; fuso America/Sao_Paulo.
- Dados pessoais de clientes e sócios (CPF) → LGPD: acesso só autenticado, dados no Brasil.
- Layout do arquivo do Cora é fixo (ver §6.8).
- Sem cadastro público: só um administrador cria usuários.
- **Prazo:** o primeiro mês fechado no CRM é **janeiro/2027** (competência 01/2027). Todo o escopo deste documento entra nessa versão.
- **Corte limpo em 01/2027:** nenhum histórico financeiro é importado (sem cobranças antigas, pagamentos ou inadimplência anterior). Indicações anteriores não geram crédito; só valem indicações registradas no CRM.

## 4. Abordagens consideradas

| Abordagem | Prós | Contras |
|---|---|---|
| **1. Web na nuvem: Next.js + Supabase** (escolhida) | Acesso de qualquer lugar com login; perfis; backup do Supabase; toda regra de negócio no sistema | Depende de internet e de serviços externos |
| 2. Sistema local (Django + banco no PC do escritório) | Dados não saem do escritório; sem mensalidade | Só na rede local; backup/segurança por conta do escritório; ponto único de falha |
| 3. Sem código (Sheets+AppSheet / Excel+Power Apps) | Mais rápido de montar | Regras (indicação com saldo, parcela adicional variável, reajuste com arredondamento, contrato preenchido, perfis) ficam frágeis; contraria a saída do Excel |

**Escolhida: 1**, com a variação pedida pelo Victor de hospedar a aplicação no **Easypanel** em vez da Vercel.

## 5. Perfis de acesso

- Estrutura de permissões pronta para vários perfis; começam dois:
  - **Administrador:** tudo, inclusive gerenciar usuários e o cadastro do escritório.
  - **Colaborador:** tudo do CRM e financeiro, exceto gerenciar usuários.
- Hoje sem restrição ao financeiro. Restringir no futuro deve ser configuração (permissões por perfil), não reconstrução.
- Login por e-mail e senha; recuperação de senha por e-mail.
- Registro de quem criou/alterou cada registro e um histórico das ações financeiras (fechar mês, emitir, dar baixa, cancelar, reajustar).

## 6. Funcionalidades

### 6.1 Cadastro do escritório (área do Administrador)

- Dados da CONTRATADA usados no contrato: razão social, CNPJ, endereço (logradouro, número, complemento, bairro, cidade, UF, CEP), telefone, e-mail, inscrição municipal, responsável técnico, CRC, cidade do foro.
- Carga inicial com a D.A. Soares (do relatório do Domínio): D. A. SOARES CONTABILIDADE LTDA, CNPJ 01.496.613/0001-24, Rua Cantagalo, 222, 1º andar, Tatuapé, São Paulo/SP, CEP 03319-000, (11) 2227-7480, diretoria@dasoares.com.br, IM 25188348, responsável Victor Martins Soares. **CRC fica em branco** para o Victor preencher.
- Parâmetros financeiros padrão: multa 2%, juros 1% a.m., nome da cobrança "Serviços contábeis", dia de vencimento padrão 20, percentual do benefício de indicação 50%, lembretes do Cora (`notificar_em`) padrão vazio.
- **Carteiras/bancos:** cadastro de carteiras com nome e forma de saída: `CSV Cora` ou `Lista manual`. Começa com "Cora" (CSV) e o segundo banco (lista manual; nome a cadastrar).
- **Tabela de serviços extras:** nome e valor (ex.: "Recálculo de guia — R$ 50,00"). Ativar/desativar.
- **Modelo de contrato:** o modelo `.docx` com campos fica guardado aqui e pode ser substituído pelo Administrador.

### 6.2 Clientes

- Situações: **A revisar** (importado ou recém-criado, dados não conferidos) → **Definitivo/Ativo** → **Inativo** (contrato encerrado). Contrato só pode ser gerado de cliente Definitivo.
- Campos: razão social, nome fantasia, CNPJ ou CPF, endereço completo, telefone, e-mail (de cobrança), inscrições estadual/municipal, **regime tributário** (MEI, Simples Nacional, Lucro Presumido, Lucro Real), código no Domínio, observações.
- **Sócios:** nome, CPF, participação; um marcado como **sócio administrador** (vai para o contrato).
- **Indicado por:** outro cliente (opcional).
- Painel de pendências: "X clientes a revisar", "X com cadastro incompleto" (sem honorário, vencimento, regime, carteira, tipo de cobrança ou sócio administrador).
- Busca e filtros por nome, CNPJ, regime, carteira, situação.

### 6.3 Contratos

- Um contrato ativo por cliente; histórico mantido (reajustes e versões anteriores).
- Campos: honorário mensal, dia de vencimento, data de início, carteira (banco), tipo de cobrança (`boleto`, `boleto_pix`, `pix`, `cartão`), e-mail de cobrança (padrão: do cliente).
- **Parcela adicional (cláusula 4.7):** valor livre por contrato (pode ser igual à mensalidade ou outro) e lista de parcelas, cada uma com **mês, valor e forma de vencimento**:
  - **Junto com a mensalidade** (padrão): vira um item do boleto da mensalidade daquele mês.
  - **Data própria** (ex.: último dia de novembro): vira uma cobrança separada com essa data.
  - Caso mais comum: parcela única junto com a mensalidade de dezembro. Exceções: 2x, com uma parcela no último dia de novembro (data própria) ou junto com a mensalidade de novembro, e outra junto com a mensalidade de dezembro (dia 20).
  - Atalhos na tela: "Única em dezembro", "2x novembro (último dia) + dezembro", "2x junto das mensalidades de novembro e dezembro". Tudo editável.
- Situações: **Em negociação** → **Fechado** → **Encerrado** (data de encerramento).
- **Geração do contrato:** quando o cliente está Definitivo e o contrato Fechado, botão "Gerar contrato" preenche o modelo e salva **.docx e PDF** no cliente (versões guardadas no Storage, com data e quem gerou).
  - Campos do modelo (a partir do contrato atual): dados do CONTRATANTE (razão social, CNPJ, endereço, bairro, cidade, UF, CEP, e-mail, telefone, sócio administrador e CPF), dados da CONTRATADA (do cadastro do escritório, incluindo responsável técnico e CRC), honorário em número **e por extenso**, dia de vencimento, valor da parcela adicional e forma de pagamento dela, **regime tributário** (cláusula 3.4 hoje cita fixo "Simples Nacional"), data de início da vigência, cidade e data por extenso, nomes nas assinaturas.
  - O texto-base é o contrato `Contrato_ANDREWS_BORGES.docx` (pasta `Claude`), trocando os dados da PICONT e do cliente por campos.
  - Ajustes de texto autorizados pelo Victor:
    - **Cláusula 4.7** sai conforme as parcelas cadastradas (ex.: "em duas parcelas, com vencimento em 20/11 e 20/12, de R$ X cada"; ou parcela única em dezembro).
    - **Cláusula 3.4** cita o regime tributário do cadastro em vez de "Simples Nacional" fixo.
    - **Anexo 1** continua uma lista única (já cobre os regimes, ex.: Lalur "quando lucro real").
    - **Cláusula 6 (sócios fiadores) fica exatamente como está.**
- **Clientes já existentes:** não recebem contrato novo pelo CRM. O Victor fará um **termo aditivo** à parte, fora do sistema, falando da mudança para a D.A. Soares e de cláusulas da reforma tributária. No CRM eles entram com contrato **Fechado** marcado como "contrato anterior (sem documento no CRM)", e não aparecem no alerta "contratos fechados sem documento". Gerar o aditivo pelo sistema não faz parte desta versão.

### 6.4 Serviços extras

- Lançamento: cliente, serviço (da tabela), valor (vem da tabela, editável no lançamento), data, mês em que será cobrado (padrão: o mês aberto), observação.
- Situação: **Pendente** → **Incluído na cobrança** (vinculado à cobrança do mês) → pode ser **cancelado** enquanto pendente.
- Entra **no mesmo boleto da mensalidade**, como item da cobrança.

### 6.5 Indicação

- Registro: cliente indicador → cliente indicado.
- Benefício: **50% da mensalidade fechada do indicado** (percentual configurável no escritório). Ex.: indicado fechou em R$ 300,00 → crédito de R$ 150,00 para o indicador.
- **Liberação:** o crédito só passa a valer quando a **primeira cobrança do indicado é baixada como paga**.
- **Aplicação:** uma única vez, como item negativo ("Desconto indicação −R$ 150,00") na próxima cobrança do indicador gerada após a liberação. Se o crédito for maior que a cobrança, a sobra fica como saldo para o mês seguinte.
- Extrato de créditos por cliente (gerado, liberado, usado, saldo) e lista de indicações no painel.

### 6.6 Fechamento mensal (competência)

1. **Abrir o mês:** o sistema gera, para cada cliente Ativo com contrato Fechado, uma cobrança prevista com itens:
   - mensalidade;
   - extras pendentes daquele mês;
   - parcela adicional do mês, quando configurada "junto com a mensalidade";
   - desconto de indicação disponível (com saldo).
   - Parcela adicional com **data própria** é gerada como **cobrança separada** com essa data.
2. **Revisar:** lista editável — ajustar valor/itens, excluir cliente do mês, incluir extra de última hora.
3. **Vencimento:** competência = mês do vencimento (mensalidade paga "até o dia 20 do mês vigente aos serviços"). Vencimento = dia do contrato dentro do mês da competência. Se, na exportação, a data já tiver passado, o sistema avisa e sugere uma nova data (editável, individual ou em lote) — nunca exporta data vencida.
4. **Descrição** da cobrança gerada a partir dos itens, ex.: "Mensalidade R$ 220,00 + Recálculo de guia R$ 50,00 − Desconto indicação R$ 150,00".
5. **Exportar:** o usuário **seleciona clientes** (filtros por carteira, tipo de cobrança, situação) e:
   - carteira Cora com `boleto`/`boleto_pix`/`pix` → **CSV no layout do Cora** (§6.8);
   - demais (segundo banco, cartão) → **lista de conferência** (tela imprimível e Excel) com os mesmos campos, para emissão um a um.
6. **Marcar como emitida:** individual ou em lote (ex.: todos os exportados).
7. Mês reaberto/regerado não pode duplicar cobranças nem itens já faturados.

### 6.7 Cobranças, baixa e inadimplência

- Situações: **Prevista → Emitida → Paga**; **Atrasada** automaticamente quando passa do vencimento sem baixa; **Cancelada** (com motivo) a qualquer momento antes de paga.
- **Baixa manual:** data do pagamento e valor recebido (padrão: valor da cobrança). Valor maior (multa/juros) → Paga, diferença registrada como acréscimo. Valor menor → **Paga parcialmente**: o saldo restante continua em aberto/atrasado até nova baixa ou até o usuário dispensar o saldo (com motivo).
- Pagamento **integral** da primeira cobrança de um cliente indicado dispara a liberação do crédito do indicador (§6.5).
- **Inadimplência:** lista de cobranças atrasadas com dias de atraso e valor atualizado (multa 2% + juros 1% a.m. pró-rata dia), total devido por cliente.
- Estrutura preparada para, no futuro, importar extrato do Cora e baixar em lote.

### 6.8 Arquivo do Cora (CSV)

Colunas, nesta ordem (do `template-emissao-lote.xlsx`, aba "Cobranças", exportada como .csv para upload no Cora Web):

`nome_do_pagador, cpf_cnpj, valor, vencimento, nome_cobranca, descricao, tipo_cobranca, email, notificar_em, multa, juros_mensal, desconto, desconto_valido_ate`

Regras das instruções do modelo:
- Obrigatórios: nome_do_pagador, cpf_cnpj, nome_cobranca, valor, vencimento, tipo_cobranca.
- valor em reais com vírgula (1250,00); mínimo R$ 20,00.
- vencimento dd/mm/aaaa, hoje ou futuro (sistema avisa e bloqueia vencidos).
- tipo_cobranca: `boleto`, `boleto_pix` ou `pix`.
- multa "2%"; juros_mensal "1%".
- `desconto`/`desconto_valido_ate` são desconto de pontualidade do Cora — **não** usados para indicação (indicação reduz o valor).
- notificar_em: padrão do escritório (vazio = não notificar).

Valor mínimo: se o desconto de indicação zerar a cobrança, ela fica "quitada por crédito" e não é exportada; se deixaria o valor entre R$ 0,01 e R$ 19,99, aplica-se só o desconto que mantém R$ 20,00 e o restante vira saldo.

### 6.9 Reajuste anual (janeiro)

- **Honorários e parcela adicional:** o usuário informa o percentual; o sistema mostra o novo valor de cada contrato, permite ajustar e confirma (individual ou em lote). Histórico guardado.
- **Tabela de serviços extras:** percentual único para todos, **arredondado para cima ao real inteiro** (R$ 52,37 → R$ 53,00).

### 6.10 Painéis

- **Início (CRM):** clientes ativos, cadastros a revisar/incompletos, contratos fechados sem documento gerado, indicações com crédito pendente.
- **Financeiro mensal** (seletor de mês): total previsto, emitido, recebido, em aberto, atrasado; quebra por carteira; total de extras e de descontos de indicação; parcelas adicionais do mês; cobranças ainda não emitidas; inadimplência acumulada.

## 7. Carga inicial de dados

- Fonte: `CRM/Empresas CRM.pdf` — relatório "Empresas – Dados Cadastrais" do Domínio, 141 páginas, uma empresa por página (D.A. Soares + 140 clientes; 133 "Ativa", 1 "Inativa", 7 ilegíveis).
- Página da D.A. Soares → cadastro do escritório. Demais → clientes **A revisar**, com sócios (CPF, participação, ignorando os com data de saída).
- **Atenção:** no PDF, rótulos e valores estão desalinhados em várias páginas (ex.: QUARTTO STAY tem um CNPJ no campo e-mail). O importador deve validar CNPJ/CPF, e-mail e CEP e marcar campos suspeitos para revisão em vez de importar lixo como dado certo. Inativos não entram como ativos.
- Os clientes da PICONT (ex.: Renato Gonçalves, Larissa Delmanto, S1S, Andrews Borges, Now Vet, Live in Motion) **estão no PDF** — conferido.
- Honorário, vencimento, regime, carteira, tipo de cobrança e sócio administrador **não existem na fonte**: ficam pendentes e o Victor preenche manualmente depois. Para isso, uma **tela de edição em massa** (tabela editável, uma linha por cliente) em vez de abrir cliente a cliente.

## 8. Publicação

- Código num repositório git; imagem Docker do Next.js (build standalone) publicada pelo Easypanel numa VPS, com domínio e HTTPS pelo Easypanel.
- Supabase gerenciado (nuvem), projeto novo em sa-east-1; chaves via variáveis de ambiente no Easypanel.
- A geração de PDF do contrato roda no servidor (ex.: LibreOffice headless dentro da imagem Docker) — escolha técnica do construtor.

## 9. Decisões tomadas por mim (Claude) — para o Victor conferir

- (Decidido pelo Victor) Parcela adicional vai **junto com a mensalidade** por padrão; só parcela com data própria (ex.: último dia de novembro) sai como cobrança separada. Extras e desconto também vão no boleto da mensalidade.
- Arredondamento dos extras para o **real inteiro acima**.
- Regra do valor mínimo de R$ 20,00 do Cora com desconto de indicação (§6.8).
- Cartão sempre vai para a lista manual.
- Baixa com valor diferente do original é aceita e a diferença registrada.
- Situações do cliente (A revisar / Ativo / Inativo) e do contrato (Em negociação / Fechado / Encerrado).
- Pagamento menor que a cobrança → "Paga parcialmente", saldo continua em aberto; crédito de indicação só libera com pagamento integral.
- Competência = mês do vencimento; data vencida na exportação → sistema sugere nova data.
- Anexo 1 do contrato continua lista única para todos os regimes.
- Tela de edição em massa para completar honorário, vencimento, regime, carteira etc. dos clientes importados.

## 10. Deixado para o construtor

- Modelagem exata das tabelas, políticas RLS, estrutura de pastas, bibliotecas de UI e de geração de .docx/PDF.
- Desenho visual das telas, seguindo os fluxos acima.
- Detalhes do parser do PDF do Domínio.
- Codificação/separador exato do CSV do Cora (validar com upload de teste).
