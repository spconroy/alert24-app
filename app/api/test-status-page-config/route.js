import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test the failure behavior configuration
    const testConfigs = [
      {
        name: 'Test Match Status',
        provider: 'azure',
        service: 'azure-compute',
        regions: ['east-us', 'west-us'],
        failure_behavior: 'match_status',
        failure_message: 'Azure compute dependency is experiencing issues',
      },
      {
        name: 'Test Always Degraded',
        provider: 'aws',
        service: 'aws-s3',
        regions: ['us-east-1'],
        failure_behavior: 'always_degraded',
        failure_message: 'AWS S3 dependency impact detected',
      },
      {
        name: 'Test Always Down',
        provider: 'gcp',
        service: 'gcp-compute-engine',
        regions: ['us-central1'],
        failure_behavior: 'always_down',
        failure_message: 'Critical GCP dependency failure',
      },
    ];

    return NextResponse.json({
      success: true,
      message: 'Status page configuration test',
      test_configs: testConfigs,
      supported_behaviors: [
        {
          value: 'match_status',
          label: 'Match Provider Status',
          description:
            'Service will be marked as degraded if provider shows degraded, down if provider shows down',
        },
        {
          value: 'always_degraded',
          label: 'Always Mark as Degraded',
          description:
            'Service will always be marked as degraded when provider has any issues',
        },
        {
          value: 'always_down',
          label: 'Always Mark as Down',
          description:
            'Service will always be marked as down when provider has any issues',
        },
      ],
    });
  } catch (error) {
    console.error('Error in test status page config API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
