import Config from 'react-native-config';

export type PlaceSuggestion = {
    id: string;
    placeName: string;
    title: string;
    subtitle: string;
    country: string;
    countryCode: string;
    coordinates: [number, number];
    placeTypes: string[];
};

type MapboxContext = {
    id: string;
    text: string;
    short_code?: string;
};

type MapboxFeature = {
    id: string;
    text: string;
    place_name: string;
    place_type?: string[];
    relevance?: number;
    center?: [number, number];
    context?: MapboxContext[];
    properties?: { short_code?: string };
};

const TYPES_PRECISE =
    'poi,address,neighborhood,locality,district,postcode,place';

const TYPES_FULL =
    'country,region,district,postcode,place,locality,neighborhood,address,poi';

/** First parts of common multi-word place names (English). */
const MULTI_FIRST = new Set([
    'new',
    'st',
    'saint',
    'los',
    'san',
    'el',
    'fort',
    'lake',
    'mount',
    'port',
    'little',
    'bad',
    'cape',
    'rio',
]);

/** Last token is a weak city name alone — pair with previous token. */
const GENERIC_PLACE_TAIL = new Set([
    'town',
    'city',
    'metro',
    'area',
    'district',
    'location',
    'center',
    'centre',
    'market',
    'road',
    'street',
    'st',
    'avenue',
    'lane',
    'park',
    'square',
]);

/** Unlikely to be a city / locality anchor on its own. */
const NON_CITY_TAIL = new Set([
    'pizza',
    'pasta',
    'burger',
    'coffee',
    'restaurant',
    'cafe',
    'bar',
    'hotel',
    'shop',
    'store',
    'mall',
    'food',
]);

function parseCountryFromContext(
    feature: MapboxFeature
): { country: string; countryCode: string } {
    let country = '';
    let countryCode = '';

    if (feature.context?.length) {
        for (const ctx of feature.context) {
            if (ctx.id.startsWith('country.')) {
                country = ctx.text;
                countryCode = (ctx.short_code || '').toUpperCase();
                break;
            }
        }
    }

    if (!country && feature.place_type?.includes('country')) {
        country = feature.text;
        countryCode = (
            feature.properties?.short_code || ''
        ).toUpperCase();
    }

    return { country, countryCode };
}

function buildLines(
    feature: MapboxFeature,
    country: string
): { title: string; subtitle: string } {
    const parts = feature.place_name
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const types = feature.place_type || [];

    if (types.includes('poi') || types.includes('address')) {
        const title = (feature.text || parts[0] || '').trim();
        let rest = title
            ? feature.place_name
                .replace(
                    new RegExp(`^${escapeReg(title)}\\s*,?\\s*`),
                    ''
                )
                .trim()
            : '';
        if (!rest) {
            rest = parts.slice(1).join(', ');
        }
        const subtitle =
            rest || (country ? country : '');
        return { title, subtitle };
    }

    const title = parts[0] || feature.text;
    const subtitle = parts.slice(1).join(', ');
    return { title, subtitle };
}

