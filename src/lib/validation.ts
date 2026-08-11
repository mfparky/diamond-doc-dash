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
  eventType: z.enum(['Bullpen', 'External', 'Game', 'Live ABs'], {
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
  videoUrl1: z.string()
    .url('Please enter a valid URL')
    .max(500, 'URL too long')
    .optional()
    .or(z.literal('')),
  focus: z.string()
    .max(200, 'Focus must be less than 200 characters')
    .optional()
    .or(z.literal('')),
});

// Pitch location validation schema — one charted pitch
export const pitchLocationSchema = z.object({
  pitchNumber: z.number().int('Must be a whole number').min(1).max(300),
  pitchType: z.number().int('Must be a whole number').min(1).max(10),
  xLocation: z.number().finite().min(-10).max(10),
  yLocation: z.number().finite().min(-10).max(10),
  isStrike: z.boolean(),
});

// Workout assignment validation schema
export const workoutAssignmentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').nullable().optional(),
  frequency: z.number().int('Must be a whole number').min(1).max(7).optional(),
  attachmentUrl: z.string().url('Please enter a valid URL').max(1000).nullable().optional().or(z.literal('')),
});

// Workout completion note validation schema
export const workoutCompletionSchema = z.object({
  dayOfWeek: z.number().int('Must be a whole number').min(0).max(6),
  notes: z.string().max(1000, 'Notes must be less than 1000 characters').nullable().optional(),
});

// Type exports
export type PitcherInput = z.infer<typeof pitcherSchema>;
export type OutingInput = z.infer<typeof outingSchema>;
export type PitchLocationInput = z.infer<typeof pitchLocationSchema>;
export type WorkoutAssignmentInput = z.infer<typeof workoutAssignmentSchema>;
export type WorkoutCompletionInput = z.infer<typeof workoutCompletionSchema>;


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

export function validatePitchLocations(
  data: unknown[],
): ValidationSuccess<PitchLocationInput[]> | ValidationFailure {
  const result = z.array(pitchLocationSchema).min(1, 'No pitches to save').safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Invalid pitch data' };
}

export function validateWorkoutAssignment(
  data: unknown,
): ValidationSuccess<WorkoutAssignmentInput> | ValidationFailure {
  const result = workoutAssignmentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Validation failed' };
}

export function validateWorkoutCompletion(
  data: unknown,
): ValidationSuccess<WorkoutCompletionInput> | ValidationFailure {
  const result = workoutCompletionSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.errors[0]?.message || 'Validation failed' };
}

