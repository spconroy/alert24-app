// Test utility functions for profile validation and formatting
// These functions are extracted from UserProfileForm for testing purposes

describe('Profile Utility Functions', () => {
  // Phone number validation function (extracted from UserProfileForm)
  const validatePhone = (phone) => {
    if (!phone) return true; // Phone is optional
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  };

  // Phone number formatting function (extracted from UserProfileForm)
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    
    // Remove all non-digits except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Basic US phone number formatting
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '+$1 ($2) $3-$4');
    }
    
    return phone; // Return as-is if doesn't match expected formats
  };

  // Profile completion calculation function (extracted from UserProfileForm)
  const calculateProfileCompletion = (formData) => {
    const fields = [
      { key: 'name', weight: 25 },
      { key: 'email', weight: 25 },
      { key: 'phone', weight: 20 },
      { key: 'timezone', weight: 15 },
      { key: 'notification_preferences', weight: 15 },
    ];

    let totalScore = 0;
    let maxScore = 0;

    fields.forEach(field => {
      maxScore += field.weight;
      
      if (field.key === 'notification_preferences') {
        // Check if at least one notification preference is set
        const prefs = formData.notification_preferences || {};
        const hasAnyPref = Object.values(prefs).some(Boolean);
        if (hasAnyPref) totalScore += field.weight;
      } else if (formData[field.key] && formData[field.key].toString().trim()) {
        totalScore += field.weight;
      }
    });

    return Math.round((totalScore / maxScore) * 100);
  };

  // Email validation function
  const validateEmail = (email) => {
    if (!email || !email.trim()) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  describe('Phone Number Validation', () => {
    it('should return true for empty phone number (optional field)', () => {
      expect(validatePhone('')).toBe(true);
      expect(validatePhone(null)).toBe(true);
      expect(validatePhone(undefined)).toBe(true);
    });

    it('should validate US phone numbers without country code', () => {
      expect(validatePhone('5551234567')).toBe(true);
      expect(validatePhone('555-123-4567')).toBe(true);
      expect(validatePhone('(555) 123-4567')).toBe(true);
      expect(validatePhone('555 123 4567')).toBe(true);
    });

    it('should validate US phone numbers with country code', () => {
      expect(validatePhone('+15551234567')).toBe(true);
      expect(validatePhone('15551234567')).toBe(true);
      expect(validatePhone('+1 555 123 4567')).toBe(true);
      expect(validatePhone('+1-555-123-4567')).toBe(true);
    });

    it('should validate international phone numbers', () => {
      expect(validatePhone('+441234567890')).toBe(true);
      expect(validatePhone('+33123456789')).toBe(true);
      expect(validatePhone('+8613812345678')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('123')).toBe(false); // Too short
      expect(validatePhone('abc123')).toBe(false); // Contains letters
      expect(validatePhone('0555123456')).toBe(false); // Starts with 0
      expect(validatePhone('555-123')).toBe(false); // Incomplete
      expect(validatePhone('555-123-45678')).toBe(false); // Too many digits for US
      expect(validatePhone('++15551234567')).toBe(false); // Multiple + signs
    });

    it('should handle phone numbers with various formatting', () => {
      expect(validatePhone('555.123.4567')).toBe(true);
      expect(validatePhone('555/123/4567')).toBe(true);
      expect(validatePhone('555_123_4567')).toBe(true);
      expect(validatePhone('5 5 5 1 2 3 4 5 6 7')).toBe(true);
    });
  });

  describe('Phone Number Formatting', () => {
    it('should return empty string for empty input', () => {
      expect(formatPhoneNumber('')).toBe('');
      expect(formatPhoneNumber(null)).toBe('');
      expect(formatPhoneNumber(undefined)).toBe('');
    });

    it('should format 10-digit US phone numbers', () => {
      expect(formatPhoneNumber('5551234567')).toBe('(555) 123-4567');
      expect(formatPhoneNumber('555-123-4567')).toBe('(555) 123-4567');
      expect(formatPhoneNumber('555.123.4567')).toBe('(555) 123-4567');
      expect(formatPhoneNumber('555 123 4567')).toBe('(555) 123-4567');
    });

    it('should format 11-digit US phone numbers with country code', () => {
      expect(formatPhoneNumber('15551234567')).toBe('+1 (555) 123-4567');
      expect(formatPhoneNumber('1-555-123-4567')).toBe('+1 (555) 123-4567');
      expect(formatPhoneNumber('1 555 123 4567')).toBe('+1 (555) 123-4567');
    });

    it('should not format numbers that don\'t match expected patterns', () => {
      expect(formatPhoneNumber('123')).toBe('123');
      expect(formatPhoneNumber('12345')).toBe('12345');
      expect(formatPhoneNumber('+441234567890')).toBe('+441234567890');
      expect(formatPhoneNumber('25551234567')).toBe('25551234567'); // Doesn't start with 1
    });

    it('should handle numbers with existing formatting', () => {
      expect(formatPhoneNumber('(555) 123-4567')).toBe('(555) 123-4567');
      expect(formatPhoneNumber('+1 (555) 123-4567')).toBe('+1 (555) 123-4567');
    });

    it('should remove non-digit characters except leading +', () => {
      expect(formatPhoneNumber('5a5b5c1d2e3f4g5h6i7j')).toBe('(555) 123-4567');
      expect(formatPhoneNumber('+++15551234567')).toBe('+1 (555) 123-4567');
      expect(formatPhoneNumber('555-123-4567 ext 123')).toBe('(555) 123-4567');
    });
  });

  describe('Profile Completion Calculation', () => {
    it('should return 100% for complete profile', () => {
      const completeProfile = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        timezone: 'America/New_York',
        notification_preferences: {
          email_incidents: true,
          email_escalations: false,
        },
      };

      expect(calculateProfileCompletion(completeProfile)).toBe(100);
    });

    it('should return 0% for empty profile', () => {
      const emptyProfile = {};
      expect(calculateProfileCompletion(emptyProfile)).toBe(0);
    });

    it('should calculate partial completion correctly', () => {
      const partialProfile = {
        name: 'John Doe', // 25%
        email: 'john.doe@example.com', // 25%
        // Missing phone (20%), timezone (15%), notification_preferences (15%)
      };

      expect(calculateProfileCompletion(partialProfile)).toBe(50);
    });

    it('should handle notification preferences correctly', () => {
      const profileWithNotifications = {
        name: 'John Doe', // 25%
        notification_preferences: {
          email_incidents: true, // 15%
        },
        // Missing email (25%), phone (20%), timezone (15%)
      };

      expect(calculateProfileCompletion(profileWithNotifications)).toBe(40);
    });

    it('should not count notification preferences if all are false/empty', () => {
      const profileWithEmptyNotifications = {
        name: 'John Doe', // 25%
        notification_preferences: {
          email_incidents: false,
          email_escalations: false,
          sms_critical: false,
          sms_escalations: false,
        },
        // Missing email (25%), phone (20%), timezone (15%), and notification_preferences (15%)
      };

      expect(calculateProfileCompletion(profileWithEmptyNotifications)).toBe(25);
    });

    it('should handle whitespace-only fields as empty', () => {
      const profileWithWhitespace = {
        name: '   ', // Should not count
        email: 'john.doe@example.com', // 25%
        phone: '  \t  ', // Should not count
        timezone: 'America/New_York', // 15%
      };

      expect(calculateProfileCompletion(profileWithWhitespace)).toBe(40);
    });

    it('should handle missing notification_preferences object', () => {
      const profileWithoutNotificationPrefs = {
        name: 'John Doe', // 25%
        email: 'john.doe@example.com', // 25%
        phone: '+1234567890', // 20%
        timezone: 'America/New_York', // 15%
        // Missing notification_preferences (15%)
      };

      expect(calculateProfileCompletion(profileWithoutNotificationPrefs)).toBe(85);
    });

    it('should round percentages correctly', () => {
      // Test edge case that might result in decimal
      const profile = {
        name: 'John Doe', // 25%
        email: 'john.doe@example.com', // 25%
        phone: '+1234567890', // 20%
        // Missing timezone (15%) and notification_preferences (15%)
        // Should be 70%
      };

      const result = calculateProfileCompletion(profile);
      expect(result).toBe(70);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('Email Validation', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.email@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.org')).toBe(true);
      expect(validateEmail('user123@test-domain.com')).toBe(true);
      expect(validateEmail('a@b.co')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('   ')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user.domain.com')).toBe(false);
      expect(validateEmail('user@domain')).toBe(false);
      expect(validateEmail('user@.com')).toBe(false);
      expect(validateEmail('user@domain.')).toBe(false);
      expect(validateEmail('user name@domain.com')).toBe(false);
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateEmail('user@domain.c')).toBe(true); // Single char TLD
      expect(validateEmail('user@domain..com')).toBe(false); // Double dots
      expect(validateEmail('user@@domain.com')).toBe(false); // Double @
      expect(validateEmail('.user@domain.com')).toBe(false); // Leading dot
      expect(validateEmail('user.@domain.com')).toBe(false); // Trailing dot before @
    });
  });

  describe('Integration Tests', () => {
    it('should work together for form validation workflow', () => {
      const formData = {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '5551234567',
        timezone: 'America/New_York',
        notification_preferences: {
          email_incidents: true,
        },
      };

      // Validate email
      expect(validateEmail(formData.email)).toBe(true);

      // Format phone
      const formattedPhone = formatPhoneNumber(formData.phone);
      expect(formattedPhone).toBe('(555) 123-4567');

      // Validate formatted phone
      expect(validatePhone(formattedPhone)).toBe(true);

      // Calculate completion
      const completion = calculateProfileCompletion({
        ...formData,
        phone: formattedPhone,
      });
      expect(completion).toBe(100);
    });

    it('should handle invalid data gracefully in workflow', () => {
      const invalidFormData = {
        name: '',
        email: 'invalid-email',
        phone: 'abc123',
        timezone: '',
        notification_preferences: {},
      };

      // Should fail validations
      expect(validateEmail(invalidFormData.email)).toBe(false);
      expect(validatePhone(invalidFormData.phone)).toBe(false);

      // Phone formatting should return original invalid input
      expect(formatPhoneNumber(invalidFormData.phone)).toBe('abc123');

      // Completion should be very low
      const completion = calculateProfileCompletion(invalidFormData);
      expect(completion).toBe(0);
    });

    it('should calculate completion for partially valid data', () => {
      const partialData = {
        name: 'John Doe', // Valid - 25%
        email: 'invalid-email', // Invalid but present
        phone: '5551234567', // Valid - 20%
        timezone: '', // Empty
        notification_preferences: {
          email_incidents: true, // Valid - 15%
        },
      };

      // Email validation fails but completion still counts presence
      expect(validateEmail(partialData.email)).toBe(false);
      expect(validatePhone(partialData.phone)).toBe(true);

      // Completion counts filled fields regardless of validity in this context
      // (Form validation would catch invalid data separately)
      const completion = calculateProfileCompletion(partialData);
      expect(completion).toBe(85); // name + email + phone + notifications (missing timezone)
    });
  });
});