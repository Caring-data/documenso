import { authenticateWithLaravelClient } from './client-auth-laravel';

export const fetchWithLaravelAuth = async (
  url: string,
  options: RequestInit = {},
  token?: string,
) => {
  let authToken = token || localStorage.getItem('laravel_jwt');

  if (!authToken) {
    authToken = await authenticateWithLaravelClient();
    localStorage.setItem('laravel_jwt', authToken);
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
