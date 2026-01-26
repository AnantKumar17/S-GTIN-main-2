# Inventory-Service Standalone Deployment Guide

This inventory-service folder is now **self-contained** and can be deployed independently to Vercel without needing parent directories.

## 📁 Folder Structure

```
inventory-service/
├── src/
│   ├── server.js              # Main Express app
│   ├── controllers/
│   │   └── inventoryController.js # Inventory logic
│   └── routes/
│       └── inventory.js       # API routes
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
│       ├── SerializedItem.js  # Serialized item model
│       ├── LifecycleEvent.js  # Lifecycle event model
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
- **IMPORTANT**: Set Root Directory to `services/inventory-service`

### 3. Configure Environment Variables
In Vercel Project Settings → Environment Variables, add:

```
PORT=3003
DB_HOST=aws-1-ap-northeast-1.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.xhqxjhxcvjbopjczqyld
DB_PASSWORD=Myownway17
MANDT=100
API_KEY=dev-api-key-12345
```

### 4. Build & Deploy Settings
- **Build Command**: `npm install` (default)
- **Start Command**: `node src/server.js`
- **Root Directory**: `services/inventory-service` ✅

### 5. Deploy
```bash
git add .
git commit -m "feat: Add Vercel deployment setup for inventory-service"
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
- `database/models/SerializedItem.js`
- `database/models/LifecycleEvent.js`
- `database/models/index.js`

### ✓ All Dependencies in package.json
- express-rate-limit ✓
- jimp ✓
- jsqr ✓
- quagga ✓
- All others ✓

## 🧪 Local Testing

```bash
cd services/inventory-service

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
curl http://localhost:3003/health

# Get inventory with filters
curl "http://localhost:3003/api/inventory?mandt=100&status=IN_STOCK" \
  -H "X-API-Key: dev-api-key-12345"

# Get products (for PO dropdown)
curl "http://localhost:3003/api/inventory/products?mandt=100" \
  -H "X-API-Key: dev-api-key-12345"

# Get goods receipts
curl "http://localhost:3003/api/goods-receipts?mandt=100" \
  -H "X-API-Key: dev-api-key-12345"

# Get available PO IDs for filtering
curl "http://localhost:3003/api/inventory/po-ids?mandt=100" \
  -H "X-API-Key: dev-api-key-12345"
```

## 🐛 Troubleshooting

### Error: Cannot find module
- Clear Vercel build cache: Dashboard → Settings → Advanced → Clear Build Cache
- Verify `package.json` has all dependencies
- Check Root Directory is set to `services/inventory-service`

### Error: Module not found error
- Ensure all imports use local paths (`../shared`, `../../database`)
- Check file paths match the new structure

### Database connection error
- Verify DB credentials in environment variables
- Check Supabase connection is accessible
- Confirm MANDT value matches your database

## 📝 Deployment Checklist

- [ ] Root Directory set to `services/inventory-service` in Vercel
- [ ] All environment variables configured
- [ ] Database credentials are correct
- [ ] Local testing passes before pushing
- [ ] Git push triggers Vercel deployment
- [ ] Health endpoint returns 200 OK

## 🎉 Success!

Once deployed, your Inventory Service will be available at:
```
https://your-project-name.vercel.app
```

Test with:
```bash
curl https://your-project-name.vercel.app/health
```

---

**Note**: This self-contained structure makes inventory-service completely independent. You can now deploy multiple services from the same repo to Vercel without issues!