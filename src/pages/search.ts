import type { APIRoute } from "astro";

// Search used to be its own page; it's now the ⌘K palette on every page. Permanent redirect so old links still land somewhere real.
export const prerender = false;

export const GET: APIRoute = ({ redirect }) => redirect("/", 301);
