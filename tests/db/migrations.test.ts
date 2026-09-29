// Banc d'essai des migrations sur PGlite (vrai Postgres en WASM) avec une imitation minimale de
// Supabase : rôles anon / authenticated / service_role et droits par défaut sur le schéma public.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIR = join(__dirname, "../../supabase/migrations");
const MIGRATIONS = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const TABLES = ["apps", "avis", "groupes", "groupes_avis", "journal", "enquetes", "etapes", "sources"];

// Supabase donne par défaut tous les droits aux rôles publics sur les nouvelles tables :
// c'est précisément ce que les migrations doivent neutraliser.
const BOOT = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

let db: PGlite;

async function en(role: "anon" | "authenticated" | "service_role", sql: string) {
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}

async function appliquerTout() {
  for (const f of MIGRATIONS) await db.exec(readFileSync(join(DIR, f), "utf8"));
}

beforeAll(async () => {
  db = new PGlite({ extensions: { vector } });
  await db.exec(BOOT);
  await appliquerTout();
  await db.exec(`
    insert into public.apps (store_id, nom, secteur) values ('123', 'Appli test', 'compta');
    insert into public.avis (app_id, id_externe, note, contenu)
      select id, 'a1', 1, 'Aucun support technique' from public.apps;
  `);
});

afterAll(async () => {
  await db.close();
});

describe("migrations", () => {
  it("sont rejouables sans erreur", async () => {
    await expect(appliquerTout()).resolves.toBeUndefined();
  });

  it("activent la RLS sur toutes les tables", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r'`,
    );
    expect(rows.map((r) => r.relname).sort()).toEqual([...TABLES].sort());
    for (const r of rows) expect(r.relrowsecurity, r.relname).toBe(true);
  });
});

describe("accès avec les clés publiques", () => {
  for (const role of ["anon", "authenticated"] as const) {
    for (const table of TABLES) {
      it(`${role} ne lit pas ${table}`, async () => {
        await expect(en(role, `select * from public.${table}`)).rejects.toThrow(/permission denied/);
      });
    }
    it(`${role} n'écrit pas d'avis`, async () => {
      await expect(
        en(role, `insert into public.avis (app_id, id_externe, note, contenu) values (1, 'x', 1, 'x')`),
      ).rejects.toThrow(/permission denied/);
    });
  }

  it("la clé serveur lit les avis", async () => {
    const { rows } = await en("service_role", "select contenu from public.avis");
    expect(rows).toHaveLength(1);
  });
});

describe("intégrité des avis", () => {
  it("refuse un avis en double pour la même appli", async () => {
    await expect(
      db.exec(`insert into public.avis (app_id, id_externe, note, contenu) values (1, 'a1', 2, 'doublon')`),
    ).rejects.toThrow(/duplicate key/);
  });

  it("refuse une note hors de 1 à 5", async () => {
    await expect(
      db.exec(`insert into public.avis (app_id, id_externe, note, contenu) values (1, 'a2', 6, 'x')`),
    ).rejects.toThrow(/check constraint/);
  });

  it("refuse un avis vide", async () => {
    await expect(
      db.exec(`insert into public.avis (app_id, id_externe, note, contenu) values (1, 'a3', 1, '')`),
    ).rejects.toThrow(/check constraint/);
  });

  it("stocke un embedding de 384 dimensions et refuse une autre taille", async () => {
    const v = (n: number) => `[${Array.from({ length: n }, () => "0.1").join(",")}]`;
    await db.exec(`update public.avis set embedding = '${v(384)}' where id_externe = 'a1'`);
    await expect(
      db.exec(`update public.avis set embedding = '${v(768)}' where id_externe = 'a1'`),
    ).rejects.toThrow(/dimensions/);
  });
});

