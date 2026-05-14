import React, { createContext, useContext, useState } from "react";

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
};

type FavoritesContextType = {
  favorites: FavoriteItem[];
  addToFavorites: (item: FavoriteItem) => void;
  removeFromFavorites: (id: string) => void;
  isFavorite: (id: string) => boolean;
};

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export const FavoritesProvider = ({ children }: any) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  const addToFavorites = (item: FavoriteItem) => {
    setFavorites((prev) => {
      const exists = prev.find((i) => i.id === item.id);
      if (exists) return prev;
      return [...prev, item];
    });
  };

  const removeFromFavorites = (id: string) => {
    setFavorites((prev) => prev.filter((i) => i.id !== id));
  };

  const isFavorite = (id: string) => {
    return favorites.some((i) => i.id === id);
  };

  return (
    <FavoritesContext.Provider
      value={{ favorites, addToFavorites, removeFromFavorites, isFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used inside provider");
  return context;
};