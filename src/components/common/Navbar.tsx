import React from 'react';
import { useStore } from '../../context/StoreContext';
import { UserProfileMenu } from '../auth/UserProfileMenu';
import { 
  ShoppingBag, 
  LayoutDashboard, 
  Store, 
  Search, 
  Sparkles, 
  Plus,
  Lock,
  LogOut,
  Truck
} from 'lucide-react';


export const Navbar: React.FC = () => {
  const { 
    viewMode, 
    setViewMode, 
    cart, 
    setIsCartOpen, 
    searchQuery, 
    setSearchQuery,
    setDashboardTab,
    offers,
    settings,
    isAdmin,
    setIsAdminLoginModalOpen,
    setIsTrackingModalOpen,
    adminLogout
  } = useStore();

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const activeOffersCount = offers.filter(o => o.isActive).length;

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backgroundColor: 'rgba(250, 247, 242, 0.96)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-medium)',
      boxShadow: '0 2px 12px rgba(35, 28, 22, 0.04)'
    }}>
      {/* Super Admin Control Ribbon (Visible ONLY when logged in as Super Admin) */}
      {isAdmin && (
        <div style={{
          backgroundColor: '#1E293B',
          color: '#F8FAFC',
          padding: '6px 16px',
          fontSize: '0.78rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              backgroundColor: 'var(--accent-terracotta)',
              color: '#FFFFFF',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '999px',
              fontSize: '0.68rem',
              letterSpacing: '0.04em'
            }}>
              SUPER ADMIN ACTIVE
            </span>
            <span style={{ color: '#CBD5E1' }}>
              You have full studio privileges (product additions, offers, and settings). Normal visitors only see the customer storefront.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setViewMode(viewMode === 'store' ? 'dashboard' : 'store')}
              style={{
                color: '#38BDF8',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {viewMode === 'store' ? 'Open Studio Dashboard →' : '← Preview Storefront as Customer'}
            </button>

            <button
              onClick={adminLogout}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: '#FCA5A5',
                fontSize: '0.74rem',
                fontWeight: 600,
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                padding: '3px 8px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
              title="Logout from Super Admin mode"
            >
              <LogOut size={12} />
              <span>Exit Admin</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Announcement Bar */}
      <div style={{
        background: 'linear-gradient(90deg, #C85A32, #E07A5F, #C85A32)',
        color: '#FFFFFF',
        fontSize: '0.8rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        padding: '6px 16px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <Sparkles size={14} />
        <span>{settings.announcementText || 'Handmade in small batches with love'}</span>
        {activeOffersCount > 0 && (
          <span style={{
            background: 'rgba(255, 255, 255, 0.25)',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            marginLeft: '6px'
          }}>
            {activeOffersCount} Active Offers
          </span>
        )}
      </div>

      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '12px',
        paddingBottom: '12px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Brand Logo */}
        <div 
          onClick={() => setViewMode('store')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #FDE1D3, #F5C6B0)',
            border: '1.5px dashed var(--accent-terracotta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0
          }}>
            🧶
          </div>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.45rem',
                fontWeight: 700,
                color: 'var(--accent-terracotta)',
                letterSpacing: '-0.02em',
                lineHeight: 1
              }}>
                {settings.storeName || 'Dopamean'}
              </span>
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                color: '#FFFFFF',
                background: 'var(--accent-sage)',
                padding: '2px 5px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Studio
              </span>
            </div>
            <p style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              fontWeight: 500,
              marginTop: '2px'
            }}>
              {settings.storeTagline || 'Handcrafted Crochet Accessories'}
            </p>
          </div>
        </div>

        {/* Search bar (for storefront product filtering) */}
        <div style={{
          flex: '1',
          maxWidth: '400px',
          display: 'flex',
          alignItems: 'center',
          position: 'relative'
        }}>
          <Search size={17} style={{
            position: 'absolute',
            left: '14px',
            color: 'var(--text-subtle)'
          }} />
          <input
            type="text"
            placeholder="Search bags, bucket hats, charms, cozies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 16px 9px 40px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-medium)',
              backgroundColor: '#FFFFFF',
              fontSize: '0.86rem',
              color: 'var(--text-main)',
              outline: 'none',
              transition: 'var(--transition-smooth)'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent-terracotta)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-medium)'}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                fontSize: '0.8rem',
                color: 'var(--text-subtle)',
                padding: '2px 6px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Right Navigation & Action Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* If Super Admin is logged in, show the Switcher Controls */}
          {isAdmin && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface-soft)',
              padding: '3px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-medium)'
            }}>
              <button
                onClick={() => setViewMode('store')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: viewMode === 'store' ? '#FFFFFF' : 'var(--text-muted)',
                  backgroundColor: viewMode === 'store' ? 'var(--accent-terracotta)' : 'transparent',
                  boxShadow: viewMode === 'store' ? 'var(--shadow-sm)' : 'none',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <Store size={15} />
                <span>Store</span>
              </button>

              <button
                onClick={() => setViewMode('dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: viewMode === 'dashboard' ? '#FFFFFF' : 'var(--text-muted)',
                  backgroundColor: viewMode === 'dashboard' ? 'var(--accent-sage)' : 'transparent',
                  boxShadow: viewMode === 'dashboard' ? 'var(--shadow-sm)' : 'none',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <LayoutDashboard size={15} />
                <span>Studio</span>
              </button>
            </div>
          )}

          {/* Normal User & Storefront Customer: Track Order Button */}
          {viewMode === 'store' && (
            <>
              <button
                onClick={() => setIsTrackingModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-terracotta)';
                  e.currentTarget.style.color = 'var(--accent-terracotta)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                  e.currentTarget.style.color = 'var(--text-main)';
                }}
              >
                <Truck size={16} />
                <span>Track Order</span>
              </button>

              {/* User Account (Sign In or Avatar Menu) */}
              <UserProfileMenu />
            </>
          )}


          {/* If Super Admin is currently on Dashboard, show Add Product Shortcut */}
          {isAdmin && viewMode === 'dashboard' ? (
            <button
              onClick={() => setDashboardTab('products')}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              <Plus size={16} />
              <span>Add Product</span>
            </button>
          ) : (
            /* Normal User & Storefront Customer: Shopping Cart Drawer Button */
            <button
              onClick={() => setIsCartOpen(true)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: '#FFFFFF',
                border: '1.5px solid var(--accent-terracotta)',
                color: 'var(--accent-terracotta)',
                fontWeight: 600,
                fontSize: '0.88rem',
                boxShadow: 'var(--shadow-sm)',
                transition: 'var(--transition-smooth)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-terracotta)';
                e.currentTarget.style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.color = 'var(--accent-terracotta)';
              }}
            >
              <ShoppingBag size={18} />
              <span>Cart</span>
              {totalCartCount > 0 && (
                <span style={{
                  background: 'var(--accent-rose)',
                  color: '#FFFFFF',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  marginLeft: '2px'
                }}>
                  {totalCartCount}
                </span>
              )}
            </button>
          )}

          {/* Discrete Super Admin Lock Icon Button (for store owners when not logged in) */}
          {!isAdmin && (
            <button
              onClick={() => setIsAdminLoginModalOpen(true)}
              title="Studio Artisan / Super Admin Portal"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-surface-soft)';
                e.currentTarget.style.color = 'var(--accent-terracotta)';
                e.currentTarget.style.borderColor = 'var(--accent-terracotta)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.borderColor = 'var(--border-medium)';
              }}
            >
              <Lock size={13} />
              <span>Admin</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