describe("fonctions d'analyse (0002)", () => {
  const vecteur = (x: number) => `[${Array.from({ length: 384 }, () => String(x)).join(",")}]`;

  for (const role of ["anon", "authenticated"] as const) {
    for (const f of ["enregistrer_analyses", "enregistrer_embeddings", "remplacer_groupes"]) {
      it(`${role} ne peut pas appeler ${f}`, async () => {
        await expect(en(role, `select public.${f}('[]'::jsonb)`)).rejects.toThrow(/permission denied/);
      });
    }
  }

  it("enregistre les analyses par lot", async () => {
    const lot = JSON.stringify([
      { id: 1, categorie: "support", probleme: "Service client injoignable", type_client: "artisan", gravite: 3, signal_paiement: true },
      { id: 999, categorie: "bug", probleme: "x", type_client: null, gravite: 1, signal_paiement: false },
    ]);
    const { rows } = await en("service_role", `select public.enregistrer_analyses('${lot}'::jsonb) as n`);
    expect(rows[0]).toEqual({ n: 1 }); // l'id inconnu est ignoré
    const { rows: avis } = await db.query<{ categorie: string; gravite: number; analyse_le: string | null }>(
      "select categorie, gravite, analyse_le from public.avis where id = 1",
    );
    expect(avis[0]).toMatchObject({ categorie: "support", gravite: 3 });
    expect(avis[0].analyse_le).not.toBeNull();
  });

  it("refuse une catégorie inconnue", async () => {
    const lot = JSON.stringify([{ id: 1, categorie: "inconnue" }]);
    await expect(en("service_role", `select public.enregistrer_analyses('${lot}'::jsonb)`)).rejects.toThrow(/check constraint/);
  });

  it("enregistre les embeddings par lot", async () => {
    const lot = JSON.stringify([{ id: 1, embedding: vecteur(0.2) }]);
    const { rows } = await en("service_role", `select public.enregistrer_embeddings('${lot}'::jsonb) as n`);
    expect(rows[0]).toEqual({ n: 1 });
  });

  it("remplace les groupes d'un coup et garde seulement le dernier calcul", async () => {
    const groupes = (nom: string) =>
      JSON.stringify([
        { nom, resume: "r", secteur: "compta", nb_avis: 1, score: 7.5, score_detail: { volume: 1 }, centre: vecteur(0.1), membres: [{ avis_id: 1, distance: 0.1 }] },
      ]);
    const r1 = await en("service_role", `select public.remplacer_groupes('${groupes("A")}'::jsonb) as calcul`);
    const r2 = await en("service_role", `select public.remplacer_groupes('${groupes("B")}'::jsonb) as calcul`);
    expect((r2.rows[0] as { calcul: number }).calcul).toBe((r1.rows[0] as { calcul: number }).calcul + 1);
    const { rows } = await db.query<{ nom: string }>("select nom from public.groupes");
    expect(rows).toEqual([{ nom: "B" }]);
    const { rows: liens } = await db.query("select * from public.groupes_avis");
    expect(liens).toHaveLength(1); // les liens de l'ancien calcul partent avec leur groupe
  });

  it("n'efface rien si le nouveau calcul échoue", async () => {
    const mauvais = JSON.stringify([{ nom: "C", nb_avis: 1, score: 50, membres: [] }]); // score hors 0-10
    await expect(en("service_role", `select public.remplacer_groupes('${mauvais}'::jsonb)`)).rejects.toThrow();
    const { rows } = await db.query<{ nom: string }>("select nom from public.groupes");
    expect(rows).toEqual([{ nom: "B" }]);
  });
});

describe("contexte des groupes (0003)", () => {
  it("enregistre le contexte d'un groupe", async () => {
    const groupes = JSON.stringify([
      { nom: "D", nb_avis: 1, score: 5, contexte: { faiblesses: { bug: 3 } }, membres: [{ avis_id: 1, distance: 0.1 }] },
    ]);
    await en("service_role", `select public.remplacer_groupes('${groupes}'::jsonb)`);
    const { rows } = await db.query<{ contexte: unknown }>("select contexte from public.groupes");
    expect(rows).toEqual([{ contexte: { faiblesses: { bug: 3 } } }]);
  });

  it("reste fermée aux clés publiques", async () => {
    await expect(en("anon", "select public.remplacer_groupes('[]'::jsonb)")).rejects.toThrow(/permission denied/);
  });
});

