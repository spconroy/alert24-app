// lib/seed.js
// Run with: node lib/seed.js
// Seeds the database with default data for Alert24

import prisma from './prisma.js';

async function main() {
  // Create default subscription plans
  await prisma.subscriptionPlans.createMany({
    data: [
      {
        name: 'Starter',
        slug: 'starter',
        description: 'Basic plan for small teams',
        price_monthly: 0,
        price_yearly: 0,
        features: { features: ['Up to 5 members', 'Basic support'] },
        max_members: 5,
        max_projects: 2,
        active: true,
      },
      {
        name: 'Pro',
        slug: 'pro',
        description: 'Pro plan for growing teams',
        price_monthly: 49,
        price_yearly: 499,
        features: { features: ['Up to 25 members', 'Priority support', 'Custom branding'] },
        max_members: 25,
        max_projects: 10,
        active: true,
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'Enterprise plan for large organizations',
        price_monthly: 199,
        price_yearly: 1999,
        features: { features: ['Unlimited members', 'Dedicated support', 'White-label'] },
        max_members: 9999,
        max_projects: 9999,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  // Create a test organization and user
  const user = await prisma.users.upsert({
    where: { email: 'test@alert24.com' },
    update: {},
    create: {
      email: 'test@alert24.com',
      name: 'Test User',
    },
  });

  const org = await prisma.organizations.upsert({
    where: { slug: 'test-org' },
    update: {},
    create: {
      name: 'Test Organization',
      slug: 'test-org',
    },
  });

  await prisma.organizationMembers.upsert({
    where: { organization_id_user_id: { organization_id: org.id, user_id: user.id } },
    update: {},
    create: {
      organization_id: org.id,
      user_id: user.id,
      role: 'owner',
      status: 'active',
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 