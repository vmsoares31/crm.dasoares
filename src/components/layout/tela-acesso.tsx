import { Logo } from "@/components/logo";

/** Fundo em degradê da marca com cartão centralizado e o logo (login, definir senha, recuperar senha, 403). */
export function TelaAcesso({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-degrade-acesso px-4 py-10">
      <div className="w-full max-w-[400px] space-y-6 rounded-2xl bg-card p-7 text-card-foreground shadow-flutuante sm:p-9">
        <Logo tom="escuro" />
        {children}
      </div>
    </main>
  );
}
