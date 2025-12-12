-- Insert admin user (password: admin123)
-- Passwords use the simple "hashed_<password>" format expected by the dev auth
-- handler in `src/index.tsx`.
INSERT OR IGNORE INTO users (id, email, password, name, phone, role) VALUES 
  (1, 'admin@restaurant.com', 'hashed_admin123', 'Admin User', '+1234567890', 'admin');

-- Insert sample customer (password: customer123)
INSERT OR IGNORE INTO users (id, email, password, name, phone, role) VALUES 
  (2, 'john@example.com', 'hashed_customer123', 'John Doe', '+1234567891', 'customer');

-- Insert restaurant tables (expanded inventory)
INSERT OR IGNORE INTO restaurant_tables (id, table_number, capacity, location, status) VALUES 
  (1, 'T01', 2, 'indoor', 'available'),
  (2, 'T02', 2, 'indoor', 'available'),
  (3, 'T03', 2, 'indoor', 'available'),
  (4, 'T04', 2, 'indoor', 'available'),
  (5, 'T05', 4, 'indoor', 'available'),
  (6, 'T06', 4, 'indoor', 'available'),
  (7, 'T07', 4, 'indoor', 'available'),
  (8, 'T08', 4, 'indoor', 'available'),
  (9, 'T09', 6, 'outdoor', 'available'),
  (10, 'T10', 6, 'outdoor', 'available'),
  (11, 'T11', 6, 'outdoor', 'available'),
  (12, 'T12', 8, 'patio', 'available'),
  (13, 'T13', 8, 'patio', 'available'),
  (14, 'T14', 8, 'patio', 'available'),
  (15, 'T15', 10, 'patio', 'available'),
  (16, 'T16', 10, 'patio', 'available'),
  (17, 'T17', 10, 'patio', 'available'),
  (18, 'T18', 4, 'indoor', 'available'),
  (19, 'T19', 6, 'outdoor', 'available'),
  (20, 'T20', 8, 'patio', 'available');

-- Insert menu categories
INSERT OR IGNORE INTO menu_categories (id, name, description, display_order) VALUES 
  (1, 'Appetizers', 'Start your meal with our delicious starters', 1),
  (2, 'Main Course', 'Our signature main dishes', 2),
  (3, 'Desserts', 'Sweet endings to your meal', 3),
  (4, 'Beverages', 'Refreshing drinks and beverages', 4),
  (5, 'Salads', 'Fresh and healthy salad options', 5);

-- Insert menu items - Appetizers
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (1, 'Bruschetta', 'Grilled bread with fresh tomatoes, basil, and olive oil', 105.0, 1, 0),
  (1, 'Chicken Wings', 'Crispy chicken wings with buffalo sauce', 135.0, 0, 1),
  (1, 'Mozzarella Sticks', 'Breaded mozzarella with marinara sauce', 110.0, 1, 0),
  (1, 'Spring Rolls', 'Crispy vegetable spring rolls with sweet chili sauce', 90.0, 1, 0),
  (1, 'Garlic Bread', 'Toasted bread with garlic butter and herbs', 75.0, 1, 0);

-- Insert menu items - Main Course
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (2, 'Grilled Salmon', 'Fresh Atlantic salmon with lemon butter sauce', 215.0, 0, 0),
  (2, 'Ribeye Steak', 'Premium 12oz ribeye steak with vegetables', 270.0, 0, 0),
  (2, 'Chicken Alfredo', 'Creamy fettuccine pasta with grilled chicken', 170.0, 0, 0),
  (2, 'Vegetable Stir Fry', 'Mixed vegetables in Asian sauce with rice', 145.0, 1, 1),
  (2, 'Margherita Pizza', 'Classic pizza with fresh mozzarella and basil', 140.0, 1, 0),
  (2, 'Lamb Chops', 'Grilled lamb chops with mint sauce', 245.0, 0, 0),
  (2, 'Seafood Paella', 'Spanish rice with mixed seafood', 225.0, 0, 0),
  (2, 'Mushroom Risotto', 'Creamy Italian rice with wild mushrooms', 155.0, 1, 0);

-- Insert menu items - Desserts
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (3, 'Tiramisu', 'Classic Italian coffee-flavored dessert', 85.0, 1, 0),
  (3, 'Chocolate Lava Cake', 'Warm chocolate cake with molten center', 90.0, 1, 0),
  (3, 'Cheesecake', 'New York style cheesecake with berry compote', 85.0, 1, 0),
  (3, 'Ice Cream Sundae', 'Three scoops with chocolate sauce and nuts', 75.0, 1, 0),
  (3, 'Crème Brûlée', 'French custard with caramelized sugar', 90.0, 1, 0);

-- Insert menu items - Beverages
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (4, 'Fresh Orange Juice', 'Freshly squeezed orange juice', 45.0, 1, 0),
  (4, 'Iced Coffee', 'Cold brew coffee with ice', 42.5, 1, 0),
  (4, 'Lemonade', 'Homemade fresh lemonade', 37.5, 1, 0),
  (4, 'Cappuccino', 'Italian coffee with steamed milk foam', 45.0, 1, 0),
  (4, 'Soft Drinks', 'Coca-Cola, Sprite, or Fanta', 27.5, 1, 0),
  (4, 'Sparkling Water', 'Perrier or San Pellegrino', 37.5, 1, 0);

-- Insert menu items - Salads
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (5, 'Caesar Salad', 'Romaine lettuce with Caesar dressing and croutons', 95.0, 1, 0),
  (5, 'Greek Salad', 'Fresh vegetables with feta cheese and olives', 105.0, 1, 0),
  (5, 'Caprese Salad', 'Tomatoes, mozzarella, basil with balsamic glaze', 115.0, 1, 0),
  (5, 'Chicken Caesar Salad', 'Caesar salad with grilled chicken breast', 125.0, 0, 0);

-- Insert sample booking
-- adjust booking to use existing table id (e.g., T03 which is now id 3)
INSERT OR IGNORE INTO bookings (user_id, table_id, booking_date, booking_time, guests_count, status, special_requests) VALUES 
  (2, 3, '2025-01-15', '19:00', 4, 'confirmed', 'Window seat preferred');
