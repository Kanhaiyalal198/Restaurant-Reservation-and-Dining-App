import assert from 'assert'
import { setTimeout as wait } from 'timers/promises'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
console.log('Using base URL:', BASE)

async function req(path, opts) {
  const res = await fetch(`${BASE}${path}`, opts)
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch (e) { body = text }
  return { status: res.status, body }
}

async function main(){
  try{
    // 1. Get menu items
    console.log('Fetching menu items...')
    let r = await req('/api/menu/items')
    assert(r.status === 200, 'menu items fetch failed')
    const items = r.body
    assert(Array.isArray(items) && items.length>0, 'no menu items available')
    const item = items[0]
    console.log('Using menu item:', item.name || item.id)

    // 2. Create test user (random)
    const rnd = Math.floor(Math.random()*100000)
    const email = `e2e+${rnd}@example.com`
    const pass = 'testpass'
    console.log('Registering user', email)
    r = await req('/api/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password: pass, name: 'E2E Tester', phone: '+10000000000' }) })
    assert(r.status === 200 || r.status === 201 || (r.body && r.body.success), 'register failed')

    // 3. Login
    r = await req('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password: pass }) })
    assert(r.status === 200 && r.body && r.body.user, 'login failed')
    const user = r.body.user
    console.log('Logged in user id', user.id)

    // 4. Find available tables for the target slot
    const tomorrow = new Date(Date.now() + 24*3600*1000)
    const bookingDate = tomorrow.toISOString().split('T')[0]
    const bookingTime = '19:00'
    console.log('Checking available tables for', bookingDate, bookingTime)
    r = await req(`/api/tables/available?date=${bookingDate}&time=${bookingTime}&guests=2`)
    if (!(r.status === 200 && Array.isArray(r.body))) {
      // fallback to all tables
      r = await req('/api/tables')
    }
    assert(r.status === 200 && Array.isArray(r.body), 'get tables failed')
    const tables = r.body
    if (tables.length === 0) throw new Error('no available tables')
    const table = tables[0]
    console.log('Using table:', table.table_number || table.id)

    // 5. Create booking
    console.log('Creating booking', bookingDate, bookingTime)
    r = await req('/api/bookings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: user.id, tableId: table.id, bookingDate, bookingTime, guestsCount: 2, specialRequests: 'E2E test' }) })
    assert(r.status === 200 && r.body.bookingId, 'booking creation failed')
    const bookingId = r.body.bookingId
    console.log('Booking created:', bookingId)

    // 6. Create order linked to booking
    const orderBody = {
      userId: user.id,
      bookingId,
      items: [{ menuItemId: item.id, quantity: 1, price: item.price, name: item.name }],
      totalAmount: item.price,
      orderType: 'dine-in'
    }
    r = await req('/api/orders', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(orderBody) })
    assert(r.status === 200 && r.body.orderId, 'order creation failed')
    const orderId = r.body.orderId
    console.log('Order created:', orderId)

    // 7. Process payment
    r = await req('/api/payments/checkout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ userId: user.id, orderId, bookingId, amount: item.price, method: 'card', contact: { email, phone: user.phone, whatsapp: user.phone } }) })
    assert(r.status === 200 && r.body.status, 'payment failed')
    console.log('Payment status:', r.body.status)

    // wait a bit for backend to process and for polling to pick up
    await wait(1500)

    // 8. Fetch bookings for user and verify order present in confirmed/pending booking
    r = await req(`/api/bookings/user/${user.id}`)
    assert(r.status === 200 && Array.isArray(r.body), 'get bookings failed')
    const bookings = r.body
    const found = bookings.find(b => b.id === bookingId)
    assert(found, 'booking not found')
    // fetch orders for that booking
    r = await req(`/api/orders/booking/${bookingId}`)
    assert(r.status === 200 && Array.isArray(r.body), 'get orders by booking failed')
    const orders = r.body
    assert(orders.some(o => o.id === orderId), 'order not linked to booking')

    console.log('E2E test passed ✅')
    process.exit(0)

  } catch (err) {
    console.error('E2E test failed:', err)
    process.exit(2)
  }
}

main()
