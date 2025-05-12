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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      credentials: 'omit',
    });

    const data = await response.json();

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Request error: ${response.status} - ${response.statusText}`, errorText);
      throw new Error(`Request error: ${response.status} - ${response.statusText}`);
    }

    return data;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('⏱️ Request aborted due to timeout');
      throw new Error('Request to Laravel API timed out');
    }

    console.error('Error in fetchWithLaravelAuth:', error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
