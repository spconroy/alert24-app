# Monitoring & Service Association Feature

## 🎯 Overview

The Monitoring & Service Association feature allows you to link monitoring checks with status page services. When a monitoring check fails, the associated service status is automatically updated on your status page, providing real-time status visibility to your users.

## ✨ Key Features

### Automatic Status Updates

- **Monitoring Check → Service Status**: When monitoring checks fail, linked services automatically update to show the correct status
- **Real-time Synchronization**: Status changes happen immediately when checks run
- **Intelligent Status Mapping**: Different failure types map to appropriate service statuses

### Status Mapping Logic

| Monitoring Result       | Service Status | Description                                  |
| ----------------------- | -------------- | -------------------------------------------- |
| ✅ Success              | `operational`  | Service is working normally                  |
| ❌ HTTP 5xx Error       | `down`         | Server errors indicate service is down       |
| ⚠️ HTTP 4xx Error       | `degraded`     | Client errors indicate partial functionality |
| 🐌 Slow Response (>10s) | `degraded`     | Performance issues                           |
| ❌ Other Failures       | `degraded`     | General issues affecting service             |

## 🏗️ Technical Implementation

### API Endpoints

#### `GET /api/monitoring/associate`

Get monitoring associations for an organization.

**Parameters:**

- `organization_id` (required) - Organization UUID
- `monitoring_check_id` (optional) - Filter by specific check
- `service_id` (optional) - Filter by specific service

**Response:**

```json
{
  "success": true,
  "associations": [
    {
      "monitoring_check_id": "uuid",
      "monitoring_check_name": "API Health Check",
      "check_type": "http",
      "target_url": "https://api.example.com/health",
      "status": "active",
      "linked_service_id": "uuid",
      "linked_service_name": "API Service"
    }
  ],
  "available_services": [...]
}
```

#### `POST /api/monitoring/associate`

Create or update an association between a monitoring check and service.

**Body:**

```json
{
  "monitoringCheckId": "uuid",
  "serviceId": "uuid", // null to remove association
  "organizationId": "uuid"
}
```

#### `DELETE /api/monitoring/associate`

Remove an association.

**Parameters:**

- `monitoring_check_id` (required)
- `organization_id` (required)

### Database Storage

Associations are stored in the monitoring check data within the `services` table:

```json
{
  "type": "monitoring_check",
  "name": "API Health Check",
  "check_type": "http",
  "target_url": "https://api.example.com/health",
  "linked_service_id": "service-uuid-here"
  // ... other monitoring data
}
```

### Automatic Status Updates

The system updates linked service status in two places:

1. **Manual Execution** (`/api/monitoring/execute`): When users manually run checks
2. **Scheduled Execution** (`/api/monitoring/scheduler`): When the system automatically runs checks

Both call the `updateLinkedServiceStatus()` function after processing check results.

## 🎨 UI Component

### MonitoringServiceAssociation Component

A React component that provides a user-friendly interface for managing associations.

**Key Features:**

- **Association Table**: Shows all monitoring checks and their linked services
- **Create Association Dialog**: Easy interface to link checks with services
- **Status Indicators**: Visual representation of check and service status
- **Quick Actions**: One-click linking/unlinking

**Usage:**

```jsx
import MonitoringServiceAssociation from '@/components/MonitoringServiceAssociation';

function SettingsPage() {
  return <MonitoringServiceAssociation organizationId={organizationId} />;
}
```

## 🔄 Workflow Example

### 1. Setup Phase

```
User creates:
├── Status Page: "Company Status"
├── Service: "API Service" (status: operational)
└── Monitoring Check: "API Health Check" (https://api.company.com/health)
```

### 2. Association Phase

```
User associates:
"API Health Check" → "API Service"
```

### 3. Monitoring Phase

```
System monitors every 5 minutes:
┌─ Check fails (HTTP 500)
├─ Service status: operational → down
├─ Incident auto-created
├─ Email notifications sent
└─ Status page shows: "API Service: DOWN"
```

### 4. Recovery Phase

```
System detects recovery:
┌─ Check succeeds (HTTP 200)
├─ Service status: down → operational
├─ Incident auto-resolved
└─ Status page shows: "API Service: OPERATIONAL"
```

## 📊 Benefits

### For Site Reliability Engineers

- **Automated Status Management**: No manual status page updates needed
- **Faster Incident Response**: Issues are detected and communicated immediately
- **Comprehensive Monitoring**: Link multiple checks to different service aspects

### For End Users

- **Real-time Visibility**: Always see current service status
- **Proactive Communication**: Know about issues before experiencing them
- **Detailed Information**: Understand what specific components are affected

### For Organizations

- **Professional Image**: Transparent, automated status communication
- **Reduced Support Load**: Users see status before contacting support
- **Compliance**: Meet SLA reporting requirements automatically

## 🔧 Configuration Best Practices

### 1. One-to-One Mapping

```
✅ Good: API Service ← API Health Check
❌ Avoid: API Service ← Multiple unrelated checks
```

### 2. Service Granularity

```
✅ Good:
├── Authentication Service ← Auth Check
├── Database Service ← DB Check
└── CDN Service ← CDN Check

❌ Too broad:
└── Entire Platform ← All checks
```

### 3. Check Frequency

```
✅ Critical Services: 1-2 minute intervals
✅ Standard Services: 5 minute intervals
✅ Background Services: 15+ minute intervals
```

## 🚀 Integration Examples

### Example 1: E-commerce Platform

```
Status Page Services:
├── Website (← Web Health Check)
├── Shopping Cart (← Cart API Check)
├── Payment Processing (← Payment API Check)
├── User Accounts (← Auth API Check)
└── Search (← Search API Check)
```

### Example 2: SaaS Application

```
Status Page Services:
├── Application (← App Health Check)
├── API (← API Health Check)
├── Database (← DB Connection Check)
├── File Storage (← Storage Check)
└── Email Service (← SMTP Check)
```

## 🔒 Security & Permissions

### Required Permissions

- **Association Management**: `owner`, `admin`, `responder` roles
- **View Associations**: All organization members
- **Automatic Updates**: System-level (no user required)

### Data Protection

- All association data is organization-scoped
- Users can only see associations for their organizations
- Monitoring results are processed securely
- Status updates maintain audit trails

## 📈 Monitoring & Metrics

### Association Health Metrics

- **Active Associations**: Number of linked monitoring-service pairs
- **Status Update Frequency**: How often services change status
- **Recovery Time**: How quickly services return to operational
- **False Positive Rate**: Unnecessary status changes

### Logs & Debugging

```
✅ Monitor logs for:
├── "🔗 Updated linked service"
├── "Linked service not found"
├── "Association created/removed"
└── Status change timestamps
```

## 🔮 Future Enhancements

### Planned Features

- **Multi-Check Dependencies**: Require multiple checks to fail before status change
- **Custom Status Mappings**: Define organization-specific status rules
- **Maintenance Mode**: Automatic maintenance status during deployments
- **Service Dependencies**: Cascade status updates through dependent services
- **Recovery Delays**: Wait for sustained recovery before status update

### Integration Roadmap

- **Slack/Teams Notifications**: Status change alerts in team channels
- **Webhook Support**: Send status changes to external systems
- **API Webhooks**: Real-time status updates for external monitoring
- **Custom Dashboards**: Organization-specific status visualization

This feature transforms Alert24 into a comprehensive status communication platform, bridging the gap between monitoring infrastructure and user-facing status pages.
