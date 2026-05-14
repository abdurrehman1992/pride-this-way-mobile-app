export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgetPassword: undefined;
  EnterCode: undefined;
  CreateNewPassword: undefined;
};

export type MyTourStackParamList = {
  AddLocations: {
    tourId?: number;
    selectedLocation?: string;
  };
  MyTour: {
    selectedLocation?: string;
    tourId?: number;
    timestamp?: number;
    pendingLocation?: string;
  } | undefined,
  MyTourStart: {
    tourId?: number;
    addedStop?: { id: string; title: string; coordinate: [number, number] };
  } | undefined,
  RecommendationDetials: undefined
};

export type ProfileStackParamList = {
  Profile: undefined,
  EditProfile: undefined,
  ChangePassword: undefined
};

export type FovoritesStackParamList = {
  Favorites: undefined,
};
export type MapStackParamList = {
  Map: undefined,
};
export type ForYouStackParamList = {
  ForYou: undefined,
  Home: undefined,
  RecommendationDetials: undefined,
  // PlacesArroundDetails:undefined
};

export type RewardsStackParamList = {
  Rewards: undefined,
};
export type AppStackParamList = {
  Tabs: undefined;
  Main: undefined
};

export type TabParamList = {
  Favorites: undefined;
  MyTour: undefined;
  ForYou: undefined;
  Map: undefined;
  Profile: undefined;
};