# Plan — Refonte UX/UI de l’accueil SharePix

## But de la demande
Rendre l’écran d’accueil de SharePix plus distinctif et utile, sans changer la charte de marque ni casser les actions et parcours existants.

## Audit de l’écran actuel
- Logo et slogan centrés, puis deux boutons contour de poids visuel similaire : la marque et les actions ne créent pas une hiérarchie forte.
- Les cartes « Idées d’albums » apparaissent avant « Mes albums » : l’inspiration générique prend la place du contenu personnel.
- La même structure visuelle s’applique aux nouveaux utilisateurs et à ceux qui ont déjà des albums; l’accueil paraît statique.
- L’état vide est isolé après les actions et les idées, au lieu d’expliquer clairement la prochaine étape.
- Les composants utilisent déjà la palette turquoise/corail et les illustrations SharePix; la refonte doit capitaliser sur ces actifs plutôt que changer de style.

## Recherche UX (sources primaires)
- **Apple HIG, Designing for iOS** : mettre l’accent sur les tâches/contenus principaux, limiter les contrôles visibles et adapter les actions à la prise en main. https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
- **Google Photos, annonce officielle du redesign** : rendre les photos et les souvenirs plus visibles, simplifier l’organisation de la page et aider à retrouver/revivre les moments. https://blog.google/products-and-platforms/products/photos/redesigned-google-photos/
- **Airbnb, annonce officielle de l’app remaniée** : faire de l’accueil une porte d’entrée de découverte contextualisée, en gardant les grands domaines de navigation lisibles. https://news.airbnb.com/airbnb-2025-summer-release

### Principes retenus pour SharePix
1. Le contenu personnel (albums et photos) doit passer avant les suggestions génériques dès qu’il existe.
2. L’accueil doit s’adapter : message/action de démarrage clair sans album; mise en avant du dernier album/photo disponible pour un utilisateur actif.
3. Créer et rejoindre restent accessibles immédiatement, avec une action principale visuellement dominante et une action secondaire claire.
4. Une hiérarchie typographique, des espaces généreux, des visuels et des coins arrondis doivent enrichir la page tout en conservant les couleurs, icônes et illustrations déjà propres à SharePix.
5. Pas de promesse de recommandation algorithmique ou de nouveau backend : la personnalisation se limite au prénom et aux albums réellement disponibles.

## Modifications prévues
- Recomposer l’en-tête en accueil personnalisé et lisible.
- Ajouter une carte éditoriale de bienvenue : illustration SharePix pour un compte sans album; couverture réelle et lien vers le dernier album quand disponible.
- Mettre « Mes albums » avant « Idées d’albums »; rendre l’état vide concis et orienté vers l’action.
- Clarifier visuellement « Créer un album » (principal) et « Rejoindre » (secondaire mais immédiatement visible), sans modifier les modales et le parcours code/QR.
- Harmoniser les cartes de suggestions avec la charte et les rendre accessibles.

## Réalisé
- Accueil rehiérarchisé avec marque et message d’accueil personnalisé au-dessus d’une carte éditoriale de bienvenue.
- La carte montre l’illustration SharePix pour un compte sans album; dès qu’une couverture réelle existe, elle met en avant la couverture du dernier album disponible avec un raccourci d’ouverture.
- Les actions Créer/Rejoindre sont immédiatement visibles; Créer a la priorité visuelle et Rejoindre reste clairement accessible.
- « Mes albums » précède les suggestions; les états vides sont plus sobres et orientés vers la suite, et les cartes d’idées ont été harmonisées avec le système visuel.
- Les parcours de création et de jointure existants sont préservés.

## Vérifications et limites
- `npm run verify` réussi : typecheck, lint, 7 suites / 42 tests; `git diff --check` propre.
- Export Metro Android réussi (7 798 modules).
- Preview Expo web démarré sur le port 8081; pas de navigateur headless/appareil Android disponible pour automatiser une capture visuelle ou confirmer le rendu tactile sur téléphone.
