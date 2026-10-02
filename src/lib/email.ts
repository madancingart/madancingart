import "server-only";

import { Resend } from "resend";
import { site } from "@/content/site";
import { ONSITE_LINE, PAY_BUTTON_LABEL } from "@/lib/billing/notices";
import { formatBillingZloty } from "@/lib/billing/status";
import { chunkItems, RESEND_BATCH_SIZE } from "@/lib/mail/batch";
import { publicSiteUrl } from "@/lib/booking/confirmation-window";
import { formatDayMonth } from "@/lib/datetime";
import type { BookingTermSummary } from "@/lib/booking/term";

const FROM = "M&A Dancing Art <onboarding@resend.dev>";
const BILLING_FROM = "M&A Dancing Art <rezerwacje@madancing.art>";

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

export type SlotReminderEmailPayload = {
  firstName: string;
  confirmUrl: string;
  when: string;
  locationLine: string;
};

function reminderHtml(payload: SlotReminderEmailPayload): string {
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">Potwierdź swój termin</h1>
    <p style="margin:0 0 20px;color:#F5EFE4;line-height:1.5;">
      Cześć ${escapeHtml(payload.firstName)}, zbliża się Twoja lekcja. Potwierdź proszę obecność,
      klikając przycisk poniżej.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${cell("Kiedy", payload.when)}
      ${cell("Gdzie", payload.locationLine)}
    </table>
    <p style="margin:28px 0;">
      <a href="${escapeHtml(payload.confirmUrl)}"
        style="display:inline-block;padding:12px 22px;background:linear-gradient(135deg,#8C6516,#C9962E 45%,#F0D080 70%,#C9962E);color:#0B0B0D;text-decoration:none;font-size:15px;">
        Potwierdź termin
      </a>
    </p>
    <p style="margin:0;color:#F5EFE4;line-height:1.5;">
      W razie przeszkód prosimy o telefon:
      <a href="tel:+48539143200" style="color:#C9962E;">${escapeHtml(site.phone)}</a>
    </p>
    <p style="margin:24px 0 0;color:#9A948A;font-size:12px;line-height:1.5;">
      M&amp;A Dancing Art · Mikołów, ul. Świerkowa 3 · Lubliniec, ul. Oleska 85<br />
      ${escapeHtml(site.email)}
    </p>
  `);
}

function releasedHtml(payload: {
  firstName: string;
  when: string;
  locationLine: string;
}): string {
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">Termin zwolniony</h1>
    <p style="margin:0 0 20px;color:#F5EFE4;line-height:1.5;">
      Cześć ${escapeHtml(payload.firstName)}, nie otrzymaliśmy potwierdzenia obecności,
      więc zwolniliśmy Twój termin, żeby ktoś inny mógł z niego skorzystać.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${cell("Kiedy", payload.when)}
      ${cell("Gdzie", payload.locationLine)}
    </table>
    <p style="margin:24px 0 0;color:#F5EFE4;line-height:1.5;">
      Chcesz umówić się ponownie? Zadzwoń:
      <a href="tel:+48539143200" style="color:#C9962E;">${escapeHtml(site.phone)}</a>
    </p>
    <p style="margin:24px 0 0;color:#9A948A;font-size:12px;line-height:1.5;">
      M&amp;A Dancing Art · Mikołów, ul. Świerkowa 3 · Lubliniec, ul. Oleska 85<br />
      ${escapeHtml(site.email)}
    </p>
  `);
}

async function sendHtmlMail(input: {
  to: string;
  subject: string;
  html: string;
  missingKeyLog: string;
  from?: string;
  replyTo?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(input.missingKeyLog);
    return false;
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: input.from ?? FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });
  if (result.error) {
    console.error("Resend odrzucił wiadomość.", result.error);
    return false;
  }
  return true;
}

