import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { OPENAI_API_KEY } from '@env';

export type AIPlace = {
  id: string;
  title: string;
  description: string;
  rating: string;
  category: string;
  imageKeyword: string;
};

export type AIRecommendations = {
  placesAroundYou: AIPlace[];
  recommendedForYou: AIPlace[];
};

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const RECS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOC_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const POPULAR_CITIES_KEY = 'loc:popular';

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

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function recsCacheKey(location: string, prefs: string[]): string {
  const normalized =
    'recs|' + location.toLowerCase().trim() + '|' + [...prefs].sort().join(',');
  return `recs:${simpleHash(normalized)}`;
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

async function callOpenAI(prompt: string, systemMessage: string): Promise<any> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'PASTE_YOUR_OPENAI_KEY_HERE') {
    console.error('[aiService] OPENAI_API_KEY missing or placeholder');
    throw new Error('OPENAI_API_KEY missing. Paste your key in .env and restart Metro with --reset-cache');
  }

  console.log('[aiService] calling OpenAI, key length:', OPENAI_API_KEY.length);

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });
  } catch (networkErr) {
    console.error('[aiService] network error:', networkErr);
    throw new Error(`Network error reaching OpenAI: ${(networkErr as Error)?.message}`);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error('[aiService] OpenAI response not ok:', response.status, errText);
    throw new Error(`OpenAI request failed (${response.status}): ${errText}`);
  }

  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (!content) {
    console.error('[aiService] empty OpenAI content, body=', body);
    throw new Error('OpenAI returned an empty response');
  }

  try {
    return JSON.parse(content);
  } catch (parseErr) {
    console.error('[aiService] JSON parse failed. raw content:', content);
    throw new Error('OpenAI returned non-JSON content');
  }
}

function ensureIds(items: AIPlace[], prefix: string): AIPlace[] {
  return items.map((item, idx) => ({
    ...item,
    id: item.id || `${prefix}_${idx}_${simpleHash(item.title || String(idx))}`,
  }));
}

export async function getRecommendations(
  location: string,
  prefs: string[],
): Promise<AIRecommendations> {
  const key = recsCacheKey(location, prefs);
  const cached = await getCached<AIRecommendations>(key);
  if (cached) return cached;

  const prefList = prefs.length > 0 ? prefs.join(', ') : 'general sightseeing';
  const prompt = `Generate place recommendations for a traveler in ${location} interested in ${prefList}.

Return JSON with this exact shape:
{
  "placesAroundYou": [3 items],
  "recommendedForYou": [5 items]
}

Each item must have: { "id", "title", "description", "rating", "category", "imageKeyword" }
- id: short kebab-case slug
- title: name of the place or event
- description: one sentence, max 60 characters
- rating: number string between "4.0" and "4.9"
- category: one of the user's preferences when possible, otherwise a relevant category
- imageKeyword: 1-3 words for image search, no punctuation

Do not include any text outside the JSON.`;

  const systemMessage =
    'You are a travel recommendations assistant. Return ONLY valid JSON matching the requested schema.';

  try {
    const raw = await callOpenAI(prompt, systemMessage);
    const result: AIRecommendations = {
      placesAroundYou: ensureIds(raw.placesAroundYou || [], 'place'),
      recommendedForYou: ensureIds(raw.recommendedForYou || [], 'rec'),
    };
    await setCached(key, result, RECS_TTL_MS, 'recs');
    return result;
  } catch (err) {
    console.warn('[aiService] getRecommendations falling back:', err);
    return FALLBACK_RECOMMENDATIONS;
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
    const raw = await callOpenAI(prompt, systemMessage);
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
    const raw = await callOpenAI(prompt, systemMessage);
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

export function buildUnsplashUrl(keyword: string): string {
  const safe = encodeURIComponent(keyword || 'travel');
  // loremflickr returns a real photo matching the keyword (free, no API key, stable)
  return `https://loremflickr.com/600/400/${safe}`;
}
