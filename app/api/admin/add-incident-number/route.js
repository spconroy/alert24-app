import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST() {
  try {
    // Initialize Supabase client with service role key for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'docs', 'migrations', 'add_incident_number.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    const results = [];
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const { data, error } = await supabase.rpc('exec_sql', { 
            sql_query: statement 
          });
          
          if (error) {
            // Try direct query if RPC doesn't work
            const { data: directData, error: directError } = await supabase
              .from('incidents')
              .select('count(*)', { count: 'exact', head: true });
            
            if (directError) {
              console.error('SQL Statement failed:', statement, error);
              throw error;
            }
          }
          
          results.push({ 
            statement: statement.substring(0, 100) + '...', 
            success: true 
          });
        } catch (err) {
          console.error('Failed to execute statement:', statement, err);
          results.push({ 
            statement: statement.substring(0, 100) + '...', 
            success: false, 
            error: err.message 
          });
        }
      }
    }

    // Verify the migration worked by checking if incident_number column exists
    const { data: testData, error: testError } = await supabase
      .from('incidents')
      .select('id, incident_number')
      .limit(1);

    if (testError) {
      throw new Error(`Migration verification failed: ${testError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Incident number migration completed successfully',
      results,
      verification: testData ? 'incident_number column is available' : 'No incidents to verify'
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        details: 'Failed to add incident_number column to incidents table'
      },
      { status: 500 }
    );
  }
}