// Collecte de nuit : synchronise data/apps.json dans la table apps, puis récupère les avis récents
// de chaque appli active (jusqu'à 10 pages de 50). Les avis déjà connus sont ignorés, et on s'arrête
// dès qu'une page ne contient plus rien de nouveau (les avis sont triés du plus récent au plus ancien).
// Chaque passage est tracé dans la table journal.
// Lancer : npx tsx --env-file=.env.local scripts/collecte/collecter-avis.mts [--max-apps N]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { lireFluxAvis, pause, PAGES_AVIS_MAX, recupererJson, urlAvis } from "../../src/lib/collecte/appstore";

const env = z
  .object({ NEXT_PUBLIC_SUPABASE_URL: z.url(), SUPABASE_SECRET_KEY: z.string().startsWith("sb_secret_") })
  .parse(process.env);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

const maxApps = Number(process.argv[process.argv.indexOf("--max-apps") + 1]) || Infinity;
const PAUSE_MS = 1_500;

const appsJson = z
  .array(
    z.object({
      storeId: z.string().regex(/^\d+$/),
      nom: z.string(),
      editeur: z.string().nullable(),
      secteur: z.string(),
      noteMoyenne: z.number().nullable(),
      nbNotes: z.number(),
      prix: z.string().nullable(),
      url: z.string().nullable(),
    }),
  )
  .parse(JSON.parse(readFileSync(new URL("../../data/apps.json", import.meta.url), "utf8")));

// Applis écartées à la main après relecture (tri de l'IA imparfait) : désactivées en base.
const exclusions = Object.keys(
  z.record(z.string(), z.object({ nom: z.string(), raison: z.string() })).parse(
    JSON.parse(readFileSync(new URL("../../data/exclusions.json", import.meta.url), "utf8")),
  ),
);

// Les réponses Supabase sont { data, error } : on lève l'erreur, on renvoie data non nul.
async function verifier<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<Exclude<T, null>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Réponse vide de la base");
  return data as Exclude<T, null>;
}

const journal: { id: number } = await verifier(db.from("journal").insert({ tache: "collecte" }).select("id").single());
const bilan = { apps: 0, pages: 0, nouveaux: 0, ignores: 0, erreurs: [] as string[] };

try {
  // 1. Synchronisation de la liste : ajout des nouvelles applis, mise à jour des notes.
  const synchro = await db.from("apps").upsert(
      appsJson.filter((a) => !exclusions.includes(a.storeId)).map((a) => ({
        store: "appstore",
        store_id: a.storeId,
        nom: a.nom,
        editeur: a.editeur,
        secteur: a.secteur,
        note_moyenne: a.noteMoyenne,
        nb_notes: a.nbNotes,
        prix: a.prix,
        url: a.url,
        maj_le: new Date().toISOString(),
      })),
      { onConflict: "store,store_id" },
    );
  if (synchro.error) throw new Error(synchro.error.message);
  if (exclusions.length) {
    const desactivation = await db.from("apps").update({ active: false }).in("store_id", exclusions);
    if (desactivation.error) throw new Error(desactivation.error.message);
  }
  const apps = await verifier(db.from("apps").select("id, store_id, nom").eq("active", true).order("id"));

  // 2. Avis, appli par appli. Une appli en erreur n'arrête pas la collecte des autres.
  for (const app of apps.slice(0, maxApps)) {
    try {
      let nouveauxApp = 0;
      for (let page = 1; page <= PAGES_AVIS_MAX; page++) {
        const json = await recupererJson(urlAvis(app.store_id, page));
        await pause(PAUSE_MS);
        if (!json) break;
        const { avis, dernierePage, ignores } = lireFluxAvis(json);
        bilan.pages++;
        bilan.ignores += ignores;
        if (avis.length === 0) break;

        const inseres = await verifier(
          db
            .from("avis")
            .upsert(
              avis.map((a) => ({
                app_id: app.id,
                id_externe: a.idExterne,
                note: a.note,
                titre: a.titre,
                contenu: a.contenu,
                auteur_empreinte: a.auteurEmpreinte,
                version_app: a.versionApp,
                publie_le: a.publieLe,
              })),
              { onConflict: "app_id,id_externe", ignoreDuplicates: true },
            )
            .select("id"),
        );
        nouveauxApp += inseres.length;
        if (inseres.length === 0 || (dernierePage !== null && page >= dernierePage)) break;
      }
      bilan.apps++;
      bilan.nouveaux += nouveauxApp;
      console.log(`${app.nom.slice(0, 40).padEnd(40)} +${nouveauxApp}`);
    } catch (e) {
      const msg = `${app.nom} : ${e instanceof Error ? e.message : String(e)}`;
      bilan.erreurs.push(msg.slice(0, 300));
      console.error(msg);
    }
  }

  const statut = bilan.apps === 0 && bilan.erreurs.length > 0 ? "erreur" : "ok";
  const fin = await db.from("journal").update({ statut, termine_le: new Date().toISOString(), details: bilan }).eq("id", journal.id);
  if (fin.error) throw new Error(fin.error.message);
  console.log(`\nBilan : ${bilan.apps} applis, ${bilan.pages} pages, ${bilan.nouveaux} nouveaux avis, ${bilan.erreurs.length} erreurs`);
  if (statut === "erreur") process.exitCode = 1;
} catch (e) {
  const erreur = e instanceof Error ? e.message : String(e);
  await db.from("journal").update({ statut: "erreur", termine_le: new Date().toISOString(), details: bilan, erreur }).eq("id", journal.id);
  throw e;
}
