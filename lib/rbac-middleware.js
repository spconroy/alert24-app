/**
 * Role-Based Access Control (RBAC) Middleware for Alert24
 * 
 * This module provides centralized permission checking and authorization
 * for the Alert24 incident management platform.
 */

import { SupabaseClient } from './db-supabase.js';

const db = new SupabaseClient();

/**
 * Role hierarchy and permissions matrix
 */
const ROLE_HIERARCHY = {
  owner: 5,
  admin: 4, 
  responder: 3,
  stakeholder: 2,
  guest: 1
};

const PERMISSIONS = {
  // Organization management
  'organization.read': ['owner', 'admin', 'responder', 'stakeholder'],
  'organization.update': ['owner', 'admin'],
  'organization.delete': ['owner'],
  'organization.manage_settings': ['owner', 'admin'],

  // Member management
  'members.read': ['owner', 'admin', 'responder', 'stakeholder'],
  'members.invite': ['owner', 'admin'],
  'members.manage': ['owner', 'admin'],
  'members.remove': ['owner', 'admin'],
  'members.bulk_operations': ['owner', 'admin'],

  // Incident management
  'incidents.read': ['owner', 'admin', 'responder'],
  'incidents.create': ['owner', 'admin', 'responder'],
  'incidents.update': ['owner', 'admin', 'responder'],
  'incidents.delete': ['owner', 'admin'],
  'incidents.acknowledge': ['owner', 'admin', 'responder'],
  'incidents.resolve': ['owner', 'admin', 'responder'],

  // Service management
  'services.read': ['owner', 'admin', 'responder', 'stakeholder'],
  'services.create': ['owner', 'admin'],
  'services.update': ['owner', 'admin', 'responder'],
  'services.delete': ['owner', 'admin'],
  'services.manage_monitoring': ['owner', 'admin'],

  // Status pages
  'status_pages.read': ['owner', 'admin', 'responder', 'stakeholder'],
  'status_pages.create': ['owner', 'admin'],
  'status_pages.update': ['owner', 'admin', 'responder'],
  'status_pages.delete': ['owner', 'admin'],
  'status_pages.manage_public': ['owner', 'admin'],

  // Escalation policies
  'escalation.read': ['owner', 'admin', 'responder'],
  'escalation.create': ['owner', 'admin'],
  'escalation.update': ['owner', 'admin'],
  'escalation.delete': ['owner', 'admin'],

  // On-call schedules
  'oncall.read': ['owner', 'admin', 'responder'],
  'oncall.create': ['owner', 'admin'],
  'oncall.update': ['owner', 'admin'],
  'oncall.delete': ['owner', 'admin'],
  'oncall.participate': ['owner', 'admin', 'responder'],

  // Monitoring
  'monitoring.read': ['owner', 'admin', 'responder'],
  'monitoring.create': ['owner', 'admin'],
  'monitoring.update': ['owner', 'admin'],
  'monitoring.delete': ['owner', 'admin'],

  // Teams
  'teams.read': ['owner', 'admin', 'responder'],
  'teams.create': ['owner', 'admin'],
  'teams.update': ['owner', 'admin'],
  'teams.delete': ['owner', 'admin'],
  'teams.manage_members': ['owner', 'admin'],

  // Audit logs
  'audit.read': ['owner', 'admin'],
  'audit.export': ['owner', 'admin'],

  // Billing & subscriptions
  'billing.read': ['owner'],
  'billing.manage': ['owner'],
};

/**
 * RBAC Middleware Class
 */
export class RBACMiddleware {
  constructor() {
    this.db = db;
  }

  /**
   * Check if a user has a specific permission within an organization
   */
  async checkPermission(userId, organizationId, permission, resource = null) {
    try {
      // Get user's role in the organization
      const membership = await this.db.getOrganizationMember(organizationId, userId);
      if (!membership || !membership.is_active) {
        return { allowed: false, reason: 'User is not an active member of this organization' };
      }

      const userRole = membership.role;

      // Check if the role has the required permission
      const allowedRoles = PERMISSIONS[permission];
      if (!allowedRoles) {
        return { allowed: false, reason: `Unknown permission: ${permission}` };
      }

      const hasPermission = allowedRoles.includes(userRole);
      
      // For resource-specific permissions, perform additional checks
      if (hasPermission && resource) {
        const resourceCheck = await this.checkResourceAccess(userId, organizationId, userRole, resource);
        if (!resourceCheck.allowed) {
          return resourceCheck;
        }
      }

      return { 
        allowed: hasPermission, 
        reason: hasPermission ? 'Permission granted' : `Role '${userRole}' does not have permission '${permission}'`,
        userRole,
        membership 
      };
    } catch (error) {
      console.error('Error checking permission:', error);
      return { allowed: false, reason: 'Permission check failed', error: error.message };
    }
  }

  /**
   * Check if a user has access to a specific resource
   */
  async checkResourceAccess(userId, organizationId, userRole, resource) {
    const { type, id } = resource;

    try {
      switch (type) {
        case 'incident':
          // All responders+ can access incidents in their organization
          return { allowed: true, reason: 'User has access to organization incidents' };
          
        case 'service':
          // Check if service belongs to the organization
          const service = await this.db.getServiceById(id);
          if (!service || service.organization_id !== organizationId) {
            return { allowed: false, reason: 'Service not found or not in user organization' };
          }
          return { allowed: true, reason: 'User has access to organization service' };

        case 'status_page':
          // Check if status page belongs to the organization
          const statusPage = await this.db.getStatusPageById(id);
          if (!statusPage || statusPage.organization_id !== organizationId) {
            return { allowed: false, reason: 'Status page not found or not in user organization' };
          }
          return { allowed: true, reason: 'User has access to organization status page' };

        case 'team':
          // Check if team belongs to the organization
          const team = await this.db.getTeamGroup(id);
          if (!team || team.organization_id !== organizationId) {
            return { allowed: false, reason: 'Team not found or not in user organization' };
          }
          return { allowed: true, reason: 'User has access to organization team' };

        default:
          return { allowed: true, reason: 'Resource type not restricted' };
      }
    } catch (error) {
      console.error('Error checking resource access:', error);
      return { allowed: false, reason: 'Resource access check failed', error: error.message };
    }
  }

