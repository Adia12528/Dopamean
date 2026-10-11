import React from 'react';
import type { Order } from '../../types';
import { useStore } from '../../context/StoreContext';
import { Printer, X, Package } from 'lucide-react';

interface InvoiceModalProps {
  order: Order | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose }) => {
  const { settings } = useStore();

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div 
      className="invoice-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(28, 25, 23, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div 
        className="invoice-container"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '750px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-medium)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Control Bar (Hidden during print) */}
        <div 
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={18} color="var(--accent-terracotta)" />
            <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1E293B' }}>
              Official Order Invoice #{order.id}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: 'var(--accent-terracotta)',
                color: '#FFFFFF',
                borderRadius: '999px',
                fontSize: '0.84rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Printer size={15} />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748B'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document Body */}
        <div 
          id="printable-invoice"
          style={{
            padding: '36px 40px',
            color: '#1E293B',
            fontSize: '0.9rem',
            lineHeight: 1.6
          }}
        >
          {/* Header Row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #E2E8F0',
            paddingBottom: '24px',
            marginBottom: '28px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '28px' }}>🧶</span>
                <h1 style={{
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  color: 'var(--accent-terracotta)',
                  margin: 0,
                  fontFamily: 'var(--font-serif)'
                }}>
                  {settings.storeName}
                </h1>
              </div>
              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: '0.84rem' }}>
                {settings.storeTagline}
              </p>
              <p style={{ margin: '2px 0 0', color: '#64748B', fontSize: '0.8rem' }}>
                {settings.contactEmail} • {settings.contactPhone}
              </p>
              {settings.studioLocation && (
                <p style={{ margin: '2px 0 0', color: '#64748B', fontSize: '0.78rem' }}>
                  {settings.studioLocation}
                </p>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-block',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                fontWeight: 700,
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '6px'
              }}>
                Tax Invoice
              </span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                #{order.id}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '2px' }}>
                Date: {invoiceDate}
              </div>
              <div style={{
                marginTop: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: order.paymentStatus === 'paid' ? '#059669' : '#D97706'
              }}>
                Payment: {order.paymentMethod ? order.paymentMethod.toUpperCase() : 'COD'} ({order.paymentStatus ? order.paymentStatus.toUpperCase() : 'PENDING'})
              </div>
            </div>
          </div>

          {/* Customer & Shipping Details */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '24px',
            backgroundColor: '#F8FAFC',
            padding: '20px 24px',
            borderRadius: '16px',
            marginBottom: '28px',
            border: '1px solid #E2E8F0'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Billed & Shipped To:
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0F172A' }}>
                {order.customerName || order.customer?.name}
              </div>
              <div style={{ color: '#475569', fontSize: '0.85rem', marginTop: '2px' }}>
                {order.customerEmail || order.customer?.email}
              </div>
              {(order.customerPhone || order.customer?.phone) && (
                <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                  {order.customerPhone || order.customer?.phone}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Delivery Address:
              </div>
              <div style={{ color: '#334155', fontSize: '0.86rem', whiteSpace: 'pre-wrap' }}>
                {order.customerAddress || order.customer?.address || 'Provided during WhatsApp confirmation'}
              </div>
              {order.trackingNumber && (
                <div style={{ marginTop: '6px', fontSize: '0.82rem', color: '#2563EB', fontWeight: 600 }}>
                  Tracking AWB: {order.trackingNumber}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div style={{ marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #CBD5E1', fontSize: '0.78rem', textTransform: 'uppercase', color: '#64748B' }}>
                  <th style={{ padding: '10px 0', fontWeight: 700 }}>Item Description</th>
                  <th style={{ padding: '10px 0', textAlign: 'center', fontWeight: 700 }}>Qty</th>
                  <th style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700 }}>Rate</th>
                  <th style={{ padding: '10px 0', textAlign: 'right', fontWeight: 700 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '14px 0' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>
                        {item.productTitle}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
                        Handmade Crochet Accessory
                      </div>
                    </td>
                    <td style={{ padding: '14px 0', textAlign: 'center', fontWeight: 600 }}>
                      {item.quantity}
                    </td>
                    <td style={{ padding: '14px 0', textAlign: 'right', color: '#475569' }}>
                      {settings.currency}{item.price}
                    </td>
                    <td style={{ padding: '14px 0', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                      {settings.currency}{item.price * item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '32px'
          }}>
            <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '0.88rem' }}>
                <span>Subtotal:</span>
                <span>{settings.currency}{order.subtotal}</span>
              </div>

              {(order.discountAmount > 0 || (order.discount && order.discount > 0)) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16A34A', fontSize: '0.88rem' }}>
                  <span>Discount ({order.promoCodeApplied || 'Promo'}):</span>
                  <span>-{settings.currency}{order.discountAmount || order.discount}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '0.88rem' }}>
                <span>Pan-India Shipping:</span>
                <span style={{ color: '#16A34A', fontWeight: 600 }}>
                  {order.subtotal >= settings.freeShippingThreshold ? 'FREE' : `${settings.currency}40`}
                </span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '10px',
                borderTop: '2px solid #E2E8F0',
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--accent-terracotta)'
              }}>
                <span>Total Amount:</span>
                <span>{settings.currency}{order.total}</span>
              </div>
            </div>
          </div>

          {/* Artisan Note & Footer */}
          <div style={{
            borderTop: '1px dashed #CBD5E1',
            paddingTop: '20px',
            textAlign: 'center',
            fontSize: '0.82rem',
            color: '#64748B'
          }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>
              🌸 Thank you for supporting slow handcrafted fashion & handmade artisan dreams!
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
              Care note: Gently hand-wash in cold water with mild liquid soap. Air dry flat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
