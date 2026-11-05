/** True when partner-authored policy has visible text (ignores empty HTML shells). */
export function hasDiningPolicyContent(value?: string | null): boolean {
  const text = String(value || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0;
}

/** Basic sanitize for partner policy HTML shown on the customer site. */
export function sanitizeDiningPolicyHtml(value?: string | null): string {
  if (!hasDiningPolicyContent(value)) return "";
  let html = String(value || "");
  // Plain text (legacy line-per-point) → bullets
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    const lines = html
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return "";
    return `<ul>${lines.map((line) => `<li>${escapeText(line)}</li>`).join("")}</ul>`;
  }
  html = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
  return html.trim();
}

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
