# Alert24 Incident Management Platform - Schema Updates

This directory contains SQL schema files to transform the existing Alert24 SaaS platform into a comprehensive incident management and monitoring platform combining features from Pingdom, PagerDuty, and StatusPage.io.

## 🗂️ File Overview

### Schema Update Files (Execute in Order)

1. **`01_incident_management_schema.sql`** - Core incident management tables
2. **`02_monitoring_system_schema.sql`** - Monitoring and alerting infrastructure  
3. **`03_enhanced_user_management.sql`** - User roles and notification preferences
4. **`04_status_page_enhancements.sql`** - Status page incident integration
5. **`05_database_functions.sql`** - Automated functions and triggers
6. **`06_indexes_and_constraints.sql`** - Performance and data integrity

## 📋 Execution Instructions

### Prerequisites
- PostgreSQL 12+ with public schema access
- alert24 database user with appropriate permissions
- Existing Alert24 SaaS schema (organizations, users, status pages, etc.)

### Step-by-Step Execution

```bash
# 1. Connect to your PostgreSQL instance
psql -h 34.223.13.196 -p 5432 -U alert24 -d alert24

# 2. Execute schema files in order
\i docs/schema-updates/01_incident_management_schema.sql
\i docs/schema-updates/02_monitoring_system_schema.sql
\i docs/schema-updates/03_enhanced_user_management.sql
\i docs/schema-updates/04_status_page_enhancements.sql
\i docs/schema-updates/05_database_functions.sql
\i docs/schema-updates/06_indexes_and_constraints.sql
```

### Alternative: Single Command Execution

```bash
# Execute all schema updates at once
psql -h 34.223.13.196 -p 5432 -U alert24 -d alert24 -f docs/schema-updates/01_incident_management_schema.sql
psql -h 34.223.13.196 -p 5432 -U alert24 -d alert24 -f docs/schema-updates/02_monitoring_system_schema.sql
psql -h 34.223.13.196 -p 5432 -U alert24 -d alert24 -f docs/schema-updates/03_enhanced_user_management.sql
psql -h 34.223.13.196 -p 5432 -U alert24 -d alert24 -f docs/schema-updates/04_status_page_enhancements.sql
psql -h 34.223.13.196 -p 5432 -U alert24 -d alert24 -f docs/schema-updates/05_database_functions.sql
psql -h 34.223.13.196 -p 5432 -U alert24 -d alert24 -f docs/schema-updates/06_indexes_and_constraints.sql
```

## 🔧 What Each File Does

### 01_incident_management_schema.sql
- **Purpose**: Core incident management functionality
- **Creates**: incidents, incident_updates, escalation_policies, notification_rules, on_call_schedules, incident_escalations tables
- **Key Features**: 
  - Incident severity and status tracking
  - Escalation policy engine
  - On-call schedule management
  - Timeline and update tracking

### 02_monitoring_system_schema.sql
- **Purpose**: Monitoring and alerting infrastructure
- **Creates**: monitoring_locations, monitoring_checks, check_results, check_schedules, monitoring_alerts, monitoring_statistics tables
- **Key Features**:
  - Multi-region monitoring locations
  - HTTP/HTTPS/ping/DNS/SSL monitoring
  - Configurable check intervals and thresholds
  - Automatic incident creation from failures
  - Statistical tracking and reporting

### 03_enhanced_user_management.sql
- **Purpose**: Extended user management for incident response
- **Extends**: users, organization_members tables
- **Creates**: user_contact_methods, user_notification_preferences, notification_history, team_groups, team_memberships, user_activity_log tables
- **Key Features**:
  - Incident management roles (admin, manager, responder, viewer)
  - Multi-channel contact methods (email, SMS, voice, Slack, Teams)
  - Notification preferences and quiet hours
  - Team organization and permissions
  - Activity auditing

### 04_status_page_enhancements.sql
- **Purpose**: Integration of status pages with incident management
- **Extends**: status_pages, status_page_components, subscribers tables
- **Creates**: status_page_incidents, component_status_history, uptime_calculations, subscriber_notifications, status_page_analytics, status_page_maintenance_windows tables
- **Key Features**:
  - Automatic status page updates from incidents
  - Component status tracking and history
  - Uptime calculations and reporting
  - Subscriber management and notifications
  - Maintenance window scheduling

### 05_database_functions.sql
- **Purpose**: Automated processes and business logic
- **Creates**: 15+ PostgreSQL functions and triggers
- **Key Features**:
  - Automatic incident creation from monitoring failures
  - Automatic incident resolution on monitoring recovery
  - Escalation policy processing
  - On-call schedule management
  - Uptime calculations
  - Data cleanup and maintenance

