export const authenticateWithLaravelClient = async (): Promise<string> => {
  try {
    const response = await fetch('/api/auth/laravel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Error during Laravel authentication');
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('Laravel did not return a token.');
    }

    localStorage.setItem('laravel_jwt', data.access_token);
    return data.access_token;
  } catch (error) {
    throw new Error('Authentication with Laravel failed.');
  }
};
