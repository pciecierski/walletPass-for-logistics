import sharp from "sharp";

/** Generate minimal square PNG assets for Apple Wallet packages. */
export async function generatePassImages(bgHex: string, accentHex: string): Promise<{
  icon: Buffer;
  logo: Buffer;
  strip?: Buffer;
}> {
  const bg = normalizeHex(bgHex) || "#0B3D2E";
  const accent = normalizeHex(accentHex) || "#F4EFE6";

  const iconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="58" height="58">
      <rect width="58" height="58" rx="12" fill="${bg}"/>
      <circle cx="29" cy="29" r="14" fill="none" stroke="${accent}" stroke-width="3"/>
      <path d="M29 18 v22 M18 29 h22" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>
    </svg>`;

  const logoSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="50">
      <rect width="160" height="50" rx="8" fill="${bg}"/>
      <text x="20" y="33" font-family="Georgia, serif" font-size="20" fill="${accent}">Pass</text>
    </svg>`;

  const stripSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="375" height="123">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg}"/>
          <stop offset="100%" stop-color="${shade(bg, -20)}"/>
        </linearGradient>
      </defs>
      <rect width="375" height="123" fill="url(#g)"/>
      <circle cx="320" cy="30" r="60" fill="${accent}" fill-opacity="0.08"/>
      <circle cx="40" cy="100" r="40" fill="${accent}" fill-opacity="0.06"/>
    </svg>`;

  const [icon, logo, strip] = await Promise.all([
    sharp(Buffer.from(iconSvg)).png().toBuffer(),
    sharp(Buffer.from(logoSvg)).png().toBuffer(),
    sharp(Buffer.from(stripSvg)).png().toBuffer(),
  ]);

  return { icon, logo, strip };
}

function normalizeHex(value?: string): string | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toUpperCase()}`;
  return undefined;
}

function shade(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(2.55 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + Math.round(2.55 * percent)));
  const b = Math.min(255, Math.max(0, (num & 0xff) + Math.round(2.55 * percent)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

export function cssColorToRgb(hex: string): string {
  const n = normalizeHex(hex) || "#000000";
  const num = parseInt(n.slice(1), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgb(${r}, ${g}, ${b})`;
}
