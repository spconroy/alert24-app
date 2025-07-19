# Authorized Domains Feature

## Overview

The Authorized Domains feature allows organization administrators to whitelist email domains for automatic user enrollment. When users sign in with Google OAuth using an email from an authorized domain, they're automatically added to the organization with a predefined role, eliminating the need for manual invitations.

## Business Value

### **🏢 Enterprise Onboarding**

- **Streamlined Team Access**: New employees can instantly access the organization
- **Reduced Admin Overhead**: No manual invitations or approval processes
- **Scalable Growth**: Supports organizations with frequent new hires
- **Professional Experience**: Immediate access builds confidence in the platform

### **🎯 Target Customers**

- **Enterprise Customers**: Companies with 50+ employees
- **Growing Teams**: Startups scaling rapidly
- **Educational Institutions**: Schools with standardized email domains
- **Consulting Firms**: Organizations with structured email domains

## How It Works

### **1. Domain Authorization**

Admins configure authorized domains in Settings:

```
Domain: company.com
Role: member (or admin)
Limit: 100 enrollments (optional)
```

### **2. Automatic Enrollment**

When `john@company.com` signs in with Google:

1. System checks if `company.com` is authorized
2. User is automatically added to the organization as `member`
3. Enrollment is logged for audit trail
4. User gets immediate access without waiting for approval

### **3. Security & Control**

- Only admins/owners can manage authorized domains
- Enrollment limits prevent abuse
- Complete audit trail for compliance
- Domain validation prevents typos

## Database Schema

### **Core Tables**

#### `authorized_domains`

```sql
- id (UUID, Primary Key)
- organization_id (UUID, Foreign Key)
- domain (VARCHAR, e.g., "company.com")
- description (TEXT, optional notes)
- auto_role (VARCHAR, "member" or "admin")
- is_active (BOOLEAN)
- require_verification (BOOLEAN)
- max_auto_enrollments (INTEGER, nullable)
- current_enrollments (INTEGER)
- created_by (UUID, Foreign Key to users)
- last_used_at (TIMESTAMP)
- created_at, updated_at (TIMESTAMPS)
```

#### `domain_enrollment_log`

```sql
- id (UUID, Primary Key)
- authorized_domain_id (UUID, Foreign Key)
- organization_id (UUID, Foreign Key)
- user_id (UUID, Foreign Key)
- email (VARCHAR)
- domain (VARCHAR)
- assigned_role (VARCHAR)
- enrollment_method (VARCHAR, "oauth_signin")
- ip_address (INET, optional)
- user_agent (TEXT, optional)
- status (VARCHAR, "enrolled"/"revoked"/"suspended")
- enrolled_at (TIMESTAMP)
- revoked_at, revoked_by, revoke_reason (for revocations)
```

### **Database Functions**

#### `check_authorized_domain(email_address TEXT)`

- Extracts domain from email
- Returns matching authorized domains with organization info
- Respects enrollment limits and active status

#### `enroll_user_via_domain(user_id, email, ip, user_agent)`

- Automatically enrolls user in organization
- Creates organization membership record
- Logs enrollment in audit table
- Updates enrollment counters
- Returns success/failure with details

#### `validate_domain_format(domain_name TEXT)`

- Validates domain format with regex
- Ensures proper length and structure
- Prevents invalid domains

## API Endpoints

### **List Authorized Domains**

```
GET /api/authorized-domains?organizationId=uuid
Authorization: Required (member+)
Response: { domains: [...], count: number }
```

### **Create Authorized Domain**

```
POST /api/authorized-domains
Authorization: Required (admin/owner only)
Body: {
  organizationId: uuid,
  domain: string,
  description?: string,
  autoRole: "member" | "admin",
  maxAutoEnrollments?: number,
  requireVerification?: boolean
}
```

### **Update Authorized Domain**

```
PUT /api/authorized-domains/{id}
Authorization: Required (admin/owner only)
Body: { ...same fields as create... }
```

### **Delete Authorized Domain**

```
DELETE /api/authorized-domains/{id}
Authorization: Required (admin/owner only)
Response: { message: "success" }
```

## Frontend Components

### **AuthorizedDomainsManager.jsx**

Complete management interface featuring:

#### **Domain List Table**

- Domain name with icon
- Description and auto-assigned role
- Enrollment counters (current/max)
- Status indicators (active, verification required)
- Created by information
- Edit/delete actions

#### **Add/Edit Dialog**

- Domain input with validation
- Description field
- Role selection (member/admin)
- Enrollment limit setting
- Verification and active toggles

#### **Features**

- Real-time data fetching
- Form validation and error handling
- Success/error notifications
- Responsive design for mobile
- Admin-only access controls

### **Settings Page Integration**

- Appears in Settings only for admins/owners
- Clean separation from other settings sections
- Contextual to selected organization

## Security Considerations

### **Access Control**

