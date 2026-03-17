/**
 * Shim for next/font/google — returns empty className (font loaded via CSS instead)
 */
export function Inter() {
  return { className: "" };
}

// Generic fallback for any Google font
export default function googleFont() {
  return () => ({ className: "" });
}
