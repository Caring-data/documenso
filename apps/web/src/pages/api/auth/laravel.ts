import type { NextApiRequest, NextApiResponse } from 'next';

import { getLaravelToken } from '@documenso/lib/server-only/laravel-auth/getLaravelToken';

interface AuthResponse {
  access_token?: string;
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AuthResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const access_token = await getLaravelToken();

    res.setHeader('Set-Cookie', [
      `laravel_jwt=${access_token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax; ${
        process.env.NODE_ENV === 'production' ? 'Secure;' : ''
      }`,
    ]);

    res.status(200).json({ access_token });
  } catch (error) {
    console.error('Laravel auth API error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}
