import { visit } from 'unist-util-visit';
import sharp from 'sharp';

/**
 * Give markdown images that live in public/ their real width and height, so the
 * browser reserves their space and text doesn't jump when they load, and lazy-load
 * them. Images that aren't on disk (external URLs, not-yet-merged CMS uploads)
 * are left as they are.
 */
export function rehypeImageSize() {
    return async function (tree) {
        const jobs = [];
        visit(tree, 'element', (node) => {
            const src = node.tagName === 'img' && node.properties?.src;
            if (typeof src !== 'string' || !src.startsWith('/')) return;
            jobs.push(
                sharp(`public${decodeURI(src)}`)
                    .metadata()
                    .then(({ width, height }) => {
                        Object.assign(node.properties, { width, height, loading: 'lazy', decoding: 'async' });
                    })
                    .catch(() => {}),
            );
        });
        await Promise.all(jobs);
    };
}
