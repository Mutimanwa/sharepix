import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from './config';
import { restoreSession, syncProfile, initializeAuth, signOut } from './services/auth';
import { supabase } from './lib/supabase'; // <-- AJOUT POUR LE CLOUD

const KEY = 'sharepix.v1';

const defaultState = {
  onboarded: false,
  favTipSeen: false,
  // — Runtime auth (jamais persisté dans AsyncStorage) —
  authChecked: false, 
  user: null,         
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

  // 2. Initialisation Auth (Anonyme si besoin)
  useEffect(() => {
    let cancelled = false;
    
    (async () => {
      try {
        if (isSupabaseConfigured) {
          console.log('🔄 Initializing auth...');
          const user = await initializeAuth();
          
          if (!cancelled && user) {
            console.log(`✅ Auth ready (${user.isAnonymous ? 'Anonymous' : 'Logged In'}):`, user.email || user.id);
            setState((s) => ({
              ...s,
              user,
              profile: {
                ...s.profile,
                firstName: user.firstName || s.profile.firstName,
                lastName: user.lastName || s.profile.lastName,
              },
            }));
          }
        }
      } catch (error) {
        console.log('❌ Auth init error:', error);
      }
      
      if (!cancelled) {
        setState((s) => ({ ...s, authChecked: true }));
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
        if (state.user?.id) {
          const merged = { ...state.profile, ...p };
          syncProfile(state.user.id, {
            firstName: merged.firstName,
            lastName: merged.lastName,
          }).catch(() => {});
        }
      },
      
      // ── CLOUD & LOCAL : Créer un album ──
      createAlbum: async ({ name, firstName }) => {
        // 1. Essai de création dans le Cloud (Supabase)
        if (supabase && state.user?.id) {
          const code = code8();
          const { data, error } = await supabase
            .from('albums')
            .insert({
              name: name,
              code: code,
              user_id: state.user.id,
              creator_name: firstName,
            })
            .select()
            .single();

          if (!error && data) {
            // Formatage de l'album cloud pour qu'il ressemble à un album local
            const cloudAlbum = {
              id: data.id,
              name: data.name,
              code: data.code,
              photos: [],
              createdAt: new Date(data.created_at).getTime(),
              members: firstName ? [{ name: firstName, role: 'admin' }] : [],
            };
            
            setState((s) => ({
              ...s,
              profile: { ...s.profile, firstName: firstName || s.profile.firstName },
              albums: [cloudAlbum, ...s.albums],
            }));
            return cloudAlbum;
          }
          console.log('⚠️ Cloud creation failed, falling back to local');
        }

        // 2. Fallback 100% Local (si pas internet, ou si Supabase non configuré)
        const localAlbum = {
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
          albums: [localAlbum, ...s.albums],
        }));
        return localAlbum;
      },
      
      // ── CLOUD & LOCAL : Rejoindre un album ──
      joinAlbum: async (code) => {
        // 1. Essai de recherche dans le Cloud
        if (supabase) {
          const { data, error } = await supabase
            .from('albums')
            .select('*')
            .eq('code', code.toUpperCase())
            .single();

          if (!error && data) {
            const cloudAlbum = {
              id: data.id,
              name: data.name,
              code: data.code,
              photos: [], // Les photos seront chargées en entrant dans l'album
              createdAt: new Date(data.created_at).getTime(),
              members: data.creator_name ? [{ name: data.creator_name, role: 'admin' }] : [],
            };
            
            // On l'ajoute au state local s'il n'y est pas déjà
            setState((s) => {
              if (s.albums.find((a) => a.id === cloudAlbum.id)) return s; // Déjà présent
              return { ...s, albums: [cloudAlbum, ...s.albums] };
            });
            
            return cloudAlbum;
          }
        }

        // 2. Fallback local (pour les vieux albums créés avant la mise en ligne)
        const found = state.albums.find((a) => a.code.toUpperCase() === code.toUpperCase());
        return found || null;
      },
      
      // ── 100% LOCAL : Actions sur les photos (pour l'instant) ──
      
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