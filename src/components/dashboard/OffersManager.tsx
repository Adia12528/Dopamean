import React from 'react';
import type { Offer } from '../../types';
import { useStore } from '../../context/StoreContext';
import { getAssetUrl } from '../../services/api';
import { 
  Plus, 
  Tag, 
  Clock, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  PauseCircle
} from 'lucide-react';

interface OffersManagerProps {
  onOpenAddModal: () => void;
  onEditOffer: (offer: Offer) => void;
}

export const OffersManager: React.FC<OffersManagerProps> = ({ onOpenAddModal, onEditOffer }) => {
  const { offers, toggleOfferStatus, deleteOffer, settings } = useStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Action */}
      <div className="dashboard-action-bar" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: '#FFFFFF',
        padding: '20px 24px',
        borderRadius: '20px',
        border: '1px solid var(--border-medium)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Promotional Offers & Marketing Banners
          </h3>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Active campaigns automatically appear on your storefront's hero carousel and customer promo codes.
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="btn-primary dashboard-primary-action"
          style={{ padding: '10px 20px' }}
        >
          <Plus size={18} />
          <span>Launch New Offer & Banner</span>
        </button>
      </div>

      {/* Offers Cards List */}
      {offers.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px dashed var(--border-medium)'
        }}>
          <Tag size={36} color="var(--accent-terracotta)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>No promotional offers created yet</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Create seasonal discounts or voucher codes to attract new patrons!
          </p>
          <button onClick={onOpenAddModal} className="btn-primary" style={{ marginTop: '16px' }}>
            <span>Create First Offer</span>
          </button>
        </div>
      ) : (
        <div className="dashboard-offers-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '24px'
        }}>
          {offers.map(offer => (
            <div
              key={offer.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                border: '1px solid var(--border-medium)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                opacity: offer.isActive ? 1 : 0.75,
                transition: 'var(--transition-smooth)'
              }}
            >
              {/* Image banner preview */}
              <div style={{
                position: 'relative',
                height: '160px',
                backgroundColor: '#F8F5F0'
              }}>
                <img
                  src={getAssetUrl(offer.image)}
                  alt={offer.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'
                }} />

                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  display: 'flex',
                  gap: '8px'
                }}>
                  <span style={{
                    backgroundColor: '#FFFFFF',
                    color: 'var(--accent-terracotta)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '999px'
                  }}>
                    {offer.badge}
                  </span>

                  <span style={{
                    backgroundColor: offer.isActive ? 'var(--accent-sage)' : '#64748B',
                    color: '#FFFFFF',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {offer.isActive ? '● Live on Store' : '○ Paused'}
                  </span>
                </div>

                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '14px',
                  color: '#FFFFFF'
                }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
                    {offer.discountType === 'percentage'
                      ? `${offer.discountValue}% OFF`
                      : `${settings.currency}${offer.discountValue} OFF`}
                  </div>
                </div>
              </div>

              {/* Offer Details Body */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {offer.title}
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '14px' }}>
                    {offer.description}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-surface-soft)',
                    borderRadius: '12px',
                    marginBottom: '16px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
                        Promo Code
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--accent-terracotta)' }}>
                        {offer.code}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
                        Min Order
                      </div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {offer.minOrderValue ? `${settings.currency}${offer.minOrderValue}` : 'None'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Controls */}
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.76rem',
                    color: 'var(--text-subtle)',
                    marginBottom: '14px'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      <span>Valid until {offer.endDate}</span>
                    </span>
                  </div>

                  <div className="dashboard-offer-actions" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-light)'
                  }}>
                    {/* Active toggle button */}
                    <button
                      onClick={() => toggleOfferStatus(offer.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: offer.isActive ? 'var(--accent-sage-light)' : '#F1F5F9',
                        color: offer.isActive ? 'var(--accent-sage)' : '#64748B',
                        border: '1px solid currentColor'
                      }}
                    >
                      {offer.isActive ? <CheckCircle size={14} /> : <PauseCircle size={14} />}
                      <span>{offer.isActive ? 'Active (Click to Pause)' : 'Paused (Click to Resume)'}</span>
                    </button>

                    {/* Edit & Delete actions */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => onEditOffer(offer)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-surface-soft)',
                          border: '1px solid var(--border-medium)',
                          fontSize: '0.78rem',
                          color: 'var(--text-main)'
                        }}
                        title="Edit Offer"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Delete offer "${offer.title}"?`)) {
                            deleteOffer(offer.id);
                          }
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#DC2626'
                        }}
                        title="Delete Offer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
