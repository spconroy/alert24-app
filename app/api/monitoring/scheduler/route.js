import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req) {
  // Verify this is coming from Vercel Cron or internal call
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const executionResults = [];

    // Find all monitoring checks that need to be executed
    const pendingChecksQuery = `
      SELECT mc.*,
             COALESCE(
               (SELECT MAX(cr.created_at) 
                FROM public.check_results cr 
                WHERE cr.monitoring_check_id = mc.id),
               mc.created_at
             ) as last_check_time
      FROM public.monitoring_checks mc
      WHERE mc.status = 'active'
        AND (
          -- Never been checked
          NOT EXISTS (
            SELECT 1 FROM public.check_results cr 
            WHERE cr.monitoring_check_id = mc.id
          )
          OR
          -- Due for next check based on interval
          (
            SELECT MAX(cr.created_at) 
            FROM public.check_results cr 
            WHERE cr.monitoring_check_id = mc.id
          ) <= NOW() - (mc.check_interval || ' seconds')::interval
        )
      ORDER BY last_check_time ASC
      LIMIT 50; -- Process max 50 checks per run to avoid timeouts
    `;

    const pendingChecks = await pool.query(pendingChecksQuery);

    console.log(`Found ${pendingChecks.rows.length} pending monitoring checks`);

    // Execute each pending check
    for (const check of pendingChecks.rows) {
      try {
        // Call the execution API internally
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const executeResponse = await fetch(
          `${baseUrl}/api/monitoring/execute`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              check_id: check.id,
            }),
          }
        );

        if (executeResponse.ok) {
          const result = await executeResponse.json();
          executionResults.push({
            check_id: check.id,
            check_name: check.name,
            status: 'executed',
            is_successful: result.check_result.is_successful,
            response_time: result.check_result.response_time,
          });

          console.log(
            `✓ Executed check: ${check.name} (${check.check_type}) - ${result.check_result.is_successful ? 'SUCCESS' : 'FAILED'}`
          );
        } else {
          const errorText = await executeResponse.text();
          executionResults.push({
            check_id: check.id,
            check_name: check.name,
            status: 'error',
            error: errorText,
          });

          console.error(
            `✗ Failed to execute check: ${check.name} - ${errorText}`
          );
        }
      } catch (error) {
        executionResults.push({
          check_id: check.id,
          check_name: check.name,
          status: 'error',
          error: error.message,
        });

        console.error(
          `✗ Error executing check: ${check.name} - ${error.message}`
        );
      }

      // Small delay between checks to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update statistics
    const stats = {
      total_processed: executionResults.length,
      successful: executionResults.filter(
        r => r.status === 'executed' && r.is_successful
      ).length,
      failed: executionResults.filter(
        r => r.status === 'executed' && !r.is_successful
      ).length,
      errors: executionResults.filter(r => r.status === 'error').length,
    };

    console.log(
      `Monitoring scheduler completed: ${stats.total_processed} checks processed, ${stats.successful} successful, ${stats.failed} failed, ${stats.errors} errors`
    );

    return new Response(
      JSON.stringify({
        message: 'Monitoring scheduler executed successfully',
        stats,
        execution_results: executionResults,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Monitoring scheduler error:', error);
    return new Response(
      JSON.stringify({
        error: 'Scheduler execution failed',
        details: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Manual trigger endpoint (for testing)
export async function POST(req) {
  try {
    // For manual triggers, we can be less strict about auth
    const body = await req.json();
    const { force = false } = body;

    console.log('Manual monitoring scheduler trigger', force ? '(forced)' : '');

    // If forced, we'll process all active checks regardless of last check time
    const checksQuery = force
      ? `SELECT * FROM public.monitoring_checks WHERE status = 'active' ORDER BY created_at DESC LIMIT 10`
      : `SELECT mc.*,
           COALESCE(
             (SELECT MAX(cr.created_at) 
              FROM public.check_results cr 
              WHERE cr.monitoring_check_id = mc.id),
             mc.created_at
           ) as last_check_time
         FROM public.monitoring_checks mc
         WHERE mc.status = 'active'
           AND (
             NOT EXISTS (
               SELECT 1 FROM public.check_results cr 
               WHERE cr.monitoring_check_id = mc.id
             )
             OR
             (
               SELECT MAX(cr.created_at) 
               FROM public.check_results cr 
               WHERE cr.monitoring_check_id = mc.id
             ) <= NOW() - (mc.check_interval || ' seconds')::interval
           )
         ORDER BY last_check_time ASC
         LIMIT 10`;

    const checks = await pool.query(checksQuery);
    const executionResults = [];

    for (const check of checks.rows) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        const executeResponse = await fetch(
          `${baseUrl}/api/monitoring/execute`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              check_id: check.id,
            }),
          }
        );

        if (executeResponse.ok) {
          const result = await executeResponse.json();
          executionResults.push({
            check_id: check.id,
            check_name: check.name,
            status: 'executed',
            is_successful: result.check_result.is_successful,
            response_time: result.check_result.response_time,
          });
        } else {
          const errorText = await executeResponse.text();
          executionResults.push({
            check_id: check.id,
            check_name: check.name,
            status: 'error',
            error: errorText,
          });
        }
      } catch (error) {
        executionResults.push({
          check_id: check.id,
          check_name: check.name,
          status: 'error',
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Manual monitoring execution completed',
        execution_results: executionResults,
        timestamp: new Date().toISOString(),
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Manual monitoring execution error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
