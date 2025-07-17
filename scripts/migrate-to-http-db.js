#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const apiDir = 'app/api';

// Migration patterns to convert from pg to HTTP database client
const migrations = [
  {
    // Replace pg Pool import
    from: /import { Pool } from 'pg';/g,
    to: "import { query, transaction } from '@/lib/db-http';",
  },
  {
    // Replace pool initialization
    from: /const pool = new Pool\(\{[^}]*\}\);?/g,
    to: '// Using HTTP database client',
  },
  {
    // Replace pool.query calls
    from: /pool\.query\(/g,
    to: 'query(',
  },
  {
    // Replace client.query in transactions
    from: /client\.query\(/g,
    to: 'client.query(',
  },
  {
    // Add Edge Runtime export if not present
    from: /^(import)/m,
    to: "export const runtime = 'edge';\n\n$1",
  },
  {
    // Replace connection setup in transactions
    from: /const client = await pool\.connect\(\);[\s\S]*?client\.release\(\);/g,
    to: `await transaction(async (client) => {
  // Transaction logic here
  return result;
});`,
  },
];

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Skip if already has Edge Runtime
  if (content.includes("runtime = 'edge'")) {
    console.log(`⏭️  Skipping ${filePath} (already has Edge Runtime)`);
    return;
  }

  // Skip if already using HTTP client
  if (content.includes('@/lib/db-http')) {
    console.log(`⏭️  Skipping ${filePath} (already using HTTP client)`);
    return;
  }

  // Apply migrations
  migrations.forEach(({ from, to }) => {
    if (content.match(from)) {
      content = content.replace(from, to);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Migrated ${filePath}`);
  } else {
    console.log(`⏭️  No changes needed for ${filePath}`);
  }
}

function findApiFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach(item => {
      const itemPath = path.join(currentDir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        traverse(itemPath);
      } else if (item === 'route.js') {
        files.push(itemPath);
      }
    });
  }

  traverse(dir);
  return files;
}

console.log('🚀 Starting HTTP Database Migration...\n');

try {
  const apiFiles = findApiFiles(apiDir);
  console.log(`Found ${apiFiles.length} API route files\n`);

  apiFiles.forEach(migrateFile);

  console.log('\n✨ Migration completed!');
  console.log('\n📋 Next steps:');
  console.log('1. Set up your environment variables:');
  console.log('   - HTTP_DATABASE_URL="https://pgdb1.alert24.net/"');
  console.log('   - JWT_SECRET="your-32-char-secret"');
  console.log('2. Run the database permissions script');
  console.log('3. Test the /api/test-http-db endpoint');
  console.log('4. Deploy to Cloudflare Pages with Edge Runtime');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
