import React from 'react';
import { useStore } from '../../context/StoreContext';
import { Lock, Heart, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  const { settings, setIsAdminLoginModalOpen, setSelectedCategory, viewMode, isAdmin } = useStore();

  // If in dashboard mode, don't clutter with full storefront footer
  if (viewMode === 'dashboard') {
    return (
      <footer style={{
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-medium)',
        backgroundColor: '#FAF7F2'
      }}>
        <span>{settings.storeName || 'Dopamean'} Studio Dashboard • Handcrafted Management System</span>
      </footer>
    );
  }

  return (
    <footer style={{
      backgroundColor: '#FAF6F1',
      borderTop: '1px solid var(--border-medium)',
      marginTop: '60px',
      paddingTop: '48px',
      paddingBottom: '24px'
    }}>
      <div className="container" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '36px',
        marginBottom: '40px'
      }}>
        {/* Brand Column */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px' }}>🧶</span>
            <span style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.35rem',
              fontWeight: 700,
              color: 'var(--accent-terracotta)'
            }}>
              {settings.storeName || 'Dopamean'}
            </span>
          </div>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '14px' }}>
            {settings.footerAboutText || settings.storeTagline || 'Mindful stitches for everyday dopamine. Slow, artisanal slow fashion crafted in small batches with premium organic cotton.'}
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.74rem',
            color: 'var(--accent-sage)',
            fontWeight: 600
          }}>
            <Sparkles size={14} />
            <span>100% Hand-stitched with love</span>
          </div>
        </div>

        {/* Collections */}
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>
            Artisan Collections
          </h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
            {['Accessories', 'Hair Accessories', 'Rubber Bands', 'Hair Clips', 'Bags & Totes', 'Combos & Gift Sets'].map(cat => (
              <li key={cat}>
                <button
                  onClick={() => {
                    setSelectedCategory(cat);
                    const el = document.getElementById('catalog');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-terracotta)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  {cat}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Studio & Care */}
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>
            Studio Contact & Care
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '10px' }}>
            Hand wash cold with mild detergent. Reshape gently while damp and flat dry.
          </p>
          {settings.contactPhone && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
              WhatsApp / Call: <span style={{ color: 'var(--accent-terracotta)' }}>{settings.contactPhone}</span>
            </p>
          )}
          {settings.instagramHandle && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600, marginTop: '4px' }}>
              Instagram: <span style={{ color: 'var(--accent-terracotta)' }}>{settings.instagramHandle}</span>
            </p>
          )}
          {settings.contactEmail && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600, marginTop: '4px' }}>
              Support Email: <span style={{ color: 'var(--accent-terracotta)' }}>{settings.contactEmail}</span>
            </p>
          )}
          {settings.studioLocation && (
            <p style={{ fontSize: '0.80rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              📍 {settings.studioLocation}
            </p>
          )}
        </div>

        {/* Secure Shopping */}
        <div>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '14px' }}>
            Artisan Guarantee
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '12px' }}>
            Every piece is inspected for tensile strength, weave tension, and softness before dispatch.
          </p>
          <div style={{
            padding: '10px 14px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid var(--border-medium)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)'
          }}>
            {settings.shippingNotice || `Free shipping on orders over ${settings.currency}${settings.freeShippingThreshold || 299}`}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="container" style={{
        paddingTop: '20px',
        borderTop: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '0.78rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{settings.footerCopyright || `© ${new Date().getFullYear()} ${settings.storeName || 'Dopamean'}. Handcrafted Slow Fashion.`}</span>
          <Heart size={13} fill="var(--accent-rose)" color="var(--accent-rose)" />
          <span>Made with love</span>
        </div>

        {/* Discrete Admin Link for the store owner */}
        <div>
          {!isAdmin ? (
            <button
              onClick={() => setIsAdminLoginModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: 'var(--text-subtle)',
                cursor: 'pointer',
                fontSize: '0.76rem',
                textDecoration: 'underline'
              }}
              title="Super Admin / Artisan Login"
            >
              <Lock size={12} />
              <span>Studio Owner Portal</span>
            </button>
          ) : (
            <span style={{ color: 'var(--accent-sage)', fontWeight: 600 }}>
              ● Logged in as Super Admin
            </span>
          )}
        </div>
      </div>
    </footer>
  );
};
