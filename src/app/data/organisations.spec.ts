import organisations from "./organisations.json";

type Lang = "de" | "fr" | "it" | "en";
type Organisation = {
  id: string;
  name: Record<Lang, string>;
  alternativeName?: Record<Lang, string>;
};

const all: Organisation[] = organisations.flatMap(
  (group) => group.organisations,
);
const municipalityGroups = organisations.filter((group) =>
  /^https:\/\/ld\.admin\.ch\/canton\/\d+\/municipalities$/.test(group.id),
);
const municipalities = municipalityGroups.flatMap((g) => g.organisations);

describe("organisations.json", () => {
  it("has unique municipality ids", () => {
    const ids = new Set(municipalities.map((m) => m.id));
    expect(ids.size).toBe(municipalities.length);
    const others = all.filter((o) => !ids.has(o.id));
    expect(others.length).toBe(all.length - municipalities.length);
  });

  it.each(["de", "fr", "it", "en"] as const)(
    "has no two organisations with the same label in %s",
    (lang) => {
      // organisation.name is set from the label (built like in Editor.tsx),
      // so two organisations with equal labels would be indistinguishable
      const labelToIds = new Map<string, Set<string>>();
      for (const o of all) {
        const label =
          o.name[lang] +
          (o.alternativeName ? ` (${o.alternativeName[lang]})` : "");
        labelToIds.set(label, (labelToIds.get(label) ?? new Set()).add(o.id));
      }
      const duplicates = [...labelToIds].filter(([, ids]) => ids.size > 1);
      expect(duplicates).toEqual([]);
    },
  );

  it("has one municipality group per canton", () => {
    const cantons = organisations.find(
      (g) => g.id === "https://ld.admin.ch/canton",
    );
    expect(municipalityGroups.map((g) => g.id).sort()).toEqual(
      cantons!.organisations.map((c) => `${c.id}/municipalities`).sort(),
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
