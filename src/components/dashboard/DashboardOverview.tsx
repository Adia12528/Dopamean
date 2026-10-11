import React from 'react';
import { useStore } from '../../context/StoreContext';
import { 
  DollarSign, 
  ShoppingBag, 
  Tag, 
  Package, 
  Plus, 
  ArrowRight
} from 'lucide-react';

interface DashboardOverviewProps {
  onOpenAddProduct: () => void;
  onOpenAddOffer: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onOpenAddProduct, onOpenAddOffer }) => {
  const { products, offers, orders, setDashboardTab, settings } = useStore();

  const totalRevenue = orders.reduce((acc, order) => acc + order.total, 0);
  const activeOffersCount = offers.filter(o => o.isActive).length;
  const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'In Crafting').length;
  const lowStockCount = products.filter(p => p.stock <= 5).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* KPI Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px'
      }}>
        {/* Revenue */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Total Studio Sales
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-terracotta-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-terracotta)'
            }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.1
            }}>
              {settings.currency}{totalRevenue.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--accent-sage)', fontWeight: 600, marginTop: '6px' }}>
              ↑ Based on real and simulated orders
            </div>
          </div>
        </div>

        {/* Catalog items */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Active Products
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-sage-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-sage)'
            }}>
              <ShoppingBag size={18} />
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.1
            }}>
              {products.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: lowStockCount > 0 ? '#EA580C' : 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>
              {lowStockCount > 0 ? `⚠️ ${lowStockCount} items low on stock` : 'All items well stocked'}
            </div>
          </div>
        </div>

        {/* Active Offers */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Running Promotions
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-rose-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-rose)'
            }}>
              <Tag size={18} />
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.1
            }}>
              {activeOffersCount}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>
              {offers.length} total marketing banners
            </div>
          </div>
        </div>

        {/* Orders in progress */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Orders in Progress
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#FEF3C7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#B45309'
            }}>
              <Package size={18} />
            </div>
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.1
            }}>
              {pendingOrders}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>
              {orders.length} total lifetime orders
            </div>
          </div>
        </div>
      </div>

      {/* Quick Launchpad & Shortcuts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '20px'
      }}>
        {/* Add Product Shortcut Banner */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '22px',
          padding: '28px',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <span className="badge-yarn" style={{ marginBottom: '12px' }}>
              Inventory Action
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              Add Latest Product & Photos
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
              Upload new high-resolution images of your latest handcrafted totes, bucket hats, or amigurumi charms. Set prices, yarn composition, and craft time.
            </p>
          </div>

          <button
            onClick={onOpenAddProduct}
            className="btn-primary"
            style={{ width: 'fit-content' }}
          >
            <Plus size={16} />
            <span>Add New Product Now</span>
          </button>
        </div>

        {/* Launch Campaign Shortcut Banner */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '22px',
          padding: '28px',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <span className="badge-amber" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '999px',
              marginBottom: '12px'
            }}>
              Marketing Action
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              Create Seasonal Offer Banner
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
              Generate discount codes (e.g. 20% OFF, Free Gifts) and upload custom promotional banner imagery that dynamically features on your customer storefront.
            </p>
          </div>

          <button
            onClick={onOpenAddOffer}
            className="btn-secondary"
            style={{ width: 'fit-content' }}
          >
            <Tag size={16} />
            <span>Launch Offer Banner</span>
          </button>
        </div>
      </div>

      {/* Recent Activity Table Preview */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '22px',
        padding: '24px',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Recent Customer Orders
          </h4>
          <button
            onClick={() => setDashboardTab('orders')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.82rem',
              color: 'var(--accent-terracotta)',
              fontWeight: 600
            }}
          >
            <span>View All ({orders.length})</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orders.slice(0, 3).map(order => (
            <div
              key={order.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-surface-soft)',
                border: '1px solid var(--border-light)'
              }}
            >
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  #{order.id}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                  {order.customerName} ({order.items.length} items)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  backgroundColor: order.status === 'Delivered' ? 'var(--accent-sage-light)' : '#FEF3C7',
                  color: order.status === 'Delivered' ? 'var(--accent-sage)' : '#B45309'
                }}>
                  {order.status}
                </span>
                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-terracotta)' }}>
                  {settings.currency}{order.total.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
