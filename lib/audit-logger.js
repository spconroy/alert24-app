/**
 * Systematic Audit Logging System for Alert24
 * 
 * This module provides comprehensive activity tracking and audit logging
 * for security compliance and user activity monitoring.
 */

import { SupabaseClient } from './db-supabase.js';

const db = new SupabaseClient();

/**
 * Activity types for categorization
 */
export const ACTIVITY_TYPES = {
  // Authentication
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_FAILED_LOGIN: 'auth.failed_login',

  // Organization management
  ORG_CREATED: 'organization.created',
  ORG_UPDATED: 'organization.updated',
  ORG_DELETED: 'organization.deleted',
  ORG_SETTINGS_CHANGED: 'organization.settings_changed',

  // Member management
  MEMBER_INVITED: 'member.invited',
  MEMBER_ACCEPTED: 'member.accepted',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_BULK_INVITE: 'member.bulk_invite',
  MEMBER_BULK_ROLE_CHANGE: 'member.bulk_role_change',
  MEMBER_BULK_REMOVE: 'member.bulk_remove',

  // Incident management
  INCIDENT_CREATED: 'incident.created',
  INCIDENT_UPDATED: 'incident.updated',
  INCIDENT_STATUS_CHANGED: 'incident.status_changed',
  INCIDENT_ACKNOWLEDGED: 'incident.acknowledged',
  INCIDENT_RESOLVED: 'incident.resolved',
  INCIDENT_DELETED: 'incident.deleted',

  // Service management
  SERVICE_CREATED: 'service.created',
  SERVICE_UPDATED: 'service.updated',
  SERVICE_STATUS_CHANGED: 'service.status_changed',
  SERVICE_DELETED: 'service.deleted',

  // Status page management
  STATUS_PAGE_CREATED: 'status_page.created',
  STATUS_PAGE_UPDATED: 'status_page.updated',
  STATUS_PAGE_PUBLISHED: 'status_page.published',
  STATUS_PAGE_UNPUBLISHED: 'status_page.unpublished',
  STATUS_PAGE_DELETED: 'status_page.deleted',

  // Monitoring
  MONITOR_CREATED: 'monitor.created',
  MONITOR_UPDATED: 'monitor.updated',
  MONITOR_DELETED: 'monitor.deleted',
  MONITOR_STATUS_CHANGED: 'monitor.status_changed',

  // Team management
  TEAM_CREATED: 'team.created',
  TEAM_UPDATED: 'team.updated',
  TEAM_DELETED: 'team.deleted',
  TEAM_MEMBER_ADDED: 'team.member_added',
  TEAM_MEMBER_REMOVED: 'team.member_removed',

  // Escalation policies
  ESCALATION_CREATED: 'escalation.created',
  ESCALATION_UPDATED: 'escalation.updated',
  ESCALATION_DELETED: 'escalation.deleted',

  // On-call schedules
  ONCALL_CREATED: 'oncall.created',
  ONCALL_UPDATED: 'oncall.updated',
  ONCALL_DELETED: 'oncall.deleted',

  // Security events
  SECURITY_PERMISSION_DENIED: 'security.permission_denied',
  SECURITY_SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
  SECURITY_API_KEY_CREATED: 'security.api_key_created',
  SECURITY_API_KEY_REVOKED: 'security.api_key_revoked',

  // Data access
  DATA_EXPORTED: 'data.exported',
  DATA_IMPORTED: 'data.imported',
  DATA_BULK_OPERATION: 'data.bulk_operation',

  // Settings
  SETTINGS_NOTIFICATION_CHANGED: 'settings.notification_changed',
  SETTINGS_PROFILE_UPDATED: 'settings.profile_updated',
  SETTINGS_PASSWORD_CHANGED: 'settings.password_changed',
};

/**
 * Audit Logger Class
 */
export class AuditLogger {
  constructor() {
    this.db = db;
  }

