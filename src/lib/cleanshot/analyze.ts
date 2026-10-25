import { MATCH_FALLBACK, type Background } from "./backgrounds";
import type { Crop } from "./render";

const SAMPLE = 512;
const MAX_TRIM = 0.15;
const TOLERANCE = 10;

export interface Analysis {
    crop: Crop;
    match: Background;
    dark: boolean;
}

export function analyze(image: CanvasImageSource, width: number, height: number): Analysis {
    const s = Math.min(1, SAMPLE / Math.max(width, height));
    const w = Math.max(1, Math.round(width * s));
    const h = Math.max(1, Math.round(height * s));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;

    return {
        crop: trim(px, w, h, s, width, height),
        match: matchGradient(px),
        dark: averageLuminance(px) < 0.4,
    };
}

function trim(px: Uint8ClampedArray, w: number, h: number, s: number, fullW: number, fullH: number): Crop {
    const at = (x: number, y: number) => (y * w + x) * 4;
    const corner = at(0, 0);
    const ref = [px[corner], px[corner + 1], px[corner + 2], px[corner + 3]];
    const same = (i: number) =>
        Math.abs(px[i] - ref[0]) <= TOLERANCE &&
        Math.abs(px[i + 1] - ref[1]) <= TOLERANCE &&
        Math.abs(px[i + 2] - ref[2]) <= TOLERANCE &&
        Math.abs(px[i + 3] - ref[3]) <= TOLERANCE;
    const rowSame = (y: number) => {
        for (let x = 0; x < w; x++) if (!same(at(x, y))) return false;
        return true;
    };
    const colSame = (x: number) => {
        for (let y = 0; y < h; y++) if (!same(at(x, y))) return false;
        return true;
    };

    const maxX = Math.floor(w * MAX_TRIM);
    const maxY = Math.floor(h * MAX_TRIM);
    let top = 0;
    while (top < maxY && rowSame(top)) top++;
    let bottom = 0;
    while (bottom < maxY && rowSame(h - 1 - bottom)) bottom++;
    let left = 0;
    while (left < maxX && colSame(left)) left++;
    let right = 0;
    while (right < maxX && colSame(w - 1 - right)) right++;

    if (top + bottom >= h - 2 || left + right >= w - 2) return { x: 0, y: 0, w: fullW, h: fullH };

    const x = Math.round(left / s);
    const y = Math.round(top / s);
    return {
        x,
        y,
        w: Math.max(1, Math.round(fullW - right / s) - x),
        h: Math.max(1, Math.round(fullH - bottom / s) - y),
    };
}

function matchGradient(px: Uint8ClampedArray): Background {
    const BUCKETS = 24;
    const weight = new Float64Array(BUCKETS);
    const sum = Array.from({ length: BUCKETS }, () => [0, 0, 0]);

    for (let i = 0; i < px.length; i += 16) {
        if (px[i + 3] < 200) continue;
        const [hue, sat, light] = rgbToHsl(px[i], px[i + 1], px[i + 2]);
        if (sat < 0.3 || light < 0.15 || light > 0.9) continue;
        const b = Math.floor((hue / 360) * BUCKETS) % BUCKETS;
        const wgt = sat;
        weight[b] += wgt;
        sum[b][0] += hue * wgt;
        sum[b][1] += sat * wgt;
        sum[b][2] += light * wgt;
    }

    const ranked = [...weight.keys()].filter((b) => weight[b] > 0).sort((a, b) => weight[b] - weight[a]);
    const total = ranked.reduce((t, b) => t + weight[b], 0);
    if (ranked.length === 0 || total < 20) return MATCH_FALLBACK;

    const color = (b: number) => {
        const w = weight[b];
        return [sum[b][0] / w, sum[b][1] / w, sum[b][2] / w] as const;
    };
    const first = color(ranked[0]);
    const secondBucket = ranked.find((b) => hueDistance(color(b)[0], first[0]) >= 30 && weight[b] > total * 0.04);
    const second = secondBucket !== undefined ? color(secondBucket) : ([(first[0] + 40) % 360, first[1], first[2]] as const);

    const tune = ([h, s]: readonly [number, number, number], l: number) =>
        hslToHex(h, Math.min(0.85, Math.max(0.55, s)), l);
    return {
        kind: "linear",
        colors: [tune(first, 0.62), tune(second, 0.58)],
        angle: 135,
        grain: true,
    };
}

function averageLuminance(px: Uint8ClampedArray) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < px.length; i += 16) {
        sum += (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
        n++;
    }
    return n ? sum / n : 1;
}

function hueDistance(a: number, b: number) {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}
