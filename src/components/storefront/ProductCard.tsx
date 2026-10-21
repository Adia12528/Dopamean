import React from 'react';
import type { Product, ProductCardBadge } from '../../types';
import { useStore } from '../../context/StoreContext';
import { getAssetUrl } from '../../services/api';
import { Star, ShoppingBag, Eye, Clock } from 'lucide-react';
import { normalizeProductCardBadgePriority } from '../../lib/productCardBadgePriority';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, setSelectedProductForModal, settings } = useStore();

  const discountPercent = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const isLowStock = product.stock > 0 && product.stock <= (settings.lowStockThreshold ?? 5);
  const isOutOfStock = product.stock === 0;
  const badgeContent: Record<ProductCardBadge, string | null> = {
    bestseller: product.isBestSeller ? '★ Bestseller' : null,
    discount: discountPercent > 0 ? `-${discountPercent}% OFF` : null,
    lowStock: isLowStock ? `Only ${product.stock} left in stock!` : null,
    craftTime: `${product.craftTimeHours}h hand-stitched`
  };
  const visibleBadges = normalizeProductCardBadgePriority(settings.productCardBadgePriority)
    .filter(badge => badgeContent[badge] !== null)
    .slice(0, 2);

  return (
    <div
      className="product-card"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '22px',
        border: '1px solid var(--border-medium)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'var(--transition-smooth)',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
        e.currentTarget.style.borderColor = 'rgba(200, 90, 50, 0.25)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.borderColor = 'var(--border-medium)';
      }}
    >
      {/* Product Image Box */}
      <div
        onClick={() => setSelectedProductForModal(product)}
        style={{
          position: 'relative',
          paddingTop: '90%', // aspect ratio
          backgroundColor: '#F7F2EC',
          cursor: 'pointer',
          overflow: 'hidden'
        }}
      >
        <img
          src={getAssetUrl(product.image)}
          alt={product.title}
          loading="lazy"
          decoding="async"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.5s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        />

        {/* At most two badges are shown, following Studio-configured priority. */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 2
        }}>
          {visibleBadges.map(badge => (
            <span
              key={badge}
              style={{
                background: badge === 'bestseller'
                  ? 'var(--accent-terracotta)'
                  : badge === 'discount'
                    ? 'var(--accent-rose)'
                    : badge === 'lowStock'
                      ? '#FEF3C7'
                      : 'rgba(255, 255, 255, 0.94)',
                color: badge === 'lowStock'
                  ? '#B91C1C'
                  : badge === 'craftTime'
                    ? 'var(--text-muted)'
                    : '#FFFFFF',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '4px 9px',
                borderRadius: '999px',
                textTransform: badge === 'bestseller' ? 'uppercase' : 'none',
                letterSpacing: badge === 'bestseller' ? '0.04em' : 'normal',
                boxShadow: 'var(--shadow-sm)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                width: 'fit-content'
              }}
            >
              {badge === 'craftTime' && <Clock size={12} color="var(--accent-terracotta)" />}
              {badgeContent[badge]}
            </span>
          ))}
        </div>

        {/* Quick View Button on Hover */}
        <button
          type="button"
          className="product-card-quick-view"
          aria-label={`Quick view ${product.title}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedProductForModal(product);
          }}
          title="Quick View"
        >
          <Eye size={15} />
          <span>Quick View</span>
        </button>
      </div>

      {/* Product Content Details */}
      <div className="product-card-details" style={{
        padding: '18px 20px 20px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        justifyContent: 'space-between'
      }}>
        <div>
          {/* Category & Rating */}
          <div className="product-card-meta" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px'
          }}>
            <span className="product-card-category" style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--accent-sage)',
              letterSpacing: '0.04em'
            }}>
              {product.category}
            </span>

            <div className="product-card-rating" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.76rem',
              fontWeight: 700,
              color: 'var(--text-main)'
            }}>
              <Star size={13} fill="#F59E0B" color="#F59E0B" />
              <span>{product.rating}</span>
              <span style={{ color: 'var(--text-subtle)', fontWeight: 400 }}>
                ({product.reviewsCount})
              </span>
            </div>
          </div>

          {/* Product Title */}
          <h3 
            className="product-card-title"
            onClick={() => setSelectedProductForModal(product)}
          >
            {product.title}
          </h3>

          {/* Yarn Material note */}
          <p style={{
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ color: 'var(--accent-terracotta)' }}>🧶</span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {product.yarnType}
            </span>
          </p>
        </div>

        {/* Price & Action Row */}
        <div className="product-card-footer">
          <div className="product-card-price">
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'var(--accent-terracotta)'
            }}>
              {settings.currency}{product.price}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span style={{
                fontSize: '0.85rem',
                color: 'var(--text-subtle)',
                textDecoration: 'line-through'
              }}>
                {settings.currency}{product.originalPrice}
              </span>
            )}
          </div>
          <button
            className="product-card-add-button"
            onClick={() => addToCart(product, 1)}
            disabled={isOutOfStock}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: isOutOfStock ? '#E2E8F0' : 'var(--accent-terracotta)',
              color: isOutOfStock ? '#94A3B8' : '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.82rem',
              boxShadow: isOutOfStock ? 'none' : '0 3px 10px rgba(200, 90, 50, 0.25)',
              transition: 'var(--transition-smooth)',
              cursor: isOutOfStock ? 'not-allowed' : 'pointer'
            }}
            onMouseEnter={(e) => {
              if (!isOutOfStock) {
                e.currentTarget.style.backgroundColor = 'var(--accent-terracotta-hover)';
                e.currentTarget.style.transform = 'scale(1.03)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isOutOfStock) {
                e.currentTarget.style.backgroundColor = 'var(--accent-terracotta)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            <ShoppingBag size={14} />
            <span>{isOutOfStock ? 'Sold Out' : 'Add to Cart'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
