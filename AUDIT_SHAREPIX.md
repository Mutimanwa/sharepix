# Audit technique & produit — SharePix

**Dépôt** : `Mutimanwa/sharepix` · **Commit** : `a7aee57`
**Projet Supabase inspecté** : `bpillwvvxqiduxtkftuh` (eu-west-1, Postgres 17.6, statut `ACTIVE_HEALTHY`)
**Méthode** : analyse statique du code **+ inspection directe de la base de production**
**Branche** : `arena/323af688-sharepix` · **Date** : 21 octobre 2026
**Version** : **v4 — vérifiée contre la base réelle**

---

## 0. Synthèse

### 0.1 Je dois corriger plusieurs de mes constats précédents

J'ai eu accès à la base de production et j'ai tout revérifié. **Une partie significative de
mon audit v2/v3 était fausse**, parce que je jugeais le backend sur le `schema.sql` du dépôt
au lieu de regarder la base elle-même.

| Ce que j'avais écrit (v2/v3) | Réalité mesurée en base | Verdict |
|---|---|---|
| « Aucun `ON DELETE CASCADE` » | **Les 16 FK sont toutes en `CASCADE`** | ❌ **j'avais tort** |
| « Supprimer un album / un compte échoue » | Fonctionne : les cascades sont en place | ❌ **j'avais tort** |
| « 5 tables absentes » | Les 9 tables existent, **RLS active sur les 9** | ❌ **j'avais tort** |
| « `join_album_by_code` n'accepte pas `p_member_name` » | La fonction déployée a bien `(p_code, p_member_name)` | ❌ **j'avais tort** |
| « Aucune policy UPDATE/DELETE sur `albums` » | `albums_update_owner` + `albums_delete_owner` existent | ❌ **j'avais tort** |
| « Le propriétaire ne peut pas retirer un membre » | `album_members_delete_owner` existe | ❌ **j'avais tort** |
| « Bucket public » | `public = false` | ❌ **j'avais tort** |
| « Likes supprimés sans `user_id` » | La policy `photo_likes_delete` filtre `user_id = auth.uid()` | ⚠️ **risqué mais non exploitable** |

**Le backend est bien meilleur que ce que le fichier `schema.sql` laissait croire.** C'est un
travail sérieux : RLS sur les 9 tables, fonctions `SECURITY DEFINER` avec `search_path` épinglé,
triggers d'activité réellement branchés, publication Realtime complète, policies Storage liées à
l'appartenance. Mon erreur était de faire confiance au fichier de référence du dépôt.

### 0.2 Mais l'inspection a révélé trois défauts que le code seul ne montrait pas

1. **🔴 Une policy Storage est cassée** — elle interroge `storage.foldername(a.name)` sur le
   *nom de l'album* au lieu du *chemin du fichier*. Conséquence : seul l'auteur d'un fichier
   peut le supprimer, jamais le propriétaire de l'album — alors que c'est exactement le cas
   d'usage prévu. Et le client ignore l'erreur.
2. **🔴 26 fichiers orphelins sur 37 (70 %), soit 9,6 Mo sur 9,8 Mo.** Mesuré, pas déduit.
   Des photos « supprimées » qui sont toujours sur le disque.
3. **🟠 La configuration Auth pointe sur `localhost`** en production (`site_url`), et la liste
   des URLs autorisées ne contient ni `sharepix.app` ni un domaine réel.

Et un quatrième, structurel : **la base n'a aucune migration** (`list_migrations` → vide).
Tout a été appliqué à la main dans le SQL Editor — ce qui explique, et continuera de
provoquer, la dérive entre le dépôt et la production.

### 0.3 Note révisée

| Axe | v3 | **v4** | Justification du changement |
|---|---|---|---|
| Architecture & lisibilité | 6 | **6** | = |
| **Sécurité backend** | 3 | **7** | RLS complète et bien écrite, policies Storage liées à l'appartenance, fonctions durcies |
| Sécurité client | 6 | **6** | = |
| Couverture fonctionnelle | 4 | **5** | Le backend supporte tout ; ce sont les écrans qui manquent |
| **Intégrité des données** | 3 | **4** | Pas de perte de lignes, mais suppression de fichiers défaillante |
| Tests & CI | 3 | **3** | = |
| Performance & coûts | 4 | **4** | = |
| Accessibilité & UX | 4 | **4** | = |
| Documentation & process | 4 | **4** | Dérive confirmée (aucune migration) |
| Conformité store / légal | 3 | **4** | Compte supprimable, mais fichiers retenus |
| **Global** | 4 | **5 / 10** | **Bêta privée solide côté backend ; blocages restants côté application** |

### 0.4 Top 8 des actions

