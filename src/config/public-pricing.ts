export const ownerPlans = [
  { range: "1 à 5 biens", monthly: 19, setup: 49, annual: 79 },
  { range: "6 à 20 biens", monthly: 39, setup: 49, annual: 79 },
  { range: "21 à 50 biens", monthly: 69, setup: 99, annual: 149 },
] as const;

export const agencyPlans = [
  { range: "1 à 50 biens", monthly: 79, setup: 199, annual: 199 },
  { range: "51 à 150 biens", monthly: 149, setup: 399, annual: 199 },
  { range: "151 à 300 biens", monthly: 249, setup: 399, annual: 399 },
  { range: "301 à 600 biens", monthly: 399, setup: 599, annual: 399 },
  { range: "Plus de 600 biens", monthly: null, setup: null, annual: null },
] as const;
