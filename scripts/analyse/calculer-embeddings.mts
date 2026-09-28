// Calcule en local l'embedding du problème reformulé de chaque avis trié (hors "autre").
// Lancer : npx tsx --env-file=.env.local scripts/analyse/calculer-embeddings.mts
import { versPgvector, vectoriser } from "../../src/lib/analyse/embeddings";
import { avecJournal, db, verifier } from "../lib/base";

const LOT = 64;

await avecJournal(
  "embeddings",
  async (bilan) => {
    for (;;) {
      const lignes = await verifier(
        db
          .from("avis")
          .select("id, probleme")
          .is("embedding", null)
          .not("probleme", "is", null)
          .neq("categorie", "autre")
          .order("id")
          .limit(LOT),
      );
      if (lignes.length === 0) break;
      const vecteurs = await vectoriser(lignes.map((l) => l.probleme as string));
      bilan.avis += await verifier(
        db.rpc("enregistrer_embeddings", { lignes: lignes.map((l, i) => ({ id: l.id, embedding: versPgvector(vecteurs[i]) })) }),
      );
      process.stdout.write(`\r${bilan.avis} embeddings`);
    }
    console.log(`\nBilan : ${bilan.avis} embeddings calculés`);
    return "ok";
  },
  { avis: 0 },
);
