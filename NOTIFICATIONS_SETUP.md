# Restaurant Booking & Ordering System — Notification Setup Guide

## Overview
This app sends real-time order confirmations and receipts via **Email**, **SMS**, and **WhatsApp** to customers immediately after payment.

## How It Works
1. **Order Created** → Notification sent to customer
2. **Payment Confirmed** → Real-time receipt dispatch
3. **Bookings Polled** → Every 10 seconds on the frontend for live updates

## Prerequisites for Real Notifications

### 1. Email Notifications (SendGrid)

**Get your SendGrid API key:**
1. Go to [SendGrid console](https://app.sendgrid.com)
2. Sign up or log in
3. Navigate to **Settings** → **API Keys**
4. Create a new "Full Access" API key
5. Copy the key

**Set environment variables for local dev:**
Create a `.env.local` file in the project root:
```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxx_your_key_here
SENDGRID_FROM_EMAIL=noreply@yourrestaurant.com
SENDGRID_FROM_NAME=Your Restaurant Name
```

### 2. SMS & WhatsApp Notifications (Twilio)

**Get your Twilio credentials:**
1. Go to [Twilio Console](https://www.twilio.com/console)
2. Sign up or log in
3. Find your **Account SID** and **Auth Token** on the dashboard
4. Buy a phone number or use the [Twilio Sandbox](https://www.twilio.com/docs/whatsapp/quickstart)
5. Copy credentials

**Set environment variables for local dev:**
Add to `.env.local`:
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

**For WhatsApp:**
- Use a Twilio WhatsApp-enabled number, OR
- Use the [Twilio WhatsApp Sandbox](https://www.twilio.com/docs/whatsapp/api/quickstart) for testing
- Sandbox requires customer opt-in via text "join <code>"

---

## Local Development Setup

### Step 1: Copy Example Env
```bash
cp .env.example .env.local
```

### Step 2: Fill in Your Credentials
Edit `.env.local` with your real API keys:
```env
SENDGRID_API_KEY=SG.xxxx...
SENDGRID_FROM_EMAIL=orders@yourrestaurant.com
SENDGRID_FROM_NAME=My Restaurant

TWILIO_ACCOUNT_SID=ACxxxx...
TWILIO_AUTH_TOKEN=xxxx...
TWILIO_PHONE_NUMBER=+1234567890
```

### Step 3: Start Dev Server
```bash
npm run dev
```

### Step 4: Test the Flow
1. Open browser: `http://localhost:5173`
2. Register a new account with a **real phone number** and **email**
3. Book a table for tomorrow
4. Add food items to cart
5. Checkout and pay

**You should receive:**
- 📧 Email receipt within 10 seconds
- 💬 SMS confirmation to your phone
- 📱 WhatsApp message (if Twilio WhatsApp configured)

---

## Run Automated E2E Test

```bash
node scripts/e2e_test.mjs
```

Expected output:
```
Using base URL: http://localhost:5173
Fetching menu items...
Registered user e2e+xxxxx@example.com
Logged in user id 5
Using table: T02
Creating booking 2025-12-12 19:00:00
Booking created: 12
Order created: 10
Payment status: succeeded
E2E test passed ✅
```

---

## Troubleshooting

### Not receiving emails?
- Check `.env.local` has correct `SENDGRID_API_KEY`
- Verify `SENDGRID_FROM_EMAIL` is authorized in SendGrid
- Check browser console for errors
- Check server logs for "SendGrid email failed"

### Not receiving SMS/WhatsApp?
- Confirm `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` are correct
- Verify Twilio account has funds/credits
- For WhatsApp Sandbox: customer must text "join <code>" first
- Check server logs for "Twilio SMS failed"

### Real-time updates not showing?
- Polling refreshes bookings every **10 seconds**
- Check browser DevTools → Network tab → `/api/bookings/user/:userId`
- Orders appear only in **CONFIRMED** bookings, not cancelled ones

---

## Production Deployment (Cloudflare Workers)

When deploying to Cloudflare Workers with Wrangler, add env vars to `wrangler.jsonc`:

```jsonc
{
  "env": {
    "production": {
      "vars": {
        "SENDGRID_API_KEY": "SG.xxxx...",
        "SENDGRID_FROM_EMAIL": "orders@yourrestaurant.com",
        "SENDGRID_FROM_NAME": "Your Restaurant",
        "TWILIO_ACCOUNT_SID": "ACxxxx...",
        "TWILIO_AUTH_TOKEN": "xxxx...",
        "TWILIO_PHONE_NUMBER": "+1234567890"
      }
    }
  }
}
```

Then deploy:
```bash
npm run deploy:prod
```

---

## Features Implemented

✅ **Booking confirmations** — Instant email/SMS/WhatsApp  
✅ **Order receipts** — Detailed order + booking details  
✅ **Payment confirmations** — Real-time status updates  
✅ **Real-time polling** — Bookings refresh every 10s  
✅ **Multi-channel notifications** — Email, SMS, WhatsApp  
✅ **Automated E2E tests** — Verify full flow  

---

## Support

For issues or questions:
- SendGrid docs: https://docs.sendgrid.com
- Twilio docs: https://www.twilio.com/docs
- Twilio WhatsApp: https://www.twilio.com/docs/whatsapp

---

**Happy serving!** 🍽️
