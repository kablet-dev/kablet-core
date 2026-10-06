import { z } from 'zod';

export const actionConfirmationRequestSchema = z.object({ decisionId: z.string().uuid(), idempotencyKey: z.string().trim().min(1).max(200), confirmed: z.literal(true) }).strict();
