# Plan — Refonte UX/UI du site de présentation SharePix

## But
Moderniser le site statique `web/index.html` pour expliquer rapidement la valeur de SharePix, montrer la vraie application et conduire vers son téléchargement, sans inventer de preuve sociale ni changer le produit.

## Audit de l’existant
- Hero sur une photo de route Unsplash générique, sans lien visuel avec la galerie partagée; un grand titre vague et trois maquettes de téléphone imposent une longue première impression.
- Plus bas, une composition de faux téléphones utilise des photos de voyage/hôtel Unsplash comme si c’étaient des écrans applicatifs, alors que de vraies captures sont déjà dans `web/assets/imgs/`.
- Le récit répète plusieurs fois les mêmes promesses et CTA; la hiérarchie avantages → démonstration → téléchargement est peu nette.
- La rangée de chiffres (1 / 0 / 8) ressemble à des statistiques de marque alors qu’il s’agit de propriétés/formats, sans contexte ni source.
- CTA de téléchargement codé sur la version `v1.0.4`, alors que GitHub Release indique `v1.0.13`; la mention « bientôt sur Google Play » est à confirmer et doit être retirée si non vérifiée.
- Sur mobile, l’icône de téléchargement ne correspond pas au menu déclaré; le script attend `mobile-menu-btn` qui n’existe pas, donc le script peut planter et les liens de navigation mobile restent inaccessibles.
- Le site charge Tailwind et Font Awesome par CDN, plus des images de démonstration distantes; le chargement et le rendu dépendent de services tiers alors que la page peut s’appuyer sur des styles locaux et captures locales.
- Newsletter Netlify et réseaux sociaux utilisent des destinations/placeholders sans preuve de fonctionnement; remplacer les appels à l’action fictifs par des liens réels vers télécharger, contact et mentions légales.

## Recherche UX (sources primaires)
- **Apple HIG — Designing for iOS** : concentrer l’attention sur tâches et contenu principaux, limiter les contrôles visibles et tenir compte de la prise en main. https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
- **Google Photos — redesign officiel** : donner la priorité aux photos/souvenirs réels et simplifier les points d’entrée pour les retrouver. https://blog.google/products/photos/redesigned-google-photos/
- **Airbnb — publication officielle de l’application repensée** : clarifier ce que l’app offre et faire de l’accueil une entrée vers la découverte des offres utiles. https://news.airbnb.com/airbnb-2025-summer-release
- **Application SharePix telle qu’elle existe** : le dépôt contient déjà des captures réelles de l’accueil et d’un album. Le site peut donc montrer le produit lui-même au lieu de simuler son interface avec des photos génériques; aucune note, nombre d’utilisateurs, partenaire ou disponibilité iOS/App Store ne sera inventé.

## Direction retenue
1. Promesse explicite dès le premier écran : toutes les photos d’un événement dans un album partagé, avec accès contrôlé.
2. Une action principale, « Télécharger l’APK Android », et un lien secondaire « Voir comment ça marche ».
3. Montrer les vraies captures locales de l’application; retirer toutes les images Unsplash génériques/faux appareils.
4. Organiser le contenu en parcours court : promesse/démonstration → bénéfices concrets → trois étapes → FAQ de confiance → téléchargement final.
5. Conserver la palette SharePix turquoise/corail, la typographie Poppins en solution de repli, les liens juridiques et l’adresse contact.
6. Versionner le téléchargement par l’URL stable GitHub `releases/latest/download/sharepix-latest.apk`; ne pas afficher de version statique à maintenir.
7. Supprimer les chiffres pseudo-statistiques, formulaire newsletter sans backend vérifié, liens sociaux `#` et mention Play Store non vérifiée.
8. Remplacer les dépendances Tailwind/FontAwesome distantes par CSS local et SVG inline; améliorer l’accessibilité, SEO, responsive et fonctionnement du menu mobile.

## Modifications prévues
- Réécrire `web/index.html` en landing page française sémantique et concise; garder des liens fonctionnels vers `privacy.html`, `terms.html` et `mailto:contact@sharepix.app`.
- Refaire `web/assets/css/custom.css` avec tokens de marque, hero split, captures produit, cartes de bénéfices, étapes, FAQ, téléchargements et menu responsive.
- Mettre à jour le lien APK vers la release la plus récente publiée (vérifiée via `gh release view`, v1.0.13 au moment de l’audit).
- Tester les liens/ancrages, la présence du menu mobile, les chemins d’images, le rendu desktop/mobile et les erreurs HTML/JS.

## Réalisé
- Landing page réorganisée autour d’une promesse claire, d’un aperçu authentique de l’application, de trois étapes, des avantages, d’une FAQ et d’un CTA final.
- Les images Unsplash/faux appareils, les chiffres pseudo-statistiques, les placeholders sociaux et le formulaire newsletter sans backend vérifié ont été retirés; le site utilise maintenant les captures réelles déjà présentes dans `web/assets/imgs/`.
- Lien APK actualisé vers `releases/latest/download/sharepix-latest.apk` (release publiée vérifiée : v1.0.13 au moment du travail).
- Menu mobile reconstruit avec bouton accessible, états `aria-expanded`, fermeture après navigation/Échap; liens légaux, contact et politique conservés.
- Tailwind CDN et Font Awesome remplacés par CSS local et SVG inline; ajout d’informations SEO, `alt`, chargement différé des captures secondaires, tailles d’images, focus visible et prise en compte de `prefers-reduced-motion`.

## Vérifications et limites
- Preview statique servi sur `0.0.0.0:4173`.
- Contrôle automatisé des liens d’ancrage, IDs et ressources locales : aucun ID dupliqué, aucune ancre cassée, toutes les ressources en HTTP 200.
- Test du script : ouverture/fermeture du menu, fermeture par lien et Échap, année dynamique réussis.
- La page a été vérifiée via parsing HTML et HTTP local; aucune capture sur appareil physique ni publication sur l’hébergeur n’a été réalisée.
