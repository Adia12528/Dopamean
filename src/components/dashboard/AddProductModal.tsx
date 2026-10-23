import React, { useState, useRef } from 'react';
import { useBackNavigationLayer } from '../../context/BackNavigationContext';
import type { Product } from '../../types';
import { useStore } from '../../context/StoreContext';
import { api, getAssetUrl } from '../../services/api';
import { X, Upload, Check, Sparkles } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editProduct?: Product | null;
}

const CATEGORY_OPTIONS = [
  'Accessories',
  'Hair Accessories',
  'Rubber Bands',
  'Hair Clips',
  'Combos & Gift Sets',
  'Bags & Totes',
  'Headwear',
  'Amigurumi & Charms',
  'Coasters & Home',
  'Wearables'
];

const buildInitialFormState = (editProduct?: Product | null) => {
  if (!editProduct) {
    return {
      title: '',
      tagline: '',
      category: 'Accessories',
      customCategory: '',
      price: '100',
      originalPrice: '',
      stock: '15',
      maxOrderQuantity: '',
      image: '/uploads/media_1791711047623.jpg',
      secondaryImages: [] as string[],
      newSecondaryUrl: '',
      yarnType: '100% Soft Cotton-Acrylic Blend',
      craftTimeHours: '2',
      careInstructions: 'Gently hand wash in cold water with mild liquid soap. Air dry flat.',
      description: '100% handmade with love, soft, and premium finish.',
      tagsInput: 'Handmade, Floral, Crochet',
      isBestSeller: false,
      isFeatured: true,
      codAvailability: 'inherit' as const,
    };
  }

  const category = CATEGORY_OPTIONS.includes(editProduct.category) ? editProduct.category : 'Custom';

  return {
    title: editProduct.title || '',
    tagline: editProduct.tagline || '',
    category,
    customCategory: category === 'Custom' ? editProduct.category : '',
    price: editProduct.price !== undefined ? editProduct.price.toString() : '',
    originalPrice: editProduct.originalPrice != null ? editProduct.originalPrice.toString() : '',
    stock: editProduct.stock !== undefined ? editProduct.stock.toString() : '',
    maxOrderQuantity: editProduct.maxOrderQuantity != null ? editProduct.maxOrderQuantity.toString() : '',
    image: editProduct.image || '',
    secondaryImages: editProduct.secondaryImages || [],
    newSecondaryUrl: '',
    yarnType: editProduct.yarnType ?? '',
    craftTimeHours: editProduct.craftTimeHours !== undefined ? editProduct.craftTimeHours.toString() : '',
    careInstructions: editProduct.careInstructions ?? '',
    description: editProduct.description ?? '',
    tagsInput: editProduct.tags?.join(', ') ?? '',
    isBestSeller: editProduct.isBestSeller ?? false,
    isFeatured: editProduct.isFeatured ?? false,
    codAvailability: editProduct.codAvailability ?? 'inherit',
  };
};

type ProductFormState = ReturnType<typeof buildInitialFormState>;

const buildProductPayload = (form: ProductFormState) => ({
  title: form.title.trim(),
  tagline: form.tagline.trim(),
  category: form.category === 'Custom' ? (form.customCategory.trim() || 'Accessories') : form.category,
  price: Number(form.price),
  originalPrice: form.originalPrice.trim() ? Number(form.originalPrice) : undefined,
  stock: Number(form.stock),
  maxOrderQuantity: form.maxOrderQuantity.trim() ? Number(form.maxOrderQuantity) : undefined,
  image: form.image.trim(),
  secondaryImages: form.secondaryImages,
  yarnType: form.yarnType.trim(),
  craftTimeHours: parseFloat(form.craftTimeHours) || 2,
  careInstructions: form.careInstructions.trim(),
  description: form.description.trim(),
  tags: form.tagsInput.split(',').map(tag => tag.trim()).filter(Boolean),
  isBestSeller: form.isBestSeller,
  isFeatured: form.isFeatured,
  codAvailability: form.codAvailability
});

type ProductFormPayload = ReturnType<typeof buildProductPayload>;

