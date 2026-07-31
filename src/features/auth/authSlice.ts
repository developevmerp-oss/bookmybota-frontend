import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthUser {
  id: string;
  email: string;
  role: 'super_admin' | 'business_admin' | 'customer';
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
      // Persist to role-specific keys in localStorage
      if (typeof window !== 'undefined') {
        let tokenKey = 'token_customer';
        let userKey = 'user_customer';
        if (action.payload.user.role === 'super_admin') {
          tokenKey = 'token_super_admin';
          userKey = 'user_super_admin';
        } else if (action.payload.user.role === 'business_admin') {
          tokenKey = 'token_business_admin';
          userKey = 'user_business_admin';
        }
        localStorage.setItem(tokenKey, action.payload.token);
        localStorage.setItem(userKey, JSON.stringify(action.payload.user));
      }
    },
    clearCredentials: (state) => {
      state.user = null;
      state.token = null;
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        let tokenKey = 'token_customer';
        let userKey = 'user_customer';
        if (pathname.startsWith('/admin')) {
          tokenKey = 'token_super_admin';
          userKey = 'user_super_admin';
        } else if (pathname.startsWith('/business')) {
          tokenKey = 'token_business_admin';
          userKey = 'user_business_admin';
        }
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
      }
    },
    loadFromStorage: (state) => {
      if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        let tokenKey = 'token_customer';
        let userKey = 'user_customer';
        if (pathname.startsWith('/admin')) {
          tokenKey = 'token_super_admin';
          userKey = 'user_super_admin';
        } else if (pathname.startsWith('/business')) {
          tokenKey = 'token_business_admin';
          userKey = 'user_business_admin';
        }
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
  },
});

export const { setCredentials, clearCredentials, loadFromStorage } = authSlice.actions;
export default authSlice.reducer;
