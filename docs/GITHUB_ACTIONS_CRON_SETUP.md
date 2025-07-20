# GitHub Actions Cron Setup for Alert24

This guide explains how to set up automated cron jobs using GitHub Actions for Alert24 when deployed on Cloudflare Pages.

## 🚨 **Why GitHub Actions?**

Cloudflare Pages doesn't support native cron jobs like Vercel. GitHub Actions provides a reliable, free alternative that runs:
- **Escalation processing** every 2 minutes
- **Monitoring checks** every 5 minutes
- **Health checks** before each scheduled run

## 📁 **Files Created**

### `.github/workflows/cron-jobs.yml`
Complete GitHub Actions workflow that handles all cron job functionality for Alert24.

## ⚙️ **Setup Instructions**

### 1. **Configure Your Domain**
Set your production domain in GitHub repository secrets:

1. Go to your GitHub repository
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click **"New repository secret"**
4. Name: `ALERT24_DOMAIN`
5. Value: `your-domain.pages.dev` (or your custom domain)

### 2. **Verify Workflow File**
The workflow file `.github/workflows/cron-jobs.yml` should be in your repository. It includes:

- **Escalation processing** (`*/2 * * * *`) - Every 2 minutes
- **Monitoring checks** (`*/5 * * * *`) - Every 5 minutes
- **Health checks** before each scheduled run
- **Failure notifications** if jobs fail
- **Manual trigger capability** for testing

### 3. **Enable GitHub Actions**
Ensure GitHub Actions are enabled for your repository:

1. Go to **Settings > Actions > General**
2. Ensure **"Allow all actions and reusable workflows"** is selected
3. Make sure **"Read and write permissions"** are granted

## 🧪 **Testing the Setup**

### **Manual Testing**
1. Go to **Actions** tab in your GitHub repository
2. Click on **"Alert24 Cron Jobs"** workflow
3. Click **"Run workflow"** button
4. Select which job to test:
   - `both` - Run both escalations and monitoring
   - `escalations` - Test escalation processing only
   - `monitoring` - Test monitoring checks only
5. Click **"Run workflow"**

### **Monitor Execution**
- Check the **Actions** tab for workflow runs
- View logs for detailed execution information
- Failed runs will show in red with error details

## 📊 **What Each Job Does**

### **Escalation Processing Job**
- **Endpoint**: `https://your-domain/api/escalations/cron`
- **Purpose**: Process timed-out escalations and escalate to next level
- **Frequency**: Every 2 minutes
- **Critical for**: Multi-level incident escalation

### **Monitoring Checks Job**
- **Endpoint**: `https://your-domain/api/monitoring/cron`
- **Purpose**: Execute scheduled monitoring checks
- **Frequency**: Every 5 minutes
- **Critical for**: Service monitoring and incident creation

### **Health Check Job**
- **Endpoint**: `https://your-domain/api/health`
- **Purpose**: Verify application is responding before running cron jobs
- **Frequency**: Before each scheduled run
- **Critical for**: Early failure detection

## 🔍 **Monitoring & Debugging**

### **GitHub Actions Logs**
Each job provides detailed logs including:
- HTTP response codes
- Response body content
- Execution summaries
- Error details if failures occur

### **Expected Output Examples**

**Successful Escalation Processing:**
```
🚨 Triggering escalation timeout processing...
HTTP Status: 200
✅ Escalation cron completed successfully
📊 Summary: Found 2 timeouts, processed 2, errors 0, duration 1234ms
```

**Successful Monitoring Checks:**
```
🔍 Triggering monitoring checks...
HTTP Status: 200
✅ Monitoring cron completed successfully
📊 Summary: 15/20 checks run, 13 passed, 2 failed, duration 3456ms
```

### **Failure Scenarios**
If jobs fail, you'll see:
- ❌ Error messages in workflow logs
- HTTP error codes and response bodies
- Automatic notifications in the workflow summary

## ⚠️ **Important Considerations**

### **GitHub Actions Limits**
- **Free tier**: 2,000 minutes/month for private repos
- **Public repos**: Unlimited minutes
- **Our usage**: ~2,160 minutes/month (very efficient jobs)

### **Reliability**
- GitHub Actions has 99.9% uptime SLA
- Jobs retry automatically on transient failures
- Manual triggering available if needed

### **Cost Analysis**
With our cron schedule:
- **Escalations**: 2 min intervals = 720 runs/day = ~21,600 runs/month
- **Monitoring**: 5 min intervals = 288 runs/day = ~8,640 runs/month
- **Total runtime**: ~1-2 seconds per job = ~60 minutes/month

**Result**: Well within GitHub's free tier limits.

## 🚀 **Deployment Checklist**

- [ ] GitHub Actions workflow file is in repository
- [ ] `ALERT24_DOMAIN` secret is configured
- [ ] GitHub Actions are enabled for repository
- [ ] Manual test run completed successfully
- [ ] Monitor first few scheduled runs
- [ ] Verify escalation and monitoring endpoints work
- [ ] Check application logs for cron execution

## 🔧 **Customization Options**

### **Changing Schedules**
Edit `.github/workflows/cron-jobs.yml`:
```yaml
schedule:
  - cron: '*/1 * * * *'  # Every 1 minute (more frequent)
  - cron: '*/10 * * * *' # Every 10 minutes (less frequent)
```

### **Adding Notifications**
You can add webhook notifications to the `notify-on-failure` job:
```yaml
- name: Send Slack Notification
  if: failure()
  run: |
    curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"Alert24 cron jobs failed!"}' \
    ${{ secrets.SLACK_WEBHOOK_URL }}
```

### **Environment-Specific Domains**
For multiple environments:
```yaml
env:
  ALERT24_DOMAIN: ${{ 
    github.ref == 'refs/heads/main' && secrets.PROD_DOMAIN || 
    secrets.STAGING_DOMAIN 
  }}
```

## 🆘 **Troubleshooting**

### **Common Issues**

1. **"ALERT24_DOMAIN secret not found"**
   - Add the secret in repository settings
   - Use your actual domain (without https://)

2. **"HTTP 404 or 500 errors"**
   - Verify your application is deployed and accessible
   - Check API endpoints exist and return 200 status

3. **"Jobs not running on schedule"**
   - Ensure GitHub Actions are enabled
   - Check if repository has recent activity (GitHub may pause inactive repos)

4. **"Workflow runs but does nothing"**
   - Check the `if` conditions in job definitions
   - Verify cron expressions are correct

### **Debug Commands**
Test endpoints manually:
```bash
# Health check
curl https://your-domain.pages.dev/api/health

# Escalation processing
curl https://your-domain.pages.dev/api/escalations/cron

# Monitoring checks
curl https://your-domain.pages.dev/api/monitoring/cron
```

## 📞 **Support**

If you encounter issues:
1. Check the **Actions** tab for detailed logs
2. Verify your API endpoints work manually
3. Ensure your domain secret is configured correctly
4. Review this documentation for common solutions

---

**Note**: This setup replaces the need for Vercel cron jobs and provides reliable scheduling for Cloudflare Pages deployments.