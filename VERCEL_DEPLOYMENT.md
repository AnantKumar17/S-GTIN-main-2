# Vercel Deployment Guide for PO-Service

## Problem Fixed
The error `Cannot find module 'express-rate-limit'` occurred because Vercel wasn't installing shared middleware dependencies.

## Solution Implemented
All shared dependencies have been added directly to each service's `package.json`:
- `express-rate-limit` (for rate limiting middleware)
- `jimp` (for image processing)
- `jsqr` (for QR code reading)
- `quagga` (for barcode scanning)

## Deployment Steps

### 1. Create a `.vercelignore` file (optional but recommended)
```
node_modules/
.git/
frontend/
readme_test_scripts_and_test_results/
references/
docker-compose.yml
*.md
.env
```

### 2. Configure Environment Variables in Vercel
In Vercel dashboard, go to Project Settings → Environment Variables and add:

```
PORT=3002
DB_HOST=aws-1-ap-northeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.xhqxjhxcvjbopjczqyld
DB_PASSWORD=Myownway17
MANDT=100
API_KEY=dev-api-key-12345
SGTIN_SERVICE_URL=http://your-sgtin-service-url.vercel.app
```

### 3. Update Vercel Project Settings
In Vercel dashboard:
- **Root Directory**: `services/po-service`
- **Build Command**: `npm install` (or leave default)
- **Install Command**: `npm install`
- **Output Directory**: Leave empty or use default

### 4. Deploy
Push your changes to GitHub:
```bash
git add .
git commit -m "Fix: Add shared dependencies to po-service package.json for Vercel"
git push
```

Vercel will automatically deploy when you push.

## Verification
After deployment, test the health endpoint:
```bash
curl https://your-po-service.vercel.app/health
```

You should see:
```json
{
  "status": "OK",
  "service": "Purchase Order Service",
  "port": 3002,
  "security": {
    "authentication": "API Key (X-API-Key header)",
    "rateLimiting": "Active"
  }
}
```

## Important Notes
- The `shared/` folder dependencies are now duplicated in each service's `package.json`
- This is the correct approach for Vercel/serverless deployments
- Each service is independently deployable

## Troubleshooting
If you still get module errors:
1. Clear Vercel's build cache: Dashboard → Project → Settings → Advanced → Clear Build Cache
2. Force redeploy by making a trivial commit and pushing again
3. Check build logs in Vercel dashboard for detailed error messages
