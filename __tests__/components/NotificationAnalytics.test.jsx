import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationAnalytics from '@/components/NotificationAnalytics';
import { OrganizationContext } from '@/contexts/OrganizationContext';

// Mock fetch
global.fetch = jest.fn();

const mockOrganizationContext = {
  currentOrganization: {
    id: 'org-123',
    name: 'Test Organization',
  },
};

const mockStats = {
  total: 150,
  sent: 140,
  failed: 8,
  pending: 2,
  deliveryRate: 94.6,
  
  byType: {
    incident: { total: 50, sent: 48, failed: 2, pending: 0 },
    monitoring: { total: 80, sent: 75, failed: 4, pending: 1 },
    invitation: { total: 20, sent: 17, failed: 2, pending: 1 },
  },
  
  byPriority: {
    critical: { total: 30, sent: 28, failed: 2, pending: 0 },
    high: { total: 40, sent: 38, failed: 2, pending: 0 },
    normal: { total: 60, sent: 56, failed: 3, pending: 1 },
    low: { total: 20, sent: 18, failed: 1, pending: 1 },
  },
  
  byStatus: {
    sent: 140,
    failed: 8,
    pending: 2,
  },
  
  retryStats: {
    singleAttempt: 130,
    multipleAttempts: 20,
    maxAttempts: 3,
    avgAttempts: 1.2,
  },
  
  timeRange: '24h',
  organizationId: 'org-123',
  generatedAt: '2024-01-01T12:00:00Z',
};

const renderWithContext = (component, contextValue = mockOrganizationContext) => {
  return render(
    <OrganizationContext.Provider value={contextValue}>
      {component}
    </OrganizationContext.Provider>
  );
};

describe('NotificationAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  it('should prompt user to select organization when none is selected', () => {
    renderWithContext(<NotificationAnalytics />, { currentOrganization: null });

    expect(screen.getByText('Please select an organization to view notification analytics.')).toBeInTheDocument();
  });

  it('should show loading state while fetching data', () => {
    fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithContext(<NotificationAnalytics />);

    expect(screen.getByText('Loading analytics...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should fetch and display analytics data', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    // Check main statistics cards
    expect(screen.getByText('150')).toBeInTheDocument(); // Total
    expect(screen.getByText('140')).toBeInTheDocument(); // Sent
    expect(screen.getByText('8')).toBeInTheDocument(); // Failed
    expect(screen.getByText('2')).toBeInTheDocument(); // Pending

    // Check delivery rate
    expect(screen.getByText('Delivery Rate: 94.6%')).toBeInTheDocument();

    expect(fetch).toHaveBeenCalledWith('/api/notifications/stats?organizationId=org-123&timeRange=24h');
  });

  it('should handle API errors gracefully', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load notification analytics.')).toBeInTheDocument();
    });
  });

  it('should handle network errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load notification analytics.')).toBeInTheDocument();
    });
  });

  it('should change time range and refetch data', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockStats, timeRange: '7d' }),
      });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    // Change time range
    const timeRangeSelect = screen.getByRole('combobox', { name: /time range/i });
    fireEvent.click(timeRangeSelect);
    
    const sevenDaysOption = screen.getByRole('option', { name: '7 Days' });
    fireEvent.click(sevenDaysOption);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenLastCalledWith('/api/notifications/stats?organizationId=org-123&timeRange=7d');
    });
  });

  it('should display notifications by type table', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('Notifications by Type')).toBeInTheDocument();
    
    // Check table content
    expect(screen.getByText('incident')).toBeInTheDocument();
    expect(screen.getByText('monitoring')).toBeInTheDocument();
    expect(screen.getByText('invitation')).toBeInTheDocument();

    // Check some statistics in the table
    const cells = screen.getAllByRole('cell');
    expect(cells.some(cell => cell.textContent === '50')).toBeTruthy(); // incident total
    expect(cells.some(cell => cell.textContent === '80')).toBeTruthy(); // monitoring total
  });

  it('should display notifications by priority table', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    expect(screen.getByText('Notifications by Priority')).toBeInTheDocument();
    
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('normal')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
  });

  it('should display retry statistics', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    expect(screen.getByText('Retry Statistics')).toBeInTheDocument();
    expect(screen.getByText('Single Attempt')).toBeInTheDocument();
    expect(screen.getByText('Multiple Attempts')).toBeInTheDocument();
    expect(screen.getByText('Max Attempts')).toBeInTheDocument();
    expect(screen.getByText('Avg Attempts')).toBeInTheDocument();

    expect(screen.getByText('130')).toBeInTheDocument(); // Single attempt
    expect(screen.getByText('20')).toBeInTheDocument(); // Multiple attempts
    expect(screen.getByText('3')).toBeInTheDocument(); // Max attempts
    expect(screen.getByText('1.2')).toBeInTheDocument(); // Avg attempts
  });

  it('should display generated timestamp', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    expect(screen.getByText(/data generated at:/i)).toBeInTheDocument();
  });

  it('should format numbers with locale formatting', async () => {
    const largeNumberStats = {
      ...mockStats,
      total: 1234567,
      sent: 1200000,
      failed: 34567,
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => largeNumberStats,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    // Numbers should be formatted with commas
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
    expect(screen.getByText('1,200,000')).toBeInTheDocument();
    expect(screen.getByText('34,567')).toBeInTheDocument();
  });

  it('should use appropriate colors for different priorities and types', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    // Check that chips are rendered (they contain the type/priority info)
    const chips = screen.getAllByRole('status'); // MUI Chip has role="status"
    expect(chips.length).toBeGreaterThan(0);
  });

  it('should refetch data when organization changes', async () => {
    const { rerender } = renderWithContext(<NotificationAnalytics />);

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/notifications/stats?organizationId=org-123&timeRange=24h');
    });

    // Change organization
    const newOrgContext = {
      currentOrganization: {
        id: 'org-456',
        name: 'New Organization',
      },
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockStats, organizationId: 'org-456' }),
    });

    rerender(
      <OrganizationContext.Provider value={newOrgContext}>
        <NotificationAnalytics />
      </OrganizationContext.Provider>
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/notifications/stats?organizationId=org-456&timeRange=24h');
    });
  });

  it('should handle empty data gracefully', async () => {
    const emptyStats = {
      total: 0,
      sent: 0,
      failed: 0,
      pending: 0,
      deliveryRate: 0,
      byType: {},
      byPriority: {},
      byStatus: {},
      retryStats: {
        singleAttempt: 0,
        multipleAttempts: 0,
        maxAttempts: 0,
        avgAttempts: 0,
      },
      timeRange: '24h',
      organizationId: 'org-123',
      generatedAt: '2024-01-01T12:00:00Z',
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => emptyStats,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    expect(screen.getByText('0')).toBeInTheDocument(); // Should show zeros
    expect(screen.getByText('Delivery Rate: 0%')).toBeInTheDocument();
  });

  it('should show all available time range options', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    renderWithContext(<NotificationAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
    });

    const timeRangeSelect = screen.getByRole('combobox', { name: /time range/i });
    fireEvent.click(timeRangeSelect);

    expect(screen.getByRole('option', { name: 'Last Hour' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Last 24 Hours' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Last 7 Days' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Last 30 Days' })).toBeInTheDocument();
  });
});