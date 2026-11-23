import type { ClienteCompleto } from "@/domain/completude";
import type { EscritorioContrato } from "@/domain/contrato-campos";
import type { ParcelaAdicional } from "@/domain/tipos";

export const escritorioFicticio: EscritorioContrato = {
  razao_social: "D. A. SOARES CONTABILIDADE LTDA.",
  cnpj: "11444777000161",
  logradouro: "Rua Exemplo",
  numero: "100",
  complemento: "Sala 2",
  bairro: "Centro",
  cidade: "São Paulo",
  uf: "SP",
  cep: "01001000",
  responsavel_tecnico: "Fulano de Tal",
  crc: "1SP000000/O-0",
  cidade_foro: "São Paulo",
};

export function clienteFicticio(over: Partial<ClienteCompleto> = {}): ClienteCompleto {
  const contrato = {
    id: "k1", cliente_id: "c1", situacao: "fechado", legado: false, honorario: 35000, dia_vencimento: 10,
    data_inicio: "2027-01-01", carteira_id: "w1", tipo_cobranca: "boleto", email_cobranca: null,
    parcela_adicional_total: 35000, encerrado_em: null,
    criado_em: "", criado_por: null, atualizado_em: "", atualizado_por: null,
  };
  return {
    id: "c1", codigo_dominio: null, razao_social: "EMPRESA FICTÍCIA LTDA", nome_fantasia: null,
    documento: "11222333000181", logradouro: "Av. Teste", numero: "50", complemento: null,
    bairro: "Jardim", cidade: "Campinas", uf: "SP", cep: "13000000", telefone: "(19) 99999-0000",
    email: "contato@ficticia.com.br", inscricao_estadual: null, inscricao_municipal: null,
    regime: "lucro_presumido", situacao: "ativo", indicado_por: null, campos_suspeitos: [], observacoes: null,
    criado_em: "", criado_por: null, atualizado_em: "", atualizado_por: null,
    socios: [{
      id: "s1", cliente_id: "c1", nome: "Maria Fictícia", cpf: "52998224725", participacao: 100, administrador: true,
      criado_em: "", criado_por: null, atualizado_em: "", atualizado_por: null,
    }],
    contrato,
    ...over,
  } as ClienteCompleto;
}

export const parcelasFicticias: ParcelaAdicional[] = [{ mes: 12, valor: 35000, forma: "junto_mensalidade", dia: null }];
