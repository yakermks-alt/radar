// Nom lisible d'une source : son site, ou le type de source interne à Radar.
export function nomSource(url: string): string {
  if (url.startsWith("radar://avis/")) return "Avis App Store";
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("insee.fr")) return "Insee";
    if (u.hostname === "annuaire-entreprises.data.gouv.fr") return "Annuaire des entreprises";
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const estLien = (url: string) => /^https?:\/\//.test(url);
