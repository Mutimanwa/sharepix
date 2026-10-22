# Décisions

Registre des choix produit et techniques, avec leur raison d'être. Une
décision qui n'est pas écrite est une décision qu'on reprendra trois fois.

---

## D-05 — Ordre de livraison : images → production → vidéo → premium

**Décision (2026-10-22).** On stabilise et on met en production ce qui
existe (les photos), *ensuite* on ajoute la vidéo, *ensuite* le premium.

**Pourquoi.** L'état réel mesuré en base donne raison à cette prudence :

| Constat | Valeur |
|---|---|
| Photos en base | 21 |
| Comptes | 84 (dont **81 anonymes**) |
| Albums | 11, dont **1 seul** appartient à un compte identifié |
| Comptes identifiés | 3 |

Autrement dit : le produit n'est pas encore validé sur son cœur (photo)
qu'on parlerait d'ajouter un format 50 fois plus lourd et une
monétisation. Une vidéo de 30 s en 1080p pèse 50 à 100 Mo, soit **3 fois le
plafond actuel du bucket** (25 Mo) ; l'import actuel charge tout le fichier
en base64 en mémoire, ce qui ferait tomber l'application bien avant cette
taille.

**Ce que ça coûte de reporter.** Rien : le schéma est sans `media_type`, donc
ajouter la vidéo ne cassera aucune donnée existante. À l'inverse, bâtir le
premium maintenant obligerait à le refaire quand les vraies offres seront
connues.

**Conséquence.** L'écran « Album Premium » reste une vitrine (il est déjà
annoncé comme tel dans le code : *« vitrine — pas de paiement branché »*).
Aucun bouton d'achat ne doit y être ajouté avant D-06.

---

## D-06 — Quand le premium arrivera, il sera un attribut du compte, pas de l'album

**Décision anticipée**, à appliquer le jour où le premium est développé.
Non implémenté aujourd'hui.

- Le statut vit sur `profiles.premium_until timestamptz` (et non un booléen :
  une date d'expiration évite d'avoir à faire tourner une tâche de
  désactivation).
- **Le client ne doit jamais pouvoir s'attribuer le premium lui-même.** Un
  `update profiles set premium_until = ...` envoyé par l'application doit
  être refusé par la RLS ou par un trigger. Sans cette garde, il suffit
  d'ouvrir les outils de développement pour obtenir le premium à vie.
- Un champ sur `albums` serait plus généreux (les invités en profiteraient)
  mais rend la facturation et la révocation beaucoup plus ambiguës.

---

## D-07 — Aucune donnée personnelle dans les journaux

**Décision (2026-10-22).** Les journaux de diagnostic ne contiennent ni
adresse e-mail, ni URL d'authentification, ni URL de retour profond.

Les lignes concernées ont été corrigées : `user.email` (3 endroits) et
`data.url` d'OAuth (4 endroits) disparaissent des logs, et les journaux
restants sont conditionnés à `__DEV__`.

**Pourquoi.** Une URL de retour `sharepix://auth/callback?code=…` est un
justificatif d'authentification à usage unique. Les journaux Android sont
lisibles par tout outil de collecte, et les journaux d'un build de
production n'ont aucune raison de contenir des adresses e-mail.

---

## D-01 — Un projet Supabase de test dédié, plutôt qu'un script de test « propre »

Le test RLS crée des comptes et des fichiers. Rendu auto-nettoyant, il
laisserait quand même des traces dès que le nettoyage échoue. Un projet
`sharepix-staging` séparé garantit qu'aucune exécution de CI ne touche la
production.

## D-02 — Typage incrémental plutôt que `checkJs` global

Activer `checkJs` sur tout le projet produisait 92 erreurs, dominées par des
artefacts d'inférence sur des composants non typés. Le projet est en JS :
`checkJs` reste désactivé, et les fichiers de logique portent `// @ts-check`.
Résultat : 0 erreur, sur les fichiers qui portent des règles métier.

## D-03 — Le redimensionnement sert d'abord les photos, pas la vidéo

`resizeForUpload` réduit à 2048 px et recompresse en JPEG 0.82 avant la
lecture base64. C'est ce qui protège la mémoire et le quota de 1 Go sur le
format qui est réellement utilisé.

## D-04 — La CI ne vise jamais la production

`rls-check.cjs` écrit. Il reçoit son URL et sa clé par variables
d'environnement, et s'arrête avec un avertissement visible si elles sont
absentes — plutôt que de retomber silencieusement sur la production.

---

## D-08 — Le SMTP ne peut venir ni de Firebase ni de Supabase

**Question posée le 22/10 :** peut-on utiliser Firebase ou Supabase pour
envoyer les e-mails d'authentification ?

**Réponse : non, aucun des deux.**

