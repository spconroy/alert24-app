import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const type = searchParams.get('type');

    if (!token || !email) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Unsubscribe Link</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">Invalid Unsubscribe Link</h1>
          <p>The unsubscribe link is invalid or has expired. Please contact support if you continue to receive unwanted emails.</p>
        </body>
        </html>
      `,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Verify token (in a real implementation, you'd validate a JWT or similar)
    // For this example, we'll just check if the email exists in our system
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .single();

    if (!user) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">Email Not Found</h1>
          <p>The email address ${email} was not found in our system.</p>
        </body>
        </html>
      `,
        {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Get or create notification preferences
    let { data: preferences } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!preferences) {
      // Create default preferences
      const { data: newPreferences, error } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: user.id,
          email_invitations: true,
          email_incidents: true,
          email_monitoring: true,
          email_updates: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating preferences:', error);
        return new Response(
          `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { color: #d32f2f; }
            </style>
          </head>
          <body>
            <h1 class="error">Error</h1>
            <p>An error occurred while processing your request. Please try again later.</p>
          </body>
          </html>
        `,
          {
            status: 500,
            headers: { 'Content-Type': 'text/html' },
          }
        );
      }

      preferences = newPreferences;
    }

    // Show unsubscribe form
    const typeDisplayNames = {
      invitation: 'Invitation Emails',
      incident: 'Incident Notifications',
      monitoring: 'Monitoring Alerts',
      update: 'Update Notifications',
    };

    const currentType = type || 'all';
    const displayName =
      typeDisplayNames[currentType] || 'All Email Notifications';

    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribe - Alert24</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px; 
            line-height: 1.6;
            color: #333;
          }
          .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 40px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .form-group {
            margin: 20px 0;
          }
          label {
            display: block;
            margin: 10px 0 5px 0;
            font-weight: 500;
          }
          input[type="checkbox"] {
            margin-right: 8px;
          }
          .btn {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 5px;
          }
          .btn:hover {
            background: #5a6fd8;
          }
          .btn-secondary {
            background: #6c757d;
          }
          .btn-secondary:hover {
            background: #5a6268;
          }
          .success { color: #4caf50; }
          .info { color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email Notification Preferences</h1>
            <p class="info">Manage your email notification settings for ${email}</p>
          </div>

          <form method="POST" action="/api/notifications/unsubscribe">
            <input type="hidden" name="token" value="${token}">
            <input type="hidden" name="email" value="${email}">
            
            <div class="form-group">
              <label>
                <input type="checkbox" name="email_invitations" ${preferences.email_invitations ? 'checked' : ''}>
                Organization Invitations
              </label>
              <p class="info">Receive emails when you're invited to join organizations</p>
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" name="email_incidents" ${preferences.email_incidents ? 'checked' : ''}>
                Incident Notifications
              </label>
              <p class="info">Receive emails about new incidents and status updates</p>
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" name="email_monitoring" ${preferences.email_monitoring ? 'checked' : ''}>
                Monitoring Alerts
              </label>
              <p class="info">Receive emails when services go down or recover</p>
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" name="email_updates" ${preferences.email_updates ? 'checked' : ''}>
                Product Updates
              </label>
              <p class="info">Receive emails about new features and product announcements</p>
            </div>

            <div class="form-group" style="text-align: center; margin-top: 30px;">
              <button type="submit" class="btn">Update Preferences</button>
              <button type="button" class="btn btn-secondary" onclick="window.close()">Cancel</button>
            </div>
          </form>

          <p class="info" style="text-align: center; margin-top: 30px;">
            You can update these preferences at any time from your account settings.
          </p>
        </div>
      </body>
      </html>
    `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  } catch (error) {
    console.error('Error in unsubscribe GET:', error);
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { color: #d32f2f; }
        </style>
      </head>
      <body>
        <h1 class="error">Error</h1>
        <p>An error occurred while processing your request. Please try again later.</p>
      </body>
      </html>
    `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const token = formData.get('token');
    const email = formData.get('email');

    if (!token || !email) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Request</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">Invalid Request</h1>
          <p>Missing required parameters.</p>
        </body>
        </html>
      `,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Email Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">Email Not Found</h1>
          <p>The email address was not found in our system.</p>
        </body>
        </html>
      `,
        {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Update preferences
    const preferences = {
      email_invitations: formData.get('email_invitations') === 'on',
      email_incidents: formData.get('email_incidents') === 'on',
      email_monitoring: formData.get('email_monitoring') === 'on',
      email_updates: formData.get('email_updates') === 'on',
    };

    const { error } = await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      ...preferences,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error updating preferences:', error);
      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <h1 class="error">Error</h1>
          <p>An error occurred while updating your preferences. Please try again later.</p>
        </body>
        </html>
      `,
        {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }

    // Success page
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preferences Updated - Alert24</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; 
            max-width: 600px; 
            margin: 50px auto; 
            padding: 20px; 
            line-height: 1.6;
            color: #333;
          }
          .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 40px;
            text-align: center;
          }
          .success { color: #4caf50; }
          .info { color: #666; font-size: 14px; }
          .btn {
            background: #667eea;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin: 20px 0;
            text-decoration: none;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="success">✅ Preferences Updated</h1>
          <p>Your email notification preferences have been successfully updated.</p>
          <p class="info">You can always change these settings again by visiting your account preferences or using the unsubscribe links in future emails.</p>
          <button onclick="window.close()" class="btn">Close Window</button>
        </div>
      </body>
      </html>
    `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  } catch (error) {
    console.error('Error in unsubscribe POST:', error);
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { color: #d32f2f; }
        </style>
      </head>
      <body>
        <h1 class="error">Error</h1>
        <p>An error occurred while processing your request. Please try again later.</p>
      </body>
      </html>
    `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
}
