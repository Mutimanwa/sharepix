# Refonte des Activités et système de notifications SharePix

## Demande
- Aligner la disposition des actions de sélection multiple d'Activités sur celle d'un Album.
- Créer des notifications de collaboration, d'invitation, de souvenirs et de compte, avec groupement, préférences et horaires silencieux.

## Vérification du code et de Supabase production
- La migration `notification_preferences` est présente.
- Les préférences actuelles couvrent le master, photos, membres, commentaires et réactions; il n'existe pas encore de préférence Souvenirs/Rappels ni de fuseau horaire par profil.
- `log_activity()` écrit un événement par ligne photo/commentaire/réaction/membre. `activity-push` traite actuellement chaque ligne seule : dix INSERT de photos peuvent donc produire dix tickets.
- `pg_cron` n'est pas installé en production (alors que `pg_net` l'est). Des notifications différées/anniversaires nécessitent un ordonnanceur et une nouvelle migration.
- Le schéma n'enregistre pas les partages de code d'invitation; un rappel devra donc s'appuyer sur un critère non ambigu comme album sans photo, et être plafonné pour éviter le spam.
- L'app sait déjà distinguer les comptes anonymes (`isAnonymous`). L'offre premium/limite de stockage n'est pas encore configurée.

## Base proposée
- Disposition Activités : même barre de sélection que l'Album (retour à gauche, compteur, sélectionner/désélectionner tout, action groupée), sans transformer le fil chronologique en grille de photos.
- Collaboration : regrouper les nouvelles photos d'un même membre et album sur 60 secondes en un push avec le nombre total; conserver les préférences existantes et le flux Activités. L'arrivée d'un membre couvre aussi l'acceptation d'une invitation. Les commentaires/réactions gardent leur catégorie dédiée.
- Préférences : ajouter des interrupteurs Souvenirs et Rappels; conserver le master et les catégories photos/membres/commentaires/réactions.
- Souvenirs : notifications d'anniversaire d'album et de photos, une fois par date anniversaire, groupées par album et destinataire.
- Invitations : rappel au propriétaire seulement si l'album est resté sans photo; fréquence plafonnée à un rappel par album tant qu'il reste vide.
- Compte : Bienvenue et mode anonyme sous forme de messages in-app (pas de push auto adressé à soi-même). Le lien Gmail restera une action explicite de l'utilisateur.
- Heures calmes : heure locale du profil; notifications programmées retardées entre 22 h et 8 h. Les actions collaboratives en direct restent rapides, conformément à l'exception formulée.
- Stockage/premium : reporté jusqu'à la définition du quota gratuit et de l'offre, conformément à la priorité déjà fixée pour premium.

## Décisions confirmées
- Rappel d'invitation : après 24 h si l'album est encore vide, une seule fois par album.
- Heure silencieuse : les événements collaboratifs directs restent rapides; souvenirs et rappels planifiés sont retenus jusqu'à 8 h locale.
- Bienvenue et mode anonyme : message in-app uniquement, sans push à soi-même.

## Mise en œuvre et vérification
- La barre Activités reprend maintenant la disposition de la barre Album; le fil reste chronologique. Un nouveau compte voit un message de bienvenue in-app (une fois), et le compte anonyme voit une invite in-app pour lier Google/Gmail. Aucun de ces messages n'est poussé vers son propre appareil.
- Les préférences Profil incluent Souvenirs et Rappels. Le fuseau IANA est synchronisé par l'application au démarrage; un fuseau inconnu est laissé nul pour empêcher tout push programmé hors plage locale.
- `push_notification_queue` remplace l'appel Edge par ligne. Le worker regroupe les événements d'un membre, album et type dans une fenêtre de 60 secondes; les photos utilisent un délai anti-rafale renouvelé à chaque ajout. Les appels directs de collaboration sont traités chaque minute; le worker des souvenirs/rappels tourne toutes les 15 minutes.
- Les souvenirs portent sur le premier anniversaire (album ou photos, groupés par album et destinataire). Le rappel s'adresse au propriétaire une fois, après 24 h, seulement si l'album est encore vide. Les deux catégories respectent 8 h–22 h locales. Le quota stockage/premium reste hors périmètre.
- Migration appliquée avec succès sur le projet de test `sharepix-staging`, puis sur la production `sharepix` (`notification_center_batching`, version DB `20261024064336`). Le projet de test a aussi validé le trigger : trois photos de test ont créé trois éléments en file avec leur délai repoussé; les lignes et l’album temporaires ont été supprimés dans la même transaction. `pg_cron` 1.6.4 et ses deux tâches sont actifs; `pg_net` retourne les requêtes du worker en HTTP 200.
- Edge Function `activity-push` déployée en version 8. Un premier essai version 7 a renvoyé `BOOT_ERROR`; la source a été rebundlée en module autonome avec import NPM explicite, puis vérifiée par le dispatch cron (HTTP 200, file vide) et un appel manuel programmé (HTTP 200, zéro candidat, aucun push envoyé).
- Vérifications locales : `npm run verify` passe (7 suites, 42 tests); `deno test` passe (5 tests de groupement/fuseaux/anniversaire); `deno check`, `deno lint` et `git diff --check` passent.

## À vérifier sur l'application installée
- Les notifications collaboratives sont actives côté production dès les prochains événements.
- Les notifications programmées restent volontairement suspendues pour chaque profil dont le fuseau est encore inconnu. Chaque utilisateur devra ouvrir une build contenant la synchronisation de fuseau avant de recevoir ses souvenirs/rappels. Le comportement visuel final et le lien Google devront être vérifiés sur l'appareil après le prochain build Preview.
