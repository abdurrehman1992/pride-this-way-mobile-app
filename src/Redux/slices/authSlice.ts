import { createSlice, PayloadAction } from "@reduxjs/toolkit";
interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}
interface AuthState {
  user: User | null;
  token: string | null;
  isLoggedIn: boolean;
  initialized: boolean;
  loading: boolean;
  error: string | null;
}
const initialState: AuthState = {
  user: null,
  token: null,
  isLoggedIn: false,
  initialized: false,
  loading: false,
  error: null,
};
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (
      state,
      action: PayloadAction<{ user: User; token: string }>
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isLoggedIn = true;
      state.initialized = true;
      state.loading = false;
      state.error = null;
    },
    loginFailure: (state, action: PayloadAction<string>) => {
      state.loading = false;
      state.initialized = true;
      state.error = action.payload;
    },
    setAuthInitialized: (state) => {
      state.initialized = true;
      state.loading = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isLoggedIn = false;
      state.initialized = true;
      state.error = null;
      state.loading = false;
    },
  },
});
export const {
  loginStart,
  loginSuccess,
  loginFailure,
  setAuthInitialized,
  logout,
} = authSlice.actions;
export default authSlice.reducer;
