#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Find all files with NextAuth v4 client imports
const filesToFix = [
  'app/page.js',
  'app/incidents/[id]/page.js',
  'app/incidents/[id]/edit/page.js',
  'app/incidents/page.js',
  'app/incidents/new/page.js',
  'app/monitoring/page.js',
  'app/monitoring/new/page.js',
  'app/monitoring/edit/[id]/page.js',
  'app/profile/page.js',
  'app/on-call/[id]/edit/page.js',
  'app/on-call/page.js',
  'app/status-pages/page.js',
  'app/accept-invitation/page.js',
  'app/settings/page.js',
  'app/escalation-policies/new/page.js',
  'components/StatusPageOverview.jsx',
  'components/ProtectedRoute.jsx',
  'components/AuthStatus.jsx',
  'components/CreateOrganizationForm.jsx',
];

// Files that need signIn/signOut functionality
const authActionFiles = [
  'components/ProtectedRoute.jsx',
  'components/AuthStatus.jsx',
];

function updateFileContent(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Remove NextAuth v4 imports
    content = content.replace(
      /import\s*\{\s*useSession[^}]*\}\s*from\s*['"]next-auth\/react['"];?\s*\n?/g,
      ''
    );
    content = content.replace(
      /import\s*\{\s*[^}]*useSession[^}]*\}\s*from\s*['"]next-auth\/react['"];?\s*\n?/g,
      ''
    );

    // Add OrganizationContext import if not present
    if (
      !content.includes('import { useOrganization }') &&
      !content.includes("from '@/contexts/OrganizationContext'")
    ) {
      // Find the last import statement
      const importLines = content.split('\n');
      let lastImportIndex = -1;

      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].trim().startsWith('import ')) {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex >= 0) {
        importLines.splice(
          lastImportIndex + 1,
          0,
          "import { useOrganization } from '@/contexts/OrganizationContext';"
        );
        content = importLines.join('\n');
      }
    }

    // Update useSession calls to use OrganizationContext
    if (content.includes('useSession()')) {
      content = content.replace(
        /const\s*\{\s*data:\s*session[^}]*\}\s*=\s*useSession\(\);?/g,
        'const { session } = useOrganization();'
      );
      content = content.replace(
        /const\s*\{\s*[^}]*session[^}]*\}\s*=\s*useSession\(\);?/g,
        'const { session } = useOrganization();'
      );
    }

    // Update destructured useSession calls
    content = content.replace(
      /const\s*\{\s*data:\s*session,\s*status\s*\}\s*=\s*useSession\(\);?/g,
      'const { session } = useOrganization();'
    );
    content = content.replace(
      /const\s*\{\s*session,\s*status\s*\}\s*=\s*useSession\(\);?/g,
      'const { session } = useOrganization();'
    );

    // Remove status variable usage since we simplified the loading logic
    content = content.replace(
      /status\s*===\s*['"]loading['"].*?\?\s*[^:]*:\s*/g,
      ''
    );
    content = content.replace(
      /status\s*===\s*['"]authenticated['"].*?\?\s*/g,
      'session ? '
    );

    // For auth action files, replace signIn/signOut calls
    if (authActionFiles.includes(filePath)) {
      content = content.replace(
        /signIn\(\)/g,
        "window.location.href = '/api/auth/signin'"
      );
      content = content.replace(
        /signOut\(\)/g,
        "window.location.href = '/api/auth/signout'"
      );
    }

    // Update OrganizationContext destructuring to include session if needed
    const orgContextRegex =
      /const\s*\{\s*([^}]+)\s*\}\s*=\s*useOrganization\(\);?/;
    const match = content.match(orgContextRegex);
    if (match && !match[1].includes('session')) {
      const props = match[1].trim();
      content = content.replace(
        orgContextRegex,
        `const { ${props}, session } = useOrganization();`
      );
    }

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️  No changes needed: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔧 Fixing NextAuth v4 to v5 client-side imports...\n');

  let fixedCount = 0;

  for (const file of filesToFix) {
    if (fs.existsSync(file)) {
      if (updateFileContent(file)) {
        fixedCount++;
      }
    } else {
      console.log(`⚠️  File not found: ${file}`);
    }
  }

  console.log(`\n🎉 Fixed ${fixedCount} files successfully!`);

  if (fixedCount > 0) {
    console.log('\n📝 Running git add on fixed files...');
    try {
      for (const file of filesToFix) {
        if (fs.existsSync(file)) {
          execSync(`git add "${file}"`, { stdio: 'inherit' });
        }
      }
      console.log('✅ Files staged for commit');
    } catch (error) {
      console.error('❌ Error staging files:', error.message);
    }
  }
}

main();