  /**
   * Require specific permission (throws error if not allowed)
   */
  async requirePermission(userId, organizationId, permission, resource = null) {
    const check = await this.checkPermission(userId, organizationId, permission, resource);
    if (!check.allowed) {
      const error = new Error(check.reason);
      error.statusCode = 403;
      error.permission = permission;
      error.userRole = check.userRole;
      throw error;
    }
    return check;
  }

  /**
   * Require minimum role level
   */
  async requireRole(userId, organizationId, minRole) {
    const membership = await this.db.getOrganizationMember(organizationId, userId);
    if (!membership || !membership.is_active) {
      const error = new Error('User is not an active member of this organization');
      error.statusCode = 403;
      throw error;
    }

    const userRoleLevel = ROLE_HIERARCHY[membership.role] || 0;
    const minRoleLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userRoleLevel < minRoleLevel) {
      const error = new Error(`Insufficient permissions. Required: ${minRole}, Current: ${membership.role}`);
      error.statusCode = 403;
      error.requiredRole = minRole;
      error.userRole = membership.role;
      throw error;
    }

    return { userRole: membership.role, membership };
  }

  /**
   * Check if user can perform bulk operations
   */
  async canPerformBulkOperations(userId, organizationId) {
    return this.checkPermission(userId, organizationId, 'members.bulk_operations');
  }

  /**
   * Check if user can manage specific member
   */
  async canManageMember(userId, organizationId, targetMemberId) {
    const check = await this.checkPermission(userId, organizationId, 'members.manage');
    if (!check.allowed) {
      return check;
    }

    // Additional check: Can't manage members with equal or higher role
    const userMembership = check.membership;
    const targetMembership = await this.db.getOrganizationMember(organizationId, targetMemberId);
    
    if (!targetMembership) {
      return { allowed: false, reason: 'Target member not found' };
    }

    const userRoleLevel = ROLE_HIERARCHY[userMembership.role] || 0;
    const targetRoleLevel = ROLE_HIERARCHY[targetMembership.role] || 0;

    // Owners can manage anyone, admins can't manage owners
    if (userMembership.role === 'owner') {
      return { allowed: true, reason: 'Owner can manage any member' };
    }

    if (targetRoleLevel >= userRoleLevel) {
      return { allowed: false, reason: 'Cannot manage members with equal or higher role' };
    }

    return { allowed: true, reason: 'User can manage this member' };
  }

  /**
   * Get user's effective permissions in an organization
   */
  async getUserPermissions(userId, organizationId) {
    try {
      const membership = await this.db.getOrganizationMember(organizationId, userId);
      if (!membership || !membership.is_active) {
        return { permissions: [], role: null, membership: null };
      }

      const userRole = membership.role;
      const permissions = Object.keys(PERMISSIONS).filter(permission => {
        const allowedRoles = PERMISSIONS[permission];
        return allowedRoles.includes(userRole);
      });

      return { permissions, role: userRole, membership };
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return { permissions: [], role: null, membership: null };
    }
  }

  /**
   * Create an Express.js middleware function for API routes
   */
  createExpressMiddleware(permission, options = {}) {
    return async (req, res, next) => {
      try {
        const { sessionManager } = options;
        
        // Get user from session
        let userId;
        if (sessionManager) {
          const session = await sessionManager.getSessionFromRequest(req);
          if (!session?.user?.email) {
            return res.status(401).json({ error: 'Unauthorized' });
          }
          const user = await this.db.getUserByEmail(session.user.email);
          if (!user) {
            return res.status(401).json({ error: 'User not found' });
          }
          userId = user.id;
        } else {
          // Assume userId is set by previous middleware
          userId = req.userId;
        }

        // Get organization ID from params or body
        const organizationId = req.params.organizationId || req.params.id || req.body.organizationId;
        if (!organizationId) {
          return res.status(400).json({ error: 'Organization ID required' });
        }

        // Check permission
        const check = await this.checkPermission(userId, organizationId, permission);
        if (!check.allowed) {
          return res.status(403).json({ 
            error: 'Forbidden', 
            reason: check.reason,
            permission,
            userRole: check.userRole 
          });
        }

        // Add user info to request for downstream use
        req.userId = userId;
        req.userRole = check.userRole;
        req.membership = check.membership;
        req.organizationId = organizationId;

        next();
      } catch (error) {
        console.error('RBAC middleware error:', error);
        res.status(500).json({ error: 'Permission check failed' });
      }
    };
  }

  /**
   * Log user activity for audit purposes
   */
  async logActivity(userId, organizationId, action, details = {}) {
    try {
      // This would integrate with the audit logging system
      // For now, just log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUDIT] User ${userId} performed ${action} in org ${organizationId}:`, details);
      }
      
      // TODO: Implement actual audit logging to database
      // await this.db.createActivityLog({
      //   user_id: userId,
      //   organization_id: organizationId,
      //   action,
      //   details,
      //   created_at: new Date().toISOString()
      // });
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw - audit logging failure shouldn't break the main operation
    }
  }
}

// Export singleton instance
export const rbac = new RBACMiddleware();
export default rbac;

// Export utility functions
export {
  ROLE_HIERARCHY,
  PERMISSIONS
};