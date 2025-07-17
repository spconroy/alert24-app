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
    return data;
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
        services(name),
        users(name, email)
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
        users(email, name),
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
}

// Export singleton instance
export const db = new SupabaseClient();
export default db;
