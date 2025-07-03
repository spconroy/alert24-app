import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const { email, name, password } = await req.json();
    console.log('Signup received:', { email, name, password }); // Debug log
    if (!email || !name || !password) {
      return new Response(JSON.stringify({ error: 'All fields are required.' }), { status: 400 });
    }
    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing) {
      return new Response(JSON.stringify({ error: 'Email already in use.' }), { status: 409 });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        email,
        name,
        password: hashed,
      },
    });
    return new Response(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }), { status: 201 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
} 