- **Firebase** n'expose pas de serveur SMTP utilisable par un tiers.
  Firebase Auth envoie ses propres e-mails *pour Firebase Auth*, et ne se
  branche pas comme relais pour Supabase.
- **Supabase** fournit bien un service intégré, mais il est inutilisable en
  production, pour une raison plus grave que la limite de débit :
  **il n'envoie qu'aux adresses membres de l'organisation Supabase**, au
  rythme de **2 e-mails par heure** et sans aucune garantie de livraison.

  C'est vérifié : `rate_limit_email_sent = 2` sur le projet. Conséquence
  concrète : un utilisateur réel qui clique sur « mot de passe oublié »
  **ne reçoit rien**, et rien ne le signale — l'appel réussit, l'e-mail
  n'arrive pas. Le mot de passe oublié livré en Sprint 3 est donc inopérant
  tant qu'un vrai SMTP n'est pas branché.

**Ce qu'il faut :** un fournisseur SMTP tiers, gratuit à cette échelle.

| Fournisseur | Offre gratuite | Hôte / port | Remarque |
|---|---|---|---|
| **Brevo** | 300 e-mails/jour | `smtp-relay.brevo.com:587` | Pas de domaine obligatoire au départ ; bonne délivrabilité. |
| **Resend** | 100/jour | `smtp.resend.com:465` | Nécessite de vérifier `sharepix.app` (enregistrements DNS) pour envoyer à n'importe qui. |
| **Mailgun / SendGrid** | quotas variables | — | Équivalents. |

**Procédure (identique pour tous) :**
1. Créer un compte, valider l'adresse d'envoi (ou le domaine `sharepix.app`).
2. Récupérer l'hôte, le port, l'utilisateur et la clé SMTP.
3. Supabase → **Authentication → Emails → SMTP Settings** → *Enable
   custom SMTP* → coller les valeurs → expéditeur `noreply@sharepix.app`.
4. **Ensuite seulement**, Authentication → **Rate Limits** → relever la
   limite d'e-mails (30/h par défaut après activation ; monter à 100).
5. Tester avec une vraie adresse : « mot de passe oublié » doit arriver.

> La configuration finale se fait dans la console : aucun outil de l'agent
> ne couvre les champs SMTP.

---

# Remise à zéro de la production — 22/10/2026

Décidée explicitement (« base vierge »), exécutée et vérifiée.

| Élément | Avant | Après |
|---|---|---|
| Comptes | 84 (81 anonymes) | **0** |
| Profils | 29 | **0** |
| Albums | 11 | **0** |
| Photos | 21 | **0** |
| Commentaires / likes / membres | 1 / 0 / — | **0** |
| Jetons push | 2 | **0** |

**Le schéma n'a pas bougé** : 9 tables toutes en RLS, 21 policies `public`
+ 3 `storage`, 10 fonctions, 6 triggers (dont `on_auth_user_created` sur
`auth.users`), bucket privé présent, 2 secrets Vault intacts.

- Sauvegarde : `/home/user/backup-sharepix-2026-10-22.json` (hors dépôt —
  contient des adresses e-mail, à supprimer une fois la remise à zéro
  admise).
- Suppression par `delete from auth.users` : toutes les tables applicatives
  cascadent depuis `auth.users` (vérifié sur `pg_constraint` — la seule
  exception est `auth.scim_users`, table système vide).

## Ce qui reste : les octets du bucket

La cascade SQL supprime les **lignes**, pas les fichiers : les 47 objets du
bucket (10,09 Mo) sont désormais tous orphelins.

⚠️ **Ne pas** faire `delete from storage.objects` : cela supprime la
métadonnée mais **pas les octets**, qui resteraient facturés et deviendraient
introuvables. Seule l'API Storage libère réellement l'espace :

```bash
SUPABASE_URL=https://bpillwvvxqiduxtkftuh.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<clé service_role> \
node supabase/purge-orphans.cjs          # simulation
# puis --apply pour supprimer
```

**Après la remise à zéro**, les appareils qui ont encore une session en
cache doivent se déconnecter puis se reconnecter : leur JWT reste valide
techniquement jusqu'à expiration, mais ne correspond plus à aucun compte.

---

## D-09 — Les défauts d'affichage se corrigent à la cause, pas au symptôme

Date : 22/10/2026. Contexte : 9 captures d'écran, 5 défauts signalés.

### Ce qui a été corrigé

