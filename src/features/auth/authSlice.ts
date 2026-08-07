import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { homePathForRole, storageKeysForPath, storageKeysForRole, type UserRole } from '@/lib/authStorage';

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  business_id?: string;
  customer_id?: string;
  name?: string;
  phone?: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: AuthUser; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      if (typeof window !== 'undefined') {
        const { tokenKey, userKey } = storageKeysForRole(action.payload.user.role);
        localStorage.setItem(tokenKey, action.payload.token);
        localStorage.setItem(userKey, JSON.stringify(action.payload.user));
      }
    },
    clearCredentials: (state) => {
      state.user = null;
      state.token = null;
      if (typeof window !== 'undefined') {
        const { tokenKey, userKey } = storageKeysForPath(window.location.pathname);
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
      }
    },
    loadFromStorage: (state) => {
      if (typeof window !== 'undefined') {
        const { tokenKey, userKey } = storageKeysForPath(window.location.pathname);
        const token = localStorage.getItem(tokenKey);
        const userStr = localStorage.getItem(userKey);
        if (token && userStr) {
          state.token = token;
          state.user = JSON.parse(userStr);
        } else {
          state.token = null;
          state.user = null;
        }
      }
    },
    updateUser: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (!state.user) return;
      state.user = { ...state.user, ...action.payload };
      if (typeof window !== 'undefined') {
        const { userKey } = storageKeysForRole(state.user.role);
        localStorage.setItem(userKey, JSON.stringify(state.user));
      }
    },
  },
});

export const { setCredentials, clearCredentials, loadFromStorage, updateUser } = authSlice.actions;
export { homePathForRole };
export default authSlice.reducer;
