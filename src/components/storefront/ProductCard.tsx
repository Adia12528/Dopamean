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
    .slice(0, 1);

  return (
    <div className="product-card glass-card">
      {/* Product Image Box */}
      <div
        className="product-card-image"
        onClick={() => setSelectedProductForModal(product)}
      >
        <img
          src={getAssetUrl(product.image)}
          alt={product.title}
          loading="lazy"
          decoding="async"
        />

        {/* Show only the highest-priority qualifying badge configured in Studio. */}
        <div className="product-card-badges">
          {visibleBadges.map(badge => (
            <span key={badge} className={`product-card-badge product-card-badge-${badge}`}>
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
      <div className="product-card-details">
        <div>
          {/* Category & Rating */}
          <div className="product-card-meta">
            <span className="product-card-category">
              {product.category}
            </span>

            <div className="product-card-rating">
              <Star size={13} fill="#F59E0B" color="#F59E0B" />
              <span>{product.rating}</span>
              <span className="product-card-review-count">
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
          <p className="product-card-material">
            <span aria-hidden="true">🧶</span>
            <span>{product.yarnType}</span>
          </p>
        </div>

        {/* Price & Action Row */}
        <div className="product-card-footer">
          <div className="product-card-price">
            <span className="product-card-price-current">
              {settings.currency}{product.price}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="product-card-price-original">
                {settings.currency}{product.originalPrice}
              </span>
            )}
          </div>
          <button
            className="product-card-add-button btn-primary"
            onClick={() => addToCart(product, 1)}
            disabled={isOutOfStock}
          >
            <ShoppingBag size={14} />
            <span>{isOutOfStock ? 'Sold Out' : 'Add to Cart'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
