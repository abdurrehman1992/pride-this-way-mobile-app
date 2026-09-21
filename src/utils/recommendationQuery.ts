export function buildRecommendationQueryKey(
  location: string,
  prefs: string[],
): string {
  const normalizedLocation = (location || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  const normalizedPrefs = Array.from(
    new Set(
      (prefs || [])
        .map(pref => String(pref).trim().toLowerCase())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  if (!normalizedLocation && normalizedPrefs.length === 0) {
    return '';
  }

  return `${normalizedLocation}|${normalizedPrefs.join(',')}`;
}
