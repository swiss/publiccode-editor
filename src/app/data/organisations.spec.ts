import { getLocalizedText } from "../../i18n";
import organisations from "./organisations.json";

// constants.ts reads import.meta.env, which Jest can't parse
jest.mock("../contents/constants", () => ({ FALLBACK_LANGUAGE: "en" }));

type Name = Partial<Record<"de" | "fr" | "it" | "en", string>>;
type Organisation = {
  id: string;
  name: Name;
  alternativeName?: Name;
};

const LANGUAGES = ["de", "fr", "it", "en"] as const;

// built like in Editor.tsx
const label = (o: Organisation, lang: string) =>
  getLocalizedText(o.name as Record<string, string>, lang) +
  (o.alternativeName
    ? ` (${getLocalizedText(o.alternativeName as Record<string, string>, lang)})`
    : "");

const all: Organisation[] = organisations.flatMap(
  (group) => group.organisations,
);
const municipalityGroups = organisations.filter((group) =>
  /^https:\/\/ld\.admin\.ch\/municipality\/canton\/\d+$/.test(group.id),
);
const municipalities = municipalityGroups.flatMap((g) => g.organisations);

describe("organisations.json", () => {
  it("has unique municipality ids", () => {
    const ids = new Set(municipalities.map((m) => m.id));
    expect(ids.size).toBe(municipalities.length);
    const others = all.filter((o) => !ids.has(o.id));
    expect(others.length).toBe(all.length - municipalities.length);
  });

  it("has no empty names", () => {
    // missing languages must be left out, not written as "" (see removeEmptyNames)
    for (const group of organisations as {
      name: Name;
      abbreviation?: Name;
    }[]) {
      for (const name of [group.name, group.abbreviation]) {
        for (const value of Object.values(name ?? {})) {
          expect(value.trim()).not.toBe("");
        }
      }
    }
    for (const o of all) {
      for (const name of [o.name, o.alternativeName]) {
        for (const value of Object.values(name ?? {})) {
          expect(value.trim()).not.toBe("");
        }
      }
    }
  });

  it.each(LANGUAGES)("has no blank labels in %s", (lang) => {
    const blank = all.filter(
      (o) => !/^\S.*\S$/.test(label(o, lang)) || label(o, lang).includes("()"),
    );
    expect(blank).toEqual([]);
  });

  it.each(LANGUAGES)(
    "has no two organisations with the same label in %s",
    (lang) => {
      // organisation.name is set from the label,
      // so two organisations with equal labels would be indistinguishable
      const labelToIds = new Map<string, Set<string>>();
      for (const o of all) {
        const text = label(o, lang);
        labelToIds.set(text, (labelToIds.get(text) ?? new Set()).add(o.id));
      }
      const duplicates = [...labelToIds].filter(([, ids]) => ids.size > 1);
      expect(duplicates).toEqual([]);
    },
  );

  it("has only the cantons group under the canton prefix", () => {
    // the oss-catalog treats every id starting with this prefix as a canton
    expect(
      organisations
        .map((g) => g.id)
        .filter((id) => id.startsWith("https://ld.admin.ch/canton")),
    ).toEqual(["https://ld.admin.ch/canton"]);
  });

  it("has one municipality group per canton", () => {
    const cantons = organisations.find(
      (g) => g.id === "https://ld.admin.ch/canton",
    );
    expect(municipalityGroups.map((g) => g.id).sort()).toEqual(
      cantons!.organisations
        .map((c) => c.id.replace("/canton/", "/municipality/canton/"))
        .sort(),
    );
  });

  it("has a plausible number of municipalities", () => {
    // 2110 in 2026; guards against a broken LINDAS query (e.g. merged municipalities included)
    expect(municipalities.length).toBeGreaterThan(2000);
    expect(municipalities.length).toBeLessThan(2300);
  });

  it("labels every municipality with its canton", () => {
    for (const group of municipalityGroups) {
      for (const m of group.organisations) {
        expect(m.id).toMatch(/^https:\/\/ld\.admin\.ch\/municipality\/\d+$/);
        expect(m.name.de).toMatch(/\([A-Z]{2}\)$/);
      }
    }
  });
});
