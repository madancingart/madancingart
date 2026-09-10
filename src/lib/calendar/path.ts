export function calendarFeedPath(token: string): string {
  return `/api/calendar/${encodeURIComponent(token)}`;
}
