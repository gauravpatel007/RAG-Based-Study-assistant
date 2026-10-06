// ── Sales chart data ────────────────────────────────────────────
export const salesChartData = [
  { time: '8am',  today: 0,    yesterday: 1200 },
  { time: '9am',  today: 3200, yesterday: 2100 },
  { time: '10am', today: 5800, yesterday: 4300 },
  { time: '11am', today: 8400, yesterday: 6900 },
  { time: '12pm', today: 14200,yesterday: 11800},
  { time: '1pm',  today: 18900,yesterday: 15200},
  { time: '2pm',  today: 22100,yesterday: 18400},
  { time: '3pm',  today: 25600,yesterday: 21100},
  { time: '4pm',  today: 28300,yesterday: 23900},
  { time: '5pm',  today: 32100,yesterday: 27600},
  { time: '6pm',  today: 38400,yesterday: 31200},
  { time: '7pm',  today: 44800,yesterday: 38900},
  { time: '8pm',  today: 49200,yesterday: 42300},
]

export const weeklyData = [
  { day: 'Mon', sales: 38400, orders: 124 },
  { day: 'Tue', sales: 42100, orders: 138 },
  { day: 'Wed', sales: 36800, orders: 112 },
  { day: 'Thu', sales: 51200, orders: 162 },
  { day: 'Fri', sales: 67400, orders: 208 },
  { day: 'Sat', sales: 82100, orders: 251 },
  { day: 'Sun', sales: 71300, orders: 219 },
]

// ── Recent Orders ────────────────────────────────────────────────
export const recentOrders = [
  { id: '#ORD-1042', table: 'Table 7',  items: 4, amount: 1840, status: 'paid',      time: '2 min ago',  staff: 'Riya S.'  },
  { id: '#ORD-1041', table: 'Table 3',  items: 2, amount: 680,  status: 'kitchen',   time: '8 min ago',  staff: 'Arjun K.' },
  { id: '#ORD-1040', table: 'Table 12', items: 6, amount: 2960, status: 'confirmed', time: '12 min ago', staff: 'Priya M.' },
  { id: '#ORD-1039', table: 'Table 1',  items: 3, amount: 1120, status: 'paid',      time: '18 min ago', staff: 'Riya S.'  },
  { id: '#ORD-1038', table: 'Takeaway', items: 1, amount: 340,  status: 'paid',      time: '25 min ago', staff: 'Arjun K.' },
  { id: '#ORD-1037', table: 'Table 5',  items: 5, amount: 2180, status: 'paid',      time: '31 min ago', staff: 'Priya M.' },
]

// ── Kitchen Tickets ──────────────────────────────────────────────
export const kitchenTickets = [
  {
    id: 'KT-201', orderId: '#ORD-1041', table: 'Table 3',
    priority: 'high', status: 'preparing', elapsed: '08:14',
    items: [
      { name: 'Masala Dosa',       qty: 1, done: false },
      { name: 'Filter Coffee',     qty: 2, done: true  },
    ]
  },
  {
    id: 'KT-202', orderId: '#ORD-1040', table: 'Table 12',
    priority: 'normal', status: 'to_cook', elapsed: '02:05',
    items: [
      { name: 'Paneer Butter Masala', qty: 2, done: false },
      { name: 'Butter Naan',          qty: 4, done: false },
      { name: 'Mango Lassi',          qty: 2, done: false },
    ]
  },
  {
    id: 'KT-203', orderId: '#ORD-1043', table: 'Table 9',
    priority: 'urgent', status: 'to_cook', elapsed: '00:45',
    items: [
      { name: 'Veg Biryani',  qty: 1, done: false },
      { name: 'Raita',        qty: 1, done: false },
      { name: 'Gulab Jamun',  qty: 2, done: false },
    ]
  },
  {
    id: 'KT-200', orderId: '#ORD-1039', table: 'Table 1',
    priority: 'normal', status: 'completed', elapsed: '14:30',
    items: [
      { name: 'Idli Sambar', qty: 2, done: true },
      { name: 'Vada',        qty: 2, done: true },
    ]
  },
]

