import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { GEMINI_API_KEY, GEMINI_TOKEN, GEMINI_ENDPOINT } from '@env';
import { buildExactImageKeyword, isGenericRecommendationTitle } from '../utils/recommendationData';
import { checkInternetConnection } from '../utils/networkStatus';
import { RECOMMENDED_IMAGE } from '../constants/images';

export type AIPlace = {
  id: string;
  title: string;
  description: string;
  rating: string;
  category: string;
  imageKeyword: string;
  imageUrl?: string;
  fallbackImageUrl?: string;
  location?: string;
  city?: string;
  address?: string;
  about?: string;
  highlights?: string[];
  reviews?: Array<{
    author: string;
    location: string;
    rating: string;
    comment: string;
    avatar?: string;
  }>;
  gallery?: string[];
  distance?: string;
  openText?: string;
  isOpen?: boolean;
};

export type AIRecommendations = {
  placesAroundYou: AIPlace[];
  recommendedForYou: AIPlace[];
};

// Google Generative Language endpoints
const GEMINI_BASE_V1 = 'https://generativelanguage.googleapis.com/v1';
const GEMINI_BASE_V1BETA = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_DEFAULT_MODEL = 'gemini-3.1-flash-lite';
// Image Search is only available on Gemini's image-capable model. Keep this
// separate from the lightweight text model used to generate recommendations.
const GEMINI_IMAGE_SEARCH_MODEL = 'gemini-3.1-flash-image';
const GEMINI_URL = `${GEMINI_BASE_V1BETA}/models/${GEMINI_DEFAULT_MODEL}:generateContent`;
const RECS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOC_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const POPULAR_CITIES_KEY = 'loc:popular';
const placeImageLookupCache = new Map<string, Promise<string | undefined>>();

const FALLBACK_POPULAR_CITIES = [
  'San Diego, CA',
  'San Jose, CA',
  'Fresno, CA',
  'Los Angeles, CA',
  'San Francisco, CA',
  'New York, NY',
  'Chicago, IL',
  'Austin, TX',
];

const FALLBACK_RECOMMENDATIONS: AIRecommendations = {
  placesAroundYou: [
    {
      id: 'fallback_place_1',
      title: 'Beach Party',
      description: 'Fun night at the beach with music and food',
      rating: '4.5',
      category: 'Event',
      imageKeyword: 'beach party night',
    },
    {
      id: 'fallback_place_2',
      title: 'Music Night',
      description: 'Live band performance downtown',
      rating: '4.7',
      category: 'Music',
      imageKeyword: 'live music concert',
    },
    {
      id: 'fallback_place_3',
      title: 'Food Festival',
      description: 'Street food event with local cuisines',
      rating: '4.8',
      category: 'Food',
      imageKeyword: 'street food festival',
    },
  ],
  recommendedForYou: [
    {
      id: 'fallback_rec_1',
      title: 'Skyline Rooftop Dining',
      description: 'Enjoy food with stunning city views',
      rating: '4.7',
      category: 'Restaurant',
      imageKeyword: 'rooftop dining sunset',
    },
    {
      id: 'fallback_rec_2',
      title: 'Jazz Night',
      description: 'Live jazz experience in the city',
      rating: '4.6',
      category: 'Music',
      imageKeyword: 'jazz bar night',
    },
    {
      id: 'fallback_rec_3',
      title: 'Mountain Hiking',
      description: 'Adventure in the hills nearby',
      rating: '4.8',
      category: 'Adventure',
      imageKeyword: 'mountain hiking trail',
    },
    {
      id: 'fallback_rec_4',
      title: 'City Museum Tour',
      description: 'Explore history and culture',
      rating: '4.5',
      category: 'History',
      imageKeyword: 'museum interior',
    },
    {
      id: 'fallback_rec_5',
      title: 'Shopping District',
      description: 'Best brands and local deals',
      rating: '4.4',
      category: 'Shopping',
      imageKeyword: 'shopping street',
    },
  ],
};

const FALLBACK_PLACES: AIPlace[] = [
  {
    id: 'fb_addloc_1',
    title: 'Central Park',
    description: 'Iconic urban park with trails and lakes',
    rating: '4.8',
    category: 'Park',
    imageKeyword: 'central park new york',
  },
  {
    id: 'fb_addloc_2',
    title: 'Pike Place Market',
    description: 'Historic public market with fresh food',
    rating: '4.7',
    category: 'Market',
    imageKeyword: 'pike place market',
  },
  {
    id: 'fb_addloc_3',
    title: 'Times Square',
    description: 'World-famous commercial and entertainment hub',
    rating: '4.6',
    category: 'Landmark',
    imageKeyword: 'times square lights',
  },
  {
    id: 'fb_addloc_4',
    title: 'Santa Monica Pier',
    description: 'Historic oceanfront pier with rides and food',
    rating: '4.7',
    category: 'Attraction',
    imageKeyword: 'santa monica pier',
  },
  {
    id: 'fb_addloc_5',
    title: 'Bryant Park',
    description: 'Popular Midtown park with gardens and seating',
    rating: '4.5',
    category: 'Park',
    imageKeyword: 'bryant park',
  },
];

// Timestamp (ms) when the last Gemini quota error occurred. 0 = none.
let lastQuotaExceeded = 0;

