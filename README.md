# ShipTrack Pro — Professional Courier & Logistics Platform

A production-ready Node.js / Express shipping management platform for Nigerian courier companies.

---

## Features

| Feature | Details |
|---------|---------|
| 🔐 Authentication | Login, sessions, bcrypt passwords, role-based access |
| 🗄️ MongoDB | Full persistent data with Mongoose models |
| 📲 SMS Notifications | Auto SMS via Termii (Nigerian gateway) on every status change |
| 📧 Email Notifications | Branded HTML emails via Nodemailer/Gmail |
| 📄 PDF Waybills | Professional waybill PDF generated per shipment |
| 💳 Paystack | Online delivery fee payment with webhook verification |
| 🛵 Courier Management | Add riders, assign to shipments, track status |
| 👥 Staff Roles | superadmin / admin / dispatcher / courier |
| 🔍 Public Tracking | Customer-facing page, no login needed |
| 🛡️ Security | helmet, rate limiting, httpOnly cookies, input validation |

---

## Quick Start

### 1. Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 2. Install
```bash
cd shiptrack-pro
npm install
```

### 3. Configure
```bash
cp .env.example .env
# Edit .env with your real values
```

Minimum required in `.env`:
```
MONGODB_URI=mongodb://localhost:27017/shiptrack
SESSION_SECRET=any-long-random-string
```

### 4. Run
```bash
npm run dev    # development (auto-reload)
npm start      # production
```

App runs at **http://localhost:3000**

### 5. First login
The first admin account is seeded automatically from your `.env`:
```
Email:    admin@yourcompany.com   (or ADMIN_EMAIL)
Password: Admin@1234              (or ADMIN_PASSWORD)
```
**Change this password immediately after first login.**

---

## Pages

| URL | Who | Description |
|-----|-----|-------------|
| `/` | Public | Homepage with tracking bar |
| `/track` | Public | Customer tracking page |
| `/auth/login` | Staff | Login page |
| `/admin` | Staff | Shipments dashboard |
| `/admin/couriers` | Admin+ | Courier/rider management |
| `/admin/users` | Admin+ | Staff account management |

---

## REST API

All `/api/*` routes require authentication (session cookie) **except** `/api/shipments/track/:trackingNumber`.

### Shipments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/shipments` | List (filter: status, priority, search, page) |
| GET | `/api/shipments/meta/stats` | Dashboard stats |
| GET | `/api/shipments/track/:tn` | **Public** — track by tracking number |
| GET | `/api/shipments/:id` | Full detail (admin) |
| POST | `/api/shipments` | Create shipment |
| PATCH | `/api/shipments/:id/status` | Update status + note + location |
| PATCH | `/api/shipments/:id/assign` | Assign courier |
| PATCH | `/api/shipments/:id/payment` | Mark payment (cash/transfer) |
| GET | `/api/shipments/:id/waybill` | Download PDF waybill |
| DELETE | `/api/shipments/:id` | Delete (admin only) |

### Couriers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/couriers` | List all couriers |
| POST | `/api/couriers` | Add courier |
| PATCH | `/api/couriers/:id` | Update courier |
| DELETE | `/api/couriers/:id` | Deactivate courier |
| GET | `/api/couriers/:id/shipments` | Courier's active jobs |

### Create Shipment — Body
```json
{
  "sender": {
    "name": "Acme Corp", "phone": "+234 800 000 0001",
    "email": "sender@company.com", "address": "14 Marina St",
    "city": "Lagos", "state": "Lagos"
  },
  "recipient": {
    "name": "Jane Doe", "phone": "+234 802 000 0002",
    "email": "jane@email.com", "address": "5 Adeola Odeku",
    "city": "Victoria Island", "state": "Lagos"
  },
  "description": "Electronics – MacBook Pro",
  "packageType": "Electronics",
  "priority": "Express",
  "weight": 2.5,
  "quantity": 1,
  "deliveryFee": 3500,
  "paymentMethod": "Cash",
  "notes": "Handle with care"
}
```

---

## SMS Setup (Termii)

1. Sign up at [termii.com](https://termii.com)
2. Get your API key from the dashboard
3. Add to `.env`:
```
TERMII_API_KEY=your-key-here
TERMII_SENDER_ID=YourBrand
```

> If no API key is set, SMS is skipped silently (won't break anything).

---

## Email Setup (Gmail)

1. Enable 2FA on Gmail
2. Create an [App Password](https://myaccount.google.com/apppasswords)
3. Add to `.env`:
```
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="ShipTrack <noreply@yourcompany.com>"
```

---

## Paystack Setup

1. Sign up at [paystack.com](https://paystack.com)
2. Get API keys from Settings → API Keys
3. Add to `.env`:
```
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
APP_URL=https://yourdomain.com   # for callback redirect
```

---

## Deployment

### Railway (Recommended — free tier)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
# Set env vars in Railway dashboard
```

### Render
1. Connect your GitHub repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Add all env vars in the dashboard

### VPS (Ubuntu)
```bash
# Install Node via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20

# Install PM2
npm install -g pm2

# Start app
pm2 start src/server.js --name shiptrack
pm2 save
pm2 startup

# Use Nginx as reverse proxy on port 80/443
```

---

## Project Structure

```
shiptrack-pro/
├── src/
│   ├── server.js              # Express entry point
│   ├── models/
│   │   ├── User.js            # Staff accounts
│   │   ├── Shipment.js        # Full shipment schema
│   │   ├── Courier.js         # Riders/drivers
│   │   └── Payment.js         # Paystack payment records
│   ├── routes/
│   │   ├── auth.js            # Login, logout, staff CRUD
│   │   ├── shipments.js       # Shipments API
│   │   ├── couriers.js        # Couriers API
│   │   └── payments.js        # Paystack initiate/verify
│   ├── middleware/
│   │   └── auth.js            # requireAuth, requireRole, attachUser
│   ├── services/
│   │   ├── notifications.js   # SMS + Email
│   │   ├── waybill.js         # PDF generation
│   │   └── paystack.js        # Paystack API calls
│   └── utils/
│       └── db.js              # MongoDB connect + seed
├── views/                     # HTML pages
├── public/
│   ├── css/style.css
│   └── js/layout.js           # Sidebar component
├── uploads/waybills/          # Generated PDFs (auto-created)
├── .env.example
└── package.json
```

---

## Customising for a Client

1. **Branding** — Update `COMPANY_NAME`, `COMPANY_ADDRESS` etc. in `.env`
2. **Logo** — Add logo to `public/img/logo.png` and reference in waybill.js
3. **Colours** — Edit CSS variables in `public/css/style.css` (`:root` block)
4. **Delivery fee formula** — Add auto-calculation in the create shipment form JS
5. **Zones/routes** — Extend the Courier model with route assignments

---

## Roles Reference

| Role | Permissions |
|------|-------------|
| `superadmin` | Full access — all CRUD, user management, delete shipments |
| `admin` | Create/edit shipments, manage couriers and staff |
| `dispatcher` | Create/update shipments, assign couriers |
| `courier` | View assigned shipments (extend API as needed) |
# ShipTrack