| # | Action | Sév. | Effort |
|---|---|---|---|
| 1 | Corriger la policy `album_photos_auth_delete` (bug `a.name`) | **P0** | 20 min |
| 2 | Purger les 26 orphelins existants + inverser l'ordre des suppressions côté client | **P0** | 1 h |
| 3 | Corriger le crash du Profil après déconnexion | **P0** | 15 min |
| 4 | `site_url` + `uri_allow_list` : mettre un vrai domaine | **P1** | 20 min |
| 5 | Générer la migration initiale (`supabase db pull`) et supprimer les 3 SQL obsolètes | **P1** | 2 h |
| 6 | Sortir le secret du trigger (Vault) et le faire tourner | **P1** | 1 h |
| 7 | Plafond de taille bucket + limite d'upload client | P1 | 1 h |
| 8 | Codes d'invitation via CSPRNG | P1 | 15 min |

---

## 1. Méthode

### 1.1 Ce qui a été exécuté

| Vérification | Résultat |
|---|---|
| `npm ci`, `npm run typecheck`, `npx expo-doctor` | ✅ / ✅ (faux positif) / 19-21 |
| `npx expo export --platform web` | ✅ 9,8 Mo JS + 7,1 Mo assets |
| ESLint ciblé (config ad hoc) | 23 erreurs dont 2 réelles |
| `npm audit --omit=dev` | 1 critique / 19 élevées / 12 modérées |
| **Inspection Supabase (16 requêtes)** | contraintes, policies, fonctions, triggers, index, RLS, Realtime, bucket, volumes, orphelins |
| **Edge Functions / Secrets / Auth config** | `activity-push` actif · `WEBHOOK_SECRET` présent · config analysée |
| **Historique de migrations** | **vide** |

### 1.2 Limite restante

Aucun test sur appareil physique. Les constats d'interface restent issus de la lecture du code.

---

## 2. Ce que la base révèle de bon (à ne pas casser)

Avant les défauts, ce qui est réellement bien fait en production :

**Contraintes et intégrité**
- **16 clés étrangères, toutes `ON DELETE CASCADE`.** Supprimer un album supprime réellement
  ses photos, membres et activité ; supprimer un compte purge bien les données applicatives.
- 19 index, dont `photos(album_id, created_at DESC)`, `activity_log(album_id, created_at DESC)`,
  `album_members(user_id)`, `photo_comments(photo_id, created_at)` — les requêtes réelles de
  l'app sont couvertes.
- `photos_storage_path` unique : impossible d'enregistrer deux fois le même fichier.

**RLS — 24 policies, toutes correctes sur le principe**
- RLS **activée sur les 9 tables**.
- `albums` : select membre, **update owner**, **delete owner** ✅
- `album_members` : `delete_self` (membre) **et** `delete_owner` (le propriétaire peut retirer
  un membre) ✅
- `photos` : insert exige `is_album_member(album_id)` **et** `uploader_id = auth.uid()` ;
  delete réservé à l'uploader ou au propriétaire de l'album ✅
- `photo_comments` / `photo_likes` : insert contraint à l'auteur courant **et** à l'appartenance
  à l'album ; select réservé aux membres ✅
- `profiles`, `push_tokens`, `activity_acks` : strictement limités à `auth.uid()` ✅
- Aucune policy n'utilise `USING (true)`.

**Fonctions — 7, toutes `SECURITY DEFINER` avec `search_path = public` épinglé**
- `is_album_member(uuid)` en `STABLE SECURITY DEFINER` — évite la récursion des policies ✅
- `create_album`, `join_album_by_code(p_code, p_member_name)`, `my_activity(p_limit)`,
  `delete_own_account`, `handle_new_user`, `log_activity` — toutes présentes et conformes.
- `my_activity` exclut intelligemment l'activité de l'utilisateur lui-même et les entrées
  déjà acquittées ✅

**Triggers et temps réel**
- 4 triggers d'activité (`album_members`, `photos`, `photo_comments`, `photo_likes`) +
  1 trigger `handle_new_user` sur `auth.users` ✅
- Publication `supabase_realtime` : les **6 tables** auxquelles le client s'abonne ✅

**Storage**
- Bucket `album-photos` **privé** (`public = false`) ✅
- Policies select/insert/delete liées à `is_album_member((storage.foldername(name))[1]::uuid)`
  avec un `CASE ... ELSE false` qui rejette les chemins non-UUID ✅

---

## 3. Défauts confirmés par l'inspection

### 3.1 🔴 P0 — La policy DELETE Storage ne peut jamais autoriser le propriétaire d'un album

**La policy actuelle :**

```sql
-- album_photos_auth_delete (storage.objects, DELETE)
(owner = auth.uid()) OR
CASE
  WHEN (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$' THEN
    EXISTS (SELECT 1 FROM albums a
            WHERE a.id = ((storage.foldername(a.name))[1])::uuid   -- ⚠️
              AND a.user_id = auth.uid())
  ELSE false
END
```

Le `name` de la clause `WHEN` est bien celui de `storage.objects`. Mais à l'intérieur du
`EXISTS`, `a` est l'alias de la table `albums` : **`a.name` est le titre de l'album**, pas le
chemin du fichier.

