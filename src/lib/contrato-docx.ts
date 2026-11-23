import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

import type { CamposContrato } from "@/domain/contrato-campos";

export class ModeloContratoInvalidoError extends Error {
  constructor(detalhe: string) {
    super(`Modelo de contrato inválido: ${detalhe}`);
    this.name = "ModeloContratoInvalidoError";
  }
}

type ErroDocx = { properties?: { errors?: { properties?: { explanation?: string } }[]; explanation?: string } };

function explicar(e: unknown): string {
  const p = (e as ErroDocx).properties;
  const lista = p?.errors?.map((x) => x.properties?.explanation).filter(Boolean) ?? [];
  if (lista.length > 0) return lista.join("; ");
  return p?.explanation ?? (e instanceof Error ? e.message : String(e));
}

/** Preenche as tags {campo} do modelo .docx. Tag ausente nos campos é erro (não sai em branco). */
export function renderizarContrato(modelo: Buffer, campos: CamposContrato): Buffer {
  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(new PizZip(modelo), {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: (parte) => {
        if (!parte.module) throw new Error(`campo desconhecido no modelo: {${parte.value}}`);
        return "";
      },
    });
    doc.render(campos);
  } catch (e) {
    throw new ModeloContratoInvalidoError(explicar(e));
  }
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}
