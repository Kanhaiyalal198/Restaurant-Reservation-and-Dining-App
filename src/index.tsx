import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

// Import type for D1Database if available
// @ts-ignore-next-line: Ignore until types are available for D1Database
type D1Database = any;

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>();

// In-memory notification log for local testing (stores last 100 notifications)
const notificationLog: any[] = []
const MAX_LOG_SIZE = 100

function logNotification(event: any) {
  notificationLog.unshift(event)
  if (notificationLog.length > MAX_LOG_SIZE) {
    notificationLog.pop()
  }
}

// Integrate real email/SMS/WhatsApp providers when credentials are available.
// This implementation uses SendGrid for email and Twilio for SMS/WhatsApp via their REST APIs.
async function sendReceipt(user: { email?: string; phone?: string; whatsapp?: string; name?: string }, payload: any) {
  const recipient = user || {}
  const channelsUsed: any = {}

  // Build a simple plain-text receipt body
  const buildBody = () => {
    let body = ''
    body += `Receipt for ${recipient.name || 'Customer'}\n`;
    body += `Type: ${payload.type || 'receipt'}\n`;
    if (payload.orderId) body += `Order ID: ${payload.orderId}\n`;
    if (payload.bookingId) body += `Booking ID: ${payload.bookingId}\n`;
    if (payload.amount) body += `Amount: ${payload.amount} ${payload.currency || ''}\n`;
    if (payload.items && Array.isArray(payload.items)) {
      body += `Items:\n`
      for (const it of payload.items) {
        body += ` - ${it.name || it.menuItemId} x${it.quantity || 1} = ${it.price || ''}\n`
      }
    }
    body += `\nThanks for your order!`
    return body
  }

  const bodyText = buildBody()

  // Send Email via SendGrid if key available
  const SENDGRID_KEY = typeof process !== 'undefined' ? (process.env.SENDGRID_API_KEY as string) : undefined
  if (SENDGRID_KEY && recipient.email) {
    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SENDGRID_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipient.email }], subject: `Your receipt${payload.orderId ? ` - ${payload.orderId}` : ''}` }],
          from: { email: process.env.SENDGRID_FROM_EMAIL || 'no-reply@example.com', name: process.env.SENDGRID_FROM_NAME || 'Restaurant' },
          content: [{ type: 'text/plain', value: bodyText }]
        })
      })
      channelsUsed.email = 'sent'
    } catch (e) {
      console.error('SendGrid email failed', e)
      channelsUsed.email = 'failed'
    }
  } else {
    channelsUsed.email = recipient.email ? 'ready (no-sendgrid-key)' : 'no-email'
  }

  // Send SMS / WhatsApp via Twilio if credentials available
  const TW_SID = typeof process !== 'undefined' ? (process.env.TWILIO_ACCOUNT_SID as string) : undefined
  const TW_TOKEN = typeof process !== 'undefined' ? (process.env.TWILIO_AUTH_TOKEN as string) : undefined
  const TW_FROM = typeof process !== 'undefined' ? (process.env.TWILIO_PHONE_NUMBER as string) : undefined

  if (TW_SID && TW_TOKEN && TW_FROM) {
    const basicAuth = Buffer.from(`${TW_SID}:${TW_TOKEN}`).toString('base64')
    // Send SMS
    if (recipient.phone) {
      try {
        const form = new URLSearchParams()
        form.append('To', recipient.phone)
        form.append('From', TW_FROM)
        form.append('Body', bodyText)

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: form.toString()
        })
        channelsUsed.sms = 'sent'
      } catch (e) {
        console.error('Twilio SMS failed', e)
        channelsUsed.sms = 'failed'
      }
    } else {
      channelsUsed.sms = 'no-phone'
    }

    // Send WhatsApp via Twilio (if whatsapp number provided)
    if (recipient.whatsapp) {
      try {
        const form = new URLSearchParams()
        form.append('To', `whatsapp:${recipient.whatsapp}`)
        form.append('From', `whatsapp:${TW_FROM}`)
        form.append('Body', bodyText)

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: form.toString()
        })
        channelsUsed.whatsapp = 'sent'
      } catch (e) {
        console.error('Twilio WhatsApp failed', e)
        channelsUsed.whatsapp = 'failed'
      }
    } else {
      channelsUsed.whatsapp = 'ready (no-whatsapp-key)'
    }
  } else {
    channelsUsed.sms = 'ready (no-twilio-config)'
    channelsUsed.whatsapp = 'ready (no-twilio-config)'
  }

  // Log notification for local testing/debugging
  const event = {
    timestamp: new Date().toISOString(),
    to: recipient,
    type: payload.type,
    orderId: payload.orderId,
    bookingId: payload.bookingId,
    channels: channelsUsed,
    bodyPreview: bodyText.substring(0, 100)
  }
    logNotification(event);
    console.log('Receipt dispatch', event);
  console.log('Receipt dispatch', event)
}


