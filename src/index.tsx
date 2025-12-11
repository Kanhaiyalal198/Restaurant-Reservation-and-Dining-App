import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// ============= AUTHENTICATION ROUTES =============

// Register new user
app.post('/api/auth/register', async (c) => {
  try {
    const { email, password, name, phone } = await c.req.json()
    
    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400)
    }

    // Simple password hashing (in production, use bcrypt)
    const hashedPassword = `hashed_${password}`

    const result = await c.env.DB.prepare(`
      INSERT INTO users (email, password, name, phone, role)
      VALUES (?, ?, ?, ?, 'customer')
    `).bind(email, hashedPassword, name, phone || null).run()

    return c.json({ 
      success: true, 
      userId: result.meta.last_row_id,
      message: 'User registered successfully' 
    })
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Email already exists' }, 409)
    }
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// Login user
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400)
    }

    const hashedPassword = `hashed_${password}`

    const user = await c.env.DB.prepare(`
      SELECT id, email, name, phone, role FROM users 
      WHERE email = ? AND password = ?
    `).bind(email, hashedPassword).first()

    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    return c.json({ 
      success: true, 
      user,
      message: 'Login successful' 
    })
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500)
  }
})

// Get user profile
app.get('/api/auth/profile/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')

    const user = await c.env.DB.prepare(`
      SELECT id, email, name, phone, role, created_at FROM users WHERE id = ?
    `).bind(userId).first()

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    return c.json(user)
  } catch (error) {
    return c.json({ error: 'Failed to fetch user profile' }, 500)
  }
})

// ============= TABLE ROUTES =============

// Get all tables
app.get('/api/tables', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM restaurant_tables ORDER BY table_number
    `).all()

    return c.json(results)
  } catch (error) {
    return c.json({ error: 'Failed to fetch tables' }, 500)
  }
})

// Get available tables for specific date and time
app.get('/api/tables/available', async (c) => {
  try {
    const date = c.req.query('date')
    const time = c.req.query('time')
    const guests = c.req.query('guests')

    if (!date || !time) {
      return c.json({ error: 'Date and time are required' }, 400)
    }

    // Get tables that are not booked for the specified date/time
    const { results } = await c.env.DB.prepare(`
      SELECT t.* FROM restaurant_tables t
      WHERE t.capacity >= ?
      AND t.id NOT IN (
        SELECT table_id FROM bookings 
        WHERE booking_date = ? 
        AND booking_time = ?
        AND status IN ('pending', 'confirmed')
      )
      ORDER BY t.capacity, t.table_number
    `).bind(guests || 1, date, time).all()

    return c.json(results)
  } catch (error) {
    return c.json({ error: 'Failed to fetch available tables' }, 500)
  }
})

// ============= BOOKING ROUTES =============

// Create new booking
app.post('/api/bookings', async (c) => {
  try {
    const { userId, tableId, bookingDate, bookingTime, guestsCount, specialRequests } = await c.req.json()

    if (!userId || !tableId || !bookingDate || !bookingTime || !guestsCount) {
      return c.json({ error: 'All booking details are required' }, 400)
    }

    // Check if table is available
    const existing = await c.env.DB.prepare(`
      SELECT id FROM bookings 
      WHERE table_id = ? 
      AND booking_date = ? 
      AND booking_time = ?
      AND status IN ('pending', 'confirmed')
    `).bind(tableId, bookingDate, bookingTime).first()

    if (existing) {
      return c.json({ error: 'Table is already booked for this time slot' }, 409)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO bookings (user_id, table_id, booking_date, booking_time, guests_count, special_requests, status)
      VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
    `).bind(userId, tableId, bookingDate, bookingTime, guestsCount, specialRequests || null).run()

    return c.json({ 
      success: true, 
      bookingId: result.meta.last_row_id,
      message: 'Booking created successfully' 
    })
  } catch (error) {
    return c.json({ error: 'Failed to create booking' }, 500)
  }
})

// Get user bookings
app.get('/api/bookings/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')

    const { results } = await c.env.DB.prepare(`
      SELECT b.*, t.table_number, t.capacity, t.location
      FROM bookings b
      JOIN restaurant_tables t ON b.table_id = t.id
      WHERE b.user_id = ?
      ORDER BY b.booking_date DESC, b.booking_time DESC
    `).bind(userId).all()

    return c.json(results)
  } catch (error) {
    return c.json({ error: 'Failed to fetch bookings' }, 500)
  }
})

