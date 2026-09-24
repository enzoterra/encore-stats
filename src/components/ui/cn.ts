/** Junta classes condicionais (sem dependência extra; os tokens já evitam conflitos). */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
