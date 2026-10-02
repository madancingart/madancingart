export const IMPORT_HEADERS = [
  "rodzaj",
  "imie",
  "nazwisko",
  "partner_imie",
  "partner_nazwisko",
  "opiekun",
  "email",
  "telefon",
  "kod_grupy",
  "oplacone_do",
  "kwota_zl",
  "metoda",
  "uwagi",
] as const;

export type ImportKind = "adult" | "pair" | "child";
export type ImportMethod = "onsite" | "transfer" | "legacy";

export type ImportDraft = {
  line: number;
  kind: ImportKind;
  firstName: string;
  lastName: string;
  partnerFirstName: string;
  partnerLastName: string;
  guardianName: string;
  email: string;
  phone: string;
  groupCode: string;
  paidUntil: string;
  amountCents: number;
  method: ImportMethod;
  note: string;
};

export type ImportPreviewStatus = "ok" | "link" | "error";

export type ImportPreviewRow = {
  line: number;
  status: ImportPreviewStatus;
  message: string;
  draft: ImportDraft | null;
};

const KIND_LABEL: Record<string, ImportKind> = {
  dorosly: "adult",
  dorosły: "adult",
  adult: "adult",
  para: "pair",
  pair: "pair",
  dziecko: "child",
  child: "child",
};

const METHOD_LABEL: Record<string, ImportMethod> = {
  gotowka: "onsite",
  gotówka: "onsite",
  onsite: "onsite",
  przelew: "transfer",
  transfer: "transfer",
  nieznana: "legacy",
  nieznana_kwota: "legacy",
  legacy: "legacy",
  "": "legacy",
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function zlotyToCents(value: string): number | null {
  const trimmed = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!trimmed) {
    return 0;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0"), 10);
  return Number.isFinite(cents) ? cents : null;
}

export function parseImportCsv(text: string): { error: string | null; drafts: ImportDraft[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const header = lines[0];
  if (!header) {
    return { error: "Plik jest pusty.", drafts: [] };
  }
  const columns = splitCsvLine(header).map((cell) => cell.toLowerCase());
  const missing = IMPORT_HEADERS.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    return { error: `Brak kolumn: ${missing.join(", ")}.`, drafts: [] };
  }
  const drafts: ImportDraft[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = splitCsvLine(lines[index] ?? "");
    const value = (name: (typeof IMPORT_HEADERS)[number]) =>
      cells[columns.indexOf(name)] ?? "";
    const kind = KIND_LABEL[value("rodzaj").toLowerCase()];
    const amountCents = zlotyToCents(value("kwota_zl"));
    const method = METHOD_LABEL[value("metoda").toLowerCase()];
    const paidUntil = value("oplacone_do").slice(0, 10);
    drafts.push({
      line: index + 1,
      kind: kind ?? "adult",
      firstName: value("imie"),
      lastName: value("nazwisko"),
      partnerFirstName: value("partner_imie"),
      partnerLastName: value("partner_nazwisko"),
      guardianName: value("opiekun"),
      email: value("email").toLowerCase(),
      phone: value("telefon"),
      groupCode: value("kod_grupy").toUpperCase(),
      paidUntil,
      amountCents: amountCents ?? -1,
      method: method ?? "legacy",
      note: value("uwagi"),
    });
    if (!kind || amountCents === null || !method || !/^\d{4}-\d{2}-\d{2}$/.test(paidUntil)) {
      drafts[drafts.length - 1] = {
        ...drafts[drafts.length - 1]!,
        amountCents: amountCents ?? -1,
        kind: kind ?? "adult",
        method: method ?? "legacy",
      };
    }
  }
  return { error: null, drafts };
}

export function previewImportRows(input: {
  drafts: ImportDraft[];
  groups: ReadonlyMap<string, { id: string; billingMode: "monthly" | "pass4" }>;
  emailsInUse: ReadonlySet<string>;
  enrolledKeys: ReadonlySet<string>;
}): ImportPreviewRow[] {
  const seen = new Set<string>();
  return input.drafts.map((draft) => {
    const problems: string[] = [];
    if (!draft.firstName || !draft.lastName) {
      problems.push("brak imienia lub nazwiska");
    }
    if (!draft.email.includes("@")) {
      problems.push("błędny e-mail");
    }
    if (!draft.phone) {
      problems.push("brak telefonu");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.paidUntil)) {
      problems.push("data opłacenia musi być RRRR-MM-DD");
    }
    if (draft.amountCents < 0) {
      problems.push("kwota musi być liczbą, zero gdy nieznana");
    }
    if (draft.kind === "pair" && (!draft.partnerFirstName || !draft.partnerLastName)) {
      problems.push("para potrzebuje imienia i nazwiska partnera");
    }
    if (draft.kind === "child" && !draft.guardianName) {
      problems.push("dziecko potrzebuje opiekuna");
    }
    const group = input.groups.get(draft.groupCode);
    if (!group) {
      problems.push("nieznany kod grupy");
    }
    const duplicateKey = `${draft.email}|${draft.groupCode}`;
    if (seen.has(duplicateKey)) {
      problems.push("powtórzony wiersz w pliku");
    }
    seen.add(duplicateKey);
    if (group && input.enrolledKeys.has(`${draft.email}|${group.id}`)) {
      problems.push("ta osoba jest już w tej grupie");
    }
    if (problems.length > 0) {
      return { line: draft.line, status: "error", message: problems.join(". "), draft };
    }
    if (input.emailsInUse.has(draft.email)) {
      return {
        line: draft.line,
        status: "link",
        message: "klient już istnieje — zostanie podpięty",
        draft,
      };
    }
    return { line: draft.line, status: "ok", message: "OK", draft };
  });
}
