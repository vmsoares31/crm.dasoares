export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          acao: string
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          dados: Json | null
          em: string
          entidade: string
          entidade_id: string | null
          id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          dados?: Json | null
          em?: string
          entidade: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          dados?: Json | null
          em?: string
          entidade?: string
          entidade_id?: string | null
          id?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      carteiras: {
        Row: {
          ativa: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          saida: string
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          saida: string
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          saida?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          bairro: string | null
          campos_suspeitos: string[]
          cep: string | null
          cidade: string | null
          codigo_dominio: number | null
          complemento: string | null
          criado_em: string
          criado_por: string | null
          documento: string | null
          email: string | null
          id: string
          indicado_por: string | null
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          razao_social: string
          regime: string | null
          situacao: string
          telefone: string | null
          uf: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          bairro?: string | null
          campos_suspeitos?: string[]
          cep?: string | null
          cidade?: string | null
          codigo_dominio?: number | null
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          indicado_por?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social: string
          regime?: string | null
          situacao?: string
          telefone?: string | null
          uf?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          bairro?: string | null
          campos_suspeitos?: string[]
          cep?: string | null
          cidade?: string | null
          codigo_dominio?: number | null
          complemento?: string | null
          criado_em?: string
          criado_por?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          indicado_por?: string | null
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          razao_social?: string
          regime?: string | null
          situacao?: string
          telefone?: string | null
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_indicado_por_fkey"
            columns: ["indicado_por"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_itens: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cobranca_id: string
          criado_em: string
          criado_por: string | null
          descricao: string
          id: string
          ref_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cobranca_id: string
          criado_em?: string
          criado_por?: string | null
          descricao: string
          id?: string
          ref_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cobranca_id?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          id?: string
          ref_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_itens_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_itens_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "v_cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          competencia: string
          contrato_id: string
          criado_em: string
          criado_por: string | null
          descricao: string
          emitida_em: string | null
          id: string
          motivo_cancelamento: string | null
          motivo_dispensa: string | null
          origem: string
          pago_em: string | null
          parcela_id: string | null
          saldo_dispensado: boolean
          situacao: string
          total: number
          valor_recebido: number
          vencimento: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          competencia: string
          contrato_id: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          emitida_em?: string | null
          id?: string
          motivo_cancelamento?: string | null
          motivo_dispensa?: string | null
          origem: string
          pago_em?: string | null
          parcela_id?: string | null
          saldo_dispensado?: boolean
          situacao?: string
          total: number
          valor_recebido?: number
          vencimento: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          competencia?: string
          contrato_id?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string
          emitida_em?: string | null
          id?: string
          motivo_cancelamento?: string | null
          motivo_dispensa?: string | null
          origem?: string
          pago_em?: string | null
          parcela_id?: string | null
          saldo_dispensado?: boolean
          situacao?: string
          total?: number
          valor_recebido?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcelas_adicionais"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_documentos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          contrato_id: string
          criado_em: string
          criado_por: string | null
          docx_path: string
          gerado_em: string
          gerado_por: string | null
          id: string
          pdf_path: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          contrato_id: string
          criado_em?: string
          criado_por?: string | null
          docx_path: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          pdf_path?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          contrato_id?: string
          criado_em?: string
          criado_por?: string | null
          docx_path?: string
          gerado_em?: string
          gerado_por?: string | null
          id?: string
          pdf_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          carteira_id: string | null
          cliente_id: string
          criado_em: string
          criado_por: string | null
          data_inicio: string | null
          dia_vencimento: number | null
          email_cobranca: string | null
          encerrado_em: string | null
          honorario: number | null
          id: string
          legado: boolean
          parcela_adicional_total: number
          situacao: string
          tipo_cobranca: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          carteira_id?: string | null
          cliente_id: string
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          dia_vencimento?: number | null
          email_cobranca?: string | null
          encerrado_em?: string | null
          honorario?: number | null
          id?: string
          legado?: boolean
          parcela_adicional_total?: number
          situacao?: string
          tipo_cobranca?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          carteira_id?: string | null
          cliente_id?: string
          criado_em?: string
          criado_por?: string | null
          data_inicio?: string | null
          dia_vencimento?: number | null
          email_cobranca?: string | null
          encerrado_em?: string | null
          honorario?: number | null
          id?: string
          legado?: boolean
          parcela_adicional_total?: number
          situacao?: string
          tipo_cobranca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_carteira_id_fkey"
            columns: ["carteira_id"]
            isOneToOne: false
            referencedRelation: "carteiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      creditos_movimentos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          cobranca_id: string | null
          criado_em: string
          criado_por: string | null
          id: string
          indicacao_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          cobranca_id?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          indicacao_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          cobranca_id?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          indicacao_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "creditos_movimentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_movimentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_movimentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "v_cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_movimentos_indicacao_id_fkey"
            columns: ["indicacao_id"]
            isOneToOne: false
            referencedRelation: "indicacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      escritorio: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          bairro: string
          cep: string
          cidade: string
          cidade_foro: string
          cnpj: string
          complemento: string
          crc: string
          criado_em: string
          criado_por: string | null
          dia_vencimento_padrao: number
          email: string
          id: string
          indicacao_pct: number
          inscricao_municipal: string
          juros_mes_pct: number
          logradouro: string
          modelo_contrato_path: string | null
          multa_pct: number
          nome_cobranca: string
          notificar_em: string
          numero: string
          razao_social: string
          responsavel_tecnico: string
          telefone: string
          uf: string
          unico: boolean
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          bairro?: string
          cep?: string
          cidade?: string
          cidade_foro?: string
          cnpj: string
          complemento?: string
          crc?: string
          criado_em?: string
          criado_por?: string | null
          dia_vencimento_padrao?: number
          email?: string
          id?: string
          indicacao_pct?: number
          inscricao_municipal?: string
          juros_mes_pct?: number
          logradouro?: string
          modelo_contrato_path?: string | null
          multa_pct?: number
          nome_cobranca?: string
          notificar_em?: string
          numero?: string
          razao_social: string
          responsavel_tecnico?: string
          telefone?: string
          uf?: string
          unico?: boolean
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          bairro?: string
          cep?: string
          cidade?: string
          cidade_foro?: string
          cnpj?: string
          complemento?: string
          crc?: string
          criado_em?: string
          criado_por?: string | null
          dia_vencimento_padrao?: number
          email?: string
          id?: string
          indicacao_pct?: number
          inscricao_municipal?: string
          juros_mes_pct?: number
          logradouro?: string
          modelo_contrato_path?: string | null
          multa_pct?: number
          nome_cobranca?: string
          notificar_em?: string
          numero?: string
          razao_social?: string
          responsavel_tecnico?: string
          telefone?: string
          uf?: string
          unico?: boolean
        }
        Relationships: []
      }
      historico_valores: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          campo: string
          contrato_id: string
          criado_em: string
          criado_por: string | null
          de: number | null
          id: string
          motivo: string | null
          para: number | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          campo: string
          contrato_id: string
          criado_em?: string
          criado_por?: string | null
          de?: number | null
          id?: string
          motivo?: string | null
          para?: number | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          campo?: string
          contrato_id?: string
          criado_em?: string
          criado_por?: string | null
          de?: number | null
          id?: string
          motivo?: string | null
          para?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_valores_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      indicacoes: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          id: string
          indicado_id: string
          indicador_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          indicado_id: string
          indicador_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          indicado_id?: string
          indicador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_indicado_id_fkey"
            columns: ["indicado_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_extras: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          cobranca_id: string | null
          competencia: string
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string
          id: string
          observacao: string | null
          servico_id: string | null
          situacao: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          cobranca_id?: string | null
          competencia: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao: string
          id?: string
          observacao?: string | null
          servico_id?: string | null
          situacao?: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          cobranca_id?: string | null
          competencia?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string
          id?: string
          observacao?: string | null
          servico_id?: string | null
          situacao?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_extras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_extras_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_extras_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "v_cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_extras_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_extras"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          cobranca_id: string
          criado_em: string
          criado_por: string | null
          data: string
          id: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          cobranca_id: string
          criado_em?: string
          criado_por?: string | null
          data: string
          id?: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          cobranca_id?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "v_cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_adicionais: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          contrato_id: string
          criado_em: string
          criado_por: string | null
          dia: number | null
          forma: string
          id: string
          mes: number
          valor: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          contrato_id: string
          criado_em?: string
          criado_por?: string | null
          dia?: number | null
          forma?: string
          id?: string
          mes: number
          valor: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          contrato_id?: string
          criado_em?: string
          criado_por?: string | null
          dia?: number | null
          forma?: string
          id?: string
          mes?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_adicionais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          papel: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          papel: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          papel?: string
          usuario_id?: string
        }
        Relationships: []
      }
      permissoes: {
        Row: {
          acao: string
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          id: string
          papel: string
        }
        Insert: {
          acao: string
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          papel: string
        }
        Update: {
          acao?: string
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          papel?: string
        }
        Relationships: []
      }
      servicos_extras: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          valor: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          valor?: number
        }
        Relationships: []
      }
      socios: {
        Row: {
          administrador: boolean
          atualizado_em: string
          atualizado_por: string | null
          cliente_id: string
          cpf: string | null
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          participacao: number | null
        }
        Insert: {
          administrador?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id: string
          cpf?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          participacao?: number | null
        }
        Update: {
          administrador?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_id?: string
          cpf?: string | null
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          participacao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "socios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_cobrancas: {
        Row: {
          atrasada: boolean | null
          atualizado_em: string | null
          atualizado_por: string | null
          cliente_id: string | null
          competencia: string | null
          contrato_id: string | null
          criado_em: string | null
          criado_por: string | null
          descricao: string | null
          emitida_em: string | null
          id: string | null
          motivo_cancelamento: string | null
          origem: string | null
          pago_em: string | null
          parcela_id: string | null
          saldo_aberto: number | null
          saldo_dispensado: boolean | null
          situacao: string | null
          total: number | null
          valor_recebido: number | null
          vencimento: string | null
        }
        Insert: {
          atrasada?: never
          atualizado_em?: string | null
          atualizado_por?: string | null
          cliente_id?: string | null
          competencia?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          emitida_em?: string | null
          id?: string | null
          motivo_cancelamento?: string | null
          origem?: string | null
          pago_em?: string | null
          parcela_id?: string | null
          saldo_aberto?: never
          saldo_dispensado?: boolean | null
          situacao?: string | null
          total?: number | null
          valor_recebido?: number | null
          vencimento?: string | null
        }
        Update: {
          atrasada?: never
          atualizado_em?: string | null
          atualizado_por?: string | null
          cliente_id?: string | null
          competencia?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          emitida_em?: string | null
          id?: string | null
          motivo_cancelamento?: string | null
          origem?: string | null
          pago_em?: string | null
          parcela_id?: string | null
          saldo_aberto?: never
          saldo_dispensado?: boolean | null
          situacao?: string | null
          total?: number | null
          valor_recebido?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_parcela_id_fkey"
            columns: ["parcela_id"]
            isOneToOne: false
            referencedRelation: "parcelas_adicionais"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancelar_cobranca: {
        Args: { p_cobranca_id: string; p_motivo: string }
        Returns: Json
      }
      cancelar_cobranca_prevista: {
        Args: { p_cobranca_id: string; p_motivo: string }
        Returns: undefined
      }
      dispensar_saldo: {
        Args: { p_cobranca_id: string; p_motivo: string }
        Returns: undefined
      }
      editar_cobranca: {
        Args: { p_cobranca_id: string; p_descricao: string; p_itens: Json }
        Returns: undefined
      }
      gravar_competencia: {
        Args: {
          p_clientes?: string[]
          p_cobrancas: Json
          p_competencia: string
          p_regerar: boolean
        }
        Returns: Json
      }
      registrar_baixa: {
        Args: { p_cobranca_id: string; p_data: string; p_valor: number }
        Returns: Json
      }
      salvar_contrato: {
        Args: {
          p_campos: Json
          p_contrato_id: string
          p_motivo: string
          p_parcelas: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
