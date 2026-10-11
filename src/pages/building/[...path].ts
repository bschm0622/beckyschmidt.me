import type { APIRoute } from "astro";

// An old projects section that has since been folded into the homepage. Permanent redirect so old links still land somewhere real.
export const prerender = false;

export const GET: APIRoute = ({ redirect }) => redirect("/", 301);
