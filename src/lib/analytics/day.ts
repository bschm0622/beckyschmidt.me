import { SITE } from "@/siteConfig";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: SITE.location.timeZone });

/** YYYY-MM-DD in the site's time zone, so a day matches Becky's calendar. */
export function siteDay(date: Date): string {
    return dayFormat.format(date);
}

/** The `count` days ending today, oldest first. */
export function lastDays(count: number, today = siteDay(new Date())): string[] {
    const end = new Date(`${today}T12:00:00Z`);
    return Array.from({ length: count }, (_, i) =>
        new Date(end.getTime() - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10),
    );
}
