#!/bin/bash

# =====================================================
# Neon Database Setup Script
# Run this script to create all tables in Neon PostgreSQL
# =====================================================

echo "🚀 Setting up Neon PostgreSQL Database..."
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL environment variable not set"
  echo "   Using default connection string..."
  export DATABASE_URL="postgresql://neondb_owner:npg_GHrRQzwk9E4n@ep-hidden-paper-ajua0bg2-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require"
fi

echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🗄️  Running database migration..."
echo "   You can run the migration SQL directly in Neon SQL Editor:"
echo "   1. Go to https://console.neon.tech"
echo "   2. Open your project"
echo "   3. Go to SQL Editor"
echo "   4. Copy and paste the contents of scripts/neon-migration.sql"
echo "   5. Run the SQL"
echo ""
echo "   Or use psql if you have it installed:"
echo "   psql \"\$DATABASE_URL\" -f scripts/neon-migration.sql"
echo ""

# Check if psql is available
if command -v psql &> /dev/null; then
  echo "✅ psql found! Running migration..."
  psql "$DATABASE_URL" -f scripts/neon-migration.sql
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database migration completed successfully!"
  else
    echo ""
    echo "❌ Migration failed. Please run the SQL manually in Neon Console."
  fi
else
  echo "ℹ️  psql not found. Please run the migration manually:"
  echo "   1. Open Neon Console: https://console.neon.tech"
  echo "   2. Navigate to your project"
  echo "   3. Open SQL Editor"
  echo "   4. Paste contents of scripts/neon-migration.sql"
  echo "   5. Click Run"
fi

echo ""
echo "📝 Next Steps:"
echo "   1. Set DATABASE_URL in Netlify environment variables:"
echo "      DATABASE_URL=$DATABASE_URL"
echo ""
echo "   2. Deploy to Netlify:"
echo "      git add ."
echo "      git commit -m 'Migrate to Neon PostgreSQL'"
echo "      git push"
echo ""
echo "   3. Or deploy manually:"
echo "      netlify deploy --prod"
echo ""
echo "🎉 Done!"
