// ── SharePix · Vérification RLS ─────────────────────────────────────────
// Usage (depuis la racine du projet) :  node supabase/rls-check.cjs
//
// Teste que la Row Level Security protège réellement les données :
//   1. un client SANS session ne doit rien voir ;
//   2. un compte anonyme FRAIS ne doit rien voir (ni albums, ni photos,
//      ni commentaires, ni likes — sauf son propre profil) ;
//   3. le bucket « album-photos » doit être PRIVÉ : URL publique refusée,
//      URL signée OK pour un membre, refusée pour un non-membre.
//
// Code de sortie : 0 = tout est protégé, 1 = AU MOINS UNE FUITE.
//
// ── P1-16 : ce test ÉCRIT (comptes anonymes, album, photo) ─────────────
// Il ne doit donc PLUS viser la production. La configuration vient de
// l'environnement :
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node supabase/rls-check.cjs
// En CI, ce sont les secrets du projet de staging qui sont injectés.
// ────────────────────────────────────────────────────────────────────────

 

// Realtime (inclus dans supabase-js) exige un WebSocket natif sous Node :
// on réutilise celui installé avec les dépendances du projet.
global.WebSocket = require('../node_modules/ws');
const { createClient } = require('../node_modules/@supabase/supabase-js');

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_ANON_KEY;

if (!SB_URL || !SB_KEY) {
  console.log(
    'Configuration manquante : renseigne SUPABASE_URL et SUPABASE_ANON_KEY.\n' +
      'Ce test crée des comptes et des fichiers — ne le pointe pas vers la production.\n' +
      'Local : SUPABASE_URL=… SUPABASE_ANON_KEY=… node supabase/rls-check.cjs'
  );
  process.exit(1);
}

const TABLES_PRIVEES = ['albums', 'photos', 'photo_comments', 'photo_likes', 'album_members'];

let fuites = 0;
// Une erreur n'est pas toujours une preuve de protection : « fetch failed »
// veut dire que le serveur n'a pas répondu. Compter cela comme un succès
// reviendrait à déclarer la base protégée parce que le réseau est coupé.
let pannes = 0;
const PANNE_RESEAU =
  /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket hang up|network|aborted|terminated/i;

async function compter(client, table) {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true });
  return { count, error };
}

function verdict(label, { count, error }, attendu = 0) {
  if (error) {
    if (PANNE_RESEAU.test(error.message || '')) {
      pannes += 1;
      console.log(
        `  ⛔ ${label.padEnd(18)} : injoignable (${error.message.slice(0, 50)}) — RIEN N'EST PROUVÉ`
      );
      return;
    }
    // Vraie erreur d'accès (RLS, table absente) = protégé en pratique
    console.log(`  ✅ ${label.padEnd(18)} : refusé (${error.message.slice(0, 60)})`);
    return;
  }
  if ((count ?? 0) === attendu) {
    console.log(`  ✅ ${label.padEnd(18)} : ${count} ligne(s) visible(s)`);
  } else {
    fuites += 1;
    console.log(`  ❌ ${label.padEnd(18)} : FUITE → ${count} ligne(s) visible(s) !`);
  }
}

