import type { Order, StoreSettings } from '../types';

export async function downloadInvoicePDF(order: Order, settings: StoreSettings): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');
  const { default: jsPDF } = await import('jspdf');

  const invoiceDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Create an offscreen invoice element for rendering
  const container = document.createElement('div');
  container.id = 'direct-invoice-pdf-render';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.backgroundColor = '#FFFFFF';
  container.style.padding = '36px 40px';
  container.style.color = '#1E293B';
  container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Outfit', sans-serif";
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-9999';

  const itemsRows = order.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 12px 0;">
          <div style="font-weight: 600; color: #0F172A; font-size: 14px;">${item.productTitle}</div>
          <div style="font-size: 12px; color: #64748B;">Handmade Crochet Accessory${item.color ? ` • Color: ${item.color}` : ''}</div>
        </td>
        <td style="padding: 12px 0; text-align: center; font-weight: 600;">${item.quantity}</td>
        <td style="padding: 12px 0; text-align: right; color: #475569;">${settings.currency}${item.price}</td>
        <td style="padding: 12px 0; text-align: right; font-weight: 700; color: #0F172A;">${settings.currency}${item.price * item.quantity}</td>
      </tr>
    `
    )
    .join('');

  const shippingDisplay =
    (order.shippingAmount ?? (order.subtotal >= settings.freeShippingThreshold ? 0 : (settings.shippingFee ?? 40))) === 0
      ? 'FREE'
      : `${settings.currency}${order.shippingAmount ?? settings.shippingFee ?? 40}`;

  const discountRow =
    order.discountAmount > 0
      ? `
      <div style="display: flex; justify-content: space-between; color: #16A34A; font-size: 14px;">
        <span>Discount (${order.promoCodeApplied || 'Promo'}):</span>
        <span>-${settings.currency}${order.discountAmount}</span>
      </div>
    `
      : '';

  container.innerHTML = `
    <div style="border-bottom: 2px solid #E2E8F0; padding-bottom: 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 28px;">🧶</span>
          <h1 style="font-size: 24px; font-weight: 800; color: #C85A32; margin: 0;">${settings.storeName || 'Cozy Loops by Deepa'}</h1>
        </div>
        <p style="margin: 4px 0 0; color: #64748B; font-size: 13px;">${settings.storeTagline || 'Handcrafted Crochet Accessories'}</p>
        <p style="margin: 2px 0 0; color: #64748B; font-size: 12px;">${settings.contactEmail || ''} • ${settings.contactPhone || ''}</p>
        ${settings.studioLocation ? `<p style="margin: 2px 0 0; color: #64748B; font-size: 12px;">${settings.studioLocation}</p>` : ''}
      </div>

      <div style="text-align: right;">
        <span style="display: inline-block; background-color: #EFF6FF; color: #1D4ED8; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
          Tax Invoice
        </span>
        <div style="font-size: 16px; font-weight: 800; color: #0F172A;">#${order.id}</div>
        <div style="font-size: 12px; color: #64748B; margin-top: 2px;">Date: ${invoiceDate}</div>
        <div style="margin-top: 4px; font-size: 12px; font-weight: 600; color: ${order.paymentStatus === 'paid' ? '#059669' : '#D97706'};">
          Payment: ${(order.paymentMethod || 'COD').toUpperCase()} (${(order.paymentStatus || 'PENDING').toUpperCase()})
        </div>
      </div>
    </div>

    <!-- Customer & Shipping -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background-color: #F8FAFC; padding: 18px 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #E2E8F0;">
      <div>
        <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
          Billed & Shipped To:
        </div>
        <div style="font-weight: 700; font-size: 15px; color: #0F172A;">${order.customer.name}</div>
        <div style="color: #475569; font-size: 13px; margin-top: 2px;">${order.customer.email}</div>
        ${order.customer.phone ? `<div style="color: #475569; font-size: 13px;">${order.customer.phone}</div>` : ''}
      </div>

      <div>
        <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
          Delivery Address:
        </div>
        <div style="color: #334155; font-size: 13px; white-space: pre-wrap;">${order.customer.address || 'Address provided'}</div>
        ${order.trackingNumber ? `<div style="margin-top: 6px; font-size: 12px; color: #2563EB; font-weight: 600;">Tracking AWB: ${order.trackingNumber}</div>` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 24px;">
      <thead>
        <tr style="border-bottom: 2px solid #CBD5E1; font-size: 12px; text-transform: uppercase; color: #64748B;">
          <th style="padding: 8px 0; font-weight: 700;">Item Description</th>
          <th style="padding: 8px 0; text-align: center; font-weight: 700;">Qty</th>
          <th style="padding: 8px 0; text-align: right; font-weight: 700;">Rate</th>
          <th style="padding: 8px 0; text-align: right; font-weight: 700;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals Summary -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 28px;">
      <div style="width: 280px; display: flex; flexDirection: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; color: #64748B; font-size: 14px;">
          <span>Subtotal:</span>
          <span>${settings.currency}${order.subtotal}</span>
        </div>
        ${discountRow}
        <div style="display: flex; justify-content: space-between; color: #64748B; font-size: 14px;">
          <span>Pan-India Shipping:</span>
          <span style="color: #16A34A; font-weight: 600;">${shippingDisplay}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 2px solid #E2E8F0; font-size: 18px; font-weight: 800; color: #C85A32;">
          <span>Total Amount:</span>
          <span>${settings.currency}${order.total}</span>
        </div>
      </div>
    </div>

    <!-- Footer Note -->
    <div style="border-top: 1px dashed #CBD5E1; padding-top: 16px; text-align: center; font-size: 12px; color: #64748B;">
      <p style="margin: 0; font-weight: 600; color: #334155;">
        🌸 Thank you for supporting slow handcrafted fashion & handmade artisan dreams!
      </p>
      <p style="margin: 4px 0 0; font-size: 11px;">
        Care note: Gently hand-wash in cold water with mild liquid soap. Air dry flat.
      </p>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    let yPosition = 0;
    let remainingHeight = imgHeight;
    while (remainingHeight > 0) {
      pdf.addImage(imgData, 'PNG', 0, -yPosition, imgWidth, imgHeight);
      remainingHeight -= pageHeight;
      yPosition += pageHeight;
      if (remainingHeight > 0) pdf.addPage();
    }

    pdf.save(`Invoice-${order.id}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
