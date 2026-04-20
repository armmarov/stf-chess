import { z } from 'zod';

export const resourceTypeEnum = z.enum(['book', 'homework', 'app']);

export const createResourceSchema = z.object({
  title: z.string().min(1).max(200),
  type: resourceTypeEnum,
  description: z.string().optional(),
  url: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url('Invalid URL').optional(),
  ),
  isEnabled: z.preprocess(
    (v) => (v === 'true' || v === true ? true : v === 'false' || v === false ? false : true),
    z.boolean().default(true),
  ),
});

export const updateResourceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: resourceTypeEnum.optional(),
  description: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().nullable().optional(),
  ),
  url: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().url('Invalid URL').nullable().optional(),
  ),
  isEnabled: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().optional(),
  ),
  removeImage: z.string().optional(),
  removeFile: z.string().optional(),
});

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