**Vérifié empiriquement :**

```sql
select storage.foldername('Vacances Corse') as folder_array,
       (storage.foldername('Vacances Corse'))[1] as first_element,
       ((storage.foldername('Vacances Corse'))[1])::uuid as cast_uuid;
-- folder_array = {} · first_element = NULL · cast_uuid = NULL
```

Donc `a.id = NULL` → `EXISTS` faux → la branche `CASE` renvoie `false`. **La seule condition
qui peut être vraie est `owner = auth.uid()`.**

**Conséquence :** le propriétaire d'un album ne peut supprimer **que** les fichiers qu'il a
lui-même envoyés. Ceux des autres membres échouent — et le client **ignore l'erreur** :

```js
// albums.js:254-257
if (photo.storagePath) {
  await supabase.storage.from('album-photos').remove([photo.storagePath]); // résultat jeté
}
const { error } = await supabase.from('photos').delete().eq('id', photo.id); // réussit (policy OK)
```

La ligne SQL disparaît, le fichier reste. **La photo est « supprimée » pour l'utilisateur mais
toujours sur le disque**, et toujours lisible par n'importe quel membre de l'album via une URL
signée si le chemin est connu (`albumId/timestamp.ext`, devinable).

Même mécanisme dans `cloudDeleteAlbum` (`albums.js:174-177`), en pire : tous les fichiers des
autres membres survivent à la suppression de l'album.

**Correctif :**

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
      where a.id = ((storage.foldername(name))[1])::uuid   -- ✅ name, pas a.name
        and a.user_id = auth.uid()
    )
  )
);
```

Le `CASE` devient inutile : le `~` dans le `AND` protège le cast, et PostgreSQL n'évalue pas
le `::uuid` si le motif échoue.

### 3.2 🔴 P0 — 26 fichiers orphelins mesurés (70 % du bucket)

```sql
-- objets sans ligne photos correspondante
objets_total       37
orphelins          26   (70 %)
appariés           11
octets orphelins   9 619 155  sur 9 787 564  (98 % du volume)
```

- Les 11 lignes `photos` ont **toutes** un fichier correspondant (aucune référence cassée).
- Les 26 orphelins datent du **22/08/2026 au 07/09/2026** — la période antérieure au correctif
  d'upload `42cc1ae`. Ce sont très probablement des fichiers envoyés au Storage dont l'insertion
  SQL a échoué (le bug « image corrompue / ligne fantôme » corrigé depuis).
- Aucune ligne `photos` n'a `album_id`, `uploader_id` ou `storage_path` NULL ✅

**Ces 26 fichiers sont facturés, jamais affichés, et illisibles par personne** (bucket privé,
policies exigeant une appartenance). Il faut les inventorier puis les purger.

```sql
-- inventaire (à sauvegarder avant purge)
select o.name, o.created_at, (o.metadata->>'size')::bigint as octets
from storage.objects o
where o.bucket_id = 'album-photos'
  and not exists (select 1 from public.photos p where p.storage_path = o.name)
order by o.created_at;
```

> ⚠️ Ne pas purger sans sauvegarde : certains pourraient correspondre à des photos dont
> l'utilisateur a perdu la trace. Inventaire + export avant suppression.

### 3.3 🟠 P1 — La configuration Auth pointe sur `localhost` en production

```
site_url        : http://localhost:3000
uri_allow_list  : sharepix://auth/callback, http://localhost:8081/auth/callback
```

Aucun domaine réel n'est autorisé. Conséquences en production :

| Parcours | Effet |
|---|---|
| Confirmation d'inscription par email | Le lien renvoie vers `localhost:3000` |
| **Réinitialisation de mot de passe** | Idem — de toute façon inexistante dans l'app |
| Connexion Google **web** | `redirectTo = window.location.origin` → rejeté (URL non autorisée) |
| Connexion Google **mobile** | `sharepix://auth/callback` fonctionne — mais l'échange PKCE n'est pas fait (§5.2) |
| Changement d'email | Lien cassé |

**Correctif** : `site_url = https://<domaine réel>` et ajouter
`https://<domaine>/auth/callback` à `uri_allow_list`. À faire **après** la décision sur le
domaine (§8.1), puisque `sharepix.app` appartient à un tiers.

### 3.4 🟠 P1 — Aucune migration : la dérive est structurelle

`list_migrations` → **`[]`**. La base de production n'a **aucun historique**. Tout a été
appliqué à la main dans le SQL Editor.

