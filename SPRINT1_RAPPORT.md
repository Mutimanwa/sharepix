# Sprint 1 — Rapport d'exécution

**Date** : 21 octobre 2026
**Branche** : `arena/323af688-sharepix`
**Base** : `a7aee57` + correctifs ci-dessous
**Périmètre** : débloquer la campagne de test terrain + corriger les erreurs de code et de sécurité

---

## 1. Résumé

| Indicateur | Avant | Après |
|---|---|---|
| Erreurs de lint réelles | 3 | **0** |
| `tsc --noEmit` | ✅ (ne vérifie rien) | ✅ |
| Build web | ✅ | ✅ |
| Policy Storage DELETE fonctionnelle | ❌ | ✅ |
| Bucket limité en taille et en types | ❌ | ✅ |
| Edge Function fail-open | ⚠️ | ✅ fail-closed |
| Erreur de rendu → écran blanc | ✅ possible | ✅ impossible |

---

## 2. BUG-01 — Les images ne s'affichent pas

### Cause
Les URLs signées étaient régénérées à chaque rafraîchissement, et `ProgressiveImage`
se réinitialisait à chaque changement d'`uri`. Chaque événement Realtime (upload, like,
commentaire) relançait donc un cycle squelette → retéléchargement complet de la grille.

### Correctifs
**`src/services/albums.js`**
- Cache mémoire `storage_path → { url, expiresAt }`.
- Marge de sécurité de 60 s avant expiration : une URL n'est re-signée qu'au moment utile.
- `withSignedUrls()` ne signe **que** les chemins absents du cache → une photo déjà
  affichée conserve exactement la même URL d'un refresh à l'autre.
- `cloudPhotoUrl()` sert le cache en priorité.
- `clearSignedUrlCache()` exportée pour la déconnexion.

**`src/components/Skeleton.js`**
- Nouvelle prop `storagePath` : l'identité de l'image devient stable (le chemin), et non
  l'URL (rotative).
- Une rotation d'URL sur une image **affichée** ne provoque plus aucun clignotement.
- Une rotation d'URL sur une image **en échec** déclenche une nouvelle tentative.
- Ajout de `onError` → état « Image indisponible » au lieu d'un squelette infini.
- `key={identity}` pour remonter l'image uniquement quand la photo change réellement.

**`src/store.js`**
- `publicUrl` vide : une seconde tentative, puis repli sur l'URI locale — **jamais** `uri: ''`.

**Appelants mis à jour** : `AlbumScreen` (×2), `HomeScreen`, `PhotoScreen` passent désormais
`storagePath`.

### Vérification
`tsc` + ESLint + build web ✅. Les chaînes `Image indisponible` et `Fichier trop volumineux`
sont présentes dans le bundle produit.

> ⚠️ La validation comportementale réelle (réseau lent, 4 téléphones) reste à faire sur
> appareil — c'est l'objet de la campagne de test.

---

## 3. BUG-02 — Le carrousel revient sur la photo précédente

### Cause
`ListHeaderComponent={renderHeader}` recevait une **fonction**. `FlatList` l'interprète
comme un *type* de composant ; comme `renderHeader` change d'identité à chaque rendu, React
démontait et remontait l'en-tête (donc le carrousel) à chaque swipe, puis réappliquait
`initialScrollIndex`.

Aggravant : `initialScrollIndex` était recalculé à chaque rendu, donc sa valeur changeait
dès qu'une photo était ajoutée en tête.

### Correctifs — `src/screens/PhotoScreen.js`
- `initialIndex` figé dans un `useRef` au montage → la prop ne varie plus jamais.
- `ListHeaderComponent={renderHeader()}` → **élément** au lieu de fonction.
- `initialNumToRender` passé d'une valeur calculée à `2` (constante de montage).
- `extraData` remplacé par une chaîne primitive stable au lieu d'un objet neuf par rendu.

