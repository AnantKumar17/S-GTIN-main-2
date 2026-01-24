# PO-Service Standalone Deployment Guide

This po-service folder is now **self-contained** and can be deployed independently to Vercel without needing parent directories.

## 📁 Folder Structure

```
po-service/
├── src/
│   ├── server.js              # Main Express app
│   ├── controllers/
│   │   └── poController.js    # PO logic
│   └── routes/
│       └── purchaseOrder.js   # API routes
├── shared/                     # LOCAL COPY (not from parent)
│   └── middleware/
│       ├── auth.js            # Authentication
│       └── rateLimiter.js     # Rate limiting
├── database/                   # LOCAL COPY (not from parent)
│   └── models/
│       ├── db.js              # DB connection
│       ├── BaseModel.js       # Base ORM class
│       ├── Product.js         # Product model
│       ├── PurchaseOrder.js   # PO model
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
- **IMPORTANT**: Set Root Directory to `services/po-service`

### 3. Configure Environment Variables
In Vercel Project Settings → Environment Variables, add:

```
PORT=3002
DB_HOST=aws-1-ap-northeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.xhqxjhxcvjbopjczqyld
DB_PASSWORD=Myownway17
MANDT=100
API_KEY=dev-api-key-12345
SGTIN_SERVICE_URL=https://your-sgtin-service.vercel.app
```

### 4. Build & Deploy Settings
- **Build Command**: `npm install` (default)
- **Start Command**: `node src/server.js`
- **Root Directory**: `services/po-service` ✅

### 5. Deploy
```bash
git add .
git commit -m "feat: Restructure po-service for standalone Vercel deployment"
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
- `database/models/PurchaseOrder.js`
- `database/models/index.js`

### ✓ Updated Imports
- `server.js`: `../../../shared` → `../shared`
- `poController.js`: `../../../../database` → `../../database`

### ✓ All Dependencies in package.json
- express-rate-limit ✓
- jimp ✓
- jsqr ✓
- quagga ✓
- All others ✓

## 🧪 Local Testing

```bash
cd services/po-service

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
curl http://localhost:3002/health

# Create PO
curl -X POST http://localhost:3002/api/purchase-orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-api-key-12345" \
  -d '{
    "mandt": "100",
    "po_id": "PO-001",
    "gtin": "12345678901234",
    "quantity": 100,
    "supplier": "Supplier ABC",
    "warehouse": "WH-01"
  }'

# Get all POs
curl "http://localhost:3002/api/purchase-orders?mandt=100" \
  -H "X-API-Key: dev-api-key-12345"

# Get specific PO
curl "http://localhost:3002/api/purchase-orders/PO-001?mandt=100" \
  -H "X-API-Key: dev-api-key-12345"
```

## 🐛 Troubleshooting

### Error: Cannot find module
- Clear Vercel build cache: Dashboard → Settings → Advanced → Clear Build Cache
- Verify `package.json` has all dependencies
- Check Root Directory is set to `services/po-service`

### Error: Module not found error
- Ensure all imports use local paths (`../shared`, `../../database`)
- Check file paths match the new structure

### Database connection error
- Verify DB credentials in environment variables
- Check Supabase connection is accessible
- Confirm MANDT value matches your database

## 📝 Deployment Checklist

- [ ] Root Directory set to `services/po-service` in Vercel
- [ ] All environment variables configured
- [ ] Database credentials are correct
- [ ] Local testing passes before pushing
- [ ] Git push triggers Vercel deployment
- [ ] Health endpoint returns 200 OK

## 🎉 Success!

Once deployed, your PO Service will be available at:
```
https://your-project-name.vercel.app
```

Test with:
```bash
curl https://your-project-name.vercel.app/health
```

---

**Note**: This self-contained structure makes po-service completely independent. You can now deploy multiple services from the same repo to Vercel without issues!
