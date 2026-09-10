#!/usr/bin/env node
/**
 * Seed ~2000 klientów i zmierz wyszukiwanie (phone_norm, nazwisko).
 *
 *   CONFIRM=1 node scripts/seed-customers.mjs
 *   CONFIRM=1 CLEAN=1 node scripts/seed-customers.mjs   # usuń seed na końcu
 *
 * Wymaga SUPABASE_SERVICE_ROLE_KEY w .env.local.
 * Wiersze mają notes = SEED_PERF_TEST — nie używaj na produkcji bez CLEAN=1.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const MARKER = "SEED_PERF_TEST";
const COUNT = Number.parseInt(process.env.SEED_COUNT ?? "2000", 10);
const BATCH = 100;

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq < 0) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function elapsed(start) {
  return `${Date.now() - start} ms`;
}

async function main() {
  if (process.env.CONFIRM !== "1") {
    console.error("Ustaw CONFIRM=1 aby wstawić dane testowe.");
    process.exit(1);
  }

  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Brak NEXT_PUBLIC_SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = Array.from({ length: COUNT }, (_, index) => {
    const n = String(index).padStart(4, "0");
    const local = String(500_000_000 + index).slice(0, 9);
    return {
      kind: index % 17 === 0 ? "pair" : index % 11 === 0 ? "child" : "adult",
      first_name: index % 2 === 0 ? "Anna" : "Jan",
      last_name: `Testowska${n}`,
      partner_first_name: index % 17 === 0 ? "Piotr" : null,
      partner_last_name: index % 17 === 0 ? `Partner${n}` : null,
      guardian_name: index % 11 === 0 ? "Anna Opiekun" : null,
      guardian_phone: index % 11 === 0 ? `+48 512-345-${n.slice(-3)}` : null,
      phone: `+48 ${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`,
      email: `seed${n}@example.test`,
      notes: MARKER,
    };
  });

  console.log(`Wstawiam ${COUNT} klientów…`);
  const insertStart = Date.now();
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("customers").insert(chunk);
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
  }
  console.log(`Insert: ${elapsed(insertStart)}`);

  const queries = [
    {
      label: "nazwisko ilike Testowska0500 (customers_name_idx / seq)",
      run: () =>
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .ilike("last_name", "%Testowska0500%"),
    },
    {
      label: "phone_norm 512345 (customers_phone_idx btree, ilike %digits%)",
      run: () =>
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .ilike("phone_norm", "%512345%"),
    },
    {
      label: "or() jak lista /admin/klienci",
      run: () =>
        supabase
          .from("customers")
          .select("id", { count: "exact", head: true })
          .or(
            "last_name.ilike.%512 345%,first_name.ilike.%512 345%,email.ilike.%512 345%,phone.ilike.%512 345%,partner_first_name.ilike.%512 345%,partner_last_name.ilike.%512 345%,guardian_name.ilike.%512 345%,guardian_phone.ilike.%512 345%,phone_norm.ilike.%512345%",
          ),
    },
    {
      label: "ostatnio dodani order created_at limit 30",
      run: () =>
        supabase
          .from("customers")
          .select("id")
          .order("created_at", { ascending: false })
          .range(0, 29),
    },
  ];

  for (const query of queries) {
    const start = Date.now();
    const { error, count } = await query.run();
    if (error) {
      console.error(`${query.label}: ${error.message}`);
      continue;
    }
    console.log(
      `${query.label}: ${elapsed(start)}${count != null ? ` (count ${count})` : ""}`,
    );
  }

  console.log(
    "Indeksy 0006: customers_name_idx (lower last, first), customers_phone_idx (phone_norm), customers_email_idx.",
  );
  console.log(
    "ilike %fragment% na 2k wierszach to seq scan — oczekiwane i wystarczające. Prefiks lower(last_name) korzysta z btree przy sortowaniu listy.",
  );

  if (process.env.CLEAN === "1") {
    const { error } = await supabase.from("customers").delete().eq("notes", MARKER);
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    console.log("Usunięto wiersze SEED_PERF_TEST.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
