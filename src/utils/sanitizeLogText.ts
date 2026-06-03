/** Remove emojis/símbolos que quebram no terminal Windows (CP1252). */
export function sanitizeLogText(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, ' ')
    .replace(/[\u2600-\u27BF]/gu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
