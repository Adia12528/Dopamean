import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomerAuthNotificationEmail,
  buildOrderNotificationEmail,
  isOrderNotificationConfigured
} from './order-notifications.js';

test('reports whether SMTP order notifications have complete valid settings', () => {
  assert.equal(isOrderNotificationConfigured({}), false);
  assert.equal(isOrderNotificationConfigured({
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'sender@example.com',
    SMTP_PASSWORD: 'app-password',
    ORDER_NOTIFICATION_EMAIL: 'owner@example.com'
  }), true);
  assert.equal(isOrderNotificationConfigured({
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'sender@example.com',
    SMTP_PASSWORD: 'app-password',
    ORDER_NOTIFICATION_EMAIL: 'not-an-email'
  }), false);
});

test('builds an order email with price breakdown and customer fulfillment details', () => {
  const email = buildOrderNotificationEmail({
    id: 'ORD-20261024-0001',
    items: [{ productTitle: 'Rose Clip', quantity: 2, price: 150 }],
    subtotal: 300,
    discountAmount: 30,
    shippingAmount: 40,
    total: 310,
    paymentMethod: 'razorpay',
    paymentStatus: 'pending',
    customer: {
      name: 'Deepa',
      email: 'customer@example.com',
      phone: '9876543210',
      address: '12 Flower Lane',
      city: 'Jamshedpur',
      pincode: '831015'
    }
  }, '₹');

  assert.match(email.subject, /ORD-20261024-0001/);
  assert.match(email.text, /Total: ₹310\.00/);
  assert.match(email.text, /Rose Clip × 2 — ₹300\.00/);
  assert.match(email.text, /12 Flower Lane, Jamshedpur, 831015/);
  assert.match(email.html, /Payment: razorpay \(pending\)/);
});

test('escapes customer and product content in HTML email', () => {
  const email = buildOrderNotificationEmail({
    id: '<order>',
    items: [{ productTitle: '<img src=x onerror=alert(1)>', quantity: 1, price: 1 }],
    customer: { name: '<script>alert(1)</script>', address: 'A & B' },
    total: 1
  });

  assert.doesNotMatch(email.html, /<script>|<img/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /&lt;img/);
  assert.match(email.html, /A &amp; B/);
});

test('builds account and sign-in alerts with only the customer name and phone', () => {
  const user = { name: 'A & B', phone: '<1234567890>', email: 'private@example.com' };
  const accountEmail = buildCustomerAuthNotificationEmail('account_created', user);
  const signInEmail = buildCustomerAuthNotificationEmail('sign_in', user);

  assert.equal(accountEmail.subject, 'New customer account created');
  assert.match(accountEmail.text, /Name: A & B\nPhone: <1234567890>/);
  assert.doesNotMatch(accountEmail.text, /private@example\.com/);
  assert.match(accountEmail.html, /A &amp; B/);
  assert.match(accountEmail.html, /&lt;1234567890&gt;/);
  assert.equal(signInEmail.subject, 'Customer signed in');
  assert.match(signInEmail.text, /Name: A & B\nPhone: <1234567890>/);
});
