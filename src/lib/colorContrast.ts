const channels = (hex: string) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);

export const relativeLuminance = (hex: string) => {
  const [red, green, blue] = channels(hex).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

export const contrastRatio = (first: string, second: string) => {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Black or white always reaches WCAG AA (4.5:1) against an opaque sRGB color. */
export const readableTextColor = (background: string) =>
  contrastRatio('#ffffff', background) >= 4.5 ? '#ffffff' : '#000000';

const mix = (first: string, second: string, amount: number) =>
  `#${[1, 3, 5].map((index) => Math.round(Number.parseInt(first.slice(index, index + 2), 16) * (1 - amount) + Number.parseInt(second.slice(index, index + 2), 16) * amount).toString(16).padStart(2, '0')).join('')}`;

/** Keep the selected hue when possible, adjusting only text usage to reach 4.5:1. */
export const readableAccentColor = (accent: string, background: string) => {
  if (contrastRatio(accent, background) >= 4.5) return accent;
  const target = readableTextColor(background);
  let low = 0;
  let high = 1;
  for (let step = 0; step < 16; step += 1) {
    const middle = (low + high) / 2;
    if (contrastRatio(mix(accent, target, middle), background) >= 4.5) high = middle;
    else low = middle;
  }
  return mix(accent, target, high);
};
