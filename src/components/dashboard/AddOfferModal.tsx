import React, { useState, useRef } from 'react';
import { useBackNavigationLayer } from '../../context/BackNavigationContext';
import type { Offer } from '../../types';
import { useStore } from '../../context/StoreContext';
import { api, getAssetUrl } from '../../services/api';
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
  useBackNavigationLayer('add-offer-modal', isOpen, onClose);
  const { addOffer, updateOffer, settings } = useStore();
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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const uploadedUrl = await api.uploadImage(file);
        setImage(uploadedUrl);
      } catch {
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
    const parsedDiscountValue = Number(discountValue);
    const parsedMinOrderValue = minOrderValue.trim() ? Number(minOrderValue) : undefined;
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = 'Enter an offer title.';
    if (!code.trim()) errors.code = 'Enter a promo code.';
    if (!image.trim()) errors.image = 'Choose a banner image or enter an image URL.';
    if (!discountValue.trim() || !Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
      errors.discountValue = 'Enter a discount value greater than 0.';
    } else if (discountType === 'percentage' && parsedDiscountValue > 100) {
      errors.discountValue = 'Percentage discounts cannot exceed 100%.';
    }
    if (parsedMinOrderValue !== undefined && (!Number.isFinite(parsedMinOrderValue) || parsedMinOrderValue < 0)) {
      errors.minOrderValue = 'Enter a valid minimum order value of 0 or more, or leave this blank.';
    }
    if (!endDate || Number.isNaN(new Date(`${endDate}T00:00:00`).getTime())) {
      errors.endDate = 'Choose a valid expiration date.';
    }
    setValidationErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    const offerPayload = {
      title: title.trim(),
      description: description.trim(),
      badge: badge.trim().toUpperCase(),
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: parsedDiscountValue,
      minOrderValue: parsedMinOrderValue,
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
      className="mobile-modal-overlay"
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
        className="mobile-modal-panel dashboard-admin-modal"
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
        <div className="dashboard-modal-header" style={{
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

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
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
                src={getAssetUrl(image)}
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
                  Code: <strong>{code || 'CODE'}</strong> • {discountType === 'percentage' ? `${discountValue}% OFF` : `${settings.currency}${discountValue} OFF`}
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
                aria-invalid={Boolean(validationErrors.image)}
                onChange={(e) => {
                  setImage(e.target.value);
                  setValidationErrors(prev => ({ ...prev, image: '' }));
                }}
                style={{
                  flex: 1,
                  minWidth: '220px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${validationErrors.image ? '#DC2626' : 'var(--border-medium)'}`,
                  fontSize: '0.82rem',
                  backgroundColor: '#FFFFFF'
                }}
              />
            </div>
            {validationErrors.image && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '6px 0 0' }}>{validationErrors.image}</p>}

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
          <div className="dashboard-form-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Offer Campaign Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Spring Blossom 25% Off Totes"
                value={title}
                aria-invalid={Boolean(validationErrors.title)}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setValidationErrors(prev => ({ ...prev, title: '' }));
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${validationErrors.title ? '#DC2626' : 'var(--border-medium)'}`,
                  fontSize: '0.9rem'
                }}
              />
              {validationErrors.title && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.title}</p>}
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
          <div className="dashboard-form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Coupon Promo Code *
              </label>
              <input
                type="text"
                required
                placeholder="BLOOM25"
                value={code}
                aria-invalid={Boolean(validationErrors.code)}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setValidationErrors(prev => ({ ...prev, code: '' }));
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${validationErrors.code ? '#DC2626' : 'var(--border-medium)'}`,
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--accent-terracotta)'
                }}
              />
              {validationErrors.code && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.code}</p>}
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
                aria-invalid={Boolean(validationErrors.discountValue)}
                onChange={(e) => {
                  setDiscountValue(e.target.value);
                  setValidationErrors(prev => ({ ...prev, discountValue: '' }));
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${validationErrors.discountValue ? '#DC2626' : 'var(--border-medium)'}`,
                  fontSize: '0.9rem'
                }}
              />
              {validationErrors.discountValue && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.discountValue}</p>}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Min Order ($)
              </label>
              <input
                type="number"
                placeholder="40"
                value={minOrderValue}
                aria-invalid={Boolean(validationErrors.minOrderValue)}
                onChange={(e) => {
                  setMinOrderValue(e.target.value);
                  setValidationErrors(prev => ({ ...prev, minOrderValue: '' }));
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${validationErrors.minOrderValue ? '#DC2626' : 'var(--border-medium)'}`,
                  fontSize: '0.9rem'
                }}
              />
              {validationErrors.minOrderValue && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.minOrderValue}</p>}
            </div>
          </div>

          <div className="dashboard-form-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Expiration Date
              </label>
              <input
                type="date"
                required
                value={endDate}
                aria-invalid={Boolean(validationErrors.endDate)}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setValidationErrors(prev => ({ ...prev, endDate: '' }));
                }}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${validationErrors.endDate ? '#DC2626' : 'var(--border-medium)'}`,
                  fontSize: '0.88rem'
                }}
              />
              {validationErrors.endDate && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.endDate}</p>}
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
          <div className="dashboard-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
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
