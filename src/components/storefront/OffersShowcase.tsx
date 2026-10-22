import React, { useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { getAssetUrl } from '../../services/api';
import { Tag, Sparkles, Copy, Check, Clock } from 'lucide-react';
import { StorefrontImage } from '../common/StorefrontImage';
import { SkeletonBlock } from '../common/LoadingSkeleton';

export const OffersShowcase: React.FC = () => {
  const { offers, products, settings, isOffersLoading, applyPromoCode, setSelectedProductForModal, setSelectedOfferForModal } = useStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const activeOffers = offers.filter(o => o.isActive);
  const newLaunchProducts = useMemo(() => {
    const featuredProducts = products.filter(product => product.isFeatured === true);
    const sortedProducts = featuredProducts.sort((left, right) => {
      if (settings.launchRailProductSortOrder === 'bestselling') {
        const bestsellerDifference = Number(Boolean(right.isBestSeller)) - Number(Boolean(left.isBestSeller));
        if (bestsellerDifference !== 0) return bestsellerDifference;
      }
        const leftCreatedAt = Date.parse(left.createdAt);
        const rightCreatedAt = Date.parse(right.createdAt);
        return (Number.isFinite(rightCreatedAt) ? rightCreatedAt : 0) - (Number.isFinite(leftCreatedAt) ? leftCreatedAt : 0);
    });
    const limit = Math.max(1, Math.min(12, Math.floor(Number(settings.launchRailProductsLimit) || 6)));
    return sortedProducts.slice(0, limit);
  }, [products, settings.launchRailProductSortOrder, settings.launchRailProductsLimit]);
  const railItems = [
    ...activeOffers.map(offer => ({ type: 'offer' as const, id: offer.id, offer })),
    ...newLaunchProducts.map(product => ({ type: 'product' as const, id: product.id, product }))
  ];

  const shouldShowLaunchRail = settings.showLaunchRail !== false && railItems.length > 0;
  if (!isOffersLoading && !shouldShowLaunchRail && activeOffers.length === 0) return null;

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => undefined);
    applyPromoCode(code);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(null), 2500);
  };

  const marqueeItems = activeOffers.length > 1 ? [...activeOffers, ...activeOffers] : activeOffers;
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
      <StorefrontImage
        src={getAssetUrl(item.type === 'offer' ? item.offer.image : item.product.image)}
        alt=""
        width={224}
        height={144}
        transformWidth={224}
        transformHeight={144}
        loading="lazy"
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
        {isOffersLoading && (
          <div className="offers-loading-state" role="status" aria-label="Loading offers" aria-busy="true">
            <div className="launch-rail-heading">
              <SkeletonBlock style={{ width: 154, height: 12, borderRadius: 999 }} />
            </div>
            <div className="launch-rail-window">
              <div className="offers-loading-rail">
                {[0, 1, 2].map(item => (
                  <div key={item} className="launch-rail-item" aria-hidden="true">
                    <SkeletonBlock style={{ width: 48, height: 48, flex: '0 0 48px', borderRadius: 10 }} />
                    <div className="launch-rail-copy">
                      <SkeletonBlock style={{ width: '48%', height: 10, borderRadius: 999 }} />
                      <SkeletonBlock style={{ width: '76%', height: 12, borderRadius: 6 }} />
                    </div>
                    <SkeletonBlock style={{ width: 48, height: 10, borderRadius: 999 }} />
                  </div>
                ))}
              </div>
            </div>
            <article className="single-offer-card offers-loading-card" aria-hidden="true">
              <SkeletonBlock className="offers-loading-image" />
              <div className="single-offer-details">
                <SkeletonBlock style={{ width: 132, height: 12, borderRadius: 999 }} />
                <SkeletonBlock style={{ width: '74%', height: 24, borderRadius: 7 }} />
                <SkeletonBlock style={{ width: '90%', height: 14, borderRadius: 6 }} />
                <SkeletonBlock style={{ width: '68%', height: 14, borderRadius: 6 }} />
                <SkeletonBlock style={{ width: '100%', height: 44, borderRadius: 999 }} />
              </div>
            </article>
          </div>
        )}
        {shouldShowLaunchRail && <div
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
        </div>}

        {activeOffers.length > 0 && (
          <>
            <div className="offers-showcase-heading">
              <div>
                <div className="offers-showcase-eyebrow"><Sparkles size={14} /> Limited Studio Specials</div>
                <h2>Current Offers &amp; Bundle Vouchers</h2>
              </div>
            </div>

            {activeOffers.length === 1 ? (
              <article className="single-offer-card">
                <button
                  type="button"
                  className="single-offer-image"
                  onClick={() => setSelectedOfferForModal(activeOffers[0])}
                  aria-label={`View offer ${activeOffers[0].title}`}
                >
                  <StorefrontImage
                    src={getAssetUrl(activeOffers[0].image)}
                    alt=""
                    width={1200}
                    height={675}
                    transformWidth={1200}
                    transformHeight={675}
                    loading="lazy"
                  />
                  <span className="offer-marquee-badge"><Tag size={12} />{activeOffers[0].badge}</span>
                  <span className="single-offer-discount">
                    {activeOffers[0].discountType === 'percentage' ? `${activeOffers[0].discountValue}% OFF` : `₹${activeOffers[0].discountValue} OFF`}
                  </span>
                </button>
                <div className="single-offer-details">
                  <div className="single-offer-copy">
                    <span className="single-offer-kicker"><Sparkles size={14} /> Featured offer</span>
                    <button type="button" className="single-offer-title" onClick={() => setSelectedOfferForModal(activeOffers[0])}>
                      {activeOffers[0].title}
                    </button>
                    <p>{activeOffers[0].description}</p>
                  </div>
                  <div className="single-offer-meta">
                    <span><Clock size={14} /> Valid until {activeOffers[0].endDate}</span>
                    <span className="single-offer-code">Code: <strong>{activeOffers[0].code}</strong></span>
                  </div>
                  <button type="button" className="btn-primary single-offer-apply" onClick={() => handleCopy(activeOffers[0].code)}>
                    {copiedCode === activeOffers[0].code ? <Check size={16} /> : <Copy size={16} />}
                    {copiedCode === activeOffers[0].code ? 'Applied' : 'Copy code and apply'}
                  </button>
                </div>
              </article>
            ) : (
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
                      <StorefrontImage
                        src={getAssetUrl(offer.image)}
                        alt={offer.title}
                        width={720}
                        height={463}
                        transformWidth={720}
                        transformHeight={463}
                        loading="lazy"
                      />
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
              )}
          </>
        )}
      </div>
    </section>
  );
};
