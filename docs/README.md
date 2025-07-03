# Alert24 Documentation

This folder contains all documentation for the Alert24 multi-tenant SaaS application.

## Files

### Database Documentation
- **`database_schema.sql`** - Complete PostgreSQL database schema
  - Multi-tenant architecture with organizations and users
  - Real-time features with notifications and WebSocket channels
  - Subscription management with Stripe integration
  - Audit logging and activity history
  - Performance optimizations with indexes and views
  - Helper functions for common operations

- **`database_config.md`** - Database connection configuration
  - Connection details and credentials
  - Environment variable setup
  - ORM configuration examples (Prisma/Drizzle)
  - Security best practices

## Database Schema Overview

The Alert24 database is designed for a multi-tenant SaaS application with the following key features:

### Core Tables
- **`organizations`** - Multi-tenant core with branding and subscription data
- **`users`** - User accounts with Google OAuth integration
- **`organization_members`** - Many-to-many relationships with roles

### Real-Time Features
- **`notifications`** - In-app and email notification system
- **`realtime_channels`** - WebSocket subscription management
- **`activity_history`** - Comprehensive audit logging

### Subscription & Billing
- **`subscription_plans`** - Available plans and features
- **`billing_history`** - Payment transaction tracking

### Example Domain Entities
- **`projects`** - Collaboration features
- **`project_members`** - Project team management

### Authentication & Sessions
- **`user_sessions`** - Session management

## Key Features

- **Multi-tenant architecture** with organization-based data isolation
- **Real-time capabilities** via WebSocket channels
- **Comprehensive audit logging** for all user actions
- **Subscription management** with Stripe integration
- **Custom branding** support for white-label features
- **Performance optimized** with proper indexing and views
- **Security focused** with UUID primary keys and constraints

## Getting Started

1. Review the database schema in `database_schema.sql`
2. Set up your database connection using `database_config.md`
3. Run the schema to create all tables, indexes, and functions
4. Configure your ORM (Prisma or Drizzle) with the connection details

## Development Notes

- All tables use UUID primary keys for security and scalability
- Soft deletes are implemented with `deleted_at` timestamps
- Automatic `updated_at` timestamps via triggers
- Comprehensive indexing for optimal query performance
- Helper functions for common operations like logging and notifications 