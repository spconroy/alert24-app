# Alert24 - Multi-Tenant SaaS Application

A modern, real-time collaboration platform with custom branding and subscription management, built with Next.js, Supabase, and Cloudflare Pages.

## 🚀 Project Overview

Alert24 is a comprehensive SaaS application that enables organizations to:

- **Manage teams** with role-based access control
- **Collaborate in real-time** with live notifications and updates
- **Customize branding** for white-label capabilities
- **Handle subscriptions** with Stripe integration
- **Track activity** with comprehensive audit logging

## 🏗️ Architecture

- **Frontend**: Next.js 13+ with App Router
- **Backend**: Next.js API Routes with serverless functions
- **Database**: Supabase (PostgreSQL backend)
- **Authentication**: Google OAuth via NextAuth.js
- **UI Framework**: Material UI (MUI) + Tailwind CSS
- **Hosting**: Cloudflare Pages with edge runtime
- **Payments**: Stripe for subscription management
- **Email**: SendGrid for transactional emails
- **Real-time**: Supabase real-time subscriptions

## 📊 Database Schema

The application uses Supabase with a comprehensive PostgreSQL schema:

- **11 Core Tables**: Organizations, users, members, notifications, etc.
- **25+ Indexes**: Optimized for performance
- **4 Helper Functions**: Common operations and utilities
- **6 Triggers**: Automatic timestamp updates
- **2 Dashboard Views**: Aggregated data for dashboards
- **3 Subscription Plans**: Pre-populated pricing tiers

### Database Connection

All database operations use Supabase client. Configure via environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL client
- Git

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd alert24-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Update `.env.local` with your configuration:

   ```env
   DATABASE_URL="postgresql://alert24:Sg47^kLm9@wPz!rT@34.223.13.196:5432/alert24?options=-csearch_path%3Dalert24_schema"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-development-secret"
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   SENDGRID_API_KEY="your-sendgrid-api-key"
   STRIPE_SECRET_KEY="your-stripe-secret-key"
   STRIPE_PUBLISHABLE_KEY="your-stripe-publishable-key"
   ```

4. **Verify database schema**

   ```bash
   psql "postgresql://alert24:Sg47^kLm9@wPz!rT@34.223.13.196:5432/alert24" -f docs/verify_schema.sql
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
alert24-app/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Protected dashboard pages
│   ├── auth/              # Authentication pages
│   ├── components/        # Reusable UI components
│   └── lib/               # Utility functions
├── docs/                  # Documentation
│   ├── database_schema.sql
│   ├── database_config.md
│   └── verify_schema.sql
├── prisma/                # Database ORM
├── taskmaster.json        # Project configuration
└── package.json
```

## 🎯 Development Phases

### Phase 1: Core Foundation (Weeks 1-4)

- [ ] Next.js project setup with Cloudflare Pages
- [ ] PostgreSQL database setup and schema design
- [ ] Google OAuth integration with NextAuth.js
- [ ] Basic user authentication and session management
- [ ] Organization model and multi-tenant architecture

### Phase 2: Team Management (Weeks 5-8)

- [ ] Organization CRUD operations
- [ ] Team member invitation system
- [ ] Role-based access control implementation
- [ ] Organization switching functionality
- [ ] Basic UI with Material UI components

### Phase 3: Real-Time Features (Weeks 9-12)

- [ ] WebSocket integration setup
- [ ] Real-time notification system
- [ ] Activity history and audit logging
- [ ] Real-time collaboration features
- [ ] Performance optimization

### Phase 4: Subscription & Billing (Weeks 13-16)

- [ ] Stripe integration and subscription management
- [ ] Plan-based feature access control
- [ ] Billing interface and customer portal
- [ ] Payment failure handling
- [ ] Subscription analytics

### Phase 5: Custom Branding (Weeks 17-20)

- [ ] Custom domain support implementation
- [ ] Branding customization interface
- [ ] Multi-tenant routing and host resolution
- [ ] Email branding integration
- [ ] White-label feature completion

### Phase 6: Polish & Launch (Weeks 21-24)

- [ ] UI/UX refinement and testing
- [ ] Performance optimization and monitoring
- [ ] Security audit and penetration testing
- [ ] Documentation and user guides
- [ ] Production deployment and launch

## 🔧 Key Features

### Multi-Tenant Architecture

- Organization-based data isolation
- Custom domains and subdomains
- White-label branding capabilities
- Role-based access control

### Real-Time Collaboration

- WebSocket connections for live updates
- Instant notifications
- Activity tracking and audit logging
- Team presence indicators

### Subscription Management

- Free, Pro, and Enterprise plans
- Stripe integration for payments
- Usage tracking and limits
- Billing history and analytics

### Security & Compliance

- Google OAuth authentication
- JWT-based session management
- Comprehensive audit logging
- Data encryption and validation

## 🚀 Deployment

### Cloudflare Pages

The application is designed to deploy on Cloudflare Pages with:

- Edge runtime for global performance
- Automatic SSL certificates
- Custom domain support
- CDN optimization

### Environment Configuration

Set up environment variables in Cloudflare Pages dashboard:

- Database connection
- OAuth credentials
- API keys for external services
- Stripe configuration

## 📚 Documentation

- **PRD**: `prd.txt` - Product Requirements Document
- **Database**: `docs/database_schema.sql` - Complete schema
- **Configuration**: `docs/database_config.md` - Database setup
- **Taskmaster**: `taskmaster.json` - Project configuration

## 🤝 Contributing

1. Follow the development phases outlined above
2. Ensure all database changes are properly tested
3. Update documentation as needed
4. Follow security best practices
5. Test thoroughly before deployment

## 📞 Support

For questions or issues:

- Check the documentation in the `docs/` folder
- Review the PRD for feature requirements
- Verify database schema with the verification script

## 🔒 Security Notes

- Never commit sensitive credentials to version control
- Use environment variables for all secrets
- Regularly update dependencies
- Monitor for security vulnerabilities
- Implement proper input validation

---

**Alert24** - Building the future of collaborative SaaS platforms
