const normalizeText = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .replace(/[,_/\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const locationMatches = (
  locationLabel: string,
  city?: string,
  country?: string
) => {
  const normalizedLocation = normalizeText(locationLabel);
  if (!normalizedLocation) {
    return true;
  }

  const cityValue = normalizeText(city);
  const countryValue = normalizeText(country);
  const locationSegments = normalizedLocation
    .split(',')
    .map((segment) => normalizeText(segment))
    .filter(Boolean);

  const hasExplicitCity = Boolean(cityValue) && locationSegments.some((segment) => {
    return segment === cityValue || normalizedLocation.includes(cityValue);
  });

  if (hasExplicitCity) {
    return locationSegments.some((segment) => segment === cityValue) || normalizedLocation.includes(cityValue);
  }

  if (!cityValue && countryValue) {
    return locationSegments.some((segment) => segment === countryValue) || normalizedLocation.includes(countryValue);
  }

  if (cityValue) {
    return false;
  }

  return false;
};
