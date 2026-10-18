import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Sparkles, Copy, Check, ArrowRight, Tag, Heart } from 'lucide-react';

export const HeroBanner: React.FC = () => {
  const { offers, applyPromoCode, setSelectedCategory, settings } = useStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const activeOffers = offers.filter(o => o.isActive);
  const featuredOffer = activeOffers[0];

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    applyPromoCode(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <section style={{
      padding: '30px 0 20px',
      position: 'relative'
    }}>
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
              {settings.heroSubtitle || 'Hand-crocheted stitch-by-stitch with ultra-soft organic combed milk cotton and fine merino yarns.'}
            </p>

            {/* Active Live Offer Spotlight if available */}
            {featuredOffer && (
              <div style={{
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
                  <p style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                  }}>
                    {featuredOffer.description}
                  </p>
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
            minHeight: '260px'
          }}>
            <img
              src={settings.heroImage || '/uploads/media_1791711047623.jpg'}
              alt={settings.storeName || 'Handcrafted Crochet Accessories'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transition: 'transform 0.6s ease'
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginTop: '24px'
        }}>
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
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '16px 20px',
                border: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ fontSize: '1.6rem' }}>{pillar.icon}</div>
              <div>
                <h5 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {pillar.title}
                </h5>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {pillar.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
