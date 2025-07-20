/**
 * Test Setup for Alert24 Migration Tests
 * 
 * Configures Jest environment and sets up database connection testing
 */

// Setup test environment
global.console = {
  ...console,
  // Uncomment to silence logs during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Configure test timeout for database operations
jest.setTimeout(30000);

// Global test helpers
global.testHelpers = {
  // Generate test UUIDs
  generateTestUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // Test data generators
  generateTestService: (organizationId) => ({
    name: `Test Service ${Date.now()}`,
    description: 'Generated test service for migration testing',
    organization_id: organizationId,
    status: 'operational',
    auto_recovery: false
  }),

  generateTestUser: () => ({
    name: `Test User ${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    profile_completed: false,
    profile_completion_percentage: 0
  }),

  generateTestOrganization: () => ({
    name: `Test Org ${Date.now()}`,
    slug: `test-org-${Date.now()}`,
    billing_email: `billing-${Date.now()}@example.com`
  })
};

// Database connection check before running tests
beforeAll(async () => {
  const { SupabaseClient } = require('../lib/db-supabase.js');
  const db = new SupabaseClient();
  
  try {
    const connectionTest = await db.testConnection();
    if (!connectionTest.success) {
      console.error('Database connection failed:', connectionTest.error);
      throw new Error('Database connection required for migration tests');
    }
    console.log('✅ Database connection established for tests');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Add any cleanup logic here
  console.log('🧹 Test cleanup completed');
});