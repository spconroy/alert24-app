import { NextResponse } from 'next/server';
import { SupabaseClient } from '../../../lib/db-supabase.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusPageId = searchParams.get('statusPageId');
    const incidentId = searchParams.get('incidentId');

    if (statusPageId) {
      const updates = await db.statusUpdates.findByStatusPageId(statusPageId);
      return NextResponse.json({ updates });
    }

    if (incidentId) {
      const updates = await db.statusUpdates.findByIncidentId(incidentId);
      return NextResponse.json({ updates });
    }

    const updates = await db.statusUpdates.findAll();
    return NextResponse.json({ updates });
  } catch (error) {
    console.error('Error fetching status updates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status updates' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { statusPageId, incidentId, title, message, status, createdBy } =
      await request.json();

    if (!statusPageId || !title || !message || !status) {
      return NextResponse.json(
        { error: 'Status page ID, title, message, and status are required' },
        { status: 400 }
      );
    }

    const update = await db.statusUpdates.create({
      status_page_id: statusPageId,
      incident_id: incidentId,
      title,
      message,
      status,
      created_by: createdBy,
    });

    return NextResponse.json({ update }, { status: 201 });
  } catch (error) {
    console.error('Error creating status update:', error);
    return NextResponse.json(
      { error: 'Failed to create status update' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { id, title, message, status } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Update ID is required' },
        { status: 400 }
      );
    }

    const update = await db.statusUpdates.update(id, {
      title,
      message,
      status,
    });

    return NextResponse.json({ update });
  } catch (error) {
    console.error('Error updating status update:', error);
    return NextResponse.json(
      { error: 'Failed to update status update' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Update ID is required' },
        { status: 400 }
      );
    }

    await db.statusUpdates.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting status update:', error);
    return NextResponse.json(
      { error: 'Failed to delete status update' },
      { status: 500 }
    );
  }
}
