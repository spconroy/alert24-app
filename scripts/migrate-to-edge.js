#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const apiDir = 'app/api';

// Migration patterns
const migrations = [
  {
    // Replace pg Pool import
    from: /import { Pool } from 'pg';/g,
    to: "import { query, transaction } from '@/lib/db-edge';",
  },
  {
    // Replace pool initialization
    from: /const pool = new Pool\(\{ connectionString: process\.env\.DATABASE_URL \}\);/g,
    to: '// Using Edge Runtime-compatible database client',
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
    // Add Edge Runtime export
    from: /^(import)/m,
    to: "export const runtime = 'edge';\n\n$1",
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

console.log('🚀 Starting Edge Runtime Migration...\n');

try {
  const apiFiles = findApiFiles(apiDir);
  console.log(`Found ${apiFiles.length} API route files\n`);

  apiFiles.forEach(migrateFile);

  console.log('\n✨ Migration completed!');
  console.log('\n📋 Next steps:');
  console.log(
    '1. Update your DATABASE_URL to use a compatible service (Neon, Supabase, etc.)'
  );
  console.log('2. Test the /api/test-edge endpoint');
  console.log('3. Update NextAuth.js configuration for Edge Runtime');
  console.log('4. Test all API routes thoroughly');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