// Get all bookings (admin)
app.get('/api/bookings', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT b.*, u.name as user_name, u.email, u.phone, t.table_number, t.capacity, t.location
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN restaurant_tables t ON b.table_id = t.id
      ORDER BY b.booking_date DESC, b.booking_time DESC
    `).all()

    return c.json(results)
  } catch (error) {
    return c.json({ error: 'Failed to fetch bookings' }, 500)
  }
})

// Update booking status
app.patch('/api/bookings/:id', async (c) => {
  try {
    const bookingId = c.req.param('id')
    const { status } = await c.req.json()

    await c.env.DB.prepare(`
      UPDATE bookings SET status = ? WHERE id = ?
    `).bind(status, bookingId).run()

    return c.json({ success: true, message: 'Booking updated successfully' })
  } catch (error) {
    return c.json({ error: 'Failed to update booking' }, 500)
  }
})

// Cancel booking
app.delete('/api/bookings/:id', async (c) => {
  try {
    const bookingId = c.req.param('id')

    await c.env.DB.prepare(`
      UPDATE bookings SET status = 'cancelled' WHERE id = ?
    `).bind(bookingId).run()

    return c.json({ success: true, message: 'Booking cancelled successfully' })
  } catch (error) {
    return c.json({ error: 'Failed to cancel booking' }, 500)
  }
})

// ============= MENU ROUTES =============

// Get all menu categories
app.get('/api/menu/categories', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM menu_categories ORDER BY display_order, name
    `).all()

    return c.json(results)
  } catch (error) {
    return c.json({ error: 'Failed to fetch categories' }, 500)
  }
})

// Get menu items by category
app.get('/api/menu/items', async (c) => {
  try {
    const categoryId = c.req.query('category')

    let query = `
      SELECT m.*, c.name as category_name
      FROM menu_items m
      JOIN menu_categories c ON m.category_id = c.id
      WHERE m.is_available = 1
    `

    if (categoryId) {
      query += ` AND m.category_id = ${categoryId}`
    }

    query += ` ORDER BY c.display_order, m.name`

    const { results } = await c.env.DB.prepare(query).all()

    return c.json(results)
  } catch (error) {
    return c.json({ error: 'Failed to fetch menu items' }, 500)
  }
})

// Get single menu item
app.get('/api/menu/items/:id', async (c) => {
  try {
    const itemId = c.req.param('id')

    const item = await c.env.DB.prepare(`
      SELECT m.*, c.name as category_name
      FROM menu_items m
      JOIN menu_categories c ON m.category_id = c.id
      WHERE m.id = ?
    `).bind(itemId).first()

    if (!item) {
      return c.json({ error: 'Menu item not found' }, 404)
    }

    return c.json(item)
  } catch (error) {
    return c.json({ error: 'Failed to fetch menu item' }, 500)
  }
})

// ============= ORDER ROUTES =============

// Create new order
app.post('/api/orders', async (c) => {
  try {
    const { userId, bookingId, items, totalAmount, orderType, specialInstructions } = await c.req.json()

    if (!userId || !items || items.length === 0 || !totalAmount) {
      return c.json({ error: 'User, items, and total amount are required' }, 400)
    }

    // Create order
    const orderResult = await c.env.DB.prepare(`
      INSERT INTO orders (user_id, booking_id, total_amount, order_type, special_instructions, status, payment_status)
      VALUES (?, ?, ?, ?, ?, 'pending', 'pending')
    `).bind(userId, bookingId || null, totalAmount, orderType || 'dine-in', specialInstructions || null).run()

    const orderId = orderResult.meta.last_row_id

    // Insert order items
    for (const item of items) {
      await c.env.DB.prepare(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, price, special_notes)
        VALUES (?, ?, ?, ?, ?)
      `).bind(orderId, item.menuItemId, item.quantity, item.price, item.specialNotes || null).run()
    }

    return c.json({ 
      success: true, 
      orderId,
      message: 'Order created successfully' 
    })
  } catch (error) {
    return c.json({ error: 'Failed to create order' }, 500)
  }
})

// Get user orders
app.get('/api/orders/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')

    const { results } = await c.env.DB.prepare(`
      SELECT o.*, b.booking_date, b.booking_time
      FROM orders o
      LEFT JOIN bookings b ON o.booking_id = b.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).bind(userId).all()

    // Get order items for each order
    for (const order of results) {
      const { results: items } = await c.env.DB.prepare(`
        SELECT oi.*, m.name, m.description
        FROM order_items oi
        JOIN menu_items m ON oi.menu_item_id = m.id
        WHERE oi.order_id = ?
      `).bind(order.id).all()
      
      order.items = items
    }

    return c.json(results)
  } catch (error) {
    return c.json({ error: 'Failed to fetch orders' }, 500)
  }
})

