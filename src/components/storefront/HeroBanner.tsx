import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useUser } from '../../context/UserContext';
import { getAssetUrl } from '../../services/api';
import { Sparkles, Copy, Check, ArrowRight, Tag, Heart, Camera, Star, Clock } from 'lucide-react';
import { StorefrontImage } from '../common/StorefrontImage';
import type { Offer } from '../../types';

const parseOfferBoundary = (value: string | undefined, isEnd: boolean): number | null => {
  if (!value?.trim()) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const timestamp = dateOnly
    ? new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
      isEnd ? 23 : 0,
      isEnd ? 59 : 0,
      isEnd ? 59 : 0,
      isEnd ? 999 : 0
    ).getTime()
    : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isOfferActiveNow = (offer: Offer, now: number) => {
  if (!offer.isActive) return false;
  const startsAt = parseOfferBoundary(offer.startDate, false);
  const endsAt = parseOfferBoundary(offer.endDate, true);
  return (startsAt === null || startsAt <= now) && (endsAt === null || now < endsAt);
};

const formatTimeRemaining = (milliseconds: number) => {
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  if (days > 0) return `Ends in ${days}d ${hours}h`;
  if (hours > 0) return `Ends in ${hours}h ${totalMinutes % 60}m`;
  return `Ends in ${Math.max(1, totalMinutes)}m`;
};