| # | Défaut signalé | Cause réelle | Correction |
|---|----------------|--------------|------------|
| a | L'onde de clic « se propage » hors des onglets de la tab bar | `@react-navigation/bottom-tabs` code en dur `android_ripple: { borderless: true }` (`BottomTabItem.tsx:354`) et n'expose pas `pressColor` | `tabBarButton` personnalisé : `PlatformPressable` **avec l'onde bornée** (`borderless: false`) + `overflow: hidden`. Aucun patch de `node_modules`. |
| a' | Ombre visible sous la tab bar | La lib applique `elevation: 8` par défaut sur Android | `elevation: 0` + ombre iOS neutralisée ; il ne reste qu'un filet de séparation de 1 px. |
| b | Le scanner QR ne s'affiche pas (seule une bande noire en bas) | L'overlay était une `View` `position: absolute` **dans l'arbre de l'écran Album**, sous `SafeAreaView` + `RightModal` : selon le conteneur, il se réduit à une bande | Scanner extrait dans `src/components/QrScanner.js`, monté **une seule fois à la racine de l'app** (`QrScannerProvider` dans `App.js`), au-dessus de tout. Fond noir opaque garanti, `onMountError` remonté à l'écran. Toujours **pas de `<Modal>` native** (la SurfaceView d'expo-camera reste noire dans une fenêtre modale sur Android). |
| c | Barre de commentaire masquée par le clavier (constaté sur l'APK réel) | La compensation manuelle par hauteur du clavier s'ajoutait au redimensionnement de fenêtre et pouvait déplacer le compositeur hors écran | Révision : suppression de toute marge dynamique basée sur la hauteur ; `KeyboardAvoidingView` en `padding` prend en charge les deux plateformes, et Android déclare aussi `softwareKeyboardLayoutMode: "resize"`. La hauteur système ne sert plus qu'à réduire les insets décoratifs. **À retester sur appareil Android.** |
| d | Saisie du nom d'album et du code impossible sur Android (constaté après l'APK précédent) | Le focus différé n'a pas résolu le problème ; le code était dessiné par-dessus un `TextInput` transparent, dont le focus n'était pas fiable dans la Modal | Révision : retrait du focus programmé pour le nom d'album ; le code est désormais un véritable champ visible, saisissable et tapable. `keyboardShouldPersistTaps="always"`, `showSoftInputOnFocus` et insets translucides restent activés. **À retester sur appareil Android.** |
| e | Vérifier tous les champs | `Field` ne transmettait ni `keyboardType`, ni `autoCapitalize`, ni `maxLength`, ni `returnKeyType` | `Field` expose ces props (valeurs par défaut sûres : pas d'autocorrection, pas de majuscule auto), `inputRef` pour le focus programmé. |

### Ce qui n'a **pas** été fait, volontairement

- **Aucun changement de couleur ni de contraste.** Mesures disponibles
  (`coral`/blanc 2,93 ; `success`/blanc 2,28) mais l'utilisateur a écarté une
  correction d'office : elle attend une capture ou une validation.
- **Aucun patch de `node_modules`** : tout passe par les props publiques.
- Le bug « caméra noire dans une `<Modal>` » n'est pas contourné par une
  réécriture : on garde le rendu dans la fenêtre principale.
- Les champs restent couverts par `Field` (props de clavier explicites) et
  `keyboardShouldPersistTaps="always"`. Le précédent test sur téléphone a
  invalidé la correction initiale du focus/code et du compositeur ; le correctif
  actuel retire le focus programmé du nom, remplace le code masqué par un vrai
  champ visible, et ne cumule plus de compensation manuelle avec le resize.
  Ces comportements ne sont pas validables par la CI et restent en attente du
  prochain APK Android réel.

### Vérifications

`tsc --noEmit` 0 erreur · `eslint .` **0 erreur, 0 avertissement** ·
`jest` 21/21 · `expo export --platform web` OK.

### Deux écarts de version corrigés au passage

`expo-doctor` (en CI) refusait le projet pour deux raisons qui ne venaient pas
des captures mais bloquaient la porte de qualité :

- `@sentry/react-native` **8.31.0** alors que le SDK 57 attend **~7.11.0**
  (majeure différente) → rétrogradé en `~7.11.0`. L'API utilisée
  (`init`, `wrap`, `captureException`, `addBreadcrumb`, `beforeSend`) est
  identique dans les deux majeures, aucun code modifié.
- `expo-crypto` déclaré `~57.0.0` au lieu de `~57.0.4`, `react-native-web`
  en `^0.21.2` au lieu de `~0.21.0` → réalignés.

`npm ls` + comparaison à `bundledNativeModules.json` : **plus aucun écart**.
Reste à valider **sur appareil** (les 4 défauts sont visuels/physiques) :
le clavier et la caméra ne se testent pas en CI.

---

## D-10 — « Télécharger » enregistre dans la galerie (pas dans le menu Partager)

Date : 22/10/2026. Défaut signalé après les captures mobiles.

### Diagnostic

L'ancien bouton de téléchargement :
1. téléchargeait la photo uniquement dans le cache temporaire de l'application ;
2. ouvrait ensuite le menu système **Partager** (`expo-sharing`) ;
3. ne sauvegardait rien dans la galerie, n'affichait aucun succès et avalait
   les erreurs dans un `console.log` ;
4. sur le web, ouvrait l'image dans un nouvel onglet au lieu de télécharger.

### Correction

- **iOS / Android** : actualise l'URL signée depuis `storagePath` (évite les
  liens Supabase expirés), télécharge dans le cache, vérifie le statut HTTP,
  demande l'autorisation « photos » uniquement, puis enregistre dans la
  galerie via l'API de compatibilité `expo-media-library/legacy` (l'API
  principale a marqué `saveToLibraryAsync` comme dépréciée).
