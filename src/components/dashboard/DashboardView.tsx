import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import type { Product, Offer, DashboardTab } from '../../types';
import { DashboardOverview } from './DashboardOverview';
import { ProductManager } from './ProductManager';
import { OffersManager } from './OffersManager';
import { OrdersManager } from './OrdersManager';
import { StudioSettings } from './StudioSettings';
import { AddProductModal } from './AddProductModal';
import { AddOfferModal } from './AddOfferModal';
import { 
  BarChart3, 
  ShoppingBag, 
  Tag, 
  Package, 
  Store, 
  Sliders, 
  Sparkles
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { dashboardTab, setDashboardTab, setViewMode, settings } = useStore();

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isAddOfferOpen, setIsAddOfferOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

  const handleEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setIsAddProductOpen(true);
  };

  const handleEditOffer = (offer: Offer) => {
    setEditingOffer(offer);
    setIsAddOfferOpen(true);
  };

  const tabs = [
    { id: 'overview' as DashboardTab, label: 'Overview', icon: <BarChart3 size={17} /> },
    { id: 'products' as DashboardTab, label: 'Products & Images', icon: <ShoppingBag size={17} /> },
    { id: 'offers' as DashboardTab, label: 'Offers & Campaigns', icon: <Tag size={17} /> },
    { id: 'orders' as DashboardTab, label: 'Customer Orders', icon: <Package size={17} /> },
    { id: 'settings' as DashboardTab, label: 'Studio Settings', icon: <Sliders size={17} /> }
  ];

  return (
    <div style={{ minHeight: '100vh', padding: '36px 0 60px' }}>
      <div className="container">
        {/* Dashboard Title & Top Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px'
        }}>
          <div className="dashboard-title-copy">
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--accent-sage)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <Sparkles size={14} />
              <span>{settings.storeName} Creator Studio</span>
            </div>
            <h1 style={{
              fontSize: '2.2rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginTop: '4px'
            }}>
              Studio Dashboard
            </h1>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Manage your crochet catalog, upload latest product imagery, launch offers, and configure store branding.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setViewMode('store')}
              className="btn-secondary"
              style={{ padding: '9px 18px', fontSize: '0.86rem' }}
            >
              <Store size={16} />
              <span>View Customer Storefront</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="dashboard-tabs" style={{
          display: 'flex',
          gap: '10px',
          borderBottom: '1px solid var(--border-medium)',
          paddingBottom: '14px',
          marginBottom: '28px',
          overflowX: 'auto'
        }}>
          {tabs.map(tab => {
            const isActive = dashboardTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setDashboardTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 20px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  backgroundColor: isActive ? 'var(--accent-terracotta)' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                  border: isActive ? '1px solid var(--accent-terracotta)' : '1px solid var(--border-medium)',
                  boxShadow: isActive ? '0 4px 14px rgba(200, 90, 50, 0.25)' : 'var(--shadow-sm)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div className="dashboard-content">
        {dashboardTab === 'overview' && (
          <DashboardOverview
            onOpenAddProduct={() => {
              setEditingProduct(null);
              setIsAddProductOpen(true);
            }}
            onOpenAddOffer={() => {
              setEditingOffer(null);
              setIsAddOfferOpen(true);
            }}
          />
        )}

        {dashboardTab === 'products' && (
          <ProductManager
            onOpenAddModal={() => {
              setEditingProduct(null);
              setIsAddProductOpen(true);
            }}
            onEditProduct={handleEditProduct}
          />
        )}

        {dashboardTab === 'offers' && (
          <OffersManager
            onOpenAddModal={() => {
              setEditingOffer(null);
              setIsAddOfferOpen(true);
            }}
            onEditOffer={handleEditOffer}
          />
        )}

        {dashboardTab === 'orders' && (
          <OrdersManager />
        )}

        {dashboardTab === 'settings' && (
          <StudioSettings />
        )}
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => {
          setIsAddProductOpen(false);
          setEditingProduct(null);
        }}
        editProduct={editingProduct}
      />

      {/* Add / Edit Offer Modal */}
      <AddOfferModal
        isOpen={isAddOfferOpen}
        onClose={() => {
          setIsAddOfferOpen(false);
          setEditingOffer(null);
        }}
        editOffer={editingOffer}
      />
    </div>
  );
};
