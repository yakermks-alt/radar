// Attaque en direct de Radar (phase 7) : deux comptes de test, « victime » et « pirate », dans deux
// équipes. Le pirate tente de lire, modifier ou supprimer les données de la victime par toutes les
// portes du site (pages, actions serveur appelées à la main avec de faux paramètres, API Supabase avec
// la clé publique, webhook, redirections). Les comptes de test sont supprimés à la fin.
// Lancer après `npx next build` (identifiants des actions) :
//   npx tsx --env-file=.env.local scripts/securite/attaque.mts [--site https://…]
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient, type Session } from "@supabase/supabase-js";

const SITE = process.argv.includes("--site") ? process.argv[process.argv.indexOf("--site") + 1] : "https://radar-opportunites.netlify.app";
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLIQUE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(URL_SB, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

// Identifiants des actions serveur, lus dans le build (ils sont les mêmes en production).
const manifeste = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")) as { node: Record<string, { exportedName?: string }> };
const action = (nom: string) => {
  const id = Object.entries(manifeste.node).find(([, v]) => v.exportedName === nom)?.[0];
  if (!id) throw new Error(`Action ${nom} introuvable dans le build`);
  return id;
};

let ok = 0;
const echecs: string[] = [];
function verifier(nom: string, condition: boolean, detail = "") {
  if (condition) ok++;
  else echecs.push(`${nom}${detail ? ` (${detail})` : ""}`);
  console.log(`${condition ? "✓" : "✗ FAILLE"} ${nom}${detail && !condition ? ` : ${detail}` : ""}`);
}

// Compte de test et cookies de session tels que le navigateur les enverrait.
async function compte(email: string): Promise<{ id: string; cookie: string }> {
  const { data: cree, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: email.split("@")[0] } });
  if (error) throw new Error(error.message);
  const { data: lien, error: e2 } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (e2) throw new Error(e2.message);
  const anon = createClient(URL_SB, PUBLIQUE, { auth: { persistSession: false } });
  const { data: s, error: e3 } = await anon.auth.verifyOtp({ token_hash: lien.properties.hashed_token, type: "magiclink" });
  if (e3 || !s.session) throw new Error(e3?.message ?? "pas de session");
  const pot = new Map<string, string>();
  const ssr = createServerClient(URL_SB, PUBLIQUE, {
    cookies: { getAll: () => [...pot].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach((c) => pot.set(c.name, c.value)) },
  });
  await ssr.auth.setSession(s.session as Session);
  return { id: cree.user.id, cookie: [...pot].map(([k, v]) => `${k}=${v}`).join("; ") };
}

const page = (chemin: string, cookie = "") => fetch(`${SITE}${chemin}`, { headers: { cookie }, redirect: "manual" });

// Appel direct d'une action serveur, comme le ferait le navigateur, mais avec des paramètres choisis.
async function appeler(nom: string, chemin: string, cookie: string, args: unknown[], origine = SITE) {
  const r = await fetch(`${SITE}${chemin}`, {
    method: "POST",
    headers: { cookie, "next-action": action(nom), "content-type": "text/plain;charset=UTF-8", origin: origine, accept: "text/x-component" },
    body: JSON.stringify(args),
    redirect: "manual",
  });
  return { statut: r.status, texte: await r.text() };
}

const suffixe = Date.now().toString(36);
const victime = await compte(`victime-${suffixe}@radar-test.invalid`);
const pirate = await compte(`pirate-${suffixe}@radar-test.invalid`);

