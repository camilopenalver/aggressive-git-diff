export function withOpacity(color: string, opacity: number): string {
  const alpha = clamp(opacity, 0, 1);
  const trimmed = color.trim();

  const rgba = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)$/i
  );
  if (rgba) {
    return `rgba(${Number(rgba[1])}, ${Number(rgba[2])}, ${Number(rgba[3])}, ${alpha})`;
  }

  const hex = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const { r, g, b } = hexToRgb(hex[1]);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return trimmed;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
    };
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatDeletedLabel(count: number, preview?: string): string {
  const noun = count === 1 ? "line" : "lines";
  const base = ` − ${count} deleted ${noun} `;
  if (!preview) {
    return `────────${base}────────`;
  }
  const compact = preview.replace(/\s+/g, " ").trim();
  const clipped = compact.length > 80 ? `${compact.slice(0, 77)}...` : compact;
  return `────────${base}· ${clipped} ────────`;
}
