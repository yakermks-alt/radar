// Collecte de nuit : synchronise data/apps.json dans la table apps, puis récupère les avis récents
// de chaque appli active (jusqu'à 10 pages de 50). Les avis déjà connus sont ignorés, et on s'arrête
// dès qu'une page ne contient plus rien de nouveau (les avis sont triés du plus récent au plus ancien).
// Chaque passage est tracé dans la table journal.
// Lancer : npx tsx --env-file=.env.local scripts/collecte/collecter-avis.mts [--max-apps N]
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  lireFluxAvis,
  pause,
  PAGES_AVIS_MAX,
  PAYS,
  recupererJson,
  urlAvis,
} from "../../src/lib/collecte/appstore";
import { avecJournal, db, sansErreur, verifier } from "../lib/base";

const maxApps =
  Number(process.argv[process.argv.indexOf("--max-apps") + 1]) || Infinity;
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
  .parse(
    JSON.parse(
      readFileSync(new URL("../../data/apps.json", import.meta.url), "utf8"),
    ),
  );

// Applis écartées à la main après relecture (tri de l'IA imparfait) : désactivées en base.
const exclusions = Object.keys(
  z
    .record(z.string(), z.object({ nom: z.string(), raison: z.string() }))
    .parse(
      JSON.parse(
        readFileSync(
          new URL("../../data/exclusions.json", import.meta.url),
          "utf8",
        ),
      ),
    ),
);

await avecJournal(
  "collecte",
  async (bilan) => {
    // 1. Synchronisation de la liste : ajout des nouvelles applis, mise à jour des notes.
    await sansErreur(
      db.from("apps").upsert(
        appsJson
          .filter((a) => !exclusions.includes(a.storeId))
          .map((a) => ({
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
      ),
    );
    if (exclusions.length) {
      await sansErreur(
        db.from("apps").update({ active: false }).in("store_id", exclusions),
      );
    }
    const apps = await verifier(
      db
        .from("apps")
        .select("id, store_id, nom")
        .eq("active", true)
        .order("id"),
    );

    // 2. Avis, appli par appli. Une appli en erreur n'arrête pas la collecte des autres.
    for (const app of apps.slice(0, maxApps)) {
      try {
        let nouveauxApp = 0;
        // Chaque App Store francophone a ses propres avis ; une appli absente d'un pays renvoie un flux vide.
        for (const pays of PAYS)
          for (let page = 1; page <= PAGES_AVIS_MAX; page++) {
            const json = await recupererJson(urlAvis(app.store_id, page, pays));
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
            if (
              inseres.length === 0 ||
              (dernierePage !== null && page >= dernierePage)
            )
              break;
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

    console.log(
      `\nBilan : ${bilan.apps} applis, ${bilan.pages} pages, ${bilan.nouveaux} nouveaux avis, ${bilan.erreurs.length} erreurs`,
    );
    return bilan.apps === 0 && bilan.erreurs.length > 0 ? "erreur" : "ok";
  },
  { apps: 0, pages: 0, nouveaux: 0, ignores: 0, erreurs: [] as string[] },
);