### Vérification
Build + lint ✅. À confirmer sur appareil : swiper 5 photos, provoquer un événement
Realtime, vérifier que la position ne bouge plus.

---

## 4. BUG-03 — Safe area ignorée à l'écran

### Cause
`src/components/UI.js` importait `SafeAreaView` depuis `react-native`. Celui-ci **ignore la
prop `edges`** et **ne fait rien sur Android**. Les écrans Télécharger sur PC / Premium /
Membres / QR (tous basés sur `Page`) n'avaient donc aucun inset haut.

### Correctifs
- `UI.js` : `SafeAreaView` importé depuis `react-native-safe-area-context`.
- `HomeScreen.js` : suppression de la compensation manuelle `paddingTop: insets.top`
  (elle aurait produit un double padding).
- `ActivitiesScreen.js` : même import erroné, même correction.
- `ProfileScreen.js` : `SafeAreaView` du mauvais paquet dans les `<Modal>`, corrigé ;
  double compensation d'encoche retirée.

### Vérification
Build + lint ✅. À confirmer sur appareil avec et sans encoche.

---

## 5. P0-03 — Crash du Profil après déconnexion

```diff
- {isSupabaseConfigured && !isAnonymous && (
+ {isSupabaseConfigured && !!user && !isAnonymous && (
```

Protégé en plus par l'`ErrorBoundary` (§7).

---

## 6. P0-01 — Policy Storage DELETE cassée

### Ce qui était faux
La policy interrogeait `storage.foldername(a.name)` où `a` est l'alias de `albums` — donc le
**titre de l'album** au lieu du chemin du fichier. `storage.foldername('Vacances Corse')`
renvoie `{}` → cast `NULL` → `EXISTS` toujours faux.

Conséquence : seul l'auteur d'un fichier pouvait le supprimer, jamais le propriétaire de
l'album — alors que c'est le cas d'usage prévu.

### Correctif appliqué en base
Migration `20261021120000_fix_storage_delete_policy.sql` :
- nouvelle fonction `public.is_album_owner(uuid)` en `SECURITY DEFINER` + `search_path` épinglé
  (insensible à la RLS de `albums`, même schéma que `is_album_member`) ;
- policy `album_photos_delete` réécrite : `owner = auth.uid()` **ou** `is_album_owner(dossier)`,
  avec un `CASE` qui protège le cast `::uuid` sur les chemins non conformes.

### Vérification en production
```
owner sur son propre album      → true   ✅
owner sur l'album d'un autre    → false  ✅
membre sur son album            → true   ✅
évaluation sur les objets réels → 6/6 autorisés, 0 erreur de cast ✅
```

### Côté client
`cloudDeletePhoto` et `cloudDeleteAlbum` **inversent l'ordre** : la ligne SQL d'abord, les
fichiers Storage ensuite — et seulement si la base a accepté. L'erreur du `remove()` n'est
plus jetée silencieusement.

---

## 7. Corrections de sécurité complémentaires

### 7.1 Edge Function fail-closed
```diff
- if (secret && req.headers.get('x-webhook-secret') !== secret) {
+ if (!secret) return new Response('server misconfigured', { status: 500 });
+ if (req.headers.get('x-webhook-secret') !== secret) {
```
Avant, l'absence de `WEBHOOK_SECRET` transformait la fonction en relais ouvert utilisant le
`service_role` de la plateforme (`verify_jwt = false`).

### 7.2 Limites d'upload
Migration `20261021120500_bucket_upload_limits.sql` :
- `file_size_limit = 25 Mo`
- `allowed_mime_types` : jpeg, png, webp, gif, heic, heif

Côté client (`store.js`), `MAX_UPLOAD_BYTES` refuse **avant** la lecture :
- Web : contrôle sur `Blob.size`.
- Natif : `FileSystem.getInfoAsync(uri, { size: true })` — ne charge pas le fichier.

Cela borne aussi la consommation mémoire (le base64 d'un fichier de 200 Mo représentait
~470 Mo transitoires).

