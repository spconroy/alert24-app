# Escalation Timeout Cron Job Setup

This document explains how to set up automatic escalation processing for incidents that haven't been acknowledged within their timeout period.

## Overview

The escalation cron job processes incidents that have timed out and escalates them to the next level in their escalation policy. It runs every 2 minutes to ensure timely escalation of critical incidents.

## Files Created

### 1. `/app/api/escalations/cron/route.js`
- Main cron job endpoint that processes timed out escalations
- Supports both GET (open) and POST (authenticated) methods
- Automatically escalates incidents to the next level when timeouts occur
- Sends multi-channel notifications (email, SMS, phone) to next level responders

### 2. `/lib/db-supabase.js` - New Functions
- `getTimedOutEscalations()` - Finds escalations that have exceeded their timeout
- `getAllIncidentEscalations(limit)` - Debug function to view all escalations

### 3. `/app/api/debug/test-escalations/route.js`
- Debug endpoint to view escalation status
- Manual trigger for testing escalation processing
- Useful for development and troubleshooting

### 4. `/vercel.json`
- Configures automatic cron scheduling on Vercel
- Runs escalation processing every 2 minutes
- Also includes existing monitoring cron job

## How It Works

### 1. Incident Creation
When a new incident is created:
1. An escalation record is created with a 15-minute timeout
2. First-level responders are notified via email/SMS/phone
3. A `timeout_at` timestamp is set for automatic escalation

### 2. Escalation Processing (Every 2 Minutes)
The cron job:
1. Finds all escalations where `timeout_at < now()` and status is 'pending' or 'notified'
2. For each timed-out escalation:
   - Marks current escalation as 'timeout'
   - Finds next level in escalation policy
   - Creates new escalation record for next level
   - Sends notifications to next-level responders
   - Sets new timeout period

### 3. Escalation Chain
- **Level 1**: Initial responders (immediate notification)
- **Level 2**: Escalated responders (15 minutes later if not acknowledged)
- **Level 3+**: Continue escalating through policy levels
- **End**: When no more levels exist, escalation is marked 'completed'

## Deployment Options

### Option 1: Vercel Cron (Recommended)
The `vercel.json` file automatically configures the cron job when deployed to Vercel.

**Schedule**: Every 2 minutes (`*/2 * * * *`)

**Endpoint**: `/api/escalations/cron` (POST with authentication)

### Option 2: External Cron Service
Use any external cron service (GitHub Actions, cPanel cron, etc.) to call:

**URL**: `https://yourdomain.com/api/escalations/cron`
**Method**: GET (no authentication required)
**Schedule**: Every 2-5 minutes

Example curl command:
```bash
curl -X GET https://yourdomain.com/api/escalations/cron
```

### Option 3: Manual Testing
For development, you can trigger escalation processing manually:

**Debug endpoint**: `https://yourdomain.com/api/debug/test-escalations`
- GET: View current escalation status
- POST: Manually trigger escalation processing

## Configuration

### Environment Variables
- `CRON_SECRET`: Optional secret for authenticating POST requests to cron endpoint
- `NEXTAUTH_URL`: Base URL for incident links in notifications

### Escalation Policy Requirements
Ensure your escalation policies have:
- Multiple levels with `level` field (1, 2, 3, etc.)
- `delay_minutes` for timeout periods (defaults to 15 minutes)
- Valid `targets` with user IDs, team IDs, or schedule IDs

## Monitoring and Debugging

### Debug Endpoint
Visit `/api/debug/test-escalations` to:
- View all escalations and their status
- See which escalations are timed out
- Manually trigger escalation processing
- Check current system time vs. timeout times

### Console Logs
The cron job logs detailed information:
```
🔄 Starting escalation timeout processing...
Found 2 timed out escalations to process
✅ Escalated incident abc123 to level 2
📟 Escalation notifications: 3 sent, 0 failed
```

### Response Format
```json
{
  "success": true,
  "summary": {
    "found": 2,
    "processed": 2,
    "errors": 0,
    "duration": "1234ms"
  },
  "timestamp": "2024-01-20T15:30:00.000Z"
}
```

## Testing the Setup

### 1. Create Test Incident
1. Create an escalation policy with 2+ levels
2. Create a new incident with that policy
3. Don't acknowledge the incident

### 2. Wait or Trigger Manually
- **Wait**: 15 minutes for automatic escalation
- **Manual**: Visit `/api/debug/test-escalations` and POST to trigger immediately

### 3. Verify Escalation
- Check that next-level responders receive notifications
- Verify escalation record is created in database
- Confirm timeout was reset for next level

## Troubleshooting

### Common Issues

1. **No escalations processed**: Check that incidents have status 'new'
2. **Notifications not sent**: Verify notification service configuration
3. **Cron not running**: Check Vercel dashboard or external cron service logs
4. **Missing phone numbers**: Ensure user profiles have phone numbers for SMS/calls

### Database Queries
Check escalation status manually:
```sql
SELECT * FROM incident_escalations 
WHERE status IN ('pending', 'notified') 
AND timeout_at < NOW() 
ORDER BY created_at;
```

## Security Notes

- GET endpoint has no authentication (for easy external cron integration)
- POST endpoint requires `CRON_SECRET` if configured
- All escalation processing respects organization membership
- User data is protected through existing RLS policies