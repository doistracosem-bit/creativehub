type ColorGroup = { count: number; red: number; green: number; blue: number };

function addColor(group: ColorGroup, color: ColorGroup) {
  group.count += color.count;
  group.red += color.red;
  group.green += color.green;
  group.blue += color.blue;
}

function isSimilar(first: ColorGroup, second: ColorGroup) {
  const red = first.red / first.count - second.red / second.count;
  const green = first.green / first.count - second.green / second.count;
  const blue = first.blue / first.count - second.blue / second.count;
  return red ** 2 + green ** 2 + blue ** 2 < 38 ** 2;
}

export function dominantColors(pixels: Uint8ClampedArray): string[] {
  const histogram = new Map<number, ColorGroup>();
  let total = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    const [red, green, blue] = [pixels[index], pixels[index + 1], pixels[index + 2]];
    const key = ((red >> 4) << 8) | ((green >> 4) << 4) | (blue >> 4);
    const color = { count: 1, red, green, blue };
    const bucket = histogram.get(key);
    if (bucket) addColor(bucket, color);
    else histogram.set(key, color);
    total++;
  }

  const groups: ColorGroup[] = [];
  const ranked = Array.from(histogram.values()).sort((a, b) => b.count - a.count);
  for (const color of ranked) {
    const group = groups.find((item) => isSimilar(item, color));
    if (group) addColor(group, color);
    else groups.push(color);
  }

  return groups.sort((a, b) => b.count - a.count)
    .filter((group) => group.count >= total * 0.015)
    .slice(0, 5)
    .map(({ count, red, green, blue }) => {
      const hex = [red, green, blue].map((channel) => Math.round(channel / count).toString(16).padStart(2, '0'));
      return `#${hex.join('').toUpperCase()}`;
    });
}
