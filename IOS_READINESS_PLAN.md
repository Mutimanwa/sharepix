# Plan et avancement — démarrer la validation iOS de SharePix

## État de départ vérifié

- Branche de travail : `arena/c3192d6f-sharepix`; `origin/main` est au commit `2ec72fb` au début de l'audit.
- Le projet est Expo managed (SDK 57 / React Native 0.86); aucun dossier natif `ios/` n'est versionné.
- La configuration Expo reconnaît `ios`, `android` et `web`, avec le bundle ID `app.sharepix.mobile`, le schéma `sharepix` et la prise en charge iPad.
- Les plugins caméra, sélecteur d'images, photothèque, notifications, navigateur OAuth et Sentry sont présents. Le profil EAS `preview` est une distribution interne, mais le workflow GitHub Preview ne savait initialement builder qu'Android.
- Les parcours de l'app sont majoritairement partagés; caméra, galerie, navigateur OAuth et push utilisent déjà des composants/configurations Expo natifs.
- `npm run verify` réussissait au début de l'audit (8 suites / 45 tests). Expo Doctor a réussi 19/21 contrôles; les deux appels nécessitant Expo API / React Native Directory ont échoué sur TLS, sans diagnostic local de configuration.
- Aucun build iOS ni test sur iPhone n'avait été réalisé au début. Les identifiants Apple, le provisionnement et les clés APNs ne peuvent pas être vérifiés depuis le dépôt.

## Changements réalisés dans cette branche

1. **Preview** : ajout du choix `android` / `ios` au déclenchement manuel. Android demeure le choix par défaut; la condition `build=true` et la génération APK Android sont préservées. iOS lance le profil EAS `preview` et produit un IPA.
2. **Production** : ajout du choix `ios`; les options sont désormais `android`, `ios` et `all`. Les tags `v*` gardent leur comportement Android par défaut.
3. **Configuration iOS Expo** : le schéma `sharepix` est maintenant géré par la propriété Expo `scheme`, sans `CFBundleURLTypes` dupliqué. La cible iOS minimale effective générée par SDK 57 est explicitée à `16.4`.
4. **Permissions** : l'app utilise la caméra pour scanner et choisit/enregistre des photos, sans enregistrer d'audio. Les descriptions iOS de caméra et photothèque sont configurées; les permissions microphone sont désactivées.
5. **Documentation** : `CICD.md` explique les choix de plateformes et les prérequis de signature Apple.

## Vérifications effectuées

- `CI=1 npx expo prebuild --platform ios --no-install --clean` : réussite après les changements. Inspection du projet généré : bundle ID `app.sharepix.mobile`, schémas `sharepix` et `exp+sharepix`, cible iOS 16.4, descriptions caméra et photothèque présentes, description microphone absente.
- L'icône source iOS est un PNG carré de 1024 × 1024.
- Les deux workflows GitHub Actions sont syntaxiquement valides en YAML.
- `npx expo config --type public --json` confirme iOS, Android et Web, le schéma, le bundle ID, la cible 16.4 et les paramètres de permissions attendus.
- `npm run verify` : réussite après les changements — typecheck, lint, 8 suites / 45 tests.
- Le dossier natif généré par Prebuild n'est pas versionné : le projet reste en mode Expo managed.
- **Non vérifiés** : compilation/signature iOS cloud, installation sur iPhone, OAuth Google réel, caméra/photothèque réelles et réception APNs. Aucune de ces validations ne peut être déduite d'un Prebuild réussi.
- Une tentative de `expo export --platform ios` est restée sur « Starting Metro Bundler » jusqu'au délai de 180 s, sans produire d'export; elle ne compte pas comme validation réussie.

## Étapes restantes avant de déclarer iOS utilisable

1. Faire intégrer ces changements sur la branche par défaut pour rendre le nouveau choix de `workflow_dispatch` disponible dans GitHub Actions.
2. Dans **Preview**, lancer manuellement avec `build=true` et `platform=ios`. Le jeton EAS doit être disponible; EAS doit disposer des credentials/profils Apple requis pour une distribution iOS interne. Android reste le chemin `build=true` par défaut pour produire l'APK.
3. Installer l'IPA sur un iPhone et vérifier : connexion Google et retour OAuth, création/jointure par code et QR, choix/upload/aperçu photo, doublons, sauvegarde dans Photos, clavier, ouverture d'une notification et réception des push.
4. Configurer/valider APNs dans EAS avant d'annoncer les notifications iOS comme opérationnelles.
5. Avant une soumission App Store, vérifier si le parcours de connexion Google de SharePix entre dans le champ de la règle 4.8 d'Apple et, le cas échéant, ajouter une option de connexion conforme (par exemple Sign in with Apple). La règle dépend de la façon dont Google intervient dans la création/connexion du compte principal; ce point n'est pas tranché par l'audit statique.

## Critères de sortie

- Le workflow Preview produit un IPA quand iOS est choisi et conserve l'APK Android par défaut.
- Un build iOS signé s'installe sur un iPhone et les parcours de base ci-dessus sont validés réellement.
- Les push ne sont déclarées validées qu'après une réception sur appareil.
- Aucun secret, certificat, clé privée ou profil de provisionnement n'est ajouté au dépôt ou partagé dans le chat.

## Références officielles

- EAS Build / signatures iOS : https://docs.expo.dev/build/setup/
- App Store Review Guidelines, section 4.8 : https://developer.apple.com/app-store/review/guidelines/