### 06_indexes_and_constraints.sql
- **Purpose**: Performance optimization and data integrity
- **Creates**: 50+ indexes, constraints, and materialized views
- **Key Features**:
  - Performance indexes for complex queries
  - Foreign key constraints across schemas
  - Data validation constraints
  - Row-level security (RLS) policies
  - Materialized views for analytics
  - Schema integrity validation

## 🧪 Testing and Validation

### After Execution, Run These Checks

```sql
-- 1. Verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Check schema integrity
SELECT * FROM validate_schema_integrity();

-- 3. Test basic functionality
-- Create a test incident
INSERT INTO incidents (organization_id, title, description, created_by) 
VALUES (
    (SELECT id FROM organizations LIMIT 1),
    'Test Incident',
    'Testing incident creation',
    (SELECT id FROM users LIMIT 1)
);

-- 4. Verify triggers work
SELECT COUNT(*) FROM user_activity_log WHERE activity_type = 'incident_status_changed';
```

## 📊 Schema Overview

### New Tables Added: 26
- Core Incident Management: 6 tables
- Monitoring System: 6 tables  
- Enhanced User Management: 6 tables
- Status Page Enhancements: 6 tables
- Utility/Logging: 2 tables

### Enhanced Existing Tables: 4
- users (incident management columns)
- organization_members (permission columns)
- status_pages (incident integration columns)
- status_page_components (monitoring integration columns)
- subscribers (notification preference columns)

### Functions Created: 15+
- Incident auto-creation and resolution
- Escalation processing
- On-call scheduling
- Uptime calculations
- Data cleanup and maintenance

### Indexes Added: 50+
- Performance indexes for complex queries
- JSON field indexes (GIN)
- Partial indexes for active records
- Composite indexes for common query patterns

## 🚀 Post-Migration Tasks

### 1. Set Up Cron Jobs
```sql
-- Schedule these functions to run periodically
SELECT process_pending_escalations();        -- Every 1 minute
SELECT calculate_all_component_uptime();     -- Daily at midnight
SELECT cleanup_old_data();                   -- Weekly
SELECT refresh_incident_statistics();        -- Daily
SELECT refresh_monitoring_statistics();      -- Daily
```

### 2. Configure Monitoring Locations
```sql
-- Verify monitoring locations were created
SELECT * FROM monitoring_locations;
```

### 3. Update Application Configuration
- Add Twilio credentials for SMS/voice notifications
- Configure Pusher for real-time updates  
- Set up monitoring check scheduling
- Configure email templates for notifications

### 4. Data Migration (if needed)
```sql
-- If you have existing incidents or monitoring data to migrate
-- Add custom migration scripts here
```

## 🔒 Security Considerations

### Row Level Security (RLS)
- All organization-scoped tables have RLS policies
- Users can only access data from their organizations
- User-specific data is isolated per user

### Permissions
- All tables granted appropriate permissions to alert24 user
- Functions executable by alert24 user
- Materialized views readable by alert24 user

### Data Protection
- Sensitive data (phone numbers, etc.) properly constrained
- Email validation in contact methods
- Audit logging for all user activities

## 📈 Performance Considerations

### Materialized Views
- `incident_statistics` - Daily incident metrics
- `monitoring_check_statistics` - Daily monitoring metrics
- Refresh periodically for up-to-date analytics

### Indexes
- All foreign keys indexed
- Common query patterns optimized
- JSON fields indexed with GIN indexes
- Partial indexes for active records only

### Data Retention
- Check results: 30 days
- Notification history: 90 days
- User activity logs: 180 days
- Uptime calculations: 1 year

## 🆘 Troubleshooting

### Common Issues

1. **Foreign Key Constraint Errors**
   - Ensure execution order is followed
   - Check that referenced tables exist

2. **Permission Errors**
   - Verify alert24 user has necessary permissions
   - Check schema search_path is correct

3. **Index Creation Failures**
   - Large tables may take time to index
   - Monitor disk space during creation

4. **Function Execution Errors**
   - Check PostgreSQL version compatibility
   - Verify all dependencies are installed

### Rollback Strategy
- Each file includes `IF NOT EXISTS` clauses for safety
- Most operations are additive and safe to retry
- Keep backups before major schema changes

## 📞 Support

For issues with schema updates:
1. Check PostgreSQL logs for specific error messages
2. Verify all prerequisites are met
3. Ensure proper execution order
4. Test with sample data after successful execution

---

**Next Steps**: After successful schema deployment, proceed with application code updates to integrate with the new incident management functionality. 