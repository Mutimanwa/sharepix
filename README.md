# SharePix

Application mobile privée de partage de photos d'événements — mariages,
vacances, baptêmes, anniversaires.

→ **sharepix.app** · Android · préparation iOS en cours (cible iOS 16.4,
tests iPhone non réalisés) · édité par Coral Orca Limited

---

## Le problème

Sur un événement, les photos sont éparpillées : chacun photographie de son
côté, puis réclame les images des autres par messagerie. Résultat : des
albums compressés et incomplets, des liens publics accessibles à n'importe
qui, et des photos qui finissent par ne plus être retrouvées.

Les groupes privés existants échouent sur deux points : ils sont **publics
par défaut** (un lien suffit à entrer) et ils **recompressent** les images.

## La solution

Un album = **un code d'invitation à 8 caractères** (ou un QR code).
Seules les personnes à qui vous transmettez ce code voient le contenu.
Les photos sont envoyées dans un espace privé après préparation locale
(redimensionnement jusqu’à 2048 px et recompression JPEG selon le fichier).

Trois principes :

1. **Privé par défaut** — aucun album n'est découvrable ni indexable.
2. **Sans friction** — pas de formulaire à l'inscription : l'utilisateur
   reçoit un compte anonyme en un geste, qu'il peut convertir en compte
   permanent plus tard **sans perdre ses photos**.
3. **Vérifiable** — l'accès repose sur la base de données (Row Level
   Security), pas sur l'interface. Une requête forgée ne passe pas.

## Fonctionnalités

**Albums**
- Création atomique (fonction SQL `create_album`)
- Rejoindre par code à 8 caractères ou par **scan de QR code**
  (deep link `sharepix://join?code=XXXXXXXX`)
- Renommer, quitter, retirer un membre, supprimer (fichiers + cascades)
- Compteurs de photos et couvertures **en temps réel**, dès l'accueil

**Photos**
- Import depuis la galerie, envoi avec barre de progression
- Suppression réservée à l'auteur de la photo ou au propriétaire
- Visionneuse plein écran : défilement horizontal paginé, **cache disque**
  (une photo déjà vue ne se recharge plus), téléchargement, favoris
- Commentaires, réponses imbriquées, likes
- Centre d'activités temps réel (qui a rejoint, publié, commenté, aimé)

**Comptes**
- Compte anonyme automatique à la première ouverture
- Conversion en compte permanent (e-mail ou liaison Google) conservant
  le même `user_id`, donc les mêmes albums
- Suppression de compte **avec purge des fichiers Storage**

**Notifications**
- Push Android (FCM V1) : nouvelles photos, likes, commentaires;
  iOS/APNs reste à valider sur appareil
- Préférences par type, enregistrées côté serveur
- Fonction Edge `activity-push` déclenchée par webhook sur `activity_log`

## Comment ça marche

```
Organisateur                        Invité
───────────                         ──────
crée l'album  ──► code 8 car. ──►   scanne le QR / saisit le code
   │                                        │
   └──────────── même album ────────────────┘
                    │
        photos préparées à l'envoi
        stockées dans un bucket privé
        diffusées par URL signée (1 h)
```

## Stack technique

| Couche | Technologie |
|---|---|
| Application | React Native 0.86 · Expo SDK 57 · React 19 |
| Navigation | React Navigation (stack + tabs), deep linking |
| Backend | Supabase (PostgreSQL 17) |
| Auth | Comptes anonymes → conversion (`linkIdentity`) |
| Stockage | Bucket privé `album-photos`, URLs signées 1 h |
| Temps réel | Supabase Realtime (photos, membres, commentaires, likes) |
| Push | Edge Function Deno `activity-push` + FCM V1 |
| Images | `expo-image` (cache mémoire + disque) |
| CI/CD | GitHub Actions + EAS Build; publication OTA présente mais réception par l'app non configurée |

## Sécurité

La sécurité ne repose pas sur le client mais sur la base :

- **RLS active sur les 9 tables** — aucune lecture sans session,
  aucune ligne visible hors des albums dont on est membre.
- **Bucket privé** — `public = false`, aucune URL permanente.
  Les images sont servies par URL signée expirant en 1 h.
- **Suppression contrôlée** — une policy dédiée vérifie l'appartenance
  réelle de l'album avant d'effacer un fichier Storage.
- **Limites d'envoi** — 25 Mo maximum, types MIME restreints
  (jpeg, png, webp, gif, heic, heif).
- **Secret du webhook dans Vault** — il n'apparaît plus dans la
  définition du trigger, donc plus dans les sauvegardes de schéma.
- **Vérifié en continu** — la CI exécute un test d'intrusion RLS
  (lecture anonyme, lecture inter-albums, accès au Storage) contre un
  projet de test dédié, jamais contre la production.

Détail des constats : [audit technique](docs/AUDIT_SHAREPIX.md). Les documents
de projet sont indexés dans [`docs/`](docs/README.md).

## Lancer le projet

```bash
npm install
npx expo start
```

- Android : `a` · iOS : `i` · Web (aperçu) : `w`

### Dev build (push + deep links)

Le push FCM et le schéma `sharepix://` exigent un build EAS :

```bash
npx eas-cli build --profile development --platform android
npx expo start --dev-client
```

Prérequis : `google-services.json` à la racine et une clé de compte de
service FCM V1 (`npx eas-cli credentials`).
Guides : [CI/CD et credentials](docs/CICD.md),
[notifications](docs/NOTIFICATIONS_FINAL_REFINEMENT.md) et
[préparation iOS](docs/IOS_READINESS_PLAN.md).

## Build & distribution