- **Web** : récupère un Blob puis déclenche un téléchargement navigateur
  avec le nom `SharePix-<id>.<extension>` (au lieu d'ouvrir une nouvelle page).
- Affiche le résultat ou une erreur compréhensible ; accessible et désactivé
  pendant le téléchargement.
- `app.json` déclare le plugin avec permission photos et `granularPermissions`
  photo ; `expo-sharing` retiré, car il n'est plus utilisé.
- **Vidéos** : hors périmètre de ce correctif. La priorité reste photos →
  vidéos ensuite → premium après la mise en production (D-05).

### Validation

TypeScript, ESLint, Jest (21/21) et export web passent. La permission native
nécessite un nouvel APK ; il faut vérifier sur téléphone que la photo apparaît
dans la galerie après avoir accordé l'accès. Le sandbox ne peut pas valider
le stockage physique iOS/Android.

---

## D-11 — Préférence notifications unique et animation du splash non rognée

Date : 22/10/2026. Contexte : captures mobile (Activités avant/après
activation, préférence du Profil, animation des anneaux du splash).

- `ActivitiesScreen` ne conserve plus un booléen `asked` local : il lit
  directement `state.profile.notifications`, identique au switch principal
  du Profil. Activer depuis Activités met à jour le même champ ; activer ou
  désactiver depuis Profil change immédiatement l'état de l'écran Activités.
  Le chargement des événements et l'abonnement Realtime suivent la même
  préférence.
- Le titre **Activités** est désormais dans un en-tête commun aux deux états,
  avant/après permission. Le panneau d'activation prend toute la hauteur
  restante et centre son contenu comme l'état « aucune activité ».
- Le conteneur du splash faisait `1,55 × logo`, plus petit que l'anneau à
  son expansion maximale (environ `1,76 × logo`) ; la zone passe à `2,15 ×`
  et laisse explicitement le débordement visible. Le routage après
  authentification attend 3,2 s (au lieu de 2,2) pour ne pas couper la boucle
  d'animation trop tôt.

Vérifications : `tsc`, `eslint`, Jest 21/21 et export web OK. La permission
push native et le rendu de l'animation restent à vérifier sur l'APK Android.

---

# Ce qui bloque la mise en production

État vérifié le 2026-10-22, en base et dans les workflows.

| # | Point | Statut | Impact |
|---|-------|--------|--------|
| 1 | **Aucun SMTP configuré** (`smtp_host` = `null`, `rate_limit_email_sent` = 2/h) | ❌ | Le mot de passe oublié et les confirmations d'adresse ne partent pas de façon fiable. Un utilisateur qui perd son mot de passe perd son compte. |
| 2 | **Sentry annoncé dans la politique de confidentialité, absent du code** | ✅ codé le 22/10 | SDK intégré (`src/lib/sentry.js`), inactif sans DSN. **Reste à créer le projet et fournir `EXPO_PUBLIC_SENTRY_DSN`.** Sans DSN, la mention de la politique reste inexacte. |
| 3 | `password_min_length` = 6, protection HIBP désactivée | ⚠️ | Mots de passe faibles acceptés (`123456` passe). |
| 4 | 81 comptes anonymes sur 84, 11 albums | ✅ réglé le 22/10 | Base remise à zéro (voir ci-dessous). Les comptes fantômes ne reviendront pas : le correctif P1-08 tari la source. |
| 5 | Secrets `STAGING_*` posés, mais **comptes anonymes désactivés** sur le projet de test | ⚠️ | Le script ne peut pas créer son compte de contrôle : il sort en code `2` (non vérifié) au lieu d'un faux vert. Une case à cocher dans la console du projet de test. |
| 6 | `version` d'`app.json` = 1.0.0, dernière release = v1.0.4 | ⚠️ | EAS gère les numéros de build à distance (`appVersionSource: remote`), donc ce n'est pas bloquant, mais la version affichée n'est pas la version réelle. |
| 7 | `REDIRECT_URI_WEB` en dur sur `http://localhost:8081` | ℹ️ | OAuth impossible sur le web en production. Le mobile n'est pas concerné. |

**Chemin le plus court vers la production :** 1 et 2 sont les seuls vrais
bloquants. 3 et 5 se règlent en quelques minutes de console.