// ── Floor / Tables ───────────────────────────────────────────────
export const floors = [
  {
    id: 1, name: 'Ground Floor',
    tables: [
      { id: 1,  name: 'T1',  capacity: 2, status: 'available', order: null          },
      { id: 2,  name: 'T2',  capacity: 4, status: 'occupied',  order: '#ORD-1040', duration: '38 min', amount: 2960 },
      { id: 3,  name: 'T3',  capacity: 4, status: 'occupied',  order: '#ORD-1041', duration: '12 min', amount: 680  },
      { id: 4,  name: 'T4',  capacity: 6, status: 'available', order: null          },
      { id: 5,  name: 'T5',  capacity: 4, status: 'available', order: null          },
      { id: 6,  name: 'T6',  capacity: 2, status: 'reserved',  order: null,         reservation: '7:30 PM' },
      { id: 7,  name: 'T7',  capacity: 8, status: 'occupied',  order: '#ORD-1042', duration: '45 min', amount: 1840 },
      { id: 8,  name: 'T8',  capacity: 4, status: 'available', order: null          },
      { id: 9,  name: 'T9',  capacity: 4, status: 'occupied',  order: '#ORD-1043', duration: '4 min',  amount: 0   },
      { id: 10, name: 'T10', capacity: 2, status: 'maintenance',order: null         },
    ]
  },
  {
    id: 2, name: 'First Floor',
    tables: [
      { id: 11, name: 'T11', capacity: 4,  status: 'available', order: null },
      { id: 12, name: 'T12', capacity: 6,  status: 'occupied',  order: '#ORD-1044', duration: '22 min', amount: 1540 },
      { id: 13, name: 'T13', capacity: 10, status: 'reserved',  order: null, reservation: '8:00 PM' },
      { id: 14, name: 'T14', capacity: 2,  status: 'available', order: null },
      { id: 15, name: 'T15', capacity: 4,  status: 'available', order: null },
    ]
  }
]

// ── Menu Items ───────────────────────────────────────────────────
export const menuCategories = ['All', 'Breakfast', 'Main Course', 'Beverages', 'Desserts', 'Snacks']

export const menuItems = [
  { id: 1,  name: 'Masala Dosa',          category: 'Breakfast',    price: 120, tax: 5,  stock: 'available', sold: 284, rating: 4.8 },
  { id: 2,  name: 'Idli Sambar (2 pcs)',  category: 'Breakfast',    price: 80,  tax: 5,  stock: 'available', sold: 312, rating: 4.7 },
  { id: 3,  name: 'Vada',                 category: 'Breakfast',    price: 60,  tax: 5,  stock: 'available', sold: 198, rating: 4.5 },
  { id: 4,  name: 'Paneer Butter Masala', category: 'Main Course',  price: 280, tax: 12, stock: 'available', sold: 176, rating: 4.9 },
  { id: 5,  name: 'Butter Naan',          category: 'Main Course',  price: 50,  tax: 5,  stock: 'available', sold: 402, rating: 4.6 },
  { id: 6,  name: 'Veg Biryani',          category: 'Main Course',  price: 220, tax: 12, stock: 'low',       sold: 144, rating: 4.8 },
  { id: 7,  name: 'Dal Makhani',          category: 'Main Course',  price: 200, tax: 12, stock: 'available', sold: 132, rating: 4.7 },
  { id: 8,  name: 'Filter Coffee',        category: 'Beverages',    price: 60,  tax: 5,  stock: 'available', sold: 521, rating: 4.9 },
  { id: 9,  name: 'Masala Chai',          category: 'Beverages',    price: 40,  tax: 5,  stock: 'available', sold: 389, rating: 4.8 },
  { id: 10, name: 'Mango Lassi',          category: 'Beverages',    price: 100, tax: 5,  stock: 'available', sold: 203, rating: 4.7 },
  { id: 11, name: 'Fresh Lime Soda',      category: 'Beverages',    price: 80,  tax: 5,  stock: 'available', sold: 167, rating: 4.5 },
  { id: 12, name: 'Gulab Jamun',          category: 'Desserts',     price: 80,  tax: 5,  stock: 'available', sold: 148, rating: 4.9 },
  { id: 13, name: 'Rasgulla',             category: 'Desserts',     price: 70,  tax: 5,  stock: 'out',       sold: 96,  rating: 4.6 },
  { id: 14, name: 'Samosa (2 pcs)',       category: 'Snacks',       price: 60,  tax: 5,  stock: 'available', sold: 231, rating: 4.5 },
  { id: 15, name: 'Pav Bhaji',            category: 'Snacks',       price: 140, tax: 5,  stock: 'low',       sold: 189, rating: 4.8 },
]

