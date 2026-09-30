// Banc d'essai des migrations sur PGlite (vrai Postgres en WASM) avec une imitation minimale de
// Supabase : rôles anon / authenticated / service_role et droits par défaut sur le schéma public.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DIR = join(__dirname, "../../supabase/migrations");
const MIGRATIONS = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const TABLES = ["apps", "avis", "groupes", "groupes_avis", "journal", "enquetes", "etapes", "sources", "cache_web", "equipes", "profils", "membres", "invitations", "suivi", "stripe_evenements", "emails_matin"];

// Supabase donne par défaut tous les droits aux rôles publics sur les nouvelles tables :
// c'est précisément ce que les migrations doivent neutraliser.
const BOOT = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema extensions;
create schema auth; create table auth.users (id uuid primary key);
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

describe("fiabilité (0006)", () => {
  it("compte les recherches web du mois, hors enquêtes plus anciennes", async () => {
    await db.exec(`
      insert into public.enquetes (sujet, mesures) values ('mesure a', '{"recherches": 4}'), ('mesure b', '{"recherches": 3, "recherches_cache": 9}');
      insert into public.enquetes (sujet, mesures, maj_le) values ('mesure vieille', '{"recherches": 50}', now() - interval '40 days');
    `);
    const { rows } = await en("service_role", "select public.recherches_du_mois() as n");
    expect(rows[0]).toEqual({ n: 7 });
  });

  it("ne reprend automatiquement que les enquêtes oubliées", async () => {
    await db.exec("update public.enquetes set statut = 'terminee'");
    const { rows } = await db.query<{ id: number }>(`
      insert into public.enquetes (sujet, statut) values ('toute neuve', 'en_attente') returning id`);
    const neuve = rows[0].id;
    const aucune = await en("service_role", "select id from public.prendre_enquete_oubliee()");
    expect(aucune.rows).toEqual([]); // lancée à l'instant depuis le site : pas touche
    const { rows: r2 } = await db.query<{ id: number }>(`
      insert into public.enquetes (sujet, statut, erreur) values ('interrompue', 'en_cours', 'Gemini trop lent') returning id`);
    const prise = await en("service_role", "select id from public.prendre_enquete_oubliee()");
    expect(prise.rows).toEqual([{ id: r2[0].id }]);
    await db.exec(`update public.enquetes set maj_le = now() - interval '20 minutes' where id = ${neuve}`);
    const morte = await en("service_role", "select id from public.prendre_enquete_oubliee()");
    expect(morte.rows).toEqual([{ id: neuve }]); // exécution morte : reprise
    await expect(en("anon", "select * from public.prendre_enquete_oubliee()")).rejects.toThrow(/permission denied/);
  });

  it("ferme le cache et le compteur aux clés publiques", async () => {
    await expect(en("anon", "select * from public.cache_web")).rejects.toThrow(/permission denied/);
    await expect(en("authenticated", "select public.recherches_du_mois()")).rejects.toThrow(/permission denied/);
  });

  it("refuse une clé de cache vide ou démesurée", async () => {
    await expect(db.exec(`insert into public.cache_web (cle, contenu) values ('x', '{}')`)).rejects.toThrow(/check constraint/);
    await expect(db.exec(`insert into public.cache_web (cle, contenu) values ('page:${"a".repeat(1200)}', '{}')`)).rejects.toThrow(/check constraint/);
  });
});

