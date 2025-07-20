#!/bin/bash

# Apply Migration: 12_missing_columns_and_fixes.sql
# This script applies the critical database migration directly using psql

echo "🚀 Alert24 Database Migration"
echo "============================="

# Connection details (properly escaped)
DB_HOST="34.223.13.196"
DB_PORT="5432"
DB_NAME="alert24"
DB_USER="alert24"
DB_PASSWORD="Sg47^kLm9@wPz!rT"
MIGRATION_FILE="docs/schema-updates/12_missing_columns_and_fixes.sql"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📝 Migration file: $MIGRATION_FILE"
echo "🔗 Database: $DB_NAME ($DB_HOST)"
echo ""

# Verify psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Please install PostgreSQL client."
    echo "🔗 Homebrew: brew install postgresql"
    echo "🔗 Or use Supabase Dashboard SQL Editor"
    exit 1
fi

echo "⚡ Applying migration..."
echo "======================="

# Set PGPASSWORD environment variable to avoid password prompt
export PGPASSWORD="$DB_PASSWORD"

# Apply the migration
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_FILE"; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo "🧪 Testing migration status..."
    
    # Test the migration by checking for one of the new columns
    echo ""
    echo "🔍 Verifying migration..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'services' AND column_name = 'auto_recovery';" -t
    
    if [ $? -eq 0 ]; then
        echo "✅ Migration verification successful!"
        echo ""
        echo "🚀 Next steps:"
        echo "1. Test the application: npm run dev"
        echo "2. Verify migration: curl http://localhost:3002/api/test-migration-status"
        echo "3. Run any additional unit tests"
    else
        echo "⚠️  Migration may not have applied completely"
    fi
else
    echo ""
    echo "❌ Migration failed!"
    echo "💡 Alternative: Apply manually via Supabase Dashboard"
    echo "🔗 Copy the SQL from: $MIGRATION_FILE"
    exit 1
fi

# Clear the password from environment
unset PGPASSWORD