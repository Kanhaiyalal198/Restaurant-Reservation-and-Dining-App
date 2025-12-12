# 🍽️ DelightDine - Restaurant Reservation & Dining App

A full-featured restaurant reservation and dining application built with Hono framework and Cloudflare D1 database.

## 🌐 Live URLs

- **Sandbox Development**: https://3000-imwaiosoccqqq5i6ht2kp-ad490db5.sandbox.novita.ai
- **Production**: (Deploy using `npm run deploy:prod`)

## ✨ Currently Completed Features

### ✅ User Authentication
- User registration with email/password
- Login/logout functionality
- User profile management
- Session persistence with localStorage

### ✅ Table Booking System
- Real-time table availability checking
- Date and time selection
- Guest count specification
- Table selection based on capacity and location
- Special requests/notes for bookings
- View booking history
- Cancel bookings
- Booking status management (pending, confirmed, completed, cancelled)

### ✅ Interactive Menu
- Menu categories (Appetizers, Main Course, Desserts, Beverages, Salads)
- 30+ menu items with descriptions and pricing
- Category filtering
- Vegetarian and spicy indicators
- Beautiful card-based layout with hover effects

### ✅ Shopping Cart
- Add items to cart
- Update quantities
- Remove items
- Real-time cart total calculation
- Cart persistence across sessions
- Cart badge with item count

### ✅ Order Management
- Create orders from cart
- Order type selection (dine-in/takeaway)
- Special instructions for orders
- Order history for users
- Order status tracking (pending, confirmed, preparing, ready, delivered)
- Admin order management

### ✅ Payment Integration
- Stripe payment integration (placeholder ready)
- Cash payment option
- Payment status tracking
- Secure payment processing
- Payment history

### ✅ Real-Time Notifications (Email/SMS/WhatsApp)
- Instant order confirmation via Email (SendGrid)
- SMS receipt delivery (Twilio)
- WhatsApp order status updates
- Automated receipt generation with order & booking details
- Multi-channel notification dispatch
- **[Setup Instructions: NOTIFICATIONS_SETUP.md](./NOTIFICATIONS_SETUP.md)**

### ✅ Real-Time Updates
- Bookings auto-refresh every 10 seconds on frontend
- Live order status polling
- Confirmed bookings show ordered items
- Cancelled bookings hide items
- Instant UI sync after payment

### ✅ Admin Features
- Dashboard with statistics
  - Today's bookings count
  - Total revenue
  - Pending orders count
  - Total customers
- View all bookings with user details
- Manage booking statuses
- View all orders
- Update order statuses

### ✅ UI/UX Features
- Responsive design (mobile, tablet, desktop)
- Modern gradient hero section
- Smooth scrolling navigation
- Modal-based forms
- Loading states and error handling
- Interactive cards with hover effects
- Icon-based navigation
- Beautiful color scheme (purple theme)

## 🎯 Functional Entry URIs

### Authentication APIs
- `POST /api/auth/register` - Register new user
  - Body: `{ email, password, name, phone }`
- `POST /api/auth/login` - Login user
  - Body: `{ email, password }`
- `GET /api/auth/profile/:userId` - Get user profile

### Table APIs
- `GET /api/tables` - Get all tables
- `GET /api/tables/available?date=YYYY-MM-DD&time=HH:MM&guests=N` - Check available tables

### Booking APIs
- `POST /api/bookings` - Create booking
  - Body: `{ userId, tableId, bookingDate, bookingTime, guestsCount, specialRequests }`
- `GET /api/bookings/user/:userId` - Get user's bookings
- `GET /api/bookings` - Get all bookings (admin)
- `PATCH /api/bookings/:id` - Update booking status
  - Body: `{ status }`
- `DELETE /api/bookings/:id` - Cancel booking

### Menu APIs
- `GET /api/menu/categories` - Get all categories
- `GET /api/menu/items?category=ID` - Get menu items (optionally filtered by category)
- `GET /api/menu/items/:id` - Get single menu item

### Order APIs
- `POST /api/orders` - Create order
  - Body: `{ userId, bookingId, items, totalAmount, orderType, specialInstructions }`
