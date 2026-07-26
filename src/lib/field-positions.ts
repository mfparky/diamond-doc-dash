/** Standard youth baseball fielding positions, in defensive-spectrum order. */
export const FIELD_POSITIONS = [
  { value: 'P', label: 'Pitcher' },
  { value: 'C', label: 'Catcher' },
  { value: '1B', label: 'First Base' },
  { value: '2B', label: 'Second Base' },
  { value: '3B', label: 'Third Base' },
  { value: 'SS', label: 'Shortstop' },
  { value: 'LF', label: 'Left Field' },
  { value: 'CF', label: 'Center Field' },
  { value: 'RF', label: 'Right Field' },
] as const;

export type FieldPosition = (typeof FIELD_POSITIONS)[number]['value'];

export function positionLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return FIELD_POSITIONS.find((p) => p.value === value)?.label ?? value;
}
