import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

interface AppError extends Error {
  status?: number;
  statusCode?: number;
}

export const globalErrorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error('Global Error:', err.stack);
  res.status(err.status || err.statusCode || 500).send({
    success: false,
    message: err.message || 'A server error occurred. Please try again later.',
    error: config.NODE_ENV === 'development' ? err.message : undefined,
  });
};
