// Global state
let currentUser = null;
let cart = [];
let menuItems = [];
let categories = [];
let bookingPollInterval = null;

// Currency helpers
const CURRENCY_SYMBOL = '₹';
function formatCurrency(amount) {
    return `${CURRENCY_SYMBOL}${amount.toFixed(2)}`;
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadUserFromStorage();
    loadCartFromStorage();
    loadMenu();
    setupEventListeners();
    updateUIState();
});

// Load user from localStorage
function loadUserFromStorage() {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }
}

// Save user to localStorage
function saveUserToStorage() {
    if (currentUser) {
        localStorage.setItem('user', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('user');
    }
}

// Load cart from localStorage
function loadCartFromStorage() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartCount();
    }
}

// Save cart to localStorage
function saveCartToStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

// Setup event listeners
function setupEventListeners() {
    // Login/Logout buttons
    document.getElementById('loginBtn').addEventListener('click', openLoginModal);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Modal controls
    document.getElementById('closeLoginModal').addEventListener('click', closeLoginModal);
    document.getElementById('closeCartModal').addEventListener('click', closeCartModal);
    document.getElementById('closeCheckoutModal').addEventListener('click', closeCheckoutModal);
    
    // Tabs
    document.getElementById('loginTab').addEventListener('click', () => switchTab('login'));
    document.getElementById('registerTab').addEventListener('click', () => switchTab('register'));
    
    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('bookingForm').addEventListener('submit', handleBooking);
    document.getElementById('paymentForm').addEventListener('submit', handlePayment);
    
    // Buttons
    document.getElementById('cartBtn').addEventListener('click', openCartModal);
    document.getElementById('checkoutBtn').addEventListener('click', openCheckoutModal);
    document.getElementById('checkAvailabilityBtn').addEventListener('click', checkAvailability);
    const paymentCancelBtn = document.getElementById('paymentCancelBtn');
    if (paymentCancelBtn) {
        paymentCancelBtn.addEventListener('click', closeCheckoutModal);
    }
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('bookingDate').min = today;
}

// Update UI based on auth state
function updateUIState() {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userName = document.getElementById('userName');
    const myBookingsSection = document.getElementById('myBookings');
    
    if (currentUser) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        userName.classList.remove('hidden');
        userName.textContent = `Hi, ${currentUser.name}`;
        myBookingsSection.classList.remove('hidden');
        loadUserBookings();
        // start polling bookings every 10 seconds to show real-time updates
        if (!bookingPollInterval) {
            bookingPollInterval = setInterval(() => {
                loadUserBookings().catch(err => console.error('Booking poll failed', err));
            }, 10000);
        }
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        userName.classList.add('hidden');
        myBookingsSection.classList.add('hidden');
    }
}

// logout should stop polling
function logout() {
    currentUser = null;
    saveUserToStorage();
    updateUIState();
    if (bookingPollInterval) {
        clearInterval(bookingPollInterval);
        bookingPollInterval = null;
    }
}

// Modal functions
function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
}

function openCartModal() {
    renderCart();
    document.getElementById('cartModal').classList.add('active');
}

function closeCartModal() {
    document.getElementById('cartModal').classList.remove('active');
}

function openCheckoutModal() {
    if (!currentUser) {
        alert('Please login first');
        closeCartModal();
        openLoginModal();
        return;
    }
    
    if (cart.length === 0) {
        alert('Your cart is empty');
        return;
    }
    
    const total = calculateTotal();
    document.getElementById('checkoutTotal').textContent = formatCurrency(total);
    
    // Display cart items in checkout
    const checkoutItems = document.getElementById('checkoutItems');
    checkoutItems.innerHTML = cart.map(item => `
        <div class="flex justify-between text-sm py-1 border-b border-gray-200">
            <span class="text-gray-700">
                ${item.name} <span class="text-gray-500">x${item.quantity}</span>
            </span>
            <span class="font-semibold text-gray-800">${formatCurrency(item.price * item.quantity)}</span>
        </div>
    `).join('');
    
    const receiptEmail = document.getElementById('receiptEmail');
    const receiptPhone = document.getElementById('receiptPhone');
    const upiId = document.getElementById('upiId');
    if (receiptEmail && currentUser?.email) {
        receiptEmail.value = currentUser.email;
    }
    if (receiptPhone && currentUser?.phone) {
        receiptPhone.value = currentUser.phone;
    }
    if (upiId) {
        upiId.value = '';
    }
    
    closeCartModal();
    document.getElementById('checkoutModal').classList.add('active');
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').classList.remove('active');
}

function switchTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (tab === 'login') {
        loginTab.classList.add('border-purple-600', 'text-purple-600');
        loginTab.classList.remove('text-gray-500');
        registerTab.classList.remove('border-purple-600', 'text-purple-600');
        registerTab.classList.add('text-gray-500');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        registerTab.classList.add('border-purple-600', 'text-purple-600');
        registerTab.classList.remove('text-gray-500');
        loginTab.classList.remove('border-purple-600', 'text-purple-600');
        loginTab.classList.add('text-gray-500');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }
}

// Authentication handlers
async function handleLogin(e) {
    e.preventDefault();
    
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            alert('Please enter email and password');
            return;
        }
        
        const response = await axios.post('/api/auth/login', { email, password });
        if (!response.data || !response.data.user) {
            throw new Error('Invalid response from server');
        }
        currentUser = response.data.user;
        saveUserToStorage();
        updateUIState();
        closeLoginModal();
        alert('Login successful!');
    } catch (error) {
        console.error('Login error:', error);
        alert(error.response?.data?.error || error.message || 'Login failed');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    try {
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const phone = document.getElementById('registerPhone').value;
        const password = document.getElementById('registerPassword').value;
        
        if (!name || !email || !phone || !password) {
            alert('Please fill in all fields');
            return;
        }
        
        await axios.post('/api/auth/register', { name, email, phone, password });
        alert('Registration successful! Please login.');
        switchTab('login');
    } catch (error) {
        console.error('Registration error:', error);
        alert(error.response?.data?.error || error.message || 'Registration failed');
    }
}

function logout() {
    currentUser = null;
    saveUserToStorage();
    updateUIState();
    alert('Logged out successfully');
}

// Menu functions
async function loadMenu() {
    try {
        // Load categories
        const categoriesResponse = await axios.get('/api/menu/categories');
        categories = categoriesResponse.data || [];
        const originalCatCount = categories.length;
        // Deduplicate categories by id (keep first occurrence)
        categories = Array.from(new Map(categories.map(c => [c.id, c])).values());
        console.log(`Categories: ${originalCatCount} loaded, ${categories.length} after dedup`);

        // Load menu items
        const itemsResponse = await axios.get('/api/menu/items');
        menuItems = itemsResponse.data || [];
        const originalItemCount = menuItems.length;
        // Deduplicate menu items by id (keep first occurrence)
        menuItems = Array.from(new Map(menuItems.map(i => [i.id, i])).values());
        // Also deduplicate by name to catch items with same name but different IDs
        const seenNames = new Set();
        menuItems = menuItems.filter(item => {
            if (seenNames.has(item.name)) {
                console.warn(`Duplicate item removed: ${item.name} (ID: ${item.id})`);
                return false;
            }
            seenNames.add(item.name);
            return true;
        });
        console.log(`Menu Items: ${originalItemCount} loaded, ${menuItems.length} after dedup`);

        renderCategories();
        renderMenu();
    } catch (error) {
        console.error('Failed to load menu:', error);
        alert('Failed to load menu. Please refresh the page.');
    }
}

function renderCategories() {
    const container = document.getElementById('categoryButtons');
    container.innerHTML = categories.map(cat => `
        <button class="category-btn bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300" data-category="${cat.id}">
            ${cat.name}
        </button>
    `).join('');
    
    // Add event listeners
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-btn').forEach(b => {
                b.classList.remove('bg-purple-600', 'text-white');
                b.classList.add('bg-gray-200', 'text-gray-700');
            });
            e.target.classList.add('bg-purple-600', 'text-white');
            e.target.classList.remove('bg-gray-200', 'text-gray-700');
            
            const category = e.target.dataset.category;
            renderMenu(category);
        });
    });
}

