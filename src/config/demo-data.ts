export const demoAgency = {
  name: "Agence Horizon",
  metrics: [
    { label: "Biens gérés", value: "128" },
    { label: "Incidents ouverts", value: "7" },
    { label: "Interventions cette semaine", value: "12" },
    { label: "Documents conformes", value: "96 %" },
  ],
  properties: [
    { reference: "LYO-042", address: "18 rue des Augustins, Lyon", tenant: "Camille Martin", status: "Loué" },
    { reference: "VIL-017", address: "7 avenue Henri-Barbusse, Villeurbanne", tenant: "Nora Benali", status: "Loué" },
    { reference: "CAL-009", address: "31 quai Saint-Antoine, Lyon", tenant: "Disponible", status: "Vacant" },
  ],
  incidents: [
    {
      reference: "INC-2026-00418",
      subject: "Fuite sous évier",
      property: "LYO-042",
      status: "Devis reçus",
      priority: "Haute",
    },
    {
      reference: "INC-2026-00411",
      subject: "Volet roulant bloqué",
      property: "VIL-017",
      status: "Planifié",
      priority: "Normale",
    },
    {
      reference: "INC-2026-00397",
      subject: "Interphone intermittent",
      property: "CAL-009",
      status: "En analyse",
      priority: "Faible",
    },
  ],
  documents: [
    { name: "Bail - LYO-042", category: "Bail", validity: "Valide" },
    { name: "Attestation assurance - VIL-017", category: "Assurance", validity: "Expire dans 18 jours" },
    { name: "Rapport intervention INC-2026-00382", category: "Rapport", validity: "Archivé" },
  ],
  artisans: [
    { name: "Plomberie Rhône Services", trade: "Plomberie", rating: "4,8 / 5" },
    { name: "Élec Confluence", trade: "Électricité", rating: "4,7 / 5" },
  ],
};
