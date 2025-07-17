import { NextResponse } from 'next/server';
import { db } from '@/lib/db-supabase.js';

export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Testing Supabase connection...');

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Test the Supabase connection
    const connectionResult = await db.testConnection();

    return NextResponse.json({
      success: connectionResult.success,
      message: 'Supabase connection test completed',
      baseUrl: SUPABASE_URL,
      hasCredentials: {
        supabase_url: !!SUPABASE_URL,
        supabase_anon_key: !!SUPABASE_ANON_KEY,
      },
      connectionResult,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Supabase connection test error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasCredentials: {
          supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { table, operation = 'select', data = {} } = await request.json();

    if (!table) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table name is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    let result;

    switch (operation) {
      case 'select':
        result = await db.select(table, '*', data);
        break;
      case 'insert':
        result = await db.insert(table, data);
        break;
      case 'update':
        if (!data.id) {
          throw new Error('ID is required for update operations');
        }
        const { id, ...updateData } = data;
        result = await db.update(table, id, updateData);
        break;
      case 'delete':
        if (!data.id) {
          throw new Error('ID is required for delete operations');
        }
        result = await db.delete(table, data.id);
        break;
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }

    return NextResponse.json({
      success: true,
      operation,
      table,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database operation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
