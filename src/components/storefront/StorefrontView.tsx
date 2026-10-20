import React, { useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { getAssetUrl } from '../../services/api';
import { HeroBanner } from './HeroBanner';
import { OffersShowcase } from './OffersShowcase';
import { TestimonialsSection } from './TestimonialsSection';
import { PendingPaymentRecoveryBanner } from './PendingPaymentRecoveryBanner';
import { CategoryFilter } from './CategoryFilter';
import { ProductCard } from './ProductCard';
import { Sparkles } from 'lucide-react';
import { findClosestProducts, findExactProductMatches } from '../../lib/productSearch';

export const StorefrontView: React.FC = () => {
  const { products, selectedCategory, searchQuery, setSearchQuery, setViewMode, setDashboardTab, settings, loadSampleTemplate, isAdmin, isLoading } = useStore();

  const exactProducts = useMemo(() => {
    const categoryProducts = selectedCategory === 'All'
      ? products
      : products.filter(product => product.category === selectedCategory);
    return findExactProductMatches(categoryProducts, searchQuery);
  }, [products, selectedCategory, searchQuery]);
  const closeMatchProducts = useMemo(
    () => searchQuery.trim() && exactProducts.length === 0
      ? findClosestProducts(products, searchQuery)
      : [],
    [products, searchQuery, exactProducts.length]
  );
  const filteredProducts = exactProducts.length > 0 ? exactProducts : closeMatchProducts;
  const isShowingCloseMatches = searchQuery.trim().length > 0 && exactProducts.length === 0 && closeMatchProducts.length > 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero Section */}
      <HeroBanner />

      <PendingPaymentRecoveryBanner />

      {/* Offers Showcase Section */}
      <OffersShowcase />

      {/* Optional, real customer reviews */}
      <TestimonialsSection />

      {/* Main Catalog Section */}
      <section id="catalog" style={{ padding: '30px 0 60px' }}>
        <div className="container">
          {/* Header Row */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--accent-sage)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <Sparkles size={14} />
                <span>The {settings.storeName} Collection</span>
              </div>
              <h2 style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginTop: '4px'
              }}>
                {isShowingCloseMatches
                  ? `Closest matches for “${searchQuery.trim()}”`
                  : selectedCategory === 'All' ? 'All Handcrafted Accessories' : selectedCategory}
              </h2>
            </div>

            <div style={{
              fontSize: '0.86rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span>
                {isShowingCloseMatches ? 'Showing similar products' : 'Showing'}{' '}
                <strong>{filteredProducts.length}</strong> creations
                {isShowingCloseMatches && selectedCategory !== 'All' ? ' across all collections' : ''}
              </span>
              {searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ color: 'var(--accent-terracotta)', fontWeight: 700, background: 'none', border: 0, cursor: 'pointer' }}
                >
                  Clear search
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    setViewMode('dashboard');
                    setDashboardTab('products');
                  }}
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--accent-terracotta)',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}
                >
                  + Add item (Admin)
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          {isLoading ? (
            <div aria-hidden="true" style={{ display: 'flex', gap: '8px', overflow: 'hidden', paddingBottom: '8px', marginBottom: '28px' }}>
              {[72, 104, 88, 96].map((width, index) => (
                <div key={index} className="catalog-skeleton" style={{ width, height: '36px', borderRadius: '999px', flexShrink: 0 }} />
              ))}
            </div>
          ) : (
            <CategoryFilter />
          )}

          {/* Product Grid */}
          {isLoading ? (
            <div
              role="status"
              aria-label="Loading products"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
                gap: 'clamp(14px, 3vw, 24px)'
              }}
            >
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  aria-hidden="true"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '22px',
                    border: '1px solid var(--border-medium)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div className="catalog-skeleton" style={{ aspectRatio: '1 / 0.9' }} />
                  <div style={{ padding: '16px', display: 'grid', gap: '10px' }}>
                    <div className="catalog-skeleton" style={{ width: '72%', height: '18px', borderRadius: '6px' }} />
                    <div className="catalog-skeleton" style={{ width: '46%', height: '14px', borderRadius: '6px' }} />
                    <div className="catalog-skeleton" style={{ width: '58%', height: '20px', borderRadius: '6px', marginTop: '4px' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              border: '1px dashed var(--border-medium)',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              <span style={{ fontSize: '3rem' }}>🧶</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '12px', color: 'var(--text-main)' }}>
                {products.length === 0 
                  ? (isAdmin ? 'Your Catalog is Ready!' : 'New Creations Coming Soon!') 
                  : searchQuery.trim() ? 'No close matches found' : 'No matches found'}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: '20px' }}>
                {products.length === 0
                  ? (isAdmin 
                      ? 'Add your latest handmade creations and photos in the Studio Dashboard.' 
                      : 'Our studio artisans are currently hand-stitching new pieces. Check back soon or browse other categories!')
                  : searchQuery.trim()
                    ? 'Try a shorter or different product name, or clear your search to browse the full collection.'
                    : 'Try adjusting your search terms or selecting another category.'}
              </p>
              {searchQuery.trim() && (
                <button type="button" onClick={() => setSearchQuery('')} className="btn-secondary">
                  Clear search and browse all products
                </button>
              )}
              
              {products.length === 0 && isAdmin && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      setViewMode('dashboard');
                      setDashboardTab('products');
                    }}
                    className="btn-primary"
                  >
                    <span>+ Add Product in Dashboard</span>
                  </button>

                  <button
                    onClick={loadSampleTemplate}
                    className="btn-secondary"
                  >
                    <span>Load Starter Sample Items</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: 'clamp(14px, 3vw, 24px)'
            }}>
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Craftsmanship & Maker Ethos Section (Customizable by Super Admin) */}
      {settings.showAboutSection !== false && (
        <section style={{
          backgroundColor: '#FFFFFF',
          padding: '60px 0',
          borderTop: '1px solid var(--border-medium)',
          borderBottom: '1px solid var(--border-medium)'
        }}>
          <div className="container">
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
              gap: '40px',
              alignItems: 'center'
            }}>
              <div>
                <span className="badge-yarn" style={{ marginBottom: '14px' }}>
                  {settings.aboutBadge || 'Our Story & Maker Ethos'}
                </span>
                <h2 style={{
                  fontSize: '2.2rem',
                  lineHeight: 1.2,
                  color: 'var(--text-main)',
                  marginBottom: '16px'
                }}>
                  {settings.aboutTitle || 'Why choose handmade crochet over factory machines?'}
                </h2>
                <p style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                  marginBottom: '16px'
                }}>
                  {settings.aboutStory1 || 'Unlike knitting, which can be duplicated by commercial industrial machinery, true crochet cannot be replicated by any machine in existence. Every single loop, granny square stitch, and delicate petal is personally crocheted by real artisan hands.'}
                </p>
                <p style={{
                  fontSize: '0.95rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                  marginBottom: '20px'
                }}>
                  {settings.aboutStory2 || `When you wear ${settings.storeName || 'our handcrafted pieces'}, you are wearing hours of mindful intention, durable natural fibers, and timeless personal style.`}
                </p>

                {settings.aboutQuote && (
                  <div style={{
                    backgroundColor: 'var(--accent-terracotta-light)',
                    borderLeft: '4px solid var(--accent-terracotta)',
                    padding: '14px 18px',
                    borderRadius: '0 12px 12px 0',
                    fontStyle: 'italic',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    lineHeight: 1.5
                  }}>
                    "{settings.aboutQuote}"
                  </div>
                )}
              </div>

              {/* Right Side: Artisan Photo & Highlights */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {settings.aboutImage && (
                  <div style={{
                    borderRadius: '24px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-medium)',
                    boxShadow: 'var(--shadow-md)',
                    maxHeight: '320px',
                    position: 'relative'
                  }}>
                    <img
                      src={getAssetUrl(settings.aboutImage)}
                      alt={settings.aboutTitle || 'Artisan Workshop'}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '16px',
                      left: '16px',
                      backgroundColor: 'rgba(255, 255, 255, 0.94)',
                      backdropFilter: 'blur(8px)',
                      padding: '8px 14px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--accent-terracotta)',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      ✨ Handcrafted with Slow Intention
                    </div>
                  </div>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px'
                }}>
                  <div style={{
                    backgroundColor: 'var(--bg-surface-soft)',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>
                      {settings.trustBadge1Icon || '🌸'}
                    </div>
                    <h5 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '2px' }}>
                      {settings.trustBadge1Title || '100% Handcrafted'}
                    </h5>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {settings.trustBadge1Desc || 'Stitch by stitch with love'}
                    </p>
                  </div>

                  <div style={{
                    backgroundColor: 'var(--bg-surface-soft)',
                    padding: '16px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ fontSize: '1.6rem', marginBottom: '4px' }}>
                      {settings.trustBadge2Icon || '🧶'}
                    </div>
                    <h5 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '2px' }}>
                      {settings.trustBadge2Title || 'Soft Natural Yarns'}
                    </h5>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {settings.trustBadge2Desc || 'Ultra gentle on hair'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
