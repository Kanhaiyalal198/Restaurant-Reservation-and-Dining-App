// Global state
let currentUser = null;
let cart = [];
let menuItems = [];
let categories = [];

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
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        userName.classList.add('hidden');
        myBookingsSection.classList.add('hidden');
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
    document.getElementById('checkoutTotal').textContent = `$${total.toFixed(2)}`;
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
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await axios.post('/api/auth/login', { email, password });
        currentUser = response.data.user;
        saveUserToStorage();
        updateUIState();
        closeLoginModal();
        alert('Login successful!');
    } catch (error) {
        alert(error.response?.data?.error || 'Login failed');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        await axios.post('/api/auth/register', { name, email, phone, password });
        alert('Registration successful! Please login.');
        switchTab('login');
    } catch (error) {
        alert(error.response?.data?.error || 'Registration failed');
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
        categories = categoriesResponse.data;
        
        // Load menu items
        const itemsResponse = await axios.get('/api/menu/items');
        menuItems = itemsResponse.data;
        
        renderCategories();
        renderMenu();
    } catch (error) {
        console.error('Failed to load menu:', error);
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
    
    container.innerHTML = filteredItems.map(item => `
        <div class="menu-item-card bg-white rounded-lg shadow-lg overflow-hidden">
            <div class="h-48 bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <i class="fas fa-utensils text-white text-6xl"></i>
            </div>
            <div class="p-6">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-bold text-gray-800">${item.name}</h3>
                    <span class="text-2xl font-bold text-purple-600">$${item.price.toFixed(2)}</span>
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
    `).join('');
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
        totalElement.textContent = '$0.00';
        return;
    }
    
    container.innerHTML = cart.map(item => `
        <div class="flex justify-between items-center border-b pb-4">
            <div class="flex-1">
                <h4 class="font-semibold">${item.name}</h4>
                <p class="text-gray-600">$${item.price.toFixed(2)} each</p>
            </div>
            <div class="flex items-center space-x-4">
                <div class="flex items-center space-x-2">
                    <button onclick="updateQuantity(${item.id}, -1)" class="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">-</button>
                    <span class="font-semibold">${item.quantity}</span>
                    <button onclick="updateQuantity(${item.id}, 1)" class="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">+</button>
                </div>
                <span class="font-bold w-20 text-right">$${(item.price * item.quantity).toFixed(2)}</span>
                <button onclick="removeFromCart(${item.id})" class="text-red-500 hover:text-red-700">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    totalElement.textContent = `$${calculateTotal().toFixed(2)}`;
}

// Booking functions
async function checkAvailability() {
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const guests = document.getElementById('guestsCount').value;
    
    if (!date || !time || !guests) {
        alert('Please fill in date, time, and number of guests');
        return;
    }
    
    try {
        const response = await axios.get(`/api/tables/available?date=${date}&time=${time}&guests=${guests}`);
        const tables = response.data;
        
        const tableSelect = document.getElementById('tableSelect');
        
        if (tables.length === 0) {
            tableSelect.innerHTML = '<option value="">No tables available</option>';
            alert('No tables available for the selected date and time');
        } else {
            tableSelect.innerHTML = '<option value="">Select a table</option>' +
                tables.map(table => `
                    <option value="${table.id}">
                        Table ${table.table_number} - ${table.capacity} seats (${table.location})
                    </option>
                `).join('');
            alert(`${tables.length} table(s) available!`);
        }
    } catch (error) {
        alert('Failed to check availability');
    }
}

async function handleBooking(e) {
    e.preventDefault();
    
    if (!currentUser) {
        alert('Please login first');
        openLoginModal();
        return;
    }
    
    const tableId = document.getElementById('tableSelect').value;
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const guests = document.getElementById('guestsCount').value;
    const specialRequests = document.getElementById('specialRequests').value;
    
    if (!tableId) {
        alert('Please select a table');
        return;
    }
    
    try {
        await axios.post('/api/bookings', {
            userId: currentUser.id,
            tableId: parseInt(tableId),
            bookingDate: date,
            bookingTime: time,
            guestsCount: parseInt(guests),
            specialRequests
        });
        
        alert('Booking confirmed! Check "My Bookings" section.');
        document.getElementById('bookingForm').reset();
        loadUserBookings();
    } catch (error) {
        alert(error.response?.data?.error || 'Booking failed');
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
        
        container.innerHTML = bookings.map(booking => `
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
                <div class="space-y-2 text-gray-600">
                    <p><i class="fas fa-calendar mr-2"></i>${booking.booking_date}</p>
                    <p><i class="fas fa-clock mr-2"></i>${booking.booking_time}</p>
                    <p><i class="fas fa-users mr-2"></i>${booking.guests_count} guests</p>
                    <p><i class="fas fa-map-marker-alt mr-2"></i>${booking.location}</p>
                    ${booking.special_requests ? `<p><i class="fas fa-comment mr-2"></i>${booking.special_requests}</p>` : ''}
                </div>
                ${booking.status === 'confirmed' ? `
                    <button onclick="cancelBooking(${booking.id})" class="mt-4 w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                        Cancel Booking
                    </button>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load bookings:', error);
    }
}

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
        await axios.delete(`/api/bookings/${bookingId}`);
        alert('Booking cancelled successfully');
        loadUserBookings();
    } catch (error) {
        alert('Failed to cancel booking');
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
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    const totalAmount = calculateTotal();
    
    try {
        // Create order
        const orderItems = cart.map(item => ({
            menuItemId: item.id,
            quantity: item.quantity,
            price: item.price
        }));
        
        const orderResponse = await axios.post('/api/orders', {
            userId: currentUser.id,
            items: orderItems,
            totalAmount,
            orderType,
            specialInstructions
        });
        
        const orderId = orderResponse.data.orderId;
        
        // Process payment
        if (paymentMethod === 'stripe') {
            await axios.post('/api/payment/process', {
                orderId,
                amount: totalAmount,
                paymentMethod: 'stripe'
            });
        }
        
        // Clear cart
        cart = [];
        saveCartToStorage();
        
        closeCheckoutModal();
        alert(`Order placed successfully! ${paymentMethod === 'cash' ? 'Please pay at the restaurant.' : 'Payment processed.'}`);
    } catch (error) {
        alert(error.response?.data?.error || 'Order failed');
    }
}

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});