function escapeReg(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function featureToSuggestion(
    feature: MapboxFeature
): PlaceSuggestion | null {
    if (!feature.center || feature.center.length < 2) {
        return null;
    }

    const [lng, lat] = feature.center;
    const { country, countryCode } = parseCountryFromContext(feature);
    const { title, subtitle } = buildLines(feature, country);
    const placeTypes = feature.place_type || [];

    return {
        id: feature.id,
        placeName: feature.place_name,
        title: title || feature.text,
        subtitle,
        country,
        countryCode,
        coordinates: [lng, lat],
        placeTypes,
    };
}

function tokenizeQuery(q: string): string[] {
    const lower = q.toLowerCase().trim();
    return lower
        .split(/[\s,]+/)
        .map((t) => t.replace(/^\.+|\.+$/g, ''))
        .filter((t) => t.length > 0);
}

function meaningfulTokens(tokens: string[]): string[] {
    const stop = new Set([
        'the',
        'of',
        'and',
        'in',
        'at',
        'near',
        'a',
        'an',
    ]);
    const m = tokens.filter((t) => !stop.has(t));
    return m.length ? m : tokens;
}

/**
 * Heuristic: trailing segment user is using as a city / locality anchor
 * (e.g. "lahore" in "GPO location lahore", "johar town" in "block j johar town").
 */
function trailingPlaceQuery(tokens: string[]): string | undefined {
    if (tokens.length < 2) {
        return undefined;
    }
    const n = tokens.length;
    const last = tokens[n - 1];
    const prev = tokens[n - 2];

    if (MULTI_FIRST.has(prev)) {
        return `${prev} ${last}`;
    }
    if (GENERIC_PLACE_TAIL.has(last) && n >= 3) {
        return `${prev} ${last}`;
    }
    if (NON_CITY_TAIL.has(last)) {
        return undefined;
    }
    if (last.length >= 4 && !GENERIC_PLACE_TAIL.has(last)) {
        return last;
    }
    if (n >= 3) {
        const two = `${prev} ${last}`;
        if (two.replace(/\s/g, '').length >= 5) {
            return two;
        }
    }
    return undefined;
}
function prefixTokensForTrailing(
    tokens: string[],
    trailingPhrase: string
): string | undefined {
    const trailToks = trailingPhrase.toLowerCase().split(/\s+/);
    if (tokens.length <= trailToks.length) {
        return undefined;
    }
    const tail = tokens.slice(-trailToks.length).join(' ').toLowerCase();
    if (tail !== trailingPhrase.toLowerCase()) {
        return undefined;
    }
    const prefix = tokens
        .slice(0, tokens.length - trailToks.length)
        .join(' ')
        .trim();
    return prefix.length >= 2 ? prefix : undefined;
}

function haversineKm(
    lon1: number,
    lat1: number,
    lon2: number,
    lat2: number
): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/** Mapbox bbox: west, south, east, north */
function bboxAroundPointKm(
    lng: number,
    lat: number,
    halfWidthKm: number
): [number, number, number, number] {
    const latDelta = halfWidthKm / 111;
    const cosLat = Math.max(
        0.25,
        Math.cos((lat * Math.PI) / 180)
    );
    const lngDelta = halfWidthKm / (111 * cosLat);
    return [
        lng - lngDelta,
        lat - latDelta,
        lng + lngDelta,
        lat + latDelta,
    ];
}

function rankFeatures(
    query: string,
    features: MapboxFeature[],
    biasCenter?: [number, number]
): MapboxFeature[] {
    const tokens = meaningfulTokens(tokenizeQuery(query));
    const multi = tokens.length >= 2;

    const scored = features.map((f) => {
        const hay = `${f.place_name} ${f.text}`.toLowerCase();
        let score = (f.relevance ?? 0) * 25;
        const types = f.place_type || [];

        for (const t of tokens) {
            if (t.length >= 2 && hay.includes(t)) {
                score += 14;
            }
        }

        if (
            tokens.length > 0 &&
            tokens.every((t) => hay.includes(t))
        ) {
            score += 45;
        }

        if (multi) {
            if (types.includes('poi')) {
                score += 18;
            }
            if (types.includes('address')) {
                score += 16;
            }
            if (
                types.some((x) =>
                    ['neighborhood', 'locality'].includes(x)
                )
            ) {
                score += 12;
            }
            if (types.includes('district')) {
                score += 8;
            }
            if (types.includes('place')) {
                score += 4;
            }
            if (types.includes('postcode')) {
                score += 6;
            }
            if (types.includes('region')) {
                score -= 12;
            }
            if (types.includes('country')) {
                score -= 35;
            }
        }

        if (
            biasCenter &&
            f.center &&
            f.center.length >= 2
        ) {
            const d = haversineKm(
                biasCenter[0],
                biasCenter[1],
                f.center[0],
                f.center[1]
            );
            score += Math.max(0, 28 - d / 4);
        }

        return { f, score };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .map((x) => x.f);
}

function isAbortError(e: unknown): boolean {
    if (!(e instanceof Error)) {
        return false;
    }
    return (
        e.name === 'AbortError' ||
        e.message === 'Aborted' ||
        e.message.includes('Aborted')
    );
}

function dedupeById(features: MapboxFeature[]): MapboxFeature[] {
    const seen = new Set<string>();
    const out: MapboxFeature[] = [];
    for (const f of features) {
        if (seen.has(f.id)) {
            continue;
        }
        seen.add(f.id);
        out.push(f);
    }
    return out;
}

async function fetchGeocodeFeatures(
    query: string,
    types: string,
    options: {
        signal?: AbortSignal;
        proximity?: [number, number];
        bbox?: [number, number, number, number];
        country?: string;
        limit: number;
    }
): Promise<MapboxFeature[]> {
    const token = Config.MAPBOX_TOKEN;
    if (!token) {
        return [];
    }

    const params = new URLSearchParams({
        access_token: token,
        autocomplete: 'true',
        limit: String(options.limit),
        language: 'en',
        fuzzyMatch: 'true',
        types,
    });

    if (options.proximity) {
        params.set(
            'proximity',
            `${options.proximity[0]},${options.proximity[1]}`
        );
    }

    if (options.bbox) {
        const [w, s, e, n] = options.bbox;
        params.set('bbox', `${w},${s},${e},${n}`);
    }

    if (options.country) {
        params.set('country', options.country);
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        query.trim()
    )}.json?${params.toString()}`;

    try {
        const response = await fetch(url, {
            signal: options.signal,
        });
        const data = await response.json();

        if (!response.ok) {
            if (__DEV__) {
                console.warn(
                    'Mapbox geocoding error:',
                    data?.message || response.status
                );
            }
            return [];
        }

        return data?.features || [];
    } catch (e: unknown) {
        if (isAbortError(e)) {
            return [];
        }
        throw e;
    }
}

type Anchor = { lng: number; lat: number; placeQuery: string };

async function resolveAnchorFromPlaceName(
    placeQuery: string,
    options: {
        signal?: AbortSignal;
        userProximity?: [number, number];
        country?: string;
    }
): Promise<Anchor | undefined> {
    const feats = await fetchGeocodeFeatures(
        placeQuery,
        'place,locality',
        {
            signal: options.signal,
            proximity: options.userProximity,
            country: options.country,
            limit: 6,
        }
    );
    const ranked = [...feats].sort(
        (a, b) => (b.relevance ?? 0) - (a.relevance ?? 0)
    );
    const pick =
        ranked.find((f) => f.place_type?.includes('place')) ||
        ranked.find((f) => f.place_type?.includes('locality')) ||
        ranked[0];
    if (!pick?.center || pick.center.length < 2) {
        return undefined;
    }
    return {
        lng: pick.center[0],
        lat: pick.center[1],
        placeQuery,
    };
}

export type SearchPlacesOptions = {
    signal?: AbortSignal;
    /** Mapbox `proximity` lng,lat — biases ranking (device / map center). */
    proximity?: [number, number];
    /**
     * Limit suggestions to a visible map region: west, south, east, north
     * (Mapbox bbox). POIs inside the city show up when the map is zoomed in.
     */
    bbox?: [number, number, number, number];
    /** Comma-separated ISO 3166-1 alpha-2 (e.g. `pk` or `pk,in`). */
    countries?: string;
    limit?: number;
    /**
     * When the query ends with a place name ("… lahore"), resolve that place,
     * bias proximity to it, and run a second search for the leading text
     * inside a bbox around that place (inner-city POIs / addresses).
     * @default true
     */
    anchorInnerCity?: boolean;
};

/**
 * Forward geocode worldwide. Multi-word queries merge precise + broad types,
 * re-rank, and optionally anchor on a trailing city name for local POI search.
 */
export async function searchPlaceSuggestions(
    query: string,
    options: SearchPlacesOptions = {}
): Promise<PlaceSuggestion[]> {
    const q = query.trim();
    if (q.length < 2) {
        return [];
    }

    if (!Config.MAPBOX_TOKEN) {
        if (__DEV__) {
            console.warn('MAPBOX_TOKEN is missing');
        }
        return [];
    }

    const cap = Math.min(
        Math.max(options.limit ?? 12, 1),
        15
    );

    const anchorInnerCity = options.anchorInnerCity !== false;
    const tokens = tokenizeQuery(q);
    const meaningful = meaningfulTokens(tokens);
    const multi = meaningful.length >= 2;

    const trailing = anchorInnerCity
        ? trailingPlaceQuery(meaningful)
        : undefined;

    try {
        let anchor: Anchor | undefined;
        if (trailing) {
            anchor = await resolveAnchorFromPlaceName(trailing, {
                signal: options.signal,
                userProximity: options.proximity,
                country: options.countries,
            });
        }

        const proximityMain: [number, number] | undefined = anchor
            ? [anchor.lng, anchor.lat]
            : options.proximity;

        const sharedFetch = {
            signal: options.signal,
            proximity: proximityMain,
            bbox: options.bbox,
            country: options.countries,
        };

        let merged: MapboxFeature[] = [];

        if (multi) {
            const [precise, broad] = await Promise.all([
                fetchGeocodeFeatures(q, TYPES_PRECISE, {
                    ...sharedFetch,
                    limit: Math.min(cap, 10),
                }),
                fetchGeocodeFeatures(q, TYPES_FULL, {
                    ...sharedFetch,
                    limit: Math.min(cap, 8),
                }),
            ]);
            merged = dedupeById([...precise, ...broad]);
        } else {
            merged = await fetchGeocodeFeatures(q, TYPES_FULL, {
                ...sharedFetch,
                limit: cap,
            });
        }

        if (anchorInnerCity && anchor && trailing) {
            const prefix = prefixTokensForTrailing(
                meaningful,
                trailing
            );
            if (prefix && prefix.length >= 2) {
                const localBbox = bboxAroundPointKm(
                    anchor.lng,
                    anchor.lat,
                    42
                );
                const localFeats = await fetchGeocodeFeatures(
                    prefix,
                    TYPES_PRECISE,
                    {
                        signal: options.signal,
                        proximity: [anchor.lng, anchor.lat],
                        bbox: localBbox,
                        limit: Math.min(cap, 10),
                    }
                );
                merged = dedupeById([...localFeats, ...merged]);
            }
        }

        const ranked = rankFeatures(
            q,
            merged,
            proximityMain
        );
        const out: PlaceSuggestion[] = [];

        for (const f of ranked) {
            if (out.length >= cap) {
                break;
            }
            const s = featureToSuggestion(f);
            if (s) {
                out.push(s);
            }
        }

        return out;
    } catch (e: unknown) {
        if (isAbortError(e)) {
            return [];
        }
        if (__DEV__) {
            console.warn('MAPBOX SEARCH ERROR:', e);
        }
        return [];
    }
}
