'use client'
import { useState, useEffect } from 'react'
import { Search, Plus, Star, X, Trash2 } from 'lucide-react'
import ItemDetailsPanel from '@/components/ItemDetailsPanel'
import { menuItems as mockMenuItems, menuCategories as mockMenuCategories } from '@/lib/mockData'

const stockStyle: Record<string, string> = {
  available: 'badge-green',
  low:       'badge-orange',
  out:       'badge-red',
}

export default function ItemsPage() {
  const [categories, setCategories] = useState<string[]>(['All'])
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [productsList, setProductsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories')
      ])
      let hasProds = false
      let hasCats = false
      if (prodRes.ok) {
        const prods = await prodRes.json()
        if (Array.isArray(prods) && prods.length > 0) {
          setProductsList(prods)
          hasProds = true
        }
      }
      if (catRes.ok) {
        const cats = await catRes.json()
        if (Array.isArray(cats) && cats.length > 0) {
          setCategories(['All', ...cats.map((c: any) => c.name)])
          hasCats = true
        }
      }
      if (!hasProds) setProductsList(mockMenuItems as any)
      if (!hasCats) setCategories(mockMenuCategories)
    } catch (e) {
      console.error('API unavailable, rendering preview items', e)
      setProductsList(mockMenuItems as any)
      setCategories(mockMenuCategories)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenNew = () => {
    setSelectedItem(null)
    setIsPanelOpen(true)
  }

  const handleOpenEdit = (item: any) => {
    setSelectedItem({
      ...item,
      kitchenRouting: 'Main Kitchen',
      variants: []
    })
    setIsPanelOpen(true)
  }

  const handleSaveProduct = async (product: any) => {
    const isEdit = !!product.id
    try {
      const res = await fetch('/api/products', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      })
      if (res.ok) {
        await fetchData()
        setIsPanelOpen(false)
      }
    } catch (e) {
      console.error('Save failed', e)
    }
  }

  const handleAddCategory = () => {
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      setCategories([...categories, newCategoryName.trim()])
      setNewCategoryName('')
    }
  }

  const handleDeleteCategory = (cat: string) => {
    if (cat === 'All') return
    setCategories(categories.filter(c => c !== cat))
    if (activeCategory === cat) setActiveCategory('All')
  }

  const filtered = productsList.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  if (loading) return <div style={{ padding: 24 }}>Loading products...</div>

  return (
    <div className="animate-fade-in" style={{ position: 'relative' }}>
      
      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.5)', zIndex: 9991, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-slide-in" style={{ width: 420, background: 'var(--bg-card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Manage Categories</h3>
               <button onClick={() => setIsCategoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
             </div>
             
             <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <input 
                  type="text" 
                  placeholder="New category name..." 
                  className="form-input" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleAddCategory}>Add</button>
             </div>

             <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categories.filter(c => c !== 'All').map(cat => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-canvas)', borderRadius: 8 }}>
                     <span style={{ fontWeight: 600, fontSize: 14 }}>{cat}</span>
                     <button onClick={() => handleDeleteCategory(cat)} className="btn-icon" style={{ padding: 6, color: 'var(--accent-red)', border: 'none' }}><Trash2 size={16} /></button>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      <ItemDetailsPanel 
        isOpen={isPanelOpen} 
        onClose={() => setIsPanelOpen(false)} 
        onSave={handleSaveProduct}
        initialData={selectedItem} 
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Menu & Items</h1>
          <div className="page-subtitle">{productsList.length} items across {categories.length - 1} categories</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" id="items-category-btn" onClick={() => setIsCategoryModalOpen(true)}>Manage Categories</button>
          <button className="btn btn-primary btn-sm" id="add-item-btn" onClick={handleOpenNew}>
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      <div className="filter-bar">
        {categories.map(cat => (
          <button
            key={cat}
            className={`filter-pill${activeCategory === cat ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            id={`cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {cat}
          </button>
        ))}
        <div className="search-input-wrapper" style={{ width: 220, marginLeft: 'auto' }}>
          <Search size={14} className="search-icon" />
          <input
            type="text"
            placeholder="Search items…"
            className="search-input"
            id="items-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Tax</th>
              <th>Sold (Today)</th>
              <th>Rating</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} id={`item-row-${item.id}`} onClick={() => handleOpenEdit(item)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                  {item.image ? (
                    <img src={item.image} alt={item.name} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🍽️</div>
                  )}
                  {item.name}
                </td>
                <td>
                  <span className="badge badge-gray">{item.category || 'Uncategorized'}</span>
                </td>
                <td style={{ fontWeight: 700 }}>₹{item.price}</td>
                <td style={{ color: 'var(--text-muted)' }}>{item.tax}%</td>
                <td style={{ fontWeight: 500 }}>{item.sold || 0}</td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={12} fill="#f5a623" color="#f5a623" />
                    <span style={{ fontWeight: 600 }}>{item.rating || 0}</span>
                  </span>
                </td>
                <td>
                  <span className={`badge ${stockStyle[item.stock || 'available'] || 'badge-gray'}`}>{item.stock || 'available'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-title">No items found</div>
            <div className="empty-state-sub">Try a different category or search term</div>
          </div>
        )}
      </div>
    </div>
  )
}
