export const OUTFIT_CODE_PATTERN = /^[A-Z0-9]{3,12}$/;

export function normalizeOutfitCode(value: string): string {
  return value.trim().toUpperCase().replace(/^#+/, "").replace(/\s+/g, "");
}

export function isValidOutfitCode(value: string): boolean {
  const normalizedCode = normalizeOutfitCode(value);
  return OUTFIT_CODE_PATTERN.test(normalizedCode);
}

export function formatOutfitCode(value: string): string {
  const normalizedCode = normalizeOutfitCode(value);
  return normalizedCode ? `#${normalizedCode}` : "";
}

export function formatInputCode(value: string): string {
  if (value === "") return "";
  const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  return `#${clean}`;
}
