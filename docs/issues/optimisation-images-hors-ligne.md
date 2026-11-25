# BUG-IMAGES-OFFLINE — chargement répété et consultation hors connexion

**Priorité : P1 — expérience d’accueil et accès aux souvenirs**  
**Périmètre :** cache local persistant, dernières photos de l’accueil et photos des albums déjà consultés. Aucun changement des règles RLS, des objets Storage ou des comptes.

## Symptômes rapportés

- Les photos des albums se rechargent après fermeture puis réouverture de l’application.
- Sans connexion, les albums sont visibles, mais leur contenu photo ne l’est pas.
- Le chargement de l’accueil est jugé anormalement lent depuis l’ajout des photos récentes.

## Vérification de la base réelle (Supabase, projet SharePix)

- Services Auth, DB et Storage indiqués `ACTIVE_HEALTHY`.
- Base consultée : 11 lignes `photos`, 4 albums et 4 adhésions.
- Les 11 lignes photo ont une taille renseignée : moyenne 195,9 Kio, maximum 361,6 Kio, total 2 207 084 octets.
- Un index `photos_created_at_notification_idx` existe sur `photos(created_at)`.
- Le plan de la requête `ORDER BY created_at DESC LIMIT 12` choisit un scan séquentiel sur une table minuscule (estimation de 16 lignes) : ce n’est pas une preuve de lenteur SQL; son coût est négligeable à cette échelle.

## Diagnostic

1. `HomeScreen` conservait le flux récent seulement dans un `useState` et ne le rechargeait qu’en ligne; il n’était pas disponible après redémarrage hors connexion.
2. Les albums restaurés par `cloudFetchMyAlbums` commencent avec `photos: []`. Les photos de l’album ne sont chargées qu’à l’ouverture; leurs URL Supabase signées ne constituent pas une copie hors ligne durable.
3. Le cache d’images `expo-image` accélère les affichages déjà en cache, mais c’est un cache système évictable et il ne fournit ni métadonnées locales au flux récent ni garantie de conservation offline.
4. La requête cloud elle-même n’est pas le suspect principal dans la base actuelle : 11 photos seulement et tailles modestes. L’absence de copie persistante locale explique directement l’écran vide hors réseau et le rechargement après redémarrage.
5. Le carrousel récent était un `ScrollView` qui montait jusqu’à 12 images ensemble. Il est remplacé par une liste virtualisée afin de réduire le travail immédiat de l’accueil.

## Travail réalisé

- Ajout de `src/services/offlinePhotos.js` : métadonnées hors ligne séparées par utilisateur, fichiers image dans le stockage privé persistant de l’application, cache plafonné à 128 Mio par compte, téléchargements limités à deux simultanés.
- L’accueil restaure d’abord les dernières photos locales puis synchronise Supabase sans vider les données locales en cas d’erreur réseau. Les URLs signées ne sont pas écrites dans l’index hors ligne.
- La liste horizontale des photos récentes est passée à `FlatList` avec rendu initial de trois cellules et petits lots de rendu.
- À l’ouverture d’un album, les photos/metadata déjà en cache sont affichées avant la requête cloud; les résultats en ligne mettent ensuite le cache privé à jour en arrière-plan.
- Les photos locales sont conservées lors de la restauration des albums, utilisées dans l’accueil, la grille et le carrousel. La déconnexion supprime le cache du compte actif.
- Ajout de tests du cache hors ligne : redémarrage simulé, disponibilité des fichiers/metadata, séparation par compte, effacement à la déconnexion et échec réseau.

## Vérifications effectuées

- `npm run verify` : TypeScript, ESLint et 9 suites / 48 tests réussis.
- `git diff --check` : réussi.
- Pas encore de test sur appareil ni de nouveau build; le mode avion doit être confirmé sur APK après installation.

## Critères d’acceptation

- Après une première synchronisation réussie, tuer puis relancer l’application en mode avion : les albums et les photos récemment mises en cache restent consultables sans afficher d’URL expirée.
- Ouvrir un album déjà consulté hors connexion affiche ses photos locales; les actions nécessitant le serveur restent indisponibles sans faire disparaître le contenu.
- Une erreur de synchronisation ne supprime ni les métadonnées ni les fichiers locaux déjà disponibles.
- Le cache d’un compte n’est jamais présenté à un autre compte.
- La récupération en ligne est non bloquante et limitée en concurrence; le défilement de l’accueil ne déclenche pas une rafale de 12 téléchargements inutiles.
- `npm run verify` et `git diff --check` passent; validation sur appareil/build requise pour confirmer le mode avion et le cache natif.

## Hors périmètre

- Cache complet à usage garanti de tous les albums jamais ouverts ou de toutes les vidéos.
- Synchronisation hors ligne des commentaires/likes vers Supabase, transformations/miniatures côté serveur, changement de plan Supabase.
- Modification des politiques RLS ou suppression des objets cloud.
