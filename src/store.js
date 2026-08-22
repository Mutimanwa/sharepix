import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSupabaseConfigured } from './config';
import { restoreSession, syncProfile, initializeAuth, signOut } from './services/auth';
import { supabase } from './lib/supabase'; // <-- AJOUT POUR LE CLOUD
// ── SUPABASE ALBUMS : intégration ──
import {
  cloudCreateAlbum,
  cloudJoinAlbum,
  cloudFetchMyAlbums,
  mapCloudAlbum,
  isCodeCollision,
  isCloudId,
  cloudFetchAlbumPhotos,
  cloudDeletePhoto,
  cloudDeleteAlbum,
  cloudRenameAlbum,
  cloudLeaveAlbum,
  cloudFetchInteractions,
  cloudAddComment,
  cloudSetLike,
  cloudFetchAlbumMembers,
  cloudRemoveMember,
  cloudDeleteComment,
} from './services/albums';
// ── SUPABASE ALBUMS : fin ──
import { Alert } from 'react-native';

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

            // ── SUPABASE ALBUMS : intégration ──
            // Restauration cloud : après login (ou compte anonyme restauré),
            // on récupère tous les albums dont on est membre. C'est ce qui
            // fait réapparaître les souvenirs sur un nouvel appareil.
            // Fusion : le cloud est la source de vérité ; les albums
            // purement locaux (jamais synchronisés) sont conservés.
            cloudFetchMyAlbums().then(({ data: cloudAlbums, error }) => {
              if (cancelled || error || !cloudAlbums.length) return;
              console.log(`☁️ ${cloudAlbums.length} album(s) restauré(s) depuis le cloud`);
              setState((s) => {
                const cloudIds = new Set(cloudAlbums.map((a) => a.id));
                const localOnly = s.albums.filter(
                  (a) => !a.cloud && !cloudIds.has(a.id)
                );
                return { ...s, albums: [...cloudAlbums, ...localOnly] };
              });
            });
            // ── SUPABASE ALBUMS : fin ──
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
          // ── SUPABASE ALBUMS : intégration ──
          // RPC atomique (album + membre owner). Jusqu'à 3 essais en cas
          // de collision sur le code d'invitation (contrainte unique).
          let cloudRow = null;
          for (let attempt = 0; attempt < 3 && !cloudRow; attempt++) {
            const { data, error } = await cloudCreateAlbum({
              name,
              code: code8(),
              creatorName: firstName,
            });
            if (!error && data) cloudRow = data;
            else if (error && !isCodeCollision(error)) {
              console.log('⚠️ Cloud creation failed, falling back to local', error.message);
              break;
            }
          }

          if (cloudRow) {
            const cloudAlbum = mapCloudAlbum(cloudRow);
            setState((s) => ({
              ...s,
              profile: { ...s.profile, firstName: firstName || s.profile.firstName },
              albums: [cloudAlbum, ...s.albums.filter((a) => a.id !== cloudAlbum.id)],
            }));
            return cloudAlbum;
          }
          // ── SUPABASE ALBUMS : fin ──
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
        if (supabase && state.user?.id) {
          // ── SUPABASE ALBUMS : intégration ──
          // RPC : le code est validé côté serveur (un non-membre ne peut
          // plus lire la table albums directement grâce à la RLS).
          // On envoie aussi le prénom pour la liste des membres.
          const { data, error } = await cloudJoinAlbum(code, state.profile.firstName);

          if (!error && data) {
            const cloudAlbum = mapCloudAlbum(data);
            // On l'ajoute au state local s'il n'y est pas déjà
            setState((s) => {
              if (s.albums.find((a) => a.id === cloudAlbum.id)) return s; // Déjà présent
              return { ...s, albums: [cloudAlbum, ...s.albums] };
            });
            return cloudAlbum;
          }

          // Code inexistant côté cloud : on continue vers le fallback local
          // (anciens albums hors-ligne). Autre erreur (réseau...) : idem.
          if (error) console.log('⚠️ Cloud join failed, trying local', error.message);
          // ── SUPABASE ALBUMS : fin ──
        }

        // 2. Fallback local (pour les vieux albums créés avant la mise en ligne)
        const found = state.albums.find((a) => a.code.toUpperCase() === code.toUpperCase());
        return found || null;
      },
      
          // ── CLOUD & LOCAL : Ajouter une photo ──
      addPhoto: async (albumId, uri) => {
        // ── SUPABASE ALBUMS : intégration ──
        // Cloud uniquement si l'album est réellement synchronisé :
        // un album local a un id timestamp (non-UUID) que la FK
        // photos.album_id refuserait. Les albums locaux restent 100 % local.
        const albumTarget = state.albums.find((a) => a.id === albumId);
        const canSyncPhoto = !!albumTarget?.cloud && isCloudId(albumId);
        // ── SUPABASE ALBUMS : fin ──

        // 1. Si pas de connexion cloud (ou album local), ancien système local
        if (!supabase || !state.user?.id || !canSyncPhoto) {
          setState((s) => ({
            ...s,
            albums: s.albums.map((a) =>
              a.id === albumId
                ? {
                    ...a,
                    photos: [
                      {
                        id: Date.now().toString() + Math.random(),
                        uri, // URI locale (file://...)
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
          return;
        }

        // 2. SYSTÈME CLOUD
        try {
           // Préparation du fichier (Compatible Web Data URI et Mobile File)
          let fileToUpload;

          if (uri.startsWith('data:') || uri.startsWith('blob:')) {
            // SUR LE WEB : On convertit le Data URI en objet Blob que Supabase comprend parfaitement
            const response = await fetch(uri);
            fileToUpload = await response.blob();
          } else {
            // SUR MOBILE (iOS/Android) : On garde le format fichier classique
            fileToUpload = {
              uri: uri,
              type: 'image/jpeg', 
              name: `${Date.now()}.jpg`
            };
          }

          // Étape A : Uploader le fichier physique dans le bucket Supabase
          const filePath = `${albumId}/${Date.now()}.jpg`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('album-photos')
            .upload(filePath, fileToUpload, { contentType: 'image/jpeg', upsert: false });

          if (uploadError) {
            console.log('📛 storage upload error:', uploadError);
            throw new Error(uploadError.message || "Erreur lors de l'envoi de l'image.");
          }

          // Étape B : Récupérer l'URL publique de l'image uploadée
          const { data: urlData } = supabase.storage.from('album-photos').getPublicUrl(uploadData.path);
          const publicUrl = urlData.publicUrl;

          // Étape C : Créer l'entrée dans la table SQL 'photos'
          const { data: photoData, error: dbError } = await supabase
            .from('photos')
            .insert({
              album_id: albumId,
              storage_path: uploadData.path,
              // ── SUPABASE ALBUMS : prénom pour le centre d'activités ──
              author_name: state.profile.firstName || '',
            })
            .select()
            .single();

          // On garde le VRAI message Supabase (RLS, colonne manquante...)
          // pour pouvoir diagnostiquer au lieu de deviner.
          if (dbError) {
            console.log('📛 photos insert error:', dbError);
            throw new Error(dbError.message || "Erreur d'enregistrement en base de données.");
          }

          // Étape D : Mettre à jour le state local avec l'URL du cloud
          const newPhoto = {
            id: photoData.id,
            uri: publicUrl, // On remplace l'URI locale par l'URL Cloud !
            // ── SUPABASE ALBUMS : intégration ──
            cloud: true,
            storagePath: uploadData.path, // nécessaire pour la suppression
            // ── SUPABASE ALBUMS : fin ──
            createdAt: Date.now(),
            liked: false,
            favorite: false,
            comments: [],
          };

          setState((s) => ({
            ...s,
            albums: s.albums.map((a) =>
              a.id === albumId ? { ...a, photos: [newPhoto, ...a.photos] } : a
            ),
          }));

          return newPhoto;

        } catch (error) {
          console.error("Erreur upload photo:", error);
          Alert.alert("Erreur réseau", error.message || "Impossible d'envoyer la photo.");
        }
      },
      
      toggleLike: (albumId, photoId) => {
        // ── SUPABASE ALBUMS : intégration ──
        // Toggle local immédiat (compteur compris) + synchro cloud (upsert/delete)
        const photo = state.albums
          .find((a) => a.id === albumId)
          ?.photos.find((p) => p.id === photoId);
        const newLiked = !photo?.liked;
        if (photo?.cloud) {
          // Prénom transmis pour le centre d'activités ("X a aimé…")
          cloudSetLike(photoId, newLiked, state.profile.firstName).catch(() => {});
        }
        // ── SUPABASE ALBUMS : fin ──
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
                          liked: !p.liked,
                          likesCount: Math.max(0, (p.likesCount || 0) + (newLiked ? 1 : -1)),
                        }
                      : p
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
        // ── SUPABASE ALBUMS : intégration ──
        // 1. Ajout local immédiat (id temporaire) — l'UI ne freeze jamais.
        // 2. Envoi cloud en arrière-plan : à la réponse, l'id temporaire
        //    est remplacé par l'id serveur et le commentaire passe cloud:true.
        const tempId = `tmp-${Date.now()}`;
        const author = state.profile.firstName || 'Vous';
        const addLocal = (id, cloud) =>
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
                              ...p.comments.filter((c) => c.id !== tempId),
                              { id, author, text, createdAt: Date.now(), replies: [], cloud },
                            ],
                          }
                        : p
                    ),
                  }
            ),
          }));

        const photo = state.albums
          .find((a) => a.id === albumId)
          ?.photos.find((p) => p.id === photoId);

        addLocal(tempId, false);

        if (photo?.cloud) {
          cloudAddComment(photoId, text, author === 'Vous' ? '' : author)
            .then(({ data }) => {
              if (data) addLocal(data.id, true); // remplace la copie temporaire
            })
            .catch(() => {}); // reste local si hors-ligne, synchro à la reconnexion
        }
        // ── SUPABASE ALBUMS : fin ──
      },

      // ── SUPABASE ALBUMS : intégration ──
      // Répondre à un commentaire (réponses synchronisées via parent_id).
      addReply: (albumId, photoId, parentCommentId, text) => {
        const tempId = `tmp-${Date.now()}`;
        const author = state.profile.firstName || 'Vous';
        const addLocalReply = (replyId, cloud) =>
          setState((s) => ({
            ...s,
            albums: s.albums.map((a) =>
              a.id !== albumId
                ? a
                : {
                    ...a,
                    photos: a.photos.map((p) =>
                      p.id !== photoId
                        ? p
                        : {
                            ...p,
                            comments: p.comments.map((c) =>
                              c.id !== parentCommentId
                                ? c
                                : {
                                    ...c,
                                    replies: [
                                      ...(c.replies || []).filter((r) => r.id !== tempId),
                                      { id: replyId, author, text, createdAt: Date.now(), cloud },
                                    ],
                                  }
                            ),
                          }
                    ),
                  }
            ),
          }));

        const photo = state.albums
          .find((a) => a.id === albumId)
          ?.photos.find((p) => p.id === photoId);

        addLocalReply(tempId, false);

        if (photo?.cloud) {
          cloudAddComment(photoId, text, author === 'Vous' ? '' : author, parentCommentId)
            .then(({ data }) => {
              if (data) addLocalReply(data.id, true);
            })
            .catch(() => {});
        }
      },

      // Supprimer un commentaire (ou une réponse) : auteur ou propriétaire.
      deleteComment: (albumId, photoId, commentId) => {
        const photo = state.albums
          .find((a) => a.id === albumId)
          ?.photos.find((p) => p.id === photoId);
        const target =
          photo?.comments.find((c) => c.id === commentId) ||
          photo?.comments.flatMap((c) => c.replies || []).find((r) => r.id === commentId);
        if (target?.cloud) cloudDeleteComment(commentId).catch(() => {});

        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id !== albumId
              ? a
              : {
                  ...a,
                  photos: a.photos.map((p) =>
                    p.id !== photoId
                      ? p
                      : {
                          ...p,
                          comments: p.comments
                            .filter((c) => c.id !== commentId)
                            .map((c) => ({
                              ...c,
                              replies: (c.replies || []).filter((r) => r.id !== commentId),
                            })),
                        }
                  ),
                }
          ),
        }));
      },
      // ── SUPABASE ALBUMS : fin ──
      
      // ── SUPABASE ALBUMS : intégration ──
      // Charge les photos cloud d'un album (appelé à l'entrée de l'album).
      // Fusion : le cloud remplace ses propres photos ; les photos locales
      // jamais synchronisées (album hors-ligne) sont conservées.
      refreshAlbumPhotos: async (albumId) => {
        const album = state.albums.find((a) => a.id === albumId);
        if (!album?.cloud) return;
        const { data: cloudPhotos, error } = await cloudFetchAlbumPhotos(albumId);
        if (error) return;

        // Commentaires (arborescence) + likes (compteurs + mes likes)
        const photoIds = cloudPhotos.map((p) => p.id);
        const { comments: cloudComments, likes: myLikes, likeCounts } =
          await cloudFetchInteractions(photoIds);

        setState((s) => ({
          ...s,
          albums: s.albums.map((a) => {
            if (a.id !== albumId) return a;
            const localOnly = a.photos.filter((p) => !p.cloud);
            const merged = cloudPhotos.map((cp) => {
              const prev = a.photos.find((p) => p.id === cp.id);
              const prevTop = prev?.comments || [];
              // Commentaires cloud + ceux encore purement locaux (hors-ligne) ;
              // les réponses locales non synchronisées sont conservées aussi.
              const serverTop = (cloudComments[cp.id] || []).map((sc) => {
                const pv = prevTop.find((c) => c.id === sc.id);
                const localReplies = (pv?.replies || []).filter((r) => !r.cloud);
                return { ...sc, replies: [...(sc.replies || []), ...localReplies] };
              });
              const localTemps = prevTop.filter((c) => !c.cloud);
              return {
                ...cp,
                liked: myLikes.has(cp.id),
                likesCount: likeCounts[cp.id] || 0,
                favorite: prev?.favorite ?? false, // les favoris restent personnels
                comments: [...serverTop, ...localTemps],
              };
            });
            return { ...a, photos: [...merged, ...localOnly] };
          }),
        }));
      },
      // ── SUPABASE ALBUMS : fin ──

      deletePhoto: (albumId, photoId) => {
        // ── SUPABASE ALBUMS : intégration ──
        // Suppression cloud en arrière-plan si la photo vient du cloud
        // (fichier Storage + ligne SQL). L'état local est maj de suite.
        const album = state.albums.find((a) => a.id === albumId);
        const photo = album?.photos.find((p) => p.id === photoId);
        if (photo?.cloud) cloudDeletePhoto(photo).catch(() => {});
        // ── SUPABASE ALBUMS : fin ──
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id === albumId ? { ...a, photos: a.photos.filter((p) => p.id !== photoId) } : a
          ),
        }));
      },

      // ── SUPABASE ALBUMS : intégration ──
      // Suppression multiple (mode sélection de l'écran Album).
      deletePhotos: (albumId, photoIds) => {
        const ids = new Set(photoIds);
        const album = state.albums.find((a) => a.id === albumId);
        (album?.photos || [])
          .filter((p) => ids.has(p.id) && p.cloud)
          .forEach((p) => cloudDeletePhoto(p).catch(() => {}));
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id === albumId
              ? { ...a, photos: a.photos.filter((p) => !ids.has(p.id)) }
              : a
          ),
        }));
      },

      // Renommer un album (owner). Mise à jour locale immédiate + cloud.
      renameAlbum: (albumId, name) => {
        const clean = String(name || '').trim();
        if (!clean) return;
        const album = state.albums.find((a) => a.id === albumId);
        if (album?.cloud) cloudRenameAlbum(albumId, clean).catch(() => {});
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) => (a.id === albumId ? { ...a, name: clean } : a)),
        }));
      },

      // Supprimer SON album (cloud : fichiers + ligne, cascade gère le reste).
      deleteAlbum: async (albumId) => {
        const album = state.albums.find((a) => a.id === albumId);
        setState((s) => ({ ...s, albums: s.albums.filter((a) => a.id !== albumId) }));
        if (album?.cloud) {
          const { error } = await cloudDeleteAlbum(albumId);
          if (error) console.log('⚠️ deleteAlbum cloud error:', error.message);
        }
      },

      // Quitter un album rejoint (non propriétaire).
      leaveAlbum: async (albumId) => {
        const album = state.albums.find((a) => a.id === albumId);
        setState((s) => ({ ...s, albums: s.albums.filter((a) => a.id !== albumId) }));
        if (album?.cloud) {
          const { error } = await cloudLeaveAlbum(albumId);
          if (error) console.log('⚠️ leaveAlbum cloud error:', error.message);
        }
      },

      // Membres réels d'un album cloud (appelé à l'entrée de l'écran Membres
      // + par le Realtime). Remplace la liste par la vérité serveur.
      refreshAlbumMembers: async (albumId) => {
        const album = state.albums.find((a) => a.id === albumId);
        if (!album?.cloud) return;
        const { data, error } = await cloudFetchAlbumMembers(albumId);
        if (error) return;
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id === albumId && data.length ? { ...a, members: data } : a
          ),
        }));
      },

      // Le propriétaire retire un membre (optimiste en local + cloud).
      removeAlbumMember: (albumId, userId) => {
        const album = state.albums.find((a) => a.id === albumId);
        if (album?.cloud) cloudRemoveMember(albumId, userId).catch(() => {});
        setState((s) => ({
          ...s,
          albums: s.albums.map((a) =>
            a.id === albumId
              ? { ...a, members: a.members.filter((m) => m.userId !== userId) }
              : a
          ),
        }));
      },
      // ── SUPABASE ALBUMS : fin ──
    }),
    [ready, state]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}