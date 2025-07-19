import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { supabase } from '@/lib/db-supabase';

export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const timeRange = searchParams.get('timeRange') || '24h';

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check if user belongs to organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', session.user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Calculate time range
    const now = new Date();
    let startTime;
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get overall stats
    const { data: overallStats, error: overallError } = await supabase
      .from('email_notifications')
      .select('status, email_type, priority, attempts')
      .eq('organization_id', organizationId)
      .gte('created_at', startTime.toISOString());

    if (overallError) {
      console.error('Error fetching notification stats:', overallError);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Calculate statistics
    const stats = {
      total: overallStats.length,
      sent: overallStats.filter(n => n.status === 'sent').length,
      failed: overallStats.filter(n => n.status === 'failed').length,
      pending: overallStats.filter(n => n.status === 'pending').length,
      deliveryRate: 0,
      
      byType: {},
      byPriority: {},
      byStatus: {},
      
      retryStats: {
        singleAttempt: overallStats.filter(n => n.attempts === 1).length,
        multipleAttempts: overallStats.filter(n => n.attempts > 1).length,
        maxAttempts: Math.max(...overallStats.map(n => n.attempts), 0),
        avgAttempts: overallStats.length > 0 
          ? overallStats.reduce((sum, n) => sum + n.attempts, 0) / overallStats.length 
          : 0,
      },
      
      timeRange,
      organizationId,
      generatedAt: new Date().toISOString(),
    };

    // Calculate delivery rate
    const totalDeliveryAttempts = stats.sent + stats.failed;
    if (totalDeliveryAttempts > 0) {
      stats.deliveryRate = (stats.sent / totalDeliveryAttempts) * 100;
    }

    // Group by email type
    stats.byType = overallStats.reduce((acc, notification) => {
      const type = notification.email_type || 'unknown';
      if (!acc[type]) {
        acc[type] = { total: 0, sent: 0, failed: 0, pending: 0 };
      }
      acc[type].total++;
      acc[type][notification.status]++;
      return acc;
    }, {});

    // Group by priority
    stats.byPriority = overallStats.reduce((acc, notification) => {
      const priority = notification.priority || 'normal';
      if (!acc[priority]) {
        acc[priority] = { total: 0, sent: 0, failed: 0, pending: 0 };
      }
      acc[priority].total++;
      acc[priority][notification.status]++;
      return acc;
    }, {});

    // Group by status
    stats.byStatus = overallStats.reduce((acc, notification) => {
      const status = notification.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Get hourly breakdown for the time range
    const { data: hourlyData, error: hourlyError } = await supabase
      .from('email_notifications')
      .select('created_at, status')
      .eq('organization_id', organizationId)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: true });

    if (!hourlyError && hourlyData) {
      // Group by hour
      const hourlyStats = {};
      hourlyData.forEach(notification => {
        const hour = new Date(notification.created_at).toISOString().substring(0, 13);
        if (!hourlyStats[hour]) {
          hourlyStats[hour] = { total: 0, sent: 0, failed: 0, pending: 0 };
        }
        hourlyStats[hour].total++;
        hourlyStats[hour][notification.status]++;
      });

      stats.hourlyBreakdown = hourlyStats;
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error in notification stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}