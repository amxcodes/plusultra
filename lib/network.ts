export const isNavigatorOnline = () => {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
};

export const isLikelyNetworkError = (error: unknown) => {
  if (!error) return false;

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';

  const details =
    typeof error === 'object' && error !== null && 'details' in error
      ? String((error as { details?: unknown }).details ?? '')
      : '';

  const combined = `${message} ${details}`.toLowerCase();

  return (
    combined.includes('failed to fetch') ||
    combined.includes('networkerror') ||
    combined.includes('network request failed') ||
    combined.includes('err_internet_disconnected') ||
    combined.includes('load failed')
  );
};
