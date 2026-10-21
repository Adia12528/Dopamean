export type AuthRateLimitKind = 'email' | 'request' | null;

export const getAuthRateLimitKind = (error: unknown): AuthRateLimitKind => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? error.status
    : undefined;
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined;

  if (/email rate limit|email.*too many|over_email_send_rate_limit/i.test(message)) return 'email';
  if (status === 429 || code === 'too_many_requests' || /rate limit exceeded|too many requests/i.test(message)) return 'request';
  return null;
};

export const isAuthRateLimitError = (error: unknown) => getAuthRateLimitKind(error) !== null;

export const getAuthErrorMessage = (error: unknown, fallback: string): string => {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : '';
  const rateLimitKind = getAuthRateLimitKind(error);
  if (rateLimitKind === 'email') {
    return 'Email sending is temporarily paused because too many emails were requested. Check your inbox and spam, then try again in 60 minutes.';
  }
  if (rateLimitKind === 'request') return 'Too many attempts were made in a short time. Please wait 5 minutes, then try again.';

  return message || fallback;
};