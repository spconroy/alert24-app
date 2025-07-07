#!/bin/bash

echo "🚀 Alert24 Deployment Script"
echo "============================="

# Check if environment file exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local file not found. Creating template..."
    cat > .env.local << EOF
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: SendGrid for emails
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
EOF
    echo "📝 Please update .env.local with your actual values"
    exit 1
fi

echo "🔧 Building application..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🌟 Deployment Options:"
    echo "1️⃣  Vercel (Recommended): vercel --prod"
    echo "2️⃣  Railway: railway up"
    echo "3️⃣  Netlify: netlify deploy --prod"
    echo ""
    echo "📋 Remember to set environment variables in your deployment platform:"
    echo "   - DATABASE_URL"
    echo "   - NEXTAUTH_URL" 
    echo "   - NEXTAUTH_SECRET"
    echo "   - GOOGLE_CLIENT_ID"
    echo "   - GOOGLE_CLIENT_SECRET"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi 