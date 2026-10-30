# Plan — Fiabiliser le téléchargement de l’APK dans la release

## Constat
Le workflow `.github/workflows/realease.yml` termine le build EAS, puis télécharge le fichier d’environ 127 Mio en un seul `curl -L`. Le journal fourni montre une réinitialisation de connexion à environ 6 % (`curl: (56)`), ce qui fait échouer le job et empêche la création de la release GitHub.

## Diagnostic
- Le build EAS a réussi; l’échec survient pendant le transfert de l’artefact vers le runner GitHub.
- L’avertissement `expo-updates`/channel du profil `preview` n’est pas l’erreur fatale montrée ici et ne sera pas modifié sans besoin fonctionnel.

## Correctif prévu
- Faire échouer clairement le workflow si l’URL d’artefact EAS est absente.
- Ajouter tentatives avec reprise du téléchargement interrompu, délais et limites réseau.
- Vérifier que l’APK est un ZIP valide avant de le publier, pour éviter d’attacher un fichier partiel.

## Réalisé et vérifié
- URL de build validée pour les deux formes de JSON EAS (tableau ou objet); le workflow échoue avec un message clair si elle manque.
- Huit tentatives de téléchargement, chacune avec `curl --continue-at -`, délai de connexion/transfert borné et attente croissante entre les reprises.
- Après transfert, contrôle non-vide puis validation ZIP complète et présence de `AndroidManifest.xml` avant publication.
- YAML parsé et étape entière exécutée contre un serveur local qui coupe volontairement la première connexion : la seconde requête a repris à `bytes=250000-`, le contenu téléchargé était identique et la validation APK a réussi.
- `git diff --check` propre.

## Limites
La confirmation de bout en bout contre EAS et la publication d’une nouvelle release nécessitent une exécution du workflow GitHub Actions après intégration. L’avertissement `expo-updates` du profil Preview reste un avertissement distinct et non bloquant.