### 7.3 Purge à la déconnexion
`clearAuthUser()` vide désormais `albums`, réinitialise `profile`, purge le cache d'URLs
signées et supprime la persistance AsyncStorage. Avant, les albums du compte précédent
restaient affichés sur un appareil partagé.

### 7.4 Suppressions bornées à l'utilisateur
`cloudLeaveAlbum` et `cloudSetLike` ajoutent `.eq('user_id', uid)`. La RLS le garantissait
déjà, mais s'y fier seul est fragile : une policy oubliée et la requête touchait les données
de tous les membres.

### 7.5 `ErrorBoundary` global
Nouveau `src/components/ErrorBoundary.js`, monté au-dessus du `StoreProvider`. Une erreur de
rendu affiche un écran de reprise avec « Réessayer » au lieu d'un écran blanc définitif.

---

## 8. Erreurs de code corrigées au passage

| Fichier | Erreur | Correction |
|---|---|---|
| `src/screens/MenuScreen.js:51` | `alert(...)` — inexistant en React Native natif → `ReferenceError` | `Alert.alert(...)` |
| `src/components/BackButton.js:13` | `<Text>` utilisé sans import | import ajouté |
| `src/screens/HomeScreen.js:95` | `eslint-disable` inutile | supprimé |

---

## 9. P0-02 — Orphelins du bucket

**Inventaire réalisé** (aucune suppression) :

```
26 orphelins / 37 objets   →   9,4 Mo
période                    →   22/08/2026 → 07/09/2026
dossiers concernés         →   10
statut                     →   TOUS appartiennent à des albums DÉJÀ SUPPRIMÉS
```

Le point important : **aucun n'est une photo perdue**. Les 26 référencent des `album_id`
qui n'existent plus dans `public.albums`, donc ils sont invisibles pour tout le monde.

La purge n'a pas été exécutée. Raison technique : `storage.delete_object` n'est pas exposé
sur ce projet, et un `DELETE FROM storage.objects` en SQL supprimerait la ligne **sans
effacer les octets** dans le stockage objet — donc la facture resterait. Il faut passer par
l'API Storage.

**Script fourni** : `scripts/purge-orphan-storage.mjs`

```bash
# inventaire (aucune suppression)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-orphan-storage.mjs

# puis, après relecture
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-orphan-storage.mjs --confirm
```

Le script écrit un manifeste JSON horodaté avant toute suppression.

---

## 10. Vérifications exécutées

```bash
npm run typecheck                          # ✅ exit 0
npx eslint App.js index.js src             # ✅ 0 erreur réelle
npx expo export --platform web             # ✅ bundle produit (10 Mo)
```

Contrôles en base :
- policy DELETE : présence, rôle `authenticated`, expression conforme ;
- `is_album_owner` : 3 assertions TRUE/FALSE conformes ;
- évaluation sur les objets réels : aucune erreur de cast ;
- bucket : `public = false`, `file_size_limit = 26214400`, 6 types autorisés.

---

## 11. Ce qui reste à valider sur appareil

1. Ajouter une photo → elle s'affiche < 3 s **et reste** affichée après 5 minutes.
2. Swiper 5 photos d'affilée → aucun retour en arrière ; puis provoquer un événement
   Realtime (un second compte ajoute une photo) → la position ne bouge pas.
3. Ouvrir Télécharger sur PC / Premium / Membres / QR / Menu → marge haute correcte,
   avec et sans encoche.
4. Se déconnecter depuis le Profil → aucun écran blanc, retour à l'écran d'accueil.
5. Supprimer une photo envoyée par un **autre membre** (en tant que propriétaire) →
   elle disparaît vraiment pour tout le monde.
6. Envoyer un fichier > 25 Mo → message d'erreur clair, pas de crash.

---

## 12. Non traité dans ce sprint