- `GET /api/orders/user/:userId` - Get user's orders
- `GET /api/orders` - Get all orders (admin)
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id` - Update order status
  - Body: `{ status, paymentStatus }`

### Payment APIs
- `POST /api/payment/process` - Process payment
  - Body: `{ orderId, amount, paymentMethod }`

### Dashboard APIs
- `GET /api/dashboard/stats` - Get dashboard statistics (admin)

## 📋 Features Not Yet Implemented

### Planned Enhancements
- [ ] Real Stripe API integration (currently using placeholder)
- [ ] Email notifications for bookings and orders
- [ ] SMS notifications
- [ ] Advanced admin dashboard with charts and analytics
- [ ] Table layout visualization
- [ ] Multi-language support
- [ ] Customer reviews and ratings
- [ ] Loyalty program/points system
- [ ] Reservation modifications (change date/time)
- [ ] Dietary restrictions filtering
- [ ] Image uploads for menu items
- [ ] QR code for table ordering
- [ ] Real-time order tracking
- [ ] Push notifications
- [ ] Social media integration
- [ ] Gift cards and vouchers
- [ ] Waitlist management

## 🚀 Recommended Next Steps

1. **Stripe Integration**
   - Set up Stripe account
   - Add Stripe API keys to Cloudflare secrets
   - Implement Stripe Checkout or Payment Intents API
   - Add webhook handling for payment confirmations

2. **Email Notifications**
   - Integrate SendGrid or similar service
   - Send booking confirmations
   - Send order status updates
   - Send payment receipts

3. **Admin Panel Enhancement**
   - Create dedicated admin dashboard page
   - Add charts for revenue and bookings (Chart.js)
   - Add table layout management
   - Add menu item management (CRUD operations)
   - Add user management

4. **User Experience Improvements**
   - Add profile page for users
   - Add order tracking page
   - Add booking modification feature
   - Add favorite items feature
   - Add re-order functionality

5. **Production Deployment**
   - Create Cloudflare D1 production database
   - Deploy to Cloudflare Pages
   - Set up custom domain
   - Configure environment variables

## 📊 Data Architecture

### Data Models

**Users**
- id, email, password, name, phone, role (customer/admin), created_at

**Restaurant Tables**
- id, table_number, capacity, status, location (indoor/outdoor/patio), created_at

**Bookings**
- id, user_id, table_id, booking_date, booking_time, guests_count, status, special_requests, created_at

**Menu Categories**
- id, name, description, display_order, created_at

**Menu Items**
- id, category_id, name, description, price, image_url, is_available, is_vegetarian, is_spicy, created_at

**Orders**
- id, user_id, booking_id, total_amount, status, payment_status, payment_method, stripe_payment_id, order_type, special_instructions, created_at

**Order Items**
- id, order_id, menu_item_id, quantity, price, special_notes, created_at

### Storage Services

- **Cloudflare D1 (SQLite)** - Primary relational database
  - User authentication and profiles
  - Table management
  - Booking records
  - Menu catalog
  - Order management
  - Payment records

## 📖 User Guide

### For Customers

1. **Register/Login**
   - Click "Login" button in navigation
   - Switch to "Register" tab if new user
   - Fill in your details and create account

2. **Browse Menu**
   - Scroll to "Our Menu" section
   - Filter by categories (All, Appetizers, Main Course, etc.)
   - Click "Add to Cart" on items you want

3. **Book a Table**
   - Scroll to "Book Your Table" section
   - Select date, time, and number of guests
   - Click "Check Availability" to see available tables
   - Select a table and add special requests if needed
   - Click "Confirm Booking"

4. **Place Order**
   - Click cart icon in navigation
   - Review your items and quantities
   - Click "Proceed to Checkout"
   - Select order type (Dine In or Takeaway)
   - Choose payment method (Stripe or Cash)
   - Click "Complete Payment"

5. **View Your Bookings**
   - Scroll to "My Bookings" section (visible after login)
   - View all your current and past bookings
   - Cancel bookings if needed

### For Admin

- Login with admin credentials
- Access dashboard stats via API: `/api/dashboard/stats`
- View all bookings: `/api/bookings`
- Manage orders: `/api/orders`
- Update booking/order statuses via API

### Test Credentials

- **Admin**: admin@restaurant.com / admin123
- **Customer**: john@example.com / customer123

## 🛠️ Tech Stack

- **Frontend**: HTML5, TailwindCSS, Vanilla JavaScript, Font Awesome
- **Backend**: Hono Framework (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Deployment**: Cloudflare Pages/Workers
- **HTTP Client**: Axios
- **Process Manager**: PM2 (development)

## 📦 Deployment

### Local Development

```bash
# Build project
npm run build

# Start with PM2
pm2 start ecosystem.config.cjs

# Test
curl http://localhost:3000/api/menu/categories
```

### Cloudflare Pages Production

```bash
# Setup Cloudflare API
# (Use setup_cloudflare_api_key tool)

# Create production D1 database
npx wrangler d1 create restaurant-db

# Update wrangler.jsonc with database ID

# Apply migrations to production
npx wrangler d1 migrations apply restaurant-db

# Seed production database
npx wrangler d1 execute restaurant-db --file=./seed.sql

# Deploy
npm run deploy:prod
```

## 📝 Deployment Status

- **Platform**: Cloudflare Pages
- **Status**: ✅ Active (Development)
- **Last Updated**: 2025-12-11

## 🎨 Color Theme

- Primary: Purple (#667eea to #764ba2)
- Success: Green
- Warning: Yellow
- Danger: Red
- Background: Gray-50
- Text: Gray-800

## 📄 License

MIT License - Feel free to use for your restaurant!

---

**Built with ❤️ using Hono + Cloudflare Edge Platform**
#   R e s t a u r a n t - R e s e r v a t i o n - a n d - D i n i n g - A p p  
 