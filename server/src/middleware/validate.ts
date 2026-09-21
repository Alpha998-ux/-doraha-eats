import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type Schemas = { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema };

/** Parses and REPLACES req.body/query/params with the typed, stripped result. */
export const validate = (schemas: Schemas): RequestHandler => (req, _res, next) => {
  try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
    if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
    next();
  } catch (e) {
    next(e);
  }
};
