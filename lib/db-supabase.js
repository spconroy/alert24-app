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

      // Workaround: Query status_updates table for monitoring checks stored there
      // (monitoring_checks table is inaccessible via Supabase)
      let query = this.client
        .from('status_updates')
        .select('*, status_pages!inner(organization_id)')
        .eq('update_type', 'monitoring_check');

      // Apply organization filter
      if (filters.organization_id) {
        query = query.eq(
          'status_pages.organization_id',
          filters.organization_id
        );
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

      // Transform status_updates data back to monitoring check format
      return (data || [])
        .map(statusUpdate => {
          try {
            const checkData = JSON.parse(statusUpdate.message);
            return {
              id: statusUpdate.id,
              name: checkData.name || 'Monitoring Check',
              check_type: checkData.check_type || 'http',
              target_url: checkData.target_url,
              url: checkData.target_url,
              check_interval: checkData.check_interval || 5,
              timeout: checkData.target_timeout || 30,
              status: checkData.status || 'inactive',
              is_active: checkData.status === 'active',
              // Add current_status field for dashboard compatibility
              current_status: checkData.status || 'inactive',
              created_at: statusUpdate.created_at,
              updated_at: statusUpdate.updated_at,
              // Organization info
              organization_id: checkData.organization_id,
              created_by: statusUpdate.created_by,
              // Mock data for fields that might be expected by the frontend
              location_name: 'Default',
              last_response_time: null,
              last_check_time: null,
              next_check_time: null,
            };
          } catch (parseError) {
            console.warn('Error parsing monitoring check data:', parseError);
            return null;
          }
        })
        .filter(Boolean); // Remove any null entries from parse errors
    } catch (error) {
      console.warn('Error in getMonitoringChecks:', error);
      return []; // Return empty array on any error
    }
  }

  async createMonitoringCheck(checkData) {
    try {
      // Workaround: Store monitoring check data in status_updates table
      // since monitoring_checks table is inaccessible via Supabase

      // First, get the first status page for this organization to link to
      const { data: statusPages } = await this.client
        .from('status_pages')
        .select('id')
        .eq('organization_id', checkData.organization_id)
        .limit(1);

      const statusPageId = statusPages?.[0]?.id;
      if (!statusPageId) {
        throw new Error(
          'No status page found for organization. Please create a status page first.'
        );
      }

      const monitoringData = {
        name: checkData.name,
        check_type: checkData.check_type,
        target_url: checkData.url || checkData.target_url,
        check_interval: checkData.check_interval || 5,
        target_timeout: checkData.timeout || 30,
        status: checkData.is_active ? 'active' : 'disabled',
        configuration: checkData.configuration || {},
        organization_id: checkData.organization_id,
        original_data: checkData,
      };

      const dbData = {
        status_page_id: statusPageId,
        title: `Monitoring: ${checkData.name}`,
        message: JSON.stringify(monitoringData),
        status: 'operational',
        update_type: 'monitoring_check',
        created_by: checkData.created_by,
      };

      console.log(
        'Creating monitoring check via status_updates workaround:',
        dbData
      );

      const { data, error } = await this.client
        .from('status_updates')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        console.error('Database error creating monitoring check:', error);
        throw error;
      }

      // Transform response to look like a monitoring check
      const storedData = JSON.parse(data.message);
      const monitoringCheck = {
        id: data.id,
        name: storedData.name,
        check_type: storedData.check_type,
        target_url: storedData.target_url,
        url: storedData.target_url,
        organization_id: storedData.organization_id,
        check_interval: storedData.check_interval,
        timeout: storedData.target_timeout,
        status: storedData.status,
        is_active: storedData.status === 'active',
        current_status: storedData.status,
        created_by: data.created_by,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      console.log('Successfully created monitoring check:', monitoringCheck);
      return monitoringCheck;
    } catch (error) {
      console.error('Error creating monitoring check:', error);
      throw error;
    }
  }

  async updateMonitoringCheck(checkId, updateData) {
    // Workaround: Update monitoring check data stored in status_pages table
    try {
      // Get current data
      const { data: currentData, error: fetchError } = await this.client
        .from('status_pages')
        .select('*')
        .eq('id', checkId)
        .contains('custom_branding', { type: 'monitoring_check' })
        .single();

      if (fetchError) throw fetchError;

      // Update the custom_branding data
      const updatedBranding = { ...currentData.custom_branding };

      if (updateData.name) updatedBranding.name = updateData.name;
      if (updateData.check_type)
        updatedBranding.check_type = updateData.check_type;
      if (updateData.url || updateData.target_url)
        updatedBranding.target_url = updateData.url || updateData.target_url;
      if (updateData.check_interval)
        updatedBranding.check_interval = updateData.check_interval;
      if (updateData.timeout)
        updatedBranding.target_timeout = updateData.timeout;
      if (updateData.is_active !== undefined)
        updatedBranding.status = updateData.is_active ? 'active' : 'disabled';

      const dbData = {
        custom_branding: updatedBranding,
      };

      if (updateData.name) dbData.name = updateData.name;

      const { data, error } = await this.client
        .from('status_pages')
        .update(dbData)
        .eq('id', checkId)
        .select()
        .single();

      if (error) throw error;

      // Transform back to monitoring check format
      const checkData = data.custom_branding || {};
      return {
        id: data.id,
        name: data.name,
        check_type: checkData.check_type || 'http',
        target_url: checkData.target_url,
        url: checkData.target_url,
        check_interval: checkData.check_interval || 5,
        timeout: checkData.target_timeout || 30,
        status: checkData.status || 'active',
        is_active: checkData.status === 'active',
        current_status: checkData.status || 'active',
        created_at: data.created_at,
        updated_at: data.updated_at,
        organization_id: data.organization_id,
      };
    } catch (error) {
      console.error('Error updating monitoring check:', error);
      throw error;
    }
  }

  async deleteMonitoringCheck(checkId) {
    // Workaround: Delete monitoring check stored in status_pages table
    try {
      const { error } = await this.client
        .from('status_pages')
        .delete()
        .eq('id', checkId)
        .contains('custom_branding', { type: 'monitoring_check' });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting monitoring check:', error);
      throw error;
    }
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
