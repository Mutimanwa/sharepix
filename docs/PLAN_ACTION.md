# SharePix — Plan d'action

**Snapshot historique** · créé le 21/10/2026 · branche `arena/323af688-sharepix`
**Base de référence à cette date** : `AUDIT_SHAREPIX.md` (audit v4)

> Ce plan décrit l'état et les tâches observés au démarrage du projet. Il n'est
> plus la source de vérité pour le backlog courant : plusieurs correctifs,
> migrations et livraisons ont eu lieu depuis. Vérifier chaque point contre le
> code et les rapports récents avant de le traiter comme encore ouvert.

---

## État d'avancement — Sprint 1 (21/10/2026)

| Élément | Statut | Vérification |
|---|---|---|
| BUG-01 · Cache des URLs signées + `onError` + garde URL vide | ✅ **résolu** (après Sprint 1 bis) | validé par l'utilisateur sur appareil |
| BUG-02 · `initialScrollIndex` figé + `ListHeaderComponent` en élément | ✅ **résolu** (après Sprint 1 bis) | idem |
| **Sprint 1 bis** · Carrousel isolé et mémoïsé (`PhotoCarousel`) + `expo-image` + fenêtre élargie + registre d'images chargées | ✅ **fait, mergé (PR #26)** | typecheck + build web (10 MB) + **re-test terrain concluant** |
| BUG-03 · `SafeAreaView` depuis `react-native-safe-area-context` | ✅ **fait** | idem |
| P0-03 · Crash du Profil (`user === null`) | ✅ **fait** | idem |
| P0-01 · Policy Storage DELETE | ✅ **fait et testé en base** | `is_album_owner` → true/false conformes |
| P0-02 · Orphelins | 🟡 **inventoriés, purge à valider** | 26 objets, tous d'albums supprimés |
| *(bonus)* Edge Function fail-closed | ✅ **fait** | — |
| *(bonus)* Limites bucket + plafond client 25 Mo | ✅ **fait** | bucket vérifié en base |
| *(bonus)* `clearAuthUser` purge l'état et le cache | ✅ **fait** | — |
| *(bonus)* `ErrorBoundary` global | ✅ **fait** | — |
| *(bonus)* Lint : 3 erreurs réelles corrigées | ✅ **fait** | 0 erreur |

Détail complet : `SPRINT1_RAPPORT.md` (§14 pour le carrousel).

## État d'avancement — Sprint 2 (21/10/2026)

| Élément | Statut | Vérification |
|---|---|---|
| **P1-04** · Secret webhook sorti du catalogue → Vault | ✅ **fait et testé** | 401 sans secret, 200 avec ; trigger sans secret |
| **P1-01** · `site_url` + `uri_allow_list` sur le domaine réel | ✅ **fait** | `https://sharepix.app` + `sharepix://auth/callback` |
| **P1-06** · Purge Storage à la suppression de compte | ✅ **fait** | `my_storage_paths()` + `auth.js` ; reste à valider sur appareil |
| *(bonus)* Index dupliqué `albums_code_unique` | ✅ supprimé | `albums_code_key` conserve l'unicité |
| **P1-02** · Migration initiale versionnée | ✅ **fait** | `20261021000000_initial_schema.sql`, relevée du catalogue |
| **P1-03** · Suppression des 4 SQL destructeurs | ✅ **fait** | `schema.sql` et consorts retirés, références corrigées |
| **P1-16** · CI qui n'écrit plus en production | ✅ **fait** | `rls-check.cjs` lit l'environnement ; projet `sharepix-staging` provisionné et aligné sur la prod |
| P1-16 · secrets `STAGING_SUPABASE_*` | ⬜ **à coller dans GitHub** | jeton de session en lecture seule sur les secrets (403) |
| *(bonus)* URL du webhook sortie du schéma | ✅ **fait** | lue dans Vault ; un projet sans secrets est inerte |

Détail : section « Sprint 2 » ci-dessous.

---

## Légende

| Sévérité | Signification |
|---|---|
| 🔴 **P0** | Casse une fonctionnalité visible, perd des données ou bloque la distribution |
| 🟠 **P1** | Fonctionnalité annoncée inopérante, risque de perte ou faille exploitable |
| 🟡 **P2** | Dette sérieuse : performance, accessibilité, coûts |
| ⚪ **P3** | Hygiène, cosmétique |

