export const runtime = 'edge';

export async function GET() {
  return Response.json({
    message: 'Edge runtime working',
    timestamp: new Date().toISOString(),
    runtime: 'edge',
  });
}