// Enable CORS
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({
  root: './public',
  manifest: ''
}))

// ============= NOTIFICATION DEBUG ROUTES =============

// View notification log (for local testing/debugging)
app.get('/api/notifications/log', (c) => {
  return c.json({
    message: 'Notification log (last 100 events)',
    count: notificationLog.length,
    notifications: notificationLog
  })
})

// Clear notification log
app.post('/api/notifications/log/clear', (c) => {
  notificationLog.length = 0
  return c.json({ message: 'Notification log cleared' })
})

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
    if (typeof console !== 'undefined' && console.error) {
      console.error('Login failed', error);
    }
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
    if (typeof console !== 'undefined' && console.error) {
      console.error('Login failed', error);
    }
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

    // Return all available tables (not booked for the specified date/time).
    // Client will compute suitable single-table or multi-table combinations as needed.
    const { results } = await c.env.DB.prepare(`
      SELECT t.* FROM restaurant_tables t
      WHERE t.id NOT IN (
        SELECT table_id FROM bookings 
        WHERE booking_date = ? 
        AND booking_time = ?
        AND status IN ('pending', 'confirmed')
      )
      ORDER BY t.table_number
    `).bind(date, time).all()

    return c.json(results)
  } catch (error) {
    return c.json({ error: 'Failed to fetch available tables' }, 500)
  }
})

// Suggest table combinations based on desired guest count (1-16)
app.get('/api/tables/suggest-combos', async (c) => {
  try {
    const date = c.req.query('date')
    const time = c.req.query('time')
    const guestsRaw = c.req.query('guests') || '2'
    const guests = Math.max(1, Math.min(16, parseInt(guestsRaw)))

    // Fetch available tables depending on whether a slot is specified
    let { results: availableTables } = { results: [] as any[] }
    if (date && time) {
      const q = await c.env.DB.prepare(`
        SELECT t.* FROM restaurant_tables t
        WHERE t.id NOT IN (
          SELECT table_id FROM bookings 
          WHERE booking_date = ? 
          AND booking_time = ?
          AND status IN ('pending', 'confirmed')
        )
        ORDER BY t.table_number
      `).bind(date, time).all()
      availableTables = q.results || []
    } else {
      const q = await c.env.DB.prepare(`SELECT * FROM restaurant_tables ORDER BY table_number`).all()
      availableTables = q.results || []
    }

    // Preferred mapping for 1..16 guests (ordered preference lists)
    const mapping: Record<number, number[][]> = {
      1: [[2]],
      2: [[2]],
      3: [[4]],
      4: [[2,2],[4]],
      5: [[4,2],[6]],
      6: [[4,2],[6]],
      7: [[4,4],[6,2],[8]],
      8: [[4,4],[6,2],[8]],
      9: [[4,4,2],[6,4],[8,2],[10]],
      10: [[6,4],[4,4,2],[10]],
      11: [[6,4,2],[8,4],[10,2]],
      12: [[6,6],[4,4,4],[8,4],[10,2]],
      13: [[6,4,4],[8,4,2],[10,4]],
      14: [[6,4,4],[8,6],[10,4]],
      15: [[10,4,2],[8,4,4],[6,4,4,2],[8,6,2]],
      16: [[4,4,4,4],[8,8],[10,6],[8,4,4]]
    }

    const prefs = mapping[guests] || []

    // Helper: try to materialize a pattern (array of capacities) into actual tables
    function tryPattern(pattern: number[]) {
      const used: any[] = []
      const pool = availableTables.slice().sort((a,b) => a.table_number - b.table_number)
      for (const cap of pattern) {
        const idx = pool.findIndex(t => t.capacity === cap && !used.includes(t.id))
        if (idx === -1) return null
        const table = pool[idx]
        used.push(table.id)
        // mark removed
        pool.splice(idx,1)
      }
      // return full table objects for used ids
      return availableTables.filter(t => used.includes(t.id))
    }

    const combos: any[] = []
    for (const p of prefs) {
      const pat = p.slice() // copy
      const res = tryPattern(pat)
      if (res) {
        combos.push({ tables: res, total: res.reduce((s:any,t:any)=>s+(t.capacity||0),0) })
      }
    }

    return c.json({ guests, combos, availableTables })
  } catch (error) {
    console.error('Failed to suggest combos:', error)
    return c.json({ error: 'Failed to suggest combos' }, 500)
  }
})

