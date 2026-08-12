# Celebrate / SharePix (React Native)

Application mobile de partage de souvenirs d’événements, inspirée des maquettes Celebrate et du cahier des charges SharePix.

## Stack

- React Native + Expo
- React Navigation (stack + tabs)
- AsyncStorage (persistance locale MVP)
- expo-image-picker

## Lancer

```bash
cd celebrate_app
npm install
npx expo start
```

- Android : `a`
- iOS : `i`
- Web (aperçu) : `w`

## Parcours

1. Splash corail
2. Onboarding (créer / rejoindre un album)
3. Accueil + suggestions
4. Album (Tous / Vidéos / Favoris)
5. Ajout de photos, commentaires, likes, favoris
6. Invitation (code 8 caractères + QR)
7. Profil + notifications
8. Premium / Téléchargement PC

Les données restent sur l’appareil (MVP). Le schéma PostgreSQL / Supabase est décrit dans la documentation du projet pour la phase Cloud.