export async function sendBillingNoticeEmail(input: {
  to: string;
  subject: string;
  text: string;
  participantLine: string | null;
  payUrl: string | null;
}): Promise<boolean> {
  const participant = input.participantLine
    ? `<p style="margin:0 0 16px;color:#F5EFE4;line-height:1.5;">${escapeHtml(input.participantLine)}</p>`
    : "";
  const button = input.payUrl
    ? `<p style="margin:0 0 20px;"><a href="${escapeHtml(input.payUrl)}" style="display:inline-block;background:#C9962E;color:#0B0B0D;text-decoration:none;padding:12px 22px;font-size:15px;">${escapeHtml(PAY_BUTTON_LABEL)}</a></p>`
    : "";
  return sendHtmlMail({
    to: input.to,
    subject: input.subject,
    html: wrap(`
      <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
      <p style="margin:0 0 16px;color:#F5EFE4;line-height:1.5;">${escapeHtml(input.text)}</p>
      ${participant}
      ${button}
      <p style="margin:0;color:#9A948A;line-height:1.5;">${escapeHtml(ONSITE_LINE)}</p>
    `),
    missingKeyLog: "Brak RESEND_API_KEY — pomijam mail rozliczeniowy.",
    from: BILLING_FROM,
    replyTo: site.email,
  });
}

export async function sendSchoolNoticeEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const paragraphs = input.text
    .split("\n")
    .map(
      (line) =>
        `<p style="margin:0 0 8px;color:#F5EFE4;line-height:1.5;">${line ? escapeHtml(line) : "&nbsp;"}</p>`,
    )
    .join("");
  return sendHtmlMail({
    to: input.to,
    subject: input.subject,
    html: wrap(`
      <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
      ${paragraphs}
    `),
    missingKeyLog: "Brak RESEND_API_KEY — pomijam mail do szkoły.",
    from: BILLING_FROM,
    replyTo: site.email,
  });
}

export async function sendSlotConfirmationReminderEmail(
  payload: SlotReminderEmailPayload & { email: string },
): Promise<boolean> {
  return sendHtmlMail({
    to: payload.email,
    subject: "Potwierdź swój termin — M&A Dancing Art",
    html: reminderHtml(payload),
    missingKeyLog:
      "Brak RESEND_API_KEY — pomijam przypomnienie o potwierdzeniu.",
  });
}

export async function sendSlotReleasedEmail(payload: {
  email: string;
  firstName: string;
  when: string;
  locationLine: string;
}): Promise<boolean> {
  return sendHtmlMail({
    to: payload.email,
    subject: "Termin zwolniony — M&A Dancing Art",
    html: releasedHtml(payload),
    missingKeyLog: "Brak RESEND_API_KEY — pomijam mail o zwolnieniu terminu.",
  });
}