function renderMenu(categoryFilter = 'all') {
    const container = document.getElementById('menuGrid');
    
    let filteredItems = menuItems;
    if (categoryFilter !== 'all') {
        filteredItems = menuItems.filter(item => item.category_id == categoryFilter);
    }
    
    container.innerHTML = filteredItems.map(item => {
        const image = item.image_url
            ? `<img src="${item.image_url}" alt="${item.name}" class="h-48 w-full object-cover">`
            : `<div class="h-48 bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                    <i class="fas fa-utensils text-white text-6xl"></i>
                </div>`;
        return `
        <div class="menu-item-card bg-white rounded-lg shadow-lg overflow-hidden">
            ${image}
            <div class="p-6">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-bold text-gray-800">${item.name}</h3>
                    <span class="text-2xl font-bold text-purple-600">${formatCurrency(item.price)}</span>
                </div>
                <p class="text-gray-600 mb-3">${item.description || ''}</p>
                <div class="flex space-x-2 mb-4">
                    ${item.is_vegetarian ? '<span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"><i class="fas fa-leaf"></i> Veg</span>' : ''}
                    ${item.is_spicy ? '<span class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded"><i class="fas fa-pepper-hot"></i> Spicy</span>' : ''}
                </div>
                <button onclick="addToCart(${item.id})" class="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">
                    <i class="fas fa-cart-plus mr-2"></i>Add to Cart
                </button>
            </div>
        </div>
    `;
    }).join('');
}

// Cart functions
function addToCart(itemId) {
    const item = menuItems.find(i => i.id === itemId);
    if (!item) return;
    
    const existingItem = cart.find(i => i.id === itemId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1
        });
    }
    
    saveCartToStorage();
    alert(`${item.name} added to cart!`);
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    saveCartToStorage();
    renderCart();
}

function updateQuantity(itemId, change) {
    const item = cart.find(i => i.id === itemId);
    if (!item) return;
    
    item.quantity += change;
    
    if (item.quantity <= 0) {
        removeFromCart(itemId);
    } else {
        saveCartToStorage();
        renderCart();
    }
}

function calculateTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function updateCartCount() {
    const count = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('cartCount').textContent = count;
}