const getChangedProductFields = (
  current: ProductFormPayload,
  initial: ProductFormPayload
): Partial<Product> => {
  const changed: Partial<Product> = {};
  for (const key of Object.keys(current) as (keyof ProductFormPayload)[]) {
    if (JSON.stringify(current[key]) !== JSON.stringify(initial[key])) {
      Object.assign(changed, { [key]: current[key] });
    }
  }
  return changed;
};

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, editProduct }) => {
  useBackNavigationLayer('add-product-modal', isOpen, onClose);
  const { addProduct, updateProduct, showToast, settings } = useStore();
  const initialForm = buildInitialFormState(editProduct);

  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const secondaryFileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialForm.title);
  const [tagline, setTagline] = useState(initialForm.tagline);
  const [category, setCategory] = useState(initialForm.category);
  const [customCategory, setCustomCategory] = useState(initialForm.customCategory);
  const [price, setPrice] = useState(initialForm.price);
  const [originalPrice, setOriginalPrice] = useState(initialForm.originalPrice);
  const [stock, setStock] = useState(initialForm.stock);
  const [maxOrderQuantity, setMaxOrderQuantity] = useState(initialForm.maxOrderQuantity);
  const [image, setImage] = useState(initialForm.image);
  const [secondaryImages, setSecondaryImages] = useState<string[]>(initialForm.secondaryImages);
  const [newSecondaryUrl, setNewSecondaryUrl] = useState(initialForm.newSecondaryUrl);
  const [yarnType, setYarnType] = useState(initialForm.yarnType);
  const [craftTimeHours, setCraftTimeHours] = useState(initialForm.craftTimeHours);
  const [careInstructions, setCareInstructions] = useState(initialForm.careInstructions);
  const [description, setDescription] = useState(initialForm.description);
  const [tagsInput, setTagsInput] = useState(initialForm.tagsInput);
  const [isBestSeller, setIsBestSeller] = useState(initialForm.isBestSeller);
  const [isFeatured, setIsFeatured] = useState(initialForm.isFeatured);
  const [codAvailability, setCodAvailability] = useState<'inherit' | 'enabled' | 'disabled'>(initialForm.codAvailability);

  const [isMainUploading, setIsMainUploading] = useState(false);
  const [isSecondaryUploading, setIsSecondaryUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  // Handle main image file upload
  const handleMainFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsMainUploading(true);
      const uploadedUrl = await api.uploadImage(file);
      setImage(uploadedUrl);
      setValidationErrors(prev => ({ ...prev, image: '' }));
    } catch {
      alert('Failed to upload image file');
    } finally {
      setIsMainUploading(false);
    }
  };

  // Handle secondary image file upload
  const handleSecondaryFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsSecondaryUploading(true);
      const uploadedUrl = await api.uploadImage(file);
      setSecondaryImages(prev => [...prev, uploadedUrl]);
    } catch {
      alert('Failed to upload secondary angle image');
    } finally {
      setIsSecondaryUploading(false);
    }
  };

  const addSecondaryUrl = () => {
    if (newSecondaryUrl.trim()) {
      setSecondaryImages(prev => [...prev, newSecondaryUrl.trim()]);
      setNewSecondaryUrl('');
    }
  };

  const removeSecondaryImage = (idx: number) => {
    setSecondaryImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(price);
    const parsedOriginalPrice = originalPrice.trim() ? Number(originalPrice) : undefined;
    const parsedStock = Number(stock);
    const parsedMaxOrderQuantity = maxOrderQuantity.trim() ? Number(maxOrderQuantity) : undefined;
    const errors: Record<string, string> = {};
    if (!title.trim() && !(editProduct && title === initialForm.title)) errors.title = 'Enter a product title.';
    if (!image.trim() && !(editProduct && image === initialForm.image)) errors.image = 'Upload or enter a product image URL.';
    if ((!price.trim() || !Number.isInteger(parsedPrice) || parsedPrice < 0) &&
      !(editProduct && price === initialForm.price)) {
      errors.price = 'Enter a whole-number selling price of 0 or more.';
    }
    if (parsedOriginalPrice !== undefined && (!Number.isInteger(parsedOriginalPrice) || parsedOriginalPrice < 0) &&
      !(editProduct && originalPrice === initialForm.originalPrice)) {
      errors.originalPrice = 'Enter a whole-number price of 0 or more, or leave this blank.';
    }
    if ((!stock.trim() || !Number.isInteger(parsedStock) || parsedStock < 0) &&
      !(editProduct && stock === initialForm.stock)) {
      errors.stock = 'Enter a whole number of units (0 or more).';
    }
    const unchangedExistingMaxOrderQuantity = Boolean(editProduct && maxOrderQuantity === initialForm.maxOrderQuantity);
    if (parsedMaxOrderQuantity !== undefined &&
      (!Number.isInteger(parsedMaxOrderQuantity) ||
        (parsedMaxOrderQuantity < 1 && !unchangedExistingMaxOrderQuantity))) {
      errors.maxOrderQuantity = 'Enter a whole number of at least 1, or leave this blank.';
    }
    setValidationErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    const currentForm: ProductFormState = {
      title,
      tagline,
      category,
      customCategory,
      price,
      originalPrice,
      stock,
      maxOrderQuantity,
      image,
      secondaryImages,
      newSecondaryUrl,
      yarnType,
      craftTimeHours,
      careInstructions,
      description,
      tagsInput,
      isBestSeller,
      isFeatured,
      codAvailability
    };
    const productPayload = buildProductPayload(currentForm);

    if (editProduct) {
      updateProduct(editProduct.id, getChangedProductFields(productPayload, buildProductPayload(initialForm)));
      showToast(`Updated "${title.trim()}" successfully!`, 'success');
    } else {
      addProduct(productPayload);
      showToast(`Added "${title.trim()}" to catalog!`, 'success');
    }

    onClose();
  };

  // Discount calculation
  const numSellingPrice = parseFloat(price) || 0;
  const numStrikePrice = originalPrice ? parseFloat(originalPrice) : 0;
  const hasDiscount = numStrikePrice > numSellingPrice;
  const discountPercent = hasDiscount ? Math.round(((numStrikePrice - numSellingPrice) / numStrikePrice) * 100) : 0;

  return (
    <div
      className="mobile-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(35, 28, 22, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <div
        className="mobile-modal-panel dashboard-admin-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-medium)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div className="dashboard-modal-header" style={{
          padding: '20px 28px',
          borderBottom: '1px solid var(--border-medium)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FAF7F2'
        }}>
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.74rem',
              fontWeight: 700,
              color: 'var(--accent-terracotta)',
              textTransform: 'uppercase'
            }}>
              <Sparkles size={13} />
              <span>{editProduct ? 'Super Admin Product Editor' : 'Super Admin New Product Creator'}</span>
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
              {editProduct ? `Customize: ${editProduct.title}` : 'Add New Handcrafted Item'}
            </h3>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--border-medium)',
              cursor: 'pointer',
              color: 'var(--text-muted)'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body / Scrollable Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{
            padding: '28px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>

            {/* TOP ROW: PRIMARY PHOTO & LIVE PREVIEW */}
            <div className="dashboard-form-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              backgroundColor: 'var(--bg-surface-soft)',
              padding: '20px',
              borderRadius: '20px',
              border: '1px solid var(--border-light)'
            }}>
              {/* Photo Upload Box */}
              <div>
                <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>
                  1. Main Product Photo *
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input
                    type="file"
                    ref={mainFileInputRef}
                    accept="image/*"
                    onChange={handleMainFileUpload}
                    style={{ display: 'none' }}
                  />

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => mainFileInputRef.current?.click()}
                      disabled={isMainUploading}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                    >
                      <Upload size={14} />
                      <span>{isMainUploading ? 'Uploading...' : 'Upload from Device'}</span>
                    </button>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>JPG, PNG, WebP</span>
                  </div>

                  <input
                    type="text"
                    placeholder="Or enter image URL (e.g. /uploads/image.jpg)..."
                    value={image}
                    aria-invalid={Boolean(validationErrors.image)}
                    onChange={(e) => {
                      setImage(e.target.value);
                      setValidationErrors(prev => ({ ...prev, image: '' }));
                    }}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: `1px solid ${validationErrors.image ? '#DC2626' : 'var(--border-medium)'}`,
                      fontSize: '0.82rem',
                      backgroundColor: '#FFFFFF'
                    }}
                  />
                  {validationErrors.image && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: 0 }}>{validationErrors.image}</p>}
                </div>
              </div>

              {/* Live Preview Card */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                padding: '12px',
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                gap: '14px',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: '#F3EFEA',
                  flexShrink: 0,
                  position: 'relative'
                }}>
                  {image ? (
                    <img src={getAssetUrl(image)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>🧶</div>
                  )}
                  {isBestSeller && (
                    <span style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      backgroundColor: 'var(--accent-amber)',
                      color: '#FFFFFF',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: '4px'
                    }}>
                      STAR
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent-terracotta)', textTransform: 'uppercase' }}>
                    {category === 'Custom' ? customCategory || 'Custom' : category}
                  </div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title || 'Product Title'}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent-terracotta)' }}>
                      {settings.currency}{price || 0}
                    </span>
                    {hasDiscount && (
                      <>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', textDecoration: 'line-through' }}>
                          {settings.currency}{numStrikePrice}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16A34A' }}>
                          {discountPercent}% OFF
                        </span>
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Stock: {stock} units
                  </div>
                </div>
              </div>
            </div>

            {/* SECONDARY / ADDITIONAL IMAGES GALLERY */}
            <div>
              <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, marginBottom: '6px' }}>
                Secondary Angle & Wear Photos (Gallery)
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  ref={secondaryFileInputRef}
                  accept="image/*"
                  onChange={handleSecondaryFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => secondaryFileInputRef.current?.click()}
                  disabled={isSecondaryUploading}
                  className="btn-secondary"
                  style={{ padding: '7px 14px', fontSize: '0.8rem' }}
                >
                  <Upload size={13} />
                  <span>{isSecondaryUploading ? 'Uploading...' : '+ Upload Extra Angle Photo'}</span>
                </button>

                <div style={{ display: 'flex', gap: '6px', flex: 1, minWidth: '220px' }}>
                  <input
                    type="text"
                    placeholder="Or enter extra photo URL..."
                    value={newSecondaryUrl}
                    onChange={(e) => setNewSecondaryUrl(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-medium)', fontSize: '0.8rem' }}
                  />
                  <button
                    type="button"
                    onClick={addSecondaryUrl}
                    className="btn-secondary"
                    style={{ padding: '7px 12px', fontSize: '0.8rem' }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {secondaryImages.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {secondaryImages.map((secImg, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: '64px',
                        height: '64px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-medium)'
                      }}
                    >
                      <img src={getAssetUrl(secImg)} alt={`Angle ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => removeSecondaryImage(idx)}
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '2px',
                          backgroundColor: 'rgba(220, 38, 38, 0.85)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BASIC DETAILS: TITLE, TAGLINE, CATEGORY */}
            <div className="dashboard-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Handmade Red Rose Rubber Band"
                  value={title}
                  aria-invalid={Boolean(validationErrors.title)}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setValidationErrors(prev => ({ ...prev, title: '' }));
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${validationErrors.title ? '#DC2626' : 'var(--border-medium)'}`,
                    fontSize: '0.9rem'
                  }}
                />
                {validationErrors.title && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.title}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Tagline / Subtitle Hook
                </label>
                <input
                  type="text"
                  placeholder="e.g. Big Flower Ponytail Holder • Soft & Premium"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.9rem',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  {CATEGORY_OPTIONS.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="Custom">+ Custom Category...</option>
                </select>

                {category === 'Custom' && (
                  <input
                    type="text"
                    placeholder="Enter custom category name..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.84rem',
                      marginTop: '6px'
                    }}
                  />
                )}
              </div>
            </div>

            {/* PRICING & STOCK */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Selling Price ({settings.currency}) *
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={price}
                  aria-invalid={Boolean(validationErrors.price)}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    setValidationErrors(prev => ({ ...prev, price: '' }));
                  }}
                  placeholder="100"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${validationErrors.price ? '#DC2626' : 'var(--border-medium)'}`,
                    fontSize: '0.95rem',
                    fontWeight: 700
                  }}
                />
                {validationErrors.price && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.price}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Original / Strikethrough Price ({settings.currency})
                </label>
                <input
                  type="number"
                  step="1"
                  value={originalPrice}
                  aria-invalid={Boolean(validationErrors.originalPrice)}
                  onChange={(e) => {
                    setOriginalPrice(e.target.value);
                    setValidationErrors(prev => ({ ...prev, originalPrice: '' }));
                  }}
                  placeholder="e.g. 130"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${validationErrors.originalPrice ? '#DC2626' : 'var(--border-medium)'}`,
                    fontSize: '0.95rem'
                  }}
                />
                {validationErrors.originalPrice && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.originalPrice}</p>}
                {hasDiscount && (
                  <span style={{ fontSize: '0.74rem', color: '#16A34A', fontWeight: 700, marginTop: '4px', display: 'block' }}>
                    Customer saves {settings.currency}{numStrikePrice - numSellingPrice} ({discountPercent}% discount)
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Available Stock (units) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={stock}
                  aria-invalid={Boolean(validationErrors.stock)}
                  onChange={(e) => {
                    setStock(e.target.value);
                    setValidationErrors(prev => ({ ...prev, stock: '' }));
                  }}
                  placeholder="15"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1px solid ${validationErrors.stock ? '#DC2626' : 'var(--border-medium)'}`,
                    fontSize: '0.95rem'
                  }}
                />
                {validationErrors.stock && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.stock}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  🚦 Max Order Qty / Customer
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxOrderQuantity}
                  aria-invalid={Boolean(validationErrors.maxOrderQuantity)}
                  onChange={(e) => {
                    setMaxOrderQuantity(e.target.value);
                    setValidationErrors(prev => ({ ...prev, maxOrderQuantity: '' }));
                  }}
                  placeholder="e.g. 5 (leave blank for no limit)"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: `1.5px ${validationErrors.maxOrderQuantity ? 'solid #DC2626' : 'dashed var(--accent-terracotta)'}`,
                    fontSize: '0.95rem',
                    backgroundColor: '#FFF8F5'
                  }}
                />
                {validationErrors.maxOrderQuantity && <p role="alert" style={{ color: '#DC2626', fontSize: '0.76rem', margin: '4px 0 0' }}>{validationErrors.maxOrderQuantity}</p>}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Customers can order at most this many pieces per item. Leave blank for unlimited.
                </span>
              </div>
            </div>

            <div style={{
              padding: '16px',
              borderRadius: '14px',
              border: '1px solid var(--border-medium)',
              background: 'var(--bg-surface-soft)'
            }}>
              <label htmlFor="product-cod-availability" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Cash on Delivery for this product
              </label>
              <select
                id="product-cod-availability"
                value={codAvailability}
                onChange={(e) => setCodAvailability(e.target.value as 'inherit' | 'enabled' | 'disabled')}
                style={{ width: '100%', maxWidth: '420px', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-medium)', fontSize: '0.9rem', background: '#FFFFFF' }}
              >
                <option value="inherit">Use category and price rules</option>
                <option value="enabled">Allow COD for this product</option>
                <option value="disabled">Do not allow COD for this product</option>
              </select>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '5px', lineHeight: 1.45 }}>
                Product-level choice overrides category and price rules.
              </div>
            </div>

            {/* ARTISANAL SPECS */}
            <div className="dashboard-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Yarn Composition & Materials
                </label>
                <input
                  type="text"
                  value={yarnType}
                  onChange={(e) => setYarnType(e.target.value)}
                  placeholder="e.g. 100% Soft Cotton-Acrylic Blend"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Hand-Crafting Duration (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={craftTimeHours}
                  onChange={(e) => setCraftTimeHours(e.target.value)}
                  placeholder="2.5"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Washing & Care Instructions
                </label>
                <input
                  type="text"
                  value={careInstructions}
                  onChange={(e) => setCareInstructions(e.target.value)}
                  placeholder="Gently hand wash in cold water with mild liquid soap. Air dry flat."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>
            </div>

            {/* FULL STORY / DESCRIPTION */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                Detailed Product Description & Styling Suggestions
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Big flower design red rose ponytail holder. 100% handmade with love, soft, and premium finish..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.88rem'
                }}
              />
            </div>

            {/* TAGS & FEATURE TOGGLES */}
            <div className="dashboard-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px' }}>
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Red Rose, Ponytail Holder, Handmade, Gift"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                padding: '12px 18px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-surface-soft)',
                border: '1px solid var(--border-light)'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={isBestSeller}
                    onChange={(e) => setIsBestSeller(e.target.checked)}
                  />
                  <span>⭐ Mark as Best Seller</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                  <span>✨ Featured on Storefront</span>
                </label>
              </div>
            </div>

          </div>

          {/* Modal Footer / Save Action */}
          <div className="dashboard-modal-footer" style={{
            padding: '16px 28px',
            borderTop: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FAF7F2'
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '9px 20px', fontSize: '0.86rem' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '10px 28px', fontSize: '0.9rem' }}
            >
              <Check size={16} />
              <span>{editProduct ? 'Update Product Details' : 'Add to Live Catalog'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