// Get all orders (admin)
app.get('/api/orders', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT o.*, u.name as user_name, u.email, b.booking_date, b.booking_time
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN bookings b ON o.booking_id = b.id
      ORDER BY o.created_at DESC
    `).all()

    return c.json(results)
  } catch (error) {
    return c.json({ error: 'Failed to fetch orders' }, 500)
  }
})

// Get single order details
app.get('/api/orders/:id', async (c) => {
  try {
    const orderId = c.req.param('id')

    const order = await c.env.DB.prepare(`
      SELECT o.*, u.name as user_name, u.email, u.phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).bind(orderId).first()

    if (!order) {
      return c.json({ error: 'Order not found' }, 404)
    }

    // Get order items
    const { results: items } = await c.env.DB.prepare(`
      SELECT oi.*, m.name, m.description
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      WHERE oi.order_id = ?
    `).bind(orderId).all()

    order.items = items

    return c.json(order)
  } catch (error) {
    return c.json({ error: 'Failed to fetch order details' }, 500)
  }
})

// Update order status
app.patch('/api/orders/:id', async (c) => {
  try {
    const orderId = c.req.param('id')
    const { status, paymentStatus } = await c.req.json()

    let query = 'UPDATE orders SET '
    const params = []

    if (status) {
      query += 'status = ?'
      params.push(status)
    }

    if (paymentStatus) {
      if (params.length > 0) query += ', '
      query += 'payment_status = ?'
      params.push(paymentStatus)
    }

    query += ' WHERE id = ?'
    params.push(orderId)

    await c.env.DB.prepare(query).bind(...params).run()

    return c.json({ success: true, message: 'Order updated successfully' })
  } catch (error) {
    return c.json({ error: 'Failed to update order' }, 500)
  }
})

// ============= PAYMENT ROUTES =============

// Process payment (Stripe integration placeholder)
app.post('/api/payment/process', async (c) => {
  try {
    const { orderId, amount, paymentMethod } = await c.req.json()

    if (!orderId || !amount) {
      return c.json({ error: 'Order ID and amount are required' }, 400)
    }

    // In production, integrate with Stripe API here
    // For now, simulate successful payment
    const paymentId = `pi_${Date.now()}_${Math.random().toString(36).substring(7)}`

    await c.env.DB.prepare(`
      UPDATE orders 
      SET payment_status = 'paid', 
          payment_method = ?,
          stripe_payment_id = ?
      WHERE id = ?
    `).bind(paymentMethod || 'stripe', paymentId, orderId).run()

    return c.json({ 
      success: true, 
      paymentId,
      message: 'Payment processed successfully' 
    })
  } catch (error) {
    return c.json({ error: 'Payment processing failed' }, 500)
  }
})

// ============= DASHBOARD/STATS ROUTES =============

