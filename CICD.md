# SharePix · CI/CD

Pipeline d'intégration et de livraison continues basé sur **GitHub Actions**
(CI) et **EAS Build / Update** (CD), conformément à la méthode recommandée
par Expo.

## Vue d'ensemble

```
PR / push (toute branche) ──▶ CI (typecheck, expo-doctor, Deno, RLS)
push main ──────────────────▶ Preview : EAS Update (OTA, branche "preview")
tag v* / manuel ────────────▶ Production : EAS Build (+ auto-submit)
supabase/functions/** ──────▶ Déploiement Edge Function Supabase
```

| Workflow | Fichier | Déclencheur | Rôle |
| --- | --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | `pull_request`, `push main`, manuel | Vérifie le code (types, Expo, Deno, RLS) |
| **Preview** | `.github/workflows/preview.yml` | `push main` (+ manuel) | Publication OTA `eas update` + APK de test |
| **Production** | `.github/workflows/production.yml` | tag `v*` (+ manuel) | Build EAS `production` (+ soumission stores) |
| **Edge Functions** | `.github/workflows/supabase-deploy.yml` | `push main` sur `supabase/functions/**` | Déploie `activity-push` |

## Étapes de la CI

1. **TypeScript + Expo Doctor** — `npm ci` puis `npm run typecheck`
   (`tsc --noEmit`, sur le tsconfig Expo) et `npx expo-doctor`.
2. **Edge Function (Deno)** — `deno check` + `deno lint` sur
   `supabase/functions/activity-push/index.ts`.
3. **Sécurité RLS / Storage** — exécute `node supabase/rls-check.cjs`
   contre le projet Supabase réel : vérifie qu'aucune donnée ne fuit sans
   session, que les comptes invités frais ne voient rien, et que le bucket
   `album-photos` reste privé (URLs signées uniquement).

## Prérequis : secrets GitHub

À configurer dans **GitHub → repo → Settings → Secrets and variables →
Actions**. Les workflows s'arrêtent proprement si un secret manque
(le job échoue, rien n'est publié).

| Secret | Requis pour | Où le trouver |
| --- | --- | --- |
| `EXPO_TOKEN` | Preview + Production (EAS) | `npx eas-cli whoami` / expo.dev → Settings → Access Tokens |
| `SUPABASE_ACCESS_TOKEN` | Déploiement Edge Functions | dashboard Supabase → Account → Access Tokens |

> ℹ️ Les clés **anon** (`src/config.js`, `supabase/rls-check.cjs`) sont déjà
> dans le dépôt : elles sont publiques par nature (la sécurité repose sur la
> RLS, pas sur la clé). **Ne jamais committer** de clé `service_role` ni le
> `WEBHOOK_SECRET` de la fonction — ce dernier se pose avec
> `supabase secrets set WEBHOOK_SECRET …`.

## Livraison continue

### Preview (OTA)

Chaque push sur `main` publie une mise à jour EAS Update sur la branche
`preview`. Les appareils équipés d'un build installé (dev client ou APK
`preview`) la reçoivent automatiquement, sans repasser par le store.

Manuellement, cocher *« Builder aussi un APK de preview »* sur le
workflow_dispatch génère en plus un APK installable
(`eas build --profile preview`).

### Production

Pousser un tag versionné pour lancer un build de production :

```bash
git tag v1.0.1
git push origin v1.0.1
```

- **Android** : AAB (upload Google Play).
- **iOS** : nécessite les credentials Apple configurés (`eas credentials`).

La soumission automatique aux stores s'active via l'input `submit` en
mode manuel, ou en ajoutant `--auto-submit` dans le workflow. Le profil
`production` (voir `eas.json`) gère l'incrément automatique du numéro de
build (`autoIncrement`, source distante `appVersionSource: "remote"`).

## Déploiement Supabase (Edge Functions)

Dès qu'un fichier de `supabase/functions/**` change sur `main`, la fonction
`activity-push` est redéployée sur le projet `bpillwvvxqiduxtkftuh`
(surchargable via la variable de dépôt `SUPABASE_PROJECT_ID`).

> Le **schéma SQL** (`supabase/schema.sql`) n'est **pas** appliqué
> automatiquement : il est ré-exécutable/idempotent mais modifie la
> production. On l'applique volontairement après revue, puis on relance
> la CI (le job *RLS & Storage* sert de filet de sécurité).

## Lancer les vérifications en local

```bash
npm ci
npm run typecheck          # tsc --noEmit
npx expo-doctor            # santé du projet Expo
deno check supabase/functions/activity-push/index.ts   # si Deno installé
node supabase/rls-check.cjs                            # réseau requis
```

## Actions tierces utilisées

| Action | Version épinglée | Usage |
| --- | --- | --- |
| `actions/checkout` | `v4` | Récupérer le code |
| `actions/setup-node` | `v4` | Node 22 + cache npm |
| `denoland/setup-deno` | `v2` | Deno pour les Edge Functions |
| `expo/expo-github-action` | `v8` | EAS CLI + token Expo |
| `supabase/setup-cli` | `v1` | CLI Supabase |
