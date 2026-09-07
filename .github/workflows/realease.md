# ── SharePix · Publication APK & Release GitHub ─────────────────────────
# À chaque push sur `main` :
# 1. Génère un APK Android via EAS Build
# 2. Télécharge le fichier .apk généré
# 3. Crée une Release GitHub officielle avec l'APK attaché
# ─────────────────────────────────────────────────────────────────────────
name: Release APK (GitHub Release)

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: release-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-release:
    name: Build APK & Create GitHub Release
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Setup EAS CLI
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build APK with EAS
        run: eas build --platform android --profile preview --non-interactive

      - name: Download APK artifact
        run: eas build:download --platform android --profile preview --latest --output sharepix-latest.apk

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v1.0.${{ github.run_number }}
          name: SharePix v1.0.${{ github.run_number }}
          body: |
             **Nouvelle mise à jour disponible !**

            Téléchargez le fichier `sharepix-latest.apk` ci-dessous pour installer la dernière version sur votre appareil Android.
          draft: false
          prerelease: false
          files: sharepix-latest.apk
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
