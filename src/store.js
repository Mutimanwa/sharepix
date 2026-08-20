import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from './config';
import { restoreSession, syncProfile } from './services/auth';

const KEY = 'sharepix.v1';

const defaultState = {
  onboarded: false,
  favTipSeen: false,
  // — Runtime auth (jamais persisté dans AsyncStorage) —
  authChecked: false, // true quand on sait si une session Supabase existe
  user: null,         // utilisateur Supabase connecté ({id, email, firstName, lastName})
  profile: {
    firstName: '',
    lastName: '',
    notifications: false,
    newPhotos: false,
    likes: false,
    comments: false,
  },
  albums: [],
};

const StoreContext = createContext(null);

function code8() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(defaultState);
  const [ready, setReady] = useState(false);

  // 1. Chargement du store local
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setState({ 
            ...defaultState, 
            ...parsed, 
            user: null, 
            authChecked: false 
          });
        }
      } catch (error) {
        console.log('Store load error:', error);
      }
      setReady(true);
    })();
  }, []);

  // 2. Restauration de la session Supabase
  useEffect(() => {
    let cancelled = false;
    
    (async () => {
      try {
        if (isSupabaseConfigured) {
          console.log('🔄 Restoring Supabase session...');
          const user = await restoreSession();
          if (!cancelled && user) {
            console.log('✅ Session restored:', user.email);
            setState((s) => ({
              ...s,
              user,
              profile: {
                ...s.profile,
                firstName: user.firstName || s.profile.firstName,
                lastName: user.lastName || s.profile.lastName,
              },
            }));
          } else if (!cancelled) {
            console.log('ℹ️ No session found');
          }
        }
      } catch (error) {
        console.log('❌ Session restore error:', error);
      }
      if (!cancelled) {
        setState((s) => ({ ...s, authChecked: true }));
        console.log('🔐 Auth checked:', state.user ? 'connected' : 'not connected');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 3. Persistance locale (exclut les champs runtime)
  useEffect(() => {
    if (ready) {
      const { user, authChecked, ...toPersist } = state;
      AsyncStorage.setItem(KEY, JSON.stringify(toPersist)).catch(() => {});
    }
  }, [state, ready]);

  const api = useMemo(
    () => ({
      ready,
      state,
      
      setOnboarded: () => setState((s) => ({ ...s, onboarded: true })),
      
      dismissFavTip: () => setState((s) => ({ ...s, favTipSeen: true })),
      
      // Connecte l'utilisateur Supabase et recopie son prénom/nom dans le profil local
      setAuthUser: (user) => {
        console.log('👤 Setting auth user:', user?.email);
        setState((s) => ({
          ...s,
          user,
          profile: {
            ...s.profile,
            firstName: user?.firstName || s.profile.firstName,
            lastName: user?.lastName || s.profile.lastName,
          },
        }));
      },
      
      clearAuthUser: () => {
        console.log('👋 Clearing auth user');
        setState((s) => ({ ...s, user: null }));
      },
      
      updateProfile: (p) => {
        setState((s) => ({ ...s, profile: { ...s.profile, ...p } }));
        // Synchro douce vers la table `profiles` si connecté
        if (state.user?.id) {
          const merged = { ...state.profile, ...p };
          syncProfile(state.user.id, {
            firstName: merged.firstName,
            lastName: merged.lastName,
          }).catch(() => {});
        }
      },
      
      createAlbum: ({ name, firstName }) => {
        const album = {
          id: Date.now().toString(),
          name,
          code: code8(),
          photos: [],
          createdAt: Date.now(),
          members: firstName ? [{ name: firstName, role: 'admin' }] : [],
        };
        setState((s) => ({
          ...s,
          profile: { ...s.profile, firstName: firstName || s.profile.firstName },
          albums: [album, ...s.albums],
        }));
        return album;
      },
      
      joinAlbum: (code) => {
        const found = state.albums.find((a) => a.code.toUpperCase() === code.toUpperCase());
        return found || null;
      },
      
      addPhoto: (albumId, uri) => {
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id === albumId
              ? {
                  ...a,
                  photos: [
                    {
                      id: Date.now().toString() + Math.random(),
                      uri,
                      createdAt: Date.now(),
                      liked: false,
                      favorite: false,
                      comments: [],
                    },
                    ...a.photos,
                  ],
                }
              : a
          ),
        }));
      },
      
      toggleLike: (albumId, photoId) => {
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id !== albumId
              ? a
              : {
                  ...a,
                  photos: a.photos.map((p) =>
                    p.id === photoId ? { ...p, liked: !p.liked } : p
                  ),
                }
          ),
        }));
      },
      
      toggleFavorite: (albumId, photoId) => {
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id !== albumId
              ? a
              : {
                  ...a,
                  photos: a.photos.map((p) =>
                    p.id === photoId ? { ...p, favorite: !p.favorite } : p
                  ),
                }
          ),
        }));
      },
      
      addComment: (albumId, photoId, text) => {
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id !== albumId
              ? a
              : {
                  ...a,
                  photos: a.photos.map((p) =>
                    p.id === photoId
                      ? {
                          ...p,
                          comments: [
                            ...p.comments,
                            {
                              id: Date.now().toString(),
                              author: s.profile.firstName || 'Vous',
                              text,
                              createdAt: Date.now(),
                            },
                          ],
                        }
                      : p
                  ),
                }
          ),
        }));
      },
      
      deletePhoto: (albumId, photoId) => {
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id === albumId ? { ...a, photos: a.photos.filter((p) => p.id !== photoId) } : a
          ),
        }));
      },
    }),
    [ready, state]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}