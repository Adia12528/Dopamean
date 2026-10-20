import React, { useState } from 'react';
import type { Order } from '../../types';
import { api, getAssetUrl } from '../../services/api';
import { useStore } from '../../context/StoreContext';
import { createWhatsAppSupportUrl } from '../../lib/whatsapp';
import { 
  Search, 
  X, 
  Truck, 
  CheckCircle2, 
  Clock, 
  Scissors, 
  FileText, 
  ExternalLink,
  MapPin,
  AlertCircle
} from 'lucide-react';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({ isOpen, onClose }) => {
  const { settings, setActiveInvoiceOrder } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleTrack = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !searchEmail.trim()) return;

    setIsLoading(true);
    setErrorMessage('');
    try {
      const results = await api.trackOrder(searchQuery.trim(), searchEmail.trim());
      setOrders(results);
      setHasSearched(true);
    } catch (error: unknown) {
      setOrders([]);
      setHasSearched(true);
      setErrorMessage(error instanceof Error ? error.message : 'No orders found matching that query.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStepIndex = (status: Order['status']) => {
    const s = String(status).toLowerCase();
    if (s.includes('deliver') && !s.includes('out_for_delivery') && !s.includes('out for delivery')) return 4;
    if (s.includes('out_for_delivery') || s.includes('out for delivery')) return 3;
    if (s.includes('ship')) return 2;
    if (s.includes('confirm') || s.includes('craft') || s.includes('process')) return 1;
    return 0;
  };

  return (
    <div
      className="mobile-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        backgroundColor: 'rgba(28, 25, 23, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(10px, 3vw, 20px)',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="mobile-modal-panel"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'clamp(18px, 4vw, 28px)',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-medium)',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(16px, 3vw, 22px) clamp(16px, 3vw, 28px)',
          borderBottom: '1px solid var(--border-medium)',
          backgroundColor: 'var(--bg-surface-soft)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={20} color="var(--accent-terracotta)" />
              <h2 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.25rem)', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Track Your Handcrafted Order
              </h2>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Enter your Order ID and the email address used at checkout.
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close tracking modal"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '1px solid var(--border-medium)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar Form */}
        <div style={{ padding: 'clamp(16px, 3vw, 24px) clamp(16px, 3vw, 28px)', borderBottom: '1px solid var(--border-medium)' }}>
          <form onSubmit={handleTrack} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
              <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-subtle)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Enter your Order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '44px',
                  padding: '10px 14px 10px 42px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-medium)',
                  fontSize: '16px', // 16px prevents iOS zoom
                  outline: 'none',
                  color: 'var(--text-main)',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
            </div>

            <input
              type="email"
              required
              placeholder="Checkout email address"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1.5px solid var(--border-medium)',
                fontSize: '16px', // 16px prevents iOS zoom
                outline: 'none',
                color: 'var(--text-main)',
                boxSizing: 'border-box'
              }}
            />

            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim() || !searchEmail.trim()}
              className="btn-primary"
              style={{
                minHeight: '44px',
                padding: '0 24px',
                fontSize: '0.92rem',
                opacity: isLoading || !searchQuery.trim() || !searchEmail.trim() ? 0.6 : 1,
                cursor: isLoading ? 'wait' : 'pointer'
              }}
            >
              {isLoading ? 'Searching...' : 'Track'}
            </button>
          </form>
        </div>

        {/* Results Area */}
        <div style={{
          padding: 'clamp(16px, 3vw, 24px) clamp(16px, 3vw, 28px)',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          flex: 1
        }}>
          {errorMessage && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              padding: '16px 20px',
              borderRadius: '16px',
              color: '#991B1B',
              fontSize: '0.88rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <span style={{ fontWeight: 600 }}>🔍 {errorMessage}</span>
              <span style={{ fontSize: '0.8rem', color: '#7F1D1D' }}>
                Tip: If you ordered via WhatsApp or have questions, contact Deepa directly at {settings.contactPhone}.
              </span>
            </div>
          )}

          {!hasSearched && !errorMessage && (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-muted)'
            }}>
              <span style={{ fontSize: '42px', display: 'block', marginBottom: '12px' }}>📦</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Real-Time Pan-India Parcel Tracking
              </h3>
              <p style={{ fontSize: '0.84rem', maxWidth: '420px', margin: '6px auto 0', lineHeight: 1.5 }}>
                Our artisanal creations are lovingly crocheted loop-by-loop. Track when your parcel is being hand-stitched, packed, and handed to the courier.
              </p>
            </div>
          )}

          {orders.map((order) => {
            const step = getStepIndex(order.status);
            const whatsappSupportUrl = createWhatsAppSupportUrl(order, settings);
            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '20px',
                  border: '1.5px solid var(--border-medium)',
                  padding: '24px',
                  marginBottom: '20px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* Order Top Summary */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '20px'
                }}>
                  <div>
                    <span style={{
                      backgroundColor: 'var(--accent-terracotta-light)',
                      color: 'var(--accent-terracotta)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: '999px',
                      letterSpacing: '0.04em'
                    }}>
                      ORDER #{order.id}
                    </span>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Placed on {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-terracotta)' }}>
                      {settings.currency}{order.total}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {order.paymentMethod ? order.paymentMethod.toUpperCase() : 'COD'} • {order.paymentStatus ? order.paymentStatus.toUpperCase() : 'PENDING'}
                    </div>
                  </div>
                </div>

                {/* Cancelled Banner if Order is Cancelled */}
                {order.status === 'cancelled' ? (
                  <div style={{
                    backgroundColor: '#FEF2F2',
                    border: '1.5px solid #FECACA',
                    borderRadius: '16px',
                    padding: '16px 20px',
                    margin: '18px 0 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B91C1C', fontWeight: 700, fontSize: '0.94rem' }}>
                      <AlertCircle size={18} />
                      <span>Order Cancelled</span>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#991B1B' }}>
                      <strong>Cancellation Reason:</strong> {order.cancelReason || 'Cancelled by studio administration.'}
                    </div>
                    {order.cancelledAt && (
                      <div style={{ fontSize: '0.74rem', color: '#7F1D1D' }}>
                        Processed on {new Date(order.cancelledAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Stepper Progress Bar (5 Milestones) */
                  <div style={{ margin: '24px 0 28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                      {/* Connecting line */}
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        left: '20px',
                        right: '20px',
                        height: '3px',
                        backgroundColor: '#E2E8F0',
                        zIndex: 1
                      }}>
                        <div style={{
                          height: '100%',
                          backgroundColor: 'var(--accent-terracotta)',
                          width: `${(step / 4) * 100}%`,
                          transition: 'width 0.5s ease'
                        }} />
                      </div>

                      {[
                        { label: 'Placed', icon: Clock },
                        { label: 'Crafting', icon: Scissors },
                        { label: 'Shipped', icon: Truck },
                        { label: 'Out for Delivery', icon: MapPin },
                        { label: 'Delivered', icon: CheckCircle2 }
                      ].map((s, idx) => {
                        const Icon = s.icon;
                        const isComplete = idx <= step;
                        const isCurrent = idx === step;
                        return (
                          <div
                            key={s.label}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              zIndex: 2,
                              position: 'relative',
                              textAlign: 'center'
                            }}
                          >
                            <div style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              backgroundColor: isComplete ? 'var(--accent-terracotta)' : '#FFFFFF',
                              border: `2px solid ${isComplete ? 'var(--accent-terracotta)' : '#CBD5E1'}`,
                              color: isComplete ? '#FFFFFF' : '#94A3B8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: isCurrent ? '0 0 12px rgba(200, 90, 50, 0.4)' : 'none',
                              transition: 'all 0.3s ease'
                            }}>
                              <Icon size={15} />
                            </div>
                            <span style={{
                              fontSize: '0.72rem',
                              fontWeight: isCurrent ? 700 : 500,
                              color: isComplete ? 'var(--text-main)' : 'var(--text-subtle)',
                              marginTop: '6px',
                              maxWidth: '64px',
                              lineHeight: 1.2
                            }}>
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Courier Tracking AWB (if dispatched) */}
                {order.trackingNumber && (
                  <div style={{
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.84rem'
                  }}>
                    <div>
                      <span style={{ color: '#1E40AF', fontWeight: 600 }}>Courier Tracking AWB: </span>
                      <strong style={{ color: '#1E3A8A' }}>{order.trackingNumber}</strong>
                    </div>
                    <span style={{ fontSize: '0.76rem', color: '#3B82F6', fontWeight: 600 }}>
                      Handed to SpeedPost / BlueDart
                    </span>
                  </div>
                )}

                {/* Items List */}
                <div style={{
                  backgroundColor: 'var(--bg-surface-soft)',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Items in Parcel ({order.items.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {order.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.86rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {item.image && (
                            <img
                              src={getAssetUrl(item.image)}
                              alt={item.productTitle}
                              style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                            />
                          )}
                          <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                            {item.quantity}x {item.productTitle}
                          </span>
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {settings.currency}{item.price * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons: Invoice + Support */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    onClick={() => {
                      setActiveInvoiceOrder(order);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--accent-terracotta)',
                      color: 'var(--accent-terracotta)',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <FileText size={14} />
                    <span>View / Print Invoice</span>
                  </button>

                  {whatsappSupportUrl && (
                  <a
                    href={whatsappSupportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      backgroundColor: '#25D366',
                      color: '#FFFFFF',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    <span>Help on WhatsApp</span>
                    <ExternalLink size={12} />
                  </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
