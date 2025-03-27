export const fetchWithLaravelAuth = async (
  url: string,
  options: RequestInit = {},
  laravelToken: string,
) => {
  if (!laravelToken) {
    throw new Error('Token not provided for authentication.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${laravelToken}`,
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers, credentials: 'omit' });

  const data = await response.json();

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Request error: ${response.status} - ${response.statusText}`, errorText);
    throw new Error(`Request error: ${response.status} - ${response.statusText}`);
  }

  return data;
};
