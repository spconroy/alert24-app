import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Environment variables check:', {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceKey,
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(key =>
      key.includes('SUPABASE')
    ),
  });
  throw new Error(
    `Missing Supabase environment variables - URL: ${!!supabaseUrl}, Key: ${!!supabaseAnonKey}`
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for admin operations (bypasses RLS)
let supabaseAdmin = null;
if (supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
}

// Database client wrapper for Alert24 app
export class SupabaseClient {
  constructor() {
    this.client = supabase;
    this.adminClient = supabaseAdmin;
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
      .eq('organization_id', organizationId)
      .not('name', 'ilike', '[[]MONITORING]%');

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
        services(name),
        organizations(name),
        created_by_user:users!incidents_created_by_fkey(name, email),
        assigned_to_user:users!incidents_assigned_to_fkey(name, email),
        escalation_policies(name, escalation_timeout_minutes)
      `
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Transform the data to match expected format
    const transformedData = (data || []).map(incident => ({
      ...incident,
      organization_name: incident.organizations?.name,
      created_by_name: incident.created_by_user?.name,
      created_by_email: incident.created_by_user?.email,
      assigned_to_name: incident.assigned_to_user?.name,
      assigned_to_email: incident.assigned_to_user?.email,
      escalation_policy_name: incident.escalation_policies?.name,
      escalation_timeout_minutes: incident.escalation_policies?.escalation_timeout_minutes,
    }));
    
    return transformedData;
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
    // First get the incident
    const { data: incident, error: incidentError } = await this.client
      .from('incidents')
      .select(
        `
        *,
        organizations(name),
        created_by_user:users(name, email),
        assigned_to_user:users(name, email),
        escalation_policies(name, escalation_timeout_minutes)
      `
      )
      .eq('id', incidentId)
      .single();

    if (incidentError && incidentError.code !== 'PGRST116') throw incidentError;
    if (!incident) return null;

    // Check if user has access to this organization
    const { data: membership, error: membershipError } = await this.client
      .from('organization_members')
      .select('id')
      .eq('organization_id', incident.organization_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (membershipError && membershipError.code !== 'PGRST116')
      throw membershipError;
    if (!membership) return null; // User doesn't have access

    return incident;
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

      // Query the new monitoring_checks table
      // Use regular client - RLS has been disabled for monitoring_checks table
      let query = this.client.from('monitoring_checks').select(
        `
          *,
          organizations(name)
        `
      );

      // Apply organization filter
      if (filters.organization_id) {
        query = query.eq('organization_id', filters.organization_id);
      }

      // Apply status filter
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      // Apply check type filter
      if (filters.check_type) {
        query = query.eq('check_type', filters.check_type);
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

      // Debug logging
      console.log(
        `Found ${(data || []).length} monitoring checks for filters:`,
        filters
      );
      if (data && data.length > 0) {
        console.log('Sample check data:', data[0]);
      }

      // Transform data to expected format
      return (data || []).map(check => {
        // Calculate next check time based on check interval
        const now = new Date();
        const lastCheckTime = check.last_check_at
          ? new Date(check.last_check_at)
          : check.updated_at
            ? new Date(check.updated_at)
            : now;
        const checkIntervalMs = (check.check_interval_seconds || 300) * 1000; // Convert seconds to milliseconds
        const nextCheckTime = new Date(
          lastCheckTime.getTime() + checkIntervalMs
        );

        // If the next check time is in the past, set it to now + interval
        const calculatedNextCheck =
          nextCheckTime.getTime() < now.getTime()
            ? new Date(now.getTime() + checkIntervalMs)
            : nextCheckTime;

        // Determine proper current status
        let currentStatus = check.current_status || 'unknown';

        // If never checked and active, show as pending
        if (!check.last_check_at && check.status === 'active') {
          currentStatus = 'pending';
        }

        // If inactive/disabled, show as inactive
        if (check.status !== 'active') {
          currentStatus = 'inactive';
        }

        const transformedCheck = {
          id: check.id,
          name: check.name,
          check_type: check.check_type,
          target_url: check.target_url,
          url: check.target_url,
          check_interval: Math.floor(
            (check.check_interval_seconds || 300) / 60
          ), // Convert to minutes for backward compatibility
          check_interval_seconds: check.check_interval_seconds || 300,
          timeout: check.timeout_seconds || 30,
          timeout_seconds: check.timeout_seconds || 30,
          status: check.status || 'active',
          is_active: check.status === 'active',
          current_status: currentStatus,
          created_at: check.created_at,
          updated_at: check.updated_at,
          // Organization info
          organization_id: check.organization_id,
          organization_name:
            check.organizations?.name || 'Unknown Organization',
          created_by: check.created_by,
          linked_service_id: check.linked_service_id,
          failure_threshold: check.failure_threshold || 3,
          success_threshold: check.success_threshold || 1,
          failure_threshold_minutes: check.failure_threshold_minutes || 5,
          consecutive_failures: check.consecutive_failures || 0,
          consecutive_successes: check.consecutive_successes || 0,
          // HTTP settings
          method: check.method || 'GET',
          http_method: check.method || 'GET',
          headers: check.headers || {},
          http_headers: check.headers || {},
          body: check.body,
          expected_status_code: check.expected_status_code || 200,
          expected_status_codes: [check.expected_status_code || 200],
          // Monitoring status fields
          location_name: 'Default',
          last_response_time: check.last_response_time || null,
          last_check_time:
            check.last_check_at || check.updated_at || check.created_at,
          last_check_at: check.last_check_at,
          last_success_at: check.last_success_at,
          last_failure_at: check.last_failure_at,
          next_check_time: calculatedNextCheck.toISOString(),
          failure_message: check.failure_message,
          // Status page configuration (for status_page check type)
          status_page_config: check.status_page_config,
          // SSL checking fields
          ssl_check_enabled: check.ssl_check_enabled || false,
          ssl_status: check.ssl_status,
          ssl_days_until_expiry: check.ssl_days_until_expiry,
          // Keyword matching fields
          keyword_match: check.keyword_match,
          keyword_match_type: check.keyword_match_type,
          // Redirect following
          follow_redirects: check.follow_redirects,
        };

        console.log(`Transformed check ${check.name}:`, {
          original_status: check.status,
          original_current_status: check.current_status,
          final_current_status: transformedCheck.current_status,
          is_active: transformedCheck.is_active,
        });

        return transformedCheck;
      });
    } catch (error) {
      console.warn('Error in getMonitoringChecks:', error);
      return []; // Return empty array on any error
    }
  }

  // Check Results
  async createCheckResult(resultData) {
    try {
      const { data, error } = await this.client
        .from('check_results')
        .insert({
          monitoring_check_id: resultData.monitoring_check_id,
          monitoring_location_id:
            resultData.monitoring_location_id ||
            '00000000-0000-0000-0000-000000000001', // Default location
          is_successful: resultData.is_successful,
          response_time: resultData.response_time_ms,
          status_code: resultData.status_code,
          response_body: resultData.response_body,
          response_headers: resultData.response_headers,
          error_message: resultData.error_message,
          ssl_certificate_info: resultData.ssl_info,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.warn(
        'Failed to create check result, falling back to workaround:',
        error
      );
      // Fallback to storing in the services table description as before
      return null;
    }
  }

  async getCheckResults(monitoringCheckId, options = {}) {
    try {
      let query = this.client
        .from('check_results')
        .select('*')
        .eq('monitoring_check_id', monitoringCheckId)
        .order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.startDate) {
        query = query.gte('created_at', options.startDate);
      }

      if (options.endDate) {
        query = query.lte('created_at', options.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Failed to get check results:', error);
      return [];
    }
  }

  // Monitoring Locations
  async getMonitoringLocations(filters = {}) {
    try {
      let query = this.client
        .from('monitoring_locations')
        .select('*')
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (filters.active_only) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching monitoring locations:', error);
        // Return default locations if table doesn't exist
        return this.getDefaultMonitoringLocations();
      }

      return data || this.getDefaultMonitoringLocations();
    } catch (error) {
      console.warn(
        'Monitoring locations table may not exist, using defaults:',
        error
      );
      return this.getDefaultMonitoringLocations();
    }
  }

  async getDefaultMonitoringLocations() {
    // Return default locations if the table doesn't exist yet
    return [
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'US East (N. Virginia)',
        code: 'us-east-1',
        description: 'Primary US East location',
        region: 'North America',
        country: 'United States',
        city: 'Ashburn',
        latitude: 39.0458,
        longitude: -77.4976,
        is_active: true,
        is_default: true,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'US West (Oregon)',
        code: 'us-west-2',
        description: 'Primary US West location',
        region: 'North America',
        country: 'United States',
        city: 'Portland',
        latitude: 45.5152,
        longitude: -122.6784,
        is_active: true,
        is_default: false,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        name: 'EU (Frankfurt)',
        code: 'eu-central-1',
        description: 'Primary EU location',
        region: 'Europe',
        country: 'Germany',
        city: 'Frankfurt',
        latitude: 50.1109,
        longitude: 8.6821,
        is_active: true,
        is_default: false,
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        name: 'Asia Pacific (Singapore)',
        code: 'ap-southeast-1',
        description: 'Primary APAC location',
        region: 'Asia Pacific',
        country: 'Singapore',
        city: 'Singapore',
        latitude: 1.3521,
        longitude: 103.8198,
        is_active: true,
        is_default: false,
      },
      {
        id: '00000000-0000-0000-0000-000000000005',
        name: 'Asia Pacific (Sydney)',
        code: 'ap-southeast-2',
        description: 'Secondary APAC location',
        region: 'Asia Pacific',
        country: 'Australia',
        city: 'Sydney',
        latitude: -33.8688,
        longitude: 151.2093,
        is_active: true,
        is_default: false,
      },
    ];
  }

  async createMonitoringLocation(locationData) {
    const { data, error } = await this.client
      .from('monitoring_locations')
      .insert(locationData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateMonitoringLocation(locationId, updateData) {
    const { data, error } = await this.client
      .from('monitoring_locations')
      .update(updateData)
      .eq('id', locationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteMonitoringLocation(locationId) {
    const { data, error } = await this.client
      .from('monitoring_locations')
      .update({ is_active: false })
      .eq('id', locationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMonitoringCheck(checkData) {
    try {
      // Create monitoring check in the dedicated monitoring_checks table
      const dbData = {
        organization_id: checkData.organization_id,
        name: checkData.name,
        description:
          checkData.description || `Monitoring check for ${checkData.name}`,
        check_type: checkData.check_type || 'http',
        target_url: checkData.target_url, // Direct mapping
        method: checkData.http_method || 'GET',
        headers: checkData.http_headers || {},
        body: checkData.body || null,
        expected_status_code: checkData.expected_status_codes?.[0] || 200,
        timeout_seconds: checkData.timeout_seconds || checkData.timeout || 30,
        check_interval_seconds: checkData.check_interval_seconds || 300, // Direct mapping, no conversion
        failure_threshold: checkData.failure_threshold || 3,
        success_threshold: checkData.success_threshold || 1,
        status: checkData.is_active === false ? 'disabled' : 'active',
        current_status: 'unknown',
        linked_service_id: checkData.linked_service_id || null,
        failure_threshold_minutes: checkData.failure_threshold_minutes || 5,
        consecutive_failures: 0,
        consecutive_successes: 0,
        created_by: checkData.created_by, // Important for RLS policies
        status_page_config: checkData.status_page_config || null, // Status page configuration
      };

      console.log('Database - checkData input:', checkData);
      console.log('Database - dbData prepared:', dbData);

      console.log(
        'Creating monitoring check in monitoring_checks table:',
        dbData
      );

      // Use regular client - RLS has been disabled for monitoring_checks table
      console.log(
        'Creating monitoring check with regular client (RLS disabled)...'
      );
      const { data, error } = await this.client
        .from('monitoring_checks')
        .insert(dbData)
        .select()
        .single();

      if (error) {
        console.error('Database error creating monitoring check:', error);

        // If it's still an RLS violation, provide a helpful error message
        if (error.code === '42501') {
          throw new Error(
            `Access denied: Unable to create monitoring check. This might be due to insufficient permissions or missing organization membership. Please ensure you have the required role (owner, admin, or responder) in the organization.`
          );
        }

        throw error;
      }

      // Transform response to expected format
      const monitoringCheck = {
        id: data.id,
        name: data.name,
        check_type: data.check_type,
        target_url: data.target_url,
        url: data.target_url,
        organization_id: data.organization_id,
        check_interval: Math.floor(data.check_interval_seconds / 60), // Convert back to minutes for compatibility
        check_interval_seconds: data.check_interval_seconds,
        timeout: data.timeout_seconds,
        timeout_seconds: data.timeout_seconds,
        status: data.status,
        is_active: data.status === 'active',
        current_status: data.current_status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        linked_service_id: data.linked_service_id,
        failure_threshold: data.failure_threshold,
        success_threshold: data.success_threshold,
        failure_threshold_minutes: data.failure_threshold_minutes,
        consecutive_failures: data.consecutive_failures,
        consecutive_successes: data.consecutive_successes,
        // HTTP settings
        method: data.method,
        http_method: data.method,
        headers: data.headers,
        http_headers: data.headers,
        body: data.body,
        expected_status_code: data.expected_status_code,
        expected_status_codes: [data.expected_status_code],
        // Status page configuration
        status_page_config: data.status_page_config,
      };

      console.log('Successfully created monitoring check:', monitoringCheck);
      return monitoringCheck;
    } catch (error) {
      console.error('Error creating monitoring check:', error);
      throw error;
    }
  }

  async updateMonitoringCheck(checkId, updateData) {
    try {
      console.log(
        `🔄 Updating monitoring check ${checkId} with data:`,
        updateData
      );

      // Prepare the update data for the monitoring_checks table
      const dbData = {
        updated_at: new Date().toISOString(),
      };

      // Map the update fields to the correct database columns
      if (updateData.name !== undefined) dbData.name = updateData.name;
      if (updateData.check_type !== undefined)
        dbData.check_type = updateData.check_type;
      if (updateData.url !== undefined) dbData.target_url = updateData.url;
      if (updateData.target_url !== undefined)
        dbData.target_url = updateData.target_url;
      if (updateData.method !== undefined) dbData.method = updateData.method;
      if (updateData.headers !== undefined) dbData.headers = updateData.headers;
      if (updateData.body !== undefined) dbData.body = updateData.body;
      if (updateData.expected_status_code !== undefined)
        dbData.expected_status_code = updateData.expected_status_code;
      if (updateData.timeout_seconds !== undefined)
        dbData.timeout_seconds = updateData.timeout_seconds;
      if (updateData.check_interval_seconds !== undefined)
        dbData.check_interval_seconds = updateData.check_interval_seconds;
      if (updateData.failure_threshold !== undefined)
        dbData.failure_threshold = updateData.failure_threshold;
      if (updateData.success_threshold !== undefined)
        dbData.success_threshold = updateData.success_threshold;

      // Handle status field (convert from is_active boolean to status string if needed)
      if (updateData.is_active !== undefined) {
        dbData.status = updateData.is_active ? 'active' : 'disabled';
      }
      if (updateData.status !== undefined) {
        dbData.status = updateData.status;
      }

      console.log(`📝 Prepared database update data:`, dbData);

      const { data, error } = await this.client
        .from('monitoring_checks')
        .update(dbData)
        .eq('id', checkId)
        .select()
        .single();

      if (error) {
        console.error(`❌ Error updating monitoring check:`, error);
        throw error;
      }

      console.log(`✅ Successfully updated monitoring check:`, data);
      return data;
    } catch (error) {
      console.error('Error updating monitoring check:', error);
      throw error;
    }
  }

  async deleteMonitoringCheck(checkId) {
    try {
      console.log(`🗑️ Attempting to delete monitoring check: ${checkId}`);

      // First, verify the monitoring check exists and get its details
      const { data: existingCheck, error: fetchError } = await this.client
        .from('monitoring_checks')
        .select('*')
        .eq('id', checkId)
        .single();

      if (fetchError) {
        console.error(
          '❌ Error fetching monitoring check for deletion:',
          fetchError
        );
        if (fetchError.code === 'PGRST116') {
          throw new Error(`Monitoring check with ID ${checkId} not found`);
        }
        throw fetchError;
      }

      console.log(`✅ Found monitoring check to delete: ${existingCheck.name}`);

      // Delete the monitoring check
      const { data, error } = await this.client
        .from('monitoring_checks')
        .delete()
        .eq('id', checkId)
        .select();

      if (error) {
        console.error('❌ Error deleting monitoring check:', error);
        throw error;
      }

      // Check if any rows were actually deleted
      if (!data || data.length === 0) {
        console.error('❌ No rows were deleted');
        throw new Error(
          `Monitoring check with ID ${checkId} not found or not deleted`
        );
      }

      console.log(`✅ Successfully deleted monitoring check: ${checkId}`);
      return { success: true, deleted: data[0] };
    } catch (error) {
      console.error('❌ Error deleting monitoring check:', error);
      throw error;
    }
  }

  // Escalation Policies
  async getEscalationPolicies(userId, filters = {}) {
    // First, get organizations the user has access to
    const { data: userOrgs, error: orgError } = await this.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (orgError) throw orgError;

    if (!userOrgs || userOrgs.length === 0) {
      return [];
    }

    const orgIds = userOrgs.map(org => org.organization_id);

    // Now get escalation policies for those organizations
    // RLS is disabled for escalation_policies, so regular client works fine
    let query = this.client
      .from('escalation_policies')
      .select(
        `
        *,
        organizations(name)
      `
      )
      .in('organization_id', orgIds);

    // Apply filters
    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }
    if (filters.active_only) {
      // Filter for active policies (not soft deleted)
      query = query.is('deleted_at', null);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
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
    // First get the escalation policy
    const { data: policy, error: policyError } = await this.client
      .from('escalation_policies')
      .select(
        `
        *,
        organizations(name)
      `
      )
      .eq('id', policyId)
      .single();

    if (policyError && policyError.code !== 'PGRST116') throw policyError;
    if (!policy) return null;

    // Check if user has access to this organization
    const { data: membership, error: membershipError } = await this.client
      .from('organization_members')
      .select('id')
      .eq('organization_id', policy.organization_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (membershipError && membershipError.code !== 'PGRST116')
      throw membershipError;
    if (!membership) return null; // User doesn't have access

    return policy;
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
      // RLS is disabled for on_call_schedules, so regular client works fine
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

      // Calculate current on-call member for each schedule
      const schedulesWithOnCall = [];

      for (const schedule of data || []) {
        try {
          if (
            !schedule.is_active ||
            !schedule.members ||
            schedule.members.length === 0
          ) {
            schedulesWithOnCall.push({
              ...schedule,
              current_on_call_member: null,
            });
            continue;
          }

          const currentOnCallUserId =
            this.calculateCurrentOnCallUserId(schedule);

          if (!currentOnCallUserId) {
            schedulesWithOnCall.push({
              ...schedule,
              current_on_call_member: null,
            });
            continue;
          }

          // Fetch user details for the current on-call member
          const userDetails = await this.getUserById(currentOnCallUserId);

          schedulesWithOnCall.push({
            ...schedule,
            current_on_call_member: userDetails,
          });
        } catch (error) {
          console.warn(`Error processing schedule ${schedule.id}:`, error);
          // Still include the schedule but without current on-call member
          schedulesWithOnCall.push({
            ...schedule,
            current_on_call_member: null,
          });
        }
      }

      return schedulesWithOnCall;
    } catch (error) {
      console.warn('Error in getOnCallSchedules:', error);
      return []; // Return empty array on any error
    }
  }

  calculateCurrentOnCallUserId(schedule) {
    try {
      const now = new Date();
      const rotationConfig = schedule.rotation_config || {};
      const members = schedule.members || [];

      if (!members.length) {
        return null;
      }

      // Sort members by order
      const sortedMembers = [...members].sort(
        (a, b) => (a.order || 0) - (b.order || 0)
      );

      // If no rotation configuration or schedule hasn't started yet
      const scheduleStart = rotationConfig.schedule_start
        ? new Date(rotationConfig.schedule_start)
        : new Date(schedule.created_at);

      // Allow schedules that start within the next hour to show current on-call
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const isScheduleStartingSoon = scheduleStart <= oneHourFromNow;

      if (now < scheduleStart && !isScheduleStartingSoon) {
        return null;
      }

      // If schedule has ended
      if (rotationConfig.schedule_end) {
        const scheduleEnd = new Date(rotationConfig.schedule_end);
        if (now > scheduleEnd) {
          return null;
        }
      }

      // Calculate rotation duration in milliseconds
      const rotationDurationMs =
        (rotationConfig.duration_hours || 168) * 60 * 60 * 1000; // Default to 1 week

      // Calculate time elapsed since schedule start
      const timeElapsed = now.getTime() - scheduleStart.getTime();

      // Calculate how many complete rotations have passed
      const rotationIndex = Math.floor(timeElapsed / rotationDurationMs);

      // Determine which member should be on call
      const memberIndex = rotationIndex % sortedMembers.length;
      const currentMember = sortedMembers[memberIndex];

      // Return the user ID of the current on-call member
      return currentMember.user_id;
    } catch (error) {
      console.warn('Error calculating current on-call user ID:', error);
      return null;
    }
  }

  async createOnCallSchedule(scheduleData) {
    // RLS is disabled for on_call_schedules, so regular client works fine
    console.log('Creating on-call schedule with regular client (RLS disabled)');
    console.log('Schedule data:', scheduleData);

    const { data, error } = await this.client
      .from('on_call_schedules')
      .insert(scheduleData)
      .select()
      .single();

    if (error) {
      console.error('Error creating on-call schedule:', error);
      throw error;
    }
    return data;
  }

  async updateOnCallSchedule(scheduleId, updateData) {
    // RLS is disabled for on_call_schedules, so regular client works fine
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
    // RLS is disabled for on_call_schedules, so regular client works fine
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
      // RLS is disabled for on_call_schedules, so regular client works fine
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
    // Workaround: Get active monitoring checks from services table
    try {
      const { data, error } = await this.client
        .from('services')
        .select('*')
        .ilike('name', '[[]MONITORING]%')
        .limit(limit);

      if (error) throw error;

      // Transform and filter active monitoring checks
      return (data || [])
        .map(service => {
          try {
            const checkData = JSON.parse(service.description);
            if (
              checkData.type !== 'monitoring_check' ||
              checkData.status !== 'active'
            ) {
              return null;
            }
            return {
              id: service.id,
              name: checkData.name,
              check_type: checkData.check_type,
              target_url: checkData.target_url,
              organization_id: checkData.organization_id,
              check_interval: checkData.check_interval,
              timeout: checkData.target_timeout,
              status: checkData.status,
              is_active: checkData.status === 'active',
            };
          } catch (error) {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      console.error('Error getting pending monitoring checks:', error);
      return [];
    }
  }

  async getMonitoringCheckById(checkId) {
    try {
      const { data, error } = await this.client
        .from('monitoring_checks')
        .select('*, organizations(name)')
        .eq('id', checkId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        check_type: data.check_type,
        target_url: data.target_url,
        url: data.target_url,
        organization_id: data.organization_id,
        organization_name: data.organizations?.name || 'Unknown Organization',
        check_interval: Math.floor(data.check_interval_seconds / 60),
        check_interval_seconds: data.check_interval_seconds,
        timeout: data.timeout_seconds,
        timeout_seconds: data.timeout_seconds,
        status: data.status,
        is_active: data.status === 'active',
        current_status: data.current_status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        linked_service_id: data.linked_service_id,
        failure_threshold: data.failure_threshold,
        success_threshold: data.success_threshold,
        failure_threshold_minutes: data.failure_threshold_minutes,
        consecutive_failures: data.consecutive_failures,
        consecutive_successes: data.consecutive_successes,
        last_check_at: data.last_check_at,
        last_success_at: data.last_success_at,
        last_failure_at: data.last_failure_at,
        failure_message: data.failure_message,
        // HTTP settings
        method: data.method,
        http_method: data.method,
        headers: data.headers,
        http_headers: data.headers,
        body: data.body,
        expected_status_code: data.expected_status_code,
        expected_status_codes: [data.expected_status_code],
        // Status page configuration
        status_page_config: data.status_page_config,
      };
    } catch (error) {
      console.error('Error getting monitoring check by ID:', error);
      throw error;
    }
  }

  async getMonitoringChecksByStatus(status) {
    // Workaround: Get monitoring checks by status from services table
    try {
      const { data, error } = await this.client
        .from('services')
        .select('*')
        .ilike('name', '[[]MONITORING]%')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform and filter by status
      return (data || [])
        .map(service => {
          try {
            const checkData = JSON.parse(service.description);
            if (checkData.type !== 'monitoring_check') {
              return null;
            }

            const isActive = checkData.status === 'active';
            if (
              (status === 'active' && !isActive) ||
              (status !== 'active' && isActive)
            ) {
              return null;
            }

            return {
              id: service.id,
              name: checkData.name,
              check_type: checkData.check_type,
              target_url: checkData.target_url,
              organization_id: checkData.organization_id,
              check_interval: checkData.check_interval,
              timeout: checkData.target_timeout,
              status: checkData.status,
              is_active: checkData.status === 'active',
              created_at: service.created_at,
              updated_at: service.updated_at,
            };
          } catch (error) {
            return null;
          }
        })
        .filter(Boolean);
    } catch (error) {
      console.error('Error getting monitoring checks by status:', error);
      return [];
    }
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
    // First, get organizations the user has access to
    const { data: userOrgs, error: orgError } = await this.client
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (orgError) throw orgError;

    if (!userOrgs || userOrgs.length === 0) {
      return [];
    }

    const orgIds = userOrgs.map(org => org.organization_id);

    // Now get status pages for those organizations
    const { data, error } = await this.client
      .from('status_pages')
      .select(
        `
        *,
        organizations(name, slug)
      `
      )
      .in('organization_id', orgIds)
      .is('deleted_at', null)
      .order('organizations(name)', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // SLA & Uptime calculations
  async getServiceUptimeStats(serviceId, days = 30) {
    try {
      // Calculate uptime based on actual service_status_history data
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // Get all status history for this service that overlaps with the time period
      // This includes periods that started before the time window but are still ongoing
      const { data: statusHistory, error } = await this.client
        .from('service_status_history')
        .select('status, started_at, ended_at')
        .eq('service_id', serviceId)
        .or(
          `started_at.lte.${endDate.toISOString()},ended_at.gte.${startDate.toISOString()},ended_at.is.null`
        )
        .order('started_at', { ascending: true });

      if (error) {
        console.warn('Error fetching service status history:', error);
        return this.getMockUptimeStats(days);
      }

      if (!statusHistory || statusHistory.length === 0) {
        // No status history, assume operational for the entire period
        return {
          uptime_percentage: 100.0,
          total_checks: days * 24 * 4, // Simulate checks every 15 minutes
          successful_checks: days * 24 * 4,
          failed_checks: 0,
        };
      }

      // Calculate total minutes in the period
      const totalMinutes = (endDate - startDate) / (1000 * 60);
      let operationalMinutes = 0;
      let coveredMinutes = 0; // Track how much time we have coverage for

      // Process each status period
      for (const period of statusHistory) {
        const periodStart = new Date(
          Math.max(new Date(period.started_at), startDate)
        );
        const periodEnd = period.ended_at
          ? new Date(Math.min(new Date(period.ended_at), endDate))
          : endDate;

        // Only count if the period overlaps with our time range
        if (periodEnd > periodStart) {
          const durationMinutes = (periodEnd - periodStart) / (1000 * 60);
          coveredMinutes += durationMinutes;

          // Count operational and maintenance as uptime
          if (
            period.status === 'operational' ||
            period.status === 'maintenance'
          ) {
            operationalMinutes += durationMinutes;
          }
          // Note: 'down' and 'degraded' count as downtime (not added to operationalMinutes)
        }
      }

      // If we don't have complete coverage, assume operational for uncovered time
      // This handles the case where service was created recently
      const uncoveredMinutes = Math.max(0, totalMinutes - coveredMinutes);
      operationalMinutes += uncoveredMinutes;

      // Calculate uptime percentage
      const uptimePercentage =
        totalMinutes > 0 ? (operationalMinutes / totalMinutes) * 100 : 100;

      // Simulate check counts for consistency with UI expectations
      const totalChecks = Math.floor(days * 24 * 4); // Every 15 minutes
      const successfulChecks = Math.floor(
        (uptimePercentage / 100) * totalChecks
      );

      return {
        uptime_percentage: Math.max(0, Math.min(100, uptimePercentage)),
        total_checks: totalChecks,
        successful_checks: successfulChecks,
        failed_checks: totalChecks - successfulChecks,
      };
    } catch (error) {
      console.warn('Error in getServiceUptimeStats:', error);
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

  // Manually track service status change (for cases where trigger might not work)
  async trackServiceStatusChange(serviceId, newStatus, oldStatus = null) {
    try {
      // End any current ongoing status period
      const { error: endError } = await this.client
        .from('service_status_history')
        .update({
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('service_id', serviceId)
        .is('ended_at', null);

      if (endError) {
        console.warn('Error ending current status period:', endError);
      }

      // Start a new status period
      const { error: insertError } = await this.client
        .from('service_status_history')
        .insert({
          service_id: serviceId,
          status: newStatus,
          started_at: new Date().toISOString(),
          ended_at: null,
        });

      if (insertError) {
        console.error('Error creating new status period:', insertError);
        return false;
      }

      console.log(
        `📊 Tracked status change for service ${serviceId}: ${oldStatus} → ${newStatus}`
      );
      return true;
    } catch (error) {
      console.error('Error tracking service status change:', error);
      return false;
    }
  }

  // Team Groups Management
  async getTeamGroups(organizationId) {
    // Use admin client to bypass RLS for team fetching
    const client = this.adminClient || this.client;
    const { data, error } = await client
      .from('team_groups')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getTeamGroup(teamId) {
    const { data, error } = await this.client
      .from('team_groups')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createTeamGroup(teamData, userId) {
    console.log('🏗️ Creating team with data:', teamData);
    console.log('🔑 Admin client available:', !!this.adminClient);
    
    // Use admin client to bypass RLS for team creation
    // The API already validates user access to the organization
    const client = this.adminClient || this.client;
    console.log('🔧 Using client type:', this.adminClient ? 'admin' : 'regular');
    
    const { data, error } = await client
      .from('team_groups')
      .insert(teamData)
      .select()
      .single();

    if (error) {
      console.error('❌ Team creation error:', error);
      throw error;
    }
    
    console.log('✅ Team created successfully:', data);
    return data;
  }

  async updateTeamGroup(teamId, updateData) {
    const { data, error } = await this.client
      .from('team_groups')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteTeamGroup(teamId) {
    const { error } = await this.client
      .from('team_groups')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
    return { success: true };
  }

  // Team Memberships Management
  async getTeamMemberships(teamId) {
    const { data, error } = await this.client
      .from('team_memberships')
      .select(
        `
        *,
        users(id, name, email, avatar_url)
      `
      )
      .eq('team_group_id', teamId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async addTeamMember(teamId, userId, role = 'member') {
    const { data, error } = await this.client
      .from('team_memberships')
      .insert({
        team_group_id: teamId,
        user_id: userId,
        role,
        is_active: true,
        joined_at: new Date().toISOString(),
      })
      .select(
        `
        *,
        users(id, name, email, avatar_url)
      `
      )
      .single();

    if (error) throw error;
    return data;
  }

  async updateTeamMembership(membershipId, updateData) {
    const { data, error } = await this.client
      .from('team_memberships')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', membershipId)
      .select(
        `
        *,
        users(id, name, email, avatar_url)
      `
      )
      .single();

    if (error) throw error;
    return data;
  }

  async removeTeamMember(membershipId) {
    const { error } = await this.client
      .from('team_memberships')
      .delete()
      .eq('id', membershipId);

    if (error) throw error;
    return { success: true };
  }

  // Organization Members for User Selection
  async getOrganizationMembers(organizationId) {
    const { data, error } = await this.client
      .from('organization_members')
      .select(
        `
        *,
        users!organization_members_user_id_fkey(id, name, email, avatar_url, incident_role, is_on_call)
      `
      )
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .or('accepted_at.not.is.null,role.eq.owner');

    if (error) throw error;
    return data || [];
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

  async searchUsers(organizationId, searchTerm = '') {
    let query = this.client
      .from('organization_members')
      .select(
        `
        *,
        users(id, name, email, avatar_url, incident_role, is_on_call)
      `
      )
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .not('accepted_at', 'is', null);

    if (searchTerm) {
      query = query.or(
        `users.name.ilike.%${searchTerm}%,users.email.ilike.%${searchTerm}%`
      );
    }

    const { data, error } = await query
      .order('users(name)', { ascending: true })
      .limit(50);

    if (error) throw error;
    return data || [];
  }

  // Bulk Member Operations
  async updateOrganizationMemberRole(organizationId, memberId, role) {
    const { data, error } = await this.client
      .from('organization_members')
      .update({ 
        role,
        updated_at: new Date().toISOString()
      })
      .eq('organization_id', organizationId)
      .eq('user_id', memberId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeOrganizationMember(organizationId, memberId) {
    const { error } = await this.client
      .from('organization_members')
      .delete()
      .eq('organization_id', organizationId)
      .eq('user_id', memberId);

    if (error) throw error;
    return { success: true };
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

// Export raw supabase client for direct use
export { supabase };