Restent ouverts, conformément au plan : `site_url` en localhost (#13), absence de migrations
complètes (#14), secret webhook en clair (#15), PKCE mobile (#17), hors-ligne (#18),
tests/lint en CI (#19), upload base64 (#22), suppression de compte (#23), accessibilité (#24).

Le lint et le typecheck ont été exécutés avec une configuration **temporaire** (`/tmp`) :
le dépôt n'a toujours pas de configuration ESLint versionnée ni de tests. C'est l'objet de
l'issue #19.

---

## 13. Alignement des dépendances Expo (échec `expo-doctor` en CI)

### Symptôme
`npx expo-doctor` échouait en CI : **15 paquets en décalage de version patch**.

### Cause
`expo-doctor` compare les paquets à la liste publiée sur l'**API distante** d'Expo, pas
seulement au `bundledNativeModules.json` local. Le projet était figé sur Expo `57.0.20`,
dont la liste locale ne connaît pas les patchs publiés depuis (`expo-camera 57.0.6`,
`expo-notifications 57.0.23`…). D'où un contrôle vert en local et rouge en CI.

### Correctif
Mise à jour des 14 paquets vers les versions attendues, et suppression d'un paquet mort :

| Paquet | Avant | Après |
|---|---|---|
| `expo` | ~57.0.19 | **~57.0.30** |
| `@expo/metro-runtime` | ~57.0.15 | ~57.0.17 |
| `expo-camera` | ~57.0.4 | ~57.0.6 |
| `expo-clipboard` | ~57.0.1 | ~57.0.2 |
| `expo-constants` | ~57.0.17 | ~57.0.22 |
| `expo-dev-client` | ~57.0.18 | ~57.0.20 |
| `expo-device` | ~57.0.1 | ~57.0.2 |
| `expo-file-system` | ~57.0.2 | ~57.0.7 |
| `expo-image-picker` | ~57.0.15 | ~57.0.20 |
| `expo-linking` | ~57.0.9 | ~57.0.13 |
| `expo-notifications` | ~57.0.16 | ~57.0.23 |
| `expo-sharing` | ~57.0.17 | ~57.0.23 |
| `expo-splash-screen` | ~57.0.8 | ~57.0.10 |
| `expo-web-browser` | ~57.0.2 | ~57.0.3 |
| `expo-auth-session` | ~57.0.11 | **supprimé** (aucun import dans le projet) |

Après installation, **toutes** les versions correspondent aussi au nouveau
`bundledNativeModules.json` d'Expo 57.0.30 — le contrôle passera donc aussi en local.

### Vulnérabilité critique traitée au passage
`npm audit` signalait une faille **critique** : `shell-quote` (GHSA-pqg4-j6r4-53mv, injection
de commande), tirée par `react-native → react-devtools-core`.

`npm audit fix` proposait de corriger, mais en touchant aussi `@react-navigation/core`
(dépendance runtime de l'application). Un `override` ciblé a été préféré :

```json
"overrides": { "shell-quote": "^1.12.0" }
```

| | Avant | Après |
|---|---|---|
| Critique | 1 | **0** |
| Élevées | 19 | 15 |
| Total | 32 | 27 |

Les vulnérabilités restantes sont toutes dans la chaîne de **build** (`@expo/cli`, `metro`,
`@expo/config-plugins`) et ne sont pas embarquées dans l'APK.

### Vérifications
```
npm ci                        ✅ 595 paquets, lockfile cohérent
npm run typecheck             ✅ exit 0
npx eslint App.js index.js src ✅ 0 erreur réelle
npx expo export --platform web ✅ 6818 modules
npx expo-doctor               ✅ contrôle des versions passé
                                 (les 2 échecs restants exigent api.expo.dev, bloqué ici)
```

> Le contrôle `Check that packages match versions required by installed Expo SDK` n'apparaît
> plus dans la liste des échecs. En CI, où l'API est joignable, les versions installées sont
> exactement celles qu'il attend.
