const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function formatDate(d: Date | null | undefined) {
  return d ? DATE.format(d) : "—";
}

export function daysSince(d: Date, now = new Date()) {
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000));
}