describe("comptes et équipes (0007)", () => {
  const A = "00000000-0000-4000-8000-00000000000a";
  const B = "00000000-0000-4000-8000-00000000000b";
  const C = "00000000-0000-4000-8000-00000000000c";
  const connexion = async (id: string, email: string, nom: string | null = null) => {
    const { rows } = await en("service_role", `select public.premiere_connexion('${id}', '${email}', ${nom ? `'${nom}'` : "null"}) as equipe`);
    return (rows[0] as { equipe: number }).equipe;
  };
  let equipeA: number;

  beforeAll(async () => {
    await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}'), ('${C}')`);
  });

  it("crée le profil et une équipe personnelle à la première connexion, une seule fois", async () => {
    equipeA = await connexion(A, "a@exemple.fr", "Alice");
    expect(await connexion(A, "a@exemple.fr", "Alice")).toBe(equipeA);
    const { rows } = await db.query<{ nom: string; role: string }>(
      `select e.nom, m.role from public.equipes e join public.membres m on m.equipe_id = e.id where m.utilisateur_id = '${A}'`,
    );
    expect(rows).toEqual([{ nom: "Équipe de Alice", role: "proprietaire" }]);
    await connexion(B, "bob@exemple.fr");
    const { rows: b } = await db.query<{ nom: string }>(`select e.nom from public.equipes e join public.profils p on p.equipe_active = e.id where p.id = '${B}'`);
    expect(b).toEqual([{ nom: "Équipe de bob" }]); // sans nom : début de l'email
  });

  it("fait rejoindre une équipe par invitation, sans consommer d'usage pour un membre déjà là", async () => {
    const { rows } = await db.query<{ jeton: string }>(`insert into public.invitations (equipe_id, usages_max) values (${equipeA}, 2) returning jeton`);
    const jeton = rows[0].jeton;
    const r = await en("service_role", `select public.rejoindre_equipe('${jeton}', '${B}', 3, 10) as equipe`);
    expect(r.rows[0]).toEqual({ equipe: equipeA });
    await en("service_role", `select public.rejoindre_equipe('${jeton}', '${B}', 3, 10)`);
    const { rows: u } = await db.query<{ usages: number }>(`select usages from public.invitations where jeton = '${jeton}'`);
    expect(u).toEqual([{ usages: 1 }]);
    const { rows: p } = await db.query<{ equipe_active: number }>(`select equipe_active from public.profils where id = '${B}'`);
    expect(p).toEqual([{ equipe_active: equipeA }]); // l'équipe rejointe devient l'équipe active
  });

  it("refuse une invitation expirée, épuisée ou inconnue, et une équipe pleine", async () => {
    await connexion(C, "c@exemple.fr");
    const { rows } = await db.query<{ jeton: string }>(`
      insert into public.invitations (equipe_id, expire_le) values (${equipeA}, now() - interval '1 minute') returning jeton`);
    await expect(en("service_role", `select public.rejoindre_equipe('${rows[0].jeton}', '${C}', 3, 10)`)).rejects.toThrow(/invitation_invalide/);
    await expect(en("service_role", `select public.rejoindre_equipe(gen_random_uuid(), '${C}', 3, 10)`)).rejects.toThrow(/invitation_invalide/);
    const { rows: r2 } = await db.query<{ jeton: string }>(`insert into public.invitations (equipe_id) values (${equipeA}) returning jeton`);
    await expect(en("service_role", `select public.rejoindre_equipe('${r2[0].jeton}', '${C}', 2, 10)`)).rejects.toThrow(/equipe_pleine/);
    const { rows: r3 } = await db.query<{ jeton: string }>(`insert into public.invitations (equipe_id, usages, usages_max) values (${equipeA}, 1, 1) returning jeton`);
    await expect(en("service_role", `select public.rejoindre_equipe('${r3[0].jeton}', '${C}', 3, 10)`)).rejects.toThrow(/invitation_invalide/);
  });

  it("réserve les enquêtes dans le quota de l'équipe et la limite du site", async () => {
    const reserver = (semaine: number, jour: number, site: number) =>
      en("service_role", `select * from public.reserver_enquete(${equipeA}, '${A}', 'logiciel pour fleuristes', 15::smallint, ${semaine}, ${jour}, ${site})`);
    const r = await reserver(1, 5, 1000);
    expect(r.rows).toHaveLength(1);
    await expect(reserver(1, 5, 1000)).rejects.toThrow(/quota_semaine/);
    await expect(reserver(50, 1, 1000)).rejects.toThrow(/quota_jour/);
    await expect(reserver(50, 50, 1)).rejects.toThrow(/limite_site/);
    const { rows } = await db.query<{ equipe_id: number; lance_par: string }>(`select equipe_id, lance_par from public.enquetes where sujet = 'logiciel pour fleuristes'`);
    expect(rows).toEqual([{ equipe_id: equipeA, lance_par: A }]);
  });

  it("passe la main au plus ancien membre quand le propriétaire part, et supprime une équipe vide", async () => {
    await en("service_role", `select public.quitter_equipe(${equipeA}, '${A}')`);
    const { rows } = await db.query<{ utilisateur_id: string; role: string }>(`select utilisateur_id, role from public.membres where equipe_id = ${equipeA}`);
    expect(rows).toEqual([{ utilisateur_id: B, role: "proprietaire" }]);
    const { rows: p } = await db.query<{ equipe_active: number | null }>(`select equipe_active from public.profils where id = '${A}'`);
    expect(p).toEqual([{ equipe_active: null }]);
    await en("service_role", `select public.quitter_equipe(${equipeA}, '${B}')`);
    const { rows: e } = await db.query(`select id from public.equipes where id = ${equipeA}`);
    expect(e).toEqual([]);
    const { rows: q } = await db.query<{ equipe_id: number | null }>(`select equipe_id from public.enquetes where sujet = 'logiciel pour fleuristes'`);
    expect(q).toEqual([{ equipe_id: null }]); // l'enquête reste, détachée
  });

  it("refuse de supprimer une équipe vide qui a encore un abonnement", async () => {
    const equipeC = await connexion(C, "c@exemple.fr");
    await db.exec(`update public.equipes set plan = 'pro' where id = ${equipeC}`);
    await expect(en("service_role", `select public.quitter_equipe(${equipeC}, '${C}')`)).rejects.toThrow(/abonnement_actif/);
  });

  it("supprime profil, adhésions et envois quand le compte est supprimé", async () => {
    await db.exec(`insert into public.emails_matin (utilisateur_id, jour, statut) values ('${B}', current_date, 'envoye')`);
    await db.exec(`delete from auth.users where id = '${B}'`);
    const { rows } = await db.query(`select 1 from public.profils where id = '${B}' union all select 1 from public.emails_matin where utilisateur_id = '${B}'`);
    expect(rows).toEqual([]);
  });

  it("ferme toutes les fonctions de comptes aux clés publiques", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(en(role, `select public.premiere_connexion('${A}', 'x@y.fr', null)`)).rejects.toThrow(/permission denied/);
      await expect(en(role, `select public.rejoindre_equipe(gen_random_uuid(), '${A}', 3, 10)`)).rejects.toThrow(/permission denied/);
      await expect(en(role, `select * from public.reserver_enquete(1, '${A}', 'x', 1::smallint, 1, 1, 1)`)).rejects.toThrow(/permission denied/);
      await expect(en(role, `select public.quitter_equipe(1, '${A}')`)).rejects.toThrow(/permission denied/);
    }
  });

  it("refuse les valeurs hors format (statut du suivi, identifiants Stripe)", async () => {
    const equipeC = (await db.query<{ id: number }>(`select equipe_active as id from public.profils where id = '${C}'`)).rows[0].id;
    await expect(db.exec(`insert into public.suivi (equipe_id, titre, statut) values (${equipeC}, 't', 'inconnu')`)).rejects.toThrow(/check constraint/);
    await expect(db.exec(`update public.equipes set stripe_client = 'pas_un_client' where id = ${equipeC}`)).rejects.toThrow(/check constraint/);
    await expect(db.exec(`insert into public.stripe_evenements (id, type) values ('x', 'y')`)).rejects.toThrow(/check constraint/);
  });
});
