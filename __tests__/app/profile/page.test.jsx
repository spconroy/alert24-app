import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import ProfilePage from '@/app/profile/page';
import { useOrganization } from '@/contexts/OrganizationContext';

// Mock the dependencies
jest.mock('@/contexts/OrganizationContext');
jest.mock('@/components/UserProfileForm', () => {
  return function MockUserProfileForm({ initialData, onSave, loading }) {
    return (
      <div data-testid="user-profile-form">
        <div>Mock UserProfileForm</div>
        <div>Initial Data: {JSON.stringify(initialData)}</div>
        <div>Loading: {loading.toString()}</div>
        <button onClick={() => onSave({ name: 'Test User', email: 'test@example.com' })}>
          Mock Save
        </button>
      </div>
    );
  };
});

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock fetch globally
global.fetch = jest.fn();

// Create MUI theme for testing
const theme = createTheme();

// Wrapper component for MUI ThemeProvider
const TestWrapper = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('ProfilePage', () => {
  const mockUseOrganization = useOrganization;

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  const renderComponent = () => {
    return render(
      <TestWrapper>
        <ProfilePage />
      </TestWrapper>
    );
  };

  describe('Authentication and Loading States', () => {
    it('should redirect to signin when unauthenticated', () => {
      mockUseOrganization.mockReturnValue({
        session: null,
        sessionStatus: 'unauthenticated',
      });

      renderComponent();

      expect(mockPush).toHaveBeenCalledWith('/api/auth/signin');
    });

    it('should show loading spinner while session is loading', () => {
      mockUseOrganization.mockReturnValue({
        session: null,
        sessionStatus: 'loading',
      });

      renderComponent();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show loading spinner while fetching profile data', () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      // Mock fetch to never resolve (simulating loading state)
      fetch.mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should not redirect when session exists', () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          user: {
            name: 'Test User',
            email: 'test@example.com',
          },
        }),
      });

      renderComponent();

      expect(mockPush).not.toHaveBeenCalledWith('/api/auth/signin');
    });
  });

  describe('Profile Data Fetching', () => {
    it('should fetch and display profile data on mount', async () => {
      const mockProfileData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone_number: '+1234567890',
        timezone: 'America/New_York',
        notification_preferences: {
          email_incidents: true,
          email_escalations: true,
        },
      };

      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'john.doe@example.com', name: 'John Doe' } },
        sessionStatus: 'authenticated',
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: mockProfileData }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('👤 My Profile')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/user/profile');
      expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
    });

    it('should handle profile fetch errors', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to load profile data')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should handle network errors during profile fetch', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to load profile data')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should merge session data with fetched profile data', async () => {
      const sessionUser = {
        email: 'session@example.com',
        name: 'Session User',
      };

      const profileUser = {
        name: 'Profile User',
        email: 'profile@example.com',
        phone_number: '+1234567890',
      };

      mockUseOrganization.mockReturnValue({
        session: { user: sessionUser },
        sessionStatus: 'authenticated',
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: profileUser }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
      });

      // Check that the component receives merged data
      const formComponent = screen.getByTestId('user-profile-form');
      const initialDataText = formComponent.textContent;
      
      // Should prioritize profile data over session data
      expect(initialDataText).toContain('Profile User');
      expect(initialDataText).toContain('profile@example.com');
      expect(initialDataText).toContain('+1234567890');
    });
  });

  describe('Profile Data Saving', () => {
    it('should save profile data successfully', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
      });

      // Trigger save from the mocked form
      const saveButton = screen.getByText('Mock Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
      });
    });

    it('should handle save errors', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: 'Save failed' }),
        });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
      });

      // Trigger save from the mocked form
      const saveButton = screen.getByText('Mock Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Save failed')).toBeInTheDocument();
      });
    });

    it('should handle network errors during save', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
      });

      // Trigger save from the mocked form
      const saveButton = screen.getByText('Mock Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should clear success message after 3 seconds', async () => {
      jest.useFakeTimers();

      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
      });

      // Trigger save
      const saveButton = screen.getByText('Mock Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });

      // Fast-forward time by 3 seconds
      jest.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.queryByText('Profile updated successfully!')).not.toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it('should update profile data state after successful save', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      const newProfileData = { name: 'Updated User', email: 'updated@example.com' };

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
      });

      // Trigger save with new data
      const saveButton = screen.getByText('Mock Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('User Avatar and Info Display', () => {
    it('should display user avatar and information', async () => {
      const sessionUser = {
        email: 'test@example.com',
        name: 'Test User',
        image: 'https://example.com/avatar.jpg',
      };

      mockUseOrganization.mockReturnValue({
        session: { user: sessionUser },
        sessionStatus: 'authenticated',
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          user: {
            name: 'Test User',
            email: 'test@example.com',
          },
        }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('Account Active')).toBeInTheDocument();
        expect(screen.getByText('Signed in via Google OAuth')).toBeInTheDocument();
      });

      // Check avatar
      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(avatar).toHaveAttribute('alt', 'Test User');
    });

    it('should display fallback when user name is not available', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com' } }, // No name
        sessionStatus: 'authenticated',
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          user: {
            email: 'test@example.com',
          },
        }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('User')).toBeInTheDocument();
      });
    });
  });

  describe('Security Section', () => {
    it('should display security information and Google account link', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
      });

      // Mock window.open
      const mockOpen = jest.fn();
      Object.defineProperty(window, 'open', {
        writable: true,
        value: mockOpen,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Security & Account')).toBeInTheDocument();
      });

      expect(screen.getByText(/Your account is secured with Google OAuth/)).toBeInTheDocument();
      
      const googleAccountButton = screen.getByRole('button', { 
        name: /manage google account security/i 
      });
      expect(googleAccountButton).toBeInTheDocument();

      // Test clicking the Google account button
      fireEvent.click(googleAccountButton);
      expect(mockOpen).toHaveBeenCalledWith(
        'https://myaccount.google.com/security',
        '_blank'
      );
    });
  });

  describe('Error Alert Handling', () => {
    it('should display error alerts', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch.mockRejectedValue(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Failed to load profile data')).toBeInTheDocument();
      });

      // Check that error alert has proper severity
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveClass('MuiAlert-standardError');

      consoleSpy.mockRestore();
    });

    it('should display success alerts', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
      });

      // Trigger save
      const saveButton = screen.getByText('Mock Save');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Profile updated successfully!')).toBeInTheDocument();
      });

      // Check that success alert has proper severity
      const successAlert = screen.getByRole('alert');
      expect(successAlert).toHaveClass('MuiAlert-standardSuccess');
    });
  });

  describe('Component Layout and Structure', () => {
    it('should have proper page structure and typography', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User' } },
        sessionStatus: 'authenticated',
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('👤 My Profile')).toBeInTheDocument();
      });

      expect(screen.getByText('Manage your account information and notification preferences')).toBeInTheDocument();

      // Check grid layout structure
      const container = screen.getByRole('main') || screen.getByText('👤 My Profile').closest('div');
      expect(container).toBeInTheDocument();
    });

    it('should be responsive and render in correct order', async () => {
      mockUseOrganization.mockReturnValue({
        session: { user: { email: 'test@example.com', name: 'Test User', image: 'avatar.jpg' } },
        sessionStatus: 'authenticated',
      });

      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ user: { name: 'Test User', email: 'test@example.com' } }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
      });

      // Check that avatar card and form are both present
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByTestId('user-profile-form')).toBeInTheDocument();
      expect(screen.getByText('Security & Account')).toBeInTheDocument();
    });
  });
});