function movedHtml(payload: {
  firstName: string;
  fromWhen: string;
  fromLocation: string;
  toWhen: string;
  toLocation: string;
  confirmUrl: string;
}): string {
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">Zmiana terminu</h1>
    <p style="margin:0 0 20px;color:#F5EFE4;line-height:1.5;">
      Cześć ${escapeHtml(payload.firstName)}, przenieśliśmy Twoją lekcję na inny termin.
      Potwierdź proszę nowy termin, klikając przycisk poniżej.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${cell("Z", `${payload.fromWhen} · ${payload.fromLocation}`)}
      ${cell("Na", `${payload.toWhen} · ${payload.toLocation}`)}
    </table>
    <p style="margin:28px 0;">
      <a href="${escapeHtml(payload.confirmUrl)}"
        style="display:inline-block;padding:12px 22px;background:linear-gradient(135deg,#8C6516,#C9962E 45%,#F0D080 70%,#C9962E);color:#0B0B0D;text-decoration:none;font-size:15px;">
        Potwierdź nowy termin
      </a>
    </p>
    <p style="margin:0;color:#F5EFE4;line-height:1.5;">
      W razie pytań:
      <a href="tel:+48539143200" style="color:#C9962E;">${escapeHtml(site.phone)}</a>
    </p>
    <p style="margin:24px 0 0;color:#9A948A;font-size:12px;line-height:1.5;">
      M&amp;A Dancing Art · Mikołów, ul. Świerkowa 3 · Lubliniec, ul. Oleska 85<br />
      ${escapeHtml(site.email)}
    </p>
  `);
}

function schoolCancelledSlotHtml(payload: {
  firstName: string;
  when: string;
  locationLine: string;
  grafikUrl: string;
}): string {
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">Odwołanie lekcji</h1>
    <p style="margin:0 0 20px;color:#F5EFE4;line-height:1.5;">
      Cześć ${escapeHtml(payload.firstName)}, bardzo nam przykro — musieliśmy odwołać
      Twoją lekcję. Zapraszamy do grafiku, żeby wybrać nowy termin.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${cell("Kiedy", payload.when)}
      ${cell("Gdzie", payload.locationLine)}
    </table>
    <p style="margin:28px 0;">
      <a href="${escapeHtml(payload.grafikUrl)}"
        style="display:inline-block;padding:12px 22px;background:linear-gradient(135deg,#8C6516,#C9962E 45%,#F0D080 70%,#C9962E);color:#0B0B0D;text-decoration:none;font-size:15px;">
        Otwórz grafik
      </a>
    </p>
    <p style="margin:0;color:#F5EFE4;line-height:1.5;">
      Telefon:
      <a href="tel:+48539143200" style="color:#C9962E;">${escapeHtml(site.phone)}</a>
    </p>
    <p style="margin:24px 0 0;color:#9A948A;font-size:12px;line-height:1.5;">
      M&amp;A Dancing Art · Mikołów, ul. Świerkowa 3 · Lubliniec, ul. Oleska 85<br />
      ${escapeHtml(site.email)}
    </p>
  `);
}

function classCancelledHtml(payload: {
  title: string;
  when: string;
  locationLine: string;
  reason: string | null;
}): string {
  const reasonBlock = payload.reason
    ? cell("Powód", payload.reason)
    : "";
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">Odwołane zajęcia</h1>
    <p style="margin:0 0 20px;color:#F5EFE4;line-height:1.5;">
      Odwołujemy zajęcia „${escapeHtml(payload.title)}”. Lekcję będzie można odrobić —
      zadzwoń lub napisz, umówimy inny termin.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${cell("Kiedy", payload.when)}
      ${cell("Gdzie", payload.locationLine)}
      ${reasonBlock}
    </table>
    <p style="margin:24px 0 0;color:#F5EFE4;line-height:1.5;">
      Telefon:
      <a href="tel:+48539143200" style="color:#C9962E;">${escapeHtml(site.phone)}</a>
    </p>
    <p style="margin:24px 0 0;color:#9A948A;font-size:12px;line-height:1.5;">
      M&amp;A Dancing Art · Mikołów, ul. Świerkowa 3 · Lubliniec, ul. Oleska 85<br />
      ${escapeHtml(site.email)}
    </p>
  `);
}

export async function sendSlotMovedEmail(payload: {
  email: string;
  firstName: string;
  fromWhen: string;
  fromLocation: string;
  toWhen: string;
  toLocation: string;
  confirmUrl: string;
}): Promise<boolean> {
  return sendHtmlMail({
    to: payload.email,
    subject: "Zmiana terminu lekcji — M&A Dancing Art",
    html: movedHtml(payload),
    missingKeyLog: "Brak RESEND_API_KEY — pomijam mail o przeniesieniu terminu.",
  });
}

export async function sendSlotCancelledBySchoolEmail(payload: {
  email: string;
  firstName: string;
  when: string;
  locationLine: string;
}): Promise<boolean> {
  return sendHtmlMail({
    to: payload.email,
    subject: "Odwołanie lekcji — M&A Dancing Art",
    html: schoolCancelledSlotHtml({
      ...payload,
      grafikUrl: `${publicSiteUrl()}/grafik`,
    }),
    missingKeyLog: "Brak RESEND_API_KEY — pomijam mail o odwołaniu lekcji.",
  });
}

export async function sendClassSessionCancelledEmails(input: {
  emails: string[];
  title: string;
  when: string;
  locationLine: string;
  reason: string | null;
}): Promise<number> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Brak RESEND_API_KEY — pomijam maile o odwołaniu zajęć.");
    return 0;
  }
  const html = classCancelledHtml({
    title: input.title,
    when: input.when,
    locationLine: input.locationLine,
    reason: input.reason,
  });
  const resend = new Resend(apiKey);
  let sent = 0;
  for (const chunk of chunkItems(input.emails, RESEND_BATCH_SIZE)) {
    const result = await resend.batch.send(
      chunk.map((email) => ({
        from: FROM,
        to: email,
        subject: `Odwołane zajęcia: ${input.title} — M&A Dancing Art`,
        html,
      })),
    );
    if (result.error) {
      console.error("Resend odrzucił paczkę maili o odwołaniu zajęć.", result.error);
      continue;
    }
    sent += chunk.length;
  }
  return sent;
}

export type ContactEmailInput = {
  name: string;
  phone: string;
  email: string;
  topic: string;
  message: string;
};

function contactSchoolHtml(input: ContactEmailInput): string {
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">FORMULARZ KONTAKTU</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">${escapeHtml(input.topic)}</h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${cell("Imię", input.name)}
      ${cell("Telefon", input.phone || "—")}
      ${cell("E-mail", input.email || "—")}
      ${cell("Temat", input.topic)}
      ${cell("Wiadomość", input.message)}
    </table>
  `);
}