| Statut | |
|---|---|
| ⬜ | À faire |
| 🔄 | En cours |
| ✅ | Fait |

---

# BLOC A — Bugs constatés en test réel

> **À traiter en premier.** Ces quatre points ont été signalés après essai sur 4 téléphones.

---

## 🔴 BUG-01 — Les images ne s'affichent pas (squelette permanent)

**Constat** : après l'ajout d'une photo, l'image n'apparaît pas. Sur 4 appareils différents.
Parfois elle finit par charger, parfois non.

**Statut** : ⬜ · **Effort** : 2 h · **Fichiers** : `src/services/albums.js`, `src/components/Skeleton.js`

### Cause racine (certaine, lue dans le code)

Les URLs des photos sont **régénérées en totalité à chaque rafraîchissement**, et le composant
d'image **se réinitialise à chaque changement d'URL**.

1. `albums.js:223-236` — `withSignedUrls()` signe **toutes** les photos à chaque appel :

```js
const { data, error } = await supabase.storage
  .from('album-photos')
  .createSignedUrls(paths, SIGNED_URL_TTL);   // ← nouvelles URLs à chaque appel
```

2. `store.js:703-748` — `refreshAlbumPhotos()` remplace le tableau complet des photos :

```js
const { data: cloudPhotos } = await cloudFetchAlbumPhotos(albumId);  // ← nouvelles URLs
setState(... photos: allPhotos ...)
```

3. Ce refresh est déclenché **à chaque prise de focus** (`AlbumScreen.js:144`) **et à chaque
   événement Realtime** (`AlbumScreen.js:147-150`, `PhotoScreen.js:111-114`, debounce 500 ms).
   Or chaque upload, chaque like, chaque commentaire émet un événement Realtime.

4. `Skeleton.js:41-44` — dès que `uri` change, l'image est **masquée et remise en squelette** :

```js
useEffect(() => {
  setLoaded(false);      // ← l'image redevient un squelette
  fade.setValue(0);
}, [uri, fade]);
```

**Résultat** : chaque refresh re-signe tout → chaque `uri` change → **toutes les images
repassent en squelette et retéléchargent**. Sur un réseau lent (le cas de 4 téléphones en test),
elles n'ont jamais le temps d'arriver avant le refresh suivant. L'utilisateur voit une grille de
squelettes qui pulse indéfiniment.

### Aggravant 1 — aucune gestion d'erreur

`Skeleton.js:44-70` n'a **pas de `onError`**. Si une URL est invalide, expirée (`SIGNED_URL_TTL`
= 1 h, `albums.js:195`) ou refusée par la RLS, le composant affiche un squelette **pour
toujours**, sans jamais signaler l'échec. Impossible de distinguer « ça charge » de « c'est
cassé ».

### Aggravant 2 — une URL vide après upload

`store.js:459` : `const publicUrl = await cloudPhotoUrl(uploadData.path);`
et `albums.js:213-220` : en cas d'erreur, la fonction **retourne une chaîne vide**.

```js
if (error) console.log('📛 signed url error:', error.message);
return data?.signedUrl || '';        // ← ''
```

La photo est ensuite ajoutée avec `uri: ''` (`store.js:484`), et `ProgressiveImage` affiche…
un squelette (car `{uri ? <Image/> : null}` → rien + `!loaded` → squelette). **La photo qu'on
vient d'ajouter est invisible, sans message d'erreur.**

### Correctif

**a) Mettre les URLs signées en cache jusqu'à expiration** — `src/services/albums.js`

