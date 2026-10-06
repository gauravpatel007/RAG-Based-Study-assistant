import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const menuCategories = [
  { name: 'Coffee & Tea' },
  { name: 'Chilled Refreshers' },
  { name: 'Bakery & Sweets' },
  { name: 'Quick Bites & Sandwiches' },
  { name: 'Meals & Bowls' }
];

const menuItems = [
  // Coffee & Tea
  { name: 'Classic Cappuccino', cat: 'Coffee & Tea', price: 180, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Cappuccino_at_Sightglass_Coffee.jpg', variants: [{name: 'Grande', option: 'Size', extraPrice: 40}] },
  { name: 'Iced Latte', cat: 'Coffee & Tea', price: 200, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Latte_Macchiato_Iced.jpg' },
  { name: 'Rich Espresso', cat: 'Coffee & Tea', price: 140, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Tazzina_di_caff%C3%A8_a_Ventimiglia.jpg' },
  { name: 'South Indian Filter Coffee', cat: 'Coffee & Tea', price: 90, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/South_Indian_Filter_Coffee.jpg' },
  { name: 'Authentic Masala Chai', cat: 'Coffee & Tea', price: 80, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/2/23/Masala_Chai.JPG' },

  // Chilled Refreshers
  { name: 'Alphonso Mango Lassi', cat: 'Chilled Refreshers', price: 160, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Mango_Lassi.jpg' },
  { name: 'Fresh Lime Mint Soda', cat: 'Chilled Refreshers', price: 120, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Nimbu_Pani.jpg' },
  { name: 'Virgin Mojito', cat: 'Chilled Refreshers', price: 190, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Mojito98775.jpeg/800px-Mojito98775.jpeg' },

  // Bakery & Sweets
  { name: 'Butter Croissant', cat: 'Bakery & Sweets', price: 150, tax: 12, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Croissant-02.jpg/800px-Croissant-02.jpg' },
  { name: 'Double Chocolate Muffin', cat: 'Bakery & Sweets', price: 160, tax: 12, stock: 'low', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Muffin_NIH.jpg/800px-Muffin_NIH.jpg' },
  { name: 'New York Cheesecake', cat: 'Bakery & Sweets', price: 290, tax: 12, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Cheesecake_with_strawberries.jpg/800px-Cheesecake_with_strawberries.jpg' },
  { name: 'Gulab Jamun (2 pcs)', cat: 'Bakery & Sweets', price: 120, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Gulab_jamun_%28Dessert%29.jpg' },

  // Quick Bites & Sandwiches
  { name: 'Avocado Sourdough Toast', cat: 'Quick Bites & Sandwiches', price: 320, tax: 12, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Avocado_toast_%2845667746465%29.jpg/800px-Avocado_toast_%2845667746465%29.jpg' },
  { name: 'Grilled Chicken Club Sandwich', cat: 'Quick Bites & Sandwiches', price: 280, tax: 12, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/2/29/Club_sandwich.png' },
  { name: 'Spiced Potato Samosa (2 pcs)', cat: 'Quick Bites & Sandwiches', price: 80, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Samosachutney.jpg' },
  { name: 'Mumbai Pav Bhaji', cat: 'Quick Bites & Sandwiches', price: 210, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Pav_Bhaji.jpg' },

  // Meals & Bowls
  { name: 'Classic Masala Dosa', cat: 'Meals & Bowls', price: 180, tax: 5, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/3/34/Paper_Masala_Dosa.jpg' },
  { name: 'Paneer Butter Masala Combo', cat: 'Meals & Bowls', price: 340, tax: 12, stock: 'available', image: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Paneer_Butter_Masala.jpg' },
  { name: 'Authentic Hyderabadi Veg Biryani', cat: 'Meals & Bowls', price: 290, tax: 12, stock: 'low', image: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Veg_Biryani.jpg' },
];

export async function GET() {
  try {
    // Enable image_url column if not present
    await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000);`);
    
    // Clear existing products and categories
    await query(`DELETE FROM order_items;`);
    await query(`DELETE FROM products;`);
    await query(`DELETE FROM categories;`);
    await query(`ALTER SEQUENCE categories_id_seq RESTART WITH 1;`);
    await query(`ALTER SEQUENCE products_id_seq RESTART WITH 1;`);

    // Insert categories
    const catMap: Record<string, number> = {};
    for (const cat of menuCategories) {
      const res = await query(`INSERT INTO categories (name) VALUES ($1) RETURNING id`, [cat.name]);
      catMap[cat.name] = res.rows[0].id;
    }

    // Insert products
    for (const item of menuItems) {
      await query(`
        INSERT INTO products (category_id, name, price, tax_rate, description, stock_status, variants, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        catMap[item.cat], item.name, item.price, item.tax, 'Freshly prepared and delicious.', item.stock, 
        JSON.stringify(item.variants || []), item.image
      ]);
    }

    return NextResponse.json({ success: true, message: 'Seeded successfully' });
  } catch(e: any) {
    return NextResponse.json({ success: false, error: e.stack || e.message }, { status: 200 });
  }
}
