-- Insert admin user (password: admin123)
INSERT OR IGNORE INTO users (id, email, password, name, phone, role) VALUES 
  (1, 'admin@restaurant.com', '$2a$10$rZ8qC9vZ8qC9vZ8qC9vZ8O', 'Admin User', '+1234567890', 'admin');

-- Insert sample customer (password: customer123)
INSERT OR IGNORE INTO users (id, email, password, name, phone, role) VALUES 
  (2, 'john@example.com', '$2a$10$rZ8qC9vZ8qC9vZ8qC9vZ8O', 'John Doe', '+1234567891', 'customer');

-- Insert restaurant tables
INSERT OR IGNORE INTO restaurant_tables (id, table_number, capacity, location, status) VALUES 
  (1, 'T01', 2, 'indoor', 'available'),
  (2, 'T02', 2, 'indoor', 'available'),
  (3, 'T03', 4, 'indoor', 'available'),
  (4, 'T04', 4, 'indoor', 'available'),
  (5, 'T05', 6, 'indoor', 'available'),
  (6, 'T06', 6, 'outdoor', 'available'),
  (7, 'T07', 8, 'outdoor', 'available'),
  (8, 'T08', 4, 'patio', 'available'),
  (9, 'T09', 2, 'patio', 'available'),
  (10, 'T10', 4, 'patio', 'available');

-- Insert menu categories
INSERT OR IGNORE INTO menu_categories (id, name, description, display_order) VALUES 
  (1, 'Appetizers', 'Start your meal with our delicious starters', 1),
  (2, 'Main Course', 'Our signature main dishes', 2),
  (3, 'Desserts', 'Sweet endings to your meal', 3),
  (4, 'Beverages', 'Refreshing drinks and beverages', 4),
  (5, 'Salads', 'Fresh and healthy salad options', 5);

-- Insert menu items - Appetizers
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (1, 'Bruschetta', 'Grilled bread with fresh tomatoes, basil, and olive oil', 8.99, 1, 0),
  (1, 'Chicken Wings', 'Crispy chicken wings with buffalo sauce', 12.99, 0, 1),
  (1, 'Mozzarella Sticks', 'Breaded mozzarella with marinara sauce', 9.99, 1, 0),
  (1, 'Spring Rolls', 'Crispy vegetable spring rolls with sweet chili sauce', 7.99, 1, 0),
  (1, 'Garlic Bread', 'Toasted bread with garlic butter and herbs', 5.99, 1, 0);

-- Insert menu items - Main Course
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (2, 'Grilled Salmon', 'Fresh Atlantic salmon with lemon butter sauce', 24.99, 0, 0),
  (2, 'Ribeye Steak', 'Premium 12oz ribeye steak with vegetables', 32.99, 0, 0),
  (2, 'Chicken Alfredo', 'Creamy fettuccine pasta with grilled chicken', 18.99, 0, 0),
  (2, 'Vegetable Stir Fry', 'Mixed vegetables in Asian sauce with rice', 15.99, 1, 1),
  (2, 'Margherita Pizza', 'Classic pizza with fresh mozzarella and basil', 16.99, 1, 0),
  (2, 'Lamb Chops', 'Grilled lamb chops with mint sauce', 29.99, 0, 0),
  (2, 'Seafood Paella', 'Spanish rice with mixed seafood', 26.99, 0, 0),
  (2, 'Mushroom Risotto', 'Creamy Italian rice with wild mushrooms', 17.99, 1, 0);

-- Insert menu items - Desserts
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (3, 'Tiramisu', 'Classic Italian coffee-flavored dessert', 8.99, 1, 0),
  (3, 'Chocolate Lava Cake', 'Warm chocolate cake with molten center', 9.99, 1, 0),
  (3, 'Cheesecake', 'New York style cheesecake with berry compote', 8.99, 1, 0),
  (3, 'Ice Cream Sundae', 'Three scoops with chocolate sauce and nuts', 7.99, 1, 0),
  (3, 'Crème Brûlée', 'French custard with caramelized sugar', 9.99, 1, 0);

-- Insert menu items - Beverages
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (4, 'Fresh Orange Juice', 'Freshly squeezed orange juice', 5.99, 1, 0),
  (4, 'Iced Coffee', 'Cold brew coffee with ice', 4.99, 1, 0),
  (4, 'Lemonade', 'Homemade fresh lemonade', 3.99, 1, 0),
  (4, 'Cappuccino', 'Italian coffee with steamed milk foam', 4.99, 1, 0),
  (4, 'Soft Drinks', 'Coca-Cola, Sprite, or Fanta', 2.99, 1, 0),
  (4, 'Sparkling Water', 'Perrier or San Pellegrino', 3.99, 1, 0);

-- Insert menu items - Salads
INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_vegetarian, is_spicy) VALUES 
  (5, 'Caesar Salad', 'Romaine lettuce with Caesar dressing and croutons', 10.99, 1, 0),
  (5, 'Greek Salad', 'Fresh vegetables with feta cheese and olives', 11.99, 1, 0),
  (5, 'Caprese Salad', 'Tomatoes, mozzarella, basil with balsamic glaze', 12.99, 1, 0),
  (5, 'Chicken Caesar Salad', 'Caesar salad with grilled chicken breast', 14.99, 0, 0);

-- Insert sample booking
INSERT OR IGNORE INTO bookings (user_id, table_id, booking_date, booking_time, guests_count, status, special_requests) VALUES 
  (2, 3, '2025-01-15', '19:00', 4, 'confirmed', 'Window seat preferred');
