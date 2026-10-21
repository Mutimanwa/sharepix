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
   `supabase/functions/activity-push/index.ts`, avec l'import map explicite
   `--config supabase/functions/deno.json` (le job Deno n'installe pas les
   dépendances npm : la résolution passe par l'import map seule).
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

> La dépendance `@supabase/supabase-js` de la fonction est déclarée dans
> l'import map `supabase/functions/deno.json` (specifier nu, donc conforme
> au lint Deno `no-import-prefix`).

> Le **schéma** vit dans `supabase/migrations/` et n'est **pas** appliqué
> automatiquement sur la production : toute évolution passe par une
> migration horodatée, revue puis appliquée volontairement.
> `20261021000000_initial_schema.sql` reconstruit l'état complet et sert à
> provisionner un projet de test.
>
> Le job *RLS & Storage* **écrit** (comptes anonymes, album, fichier) : il
> vise donc un projet de test via `STAGING_SUPABASE_URL` /
> `STAGING_SUPABASE_ANON_KEY`. Sans ces secrets, il est **ignoré** avec un
> avertissement visible dans l'onglet Actions — il ne retombe jamais sur la
> production.
>
> Projet de test provisionné le 21/10/2026 : `sharepix-staging`
> (`slxljxllyjitnjnqaapk`, eu-west-1). Son schéma est identique à la
> production (9 tables, 9 RLS, 21 policies `public` + 3 `storage`,
> 10 fonctions, 6 triggers, bucket privé 25 Mo). Il ne contient **aucun**
> secret Vault : la fonction webhook y est donc inerte et ne peut pas
> notifier la production.
>
> Reste à faire : renseigner les deux secrets dans
> *Settings → Secrets and variables → Actions*.

## Lancer les vérifications en local

```bash
npm ci
npm run typecheck          # tsc --noEmit
npx expo-doctor            # santé du projet Expo
deno check --config supabase/functions/deno.json supabase/functions/activity-push/index.ts
deno lint  --config supabase/functions/deno.json supabase/functions/activity-push/index.ts
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
