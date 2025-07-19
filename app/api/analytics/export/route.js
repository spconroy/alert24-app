import { supabase } from '@/lib/db-supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { organizationId, dateRange, services, format } = await request.json();

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (dateRange) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Get analytics data
    const analyticsData = await getAnalyticsData(organizationId, services, startDate, endDate);

    if (format === 'csv') {
      const csv = generateCSV(analyticsData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-report-${dateRange}.csv"`
        }
      });
    } else if (format === 'pdf') {
      // For now, return a simple text response
      // In a real implementation, you'd use a PDF library like jsPDF or puppeteer
      const pdfContent = generatePDFContent(analyticsData);
      return new NextResponse(pdfContent, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="analytics-report-${dateRange}.pdf"`
        }
      });
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });

  } catch (error) {
    console.error('Error exporting analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getAnalyticsData(organizationId, services, startDate, endDate) {
  // Get service information
  const { data: serviceData, error: serviceError } = await supabase
    .from('services')
    .select('*')
    .in('id', services);

  // Get monitoring checks
  const { data: monitoringChecks, error: checksError } = await supabase
    .from('service_monitoring_checks')
    .select('monitoring_check_id')
    .in('service_id', services);

  const checkIds = monitoringChecks?.map(check => check.monitoring_check_id) || [];

  // Get monitoring statistics
  const { data: stats, error: statsError } = await supabase
    .from('monitoring_statistics')
    .select('*')
    .in('monitoring_check_id', checkIds)
    .gte('date_hour', startDate.toISOString())
    .lte('date_hour', endDate.toISOString());

  // Get incidents
  const { data: incidents, error: incidentsError } = await supabase
    .from('incidents')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  return {
    services: serviceData || [],
    statistics: stats || [],
    incidents: incidents || [],
    dateRange: { start: startDate, end: endDate }
  };
}

function generateCSV(data) {
  const { services, statistics, incidents, dateRange } = data;
  
  let csv = 'Analytics Report\\n';
  csv += `Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}\\n\\n`;
  
  // Service Summary
  csv += 'Service Summary\\n';
  csv += 'Service Name,Total Checks,Successful Checks,Uptime %,Avg Response Time\\n';
  
  services.forEach(service => {
    const serviceStats = statistics.filter(stat => stat.service_id === service.id);
    const totalChecks = serviceStats.reduce((sum, stat) => sum + (stat.total_checks || 0), 0);
    const successfulChecks = serviceStats.reduce((sum, stat) => sum + (stat.successful_checks || 0), 0);
    const uptime = totalChecks > 0 ? (successfulChecks / totalChecks * 100).toFixed(2) : '100.00';
    const avgResponseTime = serviceStats.length > 0 
      ? Math.round(serviceStats.reduce((sum, stat) => sum + (stat.avg_response_time || 0), 0) / serviceStats.length)
      : 0;
    
    csv += `"${service.name}",${totalChecks},${successfulChecks},${uptime},${avgResponseTime}\\n`;
  });
  
  csv += '\\n';
  
  // Incidents Summary
  csv += 'Incidents Summary\\n';
  csv += 'Title,Severity,Status,Created,Resolved,Duration (minutes)\\n';
  
  incidents.forEach(incident => {
    const created = new Date(incident.created_at);
    const resolved = incident.resolved_at ? new Date(incident.resolved_at) : null;
    const duration = resolved ? Math.round((resolved - created) / (1000 * 60)) : 'Ongoing';
    
    csv += `"${incident.title}","${incident.severity}","${incident.status}","${created.toLocaleString()}","${resolved ? resolved.toLocaleString() : 'N/A'}",${duration}\\n`;
  });
  
  return csv;
}

function generatePDFContent(data) {
  // This is a placeholder - in a real implementation, you'd generate actual PDF content
  const { services, statistics, incidents, dateRange } = data;
  
  let content = `Analytics Report\\n`;
  content += `Period: ${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}\\n\\n`;
  
  content += `Services: ${services.length}\\n`;
  content += `Total Incidents: ${incidents.length}\\n`;
  content += `Monitoring Data Points: ${statistics.length}\\n\\n`;
  
  content += `This is a simplified PDF export. For full PDF functionality, implement using libraries like jsPDF or Puppeteer.`;
  
  return content;
}