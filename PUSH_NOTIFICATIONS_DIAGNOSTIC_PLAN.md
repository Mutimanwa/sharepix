# Diagnostic et remise en service des notifications push

## Objectif
Établir la panne réelle sur la production SharePix avant correction, puis réparer la fonction serveur, la redéployer en production et vérifier la chaîne sans envoyer de notification à un utilisateur réel.

## Constat vérifié en production (2026-10-24)
- Projet `sharepix` actif et sain côté base, REST et Auth.
- Migration `20261023122932_notification_preferences` présente.
- Trigger `activity-push` présent sur `public.activity_log`; les triggers amont de membres, photos, commentaires et réactions écrivent dans `activity_log`.
- Les deux noms de secrets attendus par le trigger existent dans Vault; `WEBHOOK_SECRET` existe aussi dans les secrets de la fonction. Aucune valeur secrète n'est enregistrée dans ce document.
- La fonction `activity-push` est déclarée active (version 4), mais les 17 dernières réponses conservées par `pg_net` sont des HTTP 503 `BOOT_ERROR` / `Function failed to start`. Elles couvrent les quatre catégories d'activité. Le trigger atteint donc bien l'endpoint; le code de la fonction ne démarre pas.
- La production contient un jeton Android enregistré (un utilisateur), et un profil a `push_enabled=true`; les données sont donc suffisantes pour atteindre normalement l'envoi pour certains événements, sous réserve que l'utilisateur soit membre destinataire.
- Conséquence : le fournisseur Expo/FCM n'est pas encore en cause démontrée; la fonction s'arrête avant tout traitement ou envoi. Les preuves actuellement accessibles ne donnent pas la trace interne qui explique le `BOOT_ERROR`.

## Travail prévu et état
1. **Terminé :** les modifications locales précédentes ont été comparées par hash au head distant de la PR #36 (`75a47652`) puis la branche de travail a été réalignée sans écraser de fichiers.
2. **Terminé :** l'historique de déploiement a été vérifié. Le workflow de déploiement GitHub le plus récent disponible est en échec; l'accès à son journal détaillé a échoué côté GitHub. La trace interne du BOOT_ERROR n'est donc pas disponible par les outils connectés actuels.
3. **Terminé :** la fonction résout maintenant `@supabase/supabase-js` via le résolveur npm natif de Deno, sur la version `2.115.0` déjà verrouillée par l'application; le mapping Deno est épinglé sur la même version. C'est le correctif ciblé le plus probable pour le démarrage, mais la cause interne précise reste à confirmer par un démarrage sain.
4. **Terminé :** `npm run verify` passe (typecheck, lint, 7 suites / 42 tests); le TypeScript de l'Edge Function se transpile sans erreur; la config Deno est du JSON valide; `git diff --check` est propre.
5. **Terminé :** la fonction a été redéployée en production avec Supabase; elle est active en version 5. La migration des préférences était déjà appliquée, aucune migration supplémentaire n'a été nécessaire.
6. **Terminé :** l'URL Vault vise bien le projet production. L'invocation de contrôle avec un album inexistant a répondu HTTP 200 `sent:0, reason:no recipients`; aucun push réel n'a été envoyé. Le même canal `pg_net` qui enregistrait auparavant des `BOOT_ERROR` confirme que le handler démarre maintenant.
7. **Nouvelle preuve (2026-10-24) :** deux activités réelles après le déploiement (photo ajoutée, puis membre rejoint) ont traversé la fonction. Le webhook a répondu HTTP 200, mais avec `sent:0, failed:1, expired:0` dans les deux cas. Le jeton correspondant existe, a le format Expo attendu, et toutes ses préférences sont activées. Puisque l'Edge Function ne renvoie 502 que si l'appel Expo échoue au niveau HTTP/JSON, ces réponses indiquent que l'API Expo a rendu un ticket d'échec; Expo n'a donc pas accepté les notifications. Le tableau de bord EAS vide est cohérent avec ce résultat.
8. **Terminé :** l'Edge Function en version 6 journalise et renvoie maintenant uniquement les codes d'erreur Expo agrégés (par exemple `InvalidCredentials`), sans jetons ni contenu. Le déploiement est actif. Les contrôles locaux repassent (7 suites / 42 tests, syntaxe TS, JSON Deno, diff propre).
9. **À valider au prochain événement réel :** relire `providerErrors` dans la réponse du webhook ou les logs `activity-push` pour identifier l'erreur Expo exacte. Aucun nouvel envoi à un vrai appareil n'a été déclenché artificiellement; les erreurs précédentes ne conservent pas leur code détaillé car l'ancienne version ne le journalisait pas.

## Critères de fin
- Une invocation de fonction ne produit plus `BOOT_ERROR`.
- Les activités SQL peuvent atteindre le handler; aucun push réel n'est envoyé pendant les essais.
- La cause observée, la correction, le résultat du déploiement et ce qui reste à valider sur un appareil sont rapportés séparément.
