export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgetPassword: undefined;
  EnterCode: undefined;
  CreateNewPassword: undefined;
};

export type MyTourStackParamList = {
  AddLocations: {
    routeId?: string;
    cityLabel?: string;
    fromScreen?: 'MyTour' | 'MyTourStart';
  };
  MyTour: {
    addedPlaceId?: string;
    routeId?: string;
    timestamp?: number;
  } | undefined,
  MyTourStart: {
    routeId?: string;
    routeName?: string;
    tourName?: string;
    cityLabel?: string;
    selectedTagIds?: string[];
    addedPlaceId?: string;
    extraPlaceIds?: string[];
    removedPlaceIds?: string[];
    tourId?: string;
    isEdited?: boolean;
    autoStart?: boolean;
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
  Main: undefined,
};
export type SupportParamList = {
  Help_Support: undefined;
  Terms_Conditions: undefined,
};

export type TabParamList = {
  Favorites: undefined;
  MyTours: undefined;
  ForYou: undefined;
  Map: undefined;
  Profile: undefined;
};
