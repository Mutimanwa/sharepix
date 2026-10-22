#!/usr/bin/env node
// ── SharePix · Purge des fichiers fantômes du bucket ────────────────────
//
// Problème constaté en production (22/10/2026) :
//   47 objets dans `album-photos` pour 21 photos visibles.
//   26 fichiers sans ligne SQL = 9,6 Mo sur 10,1 Mo, soit 95 % du stockage
//   occupé par des déchets.
//
// Cause : l'envoi écrit le fichier PUIS crée la ligne. Si l'insertion
// échoue (RLS, réseau, contrainte), le fichier reste. Le code corrige
// désormais ce cas, mais les fichiers déjà perdus doivent être purgés.
//
// ── Pourquoi un script et pas du SQL ────────────────────────────────────
// `delete from storage.objects` supprime la MÉTADONNÉE, pas les octets :
// le fichier continue d'occuper le stockage. Seule l'API Storage libère
// réellement l'espace.
//
// ── Usage ───────────────────────────────────────────────────────────────
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/purge-orphans.cjs
//        → simulation : liste ce qui SERAIT supprimé, ne touche à rien
//
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/purge-orphans.cjs --apply
//        → supprime réellement
//
// ⚠️ La clé `service_role` contourne la RLS : ne la mets jamais dans un
// dépôt, un secret de PR, ni dans l'application.
// ────────────────────────────────────────────────────────────────────────

const { createClient } = require('../node_modules/@supabase/supabase-js');

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');

if (!SB_URL || !SB_KEY) {
  console.log(
    'Configuration manquante : renseigne SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.\n' +
      'La clé service_role est nécessaire : un compte ordinaire ne voit pas les\n' +
      'fichiers des autres utilisateurs, donc il ne peut pas les supprimer.'
  );
  process.exit(1);
}

const BUCKET = 'album-photos';
const BATCH = 100;

function formatMo(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
}

(async () => {
  const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

  // 1. Tous les objets du bucket (pagination : l'API plafonne à 1000)
  const objects = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list('', { limit: 1000, offset });
    if (error) {
      console.log('❌ lecture du bucket impossible :', error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    // `list('')` ne renvoie que le premier niveau : les fichiers sont dans
    // des « dossiers » (un par album), il faut donc descendre d'un cran.
    for (const entry of data) {
      if (entry.id === null && !entry.metadata) {
        const { data: inner } = await sb.storage
          .from(BUCKET)
          .list(entry.name, { limit: 1000 });
        for (const f of inner || []) objects.push({ ...f, name: `${entry.name}/${f.name}` });
      } else if (entry.metadata) {
        objects.push(entry);
      }
    }
    if (data.length < 1000) break;
  }

  // 2. Chemins réellement référencés par une ligne `photos`
  const refs = new Set();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb
      .from('photos')
      .select('storage_path')
      .range(offset, offset + 999);
    if (error) {
      console.log('❌ lecture de public.photos impossible :', error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    for (const row of data) if (row.storage_path) refs.add(row.storage_path);
    if (data.length < 1000) break;
  }

  const orphans = objects.filter((o) => !refs.has(o.name));
  const orphanBytes = orphans.reduce((sum, o) => sum + Number(o.metadata?.size || 0), 0);
  const totalBytes = objects.reduce((sum, o) => sum + Number(o.metadata?.size || 0), 0);

  console.log(`
Bucket « ${BUCKET} »
  objets            : ${objects.length}
  référencés         : ${objects.length - orphans.length}
  fantômes           : ${orphans.length}  (${formatMo(orphanBytes)})
  occupé             : ${formatMo(totalBytes)}
`);

  if (!orphans.length) {
    console.log('✅ Aucun fichier fantôme.\n');
    process.exit(0);
  }

  if (!APPLY) {
    console.log('Simulation — rien n\'a été supprimé. Exemples :');
    for (const o of orphans.slice(0, 10)) {
      console.log(`  • ${o.name}  (${formatMo(Number(o.metadata?.size || 0))})`);
    }
    if (orphans.length > 10) console.log(`  … et ${orphans.length - 10} autres`);
    console.log('\nRelance avec --apply pour supprimer réellement.\n');
    process.exit(0);
  }

  // 3. Suppression par lots (l'API refuse les très gros tableaux)
  let done = 0;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const slice = orphans.slice(i, i + BATCH).map((o) => o.name);
    const { error } = await sb.storage.from(BUCKET).remove(slice);
    if (error) {
      console.log(`❌ lot ${i / BATCH + 1} : ${error.message}`);
      continue;
    }
    done += slice.length;
    console.log(`  supprimés : ${done}/${orphans.length}`);
  }

  console.log(`\n✅ ${done} fichier(s) supprimé(s), ${formatMo(orphanBytes)} libérés.\n`);
})().catch((e) => {
  console.log('ERREUR FATALE :', e.message);
  process.exit(1);
});