// ── Staff ────────────────────────────────────────────────────────
export const staffMembers = [
  { id: 1, name: 'Riya Sharma',   role: 'Manager',   status: 'active',   orders: 42, sales: 38400, shift: '9AM–5PM',  avatar: 'RS' },
  { id: 2, name: 'Arjun Kumar',   role: 'Cashier',   status: 'active',   orders: 38, sales: 28900, shift: '9AM–5PM',  avatar: 'AK' },
  { id: 3, name: 'Priya Mehta',   role: 'Cashier',   status: 'active',   orders: 31, sales: 22100, shift: '1PM–9PM',  avatar: 'PM' },
  { id: 4, name: 'Karan Patel',   role: 'Waiter',    status: 'active',   orders: 28, sales: 19800, shift: '9AM–5PM',  avatar: 'KP' },
  { id: 5, name: 'Sneha Joshi',   role: 'Waiter',    status: 'break',    orders: 19, sales: 14200, shift: '1PM–9PM',  avatar: 'SJ' },
  { id: 6, name: 'Rahul Singh',   role: 'Kitchen',   status: 'active',   orders: 0,  sales: 0,     shift: '8AM–4PM',  avatar: 'RS' },
  { id: 7, name: 'Meena Rao',     role: 'Kitchen',   status: 'active',   orders: 0,  sales: 0,     shift: '12PM–8PM', avatar: 'MR' },
  { id: 8, name: 'Dev Verma',     role: 'Cashier',   status: 'off',      orders: 0,  sales: 0,     shift: 'Off Today', avatar: 'DV' },
]

// ── Customers ────────────────────────────────────────────────────
export const customers = [
  { id: 1,  name: 'Amit Sharma',      phone: '+91 98765 43210', visits: 24, totalSpend: 18400, lastVisit: 'Today',      loyalty: 'Gold'   },
  { id: 2,  name: 'Priti Desai',      phone: '+91 87654 32109', visits: 18, totalSpend: 12800, lastVisit: 'Yesterday',   loyalty: 'Silver' },
  { id: 3,  name: 'Rohan Gupta',      phone: '+91 76543 21098', visits: 31, totalSpend: 26100, lastVisit: 'Today',       loyalty: 'Gold'   },
  { id: 4,  name: 'Anjali Nair',      phone: '+91 65432 10987', visits: 8,  totalSpend: 5200,  lastVisit: '3 days ago',  loyalty: 'Bronze' },
  { id: 5,  name: 'Sanjay Mehta',     phone: '+91 54321 09876', visits: 12, totalSpend: 8900,  lastVisit: '1 week ago',  loyalty: 'Silver' },
  { id: 6,  name: 'Kavya Reddy',      phone: '+91 43210 98765', visits: 45, totalSpend: 38600, lastVisit: 'Today',       loyalty: 'Platinum'},
  { id: 7,  name: 'Vikram Bose',      phone: '+91 32109 87654', visits: 5,  totalSpend: 3100,  lastVisit: '2 weeks ago', loyalty: 'Bronze' },
  { id: 8,  name: 'Deepa Krishnan',   phone: '+91 21098 76543', visits: 22, totalSpend: 16800, lastVisit: '2 days ago',  loyalty: 'Gold'   },
]

// ── Payment Methods ──────────────────────────────────────────────
export const paymentBreakdown = [
  { method: 'Cash',        amount: 18400, pct: 37, color: '#1a1a1a' },
  { method: 'UPI',         amount: 14200, pct: 29, color: '#006aff' },
  { method: 'Card',        amount: 11800, pct: 24, color: '#00b259' },
  { method: 'Online',      amount: 4900,  pct: 10, color: '#f5a623' },
]

// ── Payment Transactions ─────────────────────────────────────────
export const transactions = [
  { id: 'TXN-8821', order: '#ORD-1042', method: 'UPI',  amount: 1840, status: 'success', time: '2 min ago',  cashier: 'Arjun K.' },
  { id: 'TXN-8820', order: '#ORD-1039', method: 'Cash', amount: 1120, status: 'success', time: '18 min ago', cashier: 'Riya S.'  },
  { id: 'TXN-8819', order: '#ORD-1038', method: 'Card', amount: 340,  status: 'success', time: '25 min ago', cashier: 'Arjun K.' },
  { id: 'TXN-8818', order: '#ORD-1037', method: 'UPI',  amount: 2180, status: 'success', time: '31 min ago', cashier: 'Priya M.' },
  { id: 'TXN-8817', order: '#ORD-1036', method: 'Cash', amount: 780,  status: 'refunded',time: '45 min ago', cashier: 'Riya S.'  },
  { id: 'TXN-8816', order: '#ORD-1035', method: 'Card', amount: 1560, status: 'success', time: '1 hr ago',   cashier: 'Arjun K.' },
]
