import type { APIRoute } from "astro";

// The notes section used to live at /blog. Permanent redirect so old links still land somewhere real.
export const prerender = false;

export const GET: APIRoute = ({ redirect }) => redirect("/notes/", 301);
