import React, { useState, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import type { Order } from '../../types';
import {
  Truck, CheckCircle2, Package, MapPin, Phone, User,
  Clock, LogOut, RefreshCw, ChevronDown, ChevronUp,
  Navigation, AlertCircle, MessageCircle, ShieldCheck
} from 'lucide-react';

type DeliveryTab = 'active' | 'delivered';

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  shipped:          { bg: '#EFF6FF', text: '#1D4ED8', label: '📦 Awaiting Pickup' },
  out_for_delivery: { bg: '#FFF7ED', text: '#C2410C', label: '🚚 Out for Delivery' },
  delivered:        { bg: '#F0FDF4', text: '#15803D', label: '✅ Delivered' },
};

export const DeliveryDashboard: React.FC = () => {
  const { deliveryOrders, adminLogout, showToast, settings } = useStore();
  const [activeTab, setActiveTab] = useState<DeliveryTab>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deliveryNotes, setDeliveryNotes] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localOrders, setLocalOrders] = useState<Order[]>(deliveryOrders);

  useMemo(() => { setLocalOrders(deliveryOrders); }, [deliveryOrders]);

  const activeOrders = useMemo(() =>
    localOrders.filter(o => o.status === 'shipped' || o.status === 'out_for_delivery'),
    [localOrders]
  );
  const deliveredOrders = useMemo(() =>
    localOrders.filter(o => o.status === 'delivered'),
    [localOrders]
  );
  const displayOrders = activeTab === 'active' ? activeOrders : deliveredOrders;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await api.getDeliveryOrders();
      setLocalOrders(fresh);
      showToast('Orders refreshed', 'success');
    } catch {
      showToast('Could not refresh orders', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStatusUpdate = async (order: Order, status: 'out_for_delivery' | 'delivered') => {
    setProcessingId(order.id);
    try {
      const updated = await api.updateDeliveryOrderStatus(order.id, status, {
        deliveryNotes: deliveryNotes[order.id] || undefined
      });
      setLocalOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      showToast(`Order #${order.id.slice(-6)} marked as ${status === 'out_for_delivery' ? 'Out for Delivery' : 'Delivered'} ✓`);
      if (status === 'delivered') setExpandedId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  const openWhatsApp = (order: Order) => {
    const phone = order.customer.phone?.replace(/\D/g, '');
    if (!phone) return;
    const msg = encodeURIComponent(
      `Hello ${order.customer.name}, your order #${order.id.slice(-6)} from ${settings.storeName} is out for delivery! Please keep \u20b9${order.total} ready for COD. Thank you! \uD83C\uDF38`
    );
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)',
        padding: '20px 16px 60px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 480, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Truck size={22} color="#FFFFFF" />
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', fontWeight: 600, margin: 0, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Delivery Agent
              </p>
              <h1 style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                {settings.storeName}
              </h1>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh orders"
              style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', color: '#FFFFFF'
              }}
            >
              <RefreshCw size={16} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              onClick={adminLogout}
              aria-label="Logout"
              style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', color: '#FFFFFF'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18, maxWidth: 480, margin: '18px auto 0' }}>
          {[
            { label: 'Awaiting Pickup', count: localOrders.filter(o => o.status === 'shipped').length, color: '#60A5FA' },
            { label: 'In Transit', count: localOrders.filter(o => o.status === 'out_for_delivery').length, color: '#FB923C' },
            { label: 'Delivered', count: localOrders.filter(o => o.status === 'delivered').length, color: '#4ADE80' },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1, backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '10px 8px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stat.color }}>{stat.count}</div>
              <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, lineHeight: 1.2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '-32px auto 0', padding: '0 12px 80px', boxSizing: 'border-box' }}>
        <div style={{
          display: 'flex', backgroundColor: '#FFFFFF',
          borderRadius: 16, padding: 4, marginBottom: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          border: '1px solid #E2E8F0'
        }}>
          {[
            { id: 'active', label: `Active (${activeOrders.length})`, icon: <Truck size={14} /> },
            { id: 'delivered', label: `Delivered (${deliveredOrders.length})`, icon: <CheckCircle2 size={14} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DeliveryTab)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 12,
                fontSize: '0.82rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: activeTab === tab.id ? '#2563EB' : 'transparent',
                color: activeTab === tab.id ? '#FFFFFF' : '#64748B',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: activeTab === tab.id ? '0 2px 8px rgba(37,99,235,0.35)' : 'none'
              }}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {displayOrders.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 24px',
            backgroundColor: '#FFFFFF', borderRadius: 20,
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
          }}>
            <Package size={40} color="#CBD5E1" style={{ marginBottom: 12 }} />
            <p style={{ color: '#94A3B8', fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>
              {activeTab === 'active' ? 'No active deliveries right now' : 'No deliveries completed yet'}
            </p>
            <p style={{ color: '#CBD5E1', fontSize: '0.78rem', marginTop: 4 }}>
              {activeTab === 'active' ? 'Tap refresh to check for new orders' : 'Delivered orders will appear here'}
            </p>
          </div>
        ) : displayOrders.map(order => {
          const statusInfo = statusColors[order.status] || { bg: '#F8FAFC', text: '#64748B', label: order.status };
          const isExpanded = expandedId === order.id;
          const isProcessing = processingId === order.id;
          const isCod = order.paymentMethod === 'cod';

          return (
            <div key={order.id} style={{
              backgroundColor: '#FFFFFF', borderRadius: 18, marginBottom: 12,
              boxShadow: isExpanded ? '0 8px 30px rgba(37,99,235,0.12)' : '0 2px 12px rgba(0,0,0,0.06)',
              border: isExpanded ? '1.5px solid #BFDBFE' : '1px solid #F1F5F9',
              overflow: 'hidden', transition: 'all 0.25s ease'
            }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
                style={{
                  width: '100%', padding: '14px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A' }}>
                      #{order.id.slice(-8).toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: statusInfo.bg, color: statusInfo.text, padding: '2px 8px', borderRadius: 999 }}>
                      {statusInfo.label}
                    </span>
                    {isCod && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 999 }}>
                        💰 COD ₹{order.total}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <User size={12} color="#94A3B8" />
                    <span style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>{order.customer.name}</span>
                    <Clock size={11} color="#CBD5E1" />
                    <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>{formatTime(order.createdAt)}</span>
                  </div>
                </div>
                <div style={{ color: '#94A3B8', flexShrink: 0, marginLeft: 8 }}>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {isExpanded && (
                <div style={{ borderTop: '1px solid #F1F5F9' }}>
                  <div style={{ padding: '12px 16px', backgroundColor: '#F8FAFC' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <MapPin size={14} color="#2563EB" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <p style={{ fontSize: '0.7rem', color: '#94A3B8', margin: '0 0 1px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Address</p>
                          <p style={{ fontSize: '0.85rem', color: '#0F172A', margin: 0, fontWeight: 600, lineHeight: 1.4 }}>{order.customer.address}</p>
                        </div>
                      </div>
                      {order.customer.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Phone size={14} color="#2563EB" style={{ flexShrink: 0 }} />
                          <a href={`tel:${order.customer.phone}`} style={{ fontSize: '0.85rem', color: '#2563EB', fontWeight: 700, textDecoration: 'none' }}>
                            {order.customer.phone}
                          </a>
                        </div>
                      )}
                      {order.trackingNumber && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Navigation size={14} color="#7C3AED" />
                          <span style={{ fontSize: '0.8rem', color: '#7C3AED', fontWeight: 600 }}>AWB: {order.trackingNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9' }}>
                    <p style={{ fontSize: '0.7rem', color: '#94A3B8', margin: '0 0 6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Items ({order.items?.length ?? 0})
                    </p>
                    {(order.items || []).slice(0, 3).map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: '0.82rem', color: '#374151' }}>{(item as any).title || item.productTitle || 'Item'} × {item.quantity}</span>
                        <span style={{ fontSize: '0.82rem', color: '#0F172A', fontWeight: 700 }}>₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px dashed #E2E8F0', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Total</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>₹{order.total}</span>
                    </div>
                  </div>

                  {order.status !== 'delivered' && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid #F1F5F9' }}>
                      <label style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                        Delivery Notes (optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Left at door, No one answered..."
                        value={deliveryNotes[order.id] || ''}
                        onChange={e => setDeliveryNotes(prev => ({ ...prev, [order.id]: e.target.value }))}
                        style={{
                          width: '100%', padding: '8px 10px', fontSize: '0.82rem',
                          borderRadius: 10, border: '1.5px solid #E2E8F0',
                          outline: 'none', resize: 'none', fontFamily: 'inherit',
                          color: '#0F172A', boxSizing: 'border-box', backgroundColor: '#FFFFFF'
                        }}
                      />
                    </div>
                  )}

                  {order.status !== 'delivered' && (
                    <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {order.customer.phone && (
                        <button
                          onClick={() => openWhatsApp(order)}
                          style={{
                            flex: '0 0 auto', padding: '9px 14px', borderRadius: 10,
                            backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 700,
                            fontSize: '0.8rem', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 5
                          }}
                        >
                          <MessageCircle size={14} /> Notify
                        </button>
                      )}
                      {order.status === 'shipped' && (
                        <button
                          onClick={() => handleStatusUpdate(order, 'out_for_delivery')}
                          disabled={isProcessing}
                          style={{
                            flex: 1, minWidth: 120, padding: '11px 16px', borderRadius: 12,
                            backgroundColor: isProcessing ? '#93C5FD' : '#2563EB',
                            color: '#FFFFFF', fontWeight: 700, fontSize: '0.85rem',
                            border: 'none', cursor: isProcessing ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            boxShadow: '0 3px 12px rgba(37,99,235,0.35)'
                          }}
                        >
                          <Truck size={15} />{isProcessing ? 'Updating…' : 'Start Delivery'}
                        </button>
                      )}
                      {order.status === 'out_for_delivery' && (
                        <button
                          onClick={() => handleStatusUpdate(order, 'delivered')}
                          disabled={isProcessing}
                          style={{
                            flex: 1, minWidth: 120, padding: '11px 16px', borderRadius: 12,
                            backgroundColor: isProcessing ? '#86EFAC' : '#16A34A',
                            color: '#FFFFFF', fontWeight: 700, fontSize: '0.85rem',
                            border: 'none', cursor: isProcessing ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            boxShadow: '0 3px 12px rgba(22,163,74,0.35)'
                          }}
                        >
                          <CheckCircle2 size={15} />{isProcessing ? 'Marking…' : 'Mark Delivered'}
                        </button>
                      )}
                    </div>
                  )}

                  {order.status === 'delivered' && (
                    <div style={{ margin: '0 16px 14px', padding: '10px 14px', borderRadius: 12, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={16} color="#16A34A" />
                      <div>
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#15803D' }}>Delivered Successfully</p>
                        {order.deliveredAt && <p style={{ margin: 0, fontSize: '0.72rem', color: '#4ADE80' }}>{formatTime(order.deliveredAt)}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {activeTab === 'active' && activeOrders.some(o => o.paymentMethod === 'cod') && (
          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 14, backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', marginTop: 4 }}>
            <AlertCircle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#92400E', fontWeight: 600, lineHeight: 1.4 }}>
              Some orders are Cash on Delivery — collect payment before marking delivered.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, gap: 6, alignItems: 'center' }}>
          <ShieldCheck size={13} color="#94A3B8" />
          <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 600 }}>
            Delivery Agent — Limited access mode
          </span>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
