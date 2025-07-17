import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database client wrapper for Alert24 app
export class SupabaseClient {
  constructor() {
    this.client = supabase;
  }

  // Execute a raw SQL query using Supabase RPC
  async query(sql, params = []) {
    try {
      // For simple queries, we can use Supabase's query builder
      // For complex queries, we'll need to create stored procedures
      console.log('Executing query:', sql, 'with params:', params);

      // This is a placeholder - we'll need to implement specific methods
      // for each table/operation based on the SQL queries used in the app
      throw new Error(
        'Raw SQL queries not supported - use specific methods instead'
      );
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Organizations
  async getOrganizations(userId) {
    const { data, error } = await this.client
      .from('organizations')
      .select(
        `
        *,
        organization_members!inner(user_id, role)
      `
      )
      .eq('organization_members.user_id', userId);

    if (error) throw error;

    // Flatten the role to the top level for easier frontend access
    return data.map(org => ({
      ...org,
      role: org.organization_members[0]?.role,
      // Remove the nested organization_members array since we've extracted the role
      organization_members: undefined,
    }));
  }

  async createOrganization(orgData, userId) {
    // Start a transaction-like operation
    const { data: org, error: orgError } = await this.client
      .from('organizations')
      .insert(orgData)
      .select()
      .single();

    if (orgError) throw orgError;

    // Add user as owner
    const { error: memberError } = await this.client
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: userId,
        role: 'owner',
      });

    if (memberError) throw memberError;
    return org;
  }

