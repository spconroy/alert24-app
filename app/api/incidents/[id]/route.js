import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req, { params }) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Incident ID is required' }), { status: 400 });
  }

  try {
    // Get user ID
    const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [session.user.email]);
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    // Get incident with organization membership check
    const incidentRes = await pool.query(`
      SELECT i.*,
             o.name as organization_name,
             u1.name as created_by_name, u1.email as created_by_email,
             u2.name as assigned_to_name, u2.email as assigned_to_email,
             ep.name as escalation_policy_name,
             ep.escalation_timeout_minutes
      FROM public.incidents i
      JOIN public.organizations o ON i.organization_id = o.id
      JOIN public.organization_members om ON o.id = om.organization_id
      JOIN public.users u1 ON i.created_by = u1.id
      LEFT JOIN public.users u2 ON i.assigned_to = u2.id
      LEFT JOIN public.escalation_policies ep ON i.escalation_policy_id = ep.id
      WHERE i.id = $1 AND om.user_id = $2 AND om.is_active = true
    `, [id, user.id]);

    if (incidentRes.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Incident not found or access denied' }), { status: 404 });
    }

    const incident = incidentRes.rows[0];

    // Get incident updates timeline
    const updatesRes = await pool.query(`
      SELECT iu.*,
             u.name as posted_by_name, u.email as posted_by_email
      FROM public.incident_updates iu
      JOIN public.users u ON iu.posted_by = u.id
      WHERE iu.incident_id = $1
      ORDER BY iu.created_at ASC
    `, [id]);

    return new Response(JSON.stringify({
      incident: incident,
      updates: updatesRes.rows
    }), { status: 200 });

  } catch (error) {
    console.error('GET incident error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Incident ID is required' }), { status: 400 });
  }

  try {
    const body = await req.json();
    const {
      title,
      description,
      severity,
      status,
      affected_services,
      impact_description,
      assigned_to,
      escalation_policy_id,
      tags,
      update_message,
      visible_to_subscribers = true
    } = body;

    // Get user ID
    const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [session.user.email]);
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    // Check incident exists and user has access
    const incidentCheckRes = await pool.query(`
      SELECT i.*, om.incident_role, om.can_edit_incidents
      FROM public.incidents i
      JOIN public.organization_members om ON i.organization_id = om.organization_id
      WHERE i.id = $1 AND om.user_id = $2 AND om.is_active = true
    `, [id, user.id]);

    if (incidentCheckRes.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Incident not found or access denied' }), { status: 404 });
    }

    const currentIncident = incidentCheckRes.rows[0];
    
    // Check permissions - must be admin/manager, assigned user, or have edit permission
    const canEdit = currentIncident.incident_role === 'admin' || 
                   currentIncident.incident_role === 'manager' ||
                   currentIncident.can_edit_incidents ||
                   currentIncident.assigned_to === user.id ||
                   currentIncident.created_by === user.id;

    if (!canEdit) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions to edit this incident' }), { status: 403 });
    }

    // Validate assigned user if provided
    if (assigned_to && assigned_to !== currentIncident.assigned_to) {
      const assignedUserRes = await pool.query(`
        SELECT u.id
        FROM public.users u
        JOIN public.organization_members om ON u.id = om.user_id
        WHERE u.id = $1 AND om.organization_id = $2 AND om.is_active = true
      `, [assigned_to, currentIncident.organization_id]);

      if (assignedUserRes.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Assigned user not found or not a member of this organization' }), { status: 400 });
      }
    }

    // Validate escalation policy if provided
    if (escalation_policy_id && escalation_policy_id !== currentIncident.escalation_policy_id) {
      const policyRes = await pool.query(`
        SELECT id FROM public.escalation_policies
        WHERE id = $1 AND organization_id = $2 AND is_active = true
      `, [escalation_policy_id, currentIncident.organization_id]);

      if (policyRes.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Escalation policy not found or not active' }), { status: 400 });
      }
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updateFields.push(`title = $${paramIndex}`);
      updateValues.push(title);
      paramIndex++;
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(description);
      paramIndex++;
    }

    if (severity !== undefined) {
      updateFields.push(`severity = $${paramIndex}`);
      updateValues.push(severity);
      paramIndex++;
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(status);
      paramIndex++;
    }

    if (affected_services !== undefined) {
      updateFields.push(`affected_services = $${paramIndex}`);
      updateValues.push(affected_services);
      paramIndex++;
    }

    if (impact_description !== undefined) {
      updateFields.push(`impact_description = $${paramIndex}`);
      updateValues.push(impact_description);
      paramIndex++;
    }

    if (assigned_to !== undefined) {
      updateFields.push(`assigned_to = $${paramIndex}`);
      updateValues.push(assigned_to);
      paramIndex++;
    }

    if (escalation_policy_id !== undefined) {
      updateFields.push(`escalation_policy_id = $${paramIndex}`);
      updateValues.push(escalation_policy_id);
      paramIndex++;
    }

    if (tags !== undefined) {
      updateFields.push(`tags = $${paramIndex}`);
      updateValues.push(tags);
      paramIndex++;
    }

    // Always update the updated_at timestamp
    updateFields.push(`updated_at = NOW()`);

    // Add incident ID for WHERE clause
    updateValues.push(id);
    const whereParamIndex = paramIndex;

    if (updateFields.length === 1) { // Only updated_at was added
      return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400 });
    }

    // Update incident
    const updateQuery = `
      UPDATE public.incidents 
      SET ${updateFields.join(', ')}
      WHERE id = $${whereParamIndex}
      RETURNING *
    `;

    const updateRes = await pool.query(updateQuery, updateValues);
    const updatedIncident = updateRes.rows[0];

    // Create incident update if message provided or status changed
    if (update_message || (status && status !== currentIncident.status)) {
      let message = update_message || '';
      let updateType = 'update';

      if (status && status !== currentIncident.status) {
        if (status === 'resolved') {
          message = message || 'Incident resolved';
          updateType = 'resolved';
        } else if (status === 'investigating') {
          message = message || 'Incident under investigation';
          updateType = 'investigating';
        } else if (status === 'monitoring') {
          message = message || 'Issue identified and monitoring';
          updateType = 'monitoring';
        } else {
          message = message || `Status changed to ${status}`;
        }
      }

      if (message) {
        await pool.query(`
          INSERT INTO public.incident_updates (
            incident_id, message, status, update_type, posted_by, visible_to_subscribers
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          id,
          message,
          updatedIncident.status,
          updateType,
          user.id,
          visible_to_subscribers
        ]);
      }
    }

    // Get full updated incident details
    const fullIncidentRes = await pool.query(`
      SELECT i.*,
             o.name as organization_name,
             u1.name as created_by_name, u1.email as created_by_email,
             u2.name as assigned_to_name, u2.email as assigned_to_email,
             ep.name as escalation_policy_name
      FROM public.incidents i
      JOIN public.organizations o ON i.organization_id = o.id
      JOIN public.users u1 ON i.created_by = u1.id
      LEFT JOIN public.users u2 ON i.assigned_to = u2.id
      LEFT JOIN public.escalation_policies ep ON i.escalation_policy_id = ep.id
      WHERE i.id = $1
    `, [id]);

    return new Response(JSON.stringify({
      incident: fullIncidentRes.rows[0]
    }), { status: 200 });

  } catch (error) {
    console.error('PUT incident error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession();
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Incident ID is required' }), { status: 400 });
  }

  try {
    // Get user ID
    const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [session.user.email]);
    const user = userRes.rows[0];
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    // Check incident exists and user has admin/manager permission
    const incidentCheckRes = await pool.query(`
      SELECT i.*, om.incident_role
      FROM public.incidents i
      JOIN public.organization_members om ON i.organization_id = om.organization_id
      WHERE i.id = $1 AND om.user_id = $2 AND om.is_active = true
    `, [id, user.id]);

    if (incidentCheckRes.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Incident not found or access denied' }), { status: 404 });
    }

    const incident = incidentCheckRes.rows[0];
    
    // Only admins and managers can delete incidents
    if (incident.incident_role !== 'admin' && incident.incident_role !== 'manager') {
      return new Response(JSON.stringify({ error: 'Only admins and managers can delete incidents' }), { status: 403 });
    }

    // Begin transaction for cleanup
    await pool.query('BEGIN');

    try {
      // Delete incident updates first (foreign key constraint)
      await pool.query('DELETE FROM public.incident_updates WHERE incident_id = $1', [id]);
      
      // Delete incident escalations
      await pool.query('DELETE FROM public.incident_escalations WHERE incident_id = $1', [id]);
      
      // Delete the incident
      const deleteRes = await pool.query('DELETE FROM public.incidents WHERE id = $1 RETURNING title', [id]);
      
      if (deleteRes.rows.length === 0) {
        throw new Error('Incident not found or already deleted');
      }

      await pool.query('COMMIT');

      console.log(`Incident "${deleteRes.rows[0].title}" (${id}) deleted by user ${session.user.email}`);

      return new Response(JSON.stringify({
        message: 'Incident deleted successfully',
        deletedIncident: { id, title: deleteRes.rows[0].title }
      }), { status: 200 });

    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }

  } catch (error) {
    console.error('DELETE incident error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
} 