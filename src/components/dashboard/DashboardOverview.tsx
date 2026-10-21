import React from 'react';
import { useStore } from '../../context/StoreContext';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Copy,
  DollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  Tag,
  Truck
} from 'lucide-react';
import { getShortOrderId } from '../../lib/shortOrderId';

interface DashboardOverviewProps {
  onOpenAddOffer: () => void;
}

const formatOrderDate = (dateValue: string) => {
  const timestamp = Date.parse(dateValue);
  if (Number.isNaN(timestamp)) return 'Date unavailable';
  return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const parseOfferBoundary = (dateValue: string, isEnd: boolean) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return new Date(`${dateValue}T${isEnd ? '23:59:59.999' : '00:00:00'}`).getTime();
  }
  return Date.parse(dateValue);
};

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onOpenAddOffer }) => {
  const { products, offers, orders, setDashboardTab, settings, refreshData, isLoading, showToast } = useStore();
  const [now] = React.useState(() => Date.now());
  const collectedOrders = orders.filter(order => order.paymentStatus === 'paid' && order.status !== 'cancelled');
  const collectedRevenue = collectedOrders.reduce((total, order) => total + order.total, 0);
  const ordersNeedingAttention = orders.filter(order =>
    order.status !== 'cancelled' && (
      order.status === 'pending' ||
      (order.paymentMethod === 'upi' && order.paymentStatus === 'pending')
    )
  );
  const upiPaymentsToReview = orders.filter(order =>
    order.paymentMethod === 'upi' && order.paymentStatus === 'pending' && order.status !== 'cancelled'
  ).length;
  const fulfillmentOrders = orders.filter(order =>
    ['confirmed', 'processing', 'shipped', 'out_for_delivery'].includes(order.status)
  );
  const lowStockProducts = products
    .filter(product => product.stock <= (settings.lowStockThreshold ?? 5))
    .sort((first, second) => first.stock - second.stock);
  const activeOffers = offers.filter(offer => {
    const startsAt = offer.startDate ? parseOfferBoundary(offer.startDate, false) : Number.NEGATIVE_INFINITY;
    const endsAt = parseOfferBoundary(offer.endDate, true);
    return offer.isActive && startsAt <= now && !Number.isNaN(endsAt) && now < endsAt;
  });
  const recentOrders = [...orders]
    .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
    .slice(0, 5);

  const handleCopyOrderId = async (orderId: string) => {
    try {
      await navigator.clipboard.writeText(getShortOrderId(orderId));
      showToast('Order ID copied.', 'success');
    } catch {
      showToast('Could not copy the order ID.', 'error');
    }
  };

  const metrics = [
    {
      label: 'Collected revenue',
      value: `${settings.currency}${collectedRevenue.toFixed(2)}`,
      detail: `${collectedOrders.length} paid order${collectedOrders.length === 1 ? '' : 's'} · all time`,
      icon: <DollarSign size={18} />,
      tone: 'var(--accent-sage)',
      background: 'var(--accent-sage-light)'
    },
    {
      label: 'Needs attention',
      value: String(ordersNeedingAttention.length),
      detail: `${upiPaymentsToReview} UPI payment${upiPaymentsToReview === 1 ? '' : 's'} to review`,
      icon: <Clock size={18} />,
      tone: ordersNeedingAttention.length ? '#B45309' : 'var(--accent-sage)',
      background: ordersNeedingAttention.length ? '#FEF3C7' : 'var(--accent-sage-light)'
    },
    {
      label: 'In fulfilment',
      value: String(fulfillmentOrders.length),
      detail: `${orders.length} recorded order${orders.length === 1 ? '' : 's'} total`,
      icon: <Truck size={18} />,
      tone: 'var(--accent-terracotta)',
      background: 'var(--accent-terracotta-light)'
    },
    {
      label: 'Low-stock products',
      value: String(lowStockProducts.length),
      detail: `At or below ${settings.lowStockThreshold ?? 5} in stock`,
      icon: <Package size={18} />,
      tone: lowStockProducts.length ? '#B45309' : 'var(--accent-sage)',
      background: lowStockProducts.length ? '#FEF3C7' : 'var(--accent-sage-light)'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>Store overview</h2>
          <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            Current figures from {products.length} products and {orders.length} recorded orders.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <button type="button" className="btn-outline" onClick={() => void refreshData()} disabled={isLoading} style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
            <RefreshCw size={15} className={isLoading ? 'spin' : undefined} />
            <span>{isLoading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
          <button type="button" className="btn-secondary" onClick={onOpenAddOffer} style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
            <Tag size={15} />
            <span>Add offer</span>
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: '12px' }}>
        {metrics.map(metric => (
          <section key={metric.label} className="glass-card" style={{ padding: '16px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 700 }}>{metric.label}</span>
              <span aria-hidden="true" style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 8, color: metric.tone, background: metric.background }}>
                {metric.icon}
              </span>
            </div>
            <div style={{ marginTop: '12px', fontSize: '1.65rem', lineHeight: 1.1, fontWeight: 800, color: 'var(--text-main)', overflowWrap: 'anywhere' }}>{metric.value}</div>
            <div style={{ marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>{metric.detail}</div>
          </section>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '16px', alignItems: 'start' }}>
        <section className="glass-card" style={{ padding: '18px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.98rem', fontWeight: 800 }}>Recent orders</h3>
            <button type="button" className="btn-outline" onClick={() => setDashboardTab('orders')} style={{ padding: '6px 10px', fontSize: '0.76rem' }}>
              <span>All {orders.length}</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div role="status" className="badge-yarn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'none', letterSpacing: 0 }}>
              <ShoppingBag size={14} />
              No customer orders recorded yet.
            </div>
          ) : (
            <div style={{ display: 'grid' }}>
              {recentOrders.map(order => (
                <div key={order.id} className="dashboard-recent-order-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: '8px 14px', padding: '11px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 9px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                        <strong style={{ minWidth: 0, fontSize: '0.78rem', color: 'var(--text-main)', overflowWrap: 'anywhere' }}>#{getShortOrderId(order.id)}</strong>
                        <button type="button" aria-label={`Copy order ${getShortOrderId(order.id)}`} title="Copy order ID" onClick={() => void handleCopyOrderId(order.id)} style={{ flex: '0 0 44px', width: 44, minHeight: 44, display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
                          <Copy size={13} />
                        </button>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', overflowWrap: 'anywhere' }}>{order.customer.name}</span>
                    </div>
                    <div style={{ marginTop: '3px', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                      {formatOrderDate(order.createdAt)} · {order.items.length} item{order.items.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ display: 'grid', justifyItems: 'end', gap: '4px' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.78rem' }}>{settings.currency}{order.total.toFixed(2)}</strong>
                    <span className={order.status === 'cancelled' ? 'badge-rose' : order.paymentStatus === 'paid' ? 'badge-sage' : order.paymentMethod === 'upi' ? 'badge-amber' : 'badge-yarn'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', maxWidth: '190px', fontSize: '0.64rem', textAlign: 'right', textTransform: 'none', letterSpacing: 0 }}>
                      {order.status === 'cancelled' ? <AlertTriangle size={11} /> : order.paymentStatus === 'paid' ? <CheckCircle2 size={11} /> : order.paymentMethod === 'upi' ? <CreditCard size={11} /> : <Clock size={11} />}
                      {order.status === 'cancelled' ? 'Cancelled' : `${order.status.replace(/_/g, ' ')} · ${order.paymentStatus === 'paid' ? 'paid' : order.paymentMethod === 'upi' && order.paymentStatus === 'pending' ? 'UPI review' : (order.paymentStatus || 'pending').replace(/_/g, ' ')}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-card" style={{ padding: '18px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.98rem', fontWeight: 800 }}>Inventory & offers</h3>
            <button type="button" className="btn-outline" onClick={() => setDashboardTab('products')} style={{ padding: '6px 10px', fontSize: '0.76rem' }}>
              <span>Products</span>
              <ArrowRight size={14} />
            </button>
          </div>
          <div role="status" className={lowStockProducts.length ? 'badge-amber' : 'badge-sage'} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'none', letterSpacing: 0 }}>
            {lowStockProducts.length ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            {lowStockProducts.length ? `${lowStockProducts.length} product${lowStockProducts.length === 1 ? '' : 's'} at or below stock threshold` : 'No products below stock threshold'}
          </div>
          {lowStockProducts.length > 0 && (
            <div style={{ display: 'grid', gap: '7px', marginTop: '12px' }}>
              {lowStockProducts.slice(0, 4).map(product => (
                <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.76rem' }}>
                  <span style={{ minWidth: 0, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.title}</span>
                  <strong style={{ flexShrink: 0, color: product.stock === 0 ? '#B91C1C' : '#B45309' }}>{product.stock} left</strong>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Live offers</span>
            <strong style={{ color: 'var(--text-main)', fontSize: '0.82rem' }}>{activeOffers.length} active · {offers.length} total</strong>
          </div>
          <button type="button" className="btn-secondary" onClick={onOpenAddOffer} style={{ marginTop: '10px', padding: '7px 10px', fontSize: '0.76rem' }}>
            <Tag size={14} />
            <span>Create offer</span>
          </button>
        </section>
      </div>
    </div>
  );
};