
import { z } from 'zod';
import { insertLensSchema, lenses } from './schema';
export type { InsertLens } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  lenses: {
    list: {
      method: 'GET' as const,
      path: '/api/lenses',
      responses: {
        200: z.array(z.custom<typeof lenses.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/lenses/:id',
      responses: {
        200: z.custom<typeof lenses.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/lenses',
      input: insertLensSchema,
      responses: {
        201: z.custom<typeof lenses.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/lenses/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