// Get available time slots for a specific date and guest count
app.get('/api/availability/slots', async (c) => {
  try {
    const date = c.req.query('date')
    const guests = c.req.query('guests') || '2'

    if (!date) {
      return c.json({ error: 'Date is required' }, 400)
    }

    // Define typical restaurant hours (11:00 AM to 10:00 PM)
    const timeSlots = [
      '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
      '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00'
    ]

    // Check which time slots have available tables
    const availableSlots = []
    for (const time of timeSlots) {
      const { results } = await c.env.DB.prepare(`
        SELECT COUNT(*) as available_count FROM restaurant_tables t
        WHERE t.capacity = ?
        AND t.id NOT IN (
          SELECT table_id FROM bookings 
          WHERE booking_date = ? 
          AND booking_time = ?
          AND status IN ('pending', 'confirmed')
        )
      `).bind(guests, date, time).all()

      const count = results?.[0]?.available_count || 0
      if (count > 0) {
        availableSlots.push({
          time,
          available: true,
          tablesAvailable: count
        })
      } else {
        availableSlots.push({
          time,
          available: false,
          tablesAvailable: 0
        })
      }
    }

    return c.json({
      date,
      guestCount: parseInt(guests),
      slots: availableSlots
    })
  } catch (error) {
    console.error('Failed to fetch availability slots:', error)
    return c.json({ error: 'Failed to fetch availability slots' }, 500)
  }
})

