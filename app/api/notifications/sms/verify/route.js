import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phoneNumber, verificationCode } = await request.json();

    if (!phoneNumber || !verificationCode) {
      return NextResponse.json({ 
        error: 'Phone number and verification code are required' 
      }, { status: 400 });
    }

    // Check verification code
    const { data: verification, error: verifyError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('phone_number', phoneNumber)
      .eq('verification_code', verificationCode)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (verifyError || !verification) {
      return NextResponse.json({ 
        error: 'Invalid or expired verification code' 
      }, { status: 400 });
    }

    // Mark phone number as verified
    const { error: updateError } = await supabase
      .from('user_contact_methods')
      .update({ 
        is_verified: true,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', session.user.id)
      .eq('contact_type', 'sms')
      .eq('contact_value', phoneNumber);

    if (updateError) {
      console.error('Failed to update verification status:', updateError);
      return NextResponse.json({ error: 'Failed to verify phone number' }, { status: 500 });
    }

    // Clean up verification record
    await supabase
      .from('phone_verifications')
      .delete()
      .eq('user_id', session.user.id)
      .eq('phone_number', phoneNumber);

    return NextResponse.json({
      success: true,
      message: 'Phone number verified successfully'
    });

  } catch (error) {
    console.error('Phone verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}