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
  const timeout = setTimeout(() => controller.abort(), 1_800_000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      credentials: 'omit',
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`Request error: ${response.status} - ${response.statusText}`, responseText);
      throw new Error(`Request error: ${response.status} - ${response.statusText}`);
    }

    try {
      const data = JSON.parse(responseText);
      return data;
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError, responseText);
      throw new Error('Failed to parse response from Laravel API.');
    }
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