```js
// Cache mémoire : chemin → { url, expiresAt }
const signedCache = new Map();

function isFresh(entry) {
  return entry && entry.expiresAt - 60_000 > Date.now(); // marge de 60 s
}

export async function cloudPhotoUrl(storagePath) {
  if (!supabase || !storagePath) return '';
  const cached = signedCache.get(storagePath);
  if (isFresh(cached)) return cached.url;

  const { data, error } = await supabase.storage
    .from('album-photos')
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return '';
  signedCache.set(storagePath, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL * 1000,
  });
  return data.signedUrl;
}

async function withSignedUrls(rows) {
  const now = Date.now();
  const paths = [...new Set((rows || []).map((r) => r.storage_path).filter(Boolean))];
  const toSign = paths.filter((p) => !isFresh(signedCache.get(p)));

  if (toSign.length) {
    const { data } = await supabase.storage
      .from('album-photos')
      .createSignedUrls(toSign, SIGNED_URL_TTL);
    (data || []).forEach((s) => {
      if (s?.path && s?.signedUrl) {
        signedCache.set(s.path, {
          url: s.signedUrl,
          expiresAt: now + SIGNED_URL_TTL * 1000,
        });
      }
    });
  }

  return (rows || []).map((r) => {
    const entry = signedCache.get(r.storage_path);
    return mapCloudPhoto(r, entry?.url || '');
  });
}
```

Effet : une photo déjà signée **garde exactement la même URL** d'un refresh à l'autre →
`ProgressiveImage` ne se réinitialise plus → l'image reste affichée.

**b) Faire dépendre la réinitialisation d'une identité stable** — `src/components/Skeleton.js`

```js
export function ProgressiveImage({ uri, storagePath, style = {}, radius, color = '#E2EEEE',
                                   resizeMode = 'cover', ...imgProps }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const identity = storagePath || uri;   // ← stable même si l'URL change

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    fade.setValue(0);
  }, [identity, fade]);
  ...
  onError={() => setFailed(true)}
```

Et afficher un état d'échec visible plutôt qu'un squelette infini :

```jsx
{failed && (
  <View style={[StyleSheet.absoluteFill, styles.err]}>
    <Text style={styles.errT}>Image indisponible</Text>
  </View>
)}
```

Passer `storagePath={photo.storagePath}` depuis `AlbumScreen.js:328`, `HomeScreen.js:183`,
`PhotoScreen.js:334` et `AlbumScreen.js:621`.

**c) Ne jamais ajouter une photo avec une URL vide** — `src/store.js:459`

```js
let publicUrl = await cloudPhotoUrl(uploadData.path);
if (!publicUrl) publicUrl = await cloudPhotoUrl(uploadData.path); // 1 retry
// et si toujours vide : garder l'URI locale en attendant, pas ''
```

**d) Vérifier** : ajouter 3 photos, laisser l'écran ouvert 2 min, revenir, tuer l'app et
relancer. Les images doivent rester affichées.

---

## 🔴 BUG-02 — Le carrousel revient sur la photo précédente au swipe

**Constat** : « quand on essaie de swiper vers l'image suivante, on retourne sur le précédent ».

**Statut** : ⬜ · **Effort** : 45 min · **Fichier** : `src/screens/PhotoScreen.js`

### Cause racine (certaine)

Le carrousel est l'en-tête (`ListHeaderComponent`) d'une `FlatList` verticale, et cet en-tête
est fourni sous forme de **fonction recréée à chaque rendu** :

```js
// PhotoScreen.js:303
const renderHeader = () => ( ... <FlatList horizontal initialScrollIndex={initialIndex} ... /> ... );

// PhotoScreen.js:510
<ListHeaderComponent={renderHeader} />   // ← une FONCTION, pas un élément
```

`FlatList` interprète une fonction comme un **type de composant**. Comme `renderHeader` est une
nouvelle fonction à chaque rendu de `PhotoScreen`, React considère que le type a changé et
**démonte puis remonte tout l'en-tête** — donc la `FlatList` horizontale interne.

Or le swipe déclenche précisément un rendu :

```js
// PhotoScreen.js:324-330
onMomentumScrollEnd={(event) => {
  const newIndex = Math.round(...);
  if (newIndex !== safeIndex) {
    setCurrentIndex(newIndex);   // ← re-rendu
  }
}}
```

**Séquence exacte du bug :**
1. Vous swipez vers la photo 2 → `setCurrentIndex(1)`.
2. `PhotoScreen` se re-rend → nouvelle fonction `renderHeader`.
3. React remonte l'en-tête → la `FlatList` horizontale **redémarre**.
4. Elle réapplique `initialScrollIndex={initialIndex}` = la photo que vous aviez ouverte.
5. **Vous êtes renvoyé sur la photo précédente.**

