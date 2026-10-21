import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { getAssetUrl } from '../../services/api';
import { HeroBanner } from './HeroBanner';
import { OffersShowcase } from './OffersShowcase';
import { TestimonialsSection } from './TestimonialsSection';
import { PendingPaymentRecoveryBanner } from './PendingPaymentRecoveryBanner';
import { DirectUpiRecoveryBanner } from './DirectUpiRecoveryBanner';
import { CategoryFilter } from './CategoryFilter';
import { ProductCard } from './ProductCard';
import { ChevronDown, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { findClosestProducts, findExactProductMatches } from '../../lib/productSearch';

type CatalogSort = 'price-ascending' | 'price-descending' | 'newest' | 'bestselling' | 'rating';

const PRODUCTS_PER_PAGE = 12;

export const StorefrontView: React.FC = () => {
  const { products, selectedCategory, setSelectedCategory, searchQuery, setSearchQuery, setViewMode, setDashboardTab, settings, loadSampleTemplate, isAdmin, isLoading } = useStore();
  const [sortOption, setSortOption] = useState<CatalogSort>('bestselling');
  const [minimumPrice, setMinimumPrice] = useState('');
  const [maximumPrice, setMaximumPrice] = useState('');
  const [minimumRating, setMinimumRating] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedYarnType, setSelectedYarnType] = useState('all');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState({ criteriaKey: '', page: 1 });
  const pageCriteria = JSON.stringify([
    selectedCategory,
    searchQuery,
    minimumPrice,
    maximumPrice,
    minimumRating,
    inStockOnly,
    selectedYarnType,
    sortOption
  ]);

  const exactProducts = useMemo(() => {
    const categoryProducts = selectedCategory === 'All'
      ? products
      : products.filter(product => product.category === selectedCategory);
    if (!searchQuery.trim()) return categoryProducts;
    return findExactProductMatches(categoryProducts, searchQuery);
  }, [products, selectedCategory, searchQuery]);
  const closeMatchProducts = useMemo(
    () => searchQuery.trim() && exactProducts.length === 0
      ? findClosestProducts(products, searchQuery)
      : [],
    [products, searchQuery, exactProducts.length]
  );
  const searchResultProducts = exactProducts.length > 0 ? exactProducts : closeMatchProducts;
  const isShowingCloseMatches = searchQuery.trim().length > 0 && exactProducts.length === 0 && closeMatchProducts.length > 0;
  const yarnTypes = useMemo(
    () => Array.from(new Set(products.map(product => product.yarnType.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [products]
  );
  const featuredCategories = useMemo(
    () => Array.from(new Set(products.map(product => product.category).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right))
      .map(category => ({
        name: category,
        items: products
          .filter(product => product.category === category)
          .sort((left, right) => Number(Boolean(right.isBestSeller)) - Number(Boolean(left.isBestSeller)) || right.rating - left.rating || right.reviewsCount - left.reviewsCount)
          .slice(0, 4)
      }))
      .filter(group => group.items.length > 0),
    [products]
  );
  const minimumPriceValue = minimumPrice === '' ? null : Number(minimumPrice);
  const maximumPriceValue = maximumPrice === '' ? null : Number(maximumPrice);
  const filteredProducts = useMemo(() => {
    const matches = searchResultProducts.filter(product =>
      (minimumPriceValue === null || !Number.isFinite(minimumPriceValue) || product.price >= minimumPriceValue) &&
      (maximumPriceValue === null || !Number.isFinite(maximumPriceValue) || product.price <= maximumPriceValue) &&
      product.rating >= minimumRating &&
      (!inStockOnly || product.stock > 0) &&
      (selectedYarnType === 'all' || product.yarnType === selectedYarnType)
    );

    return matches.sort((left, right) => {
      if (sortOption === 'price-ascending') return left.price - right.price;
      if (sortOption === 'price-descending') return right.price - left.price;
      if (sortOption === 'newest') {
        const leftDate = Date.parse(left.createdAt);
        const rightDate = Date.parse(right.createdAt);
        return (Number.isFinite(rightDate) ? rightDate : 0) - (Number.isFinite(leftDate) ? leftDate : 0);
      }
      if (sortOption === 'rating') return right.rating - left.rating || right.reviewsCount - left.reviewsCount;
      return Number(Boolean(right.isBestSeller)) - Number(Boolean(left.isBestSeller)) ||
        right.reviewsCount - left.reviewsCount ||
        right.rating - left.rating;
    });
  }, [searchResultProducts, minimumPriceValue, maximumPriceValue, minimumRating, inStockOnly, selectedYarnType, sortOption]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const visiblePage = Math.min(pagination.criteriaKey === pageCriteria ? pagination.page : 1, pageCount);
  const visibleProducts = filteredProducts.slice((visiblePage - 1) * PRODUCTS_PER_PAGE, visiblePage * PRODUCTS_PER_PAGE);
  const hasActiveFilters = selectedCategory !== 'All' ||
    Boolean(searchQuery.trim()) ||
    minimumPrice !== '' ||
    maximumPrice !== '' ||
    minimumRating > 0 ||
    inStockOnly ||
    selectedYarnType !== 'all';
  const activeFilterCount = [
    selectedCategory !== 'All',
    Boolean(searchQuery.trim()),
    minimumPrice !== '',
    maximumPrice !== '',
    minimumRating > 0,
    inStockOnly,
    selectedYarnType !== 'all'
  ].filter(Boolean).length;

  useEffect(() => {
    if (!isFilterPanelOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !filterPanelRef.current?.contains(event.target)) {
        setIsFilterPanelOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFilterPanelOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isFilterPanelOpen]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setMinimumPrice('');
    setMaximumPrice('');
    setMinimumRating(0);
    setInStockOnly(false);
    setSelectedYarnType('all');
    setSortOption('bestselling');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero Section */}
      <HeroBanner />

      <PendingPaymentRecoveryBanner />
      <DirectUpiRecoveryBanner />

      {/* Offers Showcase Section */}
      <OffersShowcase />

      {featuredCategories.length > 0 && (
        <section className="featured-category-section" style={{ padding: '12px 0 20px' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '22px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent-sage)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Sparkles size={14} />
                  <span>Shop by Category</span>
                </div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>Curated collections for every style</h2>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSelectedCategory('All');
                  const catalogSection = document.getElementById('catalog');
                  if (catalogSection) catalogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                View full collection
              </button>
            </div>

            <div className="featured-category-grid">
              {featuredCategories.map(category => (
                <div key={category.name} className="featured-category-card">
                  <div className="featured-category-header">
                    <div>
                      <span className="featured-category-kicker">Collection</span>
                      <h3>{category.name}</h3>
                    </div>
                    <button
                      type="button"
                      className="featured-category-link"
                      onClick={() => {
                        setSelectedCategory(category.name);
                        const catalogSection = document.getElementById('catalog');
                        if (catalogSection) catalogSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      Browse
                    </button>
                  </div>

                  <div className="featured-category-items">
                    {category.items.map(product => (
                      <div key={product.id} className="featured-category-item">
                        <ProductCard product={product} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
                {isLoading ? 'Loading creations…' : (
                  <>
                    {isShowingCloseMatches ? 'Similar products: ' : 'Showing '}
                    <strong>{visibleProducts.length}</strong> of <strong>{filteredProducts.length}</strong> creations
                  </>
                )}
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

          <div className="catalog-controls-row">
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

            {!isLoading && (
              <div className="catalog-filter-menu" ref={filterPanelRef}>
                <button
                  type="button"
                  className="catalog-filter-trigger"
                  aria-expanded={isFilterPanelOpen}
                  aria-controls="catalog-filter-panel"
                  onClick={() => setIsFilterPanelOpen(open => !open)}
                >
                  <SlidersHorizontal size={17} />
                  <span>Filters &amp; Sort</span>
                  {activeFilterCount > 0 && (
                    <span className="catalog-filter-count" aria-label={`${activeFilterCount} active filters`}>
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown size={16} className={isFilterPanelOpen ? 'catalog-filter-chevron is-open' : 'catalog-filter-chevron'} />
                </button>

                {isFilterPanelOpen && (
                  <div id="catalog-filter-panel" className="catalog-filter-panel" role="region" aria-label="Filter and sort products">
                    <div className="catalog-filter-panel-header">
                      <div>
                        <h3>Filter &amp; Sort</h3>
                        <p>Refine the collection to find your favorite piece.</p>
                      </div>
                      <button
                        type="button"
                        className="catalog-filter-close"
                        aria-label="Close filters"
                        onClick={() => setIsFilterPanelOpen(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="catalog-filter-options">
                <label className="catalog-filter-control">
                  <span>Sort by</span>
                  <select
                    value={sortOption}
                    onChange={event => setSortOption(event.target.value as CatalogSort)}
                    className="catalog-select"
                  >
                    <option value="price-ascending">Price: Low to High</option>
                    <option value="price-descending">Price: High to Low</option>
                    <option value="newest">Newest</option>
                    <option value="bestselling">Bestselling</option>
                    <option value="rating">Rating</option>
                  </select>
                </label>

                <fieldset className="catalog-filter-control catalog-price-filter">
                  <legend>Price range</legend>
                  <div className="catalog-price-inputs">
                    <label>
                      <span className="catalog-visually-hidden">Minimum price</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="Min"
                        aria-label="Minimum price"
                        value={minimumPrice}
                        onChange={event => setMinimumPrice(event.target.value)}
                        className="catalog-input"
                      />
                    </label>
                    <span aria-hidden="true">–</span>
                    <label>
                      <span className="catalog-visually-hidden">Maximum price</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        placeholder="Max"
                        aria-label="Maximum price"
                        value={maximumPrice}
                        onChange={event => setMaximumPrice(event.target.value)}
                        className="catalog-input"
                      />
                    </label>
                  </div>
                </fieldset>

                <label className="catalog-filter-control">
                  <span>Rating</span>
                  <select
                    value={minimumRating}
                    onChange={event => setMinimumRating(Number(event.target.value))}
                    className="catalog-select"
                  >
                    <option value={0}>Any rating</option>
                    <option value={3}>3+ stars</option>
                    <option value={4}>4+ stars</option>
                    <option value={4.5}>4.5+ stars</option>
                  </select>
                </label>

                {yarnTypes.length > 0 && (
                  <label className="catalog-filter-control">
                    <span>Material</span>
                    <select
                      value={selectedYarnType}
                      onChange={event => setSelectedYarnType(event.target.value)}
                      className="catalog-select"
                    >
                      <option value="all">All materials</option>
                      {yarnTypes.map(yarnType => <option key={yarnType} value={yarnType}>{yarnType}</option>)}
                    </select>
                  </label>
                )}

                <label className="catalog-stock-filter">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={event => setInStockOnly(event.target.checked)}
                  />
                  <span>In stock</span>
                </label>
                    </div>

                    <div className="catalog-filter-panel-footer">
                      <button
                        type="button"
                        className="catalog-clear-filters"
                        onClick={clearFilters}
                        disabled={!hasActiveFilters && sortOption === 'bestselling'}
                      >
                        Clear all
                      </button>
                      <button
                        type="button"
                        className="btn-primary catalog-done-button"
                        onClick={() => setIsFilterPanelOpen(false)}
                      >
                        Show {filteredProducts.length} {filteredProducts.length === 1 ? 'result' : 'results'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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
                  : searchQuery.trim() ? 'No close matches found' : 'No products match these filters'}
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
              {products.length > 0 && hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="btn-secondary">
                  Clear filters and browse all products
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
            <div
              key={`${pageCriteria}:${visiblePage}`}
              className="catalog-results-grid"
              style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
              gap: 'clamp(14px, 3vw, 24px)'
            }}>
              {visibleProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {!isLoading && pageCount > 1 && (
            <nav className="catalog-pagination" aria-label="Product pages">
              <button
                type="button"
                className="btn-secondary"
                disabled={visiblePage === 1}
                onClick={() => setPagination({ criteriaKey: pageCriteria, page: Math.max(1, visiblePage - 1) })}
              >
                Previous
              </button>
              <span>Page {visiblePage} of {pageCount}</span>
              <button
                type="button"
                className="btn-secondary"
                disabled={visiblePage === pageCount}
                onClick={() => setPagination({ criteriaKey: pageCriteria, page: Math.min(pageCount, visiblePage + 1) })}
              >
                Next
              </button>
            </nav>
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