(async () => {
  // 1) Sans aucune session
  console.log('\n[1] Client anonyme SANS session (rôle anon pur)');
  const sansSession = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  for (const t of ['albums', 'photos']) {
    verdict(t, await compter(sansSession, t));
  }

  // 2) Compte anonyme fraîchement créé (ne doit rien posséder)
  console.log('\n[2] Compte invité FRAIS (signInAnonymously)');
  const frais = createClient(SB_URL, SB_KEY, {
    auth: { persistSession: false, storageKey: `rls-check-${Date.now()}` },
  });
  const s = await frais.auth.signInAnonymously();
  if (s.error) {
    console.log('  ⛔ signInAnonymously impossible :', s.error.message);
    console.log(
      '\n  Le test a besoin d\'un compte jetable pour vérifier ce qu\'un nouvel\n' +
        '  utilisateur peut voir. Deux causes possibles :\n' +
        '   • les comptes anonymes sont DÉSACTIVÉS sur le projet de test\n' +
        '     (Authentication → Sign In / Providers → Anonymous sign-ins).\n' +
        '     La production les utilise : le projet de test doit faire pareil,\n' +
        '     sinon la configuration testée n\'est pas celle de la production ;\n' +
        '   • le projet est injoignable (en pause, URL erronée, réseau coupé).\n' +
        '\n  Rien n\'a été vérifié.\n'
    );
    process.exit(2);
  }
  console.log('  compte de test :', s.data.user.id);
  for (const t of TABLES_PRIVEES) {
    verdict(t, await compter(frais, t));
  }
  // Son propre profil : 1 ligne, c'est NORMAL
  const prof = await compter(frais, 'profiles');
  if (!prof.error && (prof.count ?? 0) === 1) {
    console.log('  ✅ profiles           : 1 ligne (le sien, normal)');
  } else if (!prof.error && (prof.count ?? 0) === 0) {
    console.log('  ✅ profiles           : 0 ligne visible');
  } else {
    fuites += 1;
    console.log(`  ❌ profiles           : FUITE → ${prof.count} ligne(s) !`);
  }

  // 3) Storage : bucket privé + URLs signées --------------------------------
  // Le compte de test crée un album jetable → devient membre → upload 1 px,
  // on teste les 3 comportements, puis on nettoie.
  console.log('\n[3] Storage « album-photos » (bucket privé attendu)');
  const code = 'CHK' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const rpc = await frais.rpc('create_album', {
    p_name: 'rls-check-tmp',
    p_code: code,
    p_creator_name: 'check',
  });
  const albumId = rpc.data?.id;
  if (rpc.error || !albumId) {
    console.log('  ⚠️  préparation impossible (create_album) :', rpc.error?.message || "pas d'id");
  } else {
    const path = `${albumId}/check.jpg`;
    const jpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AvwA//9k=',
      'base64'
    );
    const up = await frais.storage
      .from('album-photos')
      .upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });

    if (up.error) {
      console.log('  ⚠️  upload membre refusé :', up.error.message);
    } else {
      // a) URL publique : doit être REFUSÉE (bucket privé)
      const { data: pub } = frais.storage.from('album-photos').getPublicUrl(path);
      const pubRes = await fetch(pub.publicUrl).catch(() => null);
      if (pubRes && pubRes.ok) {
        fuites += 1;
        console.log(
          '  ❌ bucket PUBLIC : l\'URL publique renvoie HTTP',
          pubRes.status,
          '→ bucket à repasser en privé (migration bucket idempotente)'
        );
      } else {
        console.log('  ✅ URL publique refusée (HTTP', pubRes ? pubRes.status : '?', ')');
      }

      // b) URL signée demandée par le membre : doit fonctionner
      const sig = await frais.storage.from('album-photos').createSignedUrl(path, 60);
      if (!sig.error && sig.data?.signedUrl) {
        console.log('  ✅ URL signée générée pour le membre');
      } else {
        fuites += 1;
        console.log('  ❌ URL signée refusée au MEMBRE :', sig.error?.message || sig.error_msg);
      }

      // c) URL signée demandée par un NON-membre : doit être refusée
      const etranger = createClient(SB_URL, SB_KEY, {
        auth: { persistSession: false, storageKey: `rls-out-${Date.now()}` },
      });
      const anon = await etranger.auth.signInAnonymously();
      if (anon.error) {
        // Sans session, le refus vient de l'absence de jeton, pas de la RLS.
        pannes += 1;
        console.log('  ⛔ non-membre : compte de contrôle impossible — non vérifié');
      } else {
        const sig2 = await etranger.storage.from('album-photos').createSignedUrl(path, 60);
        if (sig2.error || !sig2.data?.signedUrl) {
          console.log('  ✅ URL signée refusée au non-membre');
        } else {
          const r2 = await fetch(sig2.data.signedUrl).catch(() => null);
          if (r2 && r2.ok) {
            fuites += 1;
            console.log('  ❌ un non-membre peut télécharger la photo via URL signée !');
          } else {
            console.log('  ✅ non-membre : URL signée inutilisable');
          }
        }
      }

      // d) nettoyage du matériel de test
      try { await frais.storage.from('album-photos').remove([path]); } catch {}
      try { await frais.from('albums').delete().eq('id', albumId); } catch {}
    }
  }

  if (pannes > 0) {
    console.log(
      `\n⛔ ${pannes} VÉRIFICATION(S) NON EXÉCUTÉE(S) : le serveur n'a pas répondu.\n` +
        '   Ce n\'est pas un succès : on ne sait pas si les données sont protégées.\n'
    );
  }
  console.log(
    fuites > 0
      ? `\n❌ ${fuites} FUITE(S) DÉTECTÉE(S) — vérifie les policies RLS et le caractère privé du bucket (supabase/migrations/).\n`
      : pannes === 0
        ? '\n✅ RLS + Storage OK — aucune fuite détectée.\n'
        : ''
  );
  process.exit(fuites > 0 ? 1 : pannes > 0 ? 2 : 0);
})().catch((e) => {
  console.log('ERREUR FATALE :', e.message);
  process.exit(1);
});
