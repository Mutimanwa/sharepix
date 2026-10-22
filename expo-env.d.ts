/// <reference types="expo/types" />

// ── P1-17 : le typecheck vérifie enfin le code applicatif ──────────────
// `expo/tsconfig.base` active `allowJs` mais PAS `checkJs` : `tsc --noEmit`
// ne lisait donc aucun des 29 fichiers .js de l'application et ne pouvait
// rien trouver. Le script « typecheck » de la CI ne vérifiait rien.
//
// Les déclarations ci-dessous couvrent ce que Metro sait résoudre mais que
// TypeScript ne connaît pas (images importées, polices, vidéos).

declare module '*.png' {
  const value: number;
  export default value;
}
declare module '*.jpg' {
  const value: number;
  export default value;
}
declare module '*.jpeg' {
  const value: number;
  export default value;
}
declare module '*.gif' {
  const value: number;
  export default value;
}
declare module '*.svg' {
  const value: number;
  export default value;
}
declare module '*.mp4' {
  const value: number;
  export default value;
}
declare module '*.ttf' {
  const value: number;
  export default value;
}
