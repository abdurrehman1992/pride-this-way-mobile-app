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
};

const FavoritesContext = createContext<FavoritesContextType | null>(null);

const USERS_COLLECTION = "users";

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
  if (
    category === "Event" ||
    category === "Music" ||
    category === "Food" ||
    category === "Restaurant"
  ) {
    return "favoriteEvents";
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
          const places = extractIds(data?.favorites);
          const tours = extractIds(data?.favoriteTours);
          const events = extractIds(data?.favoriteEvents);

          console.log('[FavoritesContext] snapshot fields:', {
            favoritesRaw: data?.favorites,
            favoriteToursRaw: data?.favoriteTours,
            favoriteEventsRaw: data?.favoriteEvents,
            extractedPlaces: places,
            extractedTours: tours,
            extractedEvents: events,
          });

          setFavorites(places);
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
      if (isAIGeneratedId(item.id)) {
        console.log('[Favorites] skipping AI-generated id:', item.id);
        return;
      }
      const bucket = bucketForCategory(item.category);

      await firestore()
        .collection(USERS_COLLECTION)
        .doc(userId)
        .set(
          {
            [bucket]: firestore.FieldValue.arrayUnion(item.id),
          },
          { merge: true }
        );
    },
    [userId]
  );

  const removeFromFavorites = useCallback(
    async (id: string, category?: CategoryType) => {
      if (!userId || !id) return;

      const userRef = firestore().collection(USERS_COLLECTION).doc(userId);

      if (category) {
        const bucket = bucketForCategory(category);
        await userRef.set(
          {
            [bucket]: firestore.FieldValue.arrayRemove(id),
          },
          { merge: true }
        );
        return;
      }

      // Category unknown — remove from all buckets to be safe
      await userRef.set(
        {
          favorites: firestore.FieldValue.arrayRemove(id),
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
    }),
    [
      favorites,
      favoriteTours,
      favoriteEvents,
      addToFavorites,
      removeFromFavorites,
      isFavorite,
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
