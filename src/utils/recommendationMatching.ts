type TagReference = {
  id: string;
  name: string;
};

const normalizeMatchingValue = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .replace(/[,\-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Firestore data can contain either a tag document id or its display name.
 * Resolve both forms to the same key so route and event recommendations use
 * identical tag matching.
 */
export const createCanonicalTagResolver = (tags: TagReference[]) => {
  const aliases = new Map<string, string>();

  tags.forEach((tag) => {
    const canonicalId = normalizeMatchingValue(tag.id);
    if (!canonicalId) return;

    aliases.set(canonicalId, canonicalId);

    const normalizedName = normalizeMatchingValue(tag.name);
    if (normalizedName) {
      aliases.set(normalizedName, canonicalId);
    }
  });

  return (value?: string | null) => {
    const normalized = normalizeMatchingValue(value);
    return normalized ? aliases.get(normalized) || normalized : '';
  };
};

/** A selected city is authoritative; sharing a country is not a city match. */
export const matchesSelectedCity = (
  locationLabel: string,
  candidateCity?: string | null
) => {
  const requestedCity = normalizeMatchingValue(locationLabel.split(',')[0]);
  if (!requestedCity) {
    return true;
  }

  return normalizeMatchingValue(candidateCity) === requestedCity;
};
