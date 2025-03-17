import CryptoJS from 'crypto-js';

const encryptForLaravel = (data: Record<string, unknown>) => {
  const encryptionKey = process.env.NEXT_PRIVATE_LARAVEL_ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('NEXT_PRIVATE_LARAVEL_ENCRYPTION_KEY is not defined');
  }

  const key = CryptoJS.enc.Utf8.parse(encryptionKey);
  const iv = CryptoJS.enc.Utf8.parse(encryptionKey);

  return CryptoJS.AES.encrypt(JSON.stringify(data), key, { iv: iv }).toString();
};

export const authenticateWithLaravel = async (): Promise<string> => {
  const apiUrl = process.env.NEXT_PRIVATE_LARAVEL_API_URL;
  const loginUrl = `${apiUrl}/auth/login`;

  const encryptedCredentials = encryptForLaravel({
    username: 'admin',
    password: 'AdminCD2025',
  });

  try {
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ data: encryptedCredentials }),
    });

    if (!response.ok) {
      throw new Error('Error during Laravel authentication');
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('Laravel did not return a token.');
    }

    localStorage.setItem('laravel_jwt', data.access_token);
    return data.token;
  } catch (error) {
    throw new Error('Authentication with Laravel failed.');
  }
};
