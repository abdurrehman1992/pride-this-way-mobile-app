import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import firestore from "@react-native-firebase/firestore";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../Redux/store";
import {
  setUserFavorites,
  setUserFavoriteTours,
  setUserFavoriteEvents,
} from "../Redux/slices/authSlice";

export type CategoryType =
  | "Place"
  | "Restaurant"
  | "Food"
  | "Music"
  | "Event"
  | "Route";

export type FavoriteItem = {
  id: string;
  title: string;
  description: string;
  rating?: string;
  image?: string;
  category: CategoryType;
  sourceScreen?: string;
  routeName?: string;
  routeParams?: any;
  city_name?: string;
  country?: string;
  createdAt?: string;
  originalPlace?: any; // optional raw place data (e.g., Google Place result)
};

export type FavoriteBucket = "favorites" | "favoriteTours" | "favoriteEvents";

type FavoritesContextType = {
  favorites: string[];
  favoriteTours: string[];
  favoriteEvents: string[];
  addToFavorites: (item: FavoriteItem) => Promise<void>;
  removeFromFavorites: (id: string, category?: CategoryType) => Promise<void>;
  isFavorite: (id: string) => boolean;
  bucketForCategory: (category?: CategoryType) => FavoriteBucket;
  fallbackPlaceDocs?: Record<string, any>;
};

const FavoritesContext = createContext<FavoritesContextType | null>(null);

const USERS_COLLECTION = "users";
/** Firestore field for place favorites (admin dashboard reads this). */
const FAVOURITE_PLACES_FIELD = "favoritePlaces";
const LEGACY_FAVORITES_FIELD = "favorites";

const firestoreFieldForBucket = (bucket: FavoriteBucket): string => {
  if (bucket === "favorites") return FAVOURITE_PLACES_FIELD;
  return bucket;
};

const AI_ID_PREFIXES = [
  "fallback_",
  "fb_addloc",
  "place_",
  "rec_",
  "addloc_",
];

const isAIGeneratedId = (id: string): boolean => {
  const lower = id.toLowerCase();
  return AI_ID_PREFIXES.some((prefix) => lower.startsWith(prefix));
};

const bucketForCategory = (category?: CategoryType): FavoriteBucket => {
  if (category === "Route") return "favoriteTours";
  // Events and Music are grouped under favoriteEvents. Restaurants/Food
  // should be preserved as place favorites so they appear in the Places tab.
  if (category === "Event" || category === "Music") {
    return "favoriteEvents";
  }
  if (category === "Food" || category === "Restaurant") {
    return "favorites";
  }
  return "favorites";
};

const extractIds = (raw: any): string[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) =>
      typeof item === "string" ? item : item?.id ? String(item.id) : null
    )
    .filter((id: string | null): id is string => Boolean(id));
};