C'est la cause racine de l'écart entre `schema.sql` (4 tables) et la production (9 tables),
et cela signifie :
- aucun rollback possible ;
- aucune parité entre environnements ;
- **`supabase-deploy.yml` ne déploie rien** (il attend des fichiers de migration qui n'existent pas) ;
- le prochain `schema.sql` rejoué cassera la production (§3.5).

**Correctif** : `supabase link --project-ref bpillwvvxqiduxtkftuh` puis `supabase db pull` pour
générer une migration initiale correspondant à l'état réel, et **faire de ce fichier la seule
source de vérité**.

### 3.5 🟠 P1 — Rejouer `schema.sql` dégraderait la production

Le README (`l. 88`) le présente comme « à rejouer après chaque évolution ». Sur la base réelle :

| Instruction | Effet |
|---|---|
| `create or replace function join_album_by_code(p_code text)` (l. 202) | **Crée une surcharge** à un argument en plus de la version à deux arguments → `PGRST203 « function is not unique »` possible sur les appels RPC |
| `create or replace function create_album(...)` (l. 170) | Remplace la version déployée (même signature) |
| `drop policy album_photos_public_read` + `create policy` **sans `to`** (l. 279-282) | Ajoute une **lecture publique** du bucket pour `anon` |
| `drop`/`create policy album_photos_auth_insert` `_delete` (l. 285-295) | Remplace les policies par des versions **sans contrôle d'appartenance** — régression directe |
| `insert into storage.buckets ... on conflict do nothing` (l. 275) | Sans effet ici (bucket existant), mais créerait un bucket **public** ailleurs |

`schema.sql`, `album.sql` (`USING (true)`) et `upload_droit.sql` doivent être **supprimés** du
dépôt, remplacés par la migration issue de `db pull`.

### 3.6 🟠 P1 — Le secret du webhook est stocké en clair dans la base

Le trigger `activity-push` porte le secret en argument :

```sql
EXECUTE FUNCTION supabase_functions.http_request(
  'https://bpillwvvxqiduxtkftuh.supabase.co/functions/v1/activity-push',
  'POST',
  '{"Content-type":"application/json","x-webhook-secret":"spx-…"}',   -- en clair
  '{}', '5000')
```

Vérifié : `has_table_privilege('anon', 'pg_catalog.pg_trigger', 'select')` → **`true`**, idem
pour `authenticated`. Les rôles applicatifs peuvent lire `pg_trigger`.

**Exploitabilité immédiate : faible** — PostgREST n'expose que les schémas `public`, `storage`
et `graphql_public`, donc `pg_catalog` n'est pas atteignable via l'API REST. Le secret reste
toutefois lisible par :
- tout accès SQL (dashboard, `psql`, sauvegarde, dump partagé) ;
- toute future fonction `SECURITY DEFINER` vulnérable à une injection.

**Aggravant opérationnel** : faire tourner `WEBHOOK_SECRET` côté Edge Function sans mettre à
jour l'argument du trigger **casse silencieusement les notifications** (401). Deux copies d'un
même secret, sans lien.

**Correctif** : placer le secret dans Supabase Vault et l'utiliser via `vault.decrypted_secrets`
dans le trigger, ou faire tourner le secret et mettre à jour les deux endroits dans la même
migration. **Et considérer le secret actuel comme compromis** (il a été exposé lors de cet audit) :
le faire tourner.

### 3.7 🟠 P1 — Surface d'abus sur les uploads

| Paramètre | Valeur | Effet |
|---|---|---|
| `external_anonymous_users_enabled` | `true` | Tout le monde obtient un compte sans friction |
| `rate_limit_anonymous_users` | 30 / heure / IP | 30 comptes par heure et par IP ; trivialement contourné par botnet |
| `storage.buckets.file_size_limit` | **`null`** | **Aucune limite de taille** |
| `allowed_mime_types` | `null` | Tout type de fichier accepté |
| Limite côté client | **aucune** | `store.js:406-444` |

Un compte anonyme peut donc créer un album et y envoyer des fichiers de taille arbitraire,
sans plafond. Combiné à l'absence de compression (§6.3), la facture Storage et egress n'est
bornée par rien. `security_captcha_enabled` est également à `false`.

**Correctif** : `file_size_limit = 26214400` (25 Mo) + `allowed_mime_types` restreints, plafond
client, et captcha sur les endpoints d'auth si l'abus se matérialise.

### 3.8 🟡 P2 — Politique de mot de passe faible

`password_min_length: 6` · `password_hibp_enabled: false` · pas de caractères requis ·
`sessions_timebox: 0` / `sessions_inactivity_timeout: 0` (sessions sans expiration).

Sur un produit qui stocke des souvenirs privés, 6 caractères sans vérification de fuite connue
est en dessous de l'état de l'art (8 minimum, idéalement 12, + HIBP).

### 3.9 🟡 P2 — `delete_own_account` laisse les fichiers Storage

La fonction supprime `profiles` puis `auth.users` ; les cascades nettoient les 9 tables.
**Mais `storage.objects` n'a aucun lien vers `albums`** : les fichiers restent.

Concrètement, supprimer son compte libère les lignes mais **pas les photos** — alors que la
politique de confidentialité promet une « suppression définitive des photos »
(`web/privacy.html:115`).

**Correctif** : lister les fichiers de l'utilisateur (albums possédés + uploads) et les
supprimer via l'API Storage **avant** d'appeler la RPC, côté client ; ou via une Edge Function
`delete-account` qui orchestre les deux.

### 3.10 🟡 P2 — Index redondant

```
albums_code_key      (code)   ← issu de la contrainte UNIQUE
albums_code_unique   (code)   ← doublon explicite
```

Deux index uniques identiques = double écriture et double espace à chaque insertion d'album.
Supprimer `albums_code_unique`.

### 3.11 🟡 P2 — Bruit dans le journal d'activité

`create_album` insère le propriétaire dans `album_members` → le trigger `log_activity` génère
un événement `member_joined` pour **chaque création d'album**, y compris pour le créateur
lui-même. `my_activity` filtre les événements dont on est l'auteur, donc l'impact est surtout
du volume inutile (et une notification push potentielle par création).

Sur les données réelles : **20 entrées d'activité pour 8 albums**, cohérent avec ce bruit.

---

## 4. État réel des données (au 21/10/2026)

| Table | Lignes | Lecture |
|---|---|---|
| `profiles` | 14 | Comptes créés |
| `albums` | 8 | |
| `album_members` | 9 | Peu de partage effectif (1,1 membre/album) |
| `photos` | 11 | |
| `photo_comments` | **0** | **Fonctionnalité jamais utilisée en production** |
| `photo_likes` | **0** | **Idem** |
| `activity_log` | 20 | Dont le bruit de §3.11 |
| `push_tokens` | 2 | Push très peu déployé |
| `storage.objects` | 37 | **dont 26 orphelins** |

**Interprétation** : le produit est en phase de test très précoce. Les fonctionnalités sociales
(commentaires, likes) n'ont **jamais** été exercées en conditions réelles — ce qui explique que
les bugs de suppression liés aux commentaires n'aient pas encore été vus, et rend le
déploiement d'un plan de test d'autant plus nécessaire.

---

## 5. Défauts côté application (inchangés, re-vérifiés)

### 5.1 🔴 P0 — Crash du Profil après déconnexion

`ProfileScreen.js:86` : `isAnonymous = user?.isAnonymous` → `undefined` quand `user === null`.
Ligne 253 : `isSupabaseConfigured && !isAnonymous` → **vrai**, la branche « compte connecté »
s'affiche, puis ligne 259 :

```jsx
{`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Utilisateur'}
// TypeError: Cannot read property 'firstName' of null
```

Écran blanc, aucune reprise (pas d'`ErrorBoundary`).

```diff
-{isSupabaseConfigured && !isAnonymous && (
+{isSupabaseConfigured && !!user && !isAnonymous && (
```

### 5.2 🟠 P1 — OAuth mobile : le code PKCE n'est jamais échangé

`auth.js:271-313` récupère `result.url` avec `?code=...` et ne l'échange pas
(`exchangeCodeForSession` n'est appelé qu'à `auth.js:183`, dans `linkGoogleIdentity`).
`AuthScreen.js:224-231` navigue quand même vers `Main` après 1,5 s.

Avec `site_url` sur `localhost` (§3.3), le parcours web est également inutilisable en production.
**La connexion Google est cassée sur les deux plateformes.**

### 5.3 🟠 P1 — Le compte invité peut être remplacé silencieusement

`auth.js:342-382` : `restoreSession()` rend la main au bout de 2,5 s (`l. 377`) ; si la session
n'est pas encore lue, `finish(null)` → `initializeAuth` → `signInAnonymously()` → **nouveau
compte**. `store.js:167-179` resynchronise, les albums disparaissent de l'accueil.

### 5.4 🟠 P1 — Aucune file de synchronisation hors-ligne

`README.md:8-9` promet « fonctionne hors-ligne et se synchronise au retour du réseau ».
Réalité (`store.js:318-403, 729-743`) : une photo ajoutée hors-ligne reste `cloud: false`
**pour toujours**. Aucun `NetInfo`, aucune relance, aucun badge. L'utilisateur croit avoir
partagé.

### 5.5 🟠 P1 — Codes d'invitation non cryptographiques

`store.js:61-66` : `Math.random()` pour générer le code qui **est** la clé d'accès.
`join_album_by_code` n'a ni throttle ni limite de tentatives et distingue `CODE_INCONNU`
(oracle). Espace de 32⁸ ≈ 1,1 × 10¹² — hors de portée en force brute, mais **prédictible**
si le générateur l'est.

```js
import * as Crypto from 'expo-crypto';
const code = Array.from(Crypto.getRandomBytes(8), (b) => chars[b % chars.length]).join('');
```

### 5.6 🟠 P1 — Upload : fichier entier en RAM, décodage synchrone, aucun plafond

`store.js:431-433` (introduit par `42cc1ae`) :

```js
const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
fileToUpload = base64ToUint8Array(base64);
```

4 Mo de JPEG → ~10 Mo transitoires par photo ; une vidéo de 200 Mo (MIME `mp4` prévu l. 96)
→ ~470 Mo → chute quasi certaine. `base64ToUint8Array` (l. 71-87) est une boucle **synchrone**
(~5,3 M d'itérations) → gel de l'UI. Aucun plafond, aucune compression : `quality: 0.8`
(`AlbumScreen.js:243`) ne s'applique qu'aux images réencodées.

### 5.7 🟠 P1 — Renommage d'album : la policy existe, le client ne l'utilise pas

La policy `albums_update_owner` est bien en place ✅. Mais `cloudRenameAlbum` doit être
vérifiée : si elle n'envoie pas `name` ou si elle ignore `error`, le renommage échoue
silencieusement **malgré** un backend correct. À tester sur les 8 albums réels.

### 5.8 Constats applicatifs confirmés (détail)

| Constat | Référence |
|---|---|
| 59 `console.log`, dont email (`AuthScreen.js:187`) et URL OAuth | `auth.js:137,151,247,280` |
| 17 `catch(() => {})`, aucun rollback optimiste | `store.js`, `ActivitiesScreen.js` |
| `clearAuthUser` ne purge ni l'état ni AsyncStorage | `store.js:269-272` |
| « Terminé » du profil factice + `syncProfile` à chaque frappe | `ProfileScreen.js:160-170, 291` |
| Mot de passe oublié inexistant | — |
| Vidéos non implémentées (`mediaTypes: ['images']`) | `AlbumScreen.js:242` |
| OTA inopérant (`expo-updates` absent) | `package.json` |
| Préférences de push locales, ignorées par l'Edge Function | `ProfileScreen.js:303-315` |
| `ProgressiveImage` sans `onError` → squelette infini | `Skeleton.js:44-70` |
| Aucune pagination ni compteurs SQL | `albums.js:96-106, 238-317` |
| Noms d'auteur fournis par le client (usurpation) | `albums.js:329, 353` |
| « J'aime » sur commentaire purement local | `PhotoScreen.js:77, 196` |
| `album.sql` / `upload_droit.sql` en dépôt public (`USING (true)`) | `album.sql:38-59` |

---

## 6. Performance et coûts

| Métrique | Valeur | Cible |
|---|---|---|
| Bundle web | **9,8 Mo** JS + 7,1 Mo assets | < 1,5 Mo |
| APK `v1.0.4` | **122,7 Mo** | 25-60 Mo |
| Plus grosse image | `assets/idee/famille.png` 556 Ko | 20-40 Ko (WebP) |
| Stockage bucket | 9,8 Mo dont **9,6 Mo d'orphelins** | 0 orphelin |

**Architecture** : pas de pagination · compteurs calculés en transférant toutes les lignes ·
persistance intégrale à chaque changement (`store.js:198-203`) · URLs signées 1 h persistées en
cache local · abonnements Realtime 5 tables/écran · `useMemo([ready, state])` → re-render global.

**Coûts** : la base est encore petite (11 photos), donc ces défauts ne coûtent rien
aujourd'hui — ils coûteront cher au premier album de vacances à 300 photos. C'est le bon moment
pour corriger.

---

## 7. Qualité et chaîne de vérification

| Constat | Détail |
|---|---|
| Typecheck décoratif | `tsconfig.json` = `{}`, 100 % JS, sans `strict` ni `checkJs` → vert malgré `alert()` non défini |
| 0 test | Aucun jest, testing-library, Maestro |
| 0 lint | Ni `.eslintrc*` ni `eslint.config.*` |
| CI qui écrit en prod | `ci.yml:59-75` exécute `rls-check.cjs` sur la base réelle à **chaque PR** |
| `supabase-deploy.yml` sans objet | Aucune migration à déployer (§3.4) |
| `eas update` sans `expo-updates` | `preview.yml:48-49` publie dans le vide |
| Actions non épinglées par SHA, pas de `timeout-minutes` | `.github/workflows/` |
| `npm audit` | 1 critique / 19 élevées / 12 modérées (chaîne de build) |
| Code mort | `components/BackButton.js` (cassé), `expo-auth-session`, `REDIRECT_URI_WEB` |
| Duplication | `formatAgo` ×2, message d'invitation ×3 |
| Dette | `AlbumScreen` 1 266 l., `store` 858 l. |

---

## 8. Accessibilité et conformité

### 8.1 Contrastes WCAG 2.1 AA

| Combinaison | Ratio | |
|---|---|---|
| Blanc sur corail `#E07A6A` — **tous les CTA** | **2,93:1** | ❌ |
| Blanc sur teal `#2BA3A8` | **3,04:1** | ❌ |
| Teal sur blanc | **3,04:1** | ❌ |
| Taupe `#C4B8B0` sur crème | **1,81:1** | ❌ |
| `#164E52` sur crème | 8,72:1 | ✅ |

14 attributs d'accessibilité pour ~200 éléments interactifs.
Correctif à fort effet : `coralText: '#B5544A'` (≈ 5,1:1).

### 8.2 Conformité

| Constat | Sév. |
|---|---|
| `sharepix.app` appartient à **un autre produit** (*Coral Orca Limited*) ; `/cgv` → 404 | P1 |
| Politique de confidentialité : « suppression définitive des photos » — **faux** (§3.9) | P1 |
| `site_url = localhost` en production (§3.3) | P1 |
| `RECORD_AUDIO` déclarée sans fonction audio (`app.json:27-29`) | P1 |
| `LICENSE` = MIT d'Expo, `Copyright 650 Industries` | P1 |
| Pas de `PrivacyInfo.xcprivacy` (iOS 17+) | P2 |
| Landing : Tailwind CDN, Google Fonts, Unsplash, formulaire Netlify sans `netlify.toml`, lien APK figé `v1.0.4`, aucun meta OG | P2 |

---

## 9. Documentation

| Document | Affirmation | Réalité |
|---|---|---|
| `README.md:88` | `schema.sql` = « schéma complet, ré-exécutable, à rejouer » | 4 tables sur 9, et destructeur (§3.5) |
| `README.md:70, 91, 92` | `supabase/PUSH.md`, `supabase/GUIDE.md` | **n'existent pas** |
| `README.md:8-9` | « fonctionne hors-ligne » | aucune file de sync |
| `README.md:102` | « Album (Tous / Vidéos / Favoris) » | vidéos non implémentées |
| `CICD.md:55-60` | « chaque push publie une mise à jour EAS » | `expo-updates` absent |
| `CICD.md:92-95` | « le schéma n'est pas appliqué automatiquement » | vrai — et il n'y a **aucune** migration |

---

## 10. Registre consolidé

### P0 — bloquants

| ID | Constat | Emplacement |
|---|---|---|
| P0-01 | Policy `album_photos_auth_delete` cassée (`storage.foldername(a.name)`) → le propriétaire ne peut pas supprimer les fichiers des membres | `storage.objects` |
| P0-02 | **26 orphelins / 37 objets (9,6 Mo)** — photos « supprimées » toujours sur disque | bucket `album-photos` |
| P0-03 | Crash du Profil après déconnexion (`user === null`) | `ProfileScreen.js:86, 253, 259` |

### P1 — critiques

| ID | Constat |
|---|---|
| P1-01 | `site_url` + `uri_allow_list` en `localhost` → emails et OAuth web cassés en production |
| P1-02 | Aucune migration (`list_migrations` vide) → dérive structurelle, `supabase-deploy.yml` inopérant |
| P1-03 | `schema.sql` destructeur s'il est rejoué (+ `album.sql`, `upload_droit.sql` en dépôt public) |
| P1-04 | Secret du webhook en clair dans `pg_trigger`, lisible par `anon`/`authenticated` |
| P1-05 | Bucket sans `file_size_limit` ni `allowed_mime_types` + 30 comptes anonymes/h/IP → abus Storage |
| P1-06 | `delete_own_account` laisse les fichiers Storage (contredit la politique publiée) |
| P1-07 | OAuth mobile : code PKCE jamais échangé → Google cassé sur les deux plateformes |
| P1-08 | Timeout 2,5 s de `restoreSession` → compte anonyme remplacé, albums perdus |
| P1-09 | Aucune file de synchronisation hors-ligne |
| P1-10 | Codes d'invitation via `Math.random()` |
| P1-11 | Upload base64 en RAM, décodage synchrone, aucun plafond |
| P1-12 | `clearAuthUser` sans purge d'état |
| P1-13 | Pas de mot de passe oublié |
| P1-14 | Pas d'`ErrorBoundary` |
| P1-15 | OTA inopérant (`expo-updates` absent) |
| P1-16 | CI qui écrit en production à chaque PR |
| P1-17 | Typecheck décoratif · 0 test · 0 lint |
| P1-18 | `RECORD_AUDIO` sans fonction audio · licence Expo · liens légaux tiers |

### P2 — majeurs

Mot de passe 6 caractères, pas de HIBP, sessions sans expiration · secret à deux endroits sans
lien (rotation risquée) · index `albums_code_unique` redondant · bruit `member_activity` à la
création d'album · policy `WEBHOOK_SECRET` fail-open (non active aujourd'hui, secret présent) ·
Edge Function : un seul POST (limite Expo 100), `DeviceNotRegistered` non purgé · préférences
de push ignorées côté serveur · pas de pagination · compteurs en transfert complet ·
`ProgressiveImage` sans `onError` · 59 logs PII · noms d'auteur clients · likes de commentaires
locaux · contrastes · a11y · bundle/APK · landing · CI non épinglée · `npm audit` · `syncProfile`
par frappe · 17 `catch` muets · `PrivacyInfo.xcprivacy`.

### P3

`.eq('user_id')` absent sur `photo_likes`/`album_members` (neutralisé par RLS, à corriger par
principe) · `MenuScreen` retour + fermeture · `Sheet useSafeArea` · `goHome` dupliqué ·
`supabase/.temp` versionné · `expo-auth-session` inutilisé · `REDIRECT_URI_WEB` localhost ·
`realease.yml` · `splash.png` 2,1 Mo · nom `Date.now()` · extension `.jpg` forcée sur web.

---

## 11. Plan de remédiation

### Sprint 0 — Correctifs immédiats (1 j)

1. **Policy Storage DELETE** (§3.1) — migration.
2. **Inventaire + purge des 26 orphelins** (§3.2), après sauvegarde.
3. **Inverser l'ordre** dans `cloudDeletePhoto` / `cloudDeleteAlbum` et **vérifier l'erreur**
   du `remove()` avant de supprimer la ligne.
4. **Crash Profil** (`user === null`).
5. **`site_url` + `uri_allow_list`** sur un domaine réel.
6. **Rotation du secret** webhook (considéré exposé) + mise à jour du trigger **et** de l'env
   dans la même opération.

### Sprint 1 — Reprendre le contrôle du schéma (2 j)

7. `supabase db pull` → migration initiale ; supprimer `schema.sql`, `album.sql`,
   `upload_droit.sql`.
8. `file_size_limit` + `allowed_mime_types` sur le bucket ; plafond client.
9. `delete_own_account` : suppression des fichiers Storage avant la RPC.
10. Supprimer l'index redondant ; filtrer le bruit `member_activity`.
11. Secret webhook dans Vault.
12. Politique de mot de passe (8+, HIBP).

### Sprint 2 — Fiabiliser l'application (5-7 j)

13. `restoreSession` explicite (pas de création de compte sur ambiguïté).
14. PKCE mobile + suppression des navigations sur `setTimeout`.
15. Purge d'état à la déconnexion.
16. File hors-ligne **ou** retrait de la promesse.
17. `ErrorBoundary`.
18. `strict` + `checkJs` + ESLint bloquant.
19. Tests : policies (étendre `rls-check.cjs`), `code8`, fusion cloud/local, suppressions.
20. CI : timeout, SHA, `security` sur staging.

### Sprint 3 — Produit (8-12 j)

21. Vidéos (colonne `media_type`, `expo-video`).
22. OTA (`expo-updates`, `runtimeVersion`, `channel`).
23. Préférences push serveur.
24. Pagination + compteurs SQL.
25. Upload redimensionné (`expo-image-manipulator`).
26. Accessibilité.
27. Mot de passe oublié.
28. Domaine propre + légaux + `PrivacyInfo.xcprivacy`.
29. PNG → WebP.

**≈ 16-22 jours-homme.** Le backend n'étant pas à refaire, l'effort est nettement inférieur à
ce que j'estimais en v2/v3.

---

## 12. Ce qui est solide

- **RLS complète, correcte et non triviale** : 24 policies, appartenance vérifiée par fonction
  `STABLE SECURITY DEFINER`, aucun `USING (true)`, aucun accès inter-rôles.
- **Intégrité référentielle** : 16 FK toutes en cascade, index pertinents, unicité de
  `storage_path`.
- **Fonctions durcies** : toutes `SECURITY DEFINER` avec `search_path` épinglé.
- **Realtime** correctement publié sur les 6 tables utilisées.
- **Aucune clé `service_role` dans le client.**
- **Bucket privé**, chemins validés par UUID avec `ELSE false`.
- **Séparation des couches** respectée : aucun écran ne parle à Supabase.
- **Commentaires de code** qui documentent les décisions et les pièges.
- **Réactivité** : les 4 derniers commits corrigent trois bugs terrain réels.
- **Aucun SDK publicitaire ni traceur.**

---

## Annexe — Requêtes de contrôle

```sql
-- 1. Santé des contraintes
select count(*) filter (where confdeltype='c') as cascade, count(*) as total
from pg_constraint where contype='f' and connamespace='public'::regnamespace;
-- attendu : 16 / 16

-- 2. Orphelins Storage
select count(*) from storage.objects o
where o.bucket_id='album-photos'
  and not exists (select 1 from public.photos p where p.storage_path=o.name);

-- 3. Policies Storage
select policyname, cmd, qual from pg_policies
where schemaname='storage' and tablename='objects';
```

```bash
npm ci && npm run typecheck
npx expo export --platform web --output-dir /tmp/web
npm audit --omit=dev
supabase link --project-ref bpillwvvxqiduxtkftuh && supabase db pull
```

---

*Rapport v4 — première version vérifiée contre la base de production. Les constats marqués
« mesuré » proviennent de requêtes exécutées sur le projet `bpillwvvxqiduxtkftuh` le
21/10/2026.*
