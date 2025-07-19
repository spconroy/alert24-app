# Alert24 Documentation

## 📁 Documentation Structure

This documentation is organized into several categories for better maintainability:

### 📚 `/docs/deployment/`

**Deployment and Infrastructure Documentation**

- `CLOUDFLARE_AUTHENTICATION_GUIDE.md` - Cloudflare OAuth setup
- `CLOUDFLARE_ACCESS_SETUP.md` - Cloudflare Access configuration
- `HTTP_DATABASE_SETUP.md` - HTTP database configuration
- `EDGE_MIGRATION.md` - Edge runtime migration guide
- `DEPLOYMENT.md` - General deployment instructions
- `DATABASE_SCHEMA_FIXES.md` - Database schema fixes and updates
- `SUPABASE_MIGRATION_CHECKLIST.md` - Supabase migration guide
- `MONITORING_SERVICE_ASSOCIATION.md` - Monitoring service setup

### 🛠️ `/docs/development/`

**Development and Architecture Documentation**

- `CLAUDE.md` - Claude AI integration notes
- `FUNCTIONALITY_ANALYSIS.md` - Feature analysis and requirements
- `ENVIRONMENT_VARIABLES.md` - Environment configuration guide
- `IMPROVEMENTS_SUMMARY.md` - Development improvements and changes

### 📊 `/docs/schema-updates/`

**Database Schema Documentation**

- SQL migration files and schema updates
- Database structure documentation

### 🏗️ Project Files

- `schema-helper-usage.md` - Database schema helper documentation
- `task-breakdown.md` - Development task breakdown and planning
- `verify_schema.sql` - Schema verification scripts

## 🗂️ Other Organized Folders

### 📊 `/data/`

- `/status-pages/` - Status page lists and configuration data
- `/reports/` - JSON reports and import summaries

### 🔧 `/scripts/`

- Database migration scripts
- Utility scripts for status page imports
- Test and setup scripts

### 🚀 `/deployment/`

- Deployment configuration files
- Platform-specific configs (Vercel, Railway, Cloudflare)

### 📦 `/temp/`

- Temporary files and notes
- Development artifacts

## 📖 Quick Reference

- **Setting up the project?** → Start with `README.md` in root, then `docs/deployment/`
- **Database issues?** → Check `docs/deployment/DATABASE_SCHEMA_FIXES.md`
- **Deployment problems?** → See `docs/deployment/DEPLOYMENT.md`
- **Development questions?** → Browse `docs/development/`
- **Need to run scripts?** → Look in `/scripts/`
