import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import UserProfileForm from '@/components/UserProfileForm';

// Create MUI theme for testing
const theme = createTheme();

// Wrapper component for MUI ThemeProvider
const TestWrapper = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('UserProfileForm', () => {
  const mockInitialData = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    timezone: 'America/New_York',
    notification_preferences: {
      email_incidents: true,
      email_escalations: true,
      sms_critical: false,
      sms_escalations: false,
    },
  };

  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <TestWrapper>
        <UserProfileForm
          initialData={mockInitialData}
          onSave={mockOnSave}
          {...props}
        />
      </TestWrapper>
    );
  };

  describe('Profile Completion Tracking', () => {
    it('should calculate and display profile completion percentage', () => {
      renderComponent();

      // Should show profile completion card
      expect(screen.getByText('Profile Completion')).toBeInTheDocument();
      
      // Should show completion percentage (mockInitialData has all fields filled)
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('should show lower completion percentage for incomplete profile', () => {
      const incompleteData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        // Missing phone, timezone, and notification preferences
      };

      renderComponent({ initialData: incompleteData });

      // Should show lower percentage
      const completionChip = screen.getByText(/\d+%/);
      expect(completionChip).toBeInTheDocument();
      expect(completionChip.textContent).not.toBe('100%');
    });

    it('should show completion message for 100% profile', () => {
      renderComponent();

      expect(screen.getByText('Your profile is complete! 🎉')).toBeInTheDocument();
    });

    it('should show completion prompt for incomplete profile', () => {
      const incompleteData = { name: 'John Doe' };
      renderComponent({ initialData: incompleteData });

      expect(screen.getByText('Complete your profile to unlock all features')).toBeInTheDocument();
    });
  });

  describe('Form Fields and Validation', () => {
    it('should render all form fields with initial data', () => {
      renderComponent();

      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('+1 (555) 123-4567')).toBeInTheDocument();
      
      // Timezone dropdown
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderComponent({ initialData: {} });

      // Click edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Try to save without required fields
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
        expect(screen.getByText('Email is required')).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      renderComponent({ initialData: {} });

      // Click edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Enter invalid email
      const emailField = screen.getByLabelText(/email address/i);
      await user.type(emailField, 'invalid-email');

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('should validate phone number format', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Click edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Enter invalid phone number
      const phoneField = screen.getByLabelText(/phone number/i);
      await user.clear(phoneField);
      await user.type(phoneField, 'invalid-phone');

      // Try to save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
      });
    });
  });

  describe('Phone Number Formatting', () => {
    it('should format US phone numbers', async () => {
      const user = userEvent.setup();
      renderComponent({ initialData: { phone: '' } });

      // Click edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Enter 10-digit number
      const phoneField = screen.getByLabelText(/phone number/i);
      await user.type(phoneField, '5551234567');

      // Should format to (555) 123-4567
      expect(phoneField.value).toBe('(555) 123-4567');
    });

    it('should format 11-digit US phone numbers with country code', async () => {
      const user = userEvent.setup();
      renderComponent({ initialData: { phone: '' } });

      // Click edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Enter 11-digit number
      const phoneField = screen.getByLabelText(/phone number/i);
      await user.type(phoneField, '15551234567');

      // Should format to +1 (555) 123-4567
      expect(phoneField.value).toBe('+1 (555) 123-4567');
    });
  });

  describe('Notification Preferences', () => {
    it('should render all notification preference switches', () => {
      renderComponent();

      expect(screen.getByRole('checkbox', { name: /email - new incidents/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /email - escalations/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /sms - critical incidents/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /sms - escalations/i })).toBeInTheDocument();
    });

    it('should initialize switches with correct values', () => {
      renderComponent();

      const emailIncidents = screen.getByRole('checkbox', { name: /email - new incidents/i });
      const emailEscalations = screen.getByRole('checkbox', { name: /email - escalations/i });
      const smsCritical = screen.getByRole('checkbox', { name: /sms - critical incidents/i });
      const smsEscalations = screen.getByRole('checkbox', { name: /sms - escalations/i });

      expect(emailIncidents).toBeChecked();
      expect(emailEscalations).toBeChecked();
      expect(smsCritical).not.toBeChecked();
      expect(smsEscalations).not.toBeChecked();
    });

    it('should disable SMS options when no phone number is provided', async () => {
      const user = userEvent.setup();
      const dataWithoutPhone = { ...mockInitialData, phone: '' };
      renderComponent({ initialData: dataWithoutPhone });

      // Click edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      const smsCritical = screen.getByRole('checkbox', { name: /sms - critical incidents/i });
      const smsEscalations = screen.getByRole('checkbox', { name: /sms - escalations/i });

      expect(smsCritical).toBeDisabled();
      expect(smsEscalations).toBeDisabled();

      // Should show helper text
      expect(screen.getAllByText('Add phone number to enable SMS notifications')).toHaveLength(2);
    });

    it('should enable SMS options when phone number is provided', async () => {
      const user = userEvent.setup();
      const dataWithoutPhone = { ...mockInitialData, phone: '' };
      renderComponent({ initialData: dataWithoutPhone });

      // Click edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Add phone number
      const phoneField = screen.getByLabelText(/phone number/i);
      await user.type(phoneField, '5551234567');

      // SMS options should now be enabled
      const smsCritical = screen.getByRole('checkbox', { name: /sms - critical incidents/i });
      const smsEscalations = screen.getByRole('checkbox', { name: /sms - escalations/i });

      expect(smsCritical).not.toBeDisabled();
      expect(smsEscalations).not.toBeDisabled();
    });

    it('should toggle notification preferences', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Click edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Toggle email incidents (currently on)
      const emailIncidents = screen.getByRole('checkbox', { name: /email - new incidents/i });
      await user.click(emailIncidents);

      expect(emailIncidents).not.toBeChecked();
    });
  });

  describe('Edit Mode and Save Functionality', () => {
    it('should start in read-only mode', () => {
      renderComponent();

      const nameField = screen.getByDisplayValue('John Doe');
      expect(nameField).toBeDisabled();

      expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
    });

    it('should enter edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderComponent();

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      const nameField = screen.getByDisplayValue('John Doe');
      expect(nameField).not.toBeDisabled();

      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    });

    it('should call onSave with form data when save button is clicked', async () => {
      const user = userEvent.setup();
      mockOnSave.mockResolvedValue();
      renderComponent();

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Modify a field
      const nameField = screen.getByDisplayValue('John Doe');
      await user.clear(nameField);
      await user.type(nameField, 'Jane Doe');

      // Save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Jane Doe',
            email: 'john.doe@example.com',
            phone: '+1 (555) 123-4567',
            timezone: 'America/New_York',
            notification_preferences: mockInitialData.notification_preferences,
          })
        );
      });
    });

    it('should show loading state while saving', async () => {
      const user = userEvent.setup();
      // Mock onSave to never resolve
      mockOnSave.mockImplementation(() => new Promise(() => {}));
      renderComponent();

      // Enter edit mode and save
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Should show loading spinner
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
    });

    it('should exit edit mode after successful save', async () => {
      const user = userEvent.setup();
      mockOnSave.mockResolvedValue();
      renderComponent();

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /edit profile/i })).toBeInTheDocument();
      });
    });

    it('should handle save errors gracefully', async () => {
      const user = userEvent.setup();
      mockOnSave.mockRejectedValue(new Error('Save failed'));
      
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      renderComponent();

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Should stay in edit mode
        expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('ReadOnly Mode', () => {
    it('should render in read-only mode when readOnly prop is true', () => {
      renderComponent({ readOnly: true });

      const nameField = screen.getByDisplayValue('John Doe');
      expect(nameField).toBeDisabled();

      // Should not show edit button in read-only mode
      expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
    });
  });

  describe('Timezone Selection', () => {
    it('should render timezone dropdown with options', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Open timezone dropdown
      const timezoneSelect = screen.getByRole('combobox');
      await user.click(timezoneSelect);

      // Should show timezone options
      await waitFor(() => {
        expect(screen.getByText('Eastern Time (ET)')).toBeInTheDocument();
        expect(screen.getByText('Pacific Time (PT)')).toBeInTheDocument();
        expect(screen.getByText('UTC')).toBeInTheDocument();
      });
    });

    it('should update timezone selection', async () => {
      const user = userEvent.setup();
      renderComponent();

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Open timezone dropdown and select new option
      const timezoneSelect = screen.getByRole('combobox');
      await user.click(timezoneSelect);

      const pacificOption = screen.getByText('Pacific Time (PT)');
      await user.click(pacificOption);

      // Should update the selected value
      expect(timezoneSelect).toHaveTextContent('Pacific Time (PT)');
    });
  });

  describe('Loading States', () => {
    it('should disable form when loading prop is true', () => {
      renderComponent({ loading: true });

      const nameField = screen.getByDisplayValue('John Doe');
      expect(nameField).toBeDisabled();

      const editButton = screen.getByRole('button', { name: /edit profile/i });
      expect(editButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderComponent();

      // Check for required field indicators
      expect(screen.getByLabelText(/full name/i)).toHaveAttribute('required');
      expect(screen.getByLabelText(/email address/i)).toHaveAttribute('required');

      // Check for proper form structure
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    });

    it('should announce validation errors to screen readers', async () => {
      const user = userEvent.setup();
      renderComponent({ initialData: {} });

      // Enter edit mode
      const editButton = screen.getByRole('button', { name: /edit profile/i });
      await user.click(editButton);

      // Try to save without required fields
      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        const nameField = screen.getByLabelText(/full name/i);
        expect(nameField).toHaveAttribute('aria-invalid', 'true');
      });
    });
  });
});