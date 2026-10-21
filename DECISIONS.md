# Décisions

Registre des choix produit et techniques, avec leur raison d'être. Une
décision qui n'est pas écrite est une décision qu'on reprendra trois fois.

---

## D-05 — Ordre de livraison : images → production → vidéo → premium

**Décision (2026-10-22).** On stabilise et on met en production ce qui
existe (les photos), *ensuite* on ajoute la vidéo, *ensuite* le premium.

**Pourquoi.** L'état réel mesuré en base donne raison à cette prudence :

| Constat | Valeur |
|---|---|
| Photos en base | 21 |
| Comptes | 84 (dont **81 anonymes**) |
| Albums | 11, dont **1 seul** appartient à un compte identifié |
| Comptes identifiés | 3 |

Autrement dit : le produit n'est pas encore validé sur son cœur (photo)
qu'on parlerait d'ajouter un format 50 fois plus lourd et une
monétisation. Une vidéo de 30 s en 1080p pèse 50 à 100 Mo, soit **3 fois le
plafond actuel du bucket** (25 Mo) ; l'import actuel charge tout le fichier
en base64 en mémoire, ce qui ferait tomber l'application bien avant cette
taille.

**Ce que ça coûte de reporter.** Rien : le schéma est sans `media_type`, donc
ajouter la vidéo ne cassera aucune donnée existante. À l'inverse, bâtir le
premium maintenant obligerait à le refaire quand les vraies offres seront
connues.

**Conséquence.** L'écran « Album Premium » reste une vitrine (il est déjà
annoncé comme tel dans le code : *« vitrine — pas de paiement branché »*).
Aucun bouton d'achat ne doit y être ajouté avant D-06.

---

## D-06 — Quand le premium arrivera, il sera un attribut du compte, pas de l'album

**Décision anticipée**, à appliquer le jour où le premium est développé.
Non implémenté aujourd'hui.

- Le statut vit sur `profiles.premium_until timestamptz` (et non un booléen :
  une date d'expiration évite d'avoir à faire tourner une tâche de
  désactivation).
- **Le client ne doit jamais pouvoir s'attribuer le premium lui-même.** Un
  `update profiles set premium_until = ...` envoyé par l'application doit
  être refusé par la RLS ou par un trigger. Sans cette garde, il suffit
  d'ouvrir les outils de développement pour obtenir le premium à vie.
- Un champ sur `albums` serait plus généreux (les invités en profiteraient)
  mais rend la facturation et la révocation beaucoup plus ambiguës.

---

## D-07 — Aucune donnée personnelle dans les journaux

**Décision (2026-10-22).** Les journaux de diagnostic ne contiennent ni
adresse e-mail, ni URL d'authentification, ni URL de retour profond.

Les lignes concernées ont été corrigées : `user.email` (3 endroits) et
`data.url` d'OAuth (4 endroits) disparaissent des logs, et les journaux
restants sont conditionnés à `__DEV__`.

**Pourquoi.** Une URL de retour `sharepix://auth/callback?code=…` est un
justificatif d'authentification à usage unique. Les journaux Android sont
lisibles par tout outil de collecte, et les journaux d'un build de
production n'ont aucune raison de contenir des adresses e-mail.

---

## D-01 — Un projet Supabase de test dédié, plutôt qu'un script de test « propre »

Le test RLS crée des comptes et des fichiers. Rendu auto-nettoyant, il
laisserait quand même des traces dès que le nettoyage échoue. Un projet
`sharepix-staging` séparé garantit qu'aucune exécution de CI ne touche la
production.

## D-02 — Typage incrémental plutôt que `checkJs` global

Activer `checkJs` sur tout le projet produisait 92 erreurs, dominées par des
artefacts d'inférence sur des composants non typés. Le projet est en JS :
`checkJs` reste désactivé, et les fichiers de logique portent `// @ts-check`.
Résultat : 0 erreur, sur les fichiers qui portent des règles métier.

## D-03 — Le redimensionnement sert d'abord les photos, pas la vidéo

`resizeForUpload` réduit à 2048 px et recompresse en JPEG 0.82 avant la
lecture base64. C'est ce qui protège la mémoire et le quota de 1 Go sur le
format qui est réellement utilisé.

## D-04 — La CI ne vise jamais la production

`rls-check.cjs` écrit. Il reçoit son URL et sa clé par variables
d'environnement, et s'arrête avec un avertissement visible si elles sont
absentes — plutôt que de retomber silencieusement sur la production.

---

# Ce qui bloque la mise en production

État vérifié le 2026-10-22, en base et dans les workflows.

| # | Point | Statut | Impact |
|---|-------|--------|--------|
| 1 | **Aucun SMTP configuré** (`smtp_host` = `null`, `rate_limit_email_sent` = 2/h) | ❌ | Le mot de passe oublié et les confirmations d'adresse ne partent pas de façon fiable. Un utilisateur qui perd son mot de passe perd son compte. |
| 2 | **Sentry annoncé dans la politique de confidentialité, absent du code** | ❌ | Écart entre un document public et la réalité. Soit on l'installe, soit on corrige le document. |
| 3 | `password_min_length` = 6, protection HIBP désactivée | ⚠️ | Mots de passe faibles acceptés (`123456` passe). |
| 4 | 81 comptes anonymes sur 84, 11 albums | ⚠️ | Le correctif P1-08 devrait tarir la source ; à remesurer après déploiement. |
| 5 | Secrets `STAGING_*` absents | ⚠️ | Le job RLS est vert mais ne teste rien. |
| 6 | `version` d'`app.json` = 1.0.0, dernière release = v1.0.4 | ⚠️ | EAS gère les numéros de build à distance (`appVersionSource: remote`), donc ce n'est pas bloquant, mais la version affichée n'est pas la version réelle. |
| 7 | `REDIRECT_URI_WEB` en dur sur `http://localhost:8081` | ℹ️ | OAuth impossible sur le web en production. Le mobile n'est pas concerné. |

**Chemin le plus court vers la production :** 1 et 2 sont les seuls vrais
bloquants. 3 et 5 se règlent en quelques minutes de console.
