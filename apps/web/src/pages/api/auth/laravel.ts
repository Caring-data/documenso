import type { NextApiRequest, NextApiResponse } from 'next';

import CryptoJS from 'crypto-js';

interface AuthResponse {
  access_token?: string;
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AuthResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const encryptionKey = process.env.NEXT_PRIVATE_LARAVEL_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('NEXT_PRIVATE_LARAVEL_ENCRYPTION_KEY is not defined');
    }

    const apiUrl = process.env.NEXT_PRIVATE_LARAVEL_API_URL;
    const loginUrl = `${apiUrl}/auth/login`;

    const key = CryptoJS.enc.Utf8.parse(encryptionKey);
    const iv = CryptoJS.enc.Utf8.parse(encryptionKey);

    const encryptedCredentials = CryptoJS.AES.encrypt(
      JSON.stringify({
        username: process.env.NEXT_PRIVATE_LARAVEL_USERNAME,
        password: process.env.NEXT_PRIVATE_LARAVEL_PASSWORD,
      }),
      key,
      { iv: iv },
    ).toString();

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

    // Return only the token to the client
    res.status(200).json({ access_token: data.access_token });
  } catch (error) {
    console.error('Laravel auth API error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
