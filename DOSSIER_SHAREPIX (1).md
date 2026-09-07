# SharePix — Dossier complet
**Description · Charte graphique · Politique de confidentialité · Conditions d'utilisation**

> Document de référence unique. Les textes légaux (§3 et §4) sont le contenu
> exact de `public/privacy.html` et `public/terms.html` (publiés aussi dans `web/`).
> Dernière mise à jour : septembre 2026.

---

# 1. Description totale de SharePix

## 1.1 En une phrase

**SharePix est l'application qui rassemble les souvenirs de vos événements en
un seul endroit — en privé.**

Slogan store : *« Vos souvenirs, en un seul endroit, avec les bonnes personnes. »*

## 1.2 Le problème et la solution

**Problème** — Lors d'un mariage, de vacances ou d'un anniversaire, les photos
se dispersent : groupes WhatsApp compressés, dizaines de conversations,
doublons, souvenirs perdus.

**Solution** — Un album = un code d'invitation à 8 caractères (ou un QR code).
Chacun ajoute ses photos dans l'album partagé ; tout le monde contribue, tout
le monde en profite. Rien n'est public : seuls les invités voient le contenu.

## 1.3 Positionnement

| Axe | Choix SharePix |
| --- | --- |
| Confidentialité | **100 % privé** — aucun espace public, aucun inconnu |
| Friction | **Aucune inscription** pour commencer (compte invité automatique) |
| Invitation | **10 secondes** : code à 8 caractères ou QR / lien direct |
| Contenu | Photos **et vidéos**, commentaires, réponses, « j'aime » |
| Vivant | **Temps réel** : activité, compteurs, couvertures, notifications |
| Accès | **Hors-ligne** d'abord, synchronisation multi-appareils ensuite |
| Web | Participation possible depuis un navigateur (sans installer l'app) |

## 1.4 Fonctionnalités détaillées

**Albums privés**
- Création d'albums photo/vidéo illimités (mariage, vacances, famille…)
- Invitation par code à 8 caractères, QR code ou lien `sharepix://join?code=…`
  (scan → feuille « Rejoindre » pré-remplie + recherche automatique)
- Gestion par le propriétaire : renommer, retirer un membre, supprimer l'album
  (fichiers + cascades). Un membre peut quitter un album.

**Photos & vidéos**
- Upload vers un stockage **privé** (URLs signées d'1 h, délivrées uniquement
  aux membres)
- Onglets Tous / Vidéos / Favoris, sélection multiple, suppression
- Commentaires avec réponses, « j'aime », favoris personnels
- Images progressives (pulsation → fondu) et squelettes de chargement

**Accueil vivant**
- Compteurs de photos et couvertures pré-chargés au démarrage
- Mis à jour en **Realtime** sans entrer dans l'album (debounce 600 ms)

**Centre d'activités**
- Journal en direct : qui a rejoint, publié, commenté, aimé
- Masquage individuel des entrées (persistance serveur)

**Notifications push (Android / FCM V1)**
- Tokens en base, Edge Function `activity-push` + Webhook `activity_log`
- Préférences par catégorie (photos, likes, commentaires) dans Profil

**Comptes**
- Compte **invité anonyme** créé automatiquement à la 1ʳᵉ ouverture
- Conversion en compte permanent **sans perte de données** (même `user_id`) :
  e-mail ou connexion Google (`linkIdentity`)
- Synchronisation multi-appareils automatique

**Hors-ligne**
- L'app fonctionne sans réseau et se synchronise au retour de la connexion
- Mode 100 % local (repli gracieux) si le cloud est absent/injoignable

## 1.5 Parcours utilisateur

1. **Splash** (routage selon la session : onboarding / auth / accueil)
2. **Onboarding** : créer ou rejoindre un album
3. **Accueil** : albums avec compteurs + couvertures en direct
4. **Album** : photos, vidéos, favoris, commentaires, likes
5. **Invitation** : code 8 caractères + QR deep link
6. **Centre d'activités** temps réel
7. **Profil** : conversion de compte, préférences de notifications
8. **Premium / Téléchargement PC** (écrans vitrine)

## 1.6 Sécurité & backend

- **Supabase** : Auth, Postgres, Storage privé, Realtime, Edge Functions
- **RLS durcie** : aucune lecture possible sans session, aucun accès hors
  membres d'un album ; RPC `security definer` pour les opérations sensibles
- **Jamais de `service_role` dans l'app** — clé anon uniquement
- Bucket `album-photos` privé, liens temporaires signés
- Harnais de vérification `supabase/rls-check.cjs` (exit 1 au moindre souci)
- Schéma `supabase/schema.sql` ré-exécutable en entier, idempotent

## 1.7 Stack technique

React Native 0.86 + Expo SDK 57 (React 19) · Supabase · React Navigation
(stack + tabs, linking configuré) · AsyncStorage · expo-image-picker,
expo-notifications, expo-linking · EAS Build (package `app.sharepix.mobile`).

## 1.8 Identité du produit

| Champ | Valeur |
| --- | --- |
| Nom | **SharePix** |
| Éditeur | **RESTART** |
| Nom store (30 car.) | `SharePix – Albums photo privés` |
| Description courte (80 car.) | `Partagez vos photos d'événements en albums privés, avec un simple code.` |
| Package / bundleId | `app.sharepix.mobile` |
| Deep link | `sharepix://` (join, auth callback) |
| Catégorie Play Store | Photographie |
| Langue par défaut | Français (fr-FR) |
| Distribution | Directe (landing page + APK) → Google Play dès ouverture du compte dev |

---

# 2. Charte graphique

## 2.1 Palette (source : `src/theme.js`)

### Couleurs principales

| Rôle | Nom | Code | Usage |
| --- | --- | --- | --- |
| Primaire | **Teal** | `#2BA3A8` | Marque, titres, liens, onglets actifs, accents |
| Primaire sombre | **TealDark / Ink** | `#164E52` | Textes principaux, titres foncés, icônes fortes |
| Profond | **TealDeep** | `#0E3A3E` | Fonds d'écrans d'accroche (onboarding, sheet) |
| Accent | **Coral** | `#E07A6A` | Boutons d'action principaux (CTA), badges, liens d'alerte douce |
| Accent sombre | **CoralDark** | `#C96556` | États pressés / actifs des CTA corail |

### Couleurs de surface

| Rôle | Nom | Code | Usage |
| --- | --- | --- | --- |
| Fond d'app | **Cream** | `#F3F8F8` | Arrière-plan général |
| Surface claire | **Light** | `#EEF5F5` | Cartes secondaires, zones enfoncées |
| Surface douce | **Peach** | `#E8F6F6` | Pastilles, fonds de chips teal |
| Bordure | **Border** | `#D5E3E3` | Contours de cartes, champs, séparateurs |
| Texte secondaire | **Muted** | `#6B7C7D` | Descriptions, méta, placeholders |
| Neutre | **Taupe** | `#C4B8B0` / **TaupeDark** `#A89B93` | Éléments désactivés, ombres douces |
| Succès | **Success** | `#22C55E` | Confirmations |
| Blanc | **White** | `#FFFFFF` | Cartes, modales, sheets |

## 2.2 Typographie

- **Wordmark / marque** : serif gras — `Georgia` 700 (logo, titres de marque)
- **Interface** : sans-sérif système (SF / Roboto / Segoe UI)
- Hiérarchie habituelle : titres d'écran gras teal sombre, corps 15–16 px,
  méta 13 px muted

## 2.3 Logo & assets

| Asset | Fichier | Notes |
| --- | --- | --- |
| Logo horizontal | `assets/sharepix-logo.png` (600×327) | Wordmark + appareil photo, fond transparent |
| Icône app | `assets/sharepix-icon.png` | Référencée dans `app.json` |
| Icône Play 512×512 | `store/play-icon-512.png` | Générée, prête console |
| Bannière 1024×500 | `store/play-banner-1024x500.png` | Logo + slogan + visuel téléphone |

## 2.4 Iconographie

- Bibliothèque **Hugeicons** (stroke fin, cohérente partout)
- Convention : **icône à gauche du libellé** (onglets, boutons, listes)
- Pastilles circulaires `peach` pour les icônes de section

## 2.5 Composants & motifs

- Design system partagé : `components/UI.js` (Page, Sheet, CoralButton, Field…)
- Cartes blanches, coins arrondis (~12–16 px), bordure `border`
- **CTA principal = corail**, actions secondaires = teal/outline
- Sheets en bas d'écran pour les actions (créer / rejoindre / options)
- Squelettes pulsants puis fondu (jamais d'écran blanc)
- Web (landing + pages légales) : mêmes couleurs, fond cream, liens corail

## 2.6 Ton & voix

- **Français** partout, phrases courtes et chaleureuses
- Vouvoiement, zéro jargon technique côté utilisateur
- **Pas d'emoji dans l'interface** (les emojis n'apparaissent que dans la
  description marketing du store)
- Messages d'erreur explicites et rassurants (mode hors-ligne expliqué)

---

# 3. Politique de confidentialité

*Application **SharePix** — Dernière mise à jour : août 2026*
*(version web : `public/privacy.html` / `web/privacy.html`)*

> SharePix (« l'application », « le service ») est une application de partage
> **privé** d'albums photo et vidéo lors d'événements (mariages, vacances,
> famille…). Chaque album n'est accessible qu'aux personnes invitées au moyen
> d'un code à 8 caractères ou d'un code QR.

## 3.1 Responsable du traitement

L'application est éditée par **RESTART** (« l'Éditeur », « nous »).
Contact : `contact@sharepix.app` — **TODO : remplacer par l'e-mail réel.**

## 3.2 Données que nous collectons

- **Compte invité (anonyme)** : un identifiant technique aléatoire est créé
  automatiquement à la première ouverture. Aucune inscription n'est requise.
- **Profil (optionnel)** : prénom et/ou nom que vous saisissez, utilisés pour
  vous identifier auprès des autres membres d'un album.
- **Compte permanent (optionnel)** : si vous convertissez votre compte invité,
  nous collectons votre **adresse e-mail**, ou les informations de base
  transmises par **Google** si vous choisissez la connexion Google (nom,
  e-mail, identifiant Google).
- **Contenus que vous publiez** : photos, vidéos, commentaires et « j'aime »
  ajoutés dans les albums dont vous êtes membre.
- **Jeton de notifications** : un identifiant technique (Expo Push Token /
  FCM) si vous activez les notifications, utilisé uniquement pour vous les
  envoyer.
- **Journal d'activité** : actions réalisées dans vos albums (membre rejoint,
  photo ajoutée, commentaire, like), visibles par les membres de ces albums.

## 3.3 Finalités

- Fournir le service : création et partage d'albums privés, synchronisation
  multi-appareils ;
- Restaurer vos albums sur un nouvel appareil ;
- Vous envoyer des notifications (désactivables à tout moment) ;
- Assurer la sécurité du service et prévenir les abus.

## 3.4 Qui peut voir vos contenus

Vos photos, vidéos et commentaires ne sont visibles **que par les membres des
albums auxquels vous appartenez**. Il n'existe aucun espace public dans
l'application. Les fichiers sont stockés dans un espace privé et ne sont
accessibles que via des liens temporaires signés, délivrés exclusivement aux
membres autorisés. **Nous ne vendons ni ne louons aucune donnée, et
l'application ne contient aucune publicité.**

## 3.5 Sous-traitants

- **Supabase Inc.** — hébergement de la base de données et des fichiers
  (authentification, PostgreSQL, stockage chiffré en transit) ;
- **Expo / Google Firebase Cloud Messaging** — acheminement des notifications
  push ;
- **Google Ireland / Google LLC** — uniquement si vous choisissez la connexion
  Google.

Ces prestataires traitent les données pour notre compte et dans la limite
nécessaire à la fourniture du service.

## 3.6 Sécurité

Échanges chiffrés (HTTPS/TLS), contrôle d'accès appliqué côté serveur pour
chaque requête (règles au niveau des lignes), fichiers inaccessibles sans
autorisation d'appartenance à l'album.

## 3.7 Conservation et suppression

Les données sont conservées tant que votre compte ou vos albums existent.
La suppression d'un album par son propriétaire supprime définitivement ses
photos, commentaires et journaux associés. Vous pouvez demander la suppression
intégrale de votre compte et de vos données à tout moment (voir §3.8).

## 3.8 Vos droits (RGPD)

Vous disposez d'un droit d'accès, de rectification, d'effacement, de
portabilité et d'opposition concernant vos données. Pour l'exercer :
`contact@sharepix.app`. Nous répondons sous 30 jours. Vous pouvez également
introduire une réclamation auprès de l'autorité de protection des données
compétente.

## 3.9 Enfants

Le service n'est pas destiné aux enfants de moins de 13 ans et ne collecte
pas sciemment leurs données. Si vous pensez qu'un enfant utilise le service,
contactez-nous pour suppression.

## 3.10 Modifications

Cette politique peut être mise à jour. La version en vigueur est celle publiée
à cette adresse ; toute modification substantielle vous sera signalée dans
l'application.

## 3.11 Contact

**RESTART** — `contact@sharepix.app`

---

# 4. Conditions d'utilisation

*Application **SharePix** — Dernière mise à jour : août 2026*
*(version web : `public/terms.html` / `web/terms.html`)*

> Les présentes conditions régissent l'utilisation de l'application SharePix,
> éditée par **RESTART** (« l'Éditeur »). En utilisant l'application, vous
> acceptez ces conditions. Si vous ne les acceptez pas, n'utilisez pas le
> service.

## 4.1 Description du service

SharePix permet de créer des **albums photo/vidéo privés** lors d'événements
et de les partager avec des proches au moyen d'un code d'invitation à
8 caractères ou d'un code QR. L'accès à un album est limité aux personnes
invitées.

## 4.2 Compte

Le service fonctionne avec un **compte invité anonyme** créé automatiquement.
Vous pouvez le convertir en compte permanent (e-mail ou connexion Google)
pour sécuriser l'accès et retrouver vos albums sur vos appareils. Vous êtes
responsable de la confidentialité de l'accès à votre appareil et à votre
compte.

## 4.3 Vos contenus

- **Propriété** : vous conservez tous vos droits sur les photos, vidéos et
  commentaires que vous publiez.
- **Licence limitée** : vous nous accordez uniquement le droit d'héberger,
  traiter et afficher vos contenus pour fournir le service, et de les rendre
  accessibles **aux membres des albums concernés**. Cette licence prend fin à
  la suppression du contenu.
- **Responsabilité** : vous garantissez détenir les droits nécessaires sur les
  contenus publiés (notamment le droit à l'image des personnes photographiées)
  et vous engagez à ne publier aucun contenu :
  - illégal, haineux, violent, diffamatoire ou discriminatoire ;
  - à caractère sexuel impliquant des mineurs, ou pornographique non
    consenti ;
  - portant atteinte à la vie privée ou aux droits d'autrui ;
  - contrefaisant (droits d'auteur, marques).

## 4.4 Invitations et partage

Le propriétaire d'un album est responsable des personnes qu'il invite (code
ou QR). Toute personne disposant du code peut rejoindre l'album : partagez-le
avec discernement. Le propriétaire peut retirer un membre ou supprimer
l'album à tout moment ; un membre peut quitter un album qu'il a rejoint.

## 4.5 Notifications

Si vous les activez, vous recevez des notifications relatives à l'activité de
vos albums. Vous pouvez les désactiver par catégorie dans l'application ou
dans les réglages de votre appareil.

## 4.6 Usage acceptable

Vous vous interdisez de : tenter d'accéder à des albums sans invitation,
perturber le service, contourner ses mécanismes de sécurité, collecter les
contenus d'autrui, ou utiliser le service à des fins commerciales non
autorisées.

## 4.7 Disponibilité

Le service est fourni « en l'état ». Nous nous efforçons d'en assurer la
disponibilité et la fiabilité, sans garantie d'absence d'interruption ou de
perte. Nous vous recommandons de conserver une copie de vos photos
importantes en dehors de l'application.

## 4.8 Limitation de responsabilité

Dans la limite permise par la loi, l'Éditeur ne saurait être tenu responsable
des contenus publiés par les utilisateurs ni des dommages indirects résultant
de l'utilisation du service (perte de données, perte d'exploitation).

## 4.9 Résiliation

Vous pouvez cesser d'utiliser le service et demander la suppression de votre
compte à tout moment. Nous pouvons suspendre un accès en cas de violation de
ces conditions.

## 4.10 Droit applicable

Les présentes conditions sont soumises au droit en vigueur au lieu
d'établissement de l'Éditeur, sauf dispositions impératives contraires
applicables dans votre pays de résidence.
**TODO : préciser la juridiction exacte (ex. droit burundais / français).**

## 4.11 Contact

**RESTART** — `contact@sharepix.app`

---

# Annexe — TODO avant publication

1. **E-mail réel de contact** : remplacer `contact@sharepix.app` partout
   (`public/privacy.html`, `public/terms.html`, `web/`, landing, Play Console).
2. **Juridiction** : préciser le droit applicable dans `terms.html` §10.
3. **URL publique de la privacy policy** : déployer et renseigner dans Play
   Console.
4. **DOWNLOAD_URL** de la landing : pointer vers l'APK hébergé
   (GitHub Releases ou EAS).
