# Test Suite for Email Notification System

This directory contains comprehensive unit tests for the advanced email notification system implemented in Alert24.

## Test Structure

```
__tests__/
├── lib/
│   └── email-service.test.js      # EmailService class tests
├── api/
│   └── notifications/
│       ├── route.test.js          # Notifications API tests
│       ├── preferences.test.js    # Preferences API tests
│       ├── stats.test.js          # Analytics API tests
│       └── unsubscribe.test.js    # Unsubscribe API tests
├── components/
│   ├── NotificationPreferences.test.jsx  # Preferences component tests
│   └── NotificationAnalytics.test.jsx    # Analytics component tests
├── utils/
│   └── test-utils.js              # Testing utilities and helpers
└── README.md                      # This file
```

## Running Tests

### Install Dependencies

First, install the testing dependencies:

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run Specific Test Files

```bash
# Run EmailService tests only
npm test email-service

# Run API tests only
npm test api/notifications

# Run component tests only
npm test components
```

## Test Coverage

The test suite covers the following areas:

### 📧 EmailService Class (`lib/email-service.test.js`)

- **Constructor & Configuration**: Tests service initialization with/without API keys
- **SendGrid Status Checking**: API validation and error handling
- **Email Sending**: Core email functionality with retry logic
- **Delivery Tracking**: Email delivery record creation and tracking
- **Batching & Throttling**: Queue management and bulk sending
- **Template Methods**: Invitation, incident, and monitoring email templates
- **Error Handling**: Network errors, API errors, and rate limiting

**Key Test Scenarios:**
- ✅ Service initialization with valid/invalid API keys
- ✅ Successful email sending with tracking
- ✅ Retry logic with exponential backoff
- ✅ Error handling for different HTTP status codes
- ✅ Queue management and priority sorting
- ✅ Batch processing with throttling
- ✅ Template generation for different email types

### 🔗 API Endpoints (`api/notifications/`)

#### Main Notifications API (`route.test.js`)
- **GET**: Fetching notification history with pagination and filtering
- **POST**: Sending bulk notifications with proper authorization
- **Error Handling**: Authentication, authorization, and database errors

#### Preferences API (`preferences.test.js`)
- **GET**: Retrieving user preferences with default creation
- **PUT**: Updating preferences with validation
- **Error Handling**: Invalid data, authentication, and database errors

#### Analytics API (`stats.test.js`)
- **Statistics Calculation**: Delivery rates, retry stats, type/priority breakdowns
- **Time Range Filtering**: Different time periods (1h, 24h, 7d, 30d)
- **Data Aggregation**: Grouping by type, priority, and hourly breakdowns
- **Error Handling**: Database errors and edge cases

#### Unsubscribe API (`unsubscribe.test.js`)
- **GET**: Unsubscribe form generation with preference loading
- **POST**: Preference updates from form submissions
- **HTML Response Testing**: Form rendering and error pages
- **Error Handling**: Invalid tokens, missing users, database errors

### ⚛️ React Components (`components/`)

#### NotificationPreferences (`NotificationPreferences.test.jsx`)
- **Data Loading**: API calls and loading states
- **User Interactions**: Switch toggling and form submissions
- **Error Handling**: Network errors and API failures
- **State Management**: Local state updates and persistence

#### NotificationAnalytics (`NotificationAnalytics.test.jsx`)
- **Data Visualization**: Statistics display and formatting
- **Time Range Selection**: Dynamic data fetching
- **Organization Context**: Multi-tenant data handling
- **Error States**: API failures and empty data scenarios

## Test Utilities

### `test-utils.js`

Provides reusable utilities for testing:

- **`renderWithProviders()`**: Renders components with necessary context providers
- **`mockApiResponses`**: Predefined mock API responses for common scenarios
- **`createMockRequest()`**: Helper for creating mock HTTP requests
- **`createMockSupabaseQuery()`**: Mock Supabase query builder
- **Test Data Factories**: Functions to create test users, organizations, notifications, etc.

### Example Usage

```javascript
import { renderWithProviders, mockApiResponses, createTestUser } from '../utils/test-utils';

// Render component with mocked organization context
const { getByText } = renderWithProviders(<MyComponent />);

// Use predefined mock responses
fetch.mockResolvedValue(mockApiResponses.preferences.success);

// Create test data
const testUser = createTestUser({ email: 'custom@example.com' });
```

## Mocking Strategy

### External Dependencies

- **Fetch API**: Mocked globally for API calls
- **Supabase**: Mocked with query builder simulation
- **NextAuth**: Mocked authentication states
- **Next.js**: Mocked NextResponse and routing

### Environment Variables

Tests automatically set up required environment variables:
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`

### Crypto API

Provides a polyfill for `crypto.randomUUID()` for Node.js environments.

## Test Data Patterns

### Realistic Test Data

Tests use realistic data that mirrors production scenarios:

```javascript
const mockNotification = {
  id: 'notif-123',
  to_email: 'user@example.com',
  subject: 'Database Connection Issue',
  email_type: 'incident',
  priority: 'critical',
  status: 'sent',
  attempts: 2,
  // ... more fields
};
```

### Edge Cases

Tests cover edge cases such as:
- Empty data sets
- Network failures
- Rate limiting
- Invalid input data
- Authorization failures

## Coverage Goals

The test suite aims for high coverage across:

- **Functionality**: All major features and user flows
- **Error Scenarios**: Network, API, and validation errors
- **Edge Cases**: Empty states, boundary conditions
- **User Interactions**: Form submissions, navigation, state changes

## Best Practices

### Test Organization
- Group related tests in `describe` blocks
- Use descriptive test names that explain the scenario
- Set up common test data in `beforeEach` hooks
- Clean up mocks between tests

### Async Testing
- Use `waitFor` for asynchronous operations
- Test loading states before final states
- Handle promise rejections properly

### Mock Management
- Clear mocks between tests with `jest.clearAllMocks()`
- Use specific mock implementations per test when needed
- Verify mock calls with proper expectations

### Accessibility
- Test component accessibility with proper ARIA labels
- Use semantic queries (`getByRole`, `getByLabelText`)
- Verify screen reader compatibility

## Running in CI/CD

Tests are designed to run reliably in CI/CD environments:

- No external dependencies (all mocked)
- Deterministic results
- Fast execution times
- Clear failure messages

Add to your CI pipeline:

```yaml
- name: Run Tests
  run: npm test -- --coverage --watchAll=false
```

## Debugging Tests

### Common Issues

1. **Async Operations**: Ensure `waitFor` is used for async state changes
2. **Mock Timing**: Check mock setup order and cleanup
3. **Component Context**: Verify required providers are included
4. **API Responses**: Check mock response format matches expectations

### Debug Commands

```bash
# Run single test file
npm test -- email-service.test.js

# Run with verbose output
npm test -- --verbose

# Debug specific test
npm test -- --testNamePattern="should send email successfully"
```

## Contributing

When adding new features to the notification system:

1. **Add corresponding tests** for new functionality
2. **Update existing tests** if changing behavior
3. **Follow naming conventions** for test files and descriptions
4. **Mock external dependencies** appropriately
5. **Test error scenarios** along with happy paths

## Maintenance

### Updating Dependencies

When updating dependencies, ensure:
- Test configuration remains compatible
- Mock implementations still work
- No breaking changes in testing utilities

### Performance

Tests should complete in under 30 seconds total. If tests become slow:
- Check for unnecessary async waits
- Optimize mock implementations
- Reduce test data size where possible