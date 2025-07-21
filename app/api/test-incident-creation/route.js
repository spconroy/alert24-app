import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function POST(request) {
  try {
    console.log('🧪 Testing incident creation in edge runtime...');
    
    const db = new SupabaseClient();
    const body = await request.json();
    
    console.log('Request body:', body);
    
    // Test basic incident creation without complex logic
    const testIncidentData = {
      organization_id: body.organizationId || '5e4107b7-9a16-4555-9bf2-c10ce9684e98', // Use the test org ID
      title: body.title || 'Edge Runtime Test Incident',
      description: body.description || 'This is a test incident created in edge runtime',
      severity: body.severity || 'medium',
      status: 'new',
      created_by: body.createdBy || 'test-user',
      source: 'edge-test'
    };
    
    console.log('Creating incident with data:', testIncidentData);
    
    // Try the createIncident method
    const incident = await db.createIncident(testIncidentData);
    
    console.log('✅ Incident created successfully:', incident);
    
    return NextResponse.json({
      success: true,
      message: 'Test incident created successfully',
      incident: incident
    });
    
  } catch (error) {
    console.error('❌ Edge runtime incident test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Incident creation failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to test incident creation',
    usage: {
      method: 'POST',
      body: {
        organizationId: 'optional - defaults to test org',
        title: 'optional - defaults to test title',
        description: 'optional - defaults to test description', 
        severity: 'optional - defaults to medium',
        createdBy: 'optional - defaults to test-user'
      }
    }
  });
}