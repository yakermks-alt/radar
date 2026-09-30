"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { contexte } from "@/lib/serveur/session";
import { modifierSuivi, retirerDuSuivi, STATUTS_SUIVI } from "@/lib/serveur/suivi";

const modification = z.object({
  statut: z.enum(STATUTS_SUIVI.map((s) => s.id) as [string, ...string[]]),
  note: z.string().trim().max(2000),
});

export async function enregistrerSuivi(id: number, form: FormData): Promise<void> {
  const c = await contexte();
  if (!c || !Number.isInteger(id)) return;
  const v = modification.safeParse({ statut: form.get("statut"), note: form.get("note") ?? "" });
  if (!v.success) return;
  await modifierSuivi(c.equipe.id, id, { statut: v.data.statut as (typeof STATUTS_SUIVI)[number]["id"], note: v.data.note || null });
  revalidatePath("/suivi");
}

export async function retirerSuivi(id: number): Promise<void> {
  const c = await contexte();
  if (!c || !Number.isInteger(id)) return;
  await retirerDuSuivi(c.equipe.id, id);
  revalidatePath("/suivi");
}
