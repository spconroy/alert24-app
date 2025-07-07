
import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// GET - Fetch user profile
export async function GET(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    // Get user profile data
    const userRes = await pool.query(
      `SELECT 
        id, 
        email, 
        name, 
        phone_number, 
        timezone, 
        notification_preferences, 
        created_at,
        updated_at
       FROM public.users 
       WHERE email = $1`,
      [session.user.email]
    );

    if (userRes.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
      });
    }

    const user = userRes.rows[0];

    // Parse notification preferences if stored as JSON string
    let notificationPreferences = user.notification_preferences;
    if (typeof notificationPreferences === 'string') {
      try {
        notificationPreferences = JSON.parse(notificationPreferences);
      } catch (e) {
        notificationPreferences = {
          email_incidents: true,
          email_escalations: true,
          sms_critical: false,
          sms_escalations: false,
        };
      }
    }

    return new Response(
      JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone_number,
        timezone: user.timezone,
        notification_preferences: notificationPreferences || {
          email_incidents: true,
          email_escalations: true,
          sms_critical: false,
          sms_escalations: false,
        },
        created_at: user.created_at,
        updated_at: user.updated_at,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

// PUT - Update user profile
export async function PUT(req) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
    });
  }

  try {
    const body = await req.json();
    const { name, email, phone, timezone, notification_preferences } = body;

    // Validate required fields
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: 'Name and email are required' }),
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
      });
    }

    // Validate phone number if provided
    if (phone) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        return new Response(
          JSON.stringify({ error: 'Invalid phone number format' }),
          { status: 400 }
        );
      }
    }

    // Get current user
    const currentUserRes = await pool.query(
      'SELECT id FROM public.users WHERE email = $1',
      [session.user.email]
    );
    if (currentUserRes.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
      });
    }
    const userId = currentUserRes.rows[0].id;

    // Check if email is being changed and if it's already taken by another user
    if (email !== session.user.email) {
      const existingUserRes = await pool.query(
        'SELECT id FROM public.users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      if (existingUserRes.rows.length > 0) {
        return new Response(
          JSON.stringify({
            error: 'Email address is already in use by another account',
          }),
          { status: 409 }
        );
      }
    }

    // Update user profile
    const updateRes = await pool.query(
      `UPDATE public.users 
       SET 
         name = $1,
         email = $2,
         phone_number = $3,
         timezone = $4,
         notification_preferences = $5,
         updated_at = NOW()
       WHERE id = $6
       RETURNING id, email, name, phone_number, timezone, notification_preferences, updated_at`,
      [
        name,
        email,
        phone || null,
        timezone || 'UTC',
        JSON.stringify(notification_preferences || {}),
        userId,
      ]
    );

    if (updateRes.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to update profile' }),
        { status: 500 }
      );
    }

    const updatedUser = updateRes.rows[0];

    // Parse notification preferences for response
    let parsedNotificationPreferences = updatedUser.notification_preferences;
    if (typeof parsedNotificationPreferences === 'string') {
      try {
        parsedNotificationPreferences = JSON.parse(
          parsedNotificationPreferences
        );
      } catch (e) {
        parsedNotificationPreferences = {};
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          phone: updatedUser.phone_number,
          timezone: updatedUser.timezone,
          notification_preferences: parsedNotificationPreferences,
          updated_at: updatedUser.updated_at,
        },
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Error updating user profile:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
