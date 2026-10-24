# Plan — doublons photo et découverte des nouveautés

## Demande
- Détecter dans un album une photo déjà présente, notamment lorsqu'elle a le même nom et les mêmes métadonnées.
- Proposer d'ignorer uniquement cette photo ou de la garder comme copie renommée, sans interrompre l'envoi des autres photos sélectionnées.
- Permettre de voir les photos récemment ajoutées depuis l'accueil, sans ouvrir chaque album pour découvrir qu'il a changé.
- Évaluer une offre cloud adaptée au stockage des médias SharePix.

## Audit du code sur `origin/main` (c5889ee)
- `photos` ne conserve pas le nom d'origine, la taille, les dimensions, le MIME ni la date de prise de vue; `storage_path` est construit avec un timestamp.
- `AlbumScreen.pick()` traite la sélection séquentiellement avec progression, et `Store.addPhoto()` intercepte les erreurs par photo : le lot peut continuer, mais aucune détection de doublon n'existe.
- L'accueil affiche une couverture et un compteur par album. Le Realtime rafraîchit ces résumés, pas un fil des dernières images.
- Le bucket actuel est le bucket privé Supabase `album-photos`; les photos sont signées et les RLS limitent l'accès aux membres.

## Proposition
1. Ajouter aux lignes `photos` les métadonnées utiles : nom d'origine, taille, dimensions, type MIME et date de capture, sans exposer de chemin ou URL publique.
2. Avant chaque upload cloud, comparer ces champs avec les photos du même album. Une correspondance est une alerte de doublon possible, pas une suppression automatique : montrer les deux aperçus et le nom/les métadonnées.
3. Proposer deux choix pour la seule image en cours : « Ignorer cette photo » ou « Garder comme copie renommée ». Le lot continue ensuite avec les photos suivantes et la progression reste visible. Une erreur de pré-vérification réseau ne bloque pas le lot.
4. Ajouter à l'accueil une bande « Photos récentes » tirée des albums accessibles par RLS, avec aperçu, auteur/date et accès rapide à l'album; rafraîchir au retour sur l'accueil et via Realtime.
5. Conserver le stockage privé et les migrations RLS actuelles. Comparer les offres cloud actuelles séparément avant de recommander un changement de fournisseur.

## Vérification cloud et conseil tarifaire (24 octobre 2026)
- Projet de production `sharepix` (`bpillwvvxqiduxtkftuh`) consulté via Supabase; services DB/Auth/Storage sains. Le seul bucket est `album-photos`, avec 63 objets totalisant 12 630 105 octets (12,05 MiB). La table `photos` comporte 16 lignes et les 16 ont un objet Storage lié (2 536 749 octets); 47 objets Storage ne sont pas référencés par `photos`. Ce constat est documenté, sans suppression automatique : il faut une vérification de sécurité séparée avant nettoyage.
- Les lignes historiques ne contiennent ni le nom d'origine ni les dimensions/date EXIF; les chemins de fichiers ne donnent qu'un timestamp. La migration récupère seulement taille et MIME depuis `storage.objects`. Le nom historique est irrécupérable par cette base; le contrôle ancien fonctionne donc comme suggestion limitée, avec comparaison visuelle.
- Supabase Pro : 25 USD/mois, 100 GB de stockage fichiers inclus, puis 0,0213 USD/GB-mois; egress inclus séparément à hauteur de 250 GB mis en cache et 250 GB non mis en cache, puis 0,03 / 0,09 USD/GB. Source officielle : https://supabase.com/pricing et https://supabase.com/docs/guides/storage/pricing.
- Cloudflare R2 Standard : 10 GB-mois inclus, puis 0,015 USD/GB-mois; egress Internet gratuit; quotas mensuels inclus de 1 M opérations A et 10 M opérations B, au-delà 4,50 / 0,36 USD par million. Source officielle : https://developers.cloudflare.com/r2/pricing/.
- Backblaze B2 : premiers 10 GB gratuits, puis 6,95 USD/TB-mois; egress gratuit jusqu'à 3× le stockage moyen, puis 0,01 USD/GB; pas de durée minimale publiée. Source officielle : https://www.backblaze.com/cloud-storage/pricing.
- Recommandation : ne pas migrer ni acheter un stockage média distinct pour 12 MiB. L'intégration Supabase actuelle inclut Auth, RLS, URL signées et Storage; changer de fournisseur demande un adaptateur sécurisé et un déplacement sans casser les liens ni la confidentialité. Garder Supabase et surveiller stockage/bande passante; si l'application a besoin d'un plan de production payant, Supabase Pro à 25 USD/mois inclut 100 GB de fichiers et 250 GB de chaque catégorie d'egress. R2 Standard (10 GB gratuits puis 0,015 USD/GB-mois, sortie sans frais) est l'alternative à réévaluer si les coûts d'egress deviennent importants, avec proxy/Worker privé; B2 peut coûter moins cher pour l'archivage et les lectures modérées.
- Migration additive testée sur le projet staging `slxljxllyjitnjnqaapk` (version `20261024071637`) puis appliquée au projet de production (version `20261024071955`). Vérification production : 16/16 lignes photo ont maintenant `file_size` et `mime_type`; aucun nom d'origine historique n'a été inventé ou rempli.

## Avancement réalisé
- `AlbumScreen` compare côte à côte la photo sélectionnée et le candidat; l'utilisateur ignore l'image ou saisit un autre nom pour la conserver. La sélection continue photo par photo et une panne de pré-vérification ne bloque pas l'upload.
- Le store enregistre les métadonnées de nouvelles photos; `PhotoScreen` affiche le nom conservé. `HomeScreen` montre jusqu'à 12 photos récentes de tous les albums accessibles, avec auteur, heure et accès rapide à l'album; actualisation au focus et via Realtime.
- Migration additive appliquée en staging puis en production; aucune suppression de photo/objet et aucun nom historique inventé.
- `npm run verify` : TypeScript, ESLint sans avertissements et 8 suites / 45 tests réussis; export web Expo réussi. Reste à valider sur appareil Android via le workflow Preview et à tester la sélection/renommage de doublon avec des images réelles.

## Critères de vérification
- Doublon possible dans le même album : les aperçus sont comparables; ignorer l'image ne supprime ni ne bloque les autres éléments du lot; garder crée une seconde ligne clairement nommée.
- Une image avec nom identique mais métadonnées différentes ne doit jamais être supprimée automatiquement.
- Les photos récentes de tous les albums membres apparaissent sur l'accueil; un autre membre qui ajoute une photo provoque leur actualisation.
- `npm run verify`, vérification Deno/SQL et contrôle d'accès privé; vérifier l'interface sur build installée après le workflow Preview.
