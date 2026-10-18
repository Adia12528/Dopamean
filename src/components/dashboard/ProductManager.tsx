import React, { useState } from 'react';
import type { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  LayoutGrid, 
  List 
} from 'lucide-react';

interface ProductManagerProps {
  onOpenAddModal: () => void;
  onEditProduct: (product: Product) => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({ onOpenAddModal, onEditProduct }) => {
  const { products, updateProduct, deleteProduct, settings } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('grid');
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});

  const filtered = products.filter(p => {
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    const matchesSearch = 
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.yarnType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleStockDelta = (product: Product, delta: number) => {
    const newStock = Math.max(0, product.stock + delta);
    updateProduct(product.id, { stock: newStock });
  };

  const saveStockDraft = (product: Product) => {
    const draft = stockDrafts[product.id];
    if (draft === undefined) return;
    if (!draft.trim()) {
      setStockDrafts(current => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      return;
    }
    const stock = Math.max(0, Math.floor(Number(draft) || 0));
    setStockDrafts(current => {
      const next = { ...current };
      delete next[product.id];
      return next;
    });
    if (stock !== product.stock) updateProduct(product.id, { stock });
  };

  const lowStockThreshold = settings.lowStockThreshold ?? 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top action bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: '#FFFFFF',
        padding: '18px 24px',
        borderRadius: '20px',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          {/* Search bar */}
          <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Filter products, yarn, tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 36px',
                borderRadius: '10px',
                border: '1px solid var(--border-medium)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Category dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-medium)',
              fontSize: '0.85rem',
              backgroundColor: '#FFFFFF',
              color: 'var(--text-main)'
            }}
          >
            <option value="All">All Categories ({products.length})</option>
            {Array.from(new Set(['Accessories', 'Hair Accessories', 'Rubber Bands', 'Hair Clips', 'Combos & Gift Sets', 'Bags & Totes', 'Headwear', 'Amigurumi & Charms', 'Coasters & Home', 'Wearables', ...products.map(p => p.category)])).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border-medium)', borderRadius: '10px', overflow: 'hidden' }}>
            <button
              onClick={() => setViewStyle('grid')}
              style={{
                padding: '8px 12px',
                backgroundColor: viewStyle === 'grid' ? 'var(--bg-surface-soft)' : '#FFFFFF',
                color: viewStyle === 'grid' ? 'var(--accent-terracotta)' : 'var(--text-muted)'
              }}
              title="Grid Cards View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewStyle('table')}
              style={{
                padding: '8px 12px',
                backgroundColor: viewStyle === 'table' ? 'var(--bg-surface-soft)' : '#FFFFFF',
                color: viewStyle === 'table' ? 'var(--accent-terracotta)' : 'var(--text-muted)'
              }}
              title="Table Inventory View"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Add Product Button */}
        <button
          onClick={onOpenAddModal}
          className="btn-primary"
          style={{ padding: '10px 20px' }}
        >
          <Plus size={18} />
          <span>Add New Product & Photos</span>
        </button>
      </div>

      {/* Product Content: Grid or Table */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px dashed var(--border-medium)'
        }}>
          <span style={{ fontSize: '2.5rem' }}>🧶</span>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '10px' }}>No products match your filters</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Try resetting the search or category filter.</p>
        </div>
      ) : viewStyle === 'grid' ? (
        /* GRID VIEW */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '20px'
        }}>
          {filtered.map(p => (
            <div
              key={p.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '18px',
                border: '1px solid var(--border-medium)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Product Image */}
              <div style={{ position: 'relative', height: '190px', backgroundColor: '#F8F5F0' }}>
                <img
                  src={p.image}
                  alt={p.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <span style={{
                  position: 'absolute',
                  top: '10px',
                  left: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.92)',
                  color: 'var(--accent-sage)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  textTransform: 'uppercase'
                }}>
                  {p.category}
                </span>

                {p.stock <= lowStockThreshold && (
                  <span style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    backgroundColor: p.stock === 0 ? '#DC2626' : '#EA580C',
                    color: '#FFFFFF',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '999px'
                  }}>
                    {p.stock === 0 ? 'Out of Stock' : `Low Stock: ${p.stock}`}
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    {p.title}
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    🧶 {p.yarnType} • {p.craftTimeHours}h craft
                  </p>
                </div>

                <div>
                  {/* Stock adjuster row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-surface-soft)',
                    marginBottom: '12px'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      In Studio Stock:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleStockDelta(p, -1)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--border-medium)',
                          fontWeight: 700,
                          fontSize: '0.9rem'
                        }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label={`Set stock for ${p.title}`}
                        value={stockDrafts[p.id] ?? p.stock}
                        onChange={(e) => setStockDrafts(current => ({ ...current, [p.id]: e.target.value }))}
                        onBlur={() => saveStockDraft(p)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        style={{ width: '58px', padding: '3px 4px', border: '1px solid var(--border-medium)', borderRadius: '6px', textAlign: 'center', fontWeight: 800 }}
                      />
                      <button
                        onClick={() => handleStockDelta(p, 1)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--border-medium)',
                          fontWeight: 700,
                          fontSize: '0.9rem'
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Price & actions */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-light)'
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      color: 'var(--accent-terracotta)'
                    }}>
                      {settings.currency}{p.price}
                    </span>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => onEditProduct(p)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-surface-soft)',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--text-main)'
                        }}
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Remove "${p.title}" from store?`)) {
                            deleteProduct(p.id);
                          }
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#DC2626',
                          cursor: 'pointer'
                        }}
                        title="Delete product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid var(--border-medium)',
          overflowX: 'auto',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '14px 20px' }}>Product</th>
                <th style={{ padding: '14px 20px' }}>Category</th>
                <th style={{ padding: '14px 20px' }}>Price</th>
                <th style={{ padding: '14px 20px' }}>Yarn Specs</th>
                <th style={{ padding: '14px 20px' }}>Stock Level</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={p.image}
                        alt=""
                        style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{p.title}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>ID: {p.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span className="badge-yarn" style={{ fontSize: '0.7rem' }}>{p.category}</span>
                  </td>
                  <td style={{ padding: '14px 20px', fontWeight: 800, color: 'var(--accent-terracotta)' }}>
                    {settings.currency}{p.price}
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {p.yarnType}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleStockDelta(p, -1)}
                        style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label={`Set stock for ${p.title}`}
                        value={stockDrafts[p.id] ?? p.stock}
                        onChange={(e) => setStockDrafts(current => ({ ...current, [p.id]: e.target.value }))}
                        onBlur={() => saveStockDraft(p)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        style={{ width: '58px', padding: '3px 4px', border: '1px solid var(--border-medium)', borderRadius: '6px', textAlign: 'center', fontWeight: 700, color: p.stock <= lowStockThreshold ? '#DC2626' : 'inherit' }}
                      />
                      <button
                        onClick={() => handleStockDelta(p, 1)}
                        style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--border-medium)' }}
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        onClick={() => onEditProduct(p)}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-medium)' }}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove "${p.title}"?`)) deleteProduct(p.id);
                        }}
                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#DC2626' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