try {
  // Première visite : profils et équipes créés.
  for (const c of [victime, pirate]) await (await page("/", c.cookie)).text(); // page lue jusqu'au bout : le profil est créé pendant le rendu
  const equipeDe = async (id: string) => (await admin.from("profils").select("equipe_active").eq("id", id).single()).data!.equipe_active as number;
  const eqV = await equipeDe(victime.id);
  const eqP = await equipeDe(pirate.id);
  verifier("Chaque compte a sa propre équipe", eqV !== eqP && Boolean(eqV && eqP));

  // Données de la victime : un élément de suivi, un lien d'invitation, une enquête terminée.
  const { data: suivi } = await admin.from("suivi").insert({ equipe_id: eqV, titre: "Secret de la victime", note: "note privée" }).select("id").single();
  const { data: invit } = await admin.from("invitations").insert({ equipe_id: eqV, cree_par: victime.id }).select("jeton").single();
  const { data: enq } = await admin.from("enquetes").insert({ sujet: "Enquête privée de la victime", equipe_id: eqV, statut: "en_cours", erreur: "test", budget: 1 }).select("id, jeton").single();

  console.log("\n== Pages");
  for (const chemin of ["/", "/enquetes", "/suivi", "/equipe", "/compte", "/admin"]) {
    const r = await page(chemin);
    verifier(`Sans compte, ${chemin} renvoie vers la connexion`, r.status === 307 && (r.headers.get("location") ?? "").includes("/connexion"));
  }
  const adminP = await page("/admin", pirate.cookie);
  verifier("Un non-admin ne voit pas /admin", adminP.status === 404 || !(await adminP.text()).includes("Quotas gratuits"), `statut ${adminP.status}`);
  const suiviP = await (await page("/suivi", pirate.cookie)).text();
  verifier("Le pirate ne voit pas le suivi de la victime", !suiviP.includes("Secret de la victime"));
  const listeP = await (await page("/enquetes", pirate.cookie)).text();
  verifier("Le pirate ne voit pas les enquêtes de la victime", !listeP.includes("Enquête privée de la victime"));
  const equipeP = await (await page("/equipe", pirate.cookie)).text();
  verifier("Le pirate ne voit pas les liens d'invitation de la victime", !equipeP.includes(invit!.jeton));

  console.log("\n== Actions serveur appelées à la main");
  const avant = async () => (await admin.from("suivi").select("statut, note").eq("id", suivi!.id).single()).data;
  await fetch(`${SITE}/suivi`, { method: "POST", headers: { cookie: pirate.cookie, "next-action": action("enregistrerSuivi"), origin: SITE }, body: (() => { const f = new FormData(); f.set("1_statut", "abandonnee"); f.set("1_note", "piraté"); f.set("0", JSON.stringify([suivi!.id, "$K1"])); return f; })() });
  await appeler("retirerSuivi", "/suivi", pirate.cookie, [suivi!.id]);
  const apres = await avant();
  verifier("Le pirate ne modifie ni ne supprime le suivi de la victime", apres?.statut === "a_creuser" && apres?.note === "note privée", JSON.stringify(apres));

  await appeler("supprimerLien", "/equipe", pirate.cookie, [invit!.jeton]);
  const lien = await admin.from("invitations").select("jeton").eq("jeton", invit!.jeton).maybeSingle();
  verifier("Le pirate ne supprime pas le lien d'invitation de la victime", Boolean(lien.data));

  await appeler("retirer", "/equipe", pirate.cookie, [victime.id]);
  const membreV = await admin.from("membres").select("role").eq("equipe_id", eqV).eq("utilisateur_id", victime.id).maybeSingle();
  verifier("Le pirate ne retire pas la victime de son équipe", membreV.data?.role === "proprietaire");

  await fetch(`${SITE}/equipe`, { method: "POST", headers: { cookie: pirate.cookie, "next-action": action("basculer"), origin: SITE }, body: (() => { const f = new FormData(); f.set("1_equipe", String(eqV)); f.set("0", JSON.stringify(["$K1"])); return f; })() });
  verifier("Le pirate ne peut pas basculer dans l'équipe de la victime", (await equipeDe(pirate.id)) === eqP);

  const reprise = await appeler("reprendreEnquete", `/enquete/${enq!.jeton}`, pirate.cookie, [enq!.jeton]);
  verifier("Le pirate ne relance pas l'enquête de la victime", reprise.texte.includes("Seule l'équipe"), reprise.texte.slice(0, 120));

  const { data: top } = await admin.from("groupes").select("id").order("score", { ascending: false }).range(15, 15).single();
  await appeler("suivreOpportunite", "/", pirate.cookie, [top!.id]);
  const vole = await admin.from("suivi").select("id").eq("equipe_id", eqP);
  verifier("En gratuit, le pirate ne récupère pas une opportunité verrouillée (n° 16) par son numéro", (vole.data ?? []).length === 0);

  const csrf = await appeler("retirerSuivi", "/suivi", victime.cookie, [suivi!.id], "https://site-pirate.example");
  const toujours = await admin.from("suivi").select("id").eq("id", suivi!.id).maybeSingle();
  verifier("Une action envoyée depuis un autre site (CSRF) est refusée", Boolean(toujours.data), `statut ${csrf.statut}`);

  const promo = await appeler("passerPro", "/equipe", pirate.cookie, []);
  const planP = (await admin.from("equipes").select("plan").eq("id", eqP).single()).data?.plan;
  verifier("Personne ne passe en Pro sans payer", planP === "gratuit", `statut ${promo.statut}`);

  console.log("\n== API Supabase avec la clé publique (et la session du pirate)");
  const cleSeule = createClient(URL_SB, PUBLIQUE, { auth: { persistSession: false } });
  const { data: sP } = await admin.auth.admin.generateLink({ type: "magiclink", email: `pirate-${suffixe}@radar-test.invalid` });
  const connecte = createClient(URL_SB, PUBLIQUE, { auth: { persistSession: false } });
  await connecte.auth.verifyOtp({ token_hash: sP.properties!.hashed_token, type: "magiclink" });
  for (const [nom, client] of [["clé publique", cleSeule], ["session du pirate", connecte]] as const) {
    for (const t of ["profils", "equipes", "membres", "invitations", "suivi", "enquetes", "stripe_evenements", "emails_matin", "avis", "groupes"]) {
      const { data, error } = await client.from(t).select("*").limit(1);
      verifier(`${nom} : lecture de ${t} refusée`, Boolean(error) || (data ?? []).length === 0, error?.message);
    }
    const ecr = await client.from("profils").update({ admin: true }).eq("id", pirate.id).select();
    verifier(`${nom} : impossible de se déclarer admin`, Boolean(ecr.error) || (ecr.data ?? []).length === 0);
    for (const [f, args] of [
      ["premiere_connexion", { p_id: pirate.id, p_email: "x@y.fr", p_nom: null }],
      ["rejoindre_equipe", { p_jeton: invit!.jeton, p_utilisateur: pirate.id, p_max_gratuit: 99, p_max_pro: 99 }],
      ["reserver_enquete", { p_equipe: eqV, p_utilisateur: pirate.id, p_sujet: "x", p_budget: 1, p_max_semaine: 99, p_max_jour: 99, p_max_site: 99 }],
      ["quitter_equipe", { p_equipe: eqV, p_utilisateur: victime.id }],
    ] as const) {
      const { error } = await client.rpc(f, args);
      verifier(`${nom} : fonction ${f} refusée`, Boolean(error));
    }
  }

  console.log("\n== Divers");
  const redir = await page("/connexion?suivant=//site-pirate.example", pirate.cookie);
  const cible = new URL(redir.headers.get("location") ?? "/", SITE);
  verifier("Pas de redirection vers un autre site après connexion", cible.origin === new URL(SITE).origin, cible.href);
  const redir2 = await page("/auth/connexion?fournisseur=github&suivant=https://site-pirate.example");
  verifier("Le retour de connexion ne peut pas viser un autre site", !decodeURIComponent(redir2.headers.get("location") ?? "").includes("suivant=https://site-pirate"));
  const wh = await fetch(`${SITE}/api/stripe`, { method: "POST", headers: { "stripe-signature": "t=1,v1=faux" }, body: JSON.stringify({ id: "evt_faux", type: "customer.subscription.updated" }) });
  verifier("Faux webhook Stripe refusé", wh.status === 400);
  const invite = await page(`/rejoindre/00000000-0000-4000-8000-000000000000`, pirate.cookie);
  verifier("Invitation inventée : page introuvable", invite.status === 404);
  const tetes = (await page("/connexion")).headers;
  verifier("En-têtes de sécurité présents (CSP, cadre interdit, HTTPS)", Boolean(tetes.get("content-security-policy")?.includes("frame-ancestors 'none'") && tetes.get("x-frame-options") === "DENY" && tetes.get("strict-transport-security")));

  // Nom piégé : React doit l'afficher comme du texte.
  await admin.from("equipes").update({ nom: `<img src=x onerror=alert(1)>` }).eq("id", eqP);
  const equipeXss = await (await page("/equipe", pirate.cookie)).text();
  verifier("Nom d'équipe piégé affiché comme du texte (pas de code exécuté)", !equipeXss.includes("<img src=x onerror") && equipeXss.includes("&lt;img"));
} finally {
  // Nettoyage : comptes, équipes (vides, donc supprimées), données de test.
  for (const c of [victime, pirate]) {
    const { data: eqs } = await admin.from("membres").select("equipe_id").eq("utilisateur_id", c.id);
    for (const e of eqs ?? []) await admin.rpc("quitter_equipe", { p_equipe: e.equipe_id, p_utilisateur: c.id });
    await admin.auth.admin.deleteUser(c.id);
  }
  await admin.from("enquetes").delete().eq("sujet", "Enquête privée de la victime");
  // Équipes de test restées sans membre (profil créé après le départ, ou nom piégé) : supprimées.
  const { data: restes } = await admin.from("equipes").select("id, membres(utilisateur_id)").eq("plan", "gratuit");
  for (const e of restes ?? []) if (!(e.membres as unknown[]).length) await admin.from("equipes").delete().eq("id", e.id);
  console.log(`\n${ok} contrôles réussis, ${echecs.length} faille(s)${echecs.length ? " :\n- " + echecs.join("\n- ") : "."}`);
  if (echecs.length) process.exitCode = 1;
}
