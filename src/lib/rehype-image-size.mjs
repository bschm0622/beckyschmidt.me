import { visit } from 'unist-util-visit';
import sharp from 'sharp';

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
