import crypto from 'crypto';

const sha512 = value => crypto.createHash('sha512').update(value, 'utf8').digest('hex');
const normalize = value => String(value ?? '');

const getEncryptionKey = () => {
  const masterKey = process.env.PAYU_CREDENTIALS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;
  if (!masterKey) throw new Error('Set PAYU_CREDENTIALS_ENCRYPTION_KEY (or a stable JWT_SECRET) before saving PayU credentials.');
  if (Buffer.byteLength(masterKey, 'utf8') < 32) {
    throw new Error('PAYU_CREDENTIALS_ENCRYPTION_KEY or JWT_SECRET must be at least 32 bytes to encrypt PayU credentials.');
  }
  return crypto.createHash('sha256').update(masterKey, 'utf8').digest();
};

export const encryptPayuSecret = value => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext.toString('hex')}`;
};

export const decryptPayuSecret = value => {
  if (!String(value || '').startsWith('v1:')) return String(value || '');
  const [, ivHex, tagHex, ciphertextHex] = String(value).split(':');
  if (!/^[a-f0-9]{24}$/i.test(ivHex || '') || !/^[a-f0-9]{32}$/i.test(tagHex || '') || !/^(?:[a-f0-9]{2})*$/i.test(ciphertextHex || '')) {
    throw new Error('Stored PayU credential has an invalid encrypted format.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final()
  ]).toString('utf8');
};

export const createPayuRequestHash = ({ key, salt, txnid, amount, productinfo, firstname, email, udf1 = '' }) =>
  sha512([
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    ...Array(9).fill('')
  ].join('|') + `|${salt}`);

export const createPayuVerifyHash = ({ key, salt, txnid }) =>
  sha512(`${key}|verify_payment|${txnid}|${salt}`);

export const verifyPayuResponseHash = (response, salt) => {
  const fields = [
    ...(response.additional_charges ? [normalize(response.additional_charges)] : []),
    salt,
    normalize(response.status),
    '',
    '',
    '',
    '',
    '',
    normalize(response.udf5),
    normalize(response.udf4),
    normalize(response.udf3),
    normalize(response.udf2),
    normalize(response.udf1),
    normalize(response.email),
    normalize(response.firstname),
    normalize(response.productinfo),
    normalize(response.amount),
    normalize(response.txnid),
    normalize(response.key)
  ];
  const expected = sha512(fields.join('|'));
  const actual = normalize(response.hash).toLowerCase();
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = /^[a-f0-9]{128}$/.test(actual) ? Buffer.from(actual, 'hex') : Buffer.alloc(0);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

export const formatPayuAmount = amount => {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) && numericAmount >= 0 ? numericAmount.toFixed(2) : '';
};
