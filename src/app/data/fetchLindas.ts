import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

// Fetches the raw organisation data from LINDAS (https://ld.admin.ch).
// Usage: npm run fetch:lindas [-- <name> ...]   e.g. npm run fetch:lindas -- municipalities
// Afterwards run `npm run build:organisations` to regenerate organisations.json.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENDPOINT = "https://ld.admin.ch/query";

const LANG_NAMES = (subject: string, predicate: string, prefix: string) =>
  ["De", "Fr", "It", "En"]
    .map(
      (l) =>
        `OPTIONAL { ?${subject} schema:${predicate} ?${prefix}${l}. FILTER(lang(?${prefix}${l}) = "${l.toLowerCase()}") }`,
    )
    .join("\n  ");

const QUERIES: Record<string, string> = {
  // The seven departments and the Federal Chancellery
  departements: `
PREFIX schema: <http://schema.org/>

SELECT DISTINCT ?department ?nameDepDe ?nameDepFr ?nameDepIt ?nameDepEn ?altNameDepDe ?altNameDepFr ?altNameDepIt ?altNameDepEn ?office ?nameDe ?nameFr ?nameIt ?nameEn WHERE {
  ?department schema:inDefinedTermSet <https://ld.admin.ch/dimension/department>.

  ${LANG_NAMES("department", "name", "name")}
  ${LANG_NAMES("department", "alternateName", "altName")}
  ${LANG_NAMES("department", "name", "nameDep")}
  ${LANG_NAMES("department", "alternateName", "altNameDep")}
}`,

  // All offices of the seven departments
  offices: `
PREFIX schema: <http://schema.org/>

SELECT DISTINCT ?department ?nameDepDe ?nameDepFr ?nameDepIt ?nameDepEn ?altNameDepDe ?altNameDepFr ?altNameDepIt ?altNameDepEn ?office ?nameDe ?nameFr ?nameIt ?nameEn ?altNameDe ?altNameFr ?altNameIt ?altNameEn WHERE {
  ?office schema:inDefinedTermSet <https://ld.admin.ch/office>.
  ?office schema:parentOrganization ?department.

  ${LANG_NAMES("office", "name", "name")}
  ${LANG_NAMES("office", "alternateName", "altName")}

  ?department schema:inDefinedTermSet <https://ld.admin.ch/department>.

  ${LANG_NAMES("department", "name", "nameDep")}
  ${LANG_NAMES("department", "alternateName", "altNameDep")}
}`,

  // The Swiss cantons
  cantons: `
PREFIX schema: <http://schema.org/>

SELECT * WHERE {
  ?cantonUri a <https://schema.ld.admin.ch/Canton> .
  ${LANG_NAMES("cantonUri", "name", "name")}
}`,

  // The currently existing political municipalities (merged ones have a
  // version with schema:validThrough and are left out)
  municipalities: `
PREFIX schema: <http://schema.org/>
PREFIX vl: <https://version.link/>

SELECT ?municipalityUri ?name ?cantonUri ?cantonAbbreviation WHERE {
  ?municipalityUri a <https://schema.ld.admin.ch/PoliticalMunicipality> ;
    schema:name ?name ;
    vl:version ?version ;
    schema:containedInPlace ?cantonUri .
  ?cantonUri a <https://schema.ld.admin.ch/Canton> ;
    schema:alternateName ?cantonAbbreviation .
  FILTER NOT EXISTS { ?version schema:validThrough ?validThrough }
}
ORDER BY ?municipalityUri`,
};

async function fetchQuery(name: string): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ query: QUERIES[name] }),
  });
  if (!res.ok) {
    throw new Error(
      `${name}: ${res.status} ${res.statusText}\n${await res.text()}`,
    );
  }
  const json = await res.json();
  const file = path.join(__dirname, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`✓ ${name}.json (${json.results.bindings.length} rows)`);
}

const requested = process.argv.slice(2);
const unknown = requested.filter((n) => !(n in QUERIES));
if (unknown.length > 0) {
  console.error(
    `Unknown query: ${unknown.join(", ")}. Known: ${Object.keys(QUERIES).join(", ")}`,
  );
  process.exit(1);
}

try {
  for (const name of requested.length > 0 ? requested : Object.keys(QUERIES)) {
    await fetchQuery(name);
  }
} catch (error) {
  console.error("Error fetching from LINDAS:", error);
  process.exit(1);
}
