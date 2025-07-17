import { neon } from '@neondatabase/serverless';

// Initialize the database connection
// This works in Edge Runtime because it uses HTTP/WebSocket instead of TCP
const sql = neon(process.env.DATABASE_URL);

// Export a query function that's compatible with our existing code
export async function query(text, params = []) {
  try {
    const result = await sql(text, params);
    return { rows: result };
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// For transaction support (if needed)
export async function transaction(callback) {
  // Neon handles transactions automatically with SQL
  return await callback({ query });
}

// Connection test function
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
