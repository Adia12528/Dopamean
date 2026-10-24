import nodemailer from 'nodemailer';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[character]);

const getSmtpConfiguration = (env = process.env) => {
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'ORDER_NOTIFICATION_EMAIL']
    .filter(key => !String(env[key] || '').trim());
  if (missing.length > 0) return { missing };

  const port = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'SMTP_PORT must be a valid port number.' };
  }

  return {
    host: String(env.SMTP_HOST).trim(),
    port,
    secure: env.SMTP_SECURE === undefined ? port === 465 : env.SMTP_SECURE === 'true',
    user: String(env.SMTP_USER).trim(),
    password: String(env.SMTP_PASSWORD),
    from: String(env.SMTP_FROM || env.SMTP_USER).trim(),
    to: String(env.ORDER_NOTIFICATION_EMAIL).trim()
  };
};

export const isOrderNotificationConfigured = (env = process.env) => {
  const config = getSmtpConfiguration(env);
  return !config.missing && !config.error &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.to) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.from);
};

export const buildOrderNotificationEmail = (order, currency = 'INR') => {
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.map(item =>
    `${item.productTitle || 'Item'} × ${Number(item.quantity) || 0} — ${currency}${(Number(item.price) * Number(item.quantity)).toFixed(2)}`
  );
  const customer = order.customer || {};
  const address = [customer.address, customer.city, customer.pincode].filter(Boolean).join(', ');
  const lines = [
    `New order ${order.id}`,
    '',
    ...itemLines,
    '',
    `Subtotal: ${currency}${Number(order.subtotal || 0).toFixed(2)}`,
    `Discount: ${currency}${Number(order.discountAmount || 0).toFixed(2)}`,
    `Delivery: ${currency}${Number(order.shippingAmount || 0).toFixed(2)}`,
    `Total: ${currency}${Number(order.total || 0).toFixed(2)}`,
    `Payment: ${order.paymentMethod || 'unknown'} (${order.paymentStatus || order.status || 'pending'})`,
    '',
    `Customer: ${customer.name || ''}`,
    `Email: ${customer.email || ''}`,
    `Phone: ${customer.phone || ''}`,
    `Address: ${address}`
  ];
  const htmlItems = items.map(item =>
    `<li>${escapeHtml(item.productTitle || 'Item')} × ${Number(item.quantity) || 0} — ${escapeHtml(currency)}${(Number(item.price) * Number(item.quantity)).toFixed(2)}</li>`
  ).join('');
  const html = `<h2>New order ${escapeHtml(order.id)}</h2>
    <ul>${htmlItems}</ul>
    <p>Subtotal: ${escapeHtml(currency)}${Number(order.subtotal || 0).toFixed(2)}<br>
    Discount: ${escapeHtml(currency)}${Number(order.discountAmount || 0).toFixed(2)}<br>
    Delivery: ${escapeHtml(currency)}${Number(order.shippingAmount || 0).toFixed(2)}<br>
    <strong>Total: ${escapeHtml(currency)}${Number(order.total || 0).toFixed(2)}</strong></p>
    <p>Payment: ${escapeHtml(order.paymentMethod || 'unknown')} (${escapeHtml(order.paymentStatus || order.status || 'pending')})</p>
    <p>Customer: ${escapeHtml(customer.name)}<br>
    Email: ${escapeHtml(customer.email)}<br>
    Phone: ${escapeHtml(customer.phone)}<br>
    Address: ${escapeHtml(address)}</p>`;

  return {
    subject: `New order ${String(order.id || '').replace(/[\r\n]/g, '')} — ${String(currency).replace(/[\r\n]/g, '')}${Number(order.total || 0).toFixed(2)}`,
    text: lines.join('\n'),
    html
  };
};

export const sendNewOrderNotification = async (order, currency) => {
  const config = getSmtpConfiguration();
  if (config.missing) {
    console.error(`Order notification email not sent; configure these Render variables: ${config.missing.join(', ')}.`);
    return false;
  }
  if (config.error) {
    console.error(`Order notification email not sent: ${config.error}`);
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.to) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.from)) {
    console.error('Order notification email not sent; SMTP_FROM and ORDER_NOTIFICATION_EMAIL must be valid email addresses.');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
    const message = buildOrderNotificationEmail(order, currency);
    await transporter.sendMail({ from: config.from, to: config.to, ...message });
    console.info(`New order notification sent for order ${order.id}.`);
    return true;
  } catch (error) {
    console.error(`Could not send order notification for order ${order.id}:`, error);
    return false;
  }
};
