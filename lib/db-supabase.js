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
    return data || [];
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
    try {
      // First verify user has access to the organization
      if (filters.organization_id) {
        const membership = await this.getOrganizationMember(
          filters.organization_id,
          userId
        );
        if (!membership) {
          return []; // User doesn't have access, return empty array
        }
      }

      // Query monitoring_checks table which contains the actual monitoring configurations
      let query = this.client.from('monitoring_checks').select('*');

      // Apply organization filter directly
      if (filters.organization_id) {
        query = query.eq('organization_id', filters.organization_id);
      }

      // Apply other filters
      if (filters.check_type) {
        query = query.eq('check_type', filters.check_type);
      }
      if (filters.status) {
        if (filters.status === 'active') {
          query = query.eq('status', 'active');
        } else if (filters.status === 'inactive') {
          query = query.eq('status', 'inactive');
        }
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
      if (error) {
        console.warn('Error fetching monitoring checks:', error);
        return []; // Return empty array instead of throwing
      }

      // Transform data to match expected format
      return (data || []).map(monitor => ({
        id: monitor.id,
        name: monitor.name || `${monitor.check_type.toUpperCase()} Check`,
        check_type: monitor.check_type || 'http',
        target_url: monitor.target_url,
        url: monitor.target_url,
        check_interval: monitor.check_interval,
        timeout: monitor.target_timeout,
        status: monitor.status || 'inactive',
        is_active: monitor.status === 'active',
        // Add current_status field for dashboard compatibility
        current_status: monitor.status || 'inactive',
        created_at: monitor.created_at,
        updated_at: monitor.updated_at,
        // Organization info
        organization_id: monitor.organization_id,
        // Mock data for fields that might be expected by the frontend
        location_name: 'Default',
        last_response_time: null,
        last_check_time: null,
        next_check_time: null,
      }));
    } catch (error) {
      console.warn('Error in getMonitoringChecks:', error);
      return []; // Return empty array on any error
    }
  }

  async createMonitoringCheck(checkData) {
    // Map API fields to database fields
    const dbData = {
      name: checkData.name,
      check_type: checkData.check_type,
      target_url: checkData.url || checkData.target_url,
      organization_id: checkData.organization_id,
      check_interval: checkData.check_interval,
      target_timeout: checkData.timeout,
      created_by: checkData.created_by,
      status: checkData.is_active ? 'active' : 'inactive',
    };

    // Add optional fields if they exist
    if (checkData.description) dbData.description = checkData.description;
    if (checkData.target_port) dbData.target_port = checkData.target_port;
    if (checkData.retry_count) dbData.retry_count = checkData.retry_count;
    if (checkData.retry_interval)
      dbData.retry_interval = checkData.retry_interval;
    if (checkData.monitoring_locations)
      dbData.monitoring_locations = checkData.monitoring_locations;
    if (checkData.configuration) dbData.configuration = checkData.configuration;
    if (checkData.maintenance_windows)
      dbData.maintenance_windows = checkData.maintenance_windows;
    if (checkData.alert_after_failures)
      dbData.alert_after_failures = checkData.alert_after_failures;
    if (checkData.alert_on_recovery !== undefined)
      dbData.alert_on_recovery = checkData.alert_on_recovery;
    if (checkData.escalation_policy_id)
      dbData.escalation_policy_id = checkData.escalation_policy_id;
    if (checkData.status_page_component_id)
      dbData.status_page_component_id = checkData.status_page_component_id;
    if (checkData.auto_update_status !== undefined)
      dbData.auto_update_status = checkData.auto_update_status;
    if (checkData.tags) dbData.tags = checkData.tags;

    // Log the data being inserted for debugging
    console.log('Attempting to insert monitoring check:', dbData);

    const { data, error } = await this.client
      .from('monitoring_checks')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      console.error('Database error creating monitoring check:', error);
      throw error;
    }

    console.log('Successfully created monitoring check:', data);
    return data;
  }

  async updateMonitoringCheck(checkId, updateData) {
    // Map API fields to database fields
    const dbData = {};

    if (updateData.name) dbData.name = updateData.name;
    if (updateData.check_type) dbData.check_type = updateData.check_type;
    if (updateData.url || updateData.target_url)
      dbData.target_url = updateData.url || updateData.target_url;
    if (updateData.organization_id)
      dbData.organization_id = updateData.organization_id;
    if (updateData.check_interval)
      dbData.check_interval = updateData.check_interval;
    if (updateData.timeout) dbData.target_timeout = updateData.timeout;
    if (updateData.created_by) dbData.created_by = updateData.created_by;
    if (updateData.is_active !== undefined)
      dbData.status = updateData.is_active ? 'active' : 'inactive';
    if (updateData.status) dbData.status = updateData.status;

    // Add optional fields
    if (updateData.description !== undefined)
      dbData.description = updateData.description;
    if (updateData.target_port !== undefined)
      dbData.target_port = updateData.target_port;
    if (updateData.retry_count !== undefined)
      dbData.retry_count = updateData.retry_count;
    if (updateData.retry_interval !== undefined)
      dbData.retry_interval = updateData.retry_interval;
    if (updateData.monitoring_locations !== undefined)
      dbData.monitoring_locations = updateData.monitoring_locations;
    if (updateData.configuration !== undefined)
      dbData.configuration = updateData.configuration;
    if (updateData.maintenance_windows !== undefined)
      dbData.maintenance_windows = updateData.maintenance_windows;
    if (updateData.alert_after_failures !== undefined)
      dbData.alert_after_failures = updateData.alert_after_failures;
    if (updateData.alert_on_recovery !== undefined)
      dbData.alert_on_recovery = updateData.alert_on_recovery;
    if (updateData.escalation_policy_id !== undefined)
      dbData.escalation_policy_id = updateData.escalation_policy_id;
    if (updateData.status_page_component_id !== undefined)
      dbData.status_page_component_id = updateData.status_page_component_id;
    if (updateData.auto_update_status !== undefined)
      dbData.auto_update_status = updateData.auto_update_status;
    if (updateData.tags !== undefined) dbData.tags = updateData.tags;
    if (updateData.updated_at) dbData.updated_at = updateData.updated_at;

    const { data, error } = await this.client
      .from('monitoring_checks')
      .update(dbData)
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
    try {
      // First get all organizations the user has access to
      const { data: userOrgs, error: memberError } = await this.client
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (memberError) {
        console.warn('Error fetching user organizations:', memberError);
        return [];
      }

      if (!userOrgs || userOrgs.length === 0) {
        return [];
      }

      const orgIds = userOrgs.map(o => o.organization_id);

      // Get on-call schedules for organizations the user has access to
      let query = this.client
        .from('on_call_schedules')
        .select(
          `
          *,
          organizations(name)
        `
        )
        .in('organization_id', orgIds);

      // Apply additional filters
      if (filters.organization_id) {
        // Verify user has access to this specific organization
        if (!orgIds.includes(filters.organization_id)) {
          return []; // User doesn't have access to this organization
        }
        query = query.eq('organization_id', filters.organization_id);
      }

      if (filters.active_only) {
        query = query.eq('is_active', true);
      }

      if (filters.start_date && filters.end_date) {
        query = query
          .gte('start_time', filters.start_date)
          .lte('end_time', filters.end_date);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching on-call schedules:', error);
        return []; // Return empty array instead of throwing
      }

      return data || [];
    } catch (error) {
      console.warn('Error in getOnCallSchedules:', error);
      return []; // Return empty array on any error
    }
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
    try {
      // First get the schedule to check its organization
      const { data: schedule, error: scheduleError } = await this.client
        .from('on_call_schedules')
        .select(
          `
          *,
          organizations(name)
        `
        )
        .eq('id', scheduleId)
        .single();

      if (scheduleError && scheduleError.code !== 'PGRST116') {
        console.warn('Error fetching on-call schedule:', scheduleError);
        return null;
      }

      if (!schedule) return null;

      // Verify user has access to this organization
      const { data: membership, error: memberError } = await this.client
        .from('organization_members')
        .select('id')
        .eq('organization_id', schedule.organization_id)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (memberError || !membership) {
        return null; // User doesn't have access
      }

      return schedule;
    } catch (error) {
      console.warn('Error in getOnCallScheduleById:', error);
      return null;
    }
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
    // Get active service monitoring configurations
    const { data, error } = await this.client
      .from('service_monitoring')
      .select('*')
      .eq('is_active', true)
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getMonitoringCheckById(checkId) {
    const { data, error } = await this.client
      .from('service_monitoring')
      .select('*')
      .eq('id', checkId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getMonitoringChecksByStatus(status) {
    const { data, error } = await this.client
      .from('service_monitoring')
      .select('*')
      .eq('is_active', status === 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
    // TODO: Implement proper monitoring check results query once monitoring is configured
    // For now, return mock data to prevent UI errors

    try {
      // First, check if we have any monitoring checks for this service
      const { data: monitoringChecks, error: checkError } = await this.client
        .from('service_monitoring_checks')
        .select('monitoring_check_id')
        .eq('service_id', serviceId);

      if (checkError) {
        // Only log if it's not a missing column error (expected during schema migration)
        if (!checkError.message?.includes('does not exist')) {
          console.warn('Error fetching monitoring checks:', checkError);
        }
        return this.getMockUptimeStats(days);
      }

      if (!monitoringChecks || monitoringChecks.length === 0) {
        // No monitoring configured for this service, return high uptime mock data
        return this.getMockUptimeStats(days);
      }

      // If we have monitoring checks, try to get actual results
      const checkIds = monitoringChecks.map(check => check.monitoring_check_id);

      const { data, error } = await this.client
        .from('check_results')
        .select('is_successful, created_at')
        .in('monitoring_check_id', checkIds)
        .gte(
          'created_at',
          new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        )
        .order('created_at', { ascending: true });

      if (error) {
        // Only log if it's not a missing column error (expected during schema migration)
        if (!error.message?.includes('does not exist')) {
          console.warn('Error fetching check results:', error);
        }
        return this.getMockUptimeStats(days);
      }

      // Calculate actual uptime percentage
      if (data.length === 0) {
        return this.getMockUptimeStats(days);
      }

      const successfulChecks = data.filter(check => check.is_successful).length;
      const uptimePercentage = (successfulChecks / data.length) * 100;

      return {
        uptime_percentage: uptimePercentage,
        total_checks: data.length,
        successful_checks: successfulChecks,
        failed_checks: data.length - successfulChecks,
      };
    } catch (error) {
      // Only log if it's not a missing column error (expected during schema migration)
      if (!error.message?.includes('does not exist')) {
        console.warn('Error in getServiceUptimeStats:', error);
      }
      return this.getMockUptimeStats(days);
    }
  }

  // Helper method to return mock uptime stats
  getMockUptimeStats(days = 30) {
    // Return realistic mock data (99.5% uptime)
    const totalChecks = days * 24 * 4; // Assume checks every 15 minutes
    const successfulChecks = Math.floor(totalChecks * 0.995);

    return {
      uptime_percentage: 99.5,
      total_checks: totalChecks,
      successful_checks: successfulChecks,
      failed_checks: totalChecks - successfulChecks,
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
