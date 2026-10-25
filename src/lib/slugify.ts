// Bundled into client components: never import astro:content or other server-only modules here.

export const slugifyStr = (str: string): string =>
    str
        .replace(/([a-z\d])([A-Z])/g, "$1-$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

export const slugifyAll = (arr: string[]): string[] => arr.map(slugifyStr);

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
