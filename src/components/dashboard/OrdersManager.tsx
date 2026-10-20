import React, { useState, useMemo } from 'react';
import type { Order, StoreSettings } from '../../types';
import { useStore } from '../../context/StoreContext';
import { getAssetUrl } from '../../services/api';
import { createOrderWhatsAppMessage, createWhatsAppUrl, isWhatsAppEnabled, isWhatsAppStageEnabled, normalizeWhatsAppPhone } from '../../lib/whatsapp';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  Truck, 
  MapPin, 
  FileText, 
  X, 
  AlertCircle, 
  Check, 
  Search, 
  Settings2, 
  ChevronDown, 
  ChevronUp, 
  MessageCircle, 
  Box
} from 'lucide-react';

type SectionTab = 'pending' | 'confirmed' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'all';

export const OrdersManager: React.FC = () => {
  const { orders, updateOrderStatus, settings, updateSettings, setActiveInvoiceOrder, showToast } = useStore();

  // Tab & Filter States
  const [activeTab, setActiveTab] = useState<SectionTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending' | 'cod'>('all');
  
  // Settings Panel Toggle & Local Form State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    artisanCommissionRate: settings.artisanCommissionRate ?? 15,
    commissionType: settings.commissionType ?? 'percentage',
    defaultCourierPartner: settings.defaultCourierPartner || 'India Post Speed Post',
    estimatedCraftingDays: settings.estimatedCraftingDays ?? 3,
    autoMarkCodPaidOnDelivered: settings.autoMarkCodPaidOnDelivered ?? true
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Modal States
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelPreset, setCancelPreset] = useState('Customer requested cancellation');

  const [shippingOrder, setShippingOrder] = useState<Order | null>(null);
  const [shipCourierPartner, setShipCourierPartner] = useState(settings.defaultCourierPartner || 'India Post Speed Post');
  const [shipTrackingNumber, setShipTrackingNumber] = useState('');

  const [outForDeliveryOrder, setOutForDeliveryOrder] = useState<Order | null>(null);
  const [deliveryAgentNotes, setDeliveryAgentNotes] = useState('');

  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Inline Tracking AWB inputs (for quick updates)
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  // Common cancellation reason presets
  const cancelPresets = [
    'Customer requested cancellation',
    'Yarn / raw craft materials out of stock',
    'Delivery destination not serviceable by courier',
    'Artisan crafting bench capacity fully booked',
    'Duplicate order placed by customer',
    'Payment verification unconfirmed'
  ];

  // Common courier partners
  const courierOptions = [
    'India Post Speed Post',
    'Blue Dart Express',
    'Delhivery',
    'DTDC Courier',
    'Shadowfax',
    'Porter / Local Courier',
    'Other Handcrafted Express'
  ];

  // Financial & Commission Calculations
  const commissionRate = settings.artisanCommissionRate ?? 15;
  const isFixedCommission = settings.commissionType === 'fixed';

  const orderStats = useMemo(() => {
    let pendingCount = 0;
    let confirmedCount = 0;
    let shippedCount = 0;
    let outForDeliveryCount = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;
    let totalGrossRevenue = 0;
    let deliveredGrossRevenue = 0;

    for (const order of orders) {
      const s = order.status;
      if (s === 'pending') pendingCount++;
      else if (s === 'confirmed' || s === 'processing') confirmedCount++;
      else if (s === 'shipped') shippedCount++;
      else if (s === 'out_for_delivery') outForDeliveryCount++;
      else if (s === 'delivered') {
        deliveredCount++;
        deliveredGrossRevenue += order.total;
      } else if (s === 'cancelled') cancelledCount++;

      if (s !== 'cancelled') {
        totalGrossRevenue += order.total;
      }
    }

    const estimatedTotalCommission = isFixedCommission 
      ? (deliveredCount * commissionRate)
      : (deliveredGrossRevenue * (commissionRate / 100));

    const netArtisanPayout = Math.max(0, deliveredGrossRevenue - estimatedTotalCommission);

    return {
      total: orders.length,
      pendingCount,
      confirmedCount,
      shippedCount,
      outForDeliveryCount,
      deliveredCount,
      cancelledCount,
      totalGrossRevenue,
      deliveredGrossRevenue,
      estimatedTotalCommission,
      netArtisanPayout
    };
  }, [orders, commissionRate, isFixedCommission]);

  // Filtered orders list based on active tab and search query
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Tab matching
      if (activeTab === 'pending' && order.status !== 'pending') return false;
      if (activeTab === 'confirmed' && order.status !== 'confirmed' && order.status !== 'processing') return false;
      if (activeTab === 'shipped' && order.status !== 'shipped') return false;
      if (activeTab === 'out_for_delivery' && order.status !== 'out_for_delivery') return false;
      if (activeTab === 'delivered' && order.status !== 'delivered') return false;
      if (activeTab === 'cancelled' && order.status !== 'cancelled') return false;

      // Payment filter
      if (paymentFilter === 'paid' && order.paymentStatus !== 'paid') return false;
      if (paymentFilter === 'pending' && order.paymentStatus !== 'pending') return false;
      if (paymentFilter === 'cod' && order.paymentMethod !== 'cod') return false;

      // Search matching (Order ID, Customer name, email, phone, city, AWB)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = order.id.toLowerCase().includes(q);
        const matchesName = (order.customer?.name || '').toLowerCase().includes(q);
        const matchesEmail = (order.customer?.email || '').toLowerCase().includes(q);
        const matchesPhone = (order.customer?.phone || '').toLowerCase().includes(q);
        const matchesCity = (order.customer?.city || '').toLowerCase().includes(q);
        const matchesAwb = (order.trackingNumber || '').toLowerCase().includes(q);
        const matchesCourier = (order.courierPartner || '').toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesEmail && !matchesPhone && !matchesCity && !matchesAwb && !matchesCourier) {
          return false;
        }
      }

      return true;
    });
  }, [orders, activeTab, paymentFilter, searchQuery]);

  // Save Settings handler
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateSettings(settingsForm as Partial<StoreSettings>);
      showToast('Studio Orders & Commission settings saved successfully! ⚙️', 'success');
      setIsSettingsOpen(false);
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'confirmed':
      case 'processing':
        return { 
          bg: '#E0F2FE', 
          color: '#0369A1', 
          icon: <Box size={13} />, 
          label: 'Confirmed • Ready to Ship' 
        };
      case 'shipped':
        return { 
          bg: '#EDE9FE', 
          color: '#6D28D9', 
          icon: <Truck size={13} />, 
          label: 'Shipped (In Transit)' 
        };
      case 'out_for_delivery':
        return { 
          bg: '#FEF3C7', 
          color: '#B45309', 
          icon: <MapPin size={13} />, 
          label: '🛵 Out for Delivery' 
        };
      case 'delivered':
        return { 
          bg: 'var(--accent-sage-light)', 
          color: 'var(--accent-sage)', 
          icon: <CheckCircle2 size={13} />, 
          label: 'Delivered' 
        };
      case 'cancelled':
        return { 
          bg: '#FEE2E2', 
          color: '#B91C1C', 
          icon: <AlertCircle size={13} />, 
          label: 'Cancelled' 
        };
      default:
        return { 
          bg: '#FFFBEB', 
          color: '#D97706', 
          icon: <Clock size={13} />, 
          label: 'Pending Review' 
        };
    }
  };

  // Helper: Calculate Commission for an individual order
  const calculateOrderCommission = (orderTotal: number) => {
    if (isFixedCommission) {
      const comm = commissionRate;
      return {
        commission: comm,
        payout: Math.max(0, orderTotal - comm)
      };
    }
    const comm = Number((orderTotal * (commissionRate / 100)).toFixed(2));
    return {
      commission: comm,
      payout: Number(Math.max(0, orderTotal - comm).toFixed(2))
    };
  };

  // 1. Confirm Order (Pending -> Confirmed / Ready to Ship)
  const handleConfirmOrder = async (order: Order) => {
    setIsProcessingAction(true);
    try {
      await updateOrderStatus(order.id, 'confirmed');
      showToast(`Order #${order.id} confirmed! Moved to Confirmed (Ready to Ship) section. 🧶`, 'success');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 2. Cancel Order with Reason
  const handleOpenCancelModal = (order: Order) => {
    setCancellingOrder(order);
    setCancelPreset('Customer requested cancellation');
    setCancelReasonInput('');
  };

  const handleExecuteCancel = async () => {
    if (!cancellingOrder) return;
    const finalReason = cancelReasonInput.trim() 
      ? `${cancelPreset}: ${cancelReasonInput.trim()}` 
      : cancelPreset;

    setIsProcessingAction(true);
    try {
      await updateOrderStatus(cancellingOrder.id, 'cancelled', {
        cancelReason: finalReason
      });
      setCancellingOrder(null);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 3. Mark as Shipped with Courier & Tracking AWB
  const handleOpenShipModal = (order: Order) => {
    setShippingOrder(order);
    setShipCourierPartner(order.courierPartner || settings.defaultCourierPartner || 'India Post Speed Post');
    setShipTrackingNumber(order.trackingNumber || trackingInputs[order.id] || '');
  };

  const handleExecuteShip = async () => {
    if (!shippingOrder) return;
    setIsProcessingAction(true);
    try {
      await updateOrderStatus(shippingOrder.id, 'shipped', {
        courierPartner: shipCourierPartner.trim(),
        trackingNumber: shipTrackingNumber.trim()
      });
      setShippingOrder(null);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 4. Mark Out for Delivery (delivery man with product)
  const handleOpenOutForDeliveryModal = (order: Order) => {
    setOutForDeliveryOrder(order);
    setDeliveryAgentNotes('');
  };

  const handleExecuteOutForDelivery = async () => {
    if (!outForDeliveryOrder) return;
    setIsProcessingAction(true);
    try {
      await updateOrderStatus(outForDeliveryOrder.id, 'out_for_delivery', {
        deliveryNotes: deliveryAgentNotes.trim() || 'Delivery agent is out with parcel for final doorstep delivery.'
      });
      setOutForDeliveryOrder(null);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // 5. Mark as Delivered (Final handover)
  const handleOpenDeliveredModal = (order: Order) => {
    setDeliveringOrder(order);
  };

  const handleExecuteDelivered = async () => {
    if (!deliveringOrder) return;
    setIsProcessingAction(true);
    try {
      const willMarkCodPaid = settings.autoMarkCodPaidOnDelivered !== false && deliveringOrder.paymentMethod === 'cod';
      await updateOrderStatus(deliveringOrder.id, 'delivered', {
        paymentStatus: willMarkCodPaid ? 'paid' : deliveringOrder.paymentStatus
      });
      setDeliveringOrder(null);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Quick save inline tracking input
  const handleSaveInlineTracking = async (orderId: string, currentStatus: Order['status']) => {
    const awb = trackingInputs[orderId];
    if (awb && awb.trim()) {
      await updateOrderStatus(orderId, currentStatus, { trackingNumber: awb.trim() });
      setTrackingInputs(prev => ({ ...prev, [orderId]: '' }));
    }
  };

  const getWhatsAppLink = (order: Order, stage: 'orderReceived' | 'confirmed' | 'shipped' | 'outForDelivery' | 'delivered' | 'cancelled') => {
    if (!isWhatsAppStageEnabled(settings, stage) || !order.customer.phone) return null;
    const message = createOrderWhatsAppMessage({ order, settings }, stage);
    return createWhatsAppUrl(order.customer.phone, message, settings.whatsappCountryCode || '91');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER WITH STUDIO ORDERS & COMMISSION TRACKING TITLE
         ───────────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        padding: '24px',
        borderRadius: '24px',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.5rem' }}>🧶</span>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Studio Orders & Commission Tracking
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Define fulfillment settings, confirm handcrafted commissions, assign couriers, and track parcels to delivery.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1.5px solid var(--border-medium)',
                backgroundColor: isSettingsOpen ? 'var(--accent-terracotta-light)' : '#FFFFFF',
                color: isSettingsOpen ? 'var(--accent-terracotta)' : 'var(--text-main)',
                fontSize: '0.86rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Settings2 size={16} />
              <span>Studio & Commission Settings</span>
              {isSettingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. COLLAPSIBLE COMMISSION & STUDIO SETTINGS PANEL
           ───────────────────────────────────────────────────────────── */}
        {isSettingsOpen && (
          <form 
            onSubmit={handleSaveSettings}
            style={{
              backgroundColor: 'var(--bg-surface-soft)',
              padding: '20px 22px',
              borderRadius: '18px',
              border: '1px solid var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              animation: 'fadeIn 0.2s ease-in-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-medium)', paddingBottom: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  ⚙️ Define Precise Studio & Commission Parameters
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Set up your studio artisan payout splits, default courier service, and delivery workflow automations.
                </p>
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-terracotta)', backgroundColor: 'var(--accent-terracotta-light)', padding: '3px 10px', borderRadius: '999px' }}>
                Active Studio Rule
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px'
            }}>
              {/* Commission Rate */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Studio Commission / Platform Fee ({settingsForm.commissionType === 'percentage' ? '%' : settings.currency}):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    max={settingsForm.commissionType === 'percentage' ? 100 : 10000}
                    step="0.5"
                    value={settingsForm.artisanCommissionRate}
                    onChange={(e) => setSettingsForm({ ...settingsForm, artisanCommissionRate: Number(e.target.value) })}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border-medium)',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.86rem',
                      fontWeight: 700
                    }}
                  />
                  <select
                    value={settingsForm.commissionType}
                    onChange={(e) => setSettingsForm({ ...settingsForm, commissionType: e.target.value as 'percentage' | 'fixed' })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1.5px solid var(--border-medium)',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="percentage">% Percentage</option>
                    <option value="fixed">Fixed {settings.currency}</option>
                  </select>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {settingsForm.commissionType === 'percentage'
                    ? `Artisan keeps ${(100 - settingsForm.artisanCommissionRate).toFixed(1)}% of each order; studio fee is ${settingsForm.artisanCommissionRate}%.`
                    : `Studio deducts ${settings.currency}${settingsForm.artisanCommissionRate} per order towards studio overhead.`}
                </div>
              </div>

              {/* Default Courier Partner */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Default Courier Dispatch Partner:
                </label>
                <select
                  value={settingsForm.defaultCourierPartner}
                  onChange={(e) => setSettingsForm({ ...settingsForm, defaultCourierPartner: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-medium)',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {courierOptions.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Auto-populated when clicking "Shipped" on confirmed orders.
                </div>
              </div>

              {/* Estimated Crafting Turnaround */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                  Estimated Crafting Days (Turnaround):
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={settingsForm.estimatedCraftingDays}
                  onChange={(e) => setSettingsForm({ ...settingsForm, estimatedCraftingDays: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-medium)',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.86rem',
                    fontWeight: 700
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Communicated to patrons in confirmation tracking updates.
                </div>
              </div>
            </div>

            {/* Order settings */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              paddingTop: '8px',
              borderTop: '1px dashed var(--border-medium)'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settingsForm.autoMarkCodPaidOnDelivered}
                  onChange={(e) => setSettingsForm({ ...settingsForm, autoMarkCodPaidOnDelivered: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-terracotta)' }}
                />
                <span>Automatically mark COD as PAID upon final delivery</span>
              </label>

            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>

              <button
                type="submit"
                disabled={isSavingSettings}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent-terracotta)',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Check size={14} />
                <span>{isSavingSettings ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ─────────────────────────────────────────────────────────────
            3. KEY METRICS & COMMISSION SUMMARY TILES
           ───────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px'
        }}>
          {/* Gross Orders */}
          <div style={{
            backgroundColor: 'var(--bg-surface-soft)',
            padding: '14px 18px',
            borderRadius: '16px',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Orders
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              {orderStats.total}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
              Gross Volume: {settings.currency}{orderStats.totalGrossRevenue.toFixed(2)}
            </div>
          </div>

          {/* Pending Action Required */}
          <div 
            onClick={() => setActiveTab('pending')}
            style={{
              backgroundColor: orderStats.pendingCount > 0 ? '#FFFBEB' : 'var(--bg-surface-soft)',
              padding: '14px 18px',
              borderRadius: '16px',
              border: `1.5px solid ${orderStats.pendingCount > 0 ? '#FDE68A' : 'var(--border-light)'}`,
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: orderStats.pendingCount > 0 ? '#B45309' : 'var(--text-muted)', textTransform: 'uppercase' }}>
              Pending Review
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: orderStats.pendingCount > 0 ? '#D97706' : 'var(--text-main)', marginTop: '4px' }}>
              {orderStats.pendingCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: orderStats.pendingCount > 0 ? '#B45309' : 'var(--text-subtle)', marginTop: '2px' }}>
              {orderStats.pendingCount > 0 ? '⚠️ Action Required: Confirm/Cancel' : 'All orders reviewed'}
            </div>
          </div>

          {/* Confirmed / Ready to Ship */}
          <div 
            onClick={() => setActiveTab('confirmed')}
            style={{
              backgroundColor: orderStats.confirmedCount > 0 ? '#F0F9FF' : 'var(--bg-surface-soft)',
              padding: '14px 18px',
              borderRadius: '16px',
              border: `1.5px solid ${orderStats.confirmedCount > 0 ? '#BAE6FD' : 'var(--border-light)'}`,
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: orderStats.confirmedCount > 0 ? '#0284C7' : 'var(--text-muted)', textTransform: 'uppercase' }}>
              Ready to Ship
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: orderStats.confirmedCount > 0 ? '#0369A1' : 'var(--text-main)', marginTop: '4px' }}>
              {orderStats.confirmedCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: orderStats.confirmedCount > 0 ? '#0284C7' : 'var(--text-subtle)', marginTop: '2px' }}>
              Confirmed & packing bench
            </div>
          </div>

          {/* Shipped & Out for Delivery */}
          <div 
            onClick={() => setActiveTab(orderStats.outForDeliveryCount > 0 ? 'out_for_delivery' : 'shipped')}
            style={{
              backgroundColor: 'var(--bg-surface-soft)',
              padding: '14px 18px',
              borderRadius: '16px',
              border: '1px solid var(--border-light)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              In Transit / Active
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#6D28D9', marginTop: '4px' }}>
              {orderStats.shippedCount + orderStats.outForDeliveryCount}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
              {orderStats.shippedCount} dispatched • {orderStats.outForDeliveryCount} on bike
            </div>
          </div>

          {/* Studio Commission Earned */}
          <div style={{
            backgroundColor: 'var(--accent-sage-light)',
            padding: '14px 18px',
            borderRadius: '16px',
            border: '1px solid rgba(80, 140, 100, 0.2)'
          }}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-sage)', textTransform: 'uppercase' }}>
              Studio Commission
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-sage)', marginTop: '4px' }}>
              {settings.currency}{orderStats.estimatedTotalCommission.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-sage)', marginTop: '2px' }}>
              {commissionRate}{isFixedCommission ? settings.currency : '%'} rate • Payout: {settings.currency}{orderStats.netArtisanPayout.toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. WORKFLOW TABS (Pending -> Confirmed -> Shipped -> Out for Delivery -> Delivered -> Cancelled)
         ───────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-medium)'
      }}>
        {[
          { id: 'pending', label: 'Pending Review', count: orderStats.pendingCount, alert: orderStats.pendingCount > 0, icon: <Clock size={15} /> },
          { id: 'confirmed', label: 'Confirmed (Ready to Ship)', count: orderStats.confirmedCount, icon: <Box size={15} /> },
          { id: 'shipped', label: 'Shipped (In Transit)', count: orderStats.shippedCount, icon: <Truck size={15} /> },
          { id: 'out_for_delivery', label: 'Out for Delivery', count: orderStats.outForDeliveryCount, icon: <MapPin size={15} /> },
          { id: 'delivered', label: 'Delivered', count: orderStats.deliveredCount, icon: <CheckCircle2 size={15} /> },
          { id: 'cancelled', label: 'Cancelled', count: orderStats.cancelledCount, icon: <AlertCircle size={15} /> },
          { id: 'all', label: 'All Orders', count: orderStats.total, icon: <Package size={15} /> }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SectionTab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: isActive ? 'var(--accent-terracotta)' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                fontSize: '0.84rem',
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '999px',
                backgroundColor: isActive 
                  ? 'rgba(255, 255, 255, 0.25)' 
                  : (tab.alert ? '#FEE2E2' : 'var(--bg-surface-soft)'),
                color: isActive 
                  ? '#FFFFFF' 
                  : (tab.alert ? '#B91C1C' : 'var(--text-main)')
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. SEARCH & PAYMENT FILTER BAR
         ───────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Search Input */}
        <div style={{
          position: 'relative',
          flex: '1 1 320px',
          maxWidth: '540px'
        }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)' }} />
          <input
            type="text"
            placeholder="Search Order ID, Customer name, email, phone, city, AWB..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
              borderRadius: '12px',
              border: '1.5px solid var(--border-medium)',
              fontSize: '0.86rem',
              backgroundColor: '#FFFFFF',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Payment Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Payment:</span>
          <select
            value={paymentFilter}
            onChange={(e) => {
              const value = e.target.value;
              setPaymentFilter(value === 'paid' || value === 'pending' || value === 'cod' ? value : 'all');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1.5px solid var(--border-medium)',
              fontSize: '0.82rem',
              backgroundColor: '#FFFFFF',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid Only</option>
            <option value="pending">Payment Pending</option>
            <option value="cod">Cash on Delivery (COD)</option>
          </select>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          6. ORDERS LISTING ACCORDING TO PIPELINE STAGE
         ───────────────────────────────────────────────────────────── */}
      {filteredOrders.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1px dashed var(--border-medium)'
        }}>
          <Package size={40} color="var(--accent-terracotta)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>
            No orders in "{activeTab.replace(/_/g, ' ').toUpperCase()}" section
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
            {searchQuery 
              ? `No matches for "${searchQuery}". Clear your search query to see orders.`
              : activeTab === 'pending'
                ? 'Great job! All incoming handcrafted orders have been reviewed and confirmed.'
                : 'Orders will appear here as they transition through your studio fulfillment pipeline.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {filteredOrders.map(order => {
            const statusConfig = getStatusBadge(order.status);
            const { commission, payout } = calculateOrderCommission(order.total);
            const whatsappAvailable = Boolean(
              isWhatsAppEnabled(settings) &&
              order.customer.phone &&
              normalizeWhatsAppPhone(order.customer.phone, settings.whatsappCountryCode || '91')
            );

            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '22px',
                  border: order.status === 'pending' 
                    ? '1.5px solid #FCD34D' 
                    : (order.status === 'out_for_delivery' ? '1.5px solid #FDE68A' : '1px solid var(--border-medium)'),
                  padding: '24px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                  position: 'relative'
                }}
              >
                {/* ── CARD TOP HEADER ── */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  borderBottom: '1px solid var(--border-light)',
                  paddingBottom: '14px'
                }}>
                  {/* Left: ID & Date & Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      #{order.id}
                    </span>

                    <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
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

                  {/* Right: Status Pill & Print Invoice */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                      title="Generate and print GST / Tax Invoice"
                    >
                      <FileText size={14} />
                      <span>Print Invoice</span>
                    </button>

                    {/* Status Pill */}
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
                  </div>
                </div>

                {/* ── CARD MIDDLE: ITEMS & CUSTOMER / SHIPPING DETAILS ── */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px'
                }}>
                  {/* Items List */}
                  <div>
                    <h5 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>
                      Handcrafted Commissions & Items ({order.items.length}):
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
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-surface-soft)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {item.image && (
                              <img
                                src={getAssetUrl(item.image)}
                                alt={item.productTitle}
                                style={{ width: '38px', height: '38px', borderRadius: '8px', objectFit: 'cover' }}
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

                  {/* Customer & Shipping Destination */}
                  <div style={{
                    backgroundColor: 'var(--bg-surface-soft)',
                    padding: '16px 18px',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h5 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                          Customer & Delivery Destination:
                        </h5>
                        {whatsappAvailable && (
                          <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MessageCircle size={12} />
                            <span>WhatsApp Ready</span>
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>
                        {order.customer.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        ✉️ {order.customer.email}
                      </div>
                      {order.customer.phone && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          📞 {order.customer.phone}
                        </div>
                      )}
                      {order.customer.address && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                          <MapPin size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-terracotta)' }} />
                          <span>{order.customer.address}{order.customer.city ? `, ${order.customer.city}` : ''}</span>
                        </div>
                      )}
                    </div>

                    {/* Financial Snapshot & Commission Split */}
                    <div style={{
                      paddingTop: '10px',
                      borderTop: '1px dashed var(--border-medium)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Order Total:</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-terracotta)' }}>
                          {settings.currency}{order.total.toFixed(2)}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.74rem',
                        color: 'var(--text-subtle)',
                        backgroundColor: '#FFFFFF',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-light)'
                      }}>
                        <span>Studio Comm ({commissionRate}%): <strong>{settings.currency}{commission}</strong></span>
                        <span>Maker Payout: <strong style={{ color: '#059669' }}>{settings.currency}{payout}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── CARD BOTTOM: LOGISTICS DETAILS & LIFECYCLE ACTION CONTROLS ── */}
                
                {/* Case 1: Cancelled Order View */}
                {order.status === 'cancelled' && (
                  <div style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    padding: '14px 18px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991B1B', fontWeight: 700, fontSize: '0.86rem' }}>
                        <AlertCircle size={15} />
                        <span>Cancellation Reason:</span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#7F1D1D', marginTop: '2px' }}>
                        {order.cancelReason || 'Cancelled by studio admin. Items returned to stock.'}
                      </div>
                    </div>
                    {whatsappAvailable && isWhatsAppStageEnabled(settings, 'cancelled') && (
                      <a
                        href={getWhatsAppLink(order, 'cancelled') || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#FFFFFF',
                          color: '#DC2626',
                          border: '1px solid #FECACA',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        <MessageCircle size={13} />
                        <span>Send WhatsApp Notice</span>
                      </a>
                    )}
                  </div>
                )}

                {/* Case 2: Active Courier Tracking Display if Shipped / Out for Delivery / Delivered */}
                {(order.status === 'shipped' || order.status === 'out_for_delivery' || order.status === 'delivered') && (
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid var(--border-medium)',
                    padding: '12px 16px',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Truck size={18} color="#0284C7" />
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {order.courierPartner || 'Assigned Courier Partner'}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          AWB / Tracking Number: <strong style={{ color: 'var(--text-main)', letterSpacing: '0.04em' }}>{order.trackingNumber || 'Pending AWB'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Quick Inline AWB Editor if needed */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="text"
                        placeholder="Edit AWB..."
                        value={trackingInputs[order.id] !== undefined ? trackingInputs[order.id] : ''}
                        onChange={(e) => setTrackingInputs({ ...trackingInputs, [order.id]: e.target.value })}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.74rem',
                          width: '130px'
                        }}
                      />
                      <button
                        onClick={() => handleSaveInlineTracking(order.id, order.status)}
                        disabled={!trackingInputs[order.id]?.trim()}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--accent-terracotta)',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          opacity: trackingInputs[order.id]?.trim() ? 1 : 0.5
                        }}
                      >
                        Update AWB
                      </button>
                    </div>
                  </div>
                )}

                {/* ── CARD ACTION BUTTONS ROW (THE CORE LIFECYCLE CONTROLS) ── */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  paddingTop: '14px',
                  borderTop: '1px solid var(--border-light)'
                }}>
                  {/* Left-side Helper Text or Secondary Actions */}
                  <div>
                    {order.status === 'pending' && (
                      <span style={{ fontSize: '0.8rem', color: '#B45309', fontWeight: 600 }}>
                        ⏳ Review order: Click "Confirm Order" to start crafting, or "Cancel" with reason.
                      </span>
                    )}
                    {(order.status === 'confirmed' || order.status === 'processing') && (
                      <span style={{ fontSize: '0.8rem', color: '#0369A1', fontWeight: 600 }}>
                        🧶 Confirmed & Crafting: Once wrapped and packed, click "Mark as Shipped".
                      </span>
                    )}
                    {order.status === 'shipped' && (
                      <span style={{ fontSize: '0.8rem', color: '#6D28D9', fontWeight: 600 }}>
                        🚚 In Transit: When the delivery partner is out with parcel, click "Out for Delivery".
                      </span>
                    )}
                    {order.status === 'out_for_delivery' && (
                      <span style={{ fontSize: '0.8rem', color: '#B45309', fontWeight: 700 }}>
                        🛵 Out with delivery agent: Click "Mark as Delivered" upon doorstep confirmation.
                      </span>
                    )}
                    {order.status === 'delivered' && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-sage)', fontWeight: 700 }}>
                        🌸 Delivered successfully! Customer received handcrafted creation.
                      </span>
                    )}
                  </div>

                  {/* Right-side Step-by-Step Transition Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    
                    {/* STAGE 1: PENDING ORDERS (Cancel Option with Reason + Confirm Button) */}
                    {order.status === 'pending' && (
                      <>
                        {whatsappAvailable && isWhatsAppStageEnabled(settings, 'orderReceived') && (
                          <a
                            href={getWhatsAppLink(order, 'orderReceived') || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              backgroundColor: '#DCFCE7',
                              color: '#16A34A',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            <MessageCircle size={14} />
                            <span>Order received</span>
                          </a>
                        )}
                        <button
                          onClick={() => handleOpenCancelModal(order)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '9px 16px',
                            borderRadius: '10px',
                            border: '1.5px solid #FECACA',
                            backgroundColor: '#FEF2F2',
                            color: '#B91C1C',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <X size={15} />
                          <span>Cancel Order</span>
                        </button>

                        <button
                          onClick={() => handleConfirmOrder(order)}
                          disabled={isProcessingAction}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'var(--accent-terracotta)',
                            color: '#FFFFFF',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          <Check size={16} />
                          <span>Confirm Order</span>
                        </button>
                      </>
                    )}

                    {/* STAGE 2: CONFIRMED ORDERS (Ready to be Shipped -> Shipped Button) */}
                    {(order.status === 'confirmed' || order.status === 'processing') && (
                      <>
                        <button
                          onClick={() => handleOpenCancelModal(order)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: '1px solid var(--border-medium)',
                            backgroundColor: '#FFFFFF',
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <span>Cancel Order</span>
                        </button>

                        {whatsappAvailable && isWhatsAppStageEnabled(settings, 'confirmed') && (
                          <a
                            href={getWhatsAppLink(order, 'confirmed') || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              backgroundColor: '#DCFCE7',
                              color: '#16A34A',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            <MessageCircle size={14} />
                            <span>WhatsApp</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleOpenShipModal(order)}
                          disabled={isProcessingAction}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: '#0284C7',
                            color: '#FFFFFF',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          <Truck size={16} />
                          <span>Shipped</span>
                        </button>
                      </>
                    )}

                    {/* STAGE 3: SHIPPED ORDERS (In Transit -> Out for Delivery Button) */}
                    {order.status === 'shipped' && (
                      <>
                        {whatsappAvailable && isWhatsAppStageEnabled(settings, 'shipped') && (
                          <a
                            href={getWhatsAppLink(order, 'shipped') || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              backgroundColor: '#DCFCE7',
                              color: '#16A34A',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            <MessageCircle size={14} />
                            <span>Send AWB</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleOpenOutForDeliveryModal(order)}
                          disabled={isProcessingAction}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 20px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: '#D97706',
                            color: '#FFFFFF',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          <MapPin size={16} />
                          <span>Out for Delivery</span>
                        </button>
                      </>
                    )}

                    {/* STAGE 4: OUT FOR DELIVERY (Rider with Product -> Delivered Button) */}
                    {order.status === 'out_for_delivery' && (
                      <>
                        {whatsappAvailable && isWhatsAppStageEnabled(settings, 'outForDelivery') && (
                          <a
                            href={getWhatsAppLink(order, 'outForDelivery') || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              backgroundColor: '#DCFCE7',
                              color: '#16A34A',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            <MessageCircle size={14} />
                            <span>Notify Rider On Route</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleOpenDeliveredModal(order)}
                          disabled={isProcessingAction}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '9px 22px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: 'var(--accent-sage)',
                            color: '#FFFFFF',
                            fontSize: '0.86rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: 'var(--shadow-sm)'
                          }}
                        >
                          <CheckCircle2 size={16} />
                          <span>Mark as Delivered</span>
                        </button>
                      </>
                    )}

                    {/* STAGE 5: DELIVERED (Completed Order) */}
                    {order.status === 'delivered' && (
                      <>
                        {whatsappAvailable && isWhatsAppStageEnabled(settings, 'delivered') && (
                          <a
                            href={getWhatsAppLink(order, 'delivered') || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 14px',
                              borderRadius: '10px',
                              backgroundColor: '#DCFCE7',
                              color: '#16A34A',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              textDecoration: 'none'
                            }}
                          >
                            <MessageCircle size={14} />
                            <span>Thank Customer</span>
                          </a>
                        )}

                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--accent-sage-light)',
                          color: 'var(--accent-sage)',
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}>
                          <Check size={14} />
                          <span>Completed</span>
                        </div>
                      </>
                    )}

                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. MODAL: CANCEL ORDER WITH MESSAGE / REASON
         ───────────────────────────────────────────────────────────── */}
      {cancellingOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '520px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#B91C1C'
                }}>
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#B91C1C' }}>
                    Cancel Order #{cancellingOrder.id}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Customer: {cancellingOrder.customer.name} ({cancellingOrder.customer.email})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCancellingOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Inventory Restock Warning */}
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '0.82rem',
              color: '#991B1B',
              lineHeight: 1.4
            }}>
              <strong>Restock Assurance:</strong> All {cancellingOrder.items.reduce((acc, i) => acc + i.quantity, 0)} reserved handcrafted item(s) will be returned to store inventory immediately upon cancellation.
            </div>

            {/* Reason Presets */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                Select Cancellation Reason Category:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {cancelPresets.map(preset => (
                  <label
                    key={preset}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${cancelPreset === preset ? '#B91C1C' : 'var(--border-light)'}`,
                      backgroundColor: cancelPreset === preset ? '#FEF2F2' : '#FFFFFF',
                      fontSize: '0.82rem',
                      color: 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="cancel_preset"
                      checked={cancelPreset === preset}
                      onChange={() => setCancelPreset(preset)}
                      style={{ accentColor: '#B91C1C' }}
                    />
                    <span>{preset}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Message / Additional details */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Specific Message / Reason Note (Visible to Customer & Record):
              </label>
              <textarea
                rows={3}
                placeholder="Enter specific explanation for customer (e.g. 'Customer called requesting cancellation due to relocation...')"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-medium)',
                  fontSize: '0.84rem',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setCancellingOrder(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-main)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Keep Order
              </button>

              <button
                type="button"
                onClick={handleExecuteCancel}
                disabled={isProcessingAction}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#B91C1C',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <X size={15} />
                <span>{isProcessingAction ? 'Cancelling...' : 'Confirm Cancellation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          8. MODAL: DISPATCH & MARK AS SHIPPED
         ───────────────────────────────────────────────────────────── */}
      {shippingOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '500px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#E0F2FE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0369A1'
                }}>
                  <Truck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Dispatch Order #{shippingOrder.id}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Destination: {shippingOrder.customer.address || shippingOrder.customer.city || 'India'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShippingOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Courier Service Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Select Courier / Logistics Service:
              </label>
              <select
                value={shipCourierPartner}
                onChange={(e) => setShipCourierPartner(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-medium)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {courierOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Courier AWB Tracking Number */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Courier AWB / Consignment Tracking Number:
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SP123456789IN or DEL1234567"
                value={shipTrackingNumber}
                onChange={(e) => setShipTrackingNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-medium)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                This number is immediately viewable by the customer on their live tracking link.
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShippingOrder(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteShip}
                disabled={isProcessingAction}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#0284C7',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Truck size={15} />
                <span>{isProcessingAction ? 'Dispatching...' : 'Confirm Shipment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          9. MODAL: MARK OUT FOR DELIVERY (DELIVERY MAN ON ROUTE)
         ───────────────────────────────────────────────────────────── */}
      {outForDeliveryOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '480px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#B45309'
                }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Out for Delivery
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Order #{outForDeliveryOrder.id} • {outForDeliveryOrder.customer.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setOutForDeliveryOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '0.82rem',
              color: '#92400E'
            }}>
              🛵 <strong>Delivery Agent Dispatch:</strong> Move order to active doorstep route. The customer will see that the parcel is with the local delivery person.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                Rider / Delivery Agent Details or Note (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Delivery Executive: Rajesh (+91 98765 00000)"
                value={deliveryAgentNotes}
                onChange={(e) => setDeliveryAgentNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-medium)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.84rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setOutForDeliveryOrder(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleExecuteOutForDelivery}
                disabled={isProcessingAction}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#D97706',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MapPin size={15} />
                <span>{isProcessingAction ? 'Dispatching...' : 'Confirm Out for Delivery'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          10. MODAL: MARK AS DELIVERED
         ───────────────────────────────────────────────────────────── */}
      {deliveringOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(28, 25, 23, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '460px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-sage-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-sage)'
                }}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Confirm Final Delivery
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Order #{deliveringOrder.id} • {deliveringOrder.customer.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDeliveringOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{
              backgroundColor: 'var(--accent-sage-light)',
              padding: '14px 16px',
              borderRadius: '14px',
              fontSize: '0.84rem',
              color: 'var(--accent-sage)',
              lineHeight: 1.5
            }}>
              🌸 <strong>Handcrafted Parcel Delivered:</strong> This will mark Order #{deliveringOrder.id} as fulfilled.
              {deliveringOrder.paymentMethod === 'cod' && (
                <div style={{ marginTop: '6px', fontWeight: 700, color: '#047857' }}>
                  💵 Cash on Delivery collection of {settings.currency}{deliveringOrder.total.toFixed(2)} will be marked as PAID.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setDeliveringOrder(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  backgroundColor: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Not Yet
              </button>

              <button
                type="button"
                onClick={handleExecuteDelivered}
                disabled={isProcessingAction}
                style={{
                  padding: '10px 22px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--accent-sage)',
                  color: '#FFFFFF',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <CheckCircle2 size={16} />
                <span>{isProcessingAction ? 'Updating...' : 'Yes, Order Delivered'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
