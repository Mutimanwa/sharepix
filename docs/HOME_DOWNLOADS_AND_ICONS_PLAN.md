# Plan — Accueil, icônes d’aide et téléchargements SharePix

## Constats avant modification
1. **Actions de l’Accueil** — « Nouvel album » et « Rejoindre » changent l’état d’ouverture des feuilles, mais ces feuilles sont affichées inline. Cela diffère du popup/modal demandé et constitue la piste principale à corriger; l’interaction Android doit ensuite être retestée.
2. **Aide et informations** — `LocalInfoAccordion` utilise des caractères Unicode comme chevrons et n’affiche pas d’icône vectorielle pour FAQ, conditions et confidentialité.
3. **Dossier Galerie** — `PhotoScreen` enregistre actuellement chaque photo directement dans la bibliothèque, sans album SharePix dédié.
4. **Téléchargements multiples/progression** — le carrousel photo permet un seul téléchargement à la fois. L’album possède une sélection multiple pour supprimer des photos, mais aucun bouton de téléchargement; la progression visible existante concerne l’upload, pas le téléchargement.

## Travail prévu
- Remplacer le rendu inline des deux feuilles d’accueil par le popup `Sheet`/`Modal` standard; rendre les callbacks exclusifs et accessibles.
- Ajouter de vraies icônes Hugeicons pour FAQ, conditions et confidentialité, ainsi que pour les chevrons d’ouverture/fermeture.
- Centraliser l’enregistrement des images dans un album Galerie nommé **SharePix** (Android : album sous Pictures/SharePix); le téléchargement unitaire et multiple utilisent le même service.
- Ajouter une action de téléchargement dans le mode de sélection multiple de l’album, avec progression séquentielle visible (compteur et indicateur de progression) et résumé des échecs/réussites.
- Garder ce lot limité aux photos/images; les vidéos restent hors périmètre conformément à la priorité images d’abord.
- Vérifier les API Expo MediaLibrary/Filesystem installées, exécuter typecheck/lint/tests et exporter Android. Ne pas prétendre valider l’écriture Galerie, les permissions ou les touches sans test sur appareil.

## Réalisé
- Les deux feuilles de Home utilisent maintenant le `Sheet`/`Modal` natif; les actions sont exclusives, plus grandes et munies de libellés accessibles. Le choix « Rejoindre » présente une phrase d’aide puis deux cartes de même importance (« Saisir un code » / « Scanner un QR code »), avec icônes Hugeicons, descriptions et chevrons, dans la palette SharePix.
- FAQ, conditions et confidentialité ont chacune une icône Hugeicons dédiée; le chevron est maintenant une icône vectorielle orientée selon l’état.
- `galleryDownloads.js` centralise le téléchargement natif et l’enregistrement dans l’album Galerie SharePix; la photo individuelle réutilise ce service.
- La sélection multiple de l’album expose une action Télécharger; le traitement séquentiel affiche un indicateur, un compteur et une barre de progression. Un résumé distingue les succès et échecs.
- Le périmètre est limité aux images; le code refuse explicitement les vidéos pour ce parcours.

## Vérifications et limites
- `npm run verify` réussi : typecheck, lint, 7 suites / 42 tests; `git diff --check` propre.
- Export Metro Android réussi (7 798 modules).
- Pas d’appareil Android/ADB dans cet environnement : les popups, permissions, création réelle du dossier et téléchargements Galerie restent à tester sur téléphone.

## Critères d’acceptation
- « Nouvel album » ouvre le popup de création; « Rejoindre » ouvre d’abord les choix code/QR puis le parcours correspondant.
- FAQ/conditions/confidentialité affichent de vraies icônes vectorielles, y compris un chevron vectoriel qui reflète l’état.
- Une photo enregistrée apparaît dans l’album Galerie SharePix; sur Android le dossier est sous Pictures.
- L’utilisateur peut sélectionner plusieurs photos de l’album et les télécharger séquentiellement; une progression est affichée jusqu’à la fin et un résumé est présenté.
