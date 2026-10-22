import React, { useState } from 'react';
import { useBackNavigationLayer } from '../../context/BackNavigationContext';
import { useStore } from '../../context/StoreContext';
import { Lock, Heart, Sparkles, MessageCircle, X } from 'lucide-react';
import { createWhatsAppUrl } from '../../lib/whatsapp';

interface BulkOrderDetails {
  items: string;
  quantity: string;
  neededBy: string;
  company: string;
  contactName: string;
  designation: string;
  phone: string;
}

const EMPTY_BULK_ORDER: BulkOrderDetails = {
  items: '',
  quantity: '',
  neededBy: '',
  company: '',
  contactName: '',
  designation: '',
  phone: ''
};

export const Footer: React.FC = () => {
  const { settings, setIsAdminLoginModalOpen, setSelectedCategory, viewMode, isAdmin } = useStore();
  const [isBulkOrderOpen, setIsBulkOrderOpen] = useState(false);
  useBackNavigationLayer('bulk-order-dialog', isBulkOrderOpen, () => setIsBulkOrderOpen(false));
  const [bulkOrder, setBulkOrder] = useState(EMPTY_BULK_ORDER);
  const minimumBulkOrderQuantity = Math.max(1, Math.floor(Number(settings.bulkOrderMinimumQuantity ?? 10)));

  const handleBulkOrderSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const hasBlankValue = Object.values(bulkOrder).some(value => !value.trim());
    if (hasBlankValue) {
      window.alert('Please fill in every required bulk order detail. The WhatsApp inquiry cannot be sent until all fields are complete.');
      form.reportValidity();
      return;
    }
    if (Number(bulkOrder.quantity) < minimumBulkOrderQuantity) {
      window.alert(`Bulk orders require at least ${minimumBulkOrderQuantity} pieces.`);
      form.reportValidity();
      return;
    }
    if (!form.checkValidity()) {
      window.alert('Please check the required bulk order details and correct any invalid values.');
      form.reportValidity();
      return;
    }

    const message = [
      `Bulk order inquiry for ${settings.storeName || 'the store'}`,
      '',
      `Items / requirements: ${bulkOrder.items.trim()}`,
      `Quantity: ${bulkOrder.quantity.trim()}`,
      `Needed by: ${new Date(`${bulkOrder.neededBy}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      `Company: ${bulkOrder.company.trim()}`,
      `Contact name: ${bulkOrder.contactName.trim()}`,
      `Designation: ${bulkOrder.designation.trim()}`,
      `Phone: ${bulkOrder.phone.trim()}`
    ].join('\n');
    const whatsappUrl = createWhatsAppUrl(
      settings.whatsappBusinessPhone || settings.contactPhone || '',
      message,
      settings.whatsappCountryCode || '91'
    );

    if (!whatsappUrl) {
      window.alert('The store WhatsApp number is unavailable. Please contact the store directly.');
      return;
    }

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setIsBulkOrderOpen(false);
    setBulkOrder(EMPTY_BULK_ORDER);
  };

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

      {settings.bulkOrderInquiryEnabled !== false && settings.whatsappEnabled !== false && (
        <section className="container footer-bulk-order">
          <div>
            <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}>Planning a bulk order?</h4>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Minimum {minimumBulkOrderQuantity} pieces. Share your deadline and contact details to start an inquiry.</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setIsBulkOrderOpen(true)}>
            <MessageCircle size={17} />
            <span>Request a bulk order</span>
          </button>
        </section>
      )}

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

      {isBulkOrderOpen && (
        <div
          className="mobile-modal-overlay"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setIsBulkOrderOpen(false);
          }}
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(35, 28, 22, 0.58)' }}
        >
          <section className="mobile-modal-panel footer-bulk-order-modal" role="dialog" aria-modal="true" aria-labelledby="bulk-order-title">
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <h2 id="bulk-order-title" style={{ margin: 0, fontSize: '1.25rem' }}>Bulk order inquiry</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>All details are required before sending to WhatsApp.</p>
              </div>
              <button type="button" aria-label="Close bulk order form" onClick={() => setIsBulkOrderOpen(false)} style={{ minWidth: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </header>

            <form noValidate onSubmit={handleBulkOrderSubmit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              <div className="footer-bulk-order-fields">
                <label>Items / requirements *
                  <textarea required rows={3} value={bulkOrder.items} onChange={event => setBulkOrder(previous => ({ ...previous, items: event.target.value }))} placeholder="Products, colors, sizes, or customization" />
                </label>
                <label>Quantity *
                  <input required type="number" min={minimumBulkOrderQuantity} step="1" value={bulkOrder.quantity} onChange={event => setBulkOrder(previous => ({ ...previous, quantity: event.target.value }))} placeholder={`Minimum ${minimumBulkOrderQuantity} pieces`} />
                </label>
                <label>Needed by *
                  <input required type="date" value={bulkOrder.neededBy} onChange={event => setBulkOrder(previous => ({ ...previous, neededBy: event.target.value }))} />
                </label>
                <label>Company / organization *
                  <input required value={bulkOrder.company} onChange={event => setBulkOrder(previous => ({ ...previous, company: event.target.value }))} placeholder="Company name" />
                </label>
                <label>Contact name *
                  <input required value={bulkOrder.contactName} onChange={event => setBulkOrder(previous => ({ ...previous, contactName: event.target.value }))} placeholder="Your full name" />
                </label>
                <label>Designation / post *
                  <input required value={bulkOrder.designation} onChange={event => setBulkOrder(previous => ({ ...previous, designation: event.target.value }))} placeholder="Your role" />
                </label>
                <label>Phone number *
                  <input required type="tel" inputMode="tel" pattern="[0-9+() -]{7,20}" value={bulkOrder.phone} onChange={event => setBulkOrder(previous => ({ ...previous, phone: event.target.value }))} placeholder="Phone number" />
                </label>
              </div>
              <button type="submit" className="btn-primary" style={{ minHeight: 48, justifyContent: 'center' }}>
                <MessageCircle size={17} />
                <span>Send inquiry on WhatsApp</span>
              </button>
            </form>
          </section>
        </div>
      )}
    </footer>
  );
};