  // Users
  async getUserByEmail(email) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  }

  async createUser(userData) {
    const { data, error } = await this.client
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Services
  async getServicesByOrganization(organizationId) {
    const { data, error } = await this.client
      .from('services')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return data;
  }

  async createService(serviceData) {
    const { data, error } = await this.client
      .from('services')
      .insert(serviceData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Incidents
  async getIncidentsByOrganization(organizationId) {
    const { data, error } = await this.client
      .from('incidents')
      .select(
        `
        *,
        services(name)
      `
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createIncident(incidentData) {
    const { data, error } = await this.client
      .from('incidents')
      .insert(incidentData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Status Pages
  async getStatusPagesByOrganization(organizationId) {
    const { data, error } = await this.client
      .from('status_pages')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return data;
  }

  async getStatusPageBySlug(slug) {
    const { data, error } = await this.client
      .from('status_pages')
      .select(
        `
        *,
        organizations(name, logo_url),
        status_page_services(
          service_id,
          services(name, description)
        )
      `
      )
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Monitoring
  async getMonitoringByService(serviceId) {
    const { data, error } = await this.client
      .from('service_monitoring')
      .select('*')
      .eq('service_id', serviceId);

    if (error) throw error;
    return data;
  }

  async createMonitoringCheck(monitoringData) {
    const { data, error } = await this.client
      .from('service_monitoring')
      .insert(monitoringData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Generic table operations
  async select(table, columns = '*', filters = {}) {
    let query = this.client.from(table).select(columns);

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async insert(table, data) {
    const { data: result, error } = await this.client
      .from(table)
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async update(table, id, data) {
    const { data: result, error } = await this.client
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async delete(table, id) {
    const { error } = await this.client.from(table).delete().eq('id', id);

    if (error) throw error;
    return { success: true };
  }

  // Organization Members & Invitations
  async getOrganizationMember(organizationId, userId) {
    const { data, error } = await this.client
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getPendingInvitations(organizationId) {
    const { data, error } = await this.client
      .from('organization_members')
      .select(
        `
        id,
        invitation_token,
        invited_at,
        invitation_expires_at,
        role,
        user_id,
        users!organization_members_user_id_fkey(email, name),
        invited_by_user:users!organization_members_invited_by_fkey(name)
      `
      )
      .eq('organization_id', organizationId)
      .is('accepted_at', null)
      .not('invitation_token', 'is', null)
      .gt('invitation_expires_at', new Date().toISOString())
      .order('invited_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async createInvitation(invitationData) {
    const { data, error } = await this.client
      .from('organization_members')
      .upsert(invitationData, {
        onConflict: 'organization_id,user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserById(userId) {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getOrganizationById(organizationId) {
    const { data, error } = await this.client
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Incidents
  async getIncidentById(incidentId, userId) {
    const { data, error } = await this.client
      .from('incidents')
      .select(
        `
        *,
        organizations(name),
        created_by_user:users!incidents_created_by_fkey(name, email),
        assigned_to_user:users!incidents_assigned_to_fkey(name, email),
        escalation_policies(name, escalation_timeout_minutes),
        organization_members!inner(user_id)
      `
      )
      .eq('id', incidentId)
      .eq('organization_members.user_id', userId)
      .eq('organization_members.is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateIncident(incidentId, updateData) {
    const { data, error } = await this.client
      .from('incidents')
      .update(updateData)
      .eq('id', incidentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteIncident(incidentId) {
    const { error } = await this.client
      .from('incidents')
      .delete()
      .eq('id', incidentId);

    if (error) throw error;
    return { success: true };
  }

  // Services
  async getServiceById(serviceId) {
    const { data, error } = await this.client
      .from('services')
      .select(
        `
        *,
        status_pages(name, organization_id, organizations(name))
      `
      )
      .eq('id', serviceId)
      .is('deleted_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateService(serviceId, updateData) {
    const { data, error } = await this.client
      .from('services')
      .update(updateData)
      .eq('id', serviceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteService(serviceId) {
    const { data, error } = await this.client
      .from('services')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Incident Updates
  async getIncidentUpdates(incidentId) {
    const { data, error } = await this.client
      .from('incident_updates')
      .select(
        `
        *,
        posted_by_user:users!incident_updates_posted_by_fkey(name, email)
      `
      )
      .eq('incident_id', incidentId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  async createIncidentUpdate(updateData) {
    const { data, error } = await this.client
      .from('incident_updates')
      .insert(updateData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateIncidentUpdate(updateId, updateData) {
    const { data, error } = await this.client
      .from('incident_updates')
      .update(updateData)
      .eq('id', updateId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteIncidentUpdate(updateId) {
    const { error } = await this.client
      .from('incident_updates')
      .delete()
      .eq('id', updateId);

    if (error) throw error;
    return { success: true };
  }

  // Service Monitoring
  async getServiceMonitoring(serviceId) {
    const { data, error } = await this.client
      .from('service_monitoring')
      .select('*')
      .eq('service_id', serviceId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createServiceMonitoring(monitoringData) {
    const { data, error } = await this.client
      .from('service_monitoring')
      .insert(monitoringData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateServiceMonitoring(monitoringId, updateData) {
    const { data, error } = await this.client
      .from('service_monitoring')
      .update(updateData)
      .eq('id', monitoringId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateServiceMonitoringByServiceId(serviceId, updateData) {
    const { data, error } = await this.client
      .from('service_monitoring')
      .update(updateData)
      .eq('service_id', serviceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Status Pages
  async getStatusPageById(statusPageId) {
    const { data, error } = await this.client
      .from('status_pages')
      .select(
        `
        *,
        organizations(name, logo_url),
        status_page_services(
          service_id,
          services(name, description, status)
        )
      `
      )
      .eq('id', statusPageId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async updateStatusPage(statusPageId, updateData) {
    const { data, error } = await this.client
      .from('status_pages')
      .update(updateData)
      .eq('id', statusPageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteStatusPage(statusPageId) {
    const { data, error } = await this.client
      .from('status_pages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', statusPageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Monitoring Checks
  async getMonitoringChecks(userId, filters = {}) {
    let query = this.client
      .from('monitoring_checks')
      .select(
        `
        *,
        organizations(name),
        created_by_user:users!monitoring_checks_created_by_fkey(name, email),
        organization_members!inner(user_id)
      `
      )
      .eq('organization_members.user_id', userId)
      .eq('organization_members.is_active', true);

    // Apply filters
    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }
    if (filters.check_type) {
      query = query.eq('check_type', filters.check_type);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.order('created_at', { ascending: false });

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 10) - 1
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async createMonitoringCheck(checkData) {
    const { data, error } = await this.client
      .from('monitoring_checks')
      .insert(checkData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateMonitoringCheck(checkId, updateData) {
    const { data, error } = await this.client
      .from('monitoring_checks')
      .update(updateData)
      .eq('id', checkId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMonitoringCheck(checkId) {
    const { error } = await this.client
      .from('monitoring_checks')
      .delete()
      .eq('id', checkId);

    if (error) throw error;
    return { success: true };
  }

  // Escalation Policies
  async getEscalationPolicies(userId, filters = {}) {
    let query = this.client
      .from('escalation_policies')
      .select(
        `
        *,
        organizations(name),
        created_by_user:users!escalation_policies_created_by_fkey(name, email),
        organization_members!inner(user_id)
      `
      )
      .eq('organization_members.user_id', userId)
      .eq('organization_members.is_active', true);

    // Apply filters
    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }
    if (filters.active_only) {
      query = query.eq('is_active', true);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async createEscalationPolicy(policyData) {
    const { data, error } = await this.client
      .from('escalation_policies')
      .insert(policyData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateEscalationPolicy(policyId, updateData) {
    const { data, error } = await this.client
      .from('escalation_policies')
      .update(updateData)
      .eq('id', policyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteEscalationPolicy(policyId) {
    const { error } = await this.client
      .from('escalation_policies')
      .delete()
      .eq('id', policyId);

    if (error) throw error;
    return { success: true };
  }

  async getEscalationPolicyById(policyId, userId) {
    const { data, error } = await this.client
      .from('escalation_policies')
      .select(
        `
        *,
        organizations(name),
        created_by_user:users!escalation_policies_created_by_fkey(name, email),
        organization_members!inner(user_id)
      `
      )
      .eq('id', policyId)
      .eq('organization_members.user_id', userId)
      .eq('organization_members.is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // On-Call Schedules
  async getOnCallSchedules(userId, filters = {}) {
    let query = this.client
      .from('on_call_schedules')
      .select(
        `
        *,
        organizations(name),
        organization_members!inner(user_id)
      `
      )
      .eq('organization_members.user_id', userId)
      .eq('organization_members.is_active', true);

    // Apply filters
    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }
    if (filters.active_only) {
      query = query.eq('is_active', true);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async createOnCallSchedule(scheduleData) {
    const { data, error } = await this.client
      .from('on_call_schedules')
      .insert(scheduleData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateOnCallSchedule(scheduleId, updateData) {
    const { data, error } = await this.client
      .from('on_call_schedules')
      .update(updateData)
      .eq('id', scheduleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteOnCallSchedule(scheduleId) {
    const { error } = await this.client
      .from('on_call_schedules')
      .delete()
      .eq('id', scheduleId);

    if (error) throw error;
    return { success: true };
  }

  async getOnCallScheduleById(scheduleId, userId) {
    const { data, error } = await this.client
      .from('on_call_schedules')
      .select(
        `
        *,
        organizations(name),
        organization_members!inner(user_id)
      `
      )
      .eq('id', scheduleId)
      .eq('organization_members.user_id', userId)
      .eq('organization_members.is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Check Results for Monitoring
  async createCheckResult(resultData) {
    const { data, error } = await this.client
      .from('check_results')
      .insert(resultData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getCheckResults(monitoringCheckId, limit = 50) {
    const { data, error } = await this.client
      .from('check_results')
      .select('*')
      .eq('monitoring_check_id', monitoringCheckId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getPendingMonitoringChecks(limit = 50) {
    // This is a complex query that would need a database function or view
    // For now, we'll get active monitoring checks and handle the logic in JS
    const { data, error } = await this.client
      .from('monitoring_checks')
      .select('*')
      .eq('status', 'active')
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getMonitoringCheckById(checkId) {
    const { data, error } = await this.client
      .from('monitoring_checks')
      .select('*')
      .eq('id', checkId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getMonitoringChecksByStatus(status) {
    const { data, error } = await this.client
      .from('monitoring_checks')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // Invitation Management
  async getInvitationByToken(token) {
    const { data, error } = await this.client
      .from('organization_members')
      .select(
        `
        id,
        organization_id,
        user_id,
        role,
        invitation_expires_at,
        accepted_at,
        organizations(name),
        users!organization_members_user_id_fkey(email),
        invited_by_user:users!organization_members_invited_by_fkey(name)
      `
      )
      .eq('invitation_token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async acceptInvitation(invitationId, acceptanceData) {
    const { data, error } = await this.client
      .from('organization_members')
      .update({
        ...acceptanceData,
        accepted_at: new Date().toISOString(),
        invitation_token: null,
        is_active: true,
      })
      .eq('id', invitationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Subscriptions
  async getSubscription(statusPageId, email) {
    const { data, error } = await this.client
      .from('subscriptions')
      .select('*')
      .eq('status_page_id', statusPageId)
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createSubscription(subscriptionData) {
    const { data, error } = await this.client
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteSubscription(subscriptionId) {
    const { error } = await this.client
      .from('subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (error) throw error;
    return { success: true };
  }

  async unsubscribeByToken(token) {
    const { data, error } = await this.client
      .from('subscriptions')
      .delete()
      .eq('unsubscribe_token', token)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // All Status Pages for User
  async getAllStatusPagesForUser(userId) {
    const { data, error } = await this.client
      .from('status_pages')
      .select(
        `
        *,
        organizations(name, slug),
        organization_members!inner(user_id)
      `
      )
      .eq('organization_members.user_id', userId)
      .eq('organization_members.is_active', true)
      .is('deleted_at', null)
      .order('organizations(name)', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  }

  // SLA & Uptime calculations
  async getServiceUptimeStats(serviceId, days = 30) {
    // This would typically be a complex query involving check results
    // For now, we'll return a simplified version
    // In a real implementation, you might want to create a database function for this
    const { data, error } = await this.client
      .from('check_results')
      .select('is_successful, created_at')
      .eq('monitoring_check_id', serviceId)
      .gte(
        'created_at',
        new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      )
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Calculate uptime percentage
    if (data.length === 0) {
      return { uptime_percentage: null, total_checks: 0, successful_checks: 0 };
    }

    const successfulChecks = data.filter(check => check.is_successful).length;
    const uptimePercentage = (successfulChecks / data.length) * 100;

    return {
      uptime_percentage: uptimePercentage,
      total_checks: data.length,
      successful_checks: successfulChecks,
      failed_checks: data.length - successfulChecks,
    };
  }

  // Generic database connection test
  async testConnection() {
    try {
      const { data, error } = await this.client
        .from('organizations')
        .select('count')
        .limit(1);

      if (error) throw error;

      return {
        success: true,
        message: 'Supabase connection successful',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
export const db = new SupabaseClient();
export default db;
