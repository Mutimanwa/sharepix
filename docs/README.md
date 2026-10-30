# Documentation SharePix

Les documents sont regroupés ici. Le guide de projet reste à la racine :
[`../README.md`](../README.md). Les chemins de code cités sans lien dans les
plans sont en général relatifs à la racine du dépôt.

## Références courantes

| Document | Usage |
| --- | --- |
| [`CICD.md`](CICD.md) | Workflows, builds, secrets et contrôles CI actuels |
| [`IOS_READINESS_PLAN.md`](IOS_READINESS_PLAN.md) | Préparation iOS, vérifications effectuées et tests iPhone encore nécessaires |
| [`NOTIFICATIONS_FINAL_REFINEMENT.md`](NOTIFICATIONS_FINAL_REFINEMENT.md) | État des préférences et du système de notifications |
| [`PUSH_NOTIFICATIONS_DIAGNOSTIC_PLAN.md`](PUSH_NOTIFICATIONS_DIAGNOSTIC_PLAN.md) | Historique du diagnostic push et résultat final du déploiement |
| [`DECISIONS.md`](DECISIONS.md) | Registre des décisions produit et techniques; lire les dates des constats |

## Audits, plans et rapports

Ces fichiers conservent les constats et décisions de leur période. Les statuts,
branches, nombres, tâches ouvertes et recommandations datés ne sont pas
nécessairement l'état actuel; pour le présent, se référer au README et aux
guides ci-dessus. Ne pas présenter comme implémentée une fonctionnalité qui
n'a pas été validée dans le code ou sur appareil.

| Document | Sujet |
| --- | --- |
| [`AUDIT_SHAREPIX.md`](AUDIT_SHAREPIX.md) | Audit technique et produit daté, réalisé avec vérification Supabase |
| [`PLAN_ACTION.md`](PLAN_ACTION.md) | Ancienne feuille de route; snapshot du sprint initial |
| [`SPRINT1_RAPPORT.md`](SPRINT1_RAPPORT.md) | Rapport du premier sprint |
| [`SPRINT3_RAPPORT.md`](SPRINT3_RAPPORT.md) | Rapport du troisième sprint |
| [`DOSSIER_SHAREPIX.md`](DOSSIER_SHAREPIX.md) | Dossier produit et textes légaux; à relire avant toute publication |
| [`PRESENTATION_VIDEO.md`](PRESENTATION_VIDEO.md) | Script de présentation, durée cible 22 minutes |
| [`APK_RELEASE_DOWNLOAD_FIX_PLAN.md`](APK_RELEASE_DOWNLOAD_FIX_PLAN.md) | Correctif de téléchargement des APK |
| [`HOME_DOWNLOADS_AND_ICONS_PLAN.md`](HOME_DOWNLOADS_AND_ICONS_PLAN.md) | Accueil, téléchargements et icônes |
| [`HOME_LANDING_UX_PLAN.md`](HOME_LANDING_UX_PLAN.md) | UX de l'accueil mobile |
| [`SITE_LANDING_UX_PLAN.md`](SITE_LANDING_UX_PLAN.md) | UX du site vitrine |
| [`PHOTO_DUPLICATE_AND_HOME_FEED_PLAN.md`](PHOTO_DUPLICATE_AND_HOME_FEED_PLAN.md) | Doublons photo et nouveautés de l'accueil |
| [`NOTIFICATION_SYSTEM_PLAN.md`](NOTIFICATION_SYSTEM_PLAN.md) | Refonte des Activités et des notifications |
| [`PUSH_NOTIFICATION_ICON_AND_ACTIVITY_SELECTION_PLAN.md`](PUSH_NOTIFICATION_ICON_AND_ACTIVITY_SELECTION_PLAN.md) | Icône push et sélection des Activités |
| [`ONBOARDING_BUTTONS_INVESTIGATION.md`](ONBOARDING_BUTTONS_INVESTIGATION.md) | Diagnostic des boutons d'onboarding |
| [`SENTRY_IMPLEMENTATION_PLAN.md`](SENTRY_IMPLEMENTATION_PLAN.md) | Intégration et configuration Sentry |

## Repères de contenu

- L'application partage actuellement des **photos**; l'envoi vidéo et la
  synchronisation hors-ligne ne sont pas des fonctionnalités livrées.
- Les images sont préparées avant upload; le projet ne garantit pas une
  conservation bit-à-bit de l'original. Voir le code `src/lib/imageResize.js`.
- La Preview iOS est en préparation, mais l'installation et les parcours sur
  iPhone restent à valider; voir le plan iOS.
- La publication `eas update` existe, mais la consommation OTA par l'application
  n'est pas activée tant que `expo-updates` et sa configuration ne sont pas
  intégrés au build.
- Les pages publiques `web/index.html`, `web/privacy.html` et `web/terms.html`
  contiennent des affirmations à revoir (vidéos et identité de l'éditeur). Elles
  n'ont pas été modifiées dans ce rangement documentaire; confirmer l'entité
  juridique avant de modifier ou republier les textes légaux.