  /**
   * Log a user activity with comprehensive details
   */
  async log({
    userId,
    organizationId = null,
    activityType,
    description,
    details = {},
    ipAddress = null,
    userAgent = null,
    resource = null,
    oldValues = null,
    newValues = null,
    incidentId = null,
    serviceId = null,
    success = true,
    errorMessage = null
  }) {
    try {
      const timestamp = new Date().toISOString();
      
      // Prepare the activity log entry
      const logEntry = {
        user_id: userId,
        organization_id: organizationId,
        activity_type: activityType,
        description,
        details: {
          ...details,
          ip_address: ipAddress,
          user_agent: userAgent,
          resource,
          old_values: oldValues,
          new_values: newValues,
          success,
          error_message: errorMessage,
          timestamp
        },
        incident_id: incidentId,
        service_id: serviceId,
        created_at: timestamp
      };

      // Store in database
      const { data, error } = await this.db.client
        .from('user_activity_log')
        .insert(logEntry)
        .select()
        .single();

      if (error) {
        console.error('Failed to log activity:', error);
        // Fallback to console logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log('[AUDIT FALLBACK]', logEntry);
        }
        return null;
      }

      // Log to console in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUDIT] ${activityType}: ${description}`, details);
      }

      return data;
    } catch (error) {
      console.error('Error in audit logging:', error);
      return null;
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(userId, activityType, details = {}, request = null) {
    const ipAddress = this.extractIpAddress(request);
    const userAgent = request?.headers?.['user-agent'] || null;

    return this.log({
      userId,
      activityType,
      description: this.getDefaultDescription(activityType),
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log member management activities
   */
  async logMemberActivity(userId, organizationId, activityType, details = {}) {
    return this.log({
      userId,
      organizationId,
      activityType,
      description: this.getDefaultDescription(activityType, details),
      details
    });
  }

  /**
   * Log bulk operations with detailed results
   */
  async logBulkOperation(userId, organizationId, activityType, details = {}) {
    const { successful = 0, failed = 0, total = 0, results = [] } = details;
    
    return this.log({
      userId,
      organizationId,
      activityType,
      description: `Bulk operation: ${successful}/${total} successful, ${failed} failed`,
      details: {
        ...details,
        summary: { successful, failed, total },
        results
      }
    });
  }

  /**
   * Log security events
   */
  async logSecurity(userId, organizationId, activityType, details = {}, request = null) {
    const ipAddress = this.extractIpAddress(request);
    const userAgent = request?.headers?.['user-agent'] || null;

    return this.log({
      userId,
      organizationId,
      activityType,
      description: this.getDefaultDescription(activityType, details),
      details: {
        ...details,
        severity: 'high'
      },
      ipAddress,
      userAgent,
      success: false
    });
  }

  /**
   * Log data changes with before/after values
   */
  async logDataChange(userId, organizationId, activityType, resource, oldValues, newValues, details = {}) {
    return this.log({
      userId,
      organizationId,
      activityType,
      description: this.getDefaultDescription(activityType, { resource }),
      details,
      resource,
      oldValues,
      newValues
    });
  }

  /**
   * Get activity logs with filtering and pagination
   */
  async getActivityLogs(filters = {}) {
    try {
      let query = this.db.client
        .from('user_activity_log')
        .select(`
          *,
          users(name, email),
          organizations(name)
        `);

      // Apply filters
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.organizationId) {
        query = query.eq('organization_id', filters.organizationId);
      }

      if (filters.activityType) {
        query = query.eq('activity_type', filters.activityType);
      }

      if (filters.activityTypes && Array.isArray(filters.activityTypes)) {
        query = query.in('activity_type', filters.activityTypes);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters.search) {
        query = query.or(`description.ilike.%${filters.search}%,activity_type.ilike.%${filters.search}%`);
      }

      // Add pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;

      return {
        data: data || [],
        hasMore: data?.length === limit,
        offset: offset + limit
      };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics for dashboard
   */
  async getActivityStats(organizationId, days = 30) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await this.db.client
        .from('user_activity_log')
        .select('activity_type, created_at')
        .eq('organization_id', organizationId)
        .gte('created_at', startDate);

      if (error) throw error;

      // Group activities by type and date
      const stats = {
        totalActivities: data.length,
        activitiesByType: {},
        activitiesByDay: {},
        mostActiveUsers: {},
        recentActivities: data.slice(0, 10)
      };

      data.forEach(activity => {
        // By type
        stats.activitiesByType[activity.activity_type] = 
          (stats.activitiesByType[activity.activity_type] || 0) + 1;

        // By day
        const day = activity.created_at.split('T')[0];
        stats.activitiesByDay[day] = (stats.activitiesByDay[day] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      throw error;
    }
  }

  /**
   * Export activity logs for compliance
   */
  async exportActivityLogs(organizationId, filters = {}) {
    try {
      const logs = await this.getActivityLogs({
        ...filters,
        organizationId,
        limit: 10000 // Large limit for export
      });

      // Format for CSV export
      const csvData = logs.data.map(log => ({
        timestamp: log.created_at,
        user: log.users?.name || log.users?.email || 'Unknown',
        activity_type: log.activity_type,
        description: log.description,
        organization: log.organizations?.name || 'Unknown',
        ip_address: log.details?.ip_address || '',
        user_agent: log.details?.user_agent || '',
        success: log.details?.success !== false ? 'Yes' : 'No'
      }));

      return csvData;
    } catch (error) {
      console.error('Error exporting activity logs:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupOldLogs(retentionDays = 365) {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await this.db.client
        .from('user_activity_log')
        .delete()
        .lt('created_at', cutoffDate);

      if (error) throw error;

      console.log(`Cleaned up audit logs older than ${retentionDays} days`);
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  extractIpAddress(request) {
    if (!request) return null;
    
    return request.headers['x-forwarded-for']?.split(',')[0] ||
           request.headers['x-real-ip'] ||
           request.connection?.remoteAddress ||
           request.socket?.remoteAddress ||
           null;
  }

  getDefaultDescription(activityType, details = {}) {
    const descriptions = {
      [ACTIVITY_TYPES.AUTH_LOGIN]: 'User logged in',
      [ACTIVITY_TYPES.AUTH_LOGOUT]: 'User logged out',
      [ACTIVITY_TYPES.AUTH_FAILED_LOGIN]: 'Failed login attempt',
      
      [ACTIVITY_TYPES.MEMBER_INVITED]: `Invited ${details.email || 'member'} as ${details.role || 'member'}`,
      [ACTIVITY_TYPES.MEMBER_ACCEPTED]: 'Accepted organization invitation',
      [ACTIVITY_TYPES.MEMBER_ROLE_CHANGED]: `Changed role to ${details.newRole || 'unknown'}`,
      [ACTIVITY_TYPES.MEMBER_REMOVED]: 'Removed from organization',
      [ACTIVITY_TYPES.MEMBER_BULK_INVITE]: `Bulk invited ${details.count || 0} members`,
      [ACTIVITY_TYPES.MEMBER_BULK_ROLE_CHANGE]: `Bulk changed roles for ${details.count || 0} members`,
      [ACTIVITY_TYPES.MEMBER_BULK_REMOVE]: `Bulk removed ${details.count || 0} members`,
      
      [ACTIVITY_TYPES.INCIDENT_CREATED]: `Created incident: ${details.title || 'Untitled'}`,
      [ACTIVITY_TYPES.INCIDENT_STATUS_CHANGED]: `Changed incident status to ${details.status || 'unknown'}`,
      [ACTIVITY_TYPES.INCIDENT_ACKNOWLEDGED]: 'Acknowledged incident',
      [ACTIVITY_TYPES.INCIDENT_RESOLVED]: 'Resolved incident',
      
      [ACTIVITY_TYPES.SERVICE_CREATED]: `Created service: ${details.name || 'Untitled'}`,
      [ACTIVITY_TYPES.SERVICE_STATUS_CHANGED]: `Changed service status to ${details.status || 'unknown'}`,
      
      [ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED]: `Permission denied for ${details.permission || 'unknown action'}`,
      [ACTIVITY_TYPES.SECURITY_SUSPICIOUS_ACTIVITY]: `Suspicious activity detected: ${details.reason || 'unknown'}`
    };

    return descriptions[activityType] || `Activity: ${activityType}`;
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();
export default auditLogger;