function renderCart() {
    const container = document.getElementById('cartItems');
    const totalElement = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-8">Your cart is empty</p>';
        totalElement.textContent = formatCurrency(0);
        return;
    }
    
    container.innerHTML = cart.map(item => `
        <div class="flex justify-between items-center border-b pb-4">
            <div class="flex-1">
                <h4 class="font-semibold">${item.name}</h4>
                <p class="text-gray-600">${formatCurrency(item.price)} each</p>
            </div>
            <div class="flex items-center space-x-4">
                <div class="flex items-center space-x-2">
                    <button onclick="updateQuantity(${item.id}, -1)" class="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">-</button>
                    <span class="font-semibold">${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, 1)" class="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">+</button>
                </div>
                <span class="font-bold w-20 text-right">${formatCurrency(item.price * item.quantity)}</span>
                <button onclick="removeFromCart(${item.id})" class="text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    totalElement.textContent = formatCurrency(calculateTotal());
}

// Booking functions
function computeAndRenderCombos(guestCount, allTables, tableSelect) {
    const guest = parseInt(guestCount);
    if (!tableSelect) return;
    const availableTables = (allTables || []).filter(t => t && (t.status === 'available' || !t.status) && typeof t.capacity === 'number');

    const n = availableTables.length;
    const maxComboSize = 4;

    // Helper to generate combos (by indices)
    function genCombos(limit) {
        const combos = new Map();
        function gen(start, path) {
            const len = path.length;
            if (len >= 1 && len <= limit) {
                const comboTables = path.map(i => availableTables[i]);
                const total = comboTables.reduce((s, x) => s + (x.capacity || 0), 0);
                const idsKey = comboTables.map(t => t.id).sort((a,b)=>a-b).join(',');
                if (!combos.has(idsKey)) combos.set(idsKey, { tables: comboTables, total });
            }
            if (path.length === limit) return;
            for (let i = start; i < n; i++) {
                path.push(i);
                gen(i+1, path);
                path.pop();
            }
        }
        gen(0, []);
        return Array.from(combos.values());
    }

    // 1) Single-table exact matches
    const singleExact = availableTables.filter(t => t.capacity === guest).map(t => ({ tables: [t], total: t.capacity }));

    // 2) Multi-table exact combos (sum === guest)
    const allCombos = genCombos(Math.min(maxComboSize, n));
    const combosExact = allCombos.filter(c => c.total === guest && c.tables.length >= 2);

    let combosToShow = [];

    if (singleExact.length > 0 || combosExact.length > 0) {
        // Prefer exact matches only
        combosToShow = [...singleExact, ...combosExact];
    } else {
        // No exact matches — try nearest higher-capacity single tables
        const higherSingles = availableTables.filter(t => t.capacity > guest).sort((a,b) => a.capacity - b.capacity);
        if (higherSingles.length > 0) {
            const minCap = higherSingles[0].capacity;
            combosToShow = higherSingles.filter(t => t.capacity === minCap).map(t => ({ tables: [t], total: t.capacity }));
        } else {
            // Fallback to combos that meet or exceed the guest count
            const combosAtLeast = allCombos.filter(c => c.total >= guest);
            combosAtLeast.sort((a,b) => {
                if (a.tables.length !== b.tables.length) return a.tables.length - b.tables.length;
                const oa = a.total - guest; const ob = b.total - guest;
                if (oa !== ob) return oa - ob;
                return a.total - b.total;
            });
            combosToShow = combosAtLeast.slice(0, 50); // limit options
        }
    }

    if (!combosToShow || combosToShow.length === 0) {
        tableSelect.innerHTML = `<option value="">No tables available for ${guest} guest${guest>1?'s':''}</option>`;
        return;
    }

    combosToShow.sort((a,b)=>{
        if (a.tables.length !== b.tables.length) return a.tables.length - b.tables.length;
        const oa = a.total - guest; const ob = b.total - guest;
        if (oa !== ob) return oa - ob;
        return a.total - b.total;
    });

    tableSelect.innerHTML = `<option value="">Select table or combination (${combosToShow.length} option${combosToShow.length>1?'s':''})</option>` +
        combosToShow.map(combo => {
            const ids = combo.tables.map(t => t.id).join(',');
            const label = combo.tables.map(t => `Table ${t.table_number}(${t.capacity})`).join(' + ');
            return `\n<option value="${ids}">${label} — ${combo.total} seats (${combo.tables.length} table${combo.tables.length>1?'s':''})</option>`;
        }).join('');
}

// (Previously there was a helper to pre-filter nearest tables —
// computeAndRenderCombos now handles exact/nearest/fallback logic.)

async function loadTablesForGuests() {
    const guests = document.getElementById('guestsCount').value;
    const tableSelect = document.getElementById('tableSelect');
    
    if (!guests) {
        tableSelect.innerHTML = '<option value="">Select number of guests first</option>';
        return;
    }
    
    try {
        // Ask server for suggested combos (falls back to available tables)
        const response = await axios.get(`/api/tables/suggest-combos?guests=${encodeURIComponent(guests)}`);
        const data = response.data || {};
        const guestCount = parseInt(guests);
        if (Array.isArray(data.combos) && data.combos.length > 0) {
            // Render suggested combos: combos contain {tables: [...], total}
            tableSelect.innerHTML = `<option value="">Select table or combination (${data.combos.length} option${data.combos.length>1?'s':''})</option>` +
                data.combos.map(combo => {
                    const ids = combo.tables.map(t => t.id).join(',');
                    const label = combo.tables.map(t => `Table ${t.table_number}(${t.capacity})`).join(' + ');
                    return `\n<option value="${ids}">${label} — ${combo.total} seats (${combo.tables.length} table${combo.tables.length>1?'s':''})</option>`;
                }).join('');
        } else {
            // Fallback to local combo generation using full available tables
            const allTables = data.availableTables || [];
            computeAndRenderCombos(guestCount, allTables, tableSelect);
        }
    } catch (error) {
        console.error('Error loading tables:', error);
        tableSelect.innerHTML = '<option value="">Error loading tables</option>';
        alert('Failed to load available tables. Please try again.');
    }
}

async function checkAvailability() {
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const guests = document.getElementById('guestsCount').value;
    
    if (!guests) {
        alert('Please select number of guests');
        return;
    }
    
    try {
        // If date and time are selected, check specific slot
        if (date && time) {
            const response = await axios.get(`/api/tables/available?date=${date}&time=${time}&guests=${guests}`);
            const tables = response.data || [];
            const tableSelect = document.getElementById('tableSelect');
            // Ask server for suggested combos for this specific date/time
            try {
                const suggestResp = await axios.get(`/api/tables/suggest-combos?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&guests=${encodeURIComponent(guests)}`);
                const suggestData = suggestResp.data || {};
                if (Array.isArray(suggestData.combos) && suggestData.combos.length > 0) {
                    tableSelect.innerHTML = `<option value="">Select table or combination (${suggestData.combos.length} option${suggestData.combos.length>1?'s':''})</option>` +
                        suggestData.combos.map(combo => {
                            const ids = combo.tables.map(t => t.id).join(',');
                            const label = combo.tables.map(t => `Table ${t.table_number}(${t.capacity})`).join(' + ');
                            return `\n<option value="${ids}">${label} — ${combo.total} seats (${combo.tables.length} table${combo.tables.length>1?'s':''})</option>`;
                        }).join('');
                } else {
                    computeAndRenderCombos(parseInt(guests), tables, tableSelect);
                }
            } catch (err) {
                console.error('Suggest combos failed:', err);
                computeAndRenderCombos(parseInt(guests), tables, tableSelect);
            }
            alert('Availability updated for selected date and time');
        } else if (date) {
            // Show available time slots for selected date
            const slotsResponse = await axios.get(`/api/availability/slots?date=${date}&guests=${guests}`);
            const slots = slotsResponse.data.slots;
            const available = slots.filter(s => s.available);
            
            if (available.length === 0) {
                alert('No available time slots for this date');
                document.getElementById('timeSlotsList').innerHTML = '<p class="text-red-500">No slots available</p>';
            } else {
                const html = `
                    <div class="bg-green-50 p-4 rounded mb-4">
                        <h4 class="font-bold mb-2">Available Time Slots (${available.length}):</h4>
                        <div class="grid grid-cols-4 gap-2">
                            ${available.map(slot => `
                                <button onclick="selectTimeSlot('${slot.time}')" class="bg-green-500 hover:bg-green-600 text-white p-2 rounded text-sm">
                                    ${slot.time}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
                document.getElementById('timeSlotsList').innerHTML = html;
                alert(`${available.length} time slots available!`);
            }
        } else {
            // Show available dates for next 30 days
            const datesResponse = await axios.get(`/api/availability/dates?guests=${guests}&days=30`);
            const dates = datesResponse.data.dates.filter(d => d.available);
            
            if (dates.length === 0) {
                alert('No available dates in next 30 days');
            } else {
                const html = `
                    <div class="bg-blue-50 p-4 rounded mb-4">
                        <h4 class="font-bold mb-2">Available Dates (Next 30 Days):</h4>
                        <div class="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                            ${dates.map(d => `
                                <button onclick="document.getElementById('bookingDate').value='${d.date}'; checkAvailability();" 
                                    class="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded text-sm">
                                    ${d.dayName}<br>${d.date}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                `;
                document.getElementById('availableDatesList').innerHTML = html;
                alert(`${dates.length} dates available in next 30 days!`);
            }
        }
    } catch (error) {
        console.error('Availability check error:', error);
        alert('Failed to check availability: ' + (error.response?.data?.error || error.message || 'Unknown error'));
    }
}

function selectTimeSlot(time) {
    document.getElementById('bookingTime').value = time;
    checkAvailability();
}

async function handleBooking(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('Please login first');
        openLoginModal();
        return;
    }
    
    const tableValue = document.getElementById('tableSelect').value;
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const guests = document.getElementById('guestsCount').value;
    const specialRequests = document.getElementById('specialRequests').value;
    const receiptEmail = document.getElementById('receiptEmail')?.value || currentUser.email || '';
    const receiptPhone = document.getElementById('receiptPhone')?.value || currentUser.phone || '';
    
    if (!tableValue) {
        alert('Please select a table');
        return;
    }
    
    try {
        // Support single table id or comma-separated table ids for combinations
        const payload = {
            userId: currentUser.id,
            bookingDate: date,
            bookingTime: time,
            guestsCount: parseInt(guests),
            specialRequests
        };
        if (tableValue.includes(',')) {
            payload.tableIds = tableValue.split(',').map(s => parseInt(s));
        } else {
            payload.tableId = parseInt(tableValue);
        }

        const bookingResponse = await axios.post('/api/bookings', payload);
        const bookingIds = bookingResponse.data.bookingIds || (bookingResponse.data.bookingId ? [bookingResponse.data.bookingId] : []);
        if (!bookingIds || bookingIds.length === 0) {
            throw new Error('No booking was created');
        }
        const bookingAmount = Number(guests) * 50; // ₹50 per head per hour (1 hr slot)

        // Use the first booking id for payment reference
        const paymentResponse = await axios.post('/api/payments/checkout', {
            userId: currentUser.id,
            bookingId: bookingIds[0],
            amount: bookingAmount,
            method: 'upi',
            contact: {
                email: receiptEmail,
                phone: receiptPhone,
                whatsapp: receiptPhone
            }
        });

        if (!paymentResponse.data?.success) {
            throw new Error(paymentResponse.data?.error || 'Payment failed');
        }

        // Mark all created bookings as confirmed
        await Promise.all(bookingIds.map(id => axios.patch(`/api/bookings/${id}`, { status: 'confirmed' })));

        alert(`Payment successful. Booking confirmed! Cover charge: ₹${bookingAmount} collected. Receipt sent.`);
        document.getElementById('bookingForm').reset();
        loadUserBookings();
    } catch (error) {
        alert(error.response?.data?.error || error.message || 'Booking failed');
    }
}

async function loadUserBookings() {
    if (!currentUser) return;
    
    try {
        const response = await axios.get(`/api/bookings/user/${currentUser.id}`);
        const bookings = response.data;
        
        const container = document.getElementById('bookingsGrid');
        
        if (bookings.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8 col-span-2">No bookings yet</p>';
            return;
        }
        
        // Fetch order items for each booking
        let bookingsWithOrders = [];
        for (const booking of bookings) {
            try {
                // Fetch orders for this specific booking
                const ordersResponse = await axios.get(`/api/orders/booking/${booking.id}`);
                booking.orders = ordersResponse.data || [];
                console.log(`Booking ${booking.id} (${booking.status}):`, booking.orders);
            } catch (err) {
                console.error(`Error fetching orders for booking ${booking.id}:`, err);
                booking.orders = [];
            }
            bookingsWithOrders.push(booking);
        }
        
        // Separate confirmed and cancelled bookings
        const confirmedBookings = bookingsWithOrders.filter(b => b.status === 'confirmed');
        const cancelledBookings = bookingsWithOrders.filter(b => b.status === 'cancelled');
        const pendingBookings = bookingsWithOrders.filter(b => b.status === 'pending');
        
        const renderBooking = (booking) => `
            <div class="bg-white rounded-lg shadow-lg p-6">
                <div class="flex justify-between items-start mb-4">
                    <h3 class="text-xl font-bold">Table ${booking.table_number}</h3>
                    <span class="px-3 py-1 rounded-full text-sm font-semibold ${
                        booking.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                    }">
                        ${booking.status.toUpperCase()}
                    </span>
                </div>
                <div class="space-y-2 text-gray-600 mb-4">
                    <p><i class="fas fa-calendar mr-2"></i>${booking.booking_date}</p>
                    <p><i class="fas fa-clock mr-2"></i>${booking.booking_time}</p>
                    <p><i class="fas fa-users mr-2"></i>${booking.guests_count} guests</p>
                    <p><i class="fas fa-map-marker-alt mr-2"></i>${booking.location}</p>
                    ${booking.special_requests ? `<p><i class="fas fa-comment mr-2"></i>${booking.special_requests}</p>` : ''}
                </div>
                
                ${(booking.status === 'confirmed' || booking.status === 'pending') && booking.orders && booking.orders.length > 0 ? `
                    <div class="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200 max-h-64 overflow-y-auto">
                        <h4 class="font-bold text-gray-800 mb-3 sticky top-0 bg-gray-50">🍴 Items Ordered:</h4>
                        <div class="space-y-3">
                            ${booking.orders.map(order => {
                                console.log('Order data:', order);
                                let itemsText = order.items && order.items.length > 0 ? 
                                    order.items.map(item => `${item.name} x${item.quantity}`).join(', ') :
                                    'Items listed';
                                let orderTotal = order.items && order.items.length > 0 ?
                                    order.items.reduce((sum, item) => {
                                        let itemPrice = item.price || 0;
                                        return sum + (itemPrice * item.quantity);
                                    }, 0) :
                                    order.total_amount;
                                return `
                                    <div class="border-l-4 border-purple-500 pl-3 py-2">
                                        <p class="font-semibold text-gray-800"><i class="fas fa-shopping-cart mr-1 text-purple-600"></i>Order #${order.id}</p>
                                        <p class="text-sm text-gray-700 ml-4">📦 ${itemsText}</p>
                                        <p class="text-sm font-semibold text-purple-600 ml-4">💰 ₹${orderTotal?.toFixed(2) || '0.00'}</p>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                        <p class="text-sm text-gray-500">📦 No items ordered yet</p>
                    </div>
                `}
                
                ${booking.status === 'confirmed' ? `
                    <button onclick="cancelBooking(${booking.id})" class="mt-4 w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                        Cancel Booking
                    </button>
                ` : ''}
            </div>
        `;
        
        // Render HTML with sections for each status
        let html = '';
        
        if (confirmedBookings.length > 0) {
            html += '<div class="mb-8"><h2 class="text-2xl font-bold text-green-700 mb-4">✅ Confirmed Bookings</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
            html += confirmedBookings.map(renderBooking).join('');
            html += '</div></div>';
        }
        
        if (pendingBookings.length > 0) {
            html += '<div class="mb-8"><h2 class="text-2xl font-bold text-yellow-700 mb-4">⏳ Pending Bookings</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
            html += pendingBookings.map(renderBooking).join('');
            html += '</div></div>';
        }
        
        if (cancelledBookings.length > 0) {
            html += '<div class="mb-8"><h2 class="text-2xl font-bold text-red-700 mb-4">❌ Cancelled Bookings</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-6">';
            html += cancelledBookings.map(renderBooking).join('');
            html += '</div></div>';
        }
        
        if (container) {
            container.innerHTML = html;
        } else {
            console.error('Bookings container element not found');
        }
    } catch (error) {
        console.error('Failed to load bookings:', error);
        const container = document.getElementById('bookingsGrid');
        if (container) {
            container.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load bookings. Please try again later.</p>';
        }
    }
}

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
        await axios.delete(`/api/bookings/${bookingId}`);
        alert('Booking cancelled successfully');
        loadUserBookings();
    } catch (error) {
        console.error('Cancel booking error:', error);
        alert(error.response?.data?.error || error.message || 'Failed to cancel booking');
    }
}