### Aggravant — `initialScrollIndex` est recalculé à chaque rendu

```js
// PhotoScreen.js:77
const initialIndex = Math.max(0, photos.findIndex((p) => p.id === photoId));
```

Dès qu'une nouvelle photo arrive en tête de liste, l'index de la photo ouverte **change de
valeur**. La prop `initialScrollIndex` change donc, et `VirtualizedList` **re-scrolle
explicitement** vers cette position — même sans remontage. Deuxième chemin vers le même bug.

### Aggravant — `extraData` recréé à chaque rendu

```js
// PhotoScreen.js:516
extraData={{ likedComments, safeIndex, photos }}   // ← nouvel objet à chaque rendu
```

Force la `FlatList` à re-rendre toutes ses cellules en permanence.

### Correctif

```diff
- const initialIndex = Math.max(0, photos.findIndex((p) => p.id === photoId));
+ // Figé au montage : le carrousel ne doit jamais être re-positionné ensuite.
+ const initialIndexRef = useRef(Math.max(0, photos.findIndex((p) => p.id === photoId)));
+ const initialIndex = initialIndexRef.current;
```

```diff
- <ListHeaderComponent={renderHeader} />
+ <ListHeaderComponent={renderHeader()} />
```

```diff
- extraData={{ likedComments, safeIndex, photos }}
+ extraData={`${safeIndex}|${Object.keys(likedComments).length}`}
```

Et retirer `initialNumToRender={Math.min(initialIndex + 2, photos.length)}` (`l. 316`) qui
recalcule une prop de montage à chaque rendu : le remplacer par une valeur figée (`2`) ou par
`initialIndexRef.current + 2`.

**Vérification** : ouvrir la photo 1, swiper jusqu'à la 3, attendre un événement Realtime
(demander à un autre compte d'ajouter une photo) → le carrousel doit **rester** sur la photo 3.

---

## 🟠 BUG-03 — Safe area ignorée sur les écrans secondaires

**Constat** : « Télécharger sur PC », « Album Premium », « Membres », « Voir QR » collent à la
barre de statut.

**Statut** : ⬜ · **Effort** : 30 min · **Fichiers** : `src/components/UI.js`, `src/screens/HomeScreen.js`, `src/screens/ProfileScreen.js`

### Cause racine (certaine)

`src/components/UI.js:13` importe `SafeAreaView` depuis **le mauvais paquet** :

```js
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
  SafeAreaView,          // ❌ vient de 'react-native'
  Dimensions, Animated
} from 'react-native';
```

Or `Page` (`UI.js:236-242`) lui passe une prop `edges` :

```js
export function Page({ children, style = {}, edges = ['top', 'left', 'right'] }) {
  return (
    <SafeAreaView style={[styles.page, style]} edges={edges}>   {/* edges ignoré */}
```

Le `SafeAreaView` de **`react-native`** :
- **ignore** complètement la prop `edges` (elle n'existe que dans `react-native-safe-area-context`) ;
- **ne fait rien sur Android** (il n'agit que sur iOS).

Sur Android, `Page` n'ajoute donc **aucun padding haut** → le `ScreenHead` se retrouve sous la
barre de statut. C'est exactement le symptôme observé sur les 4 écrans concernés (tous utilisent
`Page`) et sur `MenuScreen`.

`HomeScreen` « fonctionne » seulement parce qu'il compense à la main :

```js
// HomeScreen.js:102
<Page style={[styles.root, { paddingTop: insets.top }]} edges={['top','left','right']}>
```

### Correctif

**a)** Importer le bon composant — `src/components/UI.js`

```diff
-  SafeAreaView,
   Dimensions, Animated
 } from 'react-native';
 import { colors } from '../theme';
+import { SafeAreaView } from 'react-native-safe-area-context';
```

(`useSafeAreaInsets` est déjà importé depuis ce paquet à la ligne 20.)

**b)** Supprimer la compensation manuelle devenue un double padding — `HomeScreen.js:102`

```diff
- <Page style={[styles.root, { paddingTop: insets.top }]} edges={['top', 'left', 'right']}>
+ <Page style={styles.root} edges={['top', 'left', 'right']}>
```

