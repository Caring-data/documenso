import { authenticateWithLaravel } from './auth-laravel';

export const fetchWithLaravelAuth = async (
  url: string,
  options: RequestInit = {},
  token?: string,
) => {
  let authToken = token || localStorage.getItem('jwt');

  if (!authToken) {
    authToken = await authenticateWithLaravel();
    localStorage.setItem('jwt', authToken);
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${authToken}`,
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Request error: ${response.status} - ${response.statusText}`, errorText);
    throw new Error(`Request error: ${response.status} - ${response.statusText}`);
  }

  return response.json();
};