describe("enquêtes de l'agent (0004)", () => {
  const etape = (numero: number, extra: Record<string, unknown> = {}) =>
    JSON.stringify({ numero, pensee: "p", outil: "chercher_avis", argument: "a", statut: "ok", resultat: "r", observation: "o", duree_ms: 10, ...extra });
  let id: number;

  beforeAll(async () => {
    const { rows } = await db.query<{ id: number }>("insert into public.enquetes (sujet) values ('logiciels pour boulangeries') returning id");
    id = rows[0].id;
  });

  for (const role of ["anon", "authenticated"] as const) {
    it(`${role} ne peut appeler aucune fonction de l'agent`, async () => {
      await expect(en(role, "select * from public.prendre_enquete()")).rejects.toThrow(/permission denied/);
      await expect(en(role, `select public.enregistrer_etape(1, '{}'::jsonb)`)).rejects.toThrow(/permission denied/);
      await expect(en(role, "select * from public.avis_proches('[0]')")).rejects.toThrow(/permission denied/);
    });
  }

  it("verrouille une enquête : une deuxième exécution ne la prend pas", async () => {
    const r1 = await en("service_role", `select id, statut from public.prendre_enquete(interval '5 minutes', ${id})`);
    expect(r1.rows).toEqual([{ id, statut: "en_cours" }]);
    const r2 = await en("service_role", `select id from public.prendre_enquete(interval '5 minutes', ${id})`);
    expect(r2.rows).toEqual([]);
  });

  it("reprend une enquête dont le verrou a expiré", async () => {
    await db.exec(`update public.enquetes set verrou_jusqu_a = now() - interval '1 minute' where id = ${id}`);
    const { rows } = await en("service_role", `select id from public.prendre_enquete(interval '5 minutes', ${id})`);
    expect(rows).toEqual([{ id }]);
  });

  it("enregistre les étapes dans l'ordre, avec leurs sources", async () => {
    const sources = JSON.stringify([{ url: "https://exemple.fr", titre: "Prix", texte: "19 € par mois", suspecte: false }]);
    await en("service_role", `select public.enregistrer_etape(${id}, '${etape(1)}'::jsonb, '${sources}'::jsonb)`);
    const maj = JSON.stringify([{ url: "https://exemple.fr", titre: "Prix", texte: "page entière", suspecte: true }]);
    await en("service_role", `select public.enregistrer_etape(${id}, '${etape(2)}'::jsonb, '${maj}'::jsonb)`);
    const { rows } = await db.query<{ etapes_faites: number }>(`select etapes_faites from public.enquetes where id = ${id}`);
    expect(rows[0].etapes_faites).toBe(2);
    const { rows: s } = await db.query(`select texte, suspecte from public.sources where enquete_id = ${id}`);
    expect(s).toEqual([{ texte: "page entière", suspecte: true }]); // même URL relue : mise à jour
  });

  it("refuse une étape en double ou sautée (exécution en retard)", async () => {
    await expect(en("service_role", `select public.enregistrer_etape(${id}, '${etape(2)}'::jsonb)`)).rejects.toThrow(/Étape 3 attendue/);
    await expect(en("service_role", `select public.enregistrer_etape(${id}, '${etape(5)}'::jsonb)`)).rejects.toThrow(/Étape 3 attendue/);
  });

  it("refuse un outil inconnu et une source qui n'est pas une page web", async () => {
    await expect(en("service_role", `select public.enregistrer_etape(${id}, '${etape(3, { outil: "executer_code" })}'::jsonb)`)).rejects.toThrow(/check constraint/);
    const s = JSON.stringify([{ url: "file:///etc/passwd", texte: "x" }]);
    await expect(en("service_role", `select public.enregistrer_etape(${id}, '${etape(3)}'::jsonb, '${s}'::jsonb)`)).rejects.toThrow(/check constraint/);
    const { rows } = await db.query<{ etapes_faites: number }>(`select etapes_faites from public.enquetes where id = ${id}`);
    expect(rows[0].etapes_faites).toBe(2); // rien d'enregistré à moitié
  });

  it("trouve les avis les plus proches d'un texte", async () => {
    const v = (x: number) => `[${Array.from({ length: 384 }, () => String(x)).join(",")}]`;
    await db.exec(`update public.avis set embedding = '${v(0.1)}'`);
    const { rows } = await en("service_role", `select contenu, app, similarite from public.avis_proches('${v(0.1)}', 5)`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ app: "Appli test" });
    expect((rows[0] as { similarite: number }).similarite).toBeCloseTo(1, 3);
  });
});

describe("jeton des enquêtes (0005)", () => {
  it("donne un jeton aléatoire et unique à chaque enquête", async () => {
    const { rows } = await db.query<{ jeton: string }>(
      "insert into public.enquetes (sujet) values ('sujet a'), ('sujet b') returning jeton",
    );
    expect(rows[0].jeton).toMatch(/^[0-9a-f-]{36}$/);
    expect(rows[0].jeton).not.toBe(rows[1].jeton);
    await expect(db.exec(`update public.enquetes set jeton = '${rows[0].jeton}' where jeton = '${rows[1].jeton}'`)).rejects.toThrow(/duplicate key/);
  });

  it("reste illisible avec les clés publiques", async () => {
    await expect(en("anon", "select jeton from public.enquetes")).rejects.toThrow(/permission denied/);
  });
});
