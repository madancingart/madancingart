"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { commitImportAction, previewImportAction } from "@/app/admin/(app)/rozliczenia/actions";
import type { ImportPreviewRow } from "@/lib/billing/import-csv";

export function ImportPreview({
  codes,
}: {
  codes: { code: string; label: string }[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ready = rows.filter((row) => row.status !== "error" && row.draft);

  return (
    <div className="flex flex-col gap-4">
      <a href="/admin/rozliczenia/import/szablon" className="text-[13px] text-gold hover:text-gold-light">
        Pobierz szablon CSV
      </a>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
          if (!file) {
            return;
          }
          setPending(true);
          void file.text().then((text) => previewImportAction(text)).then((result) => {
            setPending(false);
            if (!result.ok) {
              setRows([]);
              setMessage(result.error);
              return;
            }
            setRows(result.rows);
            setMessage(null);
          });
        }}
      >
        <input name="file" type="file" accept=".csv,text/csv" required className="text-[13px] text-cream" />
        <Button type="submit" size="sm" disabled={pending}>
          Sprawdź plik
        </Button>
      </form>

      <section className="border border-white/10 p-3">
        <h2 className="text-[13px] text-cream">Kody grup</h2>
        <ul className="mt-2 max-h-48 overflow-auto text-[12px] text-muted">
          {codes.map((item) => (
            <li key={item.code}>
              {item.code} · {item.label}
            </li>
          ))}
        </ul>
      </section>

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-2 py-2 font-normal">Wiersz</th>
                <th className="px-2 py-2 font-normal">Wynik</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.line} className="border-t border-white/10">
                  <td className="px-2 py-2 text-cream">{row.line}</td>
                  <td className="px-2 py-2 text-muted">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={pending || ready.length === 0 || ready.length !== rows.length}
            onClick={() => {
              setPending(true);
              void commitImportAction(ready.flatMap((row) => (row.draft ? [row.draft] : []))).then((result) => {
                setPending(false);
                setMessage(result.ok ? result.message : result.error);
                if (result.ok) {
                  setRows([]);
                  router.refresh();
                }
              });
            }}
          >
            Importuj {ready.length} wierszy
          </Button>
        </div>
      ) : null}
      {message ? <p className="text-[13px] text-muted">{message}</p> : null}
    </div>
  );
}
