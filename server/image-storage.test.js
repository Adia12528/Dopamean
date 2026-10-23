import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_UPLOAD_PURPOSES, containsImageReference, getManagedImageObjectKey } from './image-storage.js';

test('uses the requested image upload size limits without changing existing objects', () => {
  assert.equal(IMAGE_UPLOAD_PURPOSES.product.maxBytes, 300 * 1024);
  assert.equal(IMAGE_UPLOAD_PURPOSES.offer.maxBytes, 1024 * 1024);
  assert.equal(IMAGE_UPLOAD_PURPOSES.storefront.maxBytes, 5 * 1024 * 1024);
  assert.equal(IMAGE_UPLOAD_PURPOSES['payment-qr'].maxBytes, 5 * 1024 * 1024);
});

test('only resolves storage objects from the configured public bucket and project', () => {
  const projectUrl = 'https://example.supabase.co';
  assert.equal(
    getManagedImageObjectKey(
      'https://example.supabase.co/storage/v1/object/public/media/legacy-migration/2e649c29-f5f0-472a-8a1b-fa33481af0ce/image.jpg',
      projectUrl,
      'media'
    ),
    'legacy-migration/2e649c29-f5f0-472a-8a1b-fa33481af0ce/image.jpg'
  );
  assert.equal(
    getManagedImageObjectKey('https://other.supabase.co/storage/v1/object/public/media/image.jpg', projectUrl, 'media'),
    null
  );
  assert.equal(
    getManagedImageObjectKey('https://example.supabase.co/storage/v1/object/public/private/image.jpg', projectUrl, 'media'),
    null
  );
  assert.equal(
    getManagedImageObjectKey('https://example.supabase.co/storage/v1/object/public/media/%2e%2e/secret.jpg', projectUrl, 'media'),
    null
  );
  assert.equal(
    getManagedImageObjectKey('https://example.supabase.co/storage/v1/object/public/media/favorites/keep.jpg', projectUrl, 'media'),
    null
  );
  assert.equal(
    getManagedImageObjectKey('https://example.supabase.co/storage/v1/object/public/media/crochet_%2f..%2fsecret.jpg', projectUrl, 'media'),
    null
  );
});

test('detects exact image references nested in arrays and records', () => {
  const imageUrl = 'https://example.supabase.co/storage/v1/object/public/media/image.jpg';
  assert.equal(containsImageReference({ items: [{ image: imageUrl }] }, imageUrl), true);
  assert.equal(containsImageReference({ image: `${imageUrl}?download=1` }, imageUrl), true);
  assert.equal(
    containsImageReference({ image: 'https://example.supabase.co/storage/v1/render/image/public/media/image.jpg?width=200' }, imageUrl),
    true
  );
  assert.equal(containsImageReference({ image: 'https://example.supabase.co/storage/v1/object/public/media/other.jpg' }, imageUrl), false);
});
