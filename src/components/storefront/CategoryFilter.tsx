import React from 'react';
import { useStore } from '../../context/StoreContext';

export const CategoryFilter: React.FC = () => {
  const { selectedCategory, setSelectedCategory, products } = useStore();

  const dynamicCategories = [
    'All',
    ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))
  ];

  const getCount = (cat: string) => {
    if (cat === 'All') return products.length;
    return products.filter(p => p.category === cat).length;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      overflowX: 'auto',
      paddingBottom: '8px',
      marginBottom: '28px',
      scrollbarWidth: 'none'
    }}>
      {dynamicCategories.map(category => {
        const isSelected = selectedCategory === category;
        const count = getCount(category);

        return (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.86rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              backgroundColor: isSelected ? 'var(--accent-terracotta)' : '#FFFFFF',
              color: isSelected ? '#FFFFFF' : 'var(--text-muted)',
              border: isSelected ? '1px solid var(--accent-terracotta)' : '1px solid var(--border-medium)',
              boxShadow: isSelected ? '0 4px 12px rgba(200, 90, 50, 0.22)' : 'var(--shadow-sm)',
              transition: 'var(--transition-smooth)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{category}</span>
            <span style={{
              fontSize: '0.72rem',
              opacity: isSelected ? 0.9 : 0.6,
              background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-surface-soft)',
              padding: '1px 6px',
              borderRadius: '999px',
              color: isSelected ? '#FFFFFF' : 'var(--text-muted)'
            }}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
