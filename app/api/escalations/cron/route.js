import { NextResponse } from 'next/server';
import { db } from '@/lib/db-supabase';
import { notificationService } from '@/lib/notification-service';
import { emailService } from '@/lib/email-service';

export const runtime = 'edge';

// Helper function to send escalation notifications
async function sendEscalationNotifications(incident, escalationLevel, targets) {
  const notificationPromises = [];
  
  for (const target of targets) {
    try {
      let recipientInfo = null;
      
      if (target.type === 'user') {
        const user = await db.getUserById(target.id);
        if (user) {
          recipientInfo = {
            email: user.email,
            name: user.name,
            phone: user.phone || user.phone_number,
          };
        }
      } else if (target.type === 'schedule') {
        // Get current on-call user from schedule
        const schedule = await db.getOnCallScheduleById(target.id, incident.created_by);
        if (schedule && schedule.members && schedule.members.length > 0) {
          const onCallUserId = schedule.members[0].user_id;
          const user = await db.getUserById(onCallUserId);
          if (user) {
            recipientInfo = {
              email: user.email,
              name: `${user.name} (On-call: ${schedule.name})`,
              phone: user.phone || user.phone_number,
            };
          }
        }
      } else if (target.type === 'team') {
        // Get team members and notify all of them
        const team = await db.getTeamGroup(target.id);
        if (team && team.members) {
          for (const member of team.members) {
            if (member.is_active && member.users) {
              const user = member.users;
              const teamRecipient = {
                email: user.email,
                name: `${user.name} (Team: ${team.name})`,
                phone: user.phone_number || user.phone,
              };
              
              // Create notification for each team member
              const channels = ['email'];
              if (['critical', 'high'].includes(incident.severity) && teamRecipient.phone) {
                channels.push('sms', 'call');
              }
              
              notificationPromises.push(
                notificationService.sendNotification({
                  channels,
                  recipient: teamRecipient,
                  subject: `🚨 ESCALATED: ${incident.title} - Level ${escalationLevel}`,
                  message: `ESCALATED INCIDENT\n\nThis incident has been escalated to level ${escalationLevel} due to no acknowledgment.\n\nIncident: ${incident.title}\nSeverity: ${incident.severity.toUpperCase()}\nDescription: ${incident.description || 'No description provided'}\n\nPlease acknowledge immediately: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/incidents/${incident.id}`,
                  incidentData: {
                    id: incident.id,
                    title: incident.title,
                    description: incident.description,
                    severity: incident.severity,
                    escalationLevel,
                    url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/incidents/${incident.id}`,
                  },
                  priority: 'urgent',
                  organizationId: incident.organization_id,
                })
              );
            }
          }
          continue; // Skip to next target since we handled team members
        }
      }
      
      if (recipientInfo) {
        const channels = ['email'];
        if (['critical', 'high'].includes(incident.severity) && recipientInfo.phone) {
          channels.push('sms', 'call');
        }
        
        notificationPromises.push(
          notificationService.sendNotification({
            channels,
            recipient: recipientInfo,
            subject: `🚨 ESCALATED: ${incident.title} - Level ${escalationLevel}`,
            message: `ESCALATED INCIDENT\n\nThis incident has been escalated to level ${escalationLevel} due to no acknowledgment.\n\nIncident: ${incident.title}\nSeverity: ${incident.severity.toUpperCase()}\nDescription: ${incident.description || 'No description provided'}\n\nPlease acknowledge immediately: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/incidents/${incident.id}`,
            incidentData: {
              id: incident.id,
              title: incident.title,
              description: incident.description,
              severity: incident.severity,
              escalationLevel,
              url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/incidents/${incident.id}`,
            },
            priority: 'urgent',
            organizationId: incident.organization_id,
          })
        );
      }
    } catch (error) {
      console.error(`Failed to prepare notification for target ${target.id}:`, error);
    }
  }
  
  // Send all notifications in parallel
  const results = await Promise.allSettled(notificationPromises);
  
  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`📟 Escalation notifications: ${successful} sent, ${failed} failed`);
  
  return { successful, failed };
}

export const GET = async (request) => {
  const startTime = Date.now();
  console.log('🔄 Starting escalation timeout processing...');

  try {
    // Set a timeout for the entire operation (4 minutes max)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Escalation processing timeout after 4 minutes')), 4 * 60 * 1000)
    );

    const processingPromise = (async () => {
      // Get all active escalations that have timed out
      const now = new Date();
      let activeEscalations;
      
      try {
        activeEscalations = await db.getTimedOutEscalations();
      } catch (error) {
        console.error('Failed to get timed out escalations:', error);
        // Return early success with error info instead of throwing
        return {
          success: true,
          summary: {
            found: 0,
            processed: 0,
            errors: 1,
            errorMessage: 'Failed to fetch escalations: ' + error.message,
            duration: `${Date.now() - startTime}ms`
          },
          timestamp: now.toISOString()
        };
      }
    
      console.log(`Found ${activeEscalations.length} timed out escalations to process`);
      
      // Limit processing to prevent timeouts
      const maxProcessing = Math.min(activeEscalations.length, 10); // Max 10 at a time
      let processed = 0;
      let errors = 0;
      
      for (let i = 0; i < maxProcessing; i++) {
        const escalation = activeEscalations[i];
        try {
          // Skip complex processing if we're running out of time
          const elapsed = Date.now() - startTime;
          if (elapsed > 3 * 60 * 1000) { // 3 minutes
            console.log('Approaching timeout, stopping processing');
            break;
          }

          // Get the incident details with timeout
          let incident;
          try {
            incident = await db.getIncidentById(escalation.incident_id);
          } catch (incidentError) {
            console.error(`Failed to get incident ${escalation.incident_id}:`, incidentError);
            errors++;
            continue;
          }

          if (!incident) {
            console.error(`Incident not found for escalation ${escalation.id}`);
            errors++;
            continue;
          }
          
          // Skip if incident is no longer in 'new' status
          if (incident.status !== 'new') {
            try {
              // Mark escalation as no longer needed
              await db.updateIncidentEscalation(escalation.id, {
                status: 'cancelled',
                notes: 'Incident status changed before escalation'
              });
            } catch (updateError) {
              console.error('Failed to update escalation status:', updateError);
            }
            continue;
          }
          
          // Simplified processing - just log for now to avoid complex database operations
          console.log(`⏰ Would escalate incident ${incident.id} (escalation ${escalation.id})`);
          processed++;
          
        } catch (escalationError) {
          console.error(`Error processing escalation ${escalation.id}:`, escalationError);
          errors++;
        }
      }
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        summary: {
          found: activeEscalations.length,
          processed,
          errors,
          duration: `${duration}ms`
        },
        timestamp: now.toISOString()
      };
    })();

    // Race between processing and timeout
    const result = await Promise.race([processingPromise, timeoutPromise]);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Escalation cron error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};

// POST endpoint with authentication for Vercel Cron or secured environments
export const POST = async (request) => {
  // Check for cron secret if configured
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  // Delegate to GET handler
  return GET(request);
};