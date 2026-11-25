import * as fs from "fs";

// Prints a markdown summary of the differences between two organisations.json files.
// Used by .github/workflows/update-organisations.yml for the pull request description.
// Usage: tsx src/app/data/diffOrganisations.ts <old.json> <new.json>

type Name = Partial<Record<"de" | "fr" | "it" | "en", string>>;
type Group = {
  id: string;
  name: Name;
  organisations: { id: string; name: Name; alternativeName?: Name }[];
};

const read = (file: string): Map<string, { group: string; label: string }> => {
  const groups: Group[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  return new Map(
    groups.flatMap((g) =>
      g.organisations.map((o) => [
        o.id,
        { group: g.name.de ?? g.id, label: JSON.stringify(o) },
      ]),
    ),
  );
};

const MAX_ENTRIES = 100;

const [oldFile, newFile] = process.argv.slice(2);
const before = read(oldFile);
const after = read(newFile);
const name = (label: string) => {
  const o = JSON.parse(label);
  return o.name.de ?? Object.values(o.name)[0];
};

const removed = [...before].filter(([id]) => !after.has(id));
const added = [...after].filter(([id]) => !before.has(id));
const changed = [...after].filter(
  ([id, o]) =>
    before.has(id) &&
    (before.get(id)!.label !== o.label || before.get(id)!.group !== o.group),
);

const section = (
  title: string,
  entries: [string, { group: string; label: string }][],
  describe: (id: string, o: { group: string; label: string }) => string,
) => {
  if (entries.length === 0) return;
  console.log(`### ${title} (${entries.length})\n`);
  // keep the pull request description below GitHub's size limit
  for (const [id, o] of entries.slice(0, MAX_ENTRIES)) {
    console.log(`- ${describe(id, o)}`);
  }
  if (entries.length > MAX_ENTRIES) {
    console.log(`- … and ${entries.length - MAX_ENTRIES} more`);
  }
  console.log();
};

section(
  "Removed",
  removed,
  (id, o) => `${name(o.label)} (${o.group}) \`${id}\``,
);
section("Added", added, (id, o) => `${name(o.label)} (${o.group}) \`${id}\``);
section("Changed", changed, (id, o) => {
  const old = before.get(id)!;
  const from = `${name(old.label)} (${old.group})`;
  const to = `${name(o.label)} (${o.group})`;
  return from === to
    ? `${to} \`${id}\`: translations or abbreviation changed`
    : `${from} → ${to} \`${id}\``;
});

if (removed.length + added.length + changed.length === 0) {
  console.log("No organisation was added, removed or changed.");
}
