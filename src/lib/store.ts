import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/services/api';
import authReducer from '@/features/auth/authSlice';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // RTK Query caches a large amount of API data; deep immutable/serializable
      // checks on that tree are slow in development and trip the default 32ms warn.
      immutableCheck: {
        ignoredPaths: [api.reducerPath],
        warnAfter: 128,
      },
      serializableCheck: {
        ignoredPaths: [api.reducerPath],
        warnAfter: 128,
      },
    }).concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