```bash
npx eas-cli build --platform android --profile preview     # APK de test
npx eas-cli build --platform android --profile production  # Android store
npx eas-cli build --platform ios --profile preview         # IPA interne (credentials Apple requis)
```

La cible iOS configurée est 16.4; le build et l'installation sur iPhone
restent à valider. **Ajout d'un module natif** (ex. `expo-image`) : une mise
à jour JS seule ne suffit pas, le binaire doit être reconstruit.

## Base de données

Le schéma vit dans `supabase/migrations/`, seule source de vérité :

| Migration | Contenu |
|---|---|
| `20261021000000_initial_schema.sql` | État complet : 9 tables, index, 8 fonctions, 6 triggers, 21 policies, bucket privé |
| `20261021120000_fix_storage_delete_policy.sql` | Policy DELETE du Storage (appartenance de l'album) |
| `20261021120500_bucket_upload_limits.sql` | 25 Mo + types MIME autorisés |
| `20261023122932_notification_preferences.sql` | Préférences de notifications par compte |
| `20261024064336_notification_center_batching.sql` | Regroupement et rappels du centre d'activités |
| `20261024071955_photo_metadata_deduplication.sql` | Métadonnées et détection de doublons photo |

```bash
npx supabase link --project-ref <ref>
npx supabase db push        # applique les migrations
npx supabase db pull        # récupère un écart éventuel
```

## Structure

```
App.js                  navigation, deep links, portail d'authentification
src/
  screens/              Splash, Onboarding, Auth, Home, Album, Photo,
                        Activities, Profile, Menu + écrans secondaires
  components/           UI, PhotoCarousel, Skeleton, AlbumArt, ErrorBoundary
  services/             auth.js, albums.js, push.js  (Supabase)
  store.js              état global, actions, persistance AsyncStorage
  config.js             configuration Supabase
supabase/
  migrations/           schéma versionné (source de vérité)
  functions/            Edge Function activity-push (Deno)
  rls-check.cjs         test d'intrusion RLS (nécessite un projet de test)
```

## Sentry (rapport de crash)

Le SDK et le plugin natif sont intégrés. Les variables Sentry ont été
configurées pour EAS selon le plan d'implémentation, mais l'upload des source
maps et la réception d'un événement de test restent à valider. En local,
configurer le DSN dans `.env` :

```bash
cp .env.example .env
# renseigner EXPO_PUBLIC_SENTRY_DSN sans le publier
```

Sentry est un module natif : il faut un build (EAS ou dev client), pas
Expo Go. Les rapports excluent les données personnelles par défaut et le
filtrage retire les URL d'authentification contenant un `?code=`.

## Qualité

```bash
npm run typecheck                        # tsc --noEmit (JS vérifié par @ts-check)
npm run lint                             # ESLint 9 (config Expo)
npm test                                 # Jest (jest-expo)
npm run verify                           # les trois d'affilée
npx expo export --platform web           # build de contrôle (graphe Metro)
node supabase/rls-check.cjs              # audit RLS (projet de test)
```

Le typage est **incrémental** : `checkJs` reste désactivé globalement (le
projet est en JS) et les fichiers sensibles portent `// @ts-check` en tête
(génération des codes, auth, albums, store, push, carrousel d'images). Les
tests couvrent la logique pure — codes d'invitation, calcul de
redimensionnement, contrat du deep link OAuth — c'est-à-dire les règles qui
ne peuvent pas être vérifiées à l'œil sur un téléphone.

CI (`.github/workflows/ci.yml`) : TypeScript, ESLint, Jest, Expo Doctor,
Edge Function (Deno check & lint), RLS/Storage. Détail :
[`docs/CICD.md`](docs/CICD.md).

## Limites connues

- **Photos uniquement.** Contrairement à ce qu'annonçait ce fichier, le
  schéma **ne prévoit pas** `media_type` : la table `photos` n'a que
  `id, album_id, storage_path, created_at, uploader_id, author_name`, et le
  bucket `album-photos` n'accepte que six types MIME d'images (plafond
  25 Mo). L'import vidéo demande donc une migration, un envoi en flux (la
  lecture base64 actuelle ne tient pas 50 Mo en mémoire) et un lecteur.
  Ordre retenu : images → production → vidéo → premium. Voir
  [`docs/DECISIONS.md`](docs/DECISIONS.md) (D-05).
- **Pas de premium fonctionnel** : l'écran « Album Premium » est une
  vitrine, aucun paiement n'est branché et aucune notion d'abonnement
  n'existe en base.
- **Pas de file hors-ligne** : sans réseau, l'application fonctionne en
  mode local mais ne rejoue pas les envois à la reconnexion.
- Pas encore de pagination sur les albums volumineux.
- Contrastes à retravailler sur les libellés corail (accessibilité).
- Les contrôles RLS/Storage de la CI ciblent le projet de test dédié; ils ont
  passé dans le dernier run de la PR #37. Sans secrets de staging, le workflow
  prévient et ne teste rien plutôt que de basculer vers la production.
- La publication `eas update` existe, mais l'app ne consomme pas encore ces
  mises à jour : `expo-updates` et sa configuration runtime manquent.
- iOS est configuré (cible minimale 16.4), mais aucun IPA n'a encore été
  installé ni testé sur iPhone.

La documentation est regroupée et indexée dans [`docs/README.md`](docs/README.md).
Le [plan d'action](docs/PLAN_ACTION.md) et les [décisions](docs/DECISIONS.md)
sont des snapshots datés; consulter leur date et ne pas les prendre pour l'état
courant sans vérification.

## Licence

Projet privé — © Coral Orca Limited. Tous droits réservés.
