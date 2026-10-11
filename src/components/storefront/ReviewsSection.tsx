import React, { useState, useEffect } from 'react';
import type { Review } from '../../types';
import { api } from '../../services/api';
import { useStore } from '../../context/StoreContext';
import { Star, CheckCircle, Send, Sparkles } from 'lucide-react';

interface ReviewsSectionProps {
  productId: string;
  productTitle: string;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({ productId, productTitle }) => {
  const { submitReview } = useStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [rating, setRating] = useState(5);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchReviews = async () => {
      setIsLoading(true);
      try {
        const fetched = await api.getReviews(productId);
        if (isMounted) setReviews(fetched);
      } catch (err) {
        console.warn('Failed to load reviews:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchReviews();
    return () => { isMounted = false; };
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      const newRev = await submitReview(
        productId,
        rating,
        comment.trim(),
        customerName.trim() || 'Happy Customer',
        customerEmail.trim()
      );
      setReviews(prev => [newRev, ...prev]);
      setComment('');
      setCustomerName('');
      setCustomerEmail('');
      setShowForm(false);
    } catch (err) {
      alert('Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '5.0';

  return (
    <div style={{ marginTop: '32px', paddingTop: '28px', borderTop: '1px solid var(--border-medium)' }}>
      {/* Reviews Summary Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Patron Reviews & Experiences
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <div style={{ display: 'flex', color: '#F59E0B' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={15}
                  fill={s <= Math.round(Number(avgRating)) ? '#F59E0B' : 'none'}
                  color="#F59E0B"
                />
              ))}
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
              {avgRating} / 5
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ({reviews.length} {reviews.length === 1 ? 'verified review' : 'verified reviews'})
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '999px',
            backgroundColor: showForm ? 'var(--bg-surface-soft)' : 'var(--accent-terracotta)',
            color: showForm ? 'var(--text-main)' : '#FFFFFF',
            border: showForm ? '1px solid var(--border-medium)' : 'none',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Sparkles size={14} />
          <span>{showForm ? 'Cancel Review' : 'Write a Review'}</span>
        </button>
      </div>

      {/* Review Submission Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: 'var(--bg-surface-soft)',
            padding: '20px 24px',
            borderRadius: '18px',
            border: '1.5px dashed var(--accent-terracotta)',
            marginBottom: '24px'
          }}
        >
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
            How do you love "{productTitle}"?
          </div>

          {/* Interactive Star Picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '6px' }}>
              Rating:
            </span>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: (hoverRating || rating) >= s ? '#F59E0B' : '#D1D5DB'
                }}
              >
                <Star
                  size={24}
                  fill={(hoverRating || rating) >= s ? '#F59E0B' : 'none'}
                />
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Your Name
              </label>
              <input
                type="text"
                placeholder="e.g. Pooja M."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.85rem'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                Email (Optional)
              </label>
              <input
                type="email"
                placeholder="for verified buyer badge"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Your Review & Styling Experience
            </label>
            <textarea
              rows={3}
              placeholder="Tell others how it holds your hair, the softness of the yarn, or how it arrived boxed..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-medium)',
                fontSize: '0.85rem',
                fontFamily: 'inherit'
              }}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.85rem' }}
          >
            <Send size={14} />
            <span>{isSubmitting ? 'Submitting...' : 'Post Verified Review'}</span>
          </button>
        </form>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Loading customer feedback...
        </div>
      ) : reviews.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '24px 16px',
          backgroundColor: 'var(--bg-surface-soft)',
          borderRadius: '16px',
          color: 'var(--text-muted)',
          fontSize: '0.86rem'
        }}>
          No reviews yet for this piece. Be the first patron to share your experience! 🧶
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {reviews.map((rev) => (
            <div
              key={rev.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid var(--border-medium)',
                padding: '16px 20px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    {rev.customerName}
                  </span>
                  {rev.verifiedPurchase && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '999px'
                    }}>
                      <CheckCircle size={10} />
                      Verified Patron
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', color: '#F59E0B' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={12}
                      fill={s <= rev.rating ? '#F59E0B' : 'none'}
                      color="#F59E0B"
                    />
                  ))}
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                "{rev.comment}"
              </p>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', marginTop: '8px' }}>
                {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
