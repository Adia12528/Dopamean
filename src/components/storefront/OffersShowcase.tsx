import React, { useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { getAssetUrl } from '../../services/api';
import { Tag, Sparkles, Copy, Check, Clock } from 'lucide-react';

export const OffersShowcase: React.FC = () => {
  const { offers, products, applyPromoCode, setSelectedProductForModal, setSelectedOfferForModal } = useStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const activeOffers = offers.filter(o => o.isActive);
  const newLaunchProducts = useMemo(
    () => products
      .filter(product => product.isFeatured === true)
      .sort((left, right) => {
        const leftCreatedAt = Date.parse(left.createdAt);
        const rightCreatedAt = Date.parse(right.createdAt);
        return (Number.isFinite(rightCreatedAt) ? rightCreatedAt : 0) - (Number.isFinite(leftCreatedAt) ? leftCreatedAt : 0);
      })
      .slice(0, 6),
    [products]
  );
  const railItems = [
    ...activeOffers.map(offer => ({ type: 'offer' as const, id: offer.id, offer })),
    ...newLaunchProducts.map(product => ({ type: 'product' as const, id: product.id, product }))
  ];

  if (railItems.length === 0) return null;

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => undefined);
    applyPromoCode(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(null), 2500);
  };

  const marqueeItems = [...activeOffers, ...activeOffers];
  const renderRailItem = (item: (typeof railItems)[number], duplicate = false) => (
    <button
      key={`${item.type}-${item.id}-${duplicate ? 'copy' : 'main'}`}
      type="button"
      className="launch-rail-item"
      tabIndex={duplicate ? -1 : undefined}
      aria-hidden={duplicate || undefined}
      onClick={() => item.type === 'offer'
        ? setSelectedOfferForModal(item.offer)
        : setSelectedProductForModal(item.product)}
      aria-label={item.type === 'offer' ? `View offer ${item.offer.title}` : `Quick view ${item.product.title}`}
    >
      <img
        src={getAssetUrl(item.type === 'offer' ? item.offer.image : item.product.image)}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span className="launch-rail-copy">
        <span className="launch-rail-kind">
          {item.type === 'offer' ? <><Tag size={12} /> Offer</> : <><Sparkles size={12} /> New in studio</>}
        </span>
        <strong>{item.type === 'offer' ? item.offer.title : item.product.title}</strong>
      </span>
      <span className="launch-rail-value">
        {item.type === 'offer'
          ? item.offer.discountType === 'percentage' ? `${item.offer.discountValue}% off` : `${item.offer.discountValue} off`
          : 'Quick view'}
      </span>
    </button>
  );

  return (
    <section className="offers-showcase-section">
      <div className="container">
        <div
          className={`launch-rail ${isPaused ? 'is-paused' : ''}`}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
          onTouchCancel={() => setIsPaused(false)}
        >
          <span className="launch-rail-heading"><Sparkles size={14} /> New launches &amp; offers</span>
          <div className="launch-rail-window">
            <div className="launch-rail-track" aria-label="New product launches and active offers">
              <div className="launch-rail-group">{railItems.map(item => renderRailItem(item))}</div>
              <div className="launch-rail-group" aria-hidden="true">{railItems.map(item => renderRailItem(item, true))}</div>
            </div>
          </div>
        </div>

        {activeOffers.length > 0 && (
          <>
            <div className="offers-showcase-heading">
              <div>
                <div className="offers-showcase-eyebrow"><Sparkles size={14} /> Limited Studio Specials</div>
                <h2>Current Offers &amp; Bundle Vouchers</h2>
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
                      <span className="offer-marquee-badge"><Tag size={12} />{offer.badge}</span>
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
          </>
        )}
      </div>
    </section>
  );
};
