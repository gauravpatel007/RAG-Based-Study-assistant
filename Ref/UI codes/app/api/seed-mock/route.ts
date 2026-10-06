import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

export async function GET() {
  try {
    const { rows: products } = await query('SELECT * FROM products WHERE active = true');
    if(products.length === 0) return NextResponse.json({ error: 'No products' });
    
    // Fetch tables
    const { rows: tables } = await query('SELECT * FROM tables');
    let orderCount = 0;
    const now = new Date();
    
    // Wipe previous mock to start fresh? No, we will just add 300.
    await query('DELETE FROM order_items');
    await query('DELETE FROM payment_transactions');
    await query('DELETE FROM customer_feedback');
    await query('DELETE FROM orders');

    for(let i = 0; i < 300; i++) {
        let orderDate;
        if(i < 80) {
           orderDate = new Date();
           orderDate.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0);
        } else if (i < 130) {
           orderDate = new Date();
           orderDate.setDate(orderDate.getDate() - 1);
           orderDate.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), 0);
        } else {
           const thirtyDaysAgo = new Date();
           thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
           orderDate = randomDate(thirtyDaysAgo, now);
        }

        const isTakeaway = Math.random() > 0.7;
        const table = (isTakeaway || tables.length === 0) ? null : tables[Math.floor(Math.random() * tables.length)];
        const orderNumber = `#ORD-MOCK-${1000 + i}`;
        
        const numItems = Math.floor(Math.random() * 4) + 1;
        const items = [];
        let subtotal = 0;
        let tax_total = 0;
        
        for(let j=0; j<numItems; j++) {
           const p = products[Math.floor(Math.random() * products.length)];
           const qty = Math.floor(Math.random() * 2) + 1;
           const price = Number(p.price);
           const taxRate = Number(p.tax_rate) || 0;
           
           items.push({
             product_id: p.id,
             product_name: p.name,
             quantity: qty,
             unit_price: price,
             tax_rate: taxRate
           });
           
           subtotal += price * qty;
           tax_total += (price * qty * taxRate) / 100;
        }
        
        const grand_total = subtotal + tax_total;
        
        const insertOrderResult = await query(`
          INSERT INTO orders (table_id, order_number, subtotal, tax_total, grand_total, status, payment_status, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
          RETURNING id
        `, [
          table ? table.id : null,
          orderNumber,
          subtotal,
          tax_total,
          grand_total,
          'paid',
          'paid',
          orderDate
        ]);
        
        const orderId = insertOrderResult.rows[0].id;
        
        for(let item of items) {
           await query(`
             INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, tax_rate)
             VALUES ($1, $2, $3, $4, $5, $6)
           `, [orderId, item.product_id, item.product_name, item.quantity, item.unit_price, item.tax_rate]);
        }
        
        const methods = ['cash', 'card', 'upi'];
        let method = methods[Math.floor(Math.random() * methods.length)];
        if (Math.random() < 0.6) method = 'upi';
        
        await query(`
          INSERT INTO payment_transactions (order_id, method, amount, status, created_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [orderId, method, grand_total, 'success', orderDate]);
        
        if(Math.random() < 0.3) {
            const ratings = [3, 4, 4, 5, 5, 5];
            const rating = ratings[Math.floor(Math.random() * ratings.length)];
            const comments = ['', 'Great food!', 'Fast service', 'A bit cold but okay.', 'Amazing latte!', 'Will come back!'];
            const comment = comments[Math.floor(Math.random() * comments.length)];
            await query(`
              INSERT INTO customer_feedback (order_id, rating, comment, created_at)
              VALUES ($1, $2, $3, $4)
            `, [orderId, rating, comment, orderDate]);
        }
        orderCount++;
    }
    return NextResponse.json({ success: true, count: orderCount });
  } catch(e: any) {
    return NextResponse.json({ success: false, error: e.stack || e.message }, { status: 200 });
  }
}
