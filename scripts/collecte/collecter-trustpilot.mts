// Avis Trustpilot des SaaS sur ordinateur (30/09, remarque de Maksen : les vrais SaaS ne sont pas sur
// l'App Store). Trustpilot bloque les robots : on ne le lit jamais nous-mêmes. Pour chaque SaaS de
// data/saas.json, une recherche Tavily renvoie la copie de sa page Trustpilot que le moteur a en mémoire
// (les avis récents) ; on la découpe en avis. Usage privé (Maksen et Michael). Pseudos jamais stockés.
// Chaque SaaS devient une « appli » de source trustpilot : les avis suivent ensuite le même chemin que
// ceux de l'App Store (tri, embeddings, regroupement). Coût : 1 recherche Tavily par SaaS.
// Lancer : npx tsx --env-file=.env.local scripts/collecte/collecter-trustpilot.mts [--max N] [--manquants]
// --manquants : seulement les SaaS sans page trouvée, avec une recherche formulée autrement.
import { readFileSync } from "node:fs";
import { z } from "zod";
import { decouperTrustpilot, domaineTrustpilot } from "../../src/lib/collecte/trustpilot";
import { pause } from "../../src/lib/collecte/appstore";
import { avecJournal, db, verifier } from "../lib/base";

const MAX = Number(process.argv[process.argv.indexOf("--max") + 1]) || Infinity;
const MANQUANTS = process.argv.includes("--manquants");
const cle = z.string().min(10).parse(process.env.TAVILY_API_KEY);
const liste = z.record(z.string(), z.array(z.string())).parse(JSON.parse(readFileSync(new URL("../../data/saas.json", import.meta.url), "utf8")));
const tavily = z.object({ results: z.array(z.object({ url: z.string(), title: z.string().nullish(), raw_content: z.string().nullish() })) });

await avecJournal(
  "collecte",
  async (bilan) => {
    let n = 0;
    const deja = new Set(
      ((await verifier(db.from("apps").select("editeur").eq("store", "trustpilot"))) as { editeur: string | null }[]).map((a) => a.editeur),
    );
    for (const [secteur, noms] of Object.entries(liste)) {
      for (const nom of noms) {
        if (MANQUANTS && deja.has(nom)) continue;
        if (n++ >= MAX) break;
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${cle}` },
          body: JSON.stringify({ query: MANQUANTS ? `trustpilot.com review ${nom} logiciel` : `${nom} avis trustpilot`, max_results: 5, include_raw_content: true }),
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) {
          console.log(`${nom.padEnd(30)} recherche refusée (${res.status})`);
          if (res.status === 429 || res.status === 432) break; // quota Tavily : on s'arrête là
          continue;
        }
        // La bonne page : une fiche Trustpilot dont le titre porte le nom du SaaS.
        const page = tavily
          .parse(await res.json())
          .results.find((r) => domaineTrustpilot(r.url) && r.raw_content && decouperTrustpilot(r.raw_content).nomEntreprise?.toLowerCase().includes(nom.toLowerCase().split(/[\s.]/)[0]));
        if (!page?.raw_content) {
          console.log(`${nom.padEnd(30)} pas de page Trustpilot`);
          bilan.introuvables++;
          continue;
        }
        const domaine = domaineTrustpilot(page.url)!;
        const { avis } = decouperTrustpilot(page.raw_content);
        const app: { id: number } = await verifier(
          db
            .from("apps")
            .upsert(
              { store: "trustpilot", store_id: domaine, nom, editeur: nom, secteur, url: `https://www.trustpilot.com/review/${domaine}`, active: true, maj_le: new Date().toISOString() },
              { onConflict: "store,store_id" },
            )
            .select("id")
            .single(),
        );
        if (avis.length) {
          const { data, error } = await db
            .from("avis")
            .upsert(
              avis.map((a) => ({ app_id: app.id, id_externe: a.id, note: a.note, titre: a.titre, contenu: a.contenu, publie_le: a.date })),
              { onConflict: "app_id,id_externe", ignoreDuplicates: true },
            )
            .select("id");
          if (error) throw new Error(error.message);
          bilan.nouveaux += data?.length ?? 0;
        }
        bilan.saas++;
        console.log(`${nom.padEnd(30)} ${domaine.padEnd(28)} ${avis.length} avis (${avis.filter((a) => a.note <= 2).length} négatifs)`);
        await pause(700);
      }
    }
    console.log(`\nBilan : ${bilan.saas} SaaS trouvés, ${bilan.introuvables} sans page, ${bilan.nouveaux} nouveaux avis`);
    return "ok";
  },
  { saas: 0, introuvables: 0, nouveaux: 0 },
);
