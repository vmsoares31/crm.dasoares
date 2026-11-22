import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3">
      <h1 className="text-2xl font-semibold">Acesso negado (403)</h1>
      <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
      <Link href="/inicio" className="underline">Voltar ao início</Link>
    </main>
  );
}
