// No runtime specification - let Cloudflare decide

export async function GET() {
  return Response.json({
    message: 'Vanilla endpoint working',
    timestamp: new Date().toISOString(),
    runtime: 'auto',
  });
}
