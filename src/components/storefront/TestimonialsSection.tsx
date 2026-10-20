import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { api } from '../../services/api';
import type { Review } from '../../types';

interface Testimonial {
  review: Review;
  productTitle: string;
}

export const TestimonialsSection: React.FC = () => {
  const { products, settings } = useStore();
  const [reviewData, setReviewData] = useState<{ key: string; testimonials: Testimonial[] }>({
    key: '',
    testimonials: []
  });
  const isEnabled = settings.showTestimonialsSection === true;
  const reviewedProducts = products.filter(product => product.reviewsCount > 0).slice(0, 3);
  const requestKey = reviewedProducts.map(product => product.id).join('|');

  useEffect(() => {
    if (!isEnabled || !requestKey) return;

    const productsToReview = products.filter(product => product.reviewsCount > 0).slice(0, 3);
    let isMounted = true;

    const loadTestimonials = async () => {
      const results = await Promise.allSettled(
        productsToReview.map(async product => ({
          productTitle: product.title,
          reviews: await api.getReviews(product.id)
        }))
      );

      const loadedTestimonials: Testimonial[] = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`Failed to load reviews for product ${productsToReview[index].id}:`, result.reason);
          return;
        }

        result.value.reviews.forEach(review => {
          if (review.comment.trim()) {
            loadedTestimonials.push({ review, productTitle: result.value.productTitle });
          }
        });
      });

      loadedTestimonials.sort(
        (a, b) => Date.parse(b.review.createdAt) - Date.parse(a.review.createdAt)
      );

      if (isMounted) {
        setReviewData({ key: requestKey, testimonials: loadedTestimonials.slice(0, 3) });
      }
    };

    void loadTestimonials();
    return () => {
      isMounted = false;
    };
  }, [isEnabled, products, requestKey]);

  const isLoading = isEnabled && reviewedProducts.length > 0 && reviewData.key !== requestKey;
  const testimonials = reviewData.key === requestKey ? reviewData.testimonials : [];

  if (!isEnabled || reviewedProducts.length === 0 || (!isLoading && testimonials.length === 0)) return null;

  return (
    <section className="testimonials-section" aria-labelledby="testimonials-heading">
      <div className="container">
        <h2 id="testimonials-heading" className="testimonials-title">Customer reviews</h2>
        <div className="testimonials-grid" aria-busy={isLoading}>
          {isLoading ? (
            [1, 2, 3].map(index => (
              <div className="testimonial-card testimonial-skeleton" key={index} aria-hidden="true">
                <div />
                <div />
                <div />
              </div>
            ))
          ) : (
            testimonials.map(({ review, productTitle }) => (
              <article className="testimonial-card" key={review.id}>
                <div className="testimonial-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star
                      key={star}
                      size={16}
                      fill={star <= review.rating ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <blockquote className="testimonial-comment">{review.comment}</blockquote>
                <footer className="testimonial-attribution">
                  <span className="testimonial-customer">{review.customerName.trim() || 'Customer'}</span>
                  <span className="testimonial-product">{productTitle}</span>
                </footer>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
