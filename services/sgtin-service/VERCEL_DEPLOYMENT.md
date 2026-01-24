# SGTIN-Service Standalone Deployment Guide

This sgtin-service folder is now **self-contained** and can be deployed independently to Vercel without needing parent directories.

## 📁 Folder Structure

```
sgtin-service/
├── src/
│   ├── server.js              # Main Express app
│   ├── controllers/
│   │   └── sgtinController.js # SGTIN generation logic
│   ├── routes/
│   │   └── sgtin.js           # API routes
│   └── utils/
│       └── sgtinUtils.js      # SGTIN generation utilities
├── shared/                     # LOCAL COPY (not from parent)
│   └── middleware/
│       ├── auth.js            # Authentication
│       └── rateLimiter.js     # Rate limiting
├── database/                   # LOCAL COPY (not from parent)
│   └── models/
│       ├── db.js              # DB connection
│       ├── BaseModel.js       # Base ORM class
│       ├── Product.js         # Product model
│       ├── SerializedItem.js  # SGTIN item model
│       ├── LifecycleEvent.js  # Event tracking
│       └── index.js           # Model exports
├── package.json               # All dependencies included
├── .env.example              # Environment template
└── README.md
```

## 🚀 Vercel Deployment Steps

### 1. Create Vercel Account
- Go to [vercel.com](https://vercel.com)
- Sign in with GitHub

### 2. Deploy Your Project
- Click "New Project"
- Select your GitHub repository `AnantKumar17/S-GTIN-main-2`
- **IMPORTANT**: Set Root Directory to `services/sgtin-service`

### 3. Configure Environment Variables
In Vercel Project Settings → Environment Variables, add:

```
PORT=3001
DB_HOST=aws-1-ap-northeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.xhqxjhxcvjbopjczqyld
DB_PASSWORD=your_actual_password
MANDT=100
API_KEY=dev-api-key-12345
```

### 4. Build & Deploy Settings
- **Build Command**: `npm install` (default)
- **Start Command**: `node src/server.js`
- **Root Directory**: `services/sgtin-service` ✅

### 5. Deploy
```bash
git add .
git commit -m "feat: Restructure sgtin-service for standalone Vercel deployment"
git push origin main
```

Vercel will automatically deploy when you push!

## ✅ What Changed

### ✓ Copied Files (Now Local)
- `shared/middleware/auth.js` 
- `shared/middleware/rateLimiter.js`
- `database/models/db.js`
- `database/models/BaseModel.js`
- `database/models/Product.js`
- `database/models/SerializedItem.js`
- `database/models/LifecycleEvent.js`
- `database/models/index.js`

### ✓ Updated Imports
- `server.js`: `../../../shared` → `../shared`
- `sgtinController.js`: `../../../../database` → `../../database`

### ✓ All Dependencies in package.json
- express-rate-limit ✓
- bwip-js ✓ (barcode generation)
- qrcode ✓ (QR code generation)
- jimp ✓ (image processing)
- jsqr ✓ (QR code reading)
- quagga ✓ (barcode scanning)
- uuid ✓ (ID generation)
- All others ✓

## 🧪 Local Testing

```bash
cd services/sgtin-service

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env with your database credentials
nano .env

# Start the service
npm start
```

## 🔌 API Endpoints

All endpoints require `X-API-Key: dev-api-key-12345` header

```bash
# Health check
curl http://localhost:3001/health

# Generate SGTINs
curl -X POST http://localhost:3001/api/sgtin/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "mandt": "100",
    "gtin": "12345678901234",
    "quantity": 10,
    "batch": "BATCH-001",
    "manufactureDate": "2026-01-24"
  }'

# Get SGTIN
curl "http://localhost:3001/api/sgtin/SGTIN123" \
  -H "X-API-Key: dev-api-key-12345"

# Validate SGTIN
curl -X POST http://localhost:3001/api/sgtin/validate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "sgtin": "01123456789012342112345",
    "mandt": "100"
  }'
```

## 🐛 Troubleshooting

### Error: Cannot find module
- Clear Vercel build cache: Dashboard → Settings → Advanced → Clear Build Cache
- Verify `package.json` has all dependencies
- Check Root Directory is set to `services/sgtin-service`

### Error: Module not found error
- Ensure all imports use local paths (`../shared`, `../../database`)
- Check file paths match the new structure

### Database connection error
- Verify DB credentials in environment variables
- Check Supabase connection is accessible
- Confirm MANDT value matches your database

## 📝 Deployment Checklist

- [ ] Root Directory set to `services/sgtin-service` in Vercel
- [ ] All environment variables configured
- [ ] Database credentials are correct
- [ ] Local testing passes before pushing
- [ ] Git push triggers Vercel deployment
- [ ] Health endpoint returns 200 OK
- [ ] SGTIN generation working correctly

## 🎉 Success!

Once deployed, your SGTIN Service will be available at:
```
https://your-sgtin-service.vercel.app
```

Test with:
```bash
curl https://your-sgtin-service.vercel.app/health
```

---

**Note**: This self-contained structure makes sgtin-service completely independent. You can now deploy multiple services from the same repo to Vercel without issues!
