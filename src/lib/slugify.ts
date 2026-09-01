/**
 * Client-safe string/date helpers.
 *
 * IMPORTANT: keep this module free of `astro:content` (and other server-only)
 * imports — it is bundled into client components (see CommandPalette.tsx).
 * Server code should import these via `@/lib/notes`, which re-exports them.
 */

/** Kebab-case slugify (dependency-free replacement for lodash.kebabcase). */
export const slugifyStr = (str: string): string =>
    str
        .replace(/([a-z\d])([A-Z])/g, "$1-$2") // camelCase → camel-Case
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // ABCDef → ABC-Def
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics → single dash
        .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes

export const slugifyAll = (arr: string[]): string[] => arr.map(slugifyStr);

/**
 * Format a date as "MMM D, YYYY" (e.g. "Aug 20, 2026"), or "MMM YYYY"
 * (e.g. "Aug 2026") with `variant: "month-year"` for compact contexts.
 * - `Date` inputs are read as UTC calendar dates (no timezone shift).
 * - String inputs must be ISO "YYYY-MM-DD" and are parsed as local midnight.
 */
export function formatDate(
    date: Date | string,
    variant: "full" | "month-year" = "full"
): string {
    const localDate =
        typeof date === "string"
            ? new Date(`${date}T00:00:00`)
            : new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

    return localDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        ...(variant === "full" && { day: "numeric" }),
    });
}
