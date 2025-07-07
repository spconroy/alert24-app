export const runtime = 'edge';

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req) {
  try {
    console.log('Using connection string:', process.env.DATABASE_URL);
    const searchPathResult = await pool.query('SHOW search_path');
    console.log('Current search_path:', searchPathResult.rows);
    const currentSchema = await pool.query('SELECT current_schema()');
    console.log('Current schema:', currentSchema.rows);
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.log('Failed to parse JSON body:', e);
      body = null;
    }
    console.log('Raw body:', body);
    if (!body || !body.email || !body.name || !body.password) {
      return new Response(
        JSON.stringify({ error: 'All fields are required.' }),
        { status: 400 }
      );
    }
    const { email, name, password } = body;
    // Check for existing user
    const existing = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [email]
    );
    if (existing.rows.length > 0) {
      return new Response(JSON.stringify({ error: 'Email already in use.' }), {
        status: 409,
      });
    }
    // Hash password and insert
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO public.users (email, name, password) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, name, hashed]
    );
    return new Response(JSON.stringify({ user: result.rows[0] }), {
      status: 201,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