// Get dashboard stats (admin)
app.get('/api/dashboard/stats', async (c) => {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Total bookings today
    const todayBookings = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE booking_date = ? AND status = 'confirmed'
    `).bind(today).first()

    // Total revenue
    const revenue = await c.env.DB.prepare(`
      SELECT SUM(total_amount) as total FROM orders 
      WHERE payment_status = 'paid'
    `).first()

    // Pending orders
    const pendingOrders = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM orders 
      WHERE status IN ('pending', 'confirmed', 'preparing')
    `).first()

    // Total customers
    const customers = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM users WHERE role = 'customer'
    `).first()

    return c.json({
      todayBookings: todayBookings?.count || 0,
      totalRevenue: revenue?.total || 0,
      pendingOrders: pendingOrders?.count || 0,
      totalCustomers: customers?.count || 0
    })
  } catch (error) {
    return c.json({ error: 'Failed to fetch dashboard stats' }, 500)
  }
})

// ============= FRONTEND ROUTE =============

app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Restaurant Reservation & Dining</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        .hero-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .card-hover:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }
        .menu-item-card {
            transition: all 0.3s ease;
        }
        .menu-item-card:hover {
            transform: scale(1.05);
        }
        .modal {
            display: none;
        }
        .modal.active {
            display: flex;
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-lg sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <i class="fas fa-utensils text-purple-600 text-2xl mr-2"></i>
                    <span class="text-2xl font-bold text-gray-800">DelightDine</span>
                </div>
                <div class="flex items-center space-x-4">
                    <a href="#home" class="nav-link text-gray-600 hover:text-purple-600 px-3 py-2">Home</a>
                    <a href="#menu" class="nav-link text-gray-600 hover:text-purple-600 px-3 py-2">Menu</a>
                    <a href="#booking" class="nav-link text-gray-600 hover:text-purple-600 px-3 py-2">Book Table</a>
                    <button id="cartBtn" class="relative text-gray-600 hover:text-purple-600">
                        <i class="fas fa-shopping-cart text-xl"></i>
                        <span id="cartCount" class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">0</span>
                    </button>
                    <button id="loginBtn" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700">
                        <i class="fas fa-user mr-2"></i>Login
                    </button>
                    <button id="logoutBtn" class="hidden bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
                        <i class="fas fa-sign-out-alt mr-2"></i>Logout
                    </button>
                    <span id="userName" class="hidden text-gray-700 font-medium"></span>
                </div>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section id="home" class="hero-bg text-white py-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 class="text-5xl font-bold mb-4">Welcome to DelightDine</h1>
            <p class="text-xl mb-8">Experience culinary excellence with seamless table reservations</p>
            <div class="flex justify-center space-x-4">
                <a href="#booking" class="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100">
                    <i class="fas fa-calendar-alt mr-2"></i>Book a Table
                </a>
                <a href="#menu" class="bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-800">
                    <i class="fas fa-utensils mr-2"></i>View Menu
                </a>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="py-16 bg-white">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 class="text-3xl font-bold text-center mb-12">Why Choose Us</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="text-center card-hover p-6 rounded-lg bg-gray-50">
                    <i class="fas fa-clock text-purple-600 text-5xl mb-4"></i>
                    <h3 class="text-xl font-semibold mb-2">Easy Booking</h3>
                    <p class="text-gray-600">Reserve your table in seconds with our simple booking system</p>
                </div>
                <div class="text-center card-hover p-6 rounded-lg bg-gray-50">
                    <i class="fas fa-award text-purple-600 text-5xl mb-4"></i>
                    <h3 class="text-xl font-semibold mb-2">Quality Food</h3>
                    <p class="text-gray-600">Enjoy delicious meals prepared by our expert chefs</p>
                </div>
                <div class="text-center card-hover p-6 rounded-lg bg-gray-50">
                    <i class="fas fa-credit-card text-purple-600 text-5xl mb-4"></i>
                    <h3 class="text-xl font-semibold mb-2">Secure Payment</h3>
                    <p class="text-gray-600">Safe and secure online payment options</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Menu Section -->
    <section id="menu" class="py-16 bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 class="text-3xl font-bold text-center mb-8">Our Menu</h2>
            
            <!-- Category Filter -->
            <div class="flex justify-center space-x-4 mb-8 overflow-x-auto">
                <button class="category-btn bg-purple-600 text-white px-6 py-2 rounded-lg" data-category="all">
                    All Items
                </button>
                <div id="categoryButtons"></div>
            </div>

            <!-- Menu Grid -->
            <div id="menuGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Menu items will be loaded here -->
            </div>
        </div>
    </section>

    <!-- Booking Section -->
    <section id="booking" class="py-16 bg-white">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 class="text-3xl font-bold text-center mb-8">Book Your Table</h2>
            <div class="bg-gray-50 p-8 rounded-lg shadow-lg">
                <form id="bookingForm">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-gray-700 font-medium mb-2">Date</label>
                            <input type="date" id="bookingDate" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required>
                        </div>
                        <div>
                            <label class="block text-gray-700 font-medium mb-2">Time</label>
                            <input type="time" id="bookingTime" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required>
                        </div>
                        <div>
                            <label class="block text-gray-700 font-medium mb-2">Number of Guests</label>
                            <input type="number" id="guestsCount" min="1" max="20" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required>
                        </div>
                        <div>
                            <label class="block text-gray-700 font-medium mb-2">Select Table</label>
                            <select id="tableSelect" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required>
                                <option value="">Check availability first</option>
                            </select>
                        </div>
                    </div>
                    <div class="mt-6">
                        <label class="block text-gray-700 font-medium mb-2">Special Requests</label>
                        <textarea id="specialRequests" rows="3" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="Any special requirements..."></textarea>
                    </div>
                    <div class="mt-6 flex space-x-4">
                        <button type="button" id="checkAvailabilityBtn" class="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700">
                            <i class="fas fa-search mr-2"></i>Check Availability
                        </button>
                        <button type="submit" class="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700">
                            <i class="fas fa-check mr-2"></i>Confirm Booking
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </section>

    <!-- My Bookings Section -->
    <section id="myBookings" class="py-16 bg-gray-50 hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 class="text-3xl font-bold text-center mb-8">My Bookings</h2>
            <div id="bookingsGrid" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Bookings will be loaded here -->
            </div>
        </div>
    </section>

    <!-- Login Modal -->
    <div id="loginModal" class="modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50">
        <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Login / Register</h2>
                <button id="closeLoginModal" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            
            <div class="mb-4">
                <div class="flex space-x-2">
                    <button id="loginTab" class="flex-1 py-2 font-semibold border-b-2 border-purple-600 text-purple-600">Login</button>
                    <button id="registerTab" class="flex-1 py-2 font-semibold text-gray-500">Register</button>
                </div>
            </div>

            <!-- Login Form -->
            <form id="loginForm" class="space-y-4">
                <div>
                    <input type="email" id="loginEmail" placeholder="Email" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required>
                </div>
                <div>
                    <input type="password" id="loginPassword" placeholder="Password" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required>
                </div>
                <button type="submit" class="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700">
                    Login
                </button>
            </form>

            <!-- Register Form -->
            <form id="registerForm" class="space-y-4 hidden">
                <div>
                    <input type="text" id="registerName" placeholder="Full Name" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required>
                </div>
                <div>
                    <input type="email" id="registerEmail" placeholder="Email" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required>
                </div>
                <div>
                    <input type="tel" id="registerPhone" placeholder="Phone Number" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                </div>
                <div>
                    <input type="password" id="registerPassword" placeholder="Password" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required>
                </div>
                <button type="submit" class="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700">
                    Register
                </button>
            </form>
        </div>
    </div>

    <!-- Cart Modal -->
    <div id="cartModal" class="modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50">
        <div class="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Your Cart</h2>
                <button id="closeCartModal" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            <div id="cartItems" class="space-y-4 mb-6">
                <!-- Cart items will be loaded here -->
            </div>
            <div class="border-t pt-4">
                <div class="flex justify-between text-xl font-bold mb-4">
                    <span>Total:</span>
                    <span id="cartTotal">$0.00</span>
                </div>
                <button id="checkoutBtn" class="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700">
                    <i class="fas fa-credit-card mr-2"></i>Proceed to Checkout
                </button>
            </div>
        </div>
    </div>

    <!-- Checkout Modal -->
    <div id="checkoutModal" class="modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50">
        <div class="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Checkout</h2>
                <button id="closeCheckoutModal" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            <div class="mb-6">
                <p class="text-gray-600 mb-2">Total Amount:</p>
                <p class="text-3xl font-bold text-purple-600" id="checkoutTotal">$0.00</p>
            </div>
            <form id="paymentForm">
                <div class="mb-4">
                    <label class="block text-gray-700 font-medium mb-2">Order Type</label>
                    <select id="orderType" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                        <option value="dine-in">Dine In</option>
                        <option value="takeaway">Takeaway</option>
                    </select>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-medium mb-2">Special Instructions</label>
                    <textarea id="orderInstructions" rows="3" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="Any special requests..."></textarea>
                </div>
                <div class="mb-6">
                    <label class="block text-gray-700 font-medium mb-2">Payment Method</label>
                    <div class="space-y-2">
                        <label class="flex items-center">
                            <input type="radio" name="paymentMethod" value="stripe" checked class="mr-2">
                            <i class="fab fa-cc-stripe text-2xl mr-2"></i>
                            <span>Stripe (Card Payment)</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="paymentMethod" value="cash" class="mr-2">
                            <i class="fas fa-money-bill-wave text-2xl mr-2"></i>
                            <span>Cash on Arrival</span>
                        </label>
                    </div>
                </div>
                <button type="submit" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">
                    <i class="fas fa-lock mr-2"></i>Complete Payment
                </button>
            </form>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script src="/static/app.js"></script>
</body>
</html>
  `)
})

export default app
