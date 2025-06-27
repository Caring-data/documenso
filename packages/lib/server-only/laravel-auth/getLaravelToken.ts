import CryptoJS from 'crypto-js';

export const generateLaravelToken = (): string => {
  const encryptionKey = process.env.NEXT_PRIVATE_LARAVEL_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('Missing Laravel encryption key');

  const key = CryptoJS.enc.Utf8.parse(encryptionKey);
  const iv = CryptoJS.enc.Utf8.parse(encryptionKey);

  const payload = {
    key: encryptionKey,
    timestamp: new Date().toISOString(),
  };

  return CryptoJS.AES.encrypt(JSON.stringify(payload), key, { iv }).toString();
};
