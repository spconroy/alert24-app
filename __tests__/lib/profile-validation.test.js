// Tests for profile validation helpers that could be extracted into a separate utility file

describe('Profile Validation Helpers', () => {
  // Validation error messages
  const ERROR_MESSAGES = {
    NAME_REQUIRED: 'Name is required',
    EMAIL_REQUIRED: 'Email is required',
    EMAIL_INVALID: 'Please enter a valid email address',
    PHONE_INVALID: 'Please enter a valid phone number',
  };

  // Form validation function that could be extracted from UserProfileForm
  const validateProfileForm = (formData) => {
    const errors = {};

    // Name validation
    if (!formData.name || !formData.name.trim()) {
      errors.name = ERROR_MESSAGES.NAME_REQUIRED;
    }

    // Email validation
    if (!formData.email || !formData.email.trim()) {
      errors.email = ERROR_MESSAGES.EMAIL_REQUIRED;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = ERROR_MESSAGES.EMAIL_INVALID;
    }

    // Phone validation (optional field)
    if (formData.phone && formData.phone.trim()) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      const cleanPhone = formData.phone.replace(/[\s\-\(\)]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        errors.phone = ERROR_MESSAGES.PHONE_INVALID;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  };

  // Timezone validation helper
  const validateTimezone = (timezone) => {
    const validTimezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'UTC',
      'Europe/London',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
    ];

    return validTimezones.includes(timezone);
  };

  // Notification preferences validation
  const validateNotificationPreferences = (preferences) => {
    if (!preferences || typeof preferences !== 'object') {
      return false;
    }

    const validKeys = [
      'email_incidents',
      'email_escalations',
      'sms_critical',
      'sms_escalations',
    ];

    // Check if all keys are valid and values are booleans
    return Object.entries(preferences).every(([key, value]) => {
      return validKeys.includes(key) && typeof value === 'boolean';
    });
  };

  // Data sanitization helper
  const sanitizeProfileData = (formData) => {
    const sanitized = { ...formData };

    // Trim string fields
    if (sanitized.name) sanitized.name = sanitized.name.trim();
    if (sanitized.email) sanitized.email = sanitized.email.trim().toLowerCase();
    if (sanitized.phone) sanitized.phone = sanitized.phone.trim();

    // Ensure notification preferences is an object
    if (!sanitized.notification_preferences || typeof sanitized.notification_preferences !== 'object') {
      sanitized.notification_preferences = {
        email_incidents: true,
        email_escalations: true,
        sms_critical: false,
        sms_escalations: false,
      };
    }

    return sanitized;
  };

  describe('Form Validation', () => {
    it('should validate a complete and correct form', () => {
      const validForm = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1 (555) 123-4567',
        timezone: 'America/New_York',
        notification_preferences: {
          email_incidents: true,
          email_escalations: false,
          sms_critical: false,
          sms_escalations: false,
        },
      };

      const result = validateProfileForm(validForm);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should require name field', () => {
      const formWithoutName = {
        email: 'john.doe@example.com',
        phone: '+1234567890',
      };

      const result = validateProfileForm(formWithoutName);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe(ERROR_MESSAGES.NAME_REQUIRED);
    });

    it('should reject whitespace-only name', () => {
      const formWithWhitespaceName = {
        name: '   \t\n   ',
        email: 'john.doe@example.com',
      };

      const result = validateProfileForm(formWithWhitespaceName);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe(ERROR_MESSAGES.NAME_REQUIRED);
    });

    it('should require email field', () => {
      const formWithoutEmail = {
        name: 'John Doe',
        phone: '+1234567890',
      };

      const result = validateProfileForm(formWithoutEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe(ERROR_MESSAGES.EMAIL_REQUIRED);
    });

    it('should validate email format', () => {
      const formWithInvalidEmail = {
        name: 'John Doe',
        email: 'invalid-email',
      };

      const result = validateProfileForm(formWithInvalidEmail);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBe(ERROR_MESSAGES.EMAIL_INVALID);
    });

    it('should validate phone number when provided', () => {
      const formWithInvalidPhone = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: 'invalid-phone',
      };

      const result = validateProfileForm(formWithInvalidPhone);
      expect(result.isValid).toBe(false);
      expect(result.errors.phone).toBe(ERROR_MESSAGES.PHONE_INVALID);
    });

    it('should allow empty phone number (optional field)', () => {
      const formWithoutPhone = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '',
      };

      const result = validateProfileForm(formWithoutPhone);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it('should handle multiple validation errors', () => {
      const invalidForm = {
        name: '',
        email: 'invalid-email',
        phone: 'abc123',
      };

      const result = validateProfileForm(invalidForm);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe(ERROR_MESSAGES.NAME_REQUIRED);
      expect(result.errors.email).toBe(ERROR_MESSAGES.EMAIL_INVALID);
      expect(result.errors.phone).toBe(ERROR_MESSAGES.PHONE_INVALID);
    });
  });

  describe('Timezone Validation', () => {
    it('should validate supported timezones', () => {
      expect(validateTimezone('America/New_York')).toBe(true);
      expect(validateTimezone('America/Los_Angeles')).toBe(true);
      expect(validateTimezone('UTC')).toBe(true);
      expect(validateTimezone('Europe/London')).toBe(true);
      expect(validateTimezone('Asia/Tokyo')).toBe(true);
    });

    it('should reject unsupported timezones', () => {
      expect(validateTimezone('Invalid/Timezone')).toBe(false);
      expect(validateTimezone('America/NonExistent')).toBe(false);
      expect(validateTimezone('')).toBe(false);
      expect(validateTimezone(null)).toBe(false);
      expect(validateTimezone(undefined)).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(validateTimezone('america/new_york')).toBe(false);
      expect(validateTimezone('AMERICA/NEW_YORK')).toBe(false);
      expect(validateTimezone('utc')).toBe(false);
    });
  });

  describe('Notification Preferences Validation', () => {
    it('should validate correct notification preferences', () => {
      const validPreferences = {
        email_incidents: true,
        email_escalations: false,
        sms_critical: true,
        sms_escalations: false,
      };

      expect(validateNotificationPreferences(validPreferences)).toBe(true);
    });

    it('should validate partial notification preferences', () => {
      const partialPreferences = {
        email_incidents: true,
        sms_critical: false,
      };

      expect(validateNotificationPreferences(partialPreferences)).toBe(true);
    });

    it('should reject invalid notification preferences', () => {
      expect(validateNotificationPreferences(null)).toBe(false);
      expect(validateNotificationPreferences(undefined)).toBe(false);
      expect(validateNotificationPreferences('not-an-object')).toBe(false);
      expect(validateNotificationPreferences([])).toBe(false);
    });

    it('should reject invalid preference keys', () => {
      const invalidKeys = {
        invalid_key: true,
        email_incidents: true,
      };

      expect(validateNotificationPreferences(invalidKeys)).toBe(false);
    });

    it('should reject non-boolean preference values', () => {
      const invalidValues = {
        email_incidents: 'true',
        email_escalations: 1,
        sms_critical: null,
      };

      expect(validateNotificationPreferences(invalidValues)).toBe(false);
    });

    it('should handle empty preferences object', () => {
      expect(validateNotificationPreferences({})).toBe(true);
    });
  });

  describe('Data Sanitization', () => {
    it('should sanitize string fields by trimming whitespace', () => {
      const dirtyData = {
        name: '  John Doe  ',
        email: '  JOHN.DOE@EXAMPLE.COM  ',
        phone: '  +1234567890  ',
      };

      const sanitized = sanitizeProfileData(dirtyData);
      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.email).toBe('john.doe@example.com');
      expect(sanitized.phone).toBe('+1234567890');
    });

    it('should convert email to lowercase', () => {
      const data = {
        email: 'JOHN.DOE@EXAMPLE.COM',
      };

      const sanitized = sanitizeProfileData(data);
      expect(sanitized.email).toBe('john.doe@example.com');
    });

    it('should provide default notification preferences if missing', () => {
      const dataWithoutPrefs = {
        name: 'John Doe',
        email: 'john.doe@example.com',
      };

      const sanitized = sanitizeProfileData(dataWithoutPrefs);
      expect(sanitized.notification_preferences).toEqual({
        email_incidents: true,
        email_escalations: true,
        sms_critical: false,
        sms_escalations: false,
      });
    });

    it('should provide default notification preferences if invalid', () => {
      const dataWithInvalidPrefs = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        notification_preferences: 'invalid',
      };

      const sanitized = sanitizeProfileData(dataWithInvalidPrefs);
      expect(sanitized.notification_preferences).toEqual({
        email_incidents: true,
        email_escalations: true,
        sms_critical: false,
        sms_escalations: false,
      });
    });

    it('should preserve valid notification preferences', () => {
      const validPrefs = {
        email_incidents: false,
        email_escalations: true,
        sms_critical: true,
        sms_escalations: false,
      };

      const data = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        notification_preferences: validPrefs,
      };

      const sanitized = sanitizeProfileData(data);
      expect(sanitized.notification_preferences).toEqual(validPrefs);
    });

    it('should not modify the original data object', () => {
      const originalData = {
        name: '  John Doe  ',
        email: '  JOHN.DOE@EXAMPLE.COM  ',
      };

      const sanitized = sanitizeProfileData(originalData);
      
      // Original should be unchanged
      expect(originalData.name).toBe('  John Doe  ');
      expect(originalData.email).toBe('  JOHN.DOE@EXAMPLE.COM  ');
      
      // Sanitized should be clean
      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.email).toBe('john.doe@example.com');
    });
  });

  describe('Integration with Real-World Scenarios', () => {
    it('should handle a complete user registration flow', () => {
      const userInput = {
        name: '  Jane Smith  ',
        email: '  JANE.SMITH@COMPANY.COM  ',
        phone: '555-123-4567',
        timezone: 'America/Los_Angeles',
        notification_preferences: {
          email_incidents: true,
          email_escalations: true,
          sms_critical: false,
          sms_escalations: false,
        },
      };

      // Sanitize first
      const sanitized = sanitizeProfileData(userInput);
      
      // Then validate
      const validation = validateProfileForm(sanitized);
      
      expect(validation.isValid).toBe(true);
      expect(sanitized.name).toBe('Jane Smith');
      expect(sanitized.email).toBe('jane.smith@company.com');
      expect(sanitized.phone).toBe('555-123-4567');
      expect(validateTimezone(sanitized.timezone)).toBe(true);
      expect(validateNotificationPreferences(sanitized.notification_preferences)).toBe(true);
    });

    it('should handle partial profile updates', () => {
      const partialUpdate = {
        name: 'Updated Name',
        // Only updating name, keeping other fields as-is
      };

      const sanitized = sanitizeProfileData(partialUpdate);
      const validation = validateProfileForm(sanitized);

      // Should fail validation because email is required
      expect(validation.isValid).toBe(false);
      expect(validation.errors.email).toBe(ERROR_MESSAGES.EMAIL_REQUIRED);
    });

    it('should handle edge cases and malformed data', () => {
      const malformedData = {
        name: null,
        email: '',
        phone: '   ',
        timezone: 123,
        notification_preferences: [],
      };

      const sanitized = sanitizeProfileData(malformedData);
      const validation = validateProfileForm(sanitized);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.name).toBe(ERROR_MESSAGES.NAME_REQUIRED);
      expect(validation.errors.email).toBe(ERROR_MESSAGES.EMAIL_REQUIRED);
      
      // Should provide default notification preferences
      expect(sanitized.notification_preferences).toEqual({
        email_incidents: true,
        email_escalations: true,
        sms_critical: false,
        sms_escalations: false,
      });
    });
  });
});