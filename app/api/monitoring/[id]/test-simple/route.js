import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function POST(req, { params }) {
  try {
    console.log('🧪 TEST: Simple monitoring check update');
    
    const { id: checkId } = params;
    console.log('📝 Check ID:', checkId);
    
    // Test 1: Direct Supabase update with minimal data
    console.log('🔧 Test 1: Direct minimal update');
    try {
      const { error: directError } = await db.client
        .from('monitoring_checks')
        .update({ 
          updated_at: new Date().toISOString() 
        })
        .eq('id', checkId);
        
      console.log('🔧 Direct update result:', { 
        success: !directError, 
        error: directError 
      });
      
      if (directError) {
        console.error('❌ Direct update error details:', {
          code: directError.code,
          message: directError.message,
          details: directError.details,
          hint: directError.hint
        });
      }
    } catch (e) {
      console.error('❌ Direct update exception:', e);
    }
    
    // Test 2: Update with a simple field change
    console.log('🔧 Test 2: Update name field');
    try {
      const testName = `Test Update ${new Date().toISOString()}`;
      const { error: nameError } = await db.client
        .from('monitoring_checks')
        .update({ 
          name: testName,
          updated_at: new Date().toISOString() 
        })
        .eq('id', checkId);
        
      console.log('🔧 Name update result:', { 
        success: !nameError, 
        error: nameError 
      });
    } catch (e) {
      console.error('❌ Name update exception:', e);
    }
    
    // Test 3: Check if the record exists
    console.log('🔧 Test 3: Check if record exists');
    try {
      const { data: checkData, error: fetchError } = await db.client
        .from('monitoring_checks')
        .select('id, name, organization_id')
        .eq('id', checkId)
        .single();
        
      console.log('🔧 Fetch result:', { 
        found: !!checkData, 
        data: checkData,
        error: fetchError 
      });
    } catch (e) {
      console.error('❌ Fetch exception:', e);
    }
    
    // Test 4: Try raw SQL query
    console.log('🔧 Test 4: Test database connection');
    try {
      const { data: tables, error: tablesError } = await db.client
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'monitoring_checks');
        
      console.log('🔧 Table check:', { 
        exists: tables?.length > 0,
        error: tablesError 
      });
    } catch (e) {
      console.error('❌ Table check exception:', e);
    }
    
    // Test 5: Check column names
    console.log('🔧 Test 5: Check column names');
    try {
      const { data: columns, error: columnsError } = await db.client
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_schema', 'public')
        .eq('table_name', 'monitoring_checks');
        
      console.log('🔧 Columns found:', columns?.map(c => c.column_name));
    } catch (e) {
      console.error('❌ Columns check exception:', e);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tests completed - check logs' 
    });
    
  } catch (error) {
    console.error('🚨 Test route error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}