#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════
 * SharePix — inventaire et purge des fichiers orphelins du bucket
 *
 * Un « orphelin » est un objet présent dans storage.objects sans ligne
 * correspondante dans public.photos. Ils apparaissent quand un upload
 * Storage réussit mais que l'insertion SQL échoue (bug corrigé en
 * octobre 2026), ou quand un album est supprimé sans que ses fichiers
 * le soient.
 *
 * MESURE AU 21/10/2026 : 26 orphelins / 37 objets, 9,4 Mo.
 * Les 26 appartenaient à des albums DÉJÀ SUPPRIMÉS.
 *
 * ⚠️  DESTRUCTIF. Toujours lancer sans --confirm d'abord.
 *
 * Usage :
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/purge-orphan-storage.mjs
 *
 *   # puis, après avoir relu la liste :
 *   ... node scripts/purge-orphan-storage.mjs --confirm
 * ═══════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const BUCKET = 'album-photos';
const CONFIRM = process.argv.includes('--confirm');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Liste récursivement tous les objets du bucket. */
async function listAll(prefix = '') {
  const out = [];
  let offset = 0;
  const limit = 100;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data?.length) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Un dossier n'a pas de metadata ; on descend dedans.
      if (entry.id === null || entry.metadata === null) {
        out.push(...(await listAll(path)));
      } else {
        out.push({ path, size: entry.metadata?.size ?? 0, createdAt: entry.created_at });
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

/** Tous les storage_path référencés par public.photos. */
async function referencedPaths() {
  const out = new Set();
  let from = 0;
  const page = 1000;

  for (;;) {
    const { data, error } = await supabase
      .from('photos')
      .select('storage_path')
      .range(from, from + page - 1);
    if (error) throw error;
    (data || []).forEach((r) => r.storage_path && out.add(r.storage_path));
    if (!data || data.length < page) break;
    from += page;
  }
  return out;
}

const kb = (n) => `${(n / 1024).toFixed(0)} Ko`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} Mo`;

(async () => {
  console.log(`\n🔍 Inventaire du bucket « ${BUCKET} »…\n`);

  const objects = await listAll();
  const referenced = await referencedPaths();
  const orphans = objects.filter((o) => !referenced.has(o.path));

  const totalBytes = objects.reduce((s, o) => s + o.size, 0);
  const orphanBytes = orphans.reduce((s, o) => s + o.size, 0);

  console.log(`   objets au total      : ${objects.length} (${mb(totalBytes)})`);
  console.log(`   référencés en base   : ${objects.length - orphans.length}`);
  console.log(`   orphelins            : ${orphans.length} (${mb(orphanBytes)})`);

  if (!orphans.length) {
    console.log('\n✅ Aucun orphelin.\n');
    return;
  }

  console.log('\n   Détail :');
  orphans.forEach((o) => console.log(`     · ${o.path}  (${kb(o.size)})`));

  const manifestPath = `storage-orphelins-${new Date().toISOString().slice(0, 10)}.json`;
  writeFileSync(manifestPath, JSON.stringify(orphans, null, 2));
  console.log(`\n📄 Manifeste écrit dans ${manifestPath}`);

  if (!CONFIRM) {
    console.log('\n⏸  Aucune suppression (mode inventaire).');
    console.log('   Relancez avec --confirm après avoir vérifié la liste.\n');
    return;
  }

  console.log('\n🗑  Suppression…');
  const CHUNK = 100;
  let removed = 0;
  for (let i = 0; i < orphans.length; i += CHUNK) {
    const batch = orphans.slice(i, i + CHUNK).map((o) => o.path);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error('   ❌ échec sur un lot :', error.message);
      break;
    }
    removed += batch.length;
    console.log(`   ${removed}/${orphans.length}`);
  }
  console.log(`\n✅ ${removed} objet(s) supprimé(s), ${mb(orphanBytes)} libérés.\n`);
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
