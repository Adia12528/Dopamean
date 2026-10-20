import React from 'react';
import { BadgeCheck, CheckCircle2, Clock3, PackageCheck, Scissors, ShoppingBag, Truck, XCircle } from 'lucide-react';
import type { Order, StoreSettings } from '../../types';

type DeliveryStage = 'placed' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered';

const stages: {
  id: DeliveryStage;
  setting: keyof StoreSettings;
  fallbackLabel: string;
  icon: typeof ShoppingBag;
}[] = [
  { id: 'placed', setting: 'deliveryStagePlacedLabel', fallbackLabel: 'Order placed', icon: ShoppingBag },
  { id: 'confirmed', setting: 'deliveryStageConfirmedLabel', fallbackLabel: 'Confirmed', icon: BadgeCheck },
  { id: 'processing', setting: 'deliveryStageInPreparationLabel', fallbackLabel: 'In preparation', icon: Scissors },
  { id: 'shipped', setting: 'deliveryStageShippedLabel', fallbackLabel: 'Shipped', icon: PackageCheck },
  { id: 'out_for_delivery', setting: 'deliveryStageOutForDeliveryLabel', fallbackLabel: 'Out for delivery', icon: Truck },
  { id: 'delivered', setting: 'deliveryStageDeliveredLabel', fallbackLabel: 'Delivered', icon: CheckCircle2 }
];

const stageOrder: DeliveryStage[] = ['placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

const normalizeStatus = (value: string) =>
  value.toLowerCase().replace(/^status:\s*/, '').replace(/[_-]+/g, ' ').trim();

const timelineStage = (status: string): DeliveryStage | null => {
  const normalized = normalizeStatus(status);
  if (normalized === 'order placed' || normalized === 'placed') return 'placed';
  if (normalized === 'order confirmed' || normalized === 'confirmed') return 'confirmed';
  if (normalized === 'processing' || normalized === 'in crafting' || normalized === 'in preparation') return 'processing';
  if (normalized === 'shipped') return 'shipped';
  if (normalized === 'out for delivery') return 'out_for_delivery';
  if (normalized === 'delivered') return 'delivered';
  return null;
};

const currentStage = (status: Order['status']): DeliveryStage => {
  if (status === 'confirmed') return 'confirmed';
  if (status === 'processing') return 'processing';
  if (status === 'shipped') return 'shipped';
  if (status === 'out_for_delivery') return 'out_for_delivery';
  if (status === 'delivered') return 'delivered';
  return 'placed';
};

const formatTimestamp = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

interface OrderStatusTimelineProps {
  order: Order;
  settings: StoreSettings;
  compact?: boolean;
}

export const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({ order, settings, compact = false }) => {
  const latestStage = currentStage(order.status);
  const currentIndex = stageOrder.indexOf(latestStage);

  if (order.status === 'cancelled') {
    const cancelledEvent = [...(order.timeline || [])].reverse().find(event => timelineStage(event.status) === null && normalizeStatus(event.status).includes('cancel'));
    const cancelledAt = formatTimestamp(order.cancelledAt || cancelledEvent?.timestamp);
    return (
      <div role="status" style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: compact ? '10px' : '14px',
        border: '1px solid #FECACA',
        borderRadius: '12px',
        background: '#FEF2F2',
        color: '#991B1B',
        fontSize: compact ? '0.78rem' : '0.86rem'
      }}>
        <XCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>Order cancelled.</strong>
          {order.cancelReason ? ` ${order.cancelReason}` : ''}
          {cancelledAt ? <span style={{ display: 'block', marginTop: '4px' }}>{cancelledAt}</span> : null}
        </span>
      </div>
    );
  }

  return (
    <ol aria-label={`Delivery progress for order ${order.id}`} style={{
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: compact ? '8px' : '10px'
    }}>
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        const isReached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const matchingEvent = [...(order.timeline || [])]
          .reverse()
          .find(event => timelineStage(event.status) === stage.id);
        const timestamp = stage.id === 'placed'
          ? formatTimestamp(order.createdAt)
          : stage.id === 'shipped'
            ? formatTimestamp(matchingEvent?.timestamp || order.shippedAt)
            : stage.id === 'delivered'
              ? formatTimestamp(matchingEvent?.timestamp || order.deliveredAt)
              : formatTimestamp(matchingEvent?.timestamp);
        const label = String(settings[stage.setting] || stage.fallbackLabel);

        return (
          <li key={stage.id} aria-current={isCurrent ? 'step' : undefined} style={{
            display: 'grid',
            gridTemplateColumns: '24px minmax(0, 1fr)',
            alignItems: 'start',
            gap: '9px',
            color: isReached ? 'var(--text-main)' : 'var(--text-subtle)'
          }}>
            <span style={{
              width: '23px',
              height: '23px',
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: isReached ? '#FFFFFF' : '#94A3B8',
              background: isReached ? 'var(--accent-terracotta)' : '#FFFFFF',
              border: `1px solid ${isReached ? 'var(--accent-terracotta)' : '#CBD5E1'}`,
              boxSizing: 'border-box',
              marginTop: '1px'
            }}>
              {isReached ? <Icon size={13} /> : <Clock3 size={12} />}
            </span>
            <span style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: compact ? '0.76rem' : '0.84rem', fontWeight: isCurrent ? 800 : 600 }}>
                {label}{isCurrent ? ' · Current' : ''}
              </strong>
              {isReached && (
                <time
                  dateTime={matchingEvent?.timestamp || (stage.id === 'placed' ? order.createdAt : stage.id === 'shipped' ? order.shippedAt : stage.id === 'delivered' ? order.deliveredAt : undefined)}
                  style={{ fontSize: compact ? '0.68rem' : '0.74rem', color: 'var(--text-muted)' }}
                >
                  {timestamp || 'Time not recorded'}
                </time>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
