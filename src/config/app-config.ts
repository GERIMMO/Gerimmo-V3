import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "GERIMMO V3",
  version: packageJson.version,
  copyright: `© ${currentYear}, GERIMMO V3.`,
  meta: {
    title: "GERIMMO V3 - Plateforme de gestion immobiliere",
    description:
      "GERIMMO V3 est le socle applicatif de gestion immobiliere pour centraliser incidents, biens, locataires, proprietaires, artisans, documents et rapports.",
  },
};