**c)** `ProfileScreen.js:2` importe aussi `SafeAreaView` depuis `react-native` (utilisé dans les
`<Modal>`) — même correction, en passant `edges={['top','bottom']}`.

**d)** Vérifier sur un appareil à encoche **et** sans encoche, Android et iOS : les 4 écrans
doivent avoir le titre sous la barre de statut, avec une marge cohérente avec l'Accueil.

---

## 🟠 BUG-04 — Vidéo de test non analysable

**Statut** : 🔄 en attente

Le lien Google Drive (`1CUHRVET-…`) **n'est pas accessible depuis cet environnement** : le
sandbox n'autorise que `github.com`, `registry.npmjs.org` et `pypi.org` en sortie. La page
renvoie une erreur 500.

**Pour que je puisse l'analyser**, au choix :
- déposer le fichier dans le dépôt (`docs/` ou une issue GitHub par glisser-déposer) ;
- décrire précisément : modèle de téléphone, version d'Android, ce qui se passe à l'écran,
  à quel moment, et si un message d'erreur apparaît ;
- envoyer la sortie de `adb logcat | grep -iE "ReactNative|sharepix|expo"` pendant la reproduction.

Les bugs 01 à 03 ci-dessus couvrent déjà très probablement ce que montre la vidéo.

---

# BLOC B — Bloquants backend (P0)

## 🔴 P0-01 — Policy Storage DELETE cassée

**Statut** : ⬜ · **Effort** : 20 min · **Fichier** : `storage.objects` (migration SQL)

La policy interroge `storage.foldername(a.name)` où `a` est l'alias de `albums` — donc le
**titre de l'album** au lieu du chemin du fichier. Vérifié en base :
`storage.foldername('Vacances Corse')` → `{}` → cast `NULL` → `EXISTS` faux.

**Conséquence** : seul l'auteur d'un fichier peut le supprimer, jamais le propriétaire de
l'album. La ligne SQL disparaît, **le fichier reste**.

```sql
drop policy if exists "album_photos_auth_delete" on storage.objects;

create policy "album_photos_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'album-photos'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and (
    owner = auth.uid()
    or exists (
      select 1 from public.albums a
      where a.id = ((storage.foldername(name))[1])::uuid
        and a.user_id = auth.uid()
    )
  )
);
```

---

## 🔴 P0-02 — 26 fichiers orphelins (9,6 Mo)

**Statut** : ⬜ · **Effort** : 1 h · **Mesuré** : 37 objets, 11 appariés, 26 orphelins

Inventaire avant purge (à sauvegarder) :

```sql
select o.name, o.created_at, (o.metadata->>'size')::bigint as octets
from storage.objects o
where o.bucket_id = 'album-photos'
  and not exists (select 1 from public.photos p where p.storage_path = o.name)
order by o.created_at;
```

Puis supprimer via l'API Storage (pas en SQL). Prévenir si des fichiers semblent être des
photos réelles dont la ligne a été perdue.

---

## 🔴 P0-03 — Crash du Profil après déconnexion

**Statut** : ⬜ · **Effort** : 15 min · **Fichier** : `src/screens/ProfileScreen.js`

`user === null` est déréférencé ligne 259 parce que la condition ligne 253 laisse passer la
branche « compte connecté ».

```diff
- {isSupabaseConfigured && !isAnonymous && (
+ {isSupabaseConfigured && !!user && !isAnonymous && (
```

---

# BLOC C — Critiques (P1)