export const HeroBanner: React.FC = () => {
  const { offers, products, applyPromoCode, setSelectedCategory, settings } = useStore();
  const { currentUser, isLoadingUser } = useUser();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showInstagramLink, setShowInstagramLink] = useState(false);
  const heroImageFrameRef = useRef<HTMLDivElement>(null);

  const activeOffers = offers.filter(offer => isOfferActiveNow(offer, now));
  const featuredOffer = activeOffers[0];
  const offerEndTimestamp = featuredOffer ? parseOfferBoundary(featuredOffer.endDate, true) : null;
  const timeRemaining = offerEndTimestamp !== null ? offerEndTimestamp - now : null;
  const reviewedProducts = products.filter(product =>
    Number.isFinite(product.rating) &&
    product.rating > 0 &&
    Number.isFinite(product.reviewsCount) &&
    product.reviewsCount > 0
  );
  const totalReviewCount = reviewedProducts.reduce((total, product) => total + product.reviewsCount, 0);
  const aggregateRating = totalReviewCount > 0
    ? reviewedProducts.reduce((total, product) => total + product.rating * product.reviewsCount, 0) / totalReviewCount
    : null;
  const customerName = currentUser?.name.trim();
  const heroSubtitle = settings.showHeroPersonalGreeting !== false && !isLoadingUser && customerName
    ? `Welcome back, ${customerName}!`
    : settings.heroSubtitle || 'Soft, handcrafted crochet accessories made to bring a little joy to every day.';
  const instagramHandle = settings.instagramHandle.replace(/^@/, '').trim();

  useEffect(() => {
    if (offerEndTimestamp === null || offerEndTimestamp <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [offerEndTimestamp]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowInstagramLink(true), 300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const frame = heroImageFrameRef.current;
    if (!frame || settings.enableHeroParallax === false || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4)) return;

    let animationFrame = 0;
    let scrollListening = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateParallax = () => {
      if (reducedMotion.matches) {
        cancelAnimationFrame(animationFrame);
        frame.style.removeProperty('--hero-parallax-offset');
        return;
      }
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        const { top } = frame.getBoundingClientRect();
        const offset = Math.max(-16, Math.min(16, -top * 0.05));
        frame.style.setProperty('--hero-parallax-offset', `${offset}px`);
      });
    };
    const syncParallax = () => {
      const shouldEnable = !reducedMotion.matches && window.innerWidth >= 768;
      if (!shouldEnable) {
        if (scrollListening) window.removeEventListener('scroll', updateParallax);
        scrollListening = false;
        cancelAnimationFrame(animationFrame);
        frame.style.removeProperty('--hero-parallax-offset');
        return;
      }
      if (shouldEnable && !scrollListening) {
        window.addEventListener('scroll', updateParallax, { passive: true });
        scrollListening = true;
        updateParallax();
      }
    };

    syncParallax();
    window.addEventListener('resize', syncParallax);
    reducedMotion.addEventListener('change', syncParallax);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', updateParallax);
      window.removeEventListener('resize', syncParallax);
      reducedMotion.removeEventListener('change', syncParallax);
      frame.style.removeProperty('--hero-parallax-offset');
    };
  }, [settings.enableHeroParallax]);

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    applyPromoCode(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <section className="hero-banner-section">
      <div className="container">
        {/* Main Hero Card */}
        <div className="hero-card" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          backgroundColor: '#FFFFFF',
          borderRadius: 'clamp(20px, 4vw, 28px)',
          overflow: 'hidden',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 20px 40px rgba(35, 28, 22, 0.07)',
          minHeight: '380px'
        }}>
          {/* Left Text & CTA */}
          <div style={{
            padding: 'clamp(28px, 5vw, 52px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              backgroundColor: 'var(--accent-terracotta-light)',
              color: 'var(--accent-terracotta)',
              fontSize: '0.78rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '18px',
              width: 'fit-content',
              border: '1px dashed var(--border-dashed)'
            }}>
              <Sparkles size={14} />
              <span>{settings.heroBadge || settings.storeName || '🌸 100% Handcrafted with Love'}</span>
            </div>

            <h1 style={{
              fontSize: 'clamp(1.9rem, 3.8vw, 3.2rem)',
              lineHeight: 1.15,
              fontWeight: 700,
              color: 'var(--text-main)',
              marginBottom: '16px'
            }}>
              {settings.heroTitle || 'Mindful stitches for everyday dopamine.'}
            </h1>

            <p style={{
              fontSize: '1rem',
              color: 'var(--text-muted)',
              maxWidth: '520px',
              lineHeight: 1.6,
              marginBottom: '28px'
            }}>
              {heroSubtitle}
            </p>

            {settings.showHeroSocialProof !== false && (
              <div className="hero-rating-slot">
                {aggregateRating !== null && totalReviewCount > 0 && (
                <div className="hero-rating-proof" aria-label={`${aggregateRating.toFixed(1)} out of 5 from ${totalReviewCount.toLocaleString()} reviews`}>
                  <Star size={16} fill="currentColor" aria-hidden="true" />
                  <strong>{aggregateRating.toFixed(1)}</strong>
                  <span>from {totalReviewCount.toLocaleString()} reviews</span>
                </div>
                )}
              </div>
            )}

            {/* Active Live Offer Spotlight if available */}
            {settings.showHeroOfferHighlight !== false && featuredOffer && (
              <div className="hero-offer-highlight" style={{
                backgroundColor: 'var(--bg-surface-soft)',
                border: '1.5px dashed var(--accent-terracotta)',
                borderRadius: '16px',
                padding: '16px 20px',
                marginBottom: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: 'var(--accent-terracotta)',
                    textTransform: 'uppercase'
                  }}>
                    <Tag size={13} />
                    <span>{featuredOffer.badge}</span>
                  </div>
                  <h4 style={{
                    fontSize: '0.98rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    marginTop: '2px'
                  }}>
                    {featuredOffer.title}
                  </h4>
                  <p className="hero-offer-discount">
                    {featuredOffer.discountType === 'percentage'
                      ? `${featuredOffer.discountValue}% off`
                      : `${settings.currency}${featuredOffer.discountValue} off`}
                  </p>
                  <p style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                  }}>
                    {featuredOffer.description}
                  </p>
                  {timeRemaining !== null && timeRemaining > 0 && (
                    <span className="hero-offer-countdown">
                      <Clock size={13} />
                      {formatTimeRemaining(timeRemaining)}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => handleCopy(featuredOffer.code)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: '#FFFFFF',
                    border: '1.5px solid var(--accent-terracotta)',
                    color: 'var(--accent-terracotta)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {copiedCode === featuredOffer.code ? (
                    <>
                      <Check size={15} color="#16A34A" />
                      <span style={{ color: '#16A34A' }}>Applied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={15} />
                      <span>{featuredOffer.code}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Quick action buttons */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap'
            }}>
              <a 
                href="#catalog"
                className="btn-primary"
                style={{ textDecoration: 'none' }}
              >
                <span>{settings.heroPrimaryBtnText || 'Shop Handcrafted Collection'}</span>
                <ArrowRight size={16} />
              </a>

              <button
                onClick={() => {
                  const el = document.getElementById('catalog');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else setSelectedCategory('Accessories');
                }}
                className="btn-secondary"
              >
                <span>{settings.heroSecondaryBtnText || 'View Special Combos'}</span>
              </button>
            </div>
          </div>

          {/* Right Visual Image Frame */}
          <div style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #F9EDE6, #EFE3DA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            minHeight: '260px',
            aspectRatio: '4 / 3',
            width: '100%'
          }} ref={heroImageFrameRef} className="hero-image-frame">
            <div className="liquid-static-fallback" aria-hidden="true" />
            <StorefrontImage
              className="hero-parallax-image"
              src={getAssetUrl(settings.heroImage ?? '/uploads/hero_landing.webp')}
              alt={settings.storeName || 'Handcrafted Crochet Accessories'}
              width={1400}
              height={1050}
              transformWidth={1400}
              quality={80}
              loading="eager"
              fetchPriority="high"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'relative',
                zIndex: 1,
                opacity: 0.84,
                mixBlendMode: 'multiply'
              }}
            />
            {/* Floating Editorial Badge */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(10px)',
              padding: '10px 14px',
              borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-terracotta-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-terracotta)'
              }}>
                <Heart size={18} fill="var(--accent-terracotta)" />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  100% Handcrafted
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  No mass factories • Only pure yarn
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Pillars */}
        <div className="hero-trust-grid">
          {[
            { 
              icon: settings.trustBadge1Icon || '🌸', 
              title: settings.trustBadge1Title || '100% Handcrafted', 
              desc: settings.trustBadge1Desc || 'Stitch-by-stitch slowly made by artisan with utmost love & care.' 
            },
            { 
              icon: settings.trustBadge2Icon || '🧶', 
              title: settings.trustBadge2Title || 'Skin & Hair Friendly', 
              desc: settings.trustBadge2Desc || 'Soft milk-cotton yarn that holds firmly without pulling hair.' 
            },
            { 
              icon: settings.trustBadge3Icon || '✨', 
              title: settings.trustBadge3Title || 'Custom Orders & Combos', 
              desc: settings.trustBadge3Desc || 'Pair your favorite colors or order custom gifts for birthdays.' 
            },
            { 
              icon: settings.trustBadge4Icon || '📦', 
              title: settings.trustBadge4Title || 'Fast Pan-India Dispatch', 
              desc: settings.trustBadge4Desc || 'Safely boxed in aesthetic packaging with care instructions.' 
            }
          ].map((pillar, i) => (
            <div 
              key={i}
              className="hero-glass-card hero-trust-card"
            >
              <div className="hero-trust-icon" aria-hidden="true">{pillar.icon}</div>
              <div className="hero-trust-copy">
                <h5 className="hero-trust-title">
                  {pillar.title}
                </h5>
                <p className="hero-trust-description">
                  {pillar.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {settings.showHeroInstagramStrip !== false && (
          <div className="hero-instagram-slot">
            {showInstagramLink && instagramHandle && (
            <a
              className="hero-instagram-strip"
              href={`https://www.instagram.com/${encodeURIComponent(instagramHandle)}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Camera size={18} aria-hidden="true" />
              <span>Follow us on Instagram</span>
              <strong>@{instagramHandle}</strong>
              <ArrowRight size={15} aria-hidden="true" />
            </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
