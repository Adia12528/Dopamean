import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { Tag, Sparkles, Copy, Check, Clock } from 'lucide-react';

export const OffersShowcase: React.FC = () => {
  const { offers, applyPromoCode } = useStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const activeOffers = offers.filter(o => o.isActive);

  if (activeOffers.length === 0) return null;

  const handleCopy = (code: string) => {
    navigator.clipboard?.writeText(code);
    applyPromoCode(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <section style={{
      padding: '24px 0 36px'
    }}>
      <div className="container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
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
            <h2 style={{
              fontSize: '1.65rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              marginTop: '4px'
            }}>
              Current Offers & Bundle Vouchers
            </h2>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '20px'
        }}>
          {activeOffers.map(offer => (
            <div
              key={offer.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                border: '1px solid var(--border-medium)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'var(--transition-smooth)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              {/* Banner Image */}
              <div style={{
                position: 'relative',
                height: '140px',
                overflow: 'hidden'
              }}>
                <img
                  src={offer.image}
                  alt={offer.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.65), transparent)'
                }} />
                
                <span style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  color: 'var(--accent-terracotta)',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Tag size={12} />
                  {offer.badge}
                </span>

                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '14px',
                  right: '14px',
                  color: '#FFFFFF'
                }}>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.01em'
                  }}>
                    {offer.discountType === 'percentage' 
                      ? `${offer.discountValue}% OFF` 
                      : `$${offer.discountValue} OFF`}
                  </div>
                </div>
              </div>

              {/* Offer Info */}
              <div style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                justifyContent: 'space-between'
              }}>
                <div>
                  <h3 style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    marginBottom: '6px'
                  }}>
                    {offer.title}
                  </h3>
                  <p style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.5,
                    marginBottom: '14px'
                  }}>
                    {offer.description}
                  </p>
                </div>

                <div style={{
                  paddingTop: '12px',
                  borderTop: '1px dashed var(--border-medium)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.74rem',
                    color: 'var(--text-subtle)'
                  }}>
                    <Clock size={13} />
                    <span>Valid until {offer.endDate}</span>
                  </div>

                  <button
                    onClick={() => handleCopy(offer.code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--accent-terracotta-light)',
                      border: '1px solid var(--accent-terracotta)',
                      color: 'var(--accent-terracotta)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    {copiedCode === offer.code ? (
                      <>
                        <Check size={14} color="#16A34A" />
                        <span style={{ color: '#16A34A' }}>Applied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Code: {offer.code}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
