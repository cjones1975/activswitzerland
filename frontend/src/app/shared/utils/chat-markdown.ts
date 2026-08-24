/** Renders the assistant's lightweight markdown (**bold** labels, "- " bullet lists — the only two
 * things it actually uses) as real HTML instead of showing the raw asterisks/dashes. Escapes the
 * input first, so any literal `<`/`>`/`&` in the model's text can't be interpreted as markup —
 * only the `<strong>`/`<ul>`/`<li>`/`<p>` tags this function itself adds ever reach the DOM. Bound
 * via Angular's `[innerHTML]`, which sanitizes on top of this as a second layer. */
export function formatChatText(raw: string): string {
  const bolded = escapeHtml(raw).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const parts: string[] = [];
  let inList = false;
  for (const line of bolded.split('\n')) {
    const trimmed = line.trim();
    const bulletMatch = /^-\s+(.*)/.exec(trimmed);
    if (bulletMatch) {
      if (!inList) { parts.push('<ul>'); inList = true; }
      parts.push(`<li>${bulletMatch[1]}</li>`);
      continue;
    }
    if (inList) { parts.push('</ul>'); inList = false; }
    if (trimmed) parts.push(`<p>${trimmed}</p>`);
  }
  if (inList) parts.push('</ul>');

  return parts.join('');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
