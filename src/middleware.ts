import { defineMiddleware } from 'astro:middleware';

// The live site answers plain http too, where the browser never sends the Secure admin cookie,
// so admin looked signed out there. Send http visits to the live domain over to https.
export const onRequest = defineMiddleware((context, next) => {
  const url = new URL(context.request.url);
  if (!context.isPrerendered && url.protocol === 'http:' && url.hostname === context.site?.hostname) {
    url.protocol = 'https:';
    return Response.redirect(url, 301);
  }
  return next();
});
