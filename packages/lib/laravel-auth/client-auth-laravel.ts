export const authenticateWithLaravelClient = async (): Promise<void> => {
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
  } catch (error) {
    console.error(error);
    throw error;
  }
};
