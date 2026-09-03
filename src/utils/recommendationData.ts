export function isGenericRecommendationTitle(title: string): boolean {
  const value = `${title || ''}`.trim().toLowerCase();
  if (!value) return true;

  return [
    'local landmark',
    'city food spot',
    'popular viewpoint',
    'signature dining',
    'local heritage stop',
    'city night spot',
    'boutique cafe',
    'scenic walk',
    'landmark city',
    'restaurant city',
    'heritage city',
    'night city',
    'cafe city',
    'walking city',
  ].some(pattern => value.includes(pattern));
}

export function buildExactImageKeyword(
  title: string,
  location?: string,
  category?: string,
  fallbackKeyword?: string,
): string {
  const cleanTitle = `${title || ''}`.trim();
  const cleanLocation = `${location || ''}`.trim();
  const cleanCategory = `${category || ''}`.trim();
  const cleanFallback = `${fallbackKeyword || ''}`.trim();

  const base = cleanTitle || cleanFallback || cleanCategory || 'travel';
  const locationPart = cleanLocation && !base.toLowerCase().includes(cleanLocation.toLowerCase())
    ? ` ${cleanLocation}`
    : '';
  const categoryPart = cleanCategory && cleanCategory.toLowerCase() !== 'restaurant' && !base.toLowerCase().includes(cleanCategory.toLowerCase())
    ? ` ${cleanCategory}`
    : '';

  return `${base}${locationPart}${categoryPart}`
    .replace(/\s+/g, ' ')
    .trim();
}
