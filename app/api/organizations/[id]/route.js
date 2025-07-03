import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '@/lib/prisma';

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = params;
  const body = await req.json();
  const { name, slug, domain, logo_url, primary_color, secondary_color } = body;

  try {
    // Check if user is owner or admin of the organization
    const membership = await prisma.organizationMembers.findFirst({
      where: {
        organization_id: id,
        user: { email: session.user.email },
        role: { in: ['owner', 'admin'] },
      },
    });

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden - Insufficient permissions' }), { status: 403 });
    }

    // Update organization
    const org = await prisma.organizations.update({
      where: { id },
      data: {
        name,
        slug,
        domain,
        logo_url,
        primary_color,
        secondary_color,
      },
    });

    return new Response(JSON.stringify({ organization: org }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = params;

  try {
    // Check if user is owner of the organization (only owners can delete)
    const membership = await prisma.organizationMembers.findFirst({
      where: {
        organization_id: id,
        user: { email: session.user.email },
        role: 'owner',
      },
    });

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden - Only owners can delete organizations' }), { status: 403 });
    }

    // Delete organization (cascade will handle related records)
    await prisma.organizations.delete({
      where: { id },
    });

    return new Response(JSON.stringify({ message: 'Organization deleted successfully' }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
} 