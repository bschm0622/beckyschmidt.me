import type { APIRoute } from "astro";

// A page from an earlier version of the site. Permanent redirect so old links still land somewhere real.
export const prerender = false;

export const GET: APIRoute = ({ redirect }) => redirect("/", 301);
