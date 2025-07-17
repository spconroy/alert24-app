import postgres from 'postgres';

// Initialize postgres connection with Edge Runtime-compatible settings
const sql = postgres(process.env.DATABASE_URL, {
  // Enable WebSocket for Edge Runtime compatibility
  ssl: 'require',
  max: 1, // Edge Runtime works better with single connections
  idle_timeout: 20,
  connect_timeout: 10,
});

// Export a query function compatible with our existing pg-style code
export async function query(text, params = []) {
  try {
    const result = await sql.unsafe(text, params);
    return { rows: result };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Transaction support
export async function transaction(callback) {
  return await sql.begin(async sql => {
    const client = {
      query: async (text, params = []) => {
        const result = await sql.unsafe(text, params);
        return { rows: result };
      },
    };
    return await callback(client);
  });
}

// Connection test
export async function testConnection() {
  try {
    const result = await sql`SELECT 1 as test`;
    return result.length > 0;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

export default { query, transaction, testConnection };
