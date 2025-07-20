import { NextResponse } from 'next/server';
import { db } from '@/lib/db-supabase';

export async function GET(request) {
  try {
    console.log('🔍 Checking monitoring-related tables...');

    const results = {
      tables_checked: [],
      errors: [],
    };

    // List of tables to check
    const tablesToCheck = [
      'service_monitoring_checks',
      'monitoring_checks',
      'services',
      'check_results',
    ];

    for (const tableName of tablesToCheck) {
      try {
        console.log(`Checking table: ${tableName}`);

        // Try to select from the table to see if it exists and get structure
        const { data, error, count } = await db.client
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(1);

        if (error) {
          results.tables_checked.push({
            table_name: tableName,
            exists: false,
            error: error.message,
            code: error.code,
          });
        } else {
          // Get column info by examining the first record or empty structure
          let columns = [];
          if (data && data.length > 0) {
            columns = Object.keys(data[0]);
          } else {
            // Try to get schema info another way
            try {
              const { data: emptyData, error: structError } = await db.client
                .from(tableName)
                .select('*')
                .limit(0);

              if (!structError && emptyData !== null) {
                // Table exists but is empty
                columns = [
                  'Table exists but is empty - cannot determine columns',
                ];
              }
            } catch (e) {
              columns = ['Could not determine columns'];
            }
          }

          results.tables_checked.push({
            table_name: tableName,
            exists: true,
            row_count: count,
            sample_columns: columns,
            has_data: data && data.length > 0,
          });
        }
      } catch (tableError) {
        results.errors.push({
          table_name: tableName,
          error: tableError.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      database_info: results,
      recommendation: results.tables_checked.find(
        t => t.table_name === 'service_monitoring_checks' && !t.exists
      )
        ? 'service_monitoring_checks table does not exist - needs to be created'
        : 'Tables exist but may have incorrect structure',
    });
  } catch (error) {
    console.error('Table check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check tables',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
