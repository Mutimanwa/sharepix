# SharePix 

Application mobile privée de partage d'albums photo/vidéo d'événements
(mariages, vacances, famille…), inspirée des maquettes Celebrate et du
cahier des charges SharePix.

Principe : un album = un code d'invitation à 8 caractères (+ QR). Seuls
les membres invités voient le contenu. Fonctionne hors-ligne et se
synchronise dès que le réseau revient (offline-first).

## Stack

- **React Native 0.86 + Expo SDK 57** (React 19)
- **Supabase** (backend managé) :
  - Auth : comptes **anonymes** automatiques, conversion en compte
    permanent (e-mail ou liaison Google, `linkIdentity`)
  - Postgres + **RLS durcie** (aucune lecture possible sans session,
    aucun accès hors membres d'un album)
  - **Storage privé** (bucket `album-photos`, URLs signées 1 h)
  - **Realtime** (photos, membres, commentaires, likes, activité)
  - Edge Function `activity-push` + Webhook (notifications)
- React Navigation (stack + tabs), `linking` configuré
  (deep link `sharepix://join?code=XXXXXXXX`)
- AsyncStorage (persistance locale)
- expo-image-picker, expo-notifications (push FCM), expo-linking
- EAS Build (dev client Android, package `app.sharepix.mobile`)

## Fonctionnalités

- Albums cloud multi-appareils : création RPC atomique, rejoindre par
  code ou **QR deep link** (scan → feuille "Rejoindre" pré-remplie +
  recherche automatique)
- Accueil vivant : **compteurs de photos + couvertures** pré-chargés au
  boot et mis à jour en **Realtime** (sans entrer dans l'album)
- Photos : upload cloud (storage privé), suppression, sélection multiple,
  commentaires + réponses, likes, favoris personnels
- Centre d'activités temps réel (qui a rejoint / publié / commenté /
  aimé), avec masquage individuel (persistance serveur)
- Gestion d'album : renommer (owner), quitter, retirer un membre,
  supprimer (fichiers + cascades)
- Conversion invité → compte permanent sans perte de données
  (même `user_id`) ; erreurs OAuth remontées proprement
- Notifications push (Android/FCM V1) : tokens en base, préférences par
  type (photos, likes, commentaires), Edge Function `activity-push`
- Chargement : squelettes + images progressives (pulsation → fondu)
- Mode 100 % local si Supabase absent/hors-ligne (repli gracieux)

## Lancer

```bash
npm install
npx expo start
```

- Android (Expo Go) : `a`
- iOS : `i`
- Web (aperçu) : `w`

### Dev build (push + deep links mobiles)

Le push FCM et le scheme `sharepix://` exigent un dev build EAS :

```bash
npx eas-cli build --profile development --platform android
npx expo start --dev-client
```

Prérequis : `google-services.json` à la racine + clé de compte de
service FCM V1 uploadée via `npx eas-cli credentials`.
Guide complet : [`supabase/PUSH.md`](supabase/PUSH.md).

## Backend Supabase

Tout est décrit dans [`supabase/`](supabase/) :

| Fichier | Rôle |
| --- | --- |
| `supabase/schema.sql` | Schéma complet (§0-§13) : tables, RLS, RPC security-definer, triggers activité, storage privé, push tokens. **Ré-exécutable en entier, idempotent** (à rejouer après chaque évolution). |
| `supabase/rls-check.cjs` | Harnais de vérification : `node supabase/rls-check.cjs` — fuit-e-elle la base ? (sessions anonymes fraîches, storage, URL publique refusée). Exit 1 au moindre problème. |
| `supabase/functions/activity-push/` | Edge Function appelée par le Webhook `activity_log` → Expo Push API. |
| `supabase/GUIDE.md` | Mise en place pas à pas du backend. |
| `supabase/PUSH.md` | Notifications push : Edge Function, Webhook, FCM, builds. |

Configuration app : `src/config.js` (URL projet + clé **anon** — jamais
de `service_role` côté client, tout passe par la RLS et les RPC).

## Parcours

1. Splash corail (routage selon session : onboarding / auth / accueil)
2. Onboarding (créer / rejoindre un album)
3. Accueil : albums avec compteurs + couvertures en direct
4. Album (Tous / Vidéos / Favoris) : photos, commentaires, likes
5. Invitation : code 8 caractères + **QR `sharepix://join?code=…`**
6. Centre d'activités temps réel
7. Profil : conversion de compte, préférences de notifications
8. Premium / Téléchargement PC

## Structure

```
App.js                  Navigation + deep linking (join, auth callback)
src/
  config.js             URL Supabase + clé anon
  store.js              État global (offline-first, fusion cloud/local)
  theme.js              Couleurs (teal #2BA3A8, corail #E07A6A, crème #F3F8F8)
  lib/supabase.js       Client Supabase
  services/
    auth.js             Sessions anonymes, conversion, OAuth Google
    albums.js           Repository cloud (albums, photos, membres,
                        activité, URLs signées, abonnements Realtime)
    push.js             Enregistrement des tokens FCM
  components/
    UI.js               Page, Sheet, CoralButton, Field… (design system)
    Skeleton.js         Squelettes + ProgressiveImage
  screens/              Home, Album, Photo, Activités, Profil, Auth…
supabase/               Schema SQL, guides, Edge Function, harnais RLS
```
