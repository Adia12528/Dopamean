import React, { useState } from 'react';
import type { Order } from '../../types';
import { useStore } from '../../context/StoreContext';
import { Package, Clock, CheckCircle2, Truck, MapPin, FileText, Send } from 'lucide-react';

export const OrdersManager: React.FC = () => {
  const { orders, updateOrderStatus, settings, setActiveInvoiceOrder } = useStore();
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  const getStatusBadge = (status: Order['status']) => {
    const s = String(status).toLowerCase();
    if (s.includes('deliver')) {
      return { bg: 'var(--accent-sage-light)', color: 'var(--accent-sage)', icon: <CheckCircle2 size={13} />, label: 'Delivered' };
    }
    if (s.includes('ship')) {
      return { bg: '#E0F2FE', color: '#0369A1', icon: <Truck size={13} />, label: 'Shipped' };
    }
    if (s.includes('craft') || s.includes('process')) {
      return { bg: 'var(--accent-terracotta-light)', color: 'var(--accent-terracotta)', icon: <span>🧶</span>, label: 'In Crafting' };
    }
    return { bg: '#FEF3C7', color: '#B45309', icon: <Clock size={13} />, label: 'Pending' };
  };

  const handleTrackingUpdate = (orderId: string, currentStatus: Order['status']) => {
    const awb = trackingInputs[orderId];
    if (awb && awb.trim()) {
      updateOrderStatus(orderId, currentStatus, { trackingNumber: awb.trim() });
      setTrackingInputs({ ...trackingInputs, [orderId]: '' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '20px 24px',
        borderRadius: '20px',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Studio Orders & Commission Tracking
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Monitor handcrafted commissions, assign courier tracking numbers, and generate tax invoices.
          </p>
        </div>

        <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
          Total Registered Orders: <strong>{orders.length}</strong>
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px dashed var(--border-medium)'
        }}>
          <Package size={36} color="var(--accent-terracotta)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No orders recorded yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Try adding items to your bag in Storefront mode and placing a test order!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.map(order => {
            const statusConfig = getStatusBadge(order.status);

            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '20px',
                  border: '1px solid var(--border-medium)',
                  padding: '24px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px'
                }}
              >
                {/* Header row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  borderBottom: '1px solid var(--border-light)',
                  paddingBottom: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      #{order.id}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                      Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <span style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: order.paymentStatus === 'paid' ? '#059669' : '#D97706',
                      backgroundColor: order.paymentStatus === 'paid' ? '#DCFCE7' : '#FEF3C7',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {order.paymentMethod ? order.paymentMethod.toUpperCase() : 'COD'} • {order.paymentStatus ? order.paymentStatus.toUpperCase() : 'PENDING'}
                    </span>
                    {order.promoCodeApplied && (
                      <span style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: 'var(--accent-sage)',
                        backgroundColor: 'var(--accent-sage-light)',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        Promo: {order.promoCodeApplied}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* View Invoice button */}
                    <button
                      onClick={() => setActiveInvoiceOrder(order)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-medium)',
                        backgroundColor: '#FFFFFF',
                        color: 'var(--accent-terracotta)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <FileText size={14} />
                      <span>Print Invoice</span>
                    </button>

                    {/* Status pill */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '999px',
                      backgroundColor: statusConfig.bg,
                      color: statusConfig.color,
                      fontSize: '0.82rem',
                      fontWeight: 700
                    }}>
                      {statusConfig.icon}
                      <span>{statusConfig.label}</span>
                    </div>

                    {/* Status update dropdown */}
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.78rem',
                        backgroundColor: '#FFFFFF',
                        color: 'var(--text-main)',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">In Crafting</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>
                </div>

                {/* Details grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px'
                }}>
                  {/* Items list */}
                  <div>
                    <h5 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>
                      Handcrafted Items ({order.items.length}):
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg-surface-soft)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.productTitle}
                                style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                              />
                            )}
                            <div>
                              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {item.productTitle}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Qty: {item.quantity} • {settings.currency}{item.price} each
                              </div>
                            </div>
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--accent-terracotta)' }}>
                            {settings.currency}{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Customer & Shipping info */}
                  <div style={{
                    backgroundColor: 'var(--bg-surface-soft)',
                    padding: '16px',
                    borderRadius: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <h5 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Customer & Shipping Destination:
                      </h5>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>
                        {order.customerName || order.customer?.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        {order.customerEmail || order.customer?.email}
                      </div>
                      {(order.customerPhone || order.customer?.phone) && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          📞 {order.customerPhone || order.customer?.phone}
                        </div>
                      )}
                      {(order.customerAddress || order.customer?.address) && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                          <MapPin size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>{order.customerAddress || order.customer?.address}</span>
                        </div>
                      )}
                    </div>

                    {/* Courier Tracking input */}
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-medium)' }}>
                      <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                        Courier AWB / Tracking Number:
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder={order.trackingNumber || 'Enter AWB (e.g. SP123456789IN)'}
                          value={trackingInputs[order.id] !== undefined ? trackingInputs[order.id] : (order.trackingNumber || '')}
                          onChange={(e) => setTrackingInputs({ ...trackingInputs, [order.id]: e.target.value })}
                          style={{
                            flex: 1,
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-medium)',
                            fontSize: '0.78rem',
                            backgroundColor: '#FFFFFF'
                          }}
                        />
                        <button
                          onClick={() => handleTrackingUpdate(order.id, order.status)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--accent-terracotta)',
                            color: '#FFFFFF',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Save tracking number"
                        >
                          <Send size={12} />
                        </button>
                      </div>
                    </div>

                    <div style={{
                      borderTop: '1px dashed var(--border-medium)',
                      paddingTop: '10px',
                      marginTop: '12px',
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>Order Total:</span>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-terracotta)' }}>
                        {settings.currency}{order.total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