function contactClientHtml(input: ContactEmailInput): string {
  return wrap(`
    <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
    <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">Dostaliśmy wiadomość</h1>
    <p style="margin:0 0 16px;color:#F5EFE4;line-height:1.5;">
      Cześć ${escapeHtml(input.name)}, odezwiemy się w sprawie: ${escapeHtml(input.topic)}.
    </p>
    <p style="margin:0;color:#F5EFE4;line-height:1.5;">
      Jeśli to pilne, zadzwoń:
      <a href="tel:+48539143200" style="color:#C9962E;">${escapeHtml(site.phone)}</a>
    </p>
  `);
}

export async function sendAccountDeletionRequestEmail(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  userId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Brak RESEND_API_KEY — nie wysyłam prośby o usunięcie konta.");
    return { ok: false, error: "Wysyłka maili jest chwilowo niedostępna." };
  }

  const resend = new Resend(apiKey);
  const school = await resend.emails.send({
    from: FROM,
    to: site.email,
    replyTo: input.email || undefined,
    subject: `Prośba o usunięcie konta — ${input.firstName} ${input.lastName}`,
    html: wrap(`
      <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">KONTO KLIENTA</p>
      <h1 style="margin:0 0 20px;font-size:22px;color:#F5EFE4;">Prośba o usunięcie konta</h1>
      <p style="margin:0 0 16px;color:#F5EFE4;line-height:1.5;">
        Klient prosi o anonimizację konta. Usunięcie wykonuje administrator.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${cell("Imię", `${input.firstName} ${input.lastName}`)}
        ${cell("E-mail", input.email || "—")}
        ${cell("Telefon", input.phone || "—")}
        ${cell("Id konta", input.userId)}
      </table>
    `),
  });

  if (school.error) {
    console.error("Resend odrzucił prośbę o usunięcie konta.", school.error);
    return { ok: false, error: "Nie udało się wysłać wiadomości." };
  }

  return { ok: true };
}

