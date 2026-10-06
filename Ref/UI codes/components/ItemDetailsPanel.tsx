'use client'
import { useState } from 'react'
import { X, Image as ImageIcon, Plus, Trash2 } from 'lucide-react'

// Dummy type based on Odoo backend
type Product = {
  id?: number
  name: string
  category: string
  price: number
  tax: number
  stock: string
  kitchenRouting: string
  variants: { name: string; option: string; extraPrice: number }[]
  image?: string
}

const KITCHEN_DISPLAYS = ['Main Kitchen', 'Beverage Counter', 'Dessert Station', 'None']
const CATEGORIES = ['Breakfast', 'Main Course', 'Beverages', 'Desserts', 'Snacks']

export default function ItemDetailsPanel({
  isOpen,
  onClose,
  onSave,
  initialData
}: {
  isOpen: boolean
  onClose: () => void
  onSave?: (product: Product) => void
  initialData?: Product | null
}) {
  const [product, setProduct] = useState<Product>(
    initialData || {
      name: '',
      category: 'Main Course',
      price: 0,
      tax: 5,
      stock: 'available',
      kitchenRouting: 'Main Kitchen',
      variants: []
    }
  )

  if (!isOpen) return null

  const handleCreateVariant = () => {
    setProduct({
      ...product,
      variants: [...product.variants, { name: 'Size', option: 'Large', extraPrice: 0 }]
    })
  }

  const handleRemoveVariant = (index: number) => {
    const newVariants = [...product.variants]
    newVariants.splice(index, 1)
    setProduct({ ...product, variants: newVariants })
  }

  return (
    <>
      <div 
        className="panel-backdrop" 
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999
        }}
        onClick={onClose}
      />
      
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div 
          className="slide-panel animate-slide-in"
          style={{
            width: '600px', maxHeight: '90vh', backgroundColor: 'var(--bg-card)', 
            borderRadius: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            display: 'flex', flexDirection: 'column', pointerEvents: 'auto',
            animation: 'slideIn 0.2s ease forwards'
          }}
        >
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          
          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{initialData ? 'Edit Item' : 'Create Item'}</h2>
            <button onClick={onClose} className="btn-icon" style={{ border: 'none' }}><X size={18} /></button>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
            
            {/* Section 1: Image Gallery */}
            <div style={{ marginBottom: 28 }}>
              <label className="form-label">Product Image (Gallery)</label>
              <div 
                style={{ 
                  height: 140, border: '1px dashed var(--border-default)', 
                  borderRadius: 'var(--radius-lg)', display: 'flex', 
                  flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'var(--bg-canvas)', cursor: 'pointer', transition: 'all var(--transition-fast)',
                  position: 'relative', overflow: 'hidden'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-default)'}
              >
                <input 
                  type="file" 
                  accept="image/png, image/jpeg, image/jpg" 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 2 }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0]
                      const reader = new FileReader()
                      reader.onloadend = () => {
                        setProduct({ ...product, image: reader.result as string })
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                />
                {(product as any).image ? (
                  <img src={(product as any).image} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain', zIndex: 1 }} />
                ) : (
                  <>
                    <ImageIcon size={32} color="var(--text-muted)" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13, color: 'var(--accent-blue)', fontWeight: 600 }}>Click to upload</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>Supports JPG, PNG (Max 5MB)</div>
                  </>
                )}
              </div>
            </div>

          {/* Section 2: Basic Info */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>Basic Details</h3>
            
            <div className="form-group">
              <label className="form-label">Item Name</label>
              <input type="text" className="form-input" value={product.name} onChange={e => setProduct({...product, name: e.target.value})} placeholder="e.g. Masala Dosa" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input form-select" value={product.category} onChange={e => setProduct({...product, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Kitchen Routing</label>
                <select className="form-input form-select" value={product.kitchenRouting} onChange={e => setProduct({...product, kitchenRouting: e.target.value})}>
                  {KITCHEN_DISPLAYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Pricing & Tax */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>Pricing & Tax</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Base Price (₹)</label>
                <input type="number" className="form-input" value={product.price} onChange={e => setProduct({...product, price: parseFloat(e.target.value) || 0})} />
              </div>
              <div className="form-group">
                <label className="form-label">Tax Rate (%)</label>
                <select className="form-input form-select" value={product.tax} onChange={e => setProduct({...product, tax: parseFloat(e.target.value)})}>
                  <option value={0}>0% (Tax Exempt)</option>
                  <option value={5}>5% (Food/Beverage)</option>
                  <option value={12}>12% (Standard)</option>
                  <option value={18}>18% (Premium)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Variants */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
               <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Product Variants</h3>
               <button onClick={handleCreateVariant} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }}>
                 <Plus size={12} /> Add Variant
               </button>
            </div>
            
            {product.variants.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', background: 'var(--bg-canvas)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                No variants configured. Use variants for sizes (Small/Large) or customizations.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {product.variants.map((variant, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', background: 'var(--bg-canvas)', padding: 12, borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Type (e.g. Size)</label>
                      <input type="text" className="form-input" style={{ padding: '6px 10px', fontSize: 12.5 }} value={variant.name} onChange={e => {
                        const v = [...product.variants]; v[i].name = e.target.value; setProduct({...product, variants: v});
                      }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Option (e.g. Large)</label>
                      <input type="text" className="form-input" style={{ padding: '6px 10px', fontSize: 12.5 }} value={variant.option} onChange={e => {
                        const v = [...product.variants]; v[i].option = e.target.value; setProduct({...product, variants: v});
                      }} />
                    </div>
                    <div style={{ width: 80 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Extra (₹)</label>
                      <input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: 12.5 }} value={variant.extraPrice} onChange={e => {
                        const v = [...product.variants]; v[i].extraPrice = parseFloat(e.target.value)||0; setProduct({...product, variants: v});
                      }} />
                    </div>
                    <button className="btn-icon" style={{ padding: '8px', border: 'none', background: 'transparent' }} onClick={() => handleRemoveVariant(i)}>
                      <Trash2 size={16} color="var(--accent-red)" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-card)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if(onSave) onSave(product); onClose(); }}>
            {initialData ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
        </div>
      </div>
    </>
  )
}
