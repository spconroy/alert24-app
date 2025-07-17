#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, '..', 'app', 'api');

// Track migration progress
let migrated = 0;
let errors = 0;
let skipped = 0;

// Files to skip (already migrated or don't need migration)
const skipFiles = [
  'test-edge',
  'test-http-db',
  'test-cloudflare-db',
  'debug-http',
];

/**
 * Apply migration patterns to file content
 */
function migrateFileContent(content, filePath) {
  let modified = content;

  // Skip if already migrated
  if (modified.includes("export const runtime = 'edge'")) {
    console.log(`⏭️  Skipping ${filePath} (already migrated)`);
    skipped++;
    return null;
  }

  // Skip if no pg imports found
  if (!modified.includes("from 'pg'") && !modified.includes('Pool')) {
    console.log(`⏭️  Skipping ${filePath} (no database usage)`);
    skipped++;
    return null;
  }

  // Migration patterns
  const migrations = [
    {
      // Add Edge Runtime export at the top
      from: /^(import.*)/m,
      to: "export const runtime = 'edge';\n\n$1",
    },
    {
      // Replace pg Pool import with HTTP client
      from: /import { Pool } from 'pg';/g,
      to: "import { query, transaction } from '@/lib/db-http-cloudflare';",
    },
    {
      // Remove pool initialization
      from: /const pool = new Pool\(\{ connectionString: process\.env\.DATABASE_URL \}\);?\n?/g,
      to: '',
    },
    {
      // Replace pool.query calls
      from: /pool\.query\(/g,
      to: 'query(',
    },
    {
      // Replace client.query in transactions (basic pattern)
      from: /client\.query\(/g,
      to: 'client.query(',
    },
    {
      // Update error handling for HTTP responses
      from: /e\.code === '23505'/g,
      to: "e.message && e.message.includes('23505')",
    },
    {
      // Update constraint error checking
      from: /e\.constraint === '([^']+)'/g,
      to: "e.message.includes('$1')",
    },
    {
      // Add better error logging
      from: /(} catch \(e\) \{)/g,
      to: "$1\n    console.error('Database error:', e);",
    },
  ];

  // Apply all migrations
  migrations.forEach(migration => {
    modified = modified.replace(migration.from, migration.to);
  });

  // Add try-catch blocks where missing
  if (modified.includes('await query(') && !modified.includes('try {')) {
    // This is a simple heuristic - you might need to adjust for complex cases
    console.log(`⚠️  ${filePath} needs manual try-catch block review`);
  }

  return modified;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const migrated = migrateFileContent(content, filePath);

    if (migrated === null) {
      return; // Skipped
    }

    // Create backup
    const backupPath = `${filePath}.backup`;
    fs.writeFileSync(backupPath, content);

    // Write migrated content
    fs.writeFileSync(filePath, migrated);

    console.log(`✅ Migrated ${filePath}`);
    migrated++;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    errors++;
  }
}

/**
 * Recursively find all route.js files
 */
function findRouteFiles(dir) {
  const files = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip test endpoints
      if (skipFiles.some(skip => fullPath.includes(skip))) {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...findRouteFiles(fullPath));
      } else if (entry.name === 'route.js') {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Main migration function
 */
function migrateAllRoutes() {
  console.log('🚀 Starting API route migration to Edge Runtime...\n');

  if (!fs.existsSync(apiDir)) {
    console.error('❌ API directory not found:', apiDir);
    process.exit(1);
  }

  const routeFiles = findRouteFiles(apiDir);
  console.log(`Found ${routeFiles.length} route files to process\n`);

  routeFiles.forEach(processFile);

  console.log('\n📊 Migration Summary:');
  console.log(`✅ Migrated: ${migrated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);

  if (errors > 0) {
    console.log(
      '\n⚠️  Some files had errors. Check the output above and migrate manually if needed.'
    );
  }

  if (migrated > 0) {
    console.log('\n🔧 Next Steps:');
    console.log(
      '1. Set up Cloudflare Access credentials (see CLOUDFLARE_ACCESS_SETUP.md)'
    );
    console.log('2. Test the migrated routes: npm run dev');
    console.log('3. Check for any manual fixes needed in complex routes');
    console.log(
      '4. Backup files were created (.backup) - remove them when satisfied'
    );
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateAllRoutes();
}

export { migrateAllRoutes, migrateFileContent };