export async function sendContactEmails(
  input: ContactEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Brak RESEND_API_KEY — nie wysyłam formularza kontaktowego.");
    return {
      ok: false,
      error: "Wysyłka maili jest chwilowo niedostępna.",
    };
  }

  const resend = new Resend(apiKey);
  const school = await resend.emails.send({
    from: FROM,
    to: site.email,
    replyTo: input.email || undefined,
    subject: `Kontakt: ${input.topic} — ${input.name}`,
    html: contactSchoolHtml(input),
  });

  if (school.error) {
    console.error("Resend odrzucił wiadomość kontaktową.", school.error);
    return { ok: false, error: "Nie udało się wysłać wiadomości." };
  }

  if (input.email) {
    const client = await resend.emails.send({
      from: FROM,
      to: input.email,
      subject: "Dostaliśmy Twoją wiadomość — M&A Dancing Art",
      html: contactClientHtml(input),
    });
    if (client.error) {
      console.error("Resend odrzucił potwierdzenie dla klienta.", client.error);
    }
  }

  return { ok: true };
}

export async function sendChargePaidEmail(input: {
  email: string;
  firstName: string;
  amountCents: number;
  lines: string[];
  paidUntil: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !input.email) {
    return;
  }
  const until = input.paidUntil
    ? `Zajęcia opłacone do ${formatDayMonth(input.paidUntil)}.`
    : "Karnet jest aktywny.";
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: "Dziękujemy — wpłata zaksięgowana",
    html: wrap(`
      <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:#F5EFE4;">Dziękujemy — wpłata zaksięgowana</h1>
      <p style="margin:0 0 12px;color:#F5EFE4;line-height:1.5;">Cześć ${escapeHtml(input.firstName)},</p>
      <p style="margin:0 0 12px;color:#F5EFE4;line-height:1.5;">Kwota: ${escapeHtml(formatBillingZloty(input.amountCents))}.</p>
      <p style="margin:0 0 12px;color:#F5EFE4;line-height:1.5;">Za co: ${escapeHtml(input.lines.join(". "))}.</p>
      <p style="margin:0;color:#F5EFE4;line-height:1.5;">${escapeHtml(until)}</p>
    `),
  });
  if (result.error) {
    console.error("Mail o zaksięgowanej wpłacie nie wyszedł.", result.error);
  }
}

export async function sendVoidChargeReviewEmail(input: {
  amountCents: number;
  label: string;
  stripeUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return;
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: FROM,
    to: site.email,
    subject: "Wpłata na anulowaną należność — sprawdź i ewentualnie zwróć",
    html: wrap(`
      <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:#F5EFE4;">Wpłata na anulowaną należność — sprawdź i ewentualnie zwróć</h1>
      <p style="margin:0 0 12px;color:#F5EFE4;line-height:1.5;">${escapeHtml(formatBillingZloty(input.amountCents))} — ${escapeHtml(input.label)}</p>
      <p style="margin:0;color:#F5EFE4;line-height:1.5;"><a href="${escapeHtml(input.stripeUrl)}" style="color:#C9962E;">Płatność w Stripe</a></p>
    `),
  });
  if (result.error) {
    console.error("Mail o wpłacie na anulowaną należność nie wyszedł.", result.error);
  }
}

export async function sendChargePaymentFailedEmail(input: {
  email: string;
  firstName: string;
  retryUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !input.email) {
    return;
  }
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: "Płatność nie doszła — spróbuj ponownie",
    html: wrap(`
      <p style="margin:0 0 4px;color:#C9962E;font-size:13px;letter-spacing:0.12em;">M&amp;A DANCING ART</p>
      <h1 style="margin:0 0 16px;font-size:22px;color:#F5EFE4;">Płatność nie doszła</h1>
      <p style="margin:0 0 12px;color:#F5EFE4;line-height:1.5;">Cześć ${escapeHtml(input.firstName)}, bank nie potwierdził wpłaty.</p>
      <p style="margin:0;color:#F5EFE4;line-height:1.5;"><a href="${escapeHtml(input.retryUrl)}" style="color:#C9962E;">Spróbuj ponownie</a></p>
    `),
  });
  if (result.error) {
    console.error("Mail o nieudanej płatności nie wyszedł.", result.error);
  }
}
