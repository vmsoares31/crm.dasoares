import { execFile, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** LibreOffice (soffice) não encontrado: o PDF não pode ser gerado neste ambiente. */
export class SofficeIndisponivelError extends Error {
  constructor(detalhe: string) {
    super(`PDF indisponível neste ambiente: ${detalhe}`);
    this.name = "SofficeIndisponivelError";
  }
}

const CANDIDATOS = [
  "soffice",
  "/usr/bin/soffice",
  "/usr/lib/libreoffice/program/soffice",
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
];

let cache: string | null | undefined;

/** Caminho do executável do LibreOffice (env SOFFICE_PATH tem prioridade) ou null. */
export function localizarSoffice(): string | null {
  const env = process.env.SOFFICE_PATH?.trim();
  if (env) return env;
  if (cache !== undefined) return cache;
  cache = null;
  for (const c of CANDIDATOS) {
    if (path.isAbsolute(c) && !existsSync(c)) continue;
    const r = spawnSync(c, ["--version"], { timeout: 20_000, stdio: "ignore", windowsHide: true });
    if (!r.error && r.status === 0) {
      cache = c;
      break;
    }
  }
  return cache;
}

export function sofficeDisponivel(): boolean {
  return localizarSoffice() !== null;
}

/** Converte .docx em PDF com `soffice --headless --convert-to pdf` num diretório temporário. */
export async function converterParaPdf(docx: Buffer): Promise<Buffer> {
  const soffice = localizarSoffice();
  if (!soffice) throw new SofficeIndisponivelError("LibreOffice (soffice) não encontrado. Defina SOFFICE_PATH.");

  const dir = await mkdtemp(path.join(tmpdir(), "contrato-"));
  try {
    const entrada = path.join(dir, "contrato.docx");
    await writeFile(entrada, docx);
    // Perfil próprio evita conflito com outra instância do LibreOffice em execução.
    const perfil = `-env:UserInstallation=file:///${path.join(dir, "perfil").replace(/\\/g, "/").replace(/^\//, "")}`;
    await new Promise<void>((resolve, reject) => {
      execFile(
        soffice,
        [perfil, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, entrada],
        { timeout: 120_000, windowsHide: true },
        (erro, _out, stderr) => {
          if (!erro) return resolve();
          const codigo = (erro as NodeJS.ErrnoException).code;
          if (codigo === "ENOENT") reject(new SofficeIndisponivelError(`executável não encontrado: ${soffice}`));
          else reject(new Error(`Falha ao converter para PDF: ${stderr || erro.message}`));
        },
      );
    });
    const saida = path.join(dir, "contrato.pdf");
    if (!existsSync(saida)) throw new Error("Falha ao converter para PDF: arquivo não gerado.");
    return await readFile(saida);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