| ID | Constat | Emplacement | Effort | Statut |
|---|---|---|---|---|
| P1-01 | `site_url = http://localhost:3000` et `uri_allow_list` sans domaine réel → emails et OAuth web cassés en prod | Supabase Auth config | 20 min | ⬜ |
| P1-02 | Aucune migration en base (`list_migrations` vide) → dérive structurelle | projet Supabase | 2 h | ⬜ |
| P1-03 | `schema.sql` destructeur s'il est rejoué ; `album.sql` et `upload_droit.sql` ouverts (`USING (true)`) | `supabase/` | 1 h | ⬜ |
| P1-04 | Secret du webhook en clair dans `pg_trigger`, lisible par `anon`/`authenticated` | trigger `activity-push` | 1 h | ⬜ |
| P1-05 | Bucket sans `file_size_limit` ni `allowed_mime_types` | bucket `album-photos` | 30 min | ⬜ |
| P1-06 | `delete_own_account` laisse les fichiers Storage | `schema.sql:65-82` | 2 h | ⬜ |
| P1-07 | OAuth mobile : code PKCE jamais échangé | `auth.js:271-313` | 0,5 j | ⬜ |
| P1-08 | `restoreSession` : timeout 2,5 s → compte anonyme remplacé, albums perdus | `auth.js:342-382` | 0,5 j | ⬜ |
| P1-09 | Aucune file de synchronisation hors-ligne | `store.js:318-403, 729-743` | 2 j | ⬜ |
| P1-10 | Codes d'invitation via `Math.random()` | `store.js:61-66` | 15 min | ⬜ |
| P1-11 | Upload : base64 en RAM, décodage synchrone, aucun plafond | `store.js:71-87, 431-433` | 1 j | ⬜ |
| P1-12 | `clearAuthUser` ne purge ni l'état ni AsyncStorage | `store.js:269-272` | 30 min | ⬜ |
| P1-13 | Pas de « mot de passe oublié » | `AuthScreen.js` | 0,5 j | ⬜ |
| P1-14 | Aucun `ErrorBoundary` | `App.js` | 1 h | ⬜ |
| P1-15 | OTA inopérant (`expo-updates` absent) | `package.json`, `eas.json` | 0,5 j | ⬜ |
| P1-16 | CI qui écrit en production à chaque PR | `ci.yml:59-75` | 1 h | ⬜ |
| P1-17 | Typecheck décoratif, 0 test, 0 lint | `tsconfig.json` | 3 j | ⬜ |
| P1-18 | `RECORD_AUDIO` sans fonction audio · licence Expo · liens légaux tiers | `app.json`, `LICENSE`, `AuthScreen.js:388` | 0,5 j | ⬜ |

---

# BLOC D — Majeurs (P2) et hygiène (P3)

<details>
<summary>Voir la liste complète (26 points)</summary>

