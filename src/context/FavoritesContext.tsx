import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import firestore from "@react-native-firebase/firestore";
import { useSelector } from "react-redux";
import { RootState } from "../Redux/store";

export type CategoryType =
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

type FavoritesContextType = {
  favorites: FavoriteItem[];
  addToFavorites: (item: FavoriteItem) => Promise<void>;
  removeFromFavorites: (id: string) => Promise<void>;
  isFavorite: (id: string) => boolean;
};

const FavoritesContext = createContext<FavoritesContextType | null>(null);

const USERS_COLLECTION = "users";
const FAVORITES_SUBCOLLECTION = "favorites";

const removeUndefinedDeep = (value: any): any => {
  if (Array.isArray(value)) {
    return value
      .map((item) => removeUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce<Record<string, any>>((acc, [key, item]) => {
      const cleaned = removeUndefinedDeep(item);
      if (cleaned !== undefined) {
        acc[key] = cleaned;
      }
      return acc;
    }, {});
  }

  return value === undefined ? undefined : value;
};

export const FavoritesProvider = ({ children }: any) => {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      return;
    }

    const unsubscribe = firestore()
      .collection(USERS_COLLECTION)
      .doc(userId)
      .collection(FAVORITES_SUBCOLLECTION)
      .onSnapshot(
        (snapshot) => {
          const items = snapshot.docs
            .map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                title: data.title || "",
                description: data.description || "",
                rating: data.rating || "",
                image: data.image || "",
                category: (data.category || "Food") as CategoryType,
                sourceScreen: data.sourceScreen || "",
                routeName: data.routeName || "",
                routeParams: data.routeParams || undefined,
                city_name: data.city_name || "",
                country: data.country || "",
                createdAt: data.createdAt || "",
              };
            })
            .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

          setFavorites(items);
        },
        () => setFavorites([])
      );

    return unsubscribe;
  }, [userId]);

  const addToFavorites = useCallback(
    async (item: FavoriteItem) => {
      if (!userId) {
        return;
      }

      const payload = removeUndefinedDeep({
        ...item,
        createdAt: item.createdAt || new Date().toISOString(),
        user_id: userId,
      });

      await firestore()
        .collection(USERS_COLLECTION)
        .doc(userId)
        .collection(FAVORITES_SUBCOLLECTION)
        .doc(item.id)
        .set(payload, { merge: true });
    },
    [userId]
  );

  const removeFromFavorites = useCallback(
    async (id: string) => {
      if (!userId) {
        return;
      }

      await firestore()
        .collection(USERS_COLLECTION)
        .doc(userId)
        .collection(FAVORITES_SUBCOLLECTION)
        .doc(id)
        .delete();
    },
    [userId]
  );

  const isFavorite = useCallback(
    (id: string) => favorites.some((item) => item.id === id),
    [favorites]
  );

  const value = useMemo(
    () => ({
      favorites,
      addToFavorites,
      removeFromFavorites,
      isFavorite,
    }),
    [favorites, addToFavorites, removeFromFavorites, isFavorite]
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
