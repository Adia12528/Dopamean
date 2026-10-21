import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { getAssetUrl } from '../../services/api';
import { Tag, Sparkles, Copy, Check, Clock } from 'lucide-react';

export const OffersShowcase: React.FC = () => {
  const { offers, applyPromoCode } = useStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const activeOffers = offers.filter(o => o.isActive);

  if (activeOffers.length === 0) return null;

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => undefined);
    applyPromoCode(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(null), 2500);
  };

  const marqueeItems = [...activeOffers, ...activeOffers];

  return (
    <section style={{ padding: '24px 0 36px' }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--accent-terracotta)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <Sparkles size={14} />
              <span>Limited Studio Specials</span>
            </div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>
              Current Offers &amp; Bundle Vouchers
            </h2>
          </div>
        </div>

        <div
          className={`offers-marquee ${isPaused ? 'is-paused' : ''}`}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
          onTouchCancel={() => setIsPaused(false)}
        >
          <div className="offers-marquee-track" aria-label="Featured offers carousel">
            {marqueeItems.map((offer, index) => (
              <button
                key={`${offer.id}-${index}`}
                type="button"
                className="offer-marquee-item"
                onClick={() => handleCopy(offer.code)}
                aria-label={`Apply offer ${offer.title}`}
              >
                <div className="offer-marquee-image-wrap">
                  <img src={getAssetUrl(offer.image)} alt={offer.title} loading="lazy" decoding="async" />
                  <div className="offer-marquee-overlay" />
                  <span className="offer-marquee-badge">
                    <Tag size={12} />
                    {offer.badge}
                  </span>
                  <div className="offer-marquee-discount">
                    {offer.discountType === 'percentage' ? `${offer.discountValue}% OFF` : `₹${offer.discountValue} OFF`}
                  </div>
                </div>

                <div className="offer-marquee-body">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <h3>{offer.title}</h3>
                      <p>{offer.description}</p>
                    </div>
                    <span className="offer-marquee-code-pill">
                      {copiedCode === offer.code ? 'Applied' : `Code: ${offer.code}`}
                    </span>
                  </div>

                  <div className="offer-marquee-meta">
                    <span><Clock size={13} /> Valid until {offer.endDate}</span>
                    <span className="offer-marquee-action">
                      {copiedCode === offer.code ? <Check size={14} /> : <Copy size={13} />}
                      {copiedCode === offer.code ? 'Applied' : 'Use'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
