import { NextResponse } from 'next/server';
import { db } from '@/lib/db-supabase';
import { Auth } from '@/lib/api-utils';
import { notificationService } from '@/lib/notification-service';
import { emailService } from '@/lib/email-service';

export const runtime = 'edge';

export const POST = async (request) => {
  try {
    const session = await Auth.requireAuth(request);
    const user = await Auth.requireUser(db, session.user.email);

    const { policyId, stepIndex, testData } = await request.json();
    
    if (!policyId || stepIndex === undefined) {
      return NextResponse.json({ error: 'Policy ID and step index required' }, { status: 400 });
    }

    // Get the escalation policy
    const policy = await db.getEscalationPolicyById(policyId, user.id);
    if (!policy) {
      return NextResponse.json({ error: 'Escalation policy not found' }, { status: 404 });
    }

    // Support both rules and escalation_steps field names for compatibility
    const rules = policy.rules || policy.escalation_steps || [];
    
    if (!rules || rules.length === 0) {
      return NextResponse.json({ error: 'No escalation rules configured' }, { status: 400 });
    }

    if (stepIndex >= rules.length) {
      return NextResponse.json({ error: 'Step index out of range' }, { status: 400 });
    }

    const step = rules[stepIndex];
    const testIncident = {
      id: 'test-incident-' + Date.now(),
      title: testData?.title || 'Test Escalation Policy',
      description: testData?.description || 'This is a test of the escalation policy system.',
      severity: testData?.severity || 'high',
      status: 'new',
      created_at: new Date().toISOString(),
    };

    const results = {
      policy: {
        id: policy.id,
        name: policy.name,
      },
      step: {
        index: stepIndex,
        level: step.level,
        delay_minutes: step.delay_minutes,
        targets: step.targets?.length || 0,
      },
      notifications: [],
      errors: [],
    };

    // Process each target in the step
    if (step.targets && step.targets.length > 0) {
      for (const target of step.targets) {
        try {
          let targetUser = null;
          let targetName = 'Unknown';

          if (target.type === 'user') {
            // Handle both simple target structure {id, type} and complex structure {id, data, type, ...}
            const userId = target.id;
            targetUser = await db.getUserById(userId);
            if (targetUser) {
              targetName = targetUser.name || targetUser.email;
              
              // Determine channels based on step configuration and test severity
              const channels = ['email']; // Always include email
              
              // Add SMS and calls for high/critical severity if phone available
              const userPhone = targetUser.phone || targetUser.phone_number;
              if (['critical', 'high'].includes(testIncident.severity) && userPhone) {
                const stepChannels = step.channels || step.notification_channels || [];
                if (stepChannels.includes('sms') || stepChannels.includes('voice') || stepChannels.length === 0) {
                  channels.push('sms');
                }
                if (stepChannels.includes('call') || stepChannels.includes('voice') || stepChannels.length === 0) {
                  channels.push('call');
                }
              }

              // Send test notification
              const notificationResult = await notificationService.sendNotification({
                channels,
                recipient: {
                  email: targetUser.email,
                  name: targetUser.name,
                  phone: userPhone,
                },
                subject: `🧪 TEST: Escalation Policy - ${testIncident.title}`,
                message: `TEST ESCALATION POLICY\n\nPolicy: ${policy.name}\nStep: ${step.level}\nIncident: ${testIncident.title}\nSeverity: ${testIncident.severity.toUpperCase()}\n\nThis is a test of your escalation policy configuration.`,
                incidentData: testIncident,
                priority: testIncident.severity === 'critical' ? 'urgent' : 'high',
                organizationId: policy.organization_id,
              });

              results.notifications.push({
                target: {
                  type: 'user',
                  id: target.id,
                  name: targetName,
                  email: targetUser.email,
                  phone: userPhone,
                },
                channels,
                success: true,
                result: notificationResult,
              });

            } else {
              results.errors.push(`User not found: ${target.id}`);
            }
          } else if (target.type === 'team') {
            // Handle team targets - if target.data contains team info, use it; otherwise fetch from DB
            const teamId = target.id;
            try {
              let team = target.data; // Try to use embedded data first
              
              if (!team || !team.members) {
                // Fallback to fetching from database
                team = await db.getTeamGroup(teamId);
              }
              
              if (team && team.members && team.members.length > 0) {
                // Notify all active team members
                for (const member of team.members) {
                  if (member.is_active && member.users) {
                    const teamUser = member.users;
                    const channels = ['email'];
                    const userPhone = teamUser.phone_number || teamUser.phone;
                    
                    if (['critical', 'high'].includes(testIncident.severity) && userPhone) {
                      const stepChannels = step.channels || step.notification_channels || [];
                      if (stepChannels.includes('sms') || stepChannels.includes('voice') || stepChannels.length === 0) {
                        channels.push('sms');
                      }
                      if (stepChannels.includes('call') || stepChannels.includes('voice') || stepChannels.length === 0) {
                        channels.push('call');
                      }
                    }

                    const notificationResult = await notificationService.sendNotification({
                      channels,
                      recipient: {
                        email: teamUser.email,
                        name: teamUser.name,
                        phone: userPhone,
                      },
                      subject: `🧪 TEST: Team Escalation - ${testIncident.title}`,
                      message: `TEST TEAM ESCALATION\n\nTeam: ${team.name || target.label || 'Unknown'}\nPolicy: ${policy.name}\nStep: ${step.level}\nIncident: ${testIncident.title}\nSeverity: ${testIncident.severity.toUpperCase()}\n\nThis is a test of your team escalation policy.`,
                      incidentData: testIncident,
                      priority: testIncident.severity === 'critical' ? 'urgent' : 'high',
                      organizationId: policy.organization_id,
                    });

                    results.notifications.push({
                      target: {
                        type: 'team',
                        id: teamId,
                        name: `${teamUser.name} (Team: ${team.name || target.label})`,
                        team_name: team.name || target.label,
                        member: {
                          id: teamUser.id,
                          name: teamUser.name,
                          email: teamUser.email,
                          phone: userPhone,
                        },
                      },
                      channels,
                      success: true,
                      result: notificationResult,
                    });
                  }
                }
              } else {
                results.errors.push(`Team not found or no members: ${teamId}`);
              }
            } catch (teamError) {
              console.error(`Error processing team ${teamId}:`, teamError);
              results.errors.push(`Failed to process team ${teamId}: ${teamError.message}`);
            }
          } else if (target.type === 'schedule') {
            // Get on-call schedule
            const schedule = await db.getOnCallScheduleById(target.id, user.id);
            if (schedule && schedule.members && schedule.members.length > 0) {
              // Get current on-call user (simplified - just get first member)
              const onCallUserId = schedule.members[0].user_id;
              const onCallUser = await db.getUserById(onCallUserId);
              
              if (onCallUser) {
                targetName = `${onCallUser.name} (On-call: ${schedule.name})`;
                
                const channels = ['email'];
                if (['critical', 'high'].includes(testIncident.severity) && onCallUser.phone) {
                  channels.push('sms', 'call');
                }

                const notificationResult = await notificationService.sendNotification({
                  channels,
                  recipient: {
                    email: onCallUser.email,
                    name: onCallUser.name,
                    phone: onCallUser.phone,
                  },
                  subject: `🧪 TEST: On-Call Escalation - ${testIncident.title}`,
                  message: `TEST ON-CALL ESCALATION\n\nSchedule: ${schedule.name}\nPolicy: ${policy.name}\nStep: ${step.level}\nIncident: ${testIncident.title}\nSeverity: ${testIncident.severity.toUpperCase()}\n\nThis is a test of your on-call escalation policy.`,
                  incidentData: testIncident,
                  priority: testIncident.severity === 'critical' ? 'urgent' : 'high',
                  organizationId: policy.organization_id,
                });

                results.notifications.push({
                  target: {
                    type: 'schedule',
                    id: target.id,
                    name: targetName,
                    schedule_name: schedule.name,
                    current_user: {
                      id: onCallUser.id,
                      name: onCallUser.name,
                      email: onCallUser.email,
                      phone: onCallUser.phone,
                    },
                  },
                  channels,
                  success: true,
                  result: notificationResult,
                });
              } else {
                results.errors.push(`On-call user not found for schedule: ${schedule.name}`);
              }
            } else {
              results.errors.push(`Schedule not found or no members: ${target.id}`);
            }
          }
        } catch (targetError) {
          console.error(`Error testing target ${target.id}:`, targetError);
          results.errors.push(`Failed to test target ${target.id}: ${targetError.message}`);
        }
      }
    } else {
      results.errors.push('No targets configured for this escalation step');
    }

    return NextResponse.json({
      success: true,
      message: `Escalation policy test completed. Sent ${results.notifications.length} notifications.`,
      results,
    });

  } catch (error) {
    console.error('Escalation test error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
};