- Only organization admins/owners can manage domains
- Row Level Security (RLS) enforces multi-tenant isolation
- API endpoints validate permissions before operations

### **Domain Validation**

- Regex validation prevents invalid domains
- Case-insensitive domain matching
- Unique constraint prevents duplicates per organization

### **Enrollment Limits**

- Optional maximum enrollment limits prevent abuse
- Real-time counter tracking
- Configurable per domain

### **Audit Trail**

- Complete log of all auto-enrollments
- IP address and user agent tracking
- Revocation tracking with reasons
- Compliance-ready audit reports

## User Experience

### **For Administrators**

#### **Setup Process**

1. Navigate to Settings → Authorized Domains
2. Click "Add Domain"
3. Enter domain (e.g., `company.com`)
4. Choose auto-assigned role
5. Set optional enrollment limit
6. Save and activate

#### **Management**

- View all authorized domains in clean table
- See enrollment statistics in real-time
- Edit domain settings or deactivate as needed
- Monitor audit logs for compliance

### **For End Users**

#### **Seamless Experience**

1. User visits Alert24 and clicks "Sign in with Google"
2. Completes Google OAuth flow normally
3. System detects authorized domain match
4. User is automatically enrolled with appropriate role
5. User lands in organization dashboard immediately
6. No waiting for approval or manual setup

#### **Clear Communication**

- Success messages explain automatic enrollment
- Role assignment is clearly communicated
- Contact information provided for questions

## Configuration Examples

### **Enterprise Company**

```
Domain: acmecorp.com
Role: member
Description: Acme Corp employees auto-enrollment
Max Enrollments: unlimited
Verification: required
```

### **Small Team with Limits**

```
Domain: startup.io
Role: member
Description: Startup team members
Max Enrollments: 25
Verification: required
```

### **Admin Domain**

```
Domain: admin.company.com
Role: admin
Description: IT department admin access
Max Enrollments: 5
Verification: required
```

## Implementation Status

### ✅ **Completed Features**

- Database schema with functions and triggers
- API endpoints with comprehensive validation
- Frontend management interface
- Google OAuth integration
- Settings page integration
- Security and access controls
- Audit logging and compliance features

### 📋 **Usage Instructions**

#### **For Database Setup**

```sql
-- Run the schema migration
\i docs/schema-updates/13_authorized_domains_feature.sql
```

#### **For Testing**

1. Create an organization as admin/owner
2. Navigate to Settings → Authorized Domains
3. Add your email domain (e.g., if using test@gmail.com, add "gmail.com")
4. Set role to "member" or "admin"
5. Sign out and sign in again - should auto-enroll

#### **For Production**

1. Deploy database schema updates
2. Configure production domain whitelist
3. Train administrators on domain management
4. Monitor enrollment logs for security

## Future Enhancements

### **Advanced Features**

- **Domain Groups**: Organize multiple domains together
- **Role Mapping**: Different roles for different subdomains
- **Time-based Enrollment**: Temporary domain authorization
- **Integration APIs**: Webhooks for external systems
- **Bulk Import**: CSV upload for multiple domains

### **Analytics & Reporting**

- **Enrollment Analytics**: Track signup patterns
- **Domain Performance**: Most active domains
- **Security Reports**: Failed enrollment attempts
- **Usage Metrics**: ROI of auto-enrollment feature

### **Enhanced Security**

- **Domain Verification**: Prove domain ownership via DNS
- **MFA Requirements**: Require 2FA for auto-enrolled users
- **Geo-restrictions**: Location-based enrollment rules
- **Time Windows**: Only allow enrollment during business hours

## Troubleshooting

### **Common Issues**

#### **Domain Not Working**

1. Check domain spelling and format
2. Verify domain is active in settings
3. Check enrollment limits haven't been reached
4. Confirm user email exactly matches domain

#### **User Not Auto-Enrolled**

1. Verify user signed in with Google (not manual login)
2. Check domain configuration is active
3. Review enrollment logs for error messages
4. Confirm user isn't already organization member

#### **Permission Errors**

1. Verify user has admin/owner role in organization
2. Check organization membership is active
3. Confirm user is authenticated properly

### **Debugging Tools**

- Check browser console for API errors
- Review server logs for enrollment attempts
- Query `domain_enrollment_log` table for audit trail
- Use database functions to test domain matching

## Business Impact

### **Metrics to Track**

- **Enrollment Velocity**: Time from hire to platform access
- **Admin Efficiency**: Reduction in manual invitation tasks
- **User Satisfaction**: Onboarding experience scores
- **Feature Adoption**: Percentage of organizations using domains

### **Success Indicators**

- Reduced support tickets for access requests
- Faster time-to-productivity for new team members
- Higher enterprise customer satisfaction scores
- Increased platform adoption in large organizations

The Authorized Domains feature represents a significant step toward enterprise-ready user management, providing the streamlined onboarding experience that modern organizations expect while maintaining security and administrative control.
