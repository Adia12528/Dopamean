import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { getAssetUrl } from '../../services/api';
import { StorefrontImage } from '../common/StorefrontImage';
import { 
  X, 
  Star, 
  ShoppingBag, 
  Clock, 
  Droplets,
  Tag,
  Copy,
  Check
} from 'lucide-react';
import { ReviewsSection } from './ReviewsSection';

export const ProductDetailModal: React.FC = () => {
  const {
    selectedProductForModal,
    setSelectedProductForModal,
    selectedOfferForModal,
    setSelectedOfferForModal,
    applyPromoCode,
    showToast,
    addToCart,
    settings
  } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [appliedOfferCode, setAppliedOfferCode] = useState<string | null>(null);

  if (!selectedProductForModal && !selectedOfferForModal) return null;

  if (!selectedProductForModal && selectedOfferForModal) {
    const offer = selectedOfferForModal;
    const handleApplyOffer = async () => {
      try {
        await navigator.clipboard?.writeText(offer.code);
      } catch {
        // Promo can still be applied if clipboard access is unavailable.
      }
      const result = applyPromoCode(offer.code);
      setAppliedOfferCode(result.success ? offer.code : null);
      showToast(result.message, result.success ? 'success' : 'error');
    };

    return (
      <div
        className="mobile-modal-overlay"
        onClick={() => setSelectedOfferForModal(null)}
        style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(10px, 3vw, 20px)', backgroundColor: 'rgba(35, 28, 22, 0.65)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.25s ease-out', boxSizing: 'border-box' }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Offer details: ${offer.title}`}
          className="mobile-modal-panel"
          onClick={event => event.stopPropagation()}
          style={{ position: 'relative', width: '100%', maxWidth: '620px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '20px', background: '#FFFFFF', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)' }}
        >
          <button type="button" onClick={() => setSelectedOfferForModal(null)} aria-label="Close offer details" style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2, width: '42px', height: '42px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'rgba(255,255,255,0.94)', border: '1px solid var(--border-medium)' }}>
            <X size={20} />
          </button>
          {offer.image && (
            <StorefrontImage
              src={getAssetUrl(offer.image)}
              alt=""
              width={900}
              height={506}
              transformWidth={900}
              transformHeight={506}
              loading="eager"
              style={{ display: 'block', width: '100%', maxHeight: '300px', objectFit: 'cover', background: 'var(--bg-surface-soft)' }}
            />
          )}
          <div style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
            <span className="badge-yarn"><Tag size={13} /> {offer.badge}</span>
            <h2 style={{ marginTop: '14px', fontSize: '1.7rem', lineHeight: 1.2, color: 'var(--text-main)' }}>{offer.title}</h2>
            <p style={{ marginTop: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{offer.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '20px', padding: '16px', borderRadius: '12px', background: 'var(--bg-surface-soft)' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Promo code</div>
                <strong style={{ fontSize: '1.15rem', color: 'var(--accent-terracotta)' }}>{offer.code}</strong>
              </div>
              <strong>{offer.discountType === 'percentage' ? `${offer.discountValue}% off` : `${settings.currency}${offer.discountValue} off`}</strong>
            </div>
            {(offer.minOrderValue || offer.endDate) && (
              <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {offer.minOrderValue ? `Minimum order: ${settings.currency}${offer.minOrderValue}` : ''}
                {offer.minOrderValue && offer.endDate ? ' · ' : ''}
                {offer.endDate ? `Valid until ${offer.endDate}` : ''}
              </p>
            )}
            <button type="button" className="btn-primary" onClick={() => void handleApplyOffer()} style={{ width: '100%', minHeight: '48px', marginTop: '22px' }}>
              {appliedOfferCode === offer.code ? <Check size={17} /> : <Copy size={17} />}
              {appliedOfferCode === offer.code ? 'Offer applied' : 'Copy code and apply'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProductForModal) return null;

  const product = selectedProductForModal;
  const allImages = [product.image, ...(product.secondaryImages || [])];
  const discountPercent = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleAdd = () => {
    addToCart(product, quantity);
    setSelectedProductForModal(null);
  };

  const maxAllowed = Math.min(
    product.stock,
    product.maxOrderQuantity ?? product.stock
  );

  return (
    <div
      className="mobile-modal-overlay"
      onClick={() => setSelectedProductForModal(null)}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(35, 28, 22, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(10px, 3vw, 20px)',
        animation: 'fadeIn 0.25s ease-out',
        boxSizing: 'border-box'
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Quick view ${product.title}`}
        className="mobile-modal-panel product-modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 'clamp(18px, 4vw, 26px)',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-medium)',
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          boxSizing: 'border-box'
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => setSelectedProductForModal(null)}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            zIndex: 10,
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-main)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        {/* Left: Gallery */}
        <div className="product-modal-gallery" style={{
          padding: '24px',
          backgroundColor: '#FAF6F1',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div className="product-modal-image" style={{
            width: '100%',
            height: '380px',
            borderRadius: '18px',
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-light)'
          }}>
            <StorefrontImage
              src={getAssetUrl(allImages[activeImageIndex] || product.image)}
              alt={product.title}
              width={1200}
              height={1200}
              transformWidth={1200}
              transformHeight={1200}
              loading="eager"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div style={{
              display: 'flex',
              gap: '10px'
            }}>
              {allImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--bg-surface-soft)',
                    cursor: 'pointer',
                    border: activeImageIndex === idx 
                      ? '2.5px solid var(--accent-terracotta)' 
                      : '1px solid var(--border-medium)',
                    opacity: activeImageIndex === idx ? 1 : 0.7,
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  <StorefrontImage
                    src={getAssetUrl(img)}
                    alt=""
                    width={68}
                    height={68}
                    transformWidth={136}
                    transformHeight={136}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Maker note */}
          <div style={{
            marginTop: 'auto',
            padding: '14px 16px',
            borderRadius: '14px',
            backgroundColor: '#FFFFFF',
            border: '1px dashed var(--border-dashed)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '1.4rem' }}>🌸</span>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <strong>Made-to-Order Handcrafting:</strong> Carefully woven in our natural light studio, steamed and blocked before packaging.
            </div>
          </div>
        </div>

        {/* Right: Info & Actions */}
        <div style={{
          padding: 'clamp(20px, 4vw, 36px) clamp(16px, 4vw, 32px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}>
              <span className="badge-yarn">
                {product.category}
              </span>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-main)'
              }}>
                <Star size={15} fill="#F59E0B" color="#F59E0B" />
                <span>{product.rating}</span>
                <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>
                  ({product.reviewsCount} artisan reviews)
                </span>
              </div>
            </div>

            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              lineHeight: 1.25,
              color: 'var(--text-main)',
              marginBottom: '8px'
            }}>
              {product.title}
            </h2>

            {product.tagline && (
              <p style={{
                fontSize: '0.9rem',
                color: 'var(--accent-terracotta)',
                fontWeight: 600,
                marginBottom: '16px'
              }}>
                {product.tagline}
              </p>
            )}

            {/* Price section */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '12px',
              padding: '12px 0',
              borderBottom: '1px solid var(--border-light)',
              marginBottom: '18px'
            }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.9rem',
                fontWeight: 800,
                color: 'var(--accent-terracotta)'
              }}>
                {settings.currency}{product.price}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span style={{
                  fontSize: '1.1rem',
                  color: 'var(--text-subtle)',
                  textDecoration: 'line-through'
                }}>
                  {settings.currency}{product.originalPrice}
                </span>
              )}
              {discountPercent > 0 && (
                <span style={{
                  backgroundColor: 'var(--accent-rose-light)',
                  color: 'var(--accent-rose)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '999px'
                }}>
                  Save {discountPercent}%
                </span>
              )}
            </div>

            {/* Description */}
            <p style={{
              fontSize: '0.88rem',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
              marginBottom: '20px'
            }}>
              {product.description}
            </p>

            {/* Specifications Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <div style={{
                backgroundColor: 'var(--bg-surface-soft)',
                padding: '12px 14px',
                borderRadius: '12px'
              }}>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--text-subtle)',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span>🧶 Yarn Material</span>
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                  {product.yarnType}
                </div>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-surface-soft)',
                padding: '12px 14px',
                borderRadius: '12px'
              }}>
                <div style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--text-subtle)',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <Clock size={12} />
                  <span>Stitching Time</span>
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                  Approx {product.craftTimeHours} hours
                </div>
              </div>
            </div>

            {/* Care instructions */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: 'var(--accent-sage-light)',
              color: 'var(--accent-sage)',
              fontSize: '0.8rem',
              marginBottom: '24px'
            }}>
              <Droplets size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Care: </strong>{product.careInstructions}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {/* Quantity selector */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1.5px solid var(--border-medium)',
                  borderRadius: 'var(--radius-full)',
                  padding: '4px'
                }}>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-surface-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700
                    }}
                  >
                    -
                  </button>
                  <span style={{
                    padding: '0 16px',
                    fontWeight: 700,
                    fontSize: '0.95rem'
                  }}>
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(maxAllowed, quantity + 1))}
                    disabled={quantity >= maxAllowed}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: quantity >= maxAllowed ? '#F3EFEA' : 'var(--bg-surface-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      opacity: quantity >= maxAllowed ? 0.45 : 1,
                      cursor: quantity >= maxAllowed ? 'not-allowed' : 'pointer'
                    }}
                  >
                    +
                  </button>
                </div>
                {product.maxOrderQuantity && (
                  <span style={{
                    fontSize: '0.72rem',
                    color: 'var(--accent-terracotta)',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}>
                    🚦 Max {product.maxOrderQuantity} per order
                  </span>
                )}
              </div>

              {/* Add to Cart button */}
              <button
                onClick={handleAdd}
                className="btn-primary"
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  fontSize: '0.96rem'
                }}
              >
                <ShoppingBag size={18} />
                <span>Add {quantity} to Bag • {settings.currency}{(product.price * quantity).toFixed(2)}</span>
              </button>
            </div>

            {/* Customer Reviews & Star Ratings Section */}
            <ReviewsSection productId={product.id} productTitle={product.title} />
          </div>
        </div>
      </div>
    </div>
  );
};
