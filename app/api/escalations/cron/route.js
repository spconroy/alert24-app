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
    // Get all active escalations that have timed out
    const now = new Date();
    const activeEscalations = await db.getTimedOutEscalations();
    
    console.log(`Found ${activeEscalations.length} timed out escalations to process`);
    
    let processed = 0;
    let errors = 0;
    
    for (const escalation of activeEscalations) {
      try {
        // Get the incident details
        const incident = await db.getIncidentById(escalation.incident_id);
        if (!incident) {
          console.error(`Incident not found for escalation ${escalation.id}`);
          continue;
        }
        
        // Skip if incident is no longer in 'new' status
        if (incident.status !== 'new') {
          // Mark escalation as no longer needed
          await db.updateIncidentEscalation(escalation.id, {
            status: 'cancelled',
            notes: 'Incident status changed before escalation'
          });
          continue;
        }
        
        // Get the escalation policy
        const policy = await db.getEscalationPolicyById(escalation.escalation_policy_id, incident.created_by);
        if (!policy) {
          console.error(`Escalation policy not found: ${escalation.escalation_policy_id}`);
          continue;
        }
        
        // Get the policy rules/steps
        const rules = policy.rules || policy.escalation_steps || [];
        
        // Find the next escalation level
        const currentLevel = escalation.level || 1;
        const nextLevel = currentLevel + 1;
        const nextRule = rules.find(r => r.level === nextLevel);
        
        if (!nextRule) {
          console.log(`No more escalation levels for incident ${incident.id}`);
          // Mark as completed - no more levels
          await db.updateIncidentEscalation(escalation.id, {
            status: 'completed',
            notes: 'No more escalation levels'
          });
          continue;
        }
        
        // Mark current escalation as timed out
        await db.updateIncidentEscalation(escalation.id, {
          status: 'timeout',
          completed_at: now.toISOString()
        });
        
        // Create new escalation for next level
        const newEscalation = await db.createIncidentEscalation({
          incident_id: incident.id,
          escalation_policy_id: policy.id,
          level: nextLevel,
          triggered_by: 'timeout',
          targets: nextRule.targets || [],
          status: 'notified',
          timeout_minutes: nextRule.delay_minutes || 15,
          timeout_at: new Date(now.getTime() + (nextRule.delay_minutes || 15) * 60 * 1000).toISOString(),
          previous_escalation_id: escalation.id
        });
        
        // Send notifications to next level targets
        if (nextRule.targets && nextRule.targets.length > 0) {
          await sendEscalationNotifications(incident, nextLevel, nextRule.targets);
        }
        
        processed++;
        console.log(`✅ Escalated incident ${incident.id} to level ${nextLevel}`);
        
      } catch (escalationError) {
        console.error(`Error processing escalation ${escalation.id}:`, escalationError);
        errors++;
      }
    }
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      summary: {
        found: activeEscalations.length,
        processed,
        errors,
        duration: `${duration}ms`
      },
      timestamp: now.toISOString()
    });
    
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