**Backend**
- Politique de mot de passe 6 caractères, HIBP désactivé, sessions sans expiration
- Index `albums_code_unique` redondant avec `albums_code_key`
- Bruit `member_joined` à chaque création d'album (`log_activity`)
- Edge Function en fail-open si `WEBHOOK_SECRET` absent (non actif aujourd'hui, mais latent)
- Edge Function : un seul POST (limite Expo de 100), `DeviceNotRegistered` non purgé
- Préférences de notification ignorées côté serveur (`index.ts:70-90`)
- Pas de `delete from storage.objects` dans `delete_own_account`

**Application**
- Pas de pagination (`albums.js:238-317`) ; compteurs calculés en transférant toutes les lignes
- Persistance de tout l'état à chaque changement (`store.js:198-203`)
- `ProgressiveImage` sans `onError` → traité en BUG-01, mais aussi : pas de retry
- 59 `console.log` dont email (`AuthScreen.js:187`) et URLs OAuth
- Noms d'auteur fournis par le client (usurpation possible)
- « J'aime » sur commentaire purement local (`PhotoScreen.js:77, 196`)
- 17 `catch(() => {})`, aucun rollback des mises à jour optimistes
- `syncProfile` à chaque frappe + bouton « Terminé » factice (`ProfileScreen.js:160-170`)
- `clearAuthUser` sans purge (aussi en P1-12)
- Abonnements Realtime trop larges (5 tables/écran)

**UI / accessibilité**
- 4 contrastes sous WCAG AA — tous les CTA blanc sur corail = 2,93:1
- 14 attributs d'accessibilité pour ~200 éléments interactifs
- Vidéos non implémentées alors que 2 écrans en parlent
- Landing : Tailwind CDN, Google Fonts, formulaire Netlify inopérant, lien APK figé `v1.0.4`

**Performance**
- Bundle web 9,8 Mo · assets 7,1 Mo · APK 122,7 Mo
- `assets/idee/famille.png` 556 Ko (convertir en WebP)

**Hygiène**
- `supabase/.temp/` versionné · `expo-auth-session` inutilisé
- `typescript` et `@types/react` en `dependencies` au lieu de `devDependencies`
- `REDIRECT_URI_WEB` figé sur `localhost:8081`
- `realease.yml` (faute) · `DOSSIER_SHAREPIX.md` · `web/assets/imgs/splash.png` 2,1 Mo
- `.eq('user_id')` absent sur les suppressions de likes (neutralisé par RLS, à corriger par principe)
- Nom de fichier `Date.now()` (collision possible) · extension `.jpg` forcée sur le web

</details>

---

# Ordre d'exécution recommandé

## Sprint 1 — Débloquer le test terrain (1 jour)

- [ ] **BUG-01** Cache des URLs signées + `onError` + garde URL vide *(2 h)*
- [ ] **BUG-02** `initialScrollIndex` figé + `ListHeaderComponent` en élément *(45 min)*
- [ ] **BUG-03** Import `SafeAreaView` depuis `react-native-safe-area-context` *(30 min)*
- [ ] **P0-03** Crash Profil `user === null` *(15 min)*
- [ ] **P0-01** Policy Storage DELETE *(20 min)*
- [ ] **P0-02** Inventaire + purge des 26 orphelins *(1 h)*
- [ ] Build de test et nouvelle campagne sur les 4 téléphones

> **Critère de sortie** : ajouter une photo → elle s'affiche en moins de 3 s et **reste**
> affichée après 5 min ; swiper 5 photos d'affilée sans revenir en arrière ; les 4 écrans
> secondaires ont une marge haute correcte.

## Sprint 2 — Reprendre le contrôle du backend (2 jours)

- [ ] **P1-02** `supabase db pull` → migration initiale versionnée
- [ ] **P1-03** Supprimer `schema.sql`, `album.sql`, `upload_droit.sql`
- [ ] **P1-01** `site_url` + `uri_allow_list` sur un domaine réel
- [ ] **P1-05** `file_size_limit` + `allowed_mime_types`
- [ ] **P1-04** Secret webhook dans Vault + rotation
- [ ] **P1-06** `delete_own_account` : purge Storage
- [ ] **P1-16** CI : ne plus écrire en production

## Sprint 3 — Fiabiliser (5 jours)

- [ ] **P1-08** `restoreSession` explicite
- [ ] **P1-07** PKCE mobile
- [ ] **P1-12** Purge d'état à la déconnexion
- [ ] **P1-14** `ErrorBoundary`
- [ ] **P1-10** Codes `expo-crypto`
- [ ] **P1-11** Upload redimensionné et plafonné
- [ ] **P1-17** `strict` + `checkJs` + ESLint + premiers tests
- [ ] **P1-09** File hors-ligne **ou** retrait de la promesse
- [ ] **P1-13** Mot de passe oublié

## Sprint 4 — Produit et distribution (8-12 jours)

- [ ] Vidéos (`media_type`, `expo-video`)
- [ ] OTA (`expo-updates`, `runtimeVersion`, `channel`)
- [ ] Préférences de notification serveur
- [ ] Pagination + compteurs SQL
- [ ] Accessibilité (contrastes, libellés)
- [ ] Domaine propre + pages légales + `PrivacyInfo.xcprivacy`
- [ ] Images PNG → WebP
- [ ] Landing déployée

**Effort total estimé : 16 à 22 jours-homme.**

---

# Ce qu'il ne faut PAS faire

| Piège | Pourquoi |
|---|---|
| Rejouer `supabase/schema.sql` sur la production | Remplace les policies Storage par des versions sans contrôle d'appartenance et crée une surcharge de `join_album_by_code` |
| `npm audit fix` | Propose des rétrogradations majeures (expo 44, RN 0.72) |
| Ajouter `ON DELETE CASCADE` | Déjà présent sur les 16 FK — c'était une erreur de ma part |
| Passer `album-photos` en public | Le bucket est déjà privé et c'est correct |
| Corriger la policy DELETE sans purger les orphelins | Le stockage restera faux |

---

*Plan généré à partir de l'audit v4 (`AUDIT_SHAREPIX.md`) et du diagnostic des bugs signalés
en test. Les causes des BUG-01 à BUG-03 ont été identifiées par lecture du code, avec
`fichier:ligne` — elles sont reproductibles et vérifiables.*
