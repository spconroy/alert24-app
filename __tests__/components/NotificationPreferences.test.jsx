import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationPreferences from '@/components/NotificationPreferences';

// Mock fetch
global.fetch = jest.fn();

describe('NotificationPreferences', () => {
  const mockPreferences = {
    email_invitations: true,
    email_incidents: true,
    email_monitoring: false,
    email_updates: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  it('should render loading state initially', () => {
    fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<NotificationPreferences />);

    expect(screen.getByText('Loading notification preferences...')).toBeInTheDocument();
  });

  it('should fetch and display preferences on mount', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    // Check that switches are set according to preferences
    const invitationSwitch = screen.getByRole('checkbox', { name: /organization invitations/i });
    const incidentSwitch = screen.getByRole('checkbox', { name: /incident notifications/i });
    const monitoringSwitch = screen.getByRole('checkbox', { name: /monitoring alerts/i });
    const updatesSwitch = screen.getByRole('checkbox', { name: /product updates/i });

    expect(invitationSwitch).toBeChecked();
    expect(incidentSwitch).toBeChecked();
    expect(monitoringSwitch).not.toBeChecked();
    expect(updatesSwitch).toBeChecked();

    expect(fetch).toHaveBeenCalledWith('/api/notifications/preferences');
  });

  it('should show error message when fetch fails', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load notification preferences')).toBeInTheDocument();
    });
  });

  it('should handle network errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load notification preferences')).toBeInTheDocument();
    });
  });

  it('should update preferences when switches are toggled', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    // Toggle the monitoring switch (currently off)
    const monitoringSwitch = screen.getByRole('checkbox', { name: /monitoring alerts/i });
    fireEvent.click(monitoringSwitch);

    expect(monitoringSwitch).toBeChecked();
  });

  it('should save preferences when save button is clicked', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    // Toggle a switch
    const monitoringSwitch = screen.getByRole('checkbox', { name: /monitoring alerts/i });
    fireEvent.click(monitoringSwitch);

    // Click save button
    const saveButton = screen.getByRole('button', { name: /save preferences/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Notification preferences updated successfully')).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith('/api/notifications/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_invitations: true,
        email_incidents: true,
        email_monitoring: true, // Was toggled on
        email_updates: true,
      }),
    });
  });

  it('should show loading state while saving', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      })
      .mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save preferences/i });
    fireEvent.click(saveButton);

    expect(screen.getByRole('button', { name: /saving.../i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saving.../i })).toBeDisabled();
  });

  it('should show error message when save fails', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save preferences/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save notification preferences')).toBeInTheDocument();
    });
  });

  it('should handle save network errors', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      })
      .mockRejectedValueOnce(new Error('Network error'));

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save preferences/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to save notification preferences')).toBeInTheDocument();
    });
  });

  it('should dismiss alert messages when close button is clicked', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPreferences,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    // Save to trigger success message
    const saveButton = screen.getByRole('button', { name: /save preferences/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Notification preferences updated successfully')).toBeInTheDocument();
    });

    // Find and click the close button on the alert
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(screen.queryByText('Notification preferences updated successfully')).not.toBeInTheDocument();
  });

  it('should display all preference categories with descriptions', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    // Check all preference categories are displayed
    expect(screen.getByText('Organization Invitations')).toBeInTheDocument();
    expect(screen.getByText('Incident Notifications')).toBeInTheDocument();
    expect(screen.getByText('Monitoring Alerts')).toBeInTheDocument();
    expect(screen.getByText('Product Updates')).toBeInTheDocument();

    // Check descriptions are displayed
    expect(screen.getByText(/receive emails when you're invited to join organizations/i)).toBeInTheDocument();
    expect(screen.getByText(/receive emails about new incidents, status updates, and resolutions/i)).toBeInTheDocument();
    expect(screen.getByText(/receive emails when services go down, recover, or are degraded/i)).toBeInTheDocument();
    expect(screen.getByText(/receive emails about new features, announcements, and product updates/i)).toBeInTheDocument();
  });

  it('should display unsubscribe information', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    expect(screen.getByText(/you can also unsubscribe from specific types of emails using the unsubscribe links/i)).toBeInTheDocument();
  });

  it('should maintain switch states across re-renders', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences,
    });

    const { rerender } = render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Email Notification Preferences')).toBeInTheDocument();
    });

    // Toggle switches
    const monitoringSwitch = screen.getByRole('checkbox', { name: /monitoring alerts/i });
    const updatesSwitch = screen.getByRole('checkbox', { name: /product updates/i });
    
    fireEvent.click(monitoringSwitch); // Turn on
    fireEvent.click(updatesSwitch); // Turn off

    expect(monitoringSwitch).toBeChecked();
    expect(updatesSwitch).not.toBeChecked();

    // Re-render component
    rerender(<NotificationPreferences />);

    // States should be maintained
    expect(monitoringSwitch).toBeChecked();
    expect(updatesSwitch).not.toBeChecked();
  });
});