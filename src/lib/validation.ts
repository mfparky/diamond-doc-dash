import { z } from 'zod';

// Pitcher validation schema
export const pitcherSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters'),
  maxWeeklyPitches: z.number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1')
    .max(500, 'Maximum is 500 pitches'),
});

// Outing validation schema
export const outingSchema = z.object({
  pitcherName: z.string()
    .trim()
    .min(1, 'Pitcher is required')
    .max(100, 'Name too long'),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  eventType: z.enum(['Bullpen', 'External', 'Game', 'Practice'], {
    errorMap: () => ({ message: 'Please select an event type' }),
  }),
  pitchCount: z.number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative')
    .max(300, 'Pitch count seems unrealistic'),
  strikes: z.number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative')
    .max(300, 'Strikes cannot exceed pitch count')
    .nullable(),
  maxVelo: z.number()
    .int('Must be a whole number')
    .min(0, 'Cannot be negative')
    .max(120, 'Velocity seems unrealistic'),
  notes: z.string()
    .max(2000, 'Notes must be less than 2000 characters')
    .optional()
    .or(z.literal('')),
  videoUrl: z.string()
    .url('Please enter a valid URL')
    .max(500, 'URL too long')
    .optional()
    .or(z.literal('')),
  focus: z.string()
    .max(200, 'Focus must be less than 200 characters')
    .optional()
    .or(z.literal('')),
});

// Type exports
export type PitcherInput = z.infer<typeof pitcherSchema>;
export type OutingInput = z.infer<typeof outingSchema>;

// Validation result types
type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; error: string };

// Validation helper that returns user-friendly errors
export function validateOuting(data: unknown): ValidationSuccess<OutingInput> | ValidationFailure {
  const result = outingSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Validation failed' };
}

export function validatePitcher(data: unknown): ValidationSuccess<PitcherInput> | ValidationFailure {
  const result = pitcherSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Validation failed' };
}
