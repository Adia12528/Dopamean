import React, { useState, useRef } from 'react';
import type { Offer } from '../../types';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import { X, Upload, Check } from 'lucide-react';

interface AddOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  editOffer?: Offer | null;
}

const OFFER_BANNER_PRESETS = [
  {
    name: 'Floral Crochet Tote',
    url: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Strawberry Charm',
    url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Tulip Coaster Set',
    url: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=1200&q=80'
  },
  {
    name: 'Pastel Lavender Hat',
    url: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=1200&q=80'
  }
];

export const AddOfferModal: React.FC<AddOfferModalProps> = ({ isOpen, onClose, editOffer }) => {
  const { addOffer, updateOffer } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(editOffer?.title || '');
  const [description, setDescription] = useState(editOffer?.description || 'Get 25% off all floral bags & accessories.');
  const [badge, setBadge] = useState(editOffer?.badge || 'EXCLUSIVE OFFER');
  const [code, setCode] = useState(editOffer?.code || 'BLOOM25');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>(editOffer?.discountType || 'percentage');
  const [discountValue, setDiscountValue] = useState(editOffer?.discountValue?.toString() || '25');
  const [minOrderValue, setMinOrderValue] = useState(editOffer?.minOrderValue?.toString() || '40');
  const [image, setImage] = useState(editOffer?.image || OFFER_BANNER_PRESETS[0].url);
  const [endDate, setEndDate] = useState(editOffer?.endDate || '2026-11-30');
  const [isActive, setIsActive] = useState(editOffer ? editOffer.isActive : true);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const uploadedUrl = await api.uploadImage(file);
        setImage(uploadedUrl);
      } catch (err) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setImage(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !code.trim() || !image.trim()) return;

    const offerPayload = {
      title: title.trim(),
      description: description.trim(),
      badge: badge.trim().toUpperCase(),
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: parseFloat(discountValue) || 10,
      minOrderValue: minOrderValue ? parseFloat(minOrderValue) : undefined,
      image,
      endDate,
      isActive
    };

    if (editOffer) {
      updateOffer(editOffer.id, offerPayload);
    } else {
      addOffer(offerPayload);
    }

    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(35, 28, 22, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-medium)',
          position: 'relative',
          padding: '36px'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-light)',
          paddingBottom: '18px',
          marginBottom: '24px'
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--accent-terracotta)',
              textTransform: 'uppercase'
            }}>
              <span>🏷️ Promotions & Campaigns</span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
              {editOffer ? 'Edit Promotional Offer' : 'Launch New Promotional Deal & Banner'}
            </h2>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface-soft)',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* BANNER IMAGE UPLOAD & LIVE PREVIEW */}
          <div style={{
            backgroundColor: 'var(--bg-surface-soft)',
            borderRadius: '18px',
            padding: '20px',
            border: '1.5px dashed var(--border-dashed)'
          }}>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
              Campaign Banner Image (Upload from Computer or pick preset)
            </label>

            {/* Live Card Preview */}
            <div style={{
              position: 'relative',
              height: '140px',
              borderRadius: '14px',
              overflow: 'hidden',
              marginBottom: '14px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <img
                src={image}
                alt="Banner preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = OFFER_BANNER_PRESETS[0].url;
                }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'
              }} />
              <span style={{
                position: 'absolute',
                top: '10px',
                left: '12px',
                backgroundColor: '#FFFFFF',
                color: 'var(--accent-terracotta)',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '999px'
              }}>
                {badge || 'SPECIAL PROMO'}
              </span>
              <div style={{ position: 'absolute', bottom: '12px', left: '14px', color: '#FFFFFF' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                  {title || 'Your Promo Title Here'}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  Code: <strong>{code || 'CODE'}</strong> • {discountType === 'percentage' ? `${discountValue}% OFF` : `$${discountValue} OFF`}
                </div>
              </div>
            </div>

            {/* Upload buttons */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--accent-terracotta)',
                  color: '#FFFFFF',
                  padding: '9px 16px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                <Upload size={15} />
                <span>Upload Banner File</span>
              </button>

              <input
                type="text"
                placeholder="Or paste banner image URL..."
                value={image}
                onChange={(e) => setImage(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '220px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.82rem',
                  backgroundColor: '#FFFFFF'
                }}
              />
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', fontWeight: 600 }}>Presets:</span>
              {OFFER_BANNER_PRESETS.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImage(preset.url)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: image === preset.url ? 'var(--accent-terracotta)' : '#FFFFFF',
                    color: image === preset.url ? '#FFFFFF' : 'var(--text-muted)',
                    border: '1px solid var(--border-medium)'
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* OFFER DETAILS */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Offer Campaign Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Spring Blossom 25% Off Totes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Badge Text
              </label>
              <input
                type="text"
                placeholder="SEASONAL SALE"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
              Description / Offer Terms
            </label>
            <input
              type="text"
              placeholder="e.g. Enjoy 20% off all floral totes and daisy bucket hats."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-medium)',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {/* DISCOUNT CODE & TYPE */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Coupon Promo Code *
              </label>
              <input
                type="text"
                required
                placeholder="BLOOM25"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--accent-terracotta)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Discount Type
              </label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.88rem',
                  backgroundColor: '#FFFFFF'
                }}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Dollar ($)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Discount Value *
              </label>
              <input
                type="number"
                required
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Min Order ($)
              </label>
              <input
                type="number"
                placeholder="40"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Expiration Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '22px' }}>
              <input
                type="checkbox"
                id="active-offer-check"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-terracotta)' }}
              />
              <label htmlFor="active-offer-check" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                Make Offer Immediately Active 🚀
              </label>
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              <Check size={16} />
              <span>{editOffer ? 'Save Offer Changes' : 'Launch Offer Banner'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
