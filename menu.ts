// Pure menu-string parsing, shared by agent.ts (system prompt) and the admin
// config validation route. Kept dependency-free so it can be unit tested
// without booting the rest of the app.

export function parseMenuItems(raw: string): { name: string; description: string }[] {
  const entries: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "(") depth++;
    else if (raw[i] === ")") depth--;
    else if (raw[i] === "," && depth === 0) {
      entries.push(raw.slice(start, i).trim());
      start = i + 1;
    }
  }
  entries.push(raw.slice(start).trim());
  return entries
    .map((entry) => {
      const p = entry.indexOf("(");
      return p === -1
        ? { name: entry, description: "" }
        : {
          name: entry.slice(0, p).trim(),
          description: entry.slice(p + 1, entry.lastIndexOf(")")).trim(),
        };
    })
    .filter((i) => i.name);
}

// Mirrors the parsing above but rejects malformed input instead of silently
// dropping it — used to validate admin-submitted MENU_ITEMS before it's saved.
export function validateMenuItems(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Menu items cannot be empty.";
  let depth = 0;
  for (const ch of trimmed) {
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth < 0) return "Unmatched ')' in menu items.";
    }
  }
  if (depth !== 0) return "Unmatched '(' in menu items.";
  const items = parseMenuItems(trimmed);
  if (!items.length) return "Menu items cannot be empty.";
  for (const item of items) {
    if (/[()]/.test(item.name)) return `Invalid menu item name: "${item.name}".`;
  }
  return null;
}