export function getLastQuotaExceededTimestamp(): number {
  return lastQuotaExceeded;
}

export function clearLastQuotaExceeded(): void {
  lastQuotaExceeded = 0;
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeText(value?: string | null): string {
  return (value || '')
    .toLowerCase()
    .replace(/[,_/\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function recsCacheKey(location: string, prefs: string[]): string {
  const normalized =
    'recs|' + location.toLowerCase().trim() + '|' + [...prefs].sort().join(',');
  return `recs:${simpleHash(normalized)}`;
}

function buildCuratedRecommendations(location: string, prefs: string[]): AIRecommendations {
  const isLahore = /lahore/i.test(location);
  const restaurantTags = prefs.some((p) => /restaurant|food|cafe|dining/i.test(p));

  const lahorePlacesAroundYou: AIPlace[] = [
    {
      id: 'lahore-butt-karahi',
      title: 'Butt Karahi',
      description: 'Famous spicy karahi and grilled classics.',
      rating: '4.8',
      category: 'Restaurant',
      imageKeyword: 'butt karahi lahore',
      location: 'Lahore, Pakistan',
      address: 'Lahore',
      about: 'A classic Lahore karahi spot known for rich gravies, fresh naan, and a lively local atmosphere.',
      highlights: ['Rich karahi', 'Lahore favorite', 'Late-night vibe'],
      reviews: [{ author: 'Ayesha', location: 'Lahore', rating: '4.8', comment: 'The karahi here is legendary.' }],
      gallery: ['butt karahi lahore', 'karahi lahore food', 'lahore restaurant'],
      distance: '2.3 km away',
      openText: 'Open • Closes 11:00 PM',
      isOpen: true,
    },
    {
      id: 'lahore-fortress',
      title: 'Lahore Fort',
      description: 'Historic Mughal architecture and cultural heritage.',
      rating: '4.7',
      category: 'Heritage',
      imageKeyword: 'lahore fort',
      location: 'Lahore, Pakistan',
      address: 'Fort Road',
      about: 'One of Lahore’s most important historical sites, filled with Mughal-era architecture and living history.',
      highlights: ['Historic architecture', 'Cultural heritage', 'Iconic views'],
      reviews: [{ author: 'Uzair', location: 'Lahore', rating: '4.7', comment: 'Beautiful place with rich history.' }],
      gallery: ['lahore fort', 'mughal architecture', 'fort road lahore'],
      distance: '5.1 km away',
      openText: 'Open • Closes 6:00 PM',
      isOpen: true,
    },
    {
      id: 'lahore-badshahi',
      title: 'Badshahi Mosque',
      description: 'Grand marble mosque with iconic architecture.',
      rating: '4.9',
      category: 'Landmark',
      imageKeyword: 'badshahi mosque lahore',
      location: 'Lahore, Pakistan',
      address: 'Lahore City',
      about: 'A striking Mughal-era mosque known for its grand scale, marble detail, and evening atmosphere.',
      highlights: ['Grand architecture', 'Historic landmark', 'Evening light'],
      reviews: [{ author: 'Hassan', location: 'Karachi', rating: '4.9', comment: 'A masterpiece of Mughal design.' }],
      gallery: ['badshahi mosque lahore', 'mughal mosque', 'lahore architecture'],
      distance: '3.6 km away',
      openText: 'Open • Closes 8:00 PM',
      isOpen: true,
    },
  ];

  const lahoreRecommended: AIPlace[] = [
    {
      id: 'lahore-monal',
      title: 'Monal Lahore',
      description: 'Iconic dining experience on the top floor of Park Tower.',
      rating: '4.7',
      category: 'Restaurant',
      imageKeyword: 'monal lahore',
      location: 'Lahore, Pakistan',
      address: 'Park Tower',
      about: 'A well-known rooftop restaurant with city views, elegant interiors, and a premium dining experience.',
      highlights: ['City view', 'Premium dining', 'Rooftop vibe'],
      reviews: [{ author: 'Nadia', location: 'Lahore', rating: '4.7', comment: 'Perfect for dinners and special occasions.' }],
      gallery: ['monal lahore', 'lahore rooftop restaurant', 'park tower lahore'],
      distance: '4.2 km away',
      openText: 'Open • Closes 11:00 PM',
      isOpen: true,
    },
    {
      id: 'lahore-noori',
      title: 'Noori Restaurant',
      description: 'Classic Lahore dining with grilled favorites and local flavors.',
      rating: '4.5',
      category: 'Restaurant',
      imageKeyword: 'noori restaurant lahore',
      location: 'Lahore, Pakistan',
      address: 'Gulberg',
      about: 'Popular for hearty meals and a comfortable family dining setting in the city center.',
      highlights: ['Family dining', 'Local classics', 'Comfort food'],
      reviews: [{ author: 'Bilal', location: 'Lahore', rating: '4.5', comment: 'Always a good option for a relaxed dinner.' }],
      gallery: ['noori restaurant lahore', 'lahore dining', 'gulberg restaurant'],
      distance: '3.0 km away',
      openText: 'Open • Closes 10:30 PM',
      isOpen: true,
    },
    {
      id: 'lahore-ramada',
      title: 'Ramada Lahore',
      description: 'Elegant dining and hotel ambiance in a premium setting.',
      rating: '4.6',
      category: 'Restaurant',
      imageKeyword: 'ramada lahore hotel',
      location: 'Lahore, Pakistan',
      address: 'Lahore',
      about: 'A polished dining choice with comfortable seating, flavorful dishes, and a modern setting.',
      highlights: ['Modern ambiance', 'Comfortable seating', 'Elegant meals'],
      reviews: [{ author: 'Sara', location: 'Lahore', rating: '4.6', comment: 'Great for family dinners and catch-ups.' }],
      gallery: ['ramada lahore', 'hotel restaurant lahore', 'modern dining lahore'],
      distance: '2.9 km away',
      openText: 'Open • Closes 11:00 PM',
      isOpen: true,
    },
    {
      id: 'lahore-royal',
      title: 'Royal Kitchen',
      description: 'Fine dining and handcrafted flavors inspired by regional cuisine.',
      rating: '4.4',
      category: 'Restaurant',
      imageKeyword: 'royal kitchen lahore',
      location: 'Lahore, Pakistan',
      address: 'Lahore',
      about: 'A refined restaurant serving satisfying meals, grilled platters, and comforting local dishes.',
      highlights: ['Crafted meals', 'Comfortable setting', 'Family friendly'],
      reviews: [{ author: 'Talha', location: 'Lahore', rating: '4.4', comment: 'A reliable place for a nice evening meal.' }],
      gallery: ['royal kitchen lahore', 'fine dining lahore', 'restaurant interior lahore'],
      distance: '4.7 km away',
      openText: 'Open • Closes 10:00 PM',
      isOpen: true,
    },
    {
      id: 'lahore-farooqi',
      title: 'Farooqi Restaurant',
      description: 'Traditional Pakistani flavors and local favorites served warmly.',
      rating: '4.5',
      category: 'Restaurant',
      imageKeyword: 'farooqi restaurant lahore',
      location: 'Lahore, Pakistan',
      address: 'Lahore',
      about: 'A beloved local spot for classic Pakistani meals, healthy portions, and familiar home-style flavors.',
      highlights: ['Pakistani classics', 'Local favorite', 'Comfort food'],
      reviews: [{ author: 'Maham', location: 'Lahore', rating: '4.5', comment: 'Very good for a proper local food craving.' }],
      gallery: ['farooqi restaurant lahore', 'pakistani food lahore', 'traditional dining lahore'],
      distance: '3.8 km away',
      openText: 'Open • Closes 10:00 PM',
      isOpen: true,
    },
  ];

  if (isLahore) {
    return {
      placesAroundYou: restaurantTags ? lahorePlacesAroundYou.slice(0, 3) : lahorePlacesAroundYou.slice(0, 3),
      recommendedForYou: lahoreRecommended.slice(0, 5),
    };
  }

  return {
    placesAroundYou: [
      { id: 'generic-1', title: 'Local Landmark', description: 'A popular place nearby.', rating: '4.6', category: 'Landmark', imageKeyword: 'landmark city', location, address: location, about: 'A local favorite worth exploring.', highlights: ['Great views'], reviews: [], gallery: ['city landmark'], distance: '2.3 km away', openText: 'Open now', isOpen: true },
      { id: 'generic-2', title: 'City Food Spot', description: 'Well-loved local dining experience.', rating: '4.5', category: 'Food', imageKeyword: 'city food spot', location, address: location, about: 'A lively local food destination.', highlights: ['Local favorite'], reviews: [], gallery: ['food city'], distance: '3.1 km away', openText: 'Open now', isOpen: true },
      { id: 'generic-3', title: 'Popular Viewpoint', description: 'A scenic place for a memorable stop.', rating: '4.7', category: 'Sightseeing', imageKeyword: 'city viewpoint', location, address: location, about: 'Great for photography and relaxed wandering.', highlights: ['Scenic'], reviews: [], gallery: ['city viewpoint'], distance: '4.5 km away', openText: 'Open now', isOpen: true },
    ],
    recommendedForYou: [
      { id: 'generic-rec-1', title: 'Signature Dining', description: 'Popular culinary experience nearby.', rating: '4.6', category: 'Restaurant', imageKeyword: 'restaurant city', location, address: location, about: 'A highly rated local restaurant choice.', highlights: ['Great flavor'], reviews: [], gallery: ['restaurant city'], distance: '2.1 km away', openText: 'Open now', isOpen: true },
      { id: 'generic-rec-2', title: 'Local Heritage Stop', description: 'A must-visit place for culture and stories.', rating: '4.7', category: 'Culture', imageKeyword: 'heritage city', location, address: location, about: 'Good for culture lovers and casual explorers.', highlights: ['Cultural value'], reviews: [], gallery: ['heritage city'], distance: '3.8 km away', openText: 'Open now', isOpen: true },
      { id: 'generic-rec-3', title: 'City Night Spot', description: 'Fun atmosphere and local energy.', rating: '4.5', category: 'Nightlife', imageKeyword: 'night city', location, address: location, about: 'A lively spot offering atmosphere and social energy.', highlights: ['Evening vibe'], reviews: [], gallery: ['night city'], distance: '2.7 km away', openText: 'Open now', isOpen: true },
      { id: 'generic-rec-4', title: 'Boutique Cafe', description: 'Comfortable coffee and light bites.', rating: '4.4', category: 'Cafe', imageKeyword: 'cafe city', location, address: location, about: 'A pleasant cafe stop with relaxed energy and good coffee.', highlights: ['Coffee spot'], reviews: [], gallery: ['cafe city'], distance: '1.9 km away', openText: 'Open now', isOpen: true },
      { id: 'generic-rec-5', title: 'Scenic Walk', description: 'A relaxing route with local charm.', rating: '4.8', category: 'Walk', imageKeyword: 'walking city', location, address: location, about: 'Perfect for taking time to explore the neighborhood.', highlights: ['Easy stroll'], reviews: [], gallery: ['walking city'], distance: '2.9 km away', openText: 'Open now', isOpen: true },
    ],
  };
}

function locCacheKey(query: string): string {
  const trimmed = query.toLowerCase().trim();
  if (!trimmed) return POPULAR_CITIES_KEY;
  return `loc:${simpleHash(trimmed)}`;
}

async function getCached<T>(key: string): Promise<T | null> {
  try {
    const doc = await firestore().collection('ai_cache').doc(key).get();
    if (!doc.exists) return null;
    const data = doc.data() as
      | {
        payload: T;
        expiresAt: FirebaseFirestoreTypes.Timestamp | null;
      }
      | undefined;
    if (!data) return null;
    if (data.expiresAt && data.expiresAt.toMillis() < Date.now()) {
      return null;
    }
    return data.payload;
  } catch (err) {
    console.warn('[aiService] cache read failed:', err);
    return null;
  }
}

async function setCached<T>(
  key: string,
  payload: T,
  ttlMs: number | null,
  kind: 'recs' | 'loc',
): Promise<void> {
  try {
    await firestore()
      .collection('ai_cache')
      .doc(key)
      .set({
        payload,
        kind,
        createdAt: firestore.FieldValue.serverTimestamp(),
        expiresAt:
          ttlMs === null
            ? null
            : firestore.Timestamp.fromMillis(Date.now() + ttlMs),
      });
  } catch (err) {
    console.warn('[aiService] cache write failed:', err);
  }
}

async function callGemini(prompt: string, systemMessage: string): Promise<any> {
  const defaultEndpoint = `${GEMINI_BASE_V1BETA}/models/${GEMINI_DEFAULT_MODEL}:generateContent`;
  const endpoint = GEMINI_ENDPOINT && GEMINI_ENDPOINT.trim() ? GEMINI_ENDPOINT.trim() : defaultEndpoint;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (GEMINI_API_KEY) {
    headers['x-goog-api-key'] = GEMINI_API_KEY;
  } else if (GEMINI_TOKEN) {
    headers.Authorization = `Bearer ${GEMINI_TOKEN}`;
  } else {
    console.error('[aiService] GEMINI credentials missing');
    throw new Error('GEMINI credentials missing. Set GEMINI_API_KEY or GEMINI_TOKEN in .env and restart Metro');
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${systemMessage}\n\n${prompt}` }],
          },
        ],
      }),
    });
  } catch (networkErr) {
    console.warn('[aiService] network error (Gemini):', networkErr);
    throw new Error(`Network error reaching Gemini: ${(networkErr as Error)?.message}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.warn('[aiService] Gemini response not ok:', response.status, errText);
    if (response.status === 429 || response.status === 503) {
      let parsed: any = null;
      try { parsed = JSON.parse(errText); } catch (_e) { }
      const err = new Error('GeminiQuotaExceeded');
      (err as any).status = response.status;
      (err as any).body = parsed;
      throw err;
    }
    throw new Error(`Gemini request failed (${response.status}): ${errText}`);
  }

  const body = await response.json();
  const textParts = body?.candidates?.[0]?.content?.parts ?? [];
  const rawText = textParts.map((part: any) => part?.text || '').join('\n');

  if (!rawText) {
    console.warn('[aiService] empty Gemini content, body=', body);
    throw new Error('Gemini returned an empty response');
  }

  try {
    return JSON.parse(rawText.replace(/```json|```/gi, '').trim());
  } catch (_parseErr) {
    console.warn('[aiService] JSON parse failed (Gemini). raw content:', rawText);
    throw new Error('Gemini returned non-JSON content');
  }
}

function ensureIds(items: AIPlace[], prefix: string): AIPlace[] {
  return items.map((item, idx) => ({
    ...item,
    id: item.id || `${prefix}_${idx}_${simpleHash(item.title || String(idx))}`,
  }));
}

function buildLocationMatches(locationLabel: string, city?: string, country?: string): boolean {
  const target = normalizeText(locationLabel);
  if (!target) {
    return true;
  }

  const cityText = normalizeText(city);
  const countryText = normalizeText(country);

  if (!cityText && !countryText) {
    return false;
  }

  if (cityText && (target.includes(cityText) || cityText.includes(target))) {
    return true;
  }

  if (countryText && (target.includes(countryText) || countryText.includes(target))) {
    return true;
  }

  return false;
}

function inferPlaceCategory(name: string, description: string, prefs: string[]): string {
  const haystack = `${name} ${description}`.toLowerCase();

  if (/food|restaurant|cafe|coffee|dining|pizza|bakery|grill|karahi|tea|kebab/i.test(haystack)) {
    return 'Restaurant';
  }
  if (/museum|heritage|fort|mosque|historic|landmark|palace|monument|castle|temple/i.test(haystack)) {
    return 'Landmark';
  }
  if (/park|garden|beach|trail|view|mountain|nature|hike|lake|hill/i.test(haystack)) {
    return 'Adventure';
  }
  if (/shop|market|mall|bazaar|boutique|street/i.test(haystack)) {
    return 'Shopping';
  }
  if (/music|event|night|club|dj|concert|festival/i.test(haystack)) {
    return 'Event';
  }

  const pref = prefs.find((item) => item && haystack.includes(normalizeText(item)));
  return pref ? pref : 'Place';
}

async function fetchDatabasePlaceCandidates(location: string, prefs: string[]): Promise<Array<{
  id: string;
  name: string;
  description: string;
  rating: number;
  location: string;
  city_name?: string;
  country?: string;
  address?: string;
  imageUrl?: string;
  category: string;
  tagNames: string[];
  matchScore: number;
}>> {
  const [placesSnapshot, tagsSnapshot] = await Promise.all([
    firestore().collection('places').get(),
    firestore().collection('tags').get(),
  ]);

  const tagsById = new Map<string, string>();
  tagsSnapshot.docs.forEach((doc) => {
    const tagName = String(doc.data()?.name || '').trim();
    if (tagName) {
      tagsById.set(doc.id, tagName);
    }
  });

  const normalizedPrefs = prefs
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const candidates = placesSnapshot.docs
    .map((doc) => {
      const data = doc.data() as Record<string, any> | undefined;
      const name = String(data?.name || '').trim();
      if (!name || data?.isActive === false) {
        return null;
      }

      if (!buildLocationMatches(location, data?.city_name, data?.country)) {
        return null;
      }

      const tagNames = Array.isArray(data?.tag_ids)
        ? data.tag_ids
          .map((tagId: any) => String(tagId || '').trim())
          .map((tagId) => tagsById.get(tagId) || '')
          .filter(Boolean)
        : [];

      const searchableText = [
        name,
        data?.description || '',
        data?.address || '',
        data?.city_name || '',
        ...tagNames,
      ].join(' ').toLowerCase();

      let matchScore = 0;
      normalizedPrefs.forEach((pref) => {
        if (!pref) return;
        if (searchableText.includes(pref)) {
          matchScore += 3;
        }
        if (name.toLowerCase().includes(pref)) {
          matchScore += 4;
        }
        if (tagNames.some((tagName) => normalizeText(tagName).includes(pref))) {
          matchScore += 5;
        }
      });

      if (normalizedPrefs.length > 0 && matchScore === 0) {
        return null;
      }

      const cityName = data?.city_name || '';
      const countryName = data?.country || '';
      const locationLabel = [cityName, countryName].filter(Boolean).join(', ');

      return {
        id: doc.id,
        name,
        description: String(data?.description || 'A great local destination in the area.'),
        rating: Number(data?.rating || 4.5),
        location: locationLabel || location,
        city_name: cityName,
        country: countryName,
        address: String(data?.address || cityName || location),
        imageUrl: String(data?.imageUrl || ''),
        category: inferPlaceCategory(name, data?.description || '', prefs),
        tagNames,
        matchScore,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      name: string;
      description: string;
      rating: number;
      location: string;
      city_name?: string;
      country?: string;
      address?: string;
      imageUrl?: string;
      category: string;
      tagNames: string[];
      matchScore: number;
    }>;

  return candidates
    .sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return (b.rating || 0) - (a.rating || 0);
    })
    .slice(0, 12);
}

function toAiPlaceFromDatabase(
  place: {
    id: string;
    name: string;
    description: string;
    rating: number;
    location: string;
    city_name?: string;
    country?: string;
    address?: string;
    imageUrl?: string;
    category: string;
  },
  prefs: string[],
): AIPlace {
  const normalizedLocation = [place.city_name, place.country].filter(Boolean).join(', ') || place.location || 'Local area';

  return {
    id: place.id,
    title: place.name,
    description: place.description || 'A great local destination worth exploring.',
    rating: Number(place.rating || 4.5).toFixed(1),
    category: inferPlaceCategory(place.name, place.description, prefs),
    imageKeyword: place.name,
    imageUrl: place.imageUrl || RECOMMENDED_IMAGE,
    location: normalizedLocation,
    city: place.city_name || normalizedLocation,
    address: place.address || normalizedLocation,
    about: place.description || 'A highly rated local destination worth visiting.',
    highlights: ['Local favorite', 'Well matched to your preferences'],
    reviews: [],
    gallery: [place.imageUrl || RECOMMENDED_IMAGE],
    distance: '2.3 km away',
    openText: 'Open today',
    isOpen: true,
  };
}

export async function getRecommendations(
  location: string,
  prefs: string[],
): Promise<AIRecommendations> {
  try {
    if (!GEMINI_API_KEY && !GEMINI_TOKEN) {
      throw new Error('Gemini credentials are required for recommendations');
    }

    const preferenceText = prefs.length ? prefs.join(', ') : 'popular local experiences';
    const prompt = `Recommend real, currently existing named places in ${location} for a user interested in: ${preferenceText}.

Return JSON only in this exact shape:
{"placesAroundYou":[3 items],"recommendedForYou":[8 items]}

Every item must contain: {"id","title","description","rating","category","imageKeyword","location","address","about","highlights"}.
- Use the official, searchable place name in title. Never invent or use generic names.
- Every place must physically exist in or very near ${location}.
- imageKeyword must be the exact official place name followed by ${location}.
- rating must be a string from 4.0 to 4.9.
- highlights must be an array of 2-3 short strings.
- Match the user's preferences and do not duplicate a place.`;
    const raw = await callGemini(
      prompt,
      'You are a location-aware travel recommendation engine. Return valid JSON only.',
    );

    const normalizeGeminiPlaces = (items: unknown, prefix: string): AIPlace[] =>
      ensureIds(Array.isArray(items) ? items : [], prefix)
        .filter(item => Boolean(item?.title))
        .map(item => ({
          ...item,
          title: String(item.title).trim(),
          description: String(item.description || 'A popular place worth visiting.'),
          rating: String(item.rating || '4.5'),
          category: String(item.category || inferPlaceCategory(item.title, item.description || '', prefs)),
          imageKeyword: buildExactImageKeyword(item.title, location, item.category, item.imageKeyword),
          location: String(item.location || location),
          address: String(item.address || location),
          about: String(item.about || item.description || ''),
          highlights: Array.isArray(item.highlights) ? item.highlights.slice(0, 3) : [],
        }));

    const placesAroundYou = normalizeGeminiPlaces(raw?.placesAroundYou, 'gemini-nearby').slice(0, 3);
    const recommendedForYou = normalizeGeminiPlaces(raw?.recommendedForYou, 'gemini-recommended').slice(0, 8);
    if (!placesAroundYou.length || !recommendedForYou.length) {
      throw new Error('Gemini returned an incomplete recommendation list');
    }

    // Deliberately no Firestore read/write here: Gemini owns the recommendation list.
    return { placesAroundYou, recommendedForYou };
  } catch (err) {
    console.warn('[aiService] Gemini recommendations failed:', err);
    if ((err as any)?.message === 'GeminiQuotaExceeded' || (err as any)?.status === 429) {
      lastQuotaExceeded = Date.now();
    }
    throw err;
  }
}

export async function suggestPlacesForLocation(
  location: string,
  searchText: string = '',
): Promise<AIPlace[]> {
  const normalized =
    'addloc|' + location.toLowerCase().trim() + '|' + searchText.toLowerCase().trim();
  const key = `addloc:${simpleHash(normalized)}`;

  const cached = await getCached<AIPlace[]>(key);
  if (cached) return cached;

  const filterClause = searchText.trim()
    ? `Filter results to those matching the search query "${searchText}".`
    : '';

  const prompt = `List 8 popular places, attractions, or points of interest a traveler would visit in or near ${location}. ${filterClause}

Return JSON with this exact shape:
{ "places": [8 items] }

Each item must have: { "id", "title", "description", "rating", "category", "imageKeyword" }
- id: short kebab-case slug
- title: place name
- description: one sentence, max 80 characters
- rating: number string between "4.0" and "4.9"
- category: e.g. "Park", "Restaurant", "Museum", "Landmark", "Market"
- imageKeyword: 1-3 words for image search, no punctuation

Do not include any text outside the JSON.`;

  const systemMessage =
    'You are a travel place suggestion service. Return ONLY valid JSON.';

  try {
    const raw = await callGemini(prompt, systemMessage);
    const places = ensureIds(raw.places || [], 'addloc');
    await setCached(key, places, RECS_TTL_MS, 'recs');
    return places;
  } catch (err) {
    console.warn('[aiService] suggestPlacesForLocation falling back:', err);
    return FALLBACK_PLACES;
  }
}

export async function suggestLocations(query: string): Promise<string[]> {
  const key = locCacheKey(query);
  const cached = await getCached<string[]>(key);
  if (cached) return cached;

  const isPopular = !query.trim();
  const prompt = isPopular
    ? `List 8 popular US cities travelers commonly visit. Return JSON: { "cities": ["City, State", ...] }`
    : `Suggest up to 8 real cities matching "${query}". Format US cities as "City, State", others as "City, Country". Return JSON: { "cities": ["...", "..."] }`;

  const systemMessage =
    'You are a location autocomplete service. Return ONLY valid JSON.';

  try {
    const raw = await callGemini(prompt, systemMessage);
    const cities: string[] = Array.isArray(raw.cities) ? raw.cities : [];
    await setCached(key, cities, isPopular ? null : LOC_TTL_MS, 'loc');
    return cities;
  } catch (err) {
    console.warn('[aiService] suggestLocations falling back:', err);
    if (isPopular) return FALLBACK_POPULAR_CITIES;
    const q = query.toLowerCase();
    return FALLBACK_POPULAR_CITIES.filter((c) => c.toLowerCase().includes(q));
  }
}

async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  const globalObject = globalThis as typeof globalThis & {
    btoa?: (value: string) => string;
  };

  if (typeof globalObject.btoa === 'function') {
    return globalObject.btoa(binary);
  }

  return binary;
}

export async function verifyPlaceImageMatch(
  place: {
    title?: string;
    description?: string;
    category?: string;
    address?: string;
    location?: string;
    imageUrl?: string;
    targetCoordinates?: [number, number];
    captureCoordinates?: [number, number];
    captureDistanceMeters?: number;
  },
  localImageUri: string,
): Promise<{ matched: boolean; reason: string; confidence: number }> {
  const isOnline = await checkInternetConnection();
  if (!isOnline) {
    return {
      matched: false,
      reason: 'No internet connection. Please reconnect and try again to verify this stop.',
      confidence: 0,
    };
  }

  if (!localImageUri) {
    return {
      matched: false,
      reason: 'No image was captured for this stop. Please take a clear picture of the place before confirming.',
      confidence: 0,
    };
  }

  const targetTitle = place?.title || 'this place';
  const targetLocation = place?.location || place?.address || 'this location';
  const targetDescription = place?.description || 'landmark';
  const targetCategory = place?.category || 'destination';
  const targetImageHint = place?.imageUrl || `${targetTitle} ${targetLocation}`;
  const targetCoordinates = place?.targetCoordinates;
  const captureCoordinates = place?.captureCoordinates;
  const captureDistance = Number.isFinite(place?.captureDistanceMeters)
    ? Math.round(Number(place.captureDistanceMeters))
    : undefined;
  const locationProof = targetCoordinates && captureCoordinates
    ? `\nTarget GPS (longitude, latitude): ${targetCoordinates[0]}, ${targetCoordinates[1]}\nCapture GPS (longitude, latitude): ${captureCoordinates[0]}, ${captureCoordinates[1]}${captureDistance !== undefined ? `\nApp-calculated GPS distance: ${captureDistance} metres` : ''}\nThe app independently enforces the GPS visit radius. Use this only as supporting context; do not claim visual certainty from coordinates alone.`
    : '';

  const mimeType = /\.png$/i.test(localImageUri) ? 'image/png' : 'image/jpeg';

  try {
    const base64 = await uriToBase64(localImageUri);

    const endpoint = `${GEMINI_BASE_V1BETA}/models/${GEMINI_DEFAULT_MODEL}:generateContent`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (GEMINI_API_KEY) {
      headers['x-goog-api-key'] = GEMINI_API_KEY;
    } else if (GEMINI_TOKEN) {
      headers.Authorization = `Bearer ${GEMINI_TOKEN}`;
    } else {
      return {
        matched: false,
        reason: 'AI verification is unavailable because no Gemini API key is configured.',
        confidence: 0,
      };
    }

    const parts: any[] = [
      {
        text: `Verify whether the CAPTURED photo was taken at the exact target place. Be conservative: visual similarity alone is not enough. Look for unique signage, architecture, branding, exhibits, or landmark features. If the image is generic, blurry, lacks identifying evidence, shows only a person/food/road, or could plausibly be another place, matched must be false.\n\nTarget place: ${targetTitle}\nLocation/address: ${targetLocation}\nCategory: ${targetCategory}\nDescription: ${targetDescription}\nReference hint: ${targetImageHint}${locationProof}\n\nReturn valid JSON only: {"matched": true|false, "confidence": 0-100, "reason": "short evidence-based explanation"}. Only return matched=true when confidence is at least 80 and the captured visual evidence identifies this exact place.`,
      },
    ];

    if (place?.imageUrl) {
      try {
        const referenceBase64 = await uriToBase64(place.imageUrl);
        if (referenceBase64) {
          parts.push({ text: 'REFERENCE image of the target place:' });
          parts.push({ inline_data: { mime_type: 'image/jpeg', data: referenceBase64 } });
        }
      } catch {
        // The textual place identity is still usable when its reference image is unavailable.
      }
    }
    parts.push({ text: 'CAPTURED photo to verify:' });
    parts.push({ inline_data: { mime_type: mimeType, data: base64 } });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              ...parts,
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        matched: false,
        reason: `AI verification failed: ${errText || 'Unable to compare the photo right now.'}`,
        confidence: 0,
      };
    }

    const body = await response.json();
    const rawText = (body?.candidates?.[0]?.content?.parts ?? [])
      .map((part: any) => part?.text || '')
      .join('\n');

    if (!rawText) {
      return {
        matched: false,
        reason: 'AI verification did not return a result. Please try again with a clear photo of the place.',
        confidence: 0,
      };
    }

    const cleaned = rawText.replace(/```json|```/gi, '').trim();
    const parsed = JSON.parse(cleaned);
    const confidence = Math.max(0, Math.min(100, Number(parsed?.confidence) || 0));
    const matched = parsed?.matched === true && confidence >= 80;

    return {
      matched,
      reason: matched
        ? `Verified: this image matches ${targetTitle}.`
        : parsed?.reason || `This image does not match ${targetTitle}. Please re-take the photo at the correct place.`,
      confidence,
    };
  } catch (error) {
    return {
      matched: false,
      reason: 'AI verification could not compare this photo. Please make sure you are connected to the internet and try again with a clear image of the place.',
      confidence: 0,
    };
  }
}

function getGeminiAuthHeaders(): Record<string, string> | undefined {
  if (GEMINI_API_KEY) {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    };
  }
  if (GEMINI_TOKEN) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GEMINI_TOKEN}`,
    };
  }
  return undefined;
}

/**
 * Finds an image URL returned by Gemini's Google Image Search grounding.
 *
 * We only consume URLs returned in grounding metadata; we never trust a URL
 * written in model text. If the account/model does not have Image Search,
 * this returns undefined and the Wikimedia fallback continues normally.
 */
async function resolveGoogleGroundedImageUrl(
  title: string,
  location?: string,
): Promise<string | undefined> {
  const headers = getGeminiAuthHeaders();
  if (!headers || !title.trim()) return undefined;

  const lookupKey = `${title}|${location || ''}`.trim().toLowerCase();
  const cached = placeImageLookupCache.get(lookupKey);
  if (cached) return cached;

  const request = (async () => {
    try {
      const endpoint = `${GEMINI_BASE_V1}/models/${GEMINI_IMAGE_SEARCH_MODEL}:generateContent`;
      const placeLabel = [title.trim(), location?.trim()].filter(Boolean).join(', ');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Find a real, publicly accessible image of the exact place "${placeLabel}". Do not use a generic image or a similarly named place.`,
            }],
          }],
          tools: [{
            google_search: {
              searchTypes: {
                webSearch: {},
                imageSearch: {},
              },
            },
          }],
          // Image Search grounding is exposed by the image-capable model. The
          // generated image itself is ignored; only grounded source image URLs
          // are eligible for display below.
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      });

      if (!response.ok) {
        console.warn('[aiService] Google Image Search unavailable:', response.status);
        return undefined;
      }

      const body = await response.json();
      const chunks = body?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (!Array.isArray(chunks)) return undefined;

      for (const chunk of chunks) {
        const imageUrl = chunk?.image?.imageUri || chunk?.image?.image_uri || chunk?.imageUri || chunk?.image_uri;
        if (typeof imageUrl === 'string' && /^https:\/\//i.test(imageUrl)) {
          return imageUrl;
        }
      }
    } catch (error) {
      console.warn('[aiService] Google Image Search lookup failed:', error);
    }
    return undefined;
  })();

  placeImageLookupCache.set(lookupKey, request);
  return request;
}

