# Diagnostic des boutons de l’onboarding

## Symptôme
L’utilisateur indique que les deux boutons principaux de l’écran d’onboarding ne réagissent pas, malgré les corrections antérieures. Le périmètre supposé est « Créez un nouvel album » et « Utilisez le code d’accès »; confirmer visuellement sur l’appareil après le correctif.

## Constat statique avant modification
- Les deux actions appellent `setCreate(true)` ou `setJoin(true)` via le composant partagé `CoralButton`.
- `CoralButton` utilise `TouchableOpacity`; il n’est pas désactivé par défaut.
- Avant ce correctif, les deux feuilles de saisie étaient rendues inline au niveau de l’écran, bien qu’elles soient conditionnées par les états `create` et `join`.
- Le carrousel horizontal et le pied de page des boutons sont des frères dans une vue en flex. Le code seul ne permet pas d’établir si le hit-testing Android ou la zone système recouvre les contrôles sur le téléphone signalé.

## Travail prévu
1. Rendre la zone d’actions explicitement au-dessus du carrousel dans l’ordre de dessin Android, sans enlever le balayage des pages.
2. Donner aux actions des callbacks nommés, un état mutuellement exclusif pour les feuilles, et des rôles/accessibility labels qui facilitent le test et l’usage.
3. À la clarification de l’utilisateur, ouvrir pour chacune des deux actions sa feuille dédiée avec le système popup/modal standard existant (`Sheet` natif), plutôt que le rendu inline.
4. Conserver la création, la jointure par code, le contenu des formulaires et les autres parcours inchangés.
5. Exécuter typecheck, lint, tests et export Metro Android; vérifier le diff.
6. Ne pas déclarer le problème résolu sur appareil avant que l’utilisateur ait pu retester les deux actions sur son téléphone, en particulier Android 7.

## Modifications apportées
- La zone d’actions conserve désormais une vue native et est explicitement placée au-dessus du carrousel (`zIndex`/`elevation`), afin d’éviter qu’une liste horizontale recouvre ses touch targets sur Android.
- Les deux boutons ont des callbacks nommés, des touch targets de 50 px, des identifiants de test et des libellés accessibles; chaque action ferme l’autre popup avant ouverture.
- Chaque action ouvre maintenant son popup dédié avec le `Sheet` standard et son `Modal` natif; la touche Retour Android ferme aussi la popup.
- `CoralButton` transmet désormais ses propriétés d’accessibilité et `testID` au `TouchableOpacity` natif.

## Vérifications et limite
- `npm run verify` réussi : typecheck, lint, 6 suites / 37 tests; `git diff --check` propre.
- Les boutons restent à retester sur le téléphone concerné, notamment sous Android 7 : aucun appareil Android/ADB n’est accessible dans cet environnement, donc le hit-testing natif ne peut pas être déclaré validé ici.

## Critères d’acceptation
- Le premier bouton ouvre la feuille « Personnalisez votre album ».
- Le second ouvre la feuille « Rejoindre un album ».
- Les boutons restent touchables après balayage du carrousel et sur écran Android compact; les feuilles peuvent être fermées puis rouvertes.
- Aucune régression du contenu ni de la navigation d’onboarding.
