// Banc d'essai des migrations sur PGlite (vrai Postgres en WASM) avec une imitation minimale de
// Supabase : rôles anon / authenticated / service_role et droits par défaut sur le schéma public.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIR = join(__dirname, "../../supabase/migrations");
const MIGRATIONS = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const TABLES = ["apps", "avis", "groupes", "groupes_avis", "journal"];

// Supabase donne par défaut tous les droits aux rôles publics sur les nouvelles tables :
// c'est précisément ce que les migrations doivent neutraliser.
const BOOT = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
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