// Get available dates for next N days
app.get('/api/availability/dates', async (c) => {
  try {
    const guests = c.req.query('guests') || '2'
    const days = parseInt(c.req.query('days') || '30')

    const availableDates = []
    const today = new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      // Check if this date has any available tables at any time
      const { results } = await c.env.DB.prepare(`
        SELECT COUNT(DISTINCT t.id) as total_tables FROM restaurant_tables t
        WHERE t.capacity = ?
        AND t.id NOT IN (
          SELECT DISTINCT table_id FROM bookings 
          WHERE booking_date = ?
          AND status IN ('pending', 'confirmed')
        )
      `).bind(guests, dateStr).all()

      const availableCount = results?.[0]?.total_tables || 0
      availableDates.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        available: availableCount > 0,
        tablesAvailable: availableCount
      })
    }

    return c.json({
      guestCount: parseInt(guests),
      dates: availableDates
    })
  } catch (error) {
    console.error('Failed to fetch available dates:', error)
    return c.json({ error: 'Failed to fetch available dates' }, 500)
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

    let bookingIds = [];
    if (Array.isArray(tableIds) && tableIds.length > 0) {
      // Validate availability for each table
      for (const tId of tableIds) {
        const existing = await c.env.DB.prepare(`
          SELECT id FROM bookings 
          WHERE table_id = ? 
          AND booking_date = ? 
          AND booking_time = ?
          AND status IN ('pending', 'confirmed')
        `).bind(tId, bookingDate, bookingTime).first()
        if (existing) {
          return c.json({ error: `Table ${tId} is already booked for this time slot` }, 409)
        }
      }
      // Insert bookings for each table
      for (const tId of tableIds) {
        const res = await c.env.DB.prepare(`
          INSERT INTO bookings (user_id, table_id, booking_date, booking_time, guests_count, special_requests, status)
          VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `).bind(userId, tId, bookingDate, bookingTime, guestsCount, specialRequests || null).run()
        bookingIds.push(res.meta.last_row_id)
      }
    } else {
      const res = await c.env.DB.prepare(`
        INSERT INTO bookings (user_id, table_id, booking_date, booking_time, guests_count, special_requests, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).bind(userId, tableId, bookingDate, bookingTime, guestsCount, specialRequests || null).run()
      bookingIds.push(res.meta.last_row_id)
    }

    // Placeholder receipt notification
    const user = await c.env.DB.prepare(`SELECT email, phone, name FROM users WHERE id = ?`).bind(userId).first()
    if (user) {
      const bookingAmount = (Number(guestsCount) || 0) * 100
      await sendReceipt({ ...user, whatsapp: user.phone }, {
        type: 'booking',
        bookingIds,
        bookingDate,
        bookingTime,
        guestsCount,
        tableIds: tableIds || [tableId],
        amount: bookingAmount,
        currency: 'INR',
        notes: 'Cover charge ₹50 per head per hour (payment confirms booking)'
      })
    }

    return c.json({ 
      success: true, 
      bookingIds,
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

// Update booking (e.g., confirm after payment)
app.patch('/api/bookings/:id', async (c) => {
  try {
    const bookingId = c.req.param('id')
    const { status } = await c.req.json()

    if (!status) {
      return c.json({ error: 'Status is required' }, 400)
    }

    await c.env.DB.prepare(`
      UPDATE bookings SET status = ? WHERE id = ?
    `).bind(status, bookingId).run()

    return c.json({ success: true, message: 'Booking updated' })
  } catch (error) {
    return c.json({ error: 'Failed to update booking' }, 500)
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

    // Booking fee logic: ₹100/hr unless food total >= ₹1000; assume 1 hour slot by default
    let bookingFee = 0
    if (bookingId) {
      bookingFee = totalAmount >= 1000 ? 0 : 100
    }
    const finalTotal = totalAmount + bookingFee

    // Create order
    const orderResult = await c.env.DB.prepare(`
      INSERT INTO orders (user_id, booking_id, total_amount, order_type, special_instructions, status, payment_status)
      VALUES (?, ?, ?, ?, ?, 'pending', 'pending')
    `).bind(userId, bookingId || null, finalTotal, orderType || 'dine-in', specialInstructions || null).run()

    const orderId = orderResult.meta.last_row_id

    // Insert order items
    for (const item of items) {
      await c.env.DB.prepare(`
        INSERT INTO order_items (order_id, menu_item_id, quantity, price, special_notes)
        VALUES (?, ?, ?, ?, ?)
      `).bind(orderId, item.menuItemId, item.quantity, item.price, item.specialNotes || null).run()
    }

    // Receipt notification placeholder
    const user = await c.env.DB.prepare(`SELECT email, phone, name FROM users WHERE id = ?`).bind(userId).first()
    if (user) {
      await sendReceipt({ ...user, whatsapp: user.phone }, {
        type: 'order',
        orderId,
        bookingId: bookingId || null,
        items,
        foodTotal: totalAmount,
        bookingFee,
        finalTotal
      })
    }

    return c.json({ 
      success: true, 
      orderId,
      bookingFee,
      finalTotal,
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

    if (!results || results.length === 0) {
      console.log(`No orders found for user ${userId}`)
      return c.json([])
    }

    // Get order items for each order
    for (const order of results) {
      try {
        const itemsResult = await c.env.DB.prepare(`
          SELECT oi.*, m.name, m.description, m.price
          FROM order_items oi
          JOIN menu_items m ON oi.menu_item_id = m.id
          WHERE oi.order_id = ?
        `).bind(order.id).all()
        
        order.items = itemsResult.results || []
        console.log(`Order ${order.id} has ${order.items.length} items`)
      } catch (itemErr) {
        console.error(`Failed to fetch items for order ${order.id}:`, itemErr)
        order.items = []
      }
    }
    
    // No orders yet - this is normal during booking process
    return c.json(results)
  } catch (error) {
    console.error('Failed to fetch user orders:', error)
    return c.json({ error: 'Failed to fetch orders' }, 500)
  }
})

// Get orders by booking ID
app.get('/api/orders/booking/:bookingId', async (c) => {
  try {
    const bookingId = c.req.param('bookingId')

    const { results } = await c.env.DB.prepare(`
      SELECT o.*, b.booking_date, b.booking_time
      FROM orders o
      LEFT JOIN bookings b ON o.booking_id = b.id
      WHERE o.booking_id = ?
      ORDER BY o.created_at DESC
    `).bind(bookingId).all()

    if (!results || results.length === 0) {
      console.log(`No orders found for booking ${bookingId}`)
      return c.json([])
    }
          // No orders yet - this is normal during booking process
    for (const order of results) {
      try {
        const itemsResult = await c.env.DB.prepare(`
          SELECT oi.*, m.name, m.description, m.price
          FROM order_items oi
          JOIN menu_items m ON oi.menu_item_id = m.id
          WHERE oi.order_id = ?
        `).bind(order.id).all()
        
        order.items = itemsResult.results || []
        console.log(`Order ${order.id} has ${order.items.length} items`)
      } catch (itemErr) {
        console.error(`Failed to fetch items for order ${order.id}:`, itemErr)
        order.items = []
      }
    }

    return c.json(results)
  } catch (error) {
    console.error('Failed to fetch orders by booking:', error)
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

// Unified checkout (simulated processor)
app.post('/api/payments/checkout', async (c) => {
  try {
    const { userId, orderId, bookingId, amount, method, contact } = await c.req.json()

    if (!userId || amount == null || !method) {
      return c.json({ error: 'User, amount, and method are required' }, 400)
    }

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return c.json({ error: 'Amount must be greater than zero' }, 400)
    }

    const txRef = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const status = method === 'cash' ? 'pending' : 'succeeded'

    await c.env.DB.prepare(`
      INSERT INTO payments (user_id, order_id, booking_id, method, amount, status, tx_ref)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(userId, orderId || null, bookingId || null, method, amount, status, txRef).run()

    if (orderId) {
      await c.env.DB.prepare(`
        UPDATE orders 
        SET payment_status = ?, 
            payment_method = ?,
            stripe_payment_id = ?
        WHERE id = ?
      `).bind(status === 'succeeded' ? 'paid' : 'pending', method, txRef, orderId).run()
    }

    const user = await c.env.DB.prepare(`SELECT email, phone, name FROM users WHERE id = ?`).bind(userId).first()
    const receiptRecipient = {
      email: contact?.email || user?.email,
      phone: contact?.phone || user?.phone,
      whatsapp: contact?.whatsapp || contact?.phone || user?.phone
    }

      await sendReceipt(receiptRecipient, {
      type: 'payment',
      txRef,
      status,
      method,
        amount: numericAmount,
      orderId: orderId || null,
      bookingId: bookingId || null
    })

    return c.json({ 
      success: true, 
      txRef,
      status,
      message: status === 'succeeded' 
        ? 'Payment processed successfully' 
        : 'Payment recorded as pending; please complete on delivery'
    })
  } catch (error) {
    return c.json({ error: 'Payment processing failed' }, 500)
  }
})

