import type { Order, StoreSettings } from '../types';
import { getShortOrderId } from '../lib/shortOrderId';

export const isIosBrowser = () => {
  const userAgent = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const money = (value: number | undefined, currency: string) => {
  const amount = Number.isFinite(value) ? Number(value).toFixed(2) : '0.00';
  const prefix = currency === '₹' ? 'INR ' : `${currency || ''}`;
  return `${prefix}${amount}`;
};

export async function downloadInvoicePDF(order: Order, settings: StoreSettings): Promise<void> {
  const isIos = isIosBrowser();
  const iosWindow = isIos ? window.open('', '_blank') : null;
  if (isIos && !iosWindow) {
    throw new Error('Allow pop-ups for this storefront to open your invoice PDF, then try again.');
  }

  try {
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const addText = (text: string, x: number, options?: { size?: number; bold?: boolean; maxWidth?: number }) => {
      const size = options?.size ?? 10;
      pdf.setFont('helvetica', options?.bold ? 'bold' : 'normal');
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text || '-', options?.maxWidth ?? contentWidth);
      const lineHeight = size * 0.42;
      if (y + lines.length * lineHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(lines, x, y);
      y += lines.length * lineHeight;
      return lines.length * lineHeight;
    };

    const addRule = () => {
      pdf.setDrawColor(203, 213, 225);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    const address = [order.customer.address, order.customer.city, order.customer.pincode]
      .filter(part => typeof part === 'string' && part.trim())
      .join(', ') || 'Address provided during checkout';

    pdf.setTextColor(30, 41, 59);
    pdf.setFillColor(200, 90, 50);
    pdf.rect(margin, y, 3, 20, 'F');
    pdf.setTextColor(200, 90, 50);
    addText(settings.storeName || 'Cozy Loops by Deepa', margin + 7, { size: 18, bold: true });
    pdf.setTextColor(71, 85, 105);
    addText(settings.storeTagline || 'Handcrafted Crochet Accessories', margin + 7, { size: 9 });
    addText([settings.contactEmail, settings.contactPhone].filter(Boolean).join(' • '), margin + 7, { size: 8 });
    if (settings.studioLocation) addText(settings.studioLocation, margin + 7, { size: 8 });

    y += 5;
    addRule();
    pdf.setTextColor(30, 41, 59);
    addText('TAX INVOICE', margin, { size: 14, bold: true });
    addText(`Order #${getShortOrderId(order.id)}`, margin, { size: 10, bold: true });
    addText(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    })}`, margin, { size: 9 });
    addText(`Payment: ${(order.paymentMethod || 'COD').toUpperCase()} (${(order.paymentStatus || 'PENDING').toUpperCase()})`, margin, { size: 9 });

    y += 4;
    addRule();
    pdf.setTextColor(30, 41, 59);
    addText('BILLED AND SHIPPED TO', margin, { size: 9, bold: true });
    addText(order.customer.name || 'Customer', margin, { size: 10, bold: true });
    addText(order.customer.email || '', margin, { size: 9 });
    if (order.customer.phone) addText(order.customer.phone, margin, { size: 9 });
    addText(address, margin, { size: 9, maxWidth: contentWidth });
    if (order.trackingNumber) addText(`Tracking AWB: ${order.trackingNumber}`, margin, { size: 9 });

    y += 5;
    addRule();
    const itemNameWidth = contentWidth - 72;
    const qtyX = margin + itemNameWidth + 4;
    const rateX = qtyX + 14;
    const amountX = pageWidth - margin;
    pdf.setTextColor(71, 85, 105);
    addText('ITEM', margin, { size: 8, bold: true, maxWidth: itemNameWidth });
    const headerY = y - 3;
    pdf.text('QTY', qtyX, headerY);
    pdf.text('RATE', rateX, headerY);
    pdf.text('AMOUNT', amountX, headerY, { align: 'right' });
    addRule();

    for (const item of order.items || []) {
      const nameLines = pdf.splitTextToSize(item.productTitle || 'Handcrafted item', itemNameWidth);
      const nameLineHeight = 4.5;
      const colorLines = item.color
        ? pdf.splitTextToSize(`Color: ${item.color}`, itemNameWidth)
        : [];
      const rowHeight = Math.max(nameLines.length * nameLineHeight + colorLines.length * 3.5, 8);
      if (y + rowHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.setTextColor(30, 41, 59);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(nameLines, margin, y);
      if (colorLines.length > 0) {
        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(8);
        pdf.text(colorLines, margin, y + nameLines.length * nameLineHeight);
      }
      const rowY = y + 3;
      pdf.setTextColor(30, 41, 59);
      pdf.text(String(item.quantity || 0), qtyX, rowY);
      pdf.text(money(item.price, settings.currency), rateX, rowY);
      pdf.text(money((Number(item.price) || 0) * (Number(item.quantity) || 0), settings.currency), amountX, rowY, { align: 'right' });
      y += rowHeight + 4;
      addRule();
    }

    const rightLabelX = margin + contentWidth * 0.55;
    const addTotal = (label: string, value: string, bold = false) => {
      if (y + 8 > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.setTextColor(71, 85, 105);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      pdf.setFontSize(bold ? 11 : 9);
      pdf.text(label, rightLabelX, y);
      pdf.text(value, amountX, y, { align: 'right' });
      y += 7;
    };

    addTotal('Subtotal', money(order.subtotal, settings.currency));
    if (Number(order.discountAmount) > 0) {
      addTotal(`Discount${order.promoCodeApplied ? ` (${order.promoCodeApplied})` : ''}`, `-${money(order.discountAmount, settings.currency)}`);
    }
    const shipping = order.shippingAmount ?? (order.subtotal >= settings.freeShippingThreshold ? 0 : settings.shippingFee ?? 40);
    addTotal('Shipping', shipping === 0 ? 'FREE' : money(shipping, settings.currency));
    pdf.setDrawColor(200, 90, 50);
    pdf.line(rightLabelX, y - 2, amountX, y - 2);
    addTotal('TOTAL', money(order.total, settings.currency), true);

    y += 5;
    pdf.setTextColor(100, 116, 139);
    addText('Thank you for supporting handcrafted artisan work.', margin, { size: 9 });

    const blob = pdf.output('blob');
    if (!blob.size) throw new Error('The generated invoice PDF is empty.');

    const objectUrl = URL.createObjectURL(blob);
    if (iosWindow) {
      iosWindow.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return;
    }

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `Invoice-${getShortOrderId(order.id)}.pdf`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    iosWindow?.close();
    throw error;
  }
}