export const FavoritesProvider = ({ children }: any) => {
  const dispatch = useDispatch();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteTours, setFavoriteTours] = useState<string[]>([]);
  const [favoriteEvents, setFavoriteEvents] = useState<string[]>([]);
  const [fallbackPlaceDocs, setFallbackPlaceDocs] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      setFavoriteTours([]);
      setFavoriteEvents([]);
      return;
    }

    const unsubscribe = firestore()
      .collection(USERS_COLLECTION)
      .doc(userId)
      .onSnapshot(
        (snapshot) => {
          const data = snapshot.data();
          const fromFavouritePlaces = extractIds(data?.[FAVOURITE_PLACES_FIELD]);
          const fromLegacy = extractIds(data?.[LEGACY_FAVORITES_FIELD]);
          const places = [...new Set([...fromFavouritePlaces, ...fromLegacy])];
          const favPlaceDocs = data?.favoritePlaceDocs || {};
          const tours = extractIds(data?.favoriteTours);
          const events = extractIds(data?.favoriteEvents);

          setFavorites(places);
          setFallbackPlaceDocs(favPlaceDocs || {});
          setFavoriteTours(tours);
          setFavoriteEvents(events);

          dispatch(setUserFavorites(places));
          dispatch(setUserFavoriteTours(tours));
          dispatch(setUserFavoriteEvents(events));
        },
        (err) => {
          console.warn('[FavoritesContext] snapshot error:', err);
          setFavorites([]);
          setFavoriteTours([]);
          setFavoriteEvents([]);
        }
      );

    return unsubscribe;
  }, [userId, dispatch]);

  const addToFavorites = useCallback(
    async (item: FavoriteItem) => {
      if (!userId || !item?.id) return;
      // Allow adding AI-generated recommendation IDs as favorites.
      // Previously we skipped IDs with AI prefixes; keep them but store
      // a fallback place doc on the user record when a central `places` write
      // is not possible.
      let fallbackPlaceDoc: Record<string, any> | null = null;
      if (item.originalPlace && item.id) {
        try {
          const placeDoc: Record<string, any> = {
            name: item.title || item.originalPlace.name || '',
            description: item.description || item.originalPlace.formatted_address || '',
            rating: Number(item.rating || item.originalPlace.rating || 0) || 0,
            address: item.originalPlace.formatted_address || item.originalPlace.vicinity || '',
            imageUrl: item.image || item.originalPlace?.icon || '',
            city_name: item.city_name || '',
            country: item.country || '',
            isActive: true,
            createdAt: firestore.FieldValue.serverTimestamp(),
            // keep original raw payload for debugging
            originalPlace: item.originalPlace,
          };
          await firestore().collection('places').doc(item.id).set(placeDoc, { merge: true });
        } catch (err) {
          // If writing to the central `places` collection fails (e.g. security rules),
          // keep the place doc as a fallback to store on the user's document so it
          // can still be displayed in Favorites.
          console.warn('[Favorites] failed saving originalPlace to places collection, will store under user doc fallback', err);
          fallbackPlaceDoc = {
            name: item.title || item.originalPlace.name || '',
            description: item.description || item.originalPlace.formatted_address || '',
            rating: Number(item.rating || item.originalPlace.rating || 0) || 0,
            address: item.originalPlace.formatted_address || item.originalPlace.vicinity || '',
            imageUrl: item.image || item.originalPlace?.icon || '',
            city_name: item.city_name || '',
            country: item.country || '',
            isActive: true,
            // keep original raw payload for debugging
            originalPlace: item.originalPlace,
          };
        }
      } else if (item.id) {
        // No originalPlace object (likely an AI-generated recommendation).
        // Attempt to persist a place doc built from the item fields; if that
        // fails, fall back to storing the doc under the user's record.
        try {
          const placeDoc: Record<string, any> = {
            name: item.title || '',
            description: item.description || '',
            rating: Number(item.rating || 0) || 0,
            address: item.originalPlace?.formatted_address || item.description || '',
            imageUrl: item.image || item.originalPlace?.icon || '',
            city_name: item.city_name || '',
            country: item.country || '',
            isActive: true,
            createdAt: firestore.FieldValue.serverTimestamp(),
            originalPlace: item.originalPlace || null,
          };
          await firestore().collection('places').doc(item.id).set(placeDoc, { merge: true });
        } catch (err) {
          console.warn('[Favorites] failed saving generated place to places collection, will store under user doc fallback', err);
          fallbackPlaceDoc = {
            name: item.title || '',
            description: item.description || '',
            rating: Number(item.rating || 0) || 0,
            address: item.originalPlace?.formatted_address || item.description || '',
            imageUrl: item.image || item.originalPlace?.icon || '',
            city_name: item.city_name || '',
            country: item.country || '',
            isActive: true,
            originalPlace: item.originalPlace || null,
          };
        }
      }
      const bucket = bucketForCategory(item.category);
      const field = firestoreFieldForBucket(bucket);
      const addId = (ids: string[]) =>
        ids.includes(item.id) ? ids : [...ids, item.id];

      // Do not wait for Firestore's snapshot before updating the UI. This
      // keeps every heart responsive, even when several items are rendered.
      if (bucket === "favorites") {
        setFavorites((prev) => addId(prev));
      } else if (bucket === "favoriteTours") {
        setFavoriteTours((prev) => addId(prev));
      } else {
        setFavoriteEvents((prev) => addId(prev));
      }

      console.log('[Favorites] addToFavorites called', { userId, itemId: item.id, bucket, field });

      const payload: Record<string, unknown> = {
        [field]: firestore.FieldValue.arrayUnion(item.id),
      };

      // If we couldn't save the place globally, persist the place doc under the user's
      // document as a fallback so the Favorites screen can read it later.
      if (fallbackPlaceDoc) {
        // favoritePlaceDocs.<placeId> = { ...place data }
        // Firestore supports nested map fields via dot-notation when using set(..., {merge:true})
        (payload as any)[`favoritePlaceDocs.${item.id}`] = fallbackPlaceDoc;
      }

      if (bucket === "favorites") {
        // Migrate legacy buckets so admin + app stay in sync.
        payload[LEGACY_FAVORITES_FIELD] = firestore.FieldValue.arrayRemove(item.id);
        payload.favoriteEvents = firestore.FieldValue.arrayRemove(item.id);
      }

      try {
        console.log('[Favorites] writing user payload', payload);
        await firestore()
          .collection(USERS_COLLECTION)
          .doc(userId)
          .set(payload, { merge: true });
        console.log('[Favorites] user payload written');
      } catch (error) {
        console.warn('[Favorites] failed writing user payload', error);
        // Restore the visible state if the save did not reach Firestore.
        if (bucket === "favorites") {
          setFavorites((ids) => ids.filter((id) => id !== item.id));
        } else if (bucket === "favoriteTours") {
          setFavoriteTours((ids) => ids.filter((id) => id !== item.id));
        } else {
          setFavoriteEvents((ids) => ids.filter((id) => id !== item.id));
        }
        throw error;
      }
    },
    [userId]
  );

  const removeFromFavorites = useCallback(
    async (id: string, category?: CategoryType) => {
      if (!userId || !id) return;

      const userRef = firestore().collection(USERS_COLLECTION).doc(userId);

      if (category) {
        const bucket = bucketForCategory(category);
        const field = firestoreFieldForBucket(bucket);
        const removeId = (ids: string[]) => ids.filter((itemId) => itemId !== id);

        if (bucket === "favorites") {
          setFavorites(removeId);
        } else if (bucket === "favoriteTours") {
          setFavoriteTours(removeId);
        } else {
          setFavoriteEvents(removeId);
        }

        const payload: Record<string, unknown> = {
          [field]: firestore.FieldValue.arrayRemove(id),
        };
        if (bucket === "favorites") {
          payload[LEGACY_FAVORITES_FIELD] = firestore.FieldValue.arrayRemove(id);
        }
        try {
          await userRef.set(payload, { merge: true });
        } catch (error) {
          if (bucket === "favorites") {
            setFavorites((ids) => [...ids, id]);
          } else if (bucket === "favoriteTours") {
            setFavoriteTours((ids) => [...ids, id]);
          } else {
            setFavoriteEvents((ids) => [...ids, id]);
          }
          throw error;
        }
        return;
      }

      // Category unknown — remove from all buckets to be safe
      await userRef.set(
        {
          [FAVOURITE_PLACES_FIELD]: firestore.FieldValue.arrayRemove(id),
          [LEGACY_FAVORITES_FIELD]: firestore.FieldValue.arrayRemove(id),
          favoriteTours: firestore.FieldValue.arrayRemove(id),
          favoriteEvents: firestore.FieldValue.arrayRemove(id),
        },
        { merge: true }
      );
    },
    [userId]
  );

  const isFavorite = useCallback(
    (id: string) =>
      favorites.includes(id) ||
      favoriteTours.includes(id) ||
      favoriteEvents.includes(id),
    [favorites, favoriteTours, favoriteEvents]
  );

  const value = useMemo(
    () => ({
      favorites,
      favoriteTours,
      favoriteEvents,
      addToFavorites,
      removeFromFavorites,
      isFavorite,
      bucketForCategory,
      fallbackPlaceDocs,
    }),
    [
      favorites,
      favoriteTours,
      favoriteEvents,
      addToFavorites,
      removeFromFavorites,
      isFavorite,
      fallbackPlaceDocs,
    ]
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used inside provider");
  return context;
};
