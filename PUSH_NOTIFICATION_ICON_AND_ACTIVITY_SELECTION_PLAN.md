# Logo des notifications et sélection multiple des activités

## Demande
1. Utiliser le logo SharePix fourni pour l'icône des notifications.
2. Aligner les actions de sélection multiple dans Activités sur le comportement déjà utilisé dans un album.

## Constat initial
- `app.json` configure déjà `assets/notification-icon.png` pour `expo-notifications`; cet asset actuel est une icône caméra.
- L'image fournie est un PNG RGBA horizontal. Android n'affiche pas une image couleur comme icône de statut de notification : l'asset doit être monochrome avec transparence. On produira donc une silhouette blanche simplifiée du motif central à trois personnes, dans le fichier déjà référencé, sans changer la config native.
- `ActivitiesScreen` a déjà la sélection multiple, « tout sélectionner » et le masquage multiple, mais l'action de masquage s'exécute immédiatement et masque localement même si l'écriture serveur échoue. Dans `AlbumScreen`, la suppression multiple passe d'abord par une feuille de confirmation.

## Modifications et vérifications
- **Terminé :** logo source conservé sous `assets/sharepix-notification-logo.png`; `assets/notification-icon.png` remplacé par le motif central simplifié des trois personnes en blanc transparent (96×96). L'asset est bien monochrome sur ses pixels opaques et `app.json` continue de le référencer.
- **Terminé :** dans Activités, l'action groupée suit maintenant l'album : sélection désactivée si vide, confirmation explicite avant masquage, erreur serveur signalée et retrait local seulement après succès. L'action unitaire et la navigation restent inchangées.
- **Vérifié :** `npm run verify` passe (7 suites / 42 tests), le lint Deno passe, le PNG est en 96×96 RGBA et `git diff --check` est propre.
- **À faire sur appareil :** reconstruire/réinstaller l'APK pour intégrer le nouvel asset Android natif; vérifier visuellement l'icône et le dialogue de sélection multiple sur Android.
