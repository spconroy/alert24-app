import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Find organizations where user is a member
  const user = await prisma.users.findUnique({
    where: { email: session.user.email },
    include: {
      memberships: {
        include: { organization: true },
      },
    },
  });

  if (!user) {
    return new Response(JSON.stringify({ organizations: [] }), { status: 200 });
  }

  const organizations = user.memberships.map(m => m.organization);
  return new Response(JSON.stringify({ organizations }), { status: 200 });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json();
  const { name, slug, domain } = body;
  if (!name || !slug) {
    return new Response(JSON.stringify({ error: 'Name and slug are required' }), { status: 400 });
  }

  try {
    // Find user
    const user = await prisma.users.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    // Create organization and add user as owner
    const org = await prisma.organizations.create({
      data: {
        name,
        slug,
        domain,
        members: {
          create: {
            user_id: user.id,
            role: 'owner',
            status: 'active',
          },
        },
      },
    });
    return new Response(JSON.stringify({ organization: org }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
} 