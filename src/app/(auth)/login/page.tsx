import { FormularioLogin } from "./formulario-login";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return <FormularioLogin erroLink={erro === "link"} />;
}
