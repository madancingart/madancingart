import "server-only";

import { Resend } from "resend";
import { site } from "@/content/site";
import type { BookingTermSummary } from "@/lib/booking/term";

const FROM = "M&A Dancing Art <onboarding@resend.dev>";

export type BookingEmailPayload = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  message: string;
  danceType: string | null;
  kindLabel: string;
  term: BookingTermSummary;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  guardianName: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cell(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;color:#9A948A;font-size:13px;width:140px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:8px 0;color:#F5EFE4;font-size:15px;">${escapeHtml(value)}</td>
    </tr>`;
}

function wrap(inner: string): string {
  return `<!DOCTYPE html>
<html lang="pl">
  <body style="margin:0;padding:0;background:#0B0B0D;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B0B0D;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141417;border:1px solid #C9962E;">
            <tr>
              <td style="padding:28px 24px;font-family:Georgia,serif;color:#F5EFE4;">
                ${inner}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function clientHtml(payload: BookingEmailPayload, greetName: string): string {
  const { term } = payload;
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">Potwierdzenie zapisu</h1>
    <p style="margin:0 0 20px;color:#F5EFE4;line-height:1.5;">
      Cześć ${escapeHtml(greetName)}, przyjęliśmy Twój zapis. Oddzwonimy albo napiszemy, żeby dopiąć szczegóły.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${cell("Co", term.title)}
      ${cell("Gdzie", term.locationLine)}
      ${cell("Kiedy", term.when)}
    </table>
    <p style="margin:24px 0 0;color:#F5EFE4;line-height:1.5;">
      W razie pytań: <a href="tel:+48539143200" style="color:#C9962E;">539 143 200</a>
    </p>
    <p style="margin:24px 0 0;color:#9A948A;font-size:12px;line-height:1.5;">
      M&amp;A Dancing Art · Mikołów, ul. Świerkowa 3 · Lubliniec, ul. Oleska 85<br />
      ${escapeHtml(site.email)}
    </p>
  `);
}

function schoolHtml(payload: BookingEmailPayload): string {
  const { term } = payload;
  const rows = [
    cell("Termin", `${term.title} · ${term.when}`),
    cell("Sala", term.locationLine),
    cell("Rodzaj", payload.kindLabel),
    cell("Imię i nazwisko", `${payload.firstName} ${payload.lastName}`),
    cell("Telefon", payload.phone),
    cell("E-mail", payload.email),
  ];
  if (payload.partnerFirstName || payload.partnerLastName) {
    rows.splice(
      4,
      0,
      cell(
        "Partner",
        `${payload.partnerFirstName ?? ""} ${payload.partnerLastName ?? ""}`.trim(),
      ),
    );
  }
  if (payload.guardianName) {
    rows.splice(4, 0, cell("Rodzic / opiekun", payload.guardianName));
  }
  if (payload.danceType) {
    rows.push(cell("Typ zajęć", payload.danceType));
  }
  if (payload.message) {
    rows.push(cell("Wiadomość", payload.message));
  }

  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">NOWY ZAPIS</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">${escapeHtml(payload.firstName)} ${escapeHtml(payload.lastName)}</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows.join("")}
    </table>
  `);
}

function kindLabel(kind: "slot" | "class" | "event"): string {
  if (kind === "slot") {
    return "lekcja indywidualna";
  }
  if (kind === "event") {
    return "wydarzenie";
  }
  return "zajęcia grupowe";
}

