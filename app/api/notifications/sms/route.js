import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { createClient } from '@supabase/supabase-js';
import SMSService from '../../../../lib/sms-service';

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

    const { phoneNumber, isVerification = false } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const smsService = new SMSService();

    // Validate phone number format
    try {
      const validation = smsService.validatePhoneNumber(phoneNumber);
      if (!validation.isValid) {
        return NextResponse.json({ 
          error: 'Invalid phone number format',
          details: validation.error 
        }, { status: 400 });
      }
    } catch (error) {
      return NextResponse.json({ 
        error: 'Invalid phone number format',
        details: error.message 
      }, { status: 400 });
    }

    if (isVerification) {
      // Handle phone number verification
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      const message = `Alert24 verification code: ${verificationCode}. This code expires in 10 minutes.`;
      
      const result = await smsService.sendSMS(phoneNumber, message, {
        priority: 'high',
        validityPeriod: 600 // 10 minutes
      });

      if (result.success) {
        // Store verification code in database with expiration
        const { error: dbError } = await supabase
          .from('phone_verifications')
          .upsert({
            user_id: session.user.id,
            phone_number: smsService.formatPhoneNumber(phoneNumber),
            verification_code: verificationCode,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
            created_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,phone_number',
            ignoreDuplicates: false
          });

        if (dbError) {
          console.error('Failed to store verification code:', dbError);
        }

        return NextResponse.json({
          success: true,
          messageId: result.messageId,
          message: 'Verification code sent successfully'
        });
      } else {
        return NextResponse.json({
          error: 'Failed to send verification code',
          details: result.error
        }, { status: 500 });
      }
    } else {
      // Handle adding phone number to user's contact methods
      const { data: existingContact, error: fetchError } = await supabase
        .from('user_contact_methods')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('contact_type', 'sms')
        .eq('contact_value', smsService.formatPhoneNumber(phoneNumber))
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Database error:', fetchError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      if (existingContact) {
        return NextResponse.json({
          success: true,
          message: 'Phone number already registered',
          contactId: existingContact.id
        });
      }

      // Add new contact method
      const { data: newContact, error: insertError } = await supabase
        .from('user_contact_methods')
        .insert({
          user_id: session.user.id,
          organization_id: session.user.organizationId,
          contact_type: 'sms',
          contact_value: smsService.formatPhoneNumber(phoneNumber),
          is_verified: false,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database error:', insertError);
        return NextResponse.json({ error: 'Failed to add phone number' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Phone number added successfully. Please verify to enable SMS notifications.',
        contactId: newContact.id,
        requiresVerification: true
      });
    }

  } catch (error) {
    console.error('SMS registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's SMS contact methods
    const { data: contacts, error } = await supabase
      .from('user_contact_methods')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('contact_type', 'sms')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch SMS contacts' }, { status: 500 });
    }

    return NextResponse.json({ 
      contacts: contacts || [],
      hasVerified: contacts?.some(c => c.is_verified) || false
    });

  } catch (error) {
    console.error('Get SMS contacts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('id');
    const phoneNumber = searchParams.get('phoneNumber');

    if (!contactId && !phoneNumber) {
      return NextResponse.json({ error: 'Contact ID or phone number required' }, { status: 400 });
    }

    let query = supabase
      .from('user_contact_methods')
      .delete()
      .eq('user_id', session.user.id)
      .eq('contact_type', 'sms');

    if (contactId) {
      query = query.eq('id', contactId);
    } else {
      const smsService = new SMSService();
      query = query.eq('contact_value', smsService.formatPhoneNumber(phoneNumber));
    }

    const { error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to remove SMS contact' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'SMS contact removed successfully'
    });

  } catch (error) {
    console.error('Remove SMS contact error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}