// Payment handler
async function handlePayment(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('Please login first');
        return;
    }
    
    const orderType = document.getElementById('orderType').value;
    const specialInstructions = document.getElementById('orderInstructions').value;
    const paymentMethodInput = document.querySelector('input[name="paymentMethod"]:checked');
    const paymentMethod = paymentMethodInput ? paymentMethodInput.value : 'credit_card';
    const receiptEmail = document.getElementById('receiptEmail')?.value || currentUser.email || '';
    const receiptPhone = document.getElementById('receiptPhone')?.value || currentUser.phone || '';
    const upiId = document.getElementById('upiId')?.value || '';
    const totalAmount = calculateTotal();
    
    // Store items before clearing cart (for receipt)
    const orderItems = cart.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity,
        price: item.price,
        name: item.name
    }));
    
    try {
        // Fetch latest booking FIRST (to link order to booking)
        let latestBookingId = null;
        let bookingDetails = null;
        try {
            const bookingsResponse = await axios.get(`/api/bookings/user/${currentUser.id}`);
            if (bookingsResponse.data && bookingsResponse.data.length > 0) {
                // Find the CONFIRMED or PENDING booking (not cancelled)
                const latestBooking = bookingsResponse.data.find(b => b.status === 'confirmed' || b.status === 'pending') || bookingsResponse.data[0];
                if (latestBooking) {
                    latestBookingId = latestBooking.id;
                    console.log(`Using booking ${latestBookingId} with status: ${latestBooking.status}`);
                    bookingDetails = {
                        tableNumber: latestBooking.table_number || 'N/A',
                        capacity: latestBooking.capacity || 0,
                        location: latestBooking.location || '',
                        bookingDate: latestBooking.booking_date || '',
                        bookingTime: latestBooking.booking_time || '',
                        guestsCount: latestBooking.guests_count || 0,
                        specialRequests: latestBooking.special_requests || '',
                        bookingAmount: (latestBooking.guests_count || 0) * 50 // ₹50 per head
                    };
                }
            }
        } catch (bookingErr) {
            console.log('No booking found, order only:', bookingErr);
        }
        
        // Create order with items AND booking ID
        const orderResponse = await axios.post('/api/orders', {
            userId: currentUser.id,
            bookingId: latestBookingId, // Link to booking if exists
            items: orderItems,
            totalAmount,
            orderType,
            specialInstructions
        });
        
        if (!orderResponse.data || !orderResponse.data.orderId) {
            throw new Error('Invalid order response from server');
        }
        
        const orderId = orderResponse.data.orderId;
        console.log(`Order ${orderId} created with booking ${latestBookingId}`);
        
        // Process payment
        const paymentResponse = await axios.post('/api/payments/checkout', {
            userId: currentUser.id,
            orderId,
            amount: totalAmount,
            method: paymentMethod,
            contact: {
                email: receiptEmail,
                phone: receiptPhone,
                whatsapp: receiptPhone,
                upiId
            }
        });
        
        // Send receipt notifications with booking details
        try {
            await axios.post('/api/notifications/send-receipt', {
                email: receiptEmail,
                phone: receiptPhone,
                whatsapp: receiptPhone,
                name: currentUser.name || 'Guest',
                items: orderItems,
                orderId,
                totalAmount,
                orderType,
                paymentMethod,
                bookingDetails: bookingDetails
            });
            console.log('Receipt notifications sent successfully');
        } catch (notifError) {
            console.warn('Notification sending had an issue:', notifError);
            // Don't fail the order if notifications fail
        }
        
        // Calculate totals
        const foodTotal = orderItems.reduce((sum, item) => {
            const price = item.price || 0;
            const quantity = item.quantity || 1;
            return sum + (price * quantity);
        }, 0);
        const bookingCharge = bookingDetails ? (bookingDetails.bookingAmount || 0) : 0;
        
        // Show unified receipt
        const receiptMsg = `
${'═'.repeat(60)}
📋 COMPLETE ORDER RECEIPT
${'═'.repeat(60)}

Order ID: ${orderId}
Customer: ${currentUser.name || 'Guest'}
📞 Phone: ${receiptPhone}
📧 Email: ${receiptEmail}

${'═'.repeat(60)}
${bookingDetails ? `🍽️ TABLE BOOKING DETAILS:
─────────────────────────────
🪑 Table: ${bookingDetails.tableNumber}
👥 Guests: ${bookingDetails.guestsCount}
📅 Date: ${bookingDetails.bookingDate}
🕐 Time: ${bookingDetails.bookingTime}
📍 Location: ${bookingDetails.location}
${bookingDetails.specialRequests ? `📝 Notes: ${bookingDetails.specialRequests}` : ''}
Cover Charge: ₹${(bookingDetails.bookingAmount || 0).toFixed(2)}

${'─'.repeat(60)}
` : ''}
🍴 FOOD ITEMS ORDERED:
─────────────────────────────
${orderItems.map(item => `  • ${item.name} x${item.quantity} = ₹${(item.price * item.quantity).toFixed(2)}`).join('\n')}

Food Subtotal: ₹${foodTotal.toFixed(2)}
${bookingDetails ? `Booking Cover Charge: ₹${bookingCharge.toFixed(2)}` : ''}

${'═'.repeat(60)}
💰 GRAND TOTAL: ₹${totalAmount.toFixed(2)}
${'═'.repeat(60)}

📋 Order Type: ${orderType.toUpperCase()}
💳 Payment Method: ${paymentMethod.toUpperCase()}
✅ Payment Status: CONFIRMED

${'═'.repeat(60)}
📨 CONFIRMATION SENT TO:
  📧 Email: ${receiptEmail}
  📱 SMS: ${receiptPhone}
  💬 WhatsApp: ${receiptPhone}

🎉 Thank you for your order!
${bookingDetails ? 'Your table is reserved. We look forward to serving you!' : 'Your food is being prepared.'}
${'═'.repeat(60)}`;
        
        // Clear cart
        cart = [];
        saveCartToStorage();
        
        closeCheckoutModal();
        
        // Reload bookings to show new orders
        console.log('Reloading bookings to show new orders...');
        await loadUserBookings();
        
        alert(receiptMsg);
    } catch (error) {
        console.error('Payment error:', error);
        alert(error.response?.data?.error || error.message || 'Order failed. Please try again.');
    }
}

// Smooth scrolling
try {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
} catch (error) {
    console.error('Smooth scrolling setup error:', error);
}
