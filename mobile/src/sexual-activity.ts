export const sexualActivityOptions = [
  ["protected", "დაცული", "Protected"],
  ["unprotected", "დაუცველი", "Unprotected"],
  ["unspecified", "დაცვას არ მივუთითებ", "Prefer not to specify protection"],
] as const;

export type SexualActivity = (typeof sexualActivityOptions)[number][0];

export function isSexualActivity(value: unknown): value is SexualActivity {
  return sexualActivityOptions.some(([id]) => id === value);
}

export function validOptionalSexualActivity(value: unknown) {
  return value === undefined || isSexualActivity(value);
}
