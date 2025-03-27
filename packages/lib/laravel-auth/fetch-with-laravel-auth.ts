export const fetchWithLaravelAuth = async (
  url: string,
  options: RequestInit = {},
  authToken: string,
) => {
  if (!authToken || typeof authToken !== 'string') {
    throw new Error('Token not provided for authentication.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${authToken}`,
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });

  const data = await response.json();

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Request error: ${response.status} - ${response.statusText}`, errorText);
    throw new Error(`Request error: ${response.status} - ${response.statusText}`);
  }

  return data;
};
