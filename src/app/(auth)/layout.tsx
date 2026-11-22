import { TelaAcesso } from "@/components/layout/tela-acesso";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <TelaAcesso>{children}</TelaAcesso>;
}
