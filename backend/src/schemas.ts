import { z } from 'zod';

const dateSchema = z.string().datetime().or(z.string().datetime({ offset: true })).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

export const createOrderSchema = z.object({
  osNumber: z.number().int().positive(),
  entryDate: dateSchema,
  customerName: z.string().min(1),
  brandId: z.string().uuid().or(z.string().min(1)),
  serviceValue: z.coerce.number().positive(),
  paymentMethod: z.string().optional(),
  description: z.string().optional(),
});

export const updateOrderSchema = z.object({
  osNumber: z.number().int().positive().optional(),
  entryDate: dateSchema.optional(),
  customerName: z.string().min(1).optional(),
  brandId: z.string().uuid().or(z.string().min(1)).optional(),
  serviceValue: z.coerce.number().positive().optional(),
  paymentMethod: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'PAID']).optional(),
});

export const bulkUpdateOrderSchema = z.object({
  ids: z.array(z.string()).min(1),
  status: z.enum(['PENDING', 'PAID']),
});
