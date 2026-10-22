import React from 'react';

interface SkeletonBlockProps {
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ className = '', style }) => (
  <div
    aria-hidden="true"
    className={`loading-skeleton ${className}`.trim()}
    style={style}
  />
);

export const ProductCardSkeleton: React.FC = () => (
  <article className="product-card glass-card product-card-skeleton" aria-hidden="true">
    <div className="product-card-image">
      <SkeletonBlock className="product-card-image-skeleton" />
    </div>
    <div className="product-card-details">
      <div>
        <div className="product-card-meta">
          <SkeletonBlock style={{ width: '34%', height: 12, borderRadius: 999 }} />
          <SkeletonBlock style={{ width: 56, height: 12, borderRadius: 999 }} />
        </div>
        <SkeletonBlock className="product-card-title-skeleton" style={{ width: '78%' }} />
        <SkeletonBlock className="product-card-material-skeleton" style={{ width: '52%' }} />
      </div>
      <div className="product-card-footer">
        <div className="product-card-price-skeleton">
          <SkeletonBlock style={{ width: 66, height: 20, borderRadius: 6 }} />
          <SkeletonBlock style={{ width: 42, height: 13, borderRadius: 6 }} />
        </div>
        <SkeletonBlock className="product-card-button-skeleton" />
      </div>
    </div>
  </article>
);

export const TestimonialCardSkeleton: React.FC = () => (
  <article className="testimonial-card testimonial-skeleton" aria-hidden="true">
    <SkeletonBlock style={{ width: '38%', height: 16, borderRadius: 999 }} />
    <SkeletonBlock style={{ width: '100%', height: 48, borderRadius: 8 }} />
    <SkeletonBlock style={{ width: '56%', height: 12, marginTop: 'auto', borderRadius: 999 }} />
  </article>
);

export const OrderCardSkeleton: React.FC = () => (
  <article className="user-profile-order-card user-profile-order-card-skeleton" aria-hidden="true">
    <div className="user-profile-order-skeleton-heading">
      <SkeletonBlock style={{ width: '42%', height: 14, borderRadius: 6 }} />
      <SkeletonBlock style={{ width: 72, height: 20, borderRadius: 999 }} />
    </div>
    <SkeletonBlock style={{ width: '58%', height: 12, borderRadius: 6 }} />
    <SkeletonBlock style={{ width: '36%', height: 11, borderRadius: 6 }} />
    <div className="user-profile-order-skeleton-timeline">
      {[0, 1, 2].map(item => (
        <div key={item}>
          <SkeletonBlock style={{ width: 22, height: 22, borderRadius: '50%' }} />
          <SkeletonBlock style={{ width: `${68 - item * 9}%`, height: 12, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  </article>
);
