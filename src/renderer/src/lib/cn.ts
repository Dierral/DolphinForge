/** Тонкий помощник для склейки классов Tailwind. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
