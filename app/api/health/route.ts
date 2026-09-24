export const dynamic = 'force-dynamic';

/** Health check (docs/projeto/09-operacao-e-deploy.md). Não expõe versão nem ambiente. */
export function GET(): Response {
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