// ============= NOTIFICATION ROUTES =============

// Send receipt notification via Email/SMS/WhatsApp
app.post('/api/notifications/send-receipt', async (c) => {
  try {
    const { email, phone, whatsapp, name, items, orderId, totalAmount, orderType, paymentMethod, bookingDetails } = await c.req.json()

    // Validate at least one contact method
    if (!email && !phone && !whatsapp) {
      return c.json({ error: 'At least one contact method (email, phone, whatsapp) is required' }, 400)
    }

    // Email notification - Unified receipt with booking and food
    if (email) {
      try {
        let emailBody = `
Dear ${name},

Thank you for your order! Here's your complete receipt.

${'═'.repeat(60)}
📋 COMPLETE ORDER RECEIPT
${'═'.repeat(60)}

Order ID: ${orderId}
Customer Name: ${name}
Order Date & Time: ${new Date().toLocaleString()}

${'═'.repeat(60)}`

        // Add booking details if available
        if (bookingDetails) {
          emailBody += `
🍽️ TABLE BOOKING DETAILS:
─────────────────────────
Table: ${bookingDetails.tableNumber}
Capacity: ${bookingDetails.capacity} seats
Location: ${bookingDetails.location}
Booking Date: ${bookingDetails.bookingDate}
Booking Time: ${bookingDetails.bookingTime}
Number of Guests: ${bookingDetails.guestsCount}
${bookingDetails.specialRequests ? `Special Requests: ${bookingDetails.specialRequests}` : ''}
Booking Cover Charge: ₹${bookingDetails.bookingAmount || '0.00'}

${'─'.repeat(60)}`
        }

        // Add food items
        emailBody += `
🍴 FOOD ITEMS ORDERED:
─────────────────────────
${items?.map((item: any) => `  • ${item.name} x${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}`).join('\n') || '  No items'}

Food Total: ₹${items?.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0).toFixed(2) || '0.00'}
${bookingDetails ? `Booking Cover Charge: ₹${bookingDetails.bookingAmount || '0.00'}` : ''}

${'═'.repeat(60)}
💰 GRAND TOTAL: ₹${totalAmount?.toFixed(2) || '0.00'}
${'═'.repeat(60)}

Order Type: ${orderType?.toUpperCase() || 'Dine-In'}
Payment Method: ${paymentMethod?.toUpperCase() || 'Not specified'}
Payment Status: ✅ CONFIRMED

${'═'.repeat(60)}
Thank you for your order! 
${bookingDetails ? 'We look forward to serving you!' : 'Your food is being prepared.'}
${'═'.repeat(60)}

Best regards,
Restaurant Team
        `
        
        // Log that email would be sent
        console.log(`📧 EMAIL NOTIFICATION SENT TO: ${email}`)
        console.log(emailBody)
      } catch (err) {
        console.error('Email notification error:', err)
      }
    }

    // SMS notification
    if (phone) {
      try {
        let smsBody = `✅ Order Confirmed! Order ID: ${orderId}. `
        if (bookingDetails) {
          smsBody += `Table: ${bookingDetails.tableNumber} on ${bookingDetails.bookingDate}. `
        }
        smsBody += `Items: ${items?.length || 0}. Total: ₹${totalAmount}. Thank you!`
        
        // Log that SMS would be sent
        console.log(`📱 SMS NOTIFICATION SENT TO: ${phone}`, smsBody)
      } catch (err) {
        console.error('SMS notification error:', err)
      }
    }

    // WhatsApp notification  
    if (whatsapp) {
      try {
        let waMessage = `🎉 *Order Confirmed!*\n\n`
        waMessage += `📋 Order ID: ${orderId}\n`
        waMessage += `👤 Name: ${name}\n`
        
        if (bookingDetails) {
          waMessage += `\n🍽️ *Table Booking:*\n`
          waMessage += `📅 Date: ${bookingDetails.bookingDate}\n`
          waMessage += `🕐 Time: ${bookingDetails.bookingTime}\n`
          waMessage += `👥 Guests: ${bookingDetails.guestsCount}\n`
          waMessage += `🪑 Table: ${bookingDetails.tableNumber}\n`
        }
        
        waMessage += `\n🍴 *Food Items:*\n`
        waMessage += `${items?.map((item: any) => `• ${item.name} x${item.quantity}`).join('\n') || 'No items'}\n`
        
        waMessage += `\n💰 *Total: ₹${totalAmount}*\n`
        waMessage += `💳 Payment: ${paymentMethod?.toUpperCase() || 'Not specified'}\n`
        waMessage += `✅ Status: CONFIRMED\n`
        waMessage += `\nThank you for your order! 🙏`
        
        // Log that WhatsApp would be sent
        console.log(`💬 WHATSAPP NOTIFICATION SENT TO: ${whatsapp}`)
        console.log(waMessage)
      } catch (err) {
        console.error('WhatsApp notification error:', err)
      }
    }

    return c.json({
      success: true,
      message: 'Receipt notifications queued',
      notificationsSent: {
        email: !!email,
        sms: !!phone,
        whatsapp: !!whatsapp
      },
      channels: {
        email: email || 'not provided',
        phone: phone || 'not provided',
        whatsapp: whatsapp || 'not provided'
      }
    })
  } catch (error) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('Notification error:', error)
    }
    return c.json({ error: 'Failed to send notifications' }, 500)
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
                    <span class="text-2xl font-bold text-gray-800">Mom's Kitchen</span>
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
            <h1 class="text-5xl font-bold mb-4">Welcome to Mom's Kitchen</h1>
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
                            <select id="guestsCount" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" required onchange="loadTablesForGuests()">
                                <option value="">Select number of guests</option>
                                ${Array.from({length: 16}, (_, i) => `<option value="${i + 1}">${i + 1} ${i === 0 ? 'guest' : 'guests'}</option>`).join('')}
                            </select>
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
                    
                    <!-- Available Dates Section -->
                    <div id="availableDatesList" class="mt-6"></div>
                    
                    <!-- Available Time Slots Section -->
                    <div id="timeSlotsList" class="mt-6"></div>
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
    <div id="checkoutModal" class="modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center z-50 overflow-hidden">
        <div class="bg-white rounded-lg max-w-md w-full mx-4 max-h-screen overflow-y-auto flex flex-col">
            <div class="p-8">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Checkout</h2>
                <button id="closeCheckoutModal" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            <!-- Order Items Summary -->
            <div class="mb-6 bg-gray-50 p-4 rounded-lg max-h-48 overflow-y-auto">
                <h3 class="font-bold text-gray-800 mb-3">Order Items:</h3>
                <div id="checkoutItems" class="space-y-2">
                    <p class="text-gray-500 text-sm">Loading items...</p>
                </div>
            </div>
            
            <div class="mb-6 border-t pt-4">
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
                            <input type="radio" name="paymentMethod" value="credit_card" checked class="mr-2">
                            <i class="fas fa-credit-card text-2xl mr-2"></i>
                            <span>Credit Card</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="paymentMethod" value="debit_card" class="mr-2">
                            <i class="far fa-credit-card text-2xl mr-2"></i>
                            <span>Debit Card</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="paymentMethod" value="upi" class="mr-2">
                            <i class="fas fa-mobile-alt text-2xl mr-2"></i>
                            <span>UPI</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="paymentMethod" value="netbanking" class="mr-2">
                            <i class="fas fa-university text-2xl mr-2"></i>
                            <span>Net Banking</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="paymentMethod" value="wallet" class="mr-2">
                            <i class="fas fa-wallet text-2xl mr-2"></i>
                            <span>Wallet</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="paymentMethod" value="cash" class="mr-2">
                            <i class="fas fa-money-bill-wave text-2xl mr-2"></i>
                            <span>Cash on Arrival</span>
                        </label>
                    </div>
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-medium mb-2">UPI ID (if paying via UPI)</label>
                    <input id="upiId" type="text" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="yourname@upi">
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700 font-medium mb-2">Receipt email</label>
                    <input id="receiptEmail" type="email" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="you@example.com">
                </div>
                <div class="mb-6">
                    <label class="block text-gray-700 font-medium mb-2">Receipt phone / WhatsApp</label>
                    <input id="receiptPhone" type="tel" class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="+91XXXXXXXXXX">
                </div>
                <div class="flex space-x-3">
                    <button type="button" id="paymentCancelBtn" class="w-1/2 border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-100">
                        Cancel
                    </button>
                    <button type="submit" class="w-1/2 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700">
                        <i class="fas fa-lock mr-2"></i>Complete Payment
                    </button>
                </div>
            </form>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script src="/static/app.js"></script>
</body>
</html>
  `)
})

export default app