export async function sendBookingEmails(input: {
  kind: "slot" | "class" | "event";
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  message: string;
  danceType: string | null;
  customerKind?: "adult" | "pair" | "child";
  partnerFirstName: string | null;
  partnerLastName: string | null;
  guardianName: string | null;
  term: BookingTermSummary;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Brak RESEND_API_KEY — pomijam wysyłkę maili po zapisie.");
    return;
  }

  const greetName =
    input.customerKind === "child" && input.guardianName
      ? (input.guardianName.split(" ")[0] ?? input.firstName)
      : input.firstName;

  const payload: BookingEmailPayload = {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    message: input.message,
    danceType: input.danceType,
    kindLabel: kindLabel(input.kind),
    term: input.term,
    partnerFirstName: input.partnerFirstName,
    partnerLastName: input.partnerLastName,
    guardianName: input.guardianName,
  };

  const resend = new Resend(apiKey);
  const results = await Promise.all([
    resend.emails.send({
      from: FROM,
      to: input.email,
      subject: "Potwierdzenie zapisu — M&A Dancing Art",
      html: clientHtml(payload, greetName),
    }),
    resend.emails.send({
      from: FROM,
      to: site.email,
      subject: `Nowy zapis: ${input.firstName} ${input.lastName} — ${input.term.when}`,
      html: schoolHtml(payload),
    }),
  ]);

  for (const result of results) {
    if (result.error) {
      console.error("Resend odrzucił wiadomość.", result.error);
    }
  }
}

export type PackageEmailPayload = {
  firstName: string;
  lastName: string;
  partnerFirstName: string;
  partnerLastName: string;
  phone: string;
  email: string;
  packageLabel: string;
  weddingDateLabel: string;
  songs: string[];
  paid: boolean;
};

function packageRows(payload: PackageEmailPayload): string {
  return [
    cell("Pakiet", payload.packageLabel),
    cell(
      "Para",
      `${payload.firstName} ${payload.lastName} i ${payload.partnerFirstName} ${payload.partnerLastName}`,
    ),
    cell("Telefon", payload.phone),
    cell("E-mail", payload.email),
    cell("Data wesela", payload.weddingDateLabel),
    cell("Piosenki", payload.songs.join(" · ") || "—"),
  ].join("");
}

function schoolPackageHtml(payload: PackageEmailPayload): string {
  const status = payload.paid ? "opłacony" : "oczekuje na płatność";
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">NOWY PAKIET</p>
    <h1 style="margin:0 0 8px;font-size:22px;color:#F5EFE4;">${escapeHtml(payload.packageLabel)}</h1>
    <p style="margin:0 0 20px;color:#9A948A;font-size:14px;">Status: ${escapeHtml(status)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${packageRows(payload)}
    </table>
  `);
}

function couplePackageHtml(payload: PackageEmailPayload): string {
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">Pakiet aktywny</h1>
    <p style="margin:0 0 20px;color:#F5EFE4;line-height:1.5;">
      Cześć ${escapeHtml(payload.firstName)} i ${escapeHtml(payload.partnerFirstName)},
      pakiet „${escapeHtml(payload.packageLabel)}” jest aktywny. Skontaktujemy się,
      by umówić pierwszą lekcję.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${packageRows(payload)}
    </table>
    <p style="margin:24px 0 0;color:#F5EFE4;line-height:1.5;">
      W razie pytań: <a href="tel:+48539143200" style="color:#C9962E;">${escapeHtml(site.phone)}</a>
    </p>
    <p style="margin:24px 0 0;color:#9A948A;font-size:12px;line-height:1.5;">
      M&amp;A Dancing Art · Mikołów, ul. Świerkowa 3 · Lubliniec, ul. Oleska 85<br />
      ${escapeHtml(site.email)}
    </p>
  `);
}

export async function sendNewPackageSchoolEmail(
  payload: PackageEmailPayload,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Brak RESEND_API_KEY — pomijam mail o nowym pakiecie.");
    return;
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: FROM,
    to: site.email,
    subject: `Nowy pakiet: ${payload.firstName} ${payload.lastName} — ${payload.packageLabel}`,
    html: schoolPackageHtml(payload),
  });
  if (result.error) {
    console.error("Resend odrzucił wiadomość o pakiecie.", result.error);
  }
}

export async function sendPackageActivatedCoupleEmail(
  payload: PackageEmailPayload,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Brak RESEND_API_KEY — pomijam mail aktywacji pakietu.");
    return;
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: FROM,
    to: payload.email,
    subject: "Pakiet aktywny — umówimy pierwszą lekcję | M&A Dancing Art",
    html: couplePackageHtml(payload),
  });
  if (result.error) {
    console.error("Resend odrzucił wiadomość aktywacji pakietu.", result.error);
  }
}
