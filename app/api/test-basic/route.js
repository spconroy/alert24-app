export async function GET() {
  return new Response('Hello from Cloudflare Edge!', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
