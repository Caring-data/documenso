let backendCachedToken: string | null = null;

export const getBackendCachedToken = (): string | null => backendCachedToken;

export const setBackendCachedToken = (token: string): void => {
  backendCachedToken = token;
};
