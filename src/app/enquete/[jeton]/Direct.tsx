"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { canalEnquete } from "@/lib/agent/annonce";

// Écoute le canal temps réel de l'enquête et recharge la page (données relues sur le serveur) à
// chaque signal. Vérifie aussi toutes les 5 s, au cas où un signal se perdrait.
export function Direct({ jeton }: { jeton: string }) {
  const router = useRouter();

  useEffect(() => {
    let attente: ReturnType<typeof setTimeout> | undefined;
    const recharger = () => {
      clearTimeout(attente);
      attente = setTimeout(() => router.refresh(), 300); // plusieurs signaux d'affilée = un seul rechargement
    };
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    const canal = supabase
      .channel(canalEnquete(jeton))
      .on("broadcast", { event: "*" }, recharger)
      .subscribe((statut) => {
        if (statut === "SUBSCRIBED") recharger(); // rattrape ce qui a pu se passer avant l'abonnement
      });
    const secours = setInterval(recharger, 5_000);
    return () => {
      clearTimeout(attente);
      clearInterval(secours);
      void supabase.removeChannel(canal);
    };
  }, [jeton, router]);

  return null;
}
