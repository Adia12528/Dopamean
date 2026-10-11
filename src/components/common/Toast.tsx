import React from 'react';
import { useStore } from '../../context/StoreContext';
import { CheckCircle2, Info, AlertCircle } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toastMessage } = useStore();

  if (!toastMessage) return null;

  const icons = {
    success: <CheckCircle2 size={18} color="#15803D" />,
    info: <Info size={18} color="#0284C7" />,
    error: <AlertCircle size={18} color="#DC2626" />
  };

  const bgColors = {
    success: '#F0FDF4',
    info: '#F0F9FF',
    error: '#FEF2F2'
  };

  const borderColors = {
    success: 'rgba(34, 197, 94, 0.3)',
    info: 'rgba(14, 165, 233, 0.3)',
    error: 'rgba(239, 68, 68, 0.3)'
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 20px',
      borderRadius: 'var(--radius-md)',
      backgroundColor: bgColors[toastMessage.type],
      border: `1px solid ${borderColors[toastMessage.type]}`,
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.12)',
      color: '#1E293B',
      fontSize: '0.9rem',
      fontWeight: 500,
      animation: 'fadeIn 0.25s ease-out'
    }}>
      {icons[toastMessage.type]}
      <span>{toastMessage.text}</span>
    </div>
  );
};
