import { Context } from 'hono';

export const errorHandler = (err: Error, c: Context) => {
  console.error('Error:', err);

  const statusCode = (err as any).statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return c.json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  }, statusCode);
};
