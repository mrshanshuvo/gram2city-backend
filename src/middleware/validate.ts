import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, Next: NextFunction) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as { body?: unknown; query?: unknown; params?: unknown };

      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query as Request['query'];
      if (parsed.params !== undefined) req.params = parsed.params as Request['params'];
      return Next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.issues.map((err) => ({
            path: err.path,
            message: err.message,
          })),
        });
      }
      console.error('Validation middleware error:', error);
      const message =
        error instanceof Error ? error.message : 'Internal server error during validation';
      const stack = error instanceof Error ? error.stack : undefined;
      return res.status(500).json({
        success: false,
        message,
        stack,
      });
    }
  };
};