export async function resolvePlaceImageUrl(
  title: string,
  fallbackKeyword?: string,
  location?: string,
  preferredUrl?: string,
  skipGoogleGrounding = false,
): Promise<string> {
  if (!skipGoogleGrounding) {
    const groundedImage = await resolveGoogleGroundedImageUrl(title, location);
    if (groundedImage) return groundedImage;
  }

  const baseKeyword = `${fallbackKeyword || title || 'travel'}`.trim();
  const titleTokens = normalizeText(title).split(' ').filter(token => token.length > 2);
  const isMatchingPage = (pageTitle: string): boolean => {
    const normalizedPageTitle = normalizeText(pageTitle);
    const matchingTokens = titleTokens.filter(token => normalizedPageTitle.includes(token));
    return titleTokens.length > 0 && matchingTokens.length / titleTokens.length >= 0.75;
  };
  const candidates = Array.from(
    new Set(
      [
        [title, location].filter(Boolean).join(' '),
        title,
        fallbackKeyword,
        title?.replace(/['’]/g, ''),
        title?.replace(/\s+/g, ' '),
        baseKeyword?.replace(/\s+/g, ' '),
      ].filter(Boolean) as string[],
    ),
  );

  if (!candidates.length) return preferredUrl || '';

  for (const candidate of candidates) {
    try {
      const encoded = encodeURIComponent(candidate.trim());
      const titleUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=pageimages&format=json&origin=*&piprop=thumbnail&pithumbsize=1200`;
      const titleResponse = await fetch(titleUrl);

      if (titleResponse.ok) {
        const data = await titleResponse.json();
        const pages = data?.query?.pages ?? {};
        for (const page of Object.values(pages) as any[]) {
          const thumbnail = page?.thumbnail?.source;
          if (isMatchingPage(String(page?.title || candidate)) && thumbnail && /^https:\/\//i.test(thumbnail)) {
            // Keep Wikimedia's HTTPS thumbnail URL. Downloading an image into a
            // data URI first is memory-expensive and is not consistently decoded
            // by Android's React Native image pipeline.
            return thumbnail;
          }
        }
      }

      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&format=json&origin=*&srlimit=5`;
      const searchResponse = await fetch(searchUrl);

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const firstResult = searchData?.query?.search?.find((result: any) =>
          isMatchingPage(String(result?.title || '')),
        )?.title;
        if (firstResult) {
          const pageTitle = encodeURIComponent(firstResult);
          const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${pageTitle}&prop=pageimages&format=json&origin=*&piprop=thumbnail&pithumbsize=1200`;
          const detailResponse = await fetch(detailUrl);
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            const pages2 = detailData?.query?.pages ?? {};
            for (const page of Object.values(pages2) as any[]) {
              const thumbnail = page?.thumbnail?.source;
              if (thumbnail && /^https:\/\//i.test(thumbnail)) {
                return thumbnail;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('[aiService] wikipedia image lookup failed for:', candidate, err);
    }
  }

  return preferredUrl || '';
}

/**
 * Keep only direct, reliable image URLs. If a source is missing or unusable,
 * return undefined so callers can fall back without inventing placeholder images.
 */
export function sanitizeImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const s = String(url).trim();
  if (!s) return undefined;
  if (!/^https:\/\//i.test(s)) return undefined;
  return s;
}
