import type { Background } from "./backgrounds";

export interface SizePreset {
    id: string;
    label: string;
    use: string;
    width: number | null;
    height: number | null;
}

export const SIZES: SizePreset[] = [
    { id: "auto", label: "Auto", use: "Fits the screenshot", width: null, height: null },
    { id: "16x9", label: "16:9", use: "X and LinkedIn", width: 1200, height: 675 },
    { id: "1x1", label: "1:1", use: "Square", width: 1080, height: 1080 },
    { id: "4x5", label: "4:5", use: "Instagram", width: 1080, height: 1350 },
    { id: "191x1", label: "1.91:1", use: "Link card", width: 1200, height: 628 },
];

export interface Choice {
    id: string;
    label: string;
}

export const PADDINGS = { none: 0, s: 0.03, m: 0.06, l: 0.1 } as const;
export const RADII = { none: 0, s: 0.006, m: 0.013, l: 0.026 } as const;
export const SHADOWS = {
    none: null,
    soft: { blur: 0.045, y: 0.018, alpha: 0.28 },
    medium: { blur: 0.07, y: 0.03, alpha: 0.38 },
    strong: { blur: 0.11, y: 0.05, alpha: 0.5 },
} as const;
export const FRAMES = ["none", "outline", "window"] as const;

export type Padding = keyof typeof PADDINGS;
export type Radius = keyof typeof RADII;
export type Shadow = keyof typeof SHADOWS;
export type Frame = (typeof FRAMES)[number];

export const PADDING_CHOICES: Choice[] = [
    { id: "none", label: "None" },
    { id: "s", label: "S" },
    { id: "m", label: "M" },
    { id: "l", label: "L" },
];
export const RADIUS_CHOICES: Choice[] = PADDING_CHOICES;
export const SHADOW_CHOICES: Choice[] = [
    { id: "none", label: "None" },
    { id: "soft", label: "Soft" },
    { id: "medium", label: "Medium" },
    { id: "strong", label: "Strong" },
];
export const FRAME_CHOICES: Choice[] = [
    { id: "none", label: "None" },
    { id: "outline", label: "Outline" },
    { id: "window", label: "Window" },
];

export const DEFAULT_SIZE = "16x9";
export const MAX_SIDE = 8192;

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export type Crop = Rect;

export interface RenderState {
    background: Background;
    size: SizePreset;
    padding: Padding;
    radius: Radius;
    shadow: Shadow;
    frame: Frame;
    dark: boolean;
    annotations?: Annotation[];
    unit?: number;
    font?: string;
    skip?: number;
}

export const ANNOTATION_COLORS = {
    red: "#ef4444",
    yellow: "#facc15",
    blue: "#3b82f6",
    green: "#22c55e",
    black: "#1c1917",
    white: "#ffffff",
} as const;
export type AnnotationColor = keyof typeof ANNOTATION_COLORS;

export type Annotation =
    | { kind: "arrow"; x1: number; y1: number; x2: number; y2: number; color: string }
    | { kind: "text"; x: number; y: number; text: string; color: string };

export function annotationUnit(imageW: number, imageH: number) {
    return Math.max(imageW, imageH) / 1000;
}
export const arrowWidth = (unit: number) => Math.max(2, unit * 4);
export const textSize = (unit: number) => Math.max(14, unit * 28);
export const textFont = (sizePx: number, family: string) => `600 ${sizePx}px ${family}`;

const BAR = 0.04;

function contentSize(state: RenderState, crop: Crop) {
    const bar = state.frame === "window" ? Math.round(crop.w * BAR) : 0;
    return { w: crop.w, h: crop.h + bar, bar };
}

export function baseSize(state: RenderState, crop: Crop): { width: number; height: number } {
    const { size } = state;
    if (size.width && size.height) return { width: size.width, height: size.height };
    // Captures wider than 1600px are treated as 2× so the canvas stays a sane size.
    const c = contentSize(state, crop);
    const shrink = c.w > 1600 ? 0.5 : 1;
    const p = PADDINGS[state.padding];
    const w = c.w * shrink;
    const h = c.h * shrink;
    const pad = Math.round((w / (1 - 2 * p)) * p);
    return { width: Math.round(w + pad * 2), height: Math.round(h + pad * 2) };
}

export function exportScale(state: RenderState, crop: Crop, wanted: number): { scale: number; clamped: boolean } {
    const { width, height } = baseSize(state, crop);
    const max = MAX_SIDE / Math.max(width, height);
    return wanted > max ? { scale: max, clamped: true } : { scale: wanted, clamped: false };
}

export function layout(state: RenderState, crop: Crop, W: number, H: number) {
    const c = contentSize(state, crop);
    const pad = W * PADDINGS[state.padding];
    const fit = Math.min((W - pad * 2) / c.w, (H - pad * 2) / c.h);
    const fw = c.w * fit;
    const fh = c.h * fit;
    const frame = { x: (W - fw) / 2, y: (H - fh) / 2, w: fw, h: fh };
    const bar = c.bar * fit;
    return { frame, bar, image: { x: frame.x, y: frame.y + bar, w: fw, h: fh - bar } };
}

export function render(
    canvas: HTMLCanvasElement,
    state: RenderState,
    image: CanvasImageSource,
    crop: Crop,
    scale: number,
    matte?: string,
): HTMLCanvasElement {
    const base = baseSize(state, crop);
    const W = Math.round(base.width * scale);
    const H = Math.round(base.height * scale);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingQuality = "high";
    if (matte) {
        ctx.fillStyle = matte;
        ctx.fillRect(0, 0, W, H);
    }

    drawBackground(ctx, state.background, W, H, image, crop);

    const { frame: f, bar, image: im } = layout(state, crop, W, H);
    const r = f.w * RADII[state.radius];
    const shadow = SHADOWS[state.shadow];

    // Cast the shadow from a filled rect, not the image, so transparent pixels don't make odd shapes.
    if (shadow) {
        ctx.save();
        ctx.shadowColor = `rgba(15, 12, 10, ${shadow.alpha})`;
        ctx.shadowBlur = f.w * shadow.blur;
        ctx.shadowOffsetY = f.w * shadow.y;
        ctx.fillStyle = "#000";
        roundRect(ctx, f.x, f.y, f.w, f.h, r);
        ctx.fill();
        ctx.restore();
    }

    ctx.save();
    roundRect(ctx, f.x, f.y, f.w, f.h, r);
    ctx.clip();
    ctx.fillStyle = state.dark ? "#18181b" : "#fff";
    ctx.fillRect(f.x, f.y, f.w, f.h);
    if (bar) drawWindowBar(ctx, f.x, f.y, f.w, bar, state.dark);
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, im.x, im.y, im.w, im.h);
    if (state.annotations?.length) drawAnnotations(ctx, state, crop, im);
    ctx.restore();

    if (state.frame !== "none") {
        const lw = Math.max(1, f.w / 900);
        ctx.save();
        ctx.lineWidth = lw;
        ctx.strokeStyle = state.dark ? "rgba(255, 255, 255, 0.14)" : "rgba(0, 0, 0, 0.1)";
        roundRect(ctx, f.x + lw / 2, f.y + lw / 2, f.w - lw, f.h - lw, Math.max(0, r - lw / 2));
        ctx.stroke();
        ctx.restore();
    }

    return canvas;
}

function drawAnnotations(ctx: CanvasRenderingContext2D, state: RenderState, crop: Crop, im: Rect) {
    const s = im.w / crop.w;
    const X = (x: number) => im.x + (x - crop.x) * s;
    const Y = (y: number) => im.y + (y - crop.y) * s;
    const unit = state.unit ?? 1;
    state.annotations!.forEach((a, i) => {
        if (i === state.skip) return;
        ctx.save();
        if (a.kind === "arrow") {
            drawArrow(ctx, X(a.x1), Y(a.y1), X(a.x2), Y(a.y2), arrowWidth(unit) * s, a.color);
        } else {
            const size = textSize(unit) * s;
            ctx.font = textFont(size, state.font ?? "sans-serif");
            ctx.textBaseline = "top";
            ctx.lineJoin = "round";
            ctx.lineWidth = size * 0.22;
            ctx.strokeStyle = isLight(a.color) ? "rgba(0, 0, 0, 0.55)" : "rgba(255, 255, 255, 0.85)";
            ctx.strokeText(a.text, X(a.x), Y(a.y));
            ctx.fillStyle = a.color;
            ctx.fillText(a.text, X(a.x), Y(a.y));
        }
        ctx.restore();
    });
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1) return;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const head = Math.min(w * 4.5, len * 0.6);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = w * 1.5;
    ctx.shadowOffsetY = w * 0.3;
    // Shaft stops inside the head so its round cap doesn't poke out of the tip.
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - cos * head * 0.8, y2 - sin * head * 0.8);
    ctx.stroke();
    const bx = x2 - cos * head;
    const by = y2 - sin * head;
    const half = head * 0.62;
    ctx.lineWidth = w * 0.5;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(bx + sin * half, by - cos * half);
    ctx.lineTo(bx - sin * half, by + cos * half);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function isLight(color: string) {
    const n = parseInt(color.slice(1), 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6;
}

function drawWindowBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dark: boolean) {
    ctx.fillStyle = dark ? "#2a2a2e" : "#f2f1ef";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = dark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.07)";
    ctx.fillRect(x, y + h - Math.max(1, h / 40), w, Math.max(1, h / 40));
    const dot = h * 0.2;
    ["#ff5f57", "#febc2e", "#28c840"].forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + h * 0.62 + i * dot * 3.1, y + h / 2, dot, 0, Math.PI * 2);
        ctx.fill();
    });
}

function redactBlock(W: number, H: number) {
    return Math.max(8, Math.round(Math.max(W, H) / 70));
}

export const REDACT_STYLES = ["box", "pixelate"] as const;
export type RedactStyle = (typeof REDACT_STYLES)[number];

export function redact(
    image: CanvasImageSource & { width: number; height: number },
    boxes: Rect[],
    style: RedactStyle = "box",
): HTMLCanvasElement {
    const W = image.width;
    const H = image.height;
    const out = document.createElement("canvas");
    out.width = W;
    out.height = H;
    const ctx = out.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0);
    if (!boxes.length) return out;

    if (style === "pixelate") {
        pixelate(ctx, image, boxes, W, H);
        return out;
    }

    // Sample every box's surroundings before drawing any, so overlapping boxes don't sample each other.
    const fills = boxes.map((b) => boxColor(ctx, b, W, H));
    const radius = Math.max(4, Math.round(Math.max(W, H) / 160));
    boxes.forEach((b, i) => {
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, Math.min(b.w / 2, b.h / 2, radius));
        ctx.fillStyle = fills[i];
        ctx.fill();
    });
    return out;
}

function pixelate(ctx: CanvasRenderingContext2D, image: CanvasImageSource, boxes: Rect[], W: number, H: number) {
    const block = redactBlock(W, H);
    const cols = Math.ceil(W / block);
    const rows = Math.ceil(H / block);

    // Shrink by halves first so each block is a true average of its pixels.
    let src: CanvasImageSource = image;
    let sw = W;
    let sh = H;
    while (sw / 2 >= cols * 2 && sh / 2 >= rows * 2) {
        const half = document.createElement("canvas");
        half.width = Math.ceil(sw / 2);
        half.height = Math.ceil(sh / 2);
        const h = half.getContext("2d")!;
        h.imageSmoothingQuality = "high";
        h.drawImage(src, 0, 0, sw, sh, 0, 0, half.width, half.height);
        src = half;
        sw = half.width;
        sh = half.height;
    }

    // The last row/column may be partial: fill underneath first to keep edge blocks opaque.
    const small = document.createElement("canvas");
    small.width = cols;
    small.height = rows;
    const s = small.getContext("2d")!;
    s.imageSmoothingQuality = "high";
    s.drawImage(src, 0, 0, sw, sh, 0, 0, cols, rows);
    s.drawImage(src, 0, 0, sw, sh, 0, 0, W / block, H / block);

    for (const b of boxes) {
        const x0 = Math.floor(b.x / block) * block;
        const y0 = Math.floor(b.y / block) * block;
        const x1 = Math.min(W, Math.ceil((b.x + b.w) / block) * block);
        const y1 = Math.min(H, Math.ceil((b.y + b.h) / block) * block);
        const cw = Math.ceil((x1 - x0) / block);
        const rh = Math.ceil((y1 - y0) / block);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, x0 / block, y0 / block, cw, rh, x0, y0, cw * block, rh * block);
        ctx.restore();
    }
}

function boxColor(ctx: CanvasRenderingContext2D, b: Rect, W: number, H: number): string {
    const o = 3;
    const x0 = Math.max(0, b.x - o);
    const y0 = Math.max(0, b.y - o);
    const x1 = Math.min(W, b.x + b.w + o);
    const y1 = Math.min(H, b.y + b.h + o);
    const px = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    const w = x1 - x0;
    let r = 0;
    let g = 0;
    let bl = 0;
    let n = 0;
    for (let y = 0; y < y1 - y0; y++) {
        for (let x = 0; x < w; x++) {
            const inside = x + x0 >= b.x && x + x0 < b.x + b.w && y + y0 >= b.y && y + y0 < b.y + b.h;
            if (inside) continue;
            const i = (y * w + x) * 4;
            r += px[i];
            g += px[i + 1];
            bl += px[i + 2];
            n++;
        }
    }
    if (!n) return "#e7e5e4";
    r /= n;
    g /= n;
    bl /= n;
    const light = (0.299 * r + 0.587 * g + 0.114 * bl) / 255 > 0.5;
    const mix = (c: number) => Math.round(light ? c * 0.9 : c + (255 - c) * 0.14);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(bl)})`;
}

export function drawBackground(
    ctx: CanvasRenderingContext2D,
    bg: Background,
    W: number,
    H: number,
    image?: CanvasImageSource,
    crop?: Crop,
) {
    switch (bg.kind) {
        case "transparent":
            return;
        case "solid":
            ctx.fillStyle = bg.color;
            ctx.fillRect(0, 0, W, H);
            return;
        case "linear": {
            // CSS-style angle: 0deg points up, 90deg points right.
            const a = ((bg.angle - 90) * Math.PI) / 180;
            const half = (Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a))) / 2;
            const dx = Math.cos(a) * half;
            const dy = Math.sin(a) * half;
            const g = ctx.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy);
            bg.colors.forEach((c, i) => g.addColorStop(i / (bg.colors.length - 1), c));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
            if (bg.grain) drawGrain(ctx, W, H);
            return;
        }
        case "radial": {
            const cx = bg.center[0] * W;
            const cy = bg.center[1] * H;
            const far = Math.max(Math.hypot(cx, cy), Math.hypot(W - cx, cy), Math.hypot(cx, H - cy), Math.hypot(W - cx, H - cy));
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, far);
            bg.colors.forEach((c, i) => g.addColorStop(i / (bg.colors.length - 1), c));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
            if (bg.grain) drawGrain(ctx, W, H);
            return;
        }
        case "dots": {
            ctx.fillStyle = bg.color;
            ctx.fillRect(0, 0, W, H);
            const step = Math.max(6, W / 48);
            const dot = Math.max(0.75, step * 0.09);
            ctx.fillStyle = bg.dot;
            for (let y = step / 2; y < H; y += step) {
                for (let x = step / 2; x < W; x += step) {
                    ctx.beginPath();
                    ctx.arc(x, y, dot, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            return;
        }
        case "glass": {
            if (!image || !crop) return;
            // Blur by downscaling and scaling back up: Safari has no ctx.filter.
            const tiny = document.createElement("canvas");
            const tw = 32;
            const th = Math.max(1, Math.round((tw * H) / W));
            tiny.width = tw;
            tiny.height = th;
            const t = tiny.getContext("2d")!;
            t.imageSmoothingQuality = "high";
            const ratio = W / H;
            let cw = crop.w;
            let ch = crop.w / ratio;
            if (ch > crop.h) {
                ch = crop.h;
                cw = crop.h * ratio;
            }
            t.drawImage(image, crop.x + (crop.w - cw) / 2, crop.y + (crop.h - ch) / 2, cw, ch, 0, 0, tw, th);
            ctx.save();
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(tiny, 0, 0, W, H);
            ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
            drawGrain(ctx, W, H);
            return;
        }
    }
}

let grainTile: HTMLCanvasElement | null = null;

function drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
    if (!grainTile) {
        grainTile = document.createElement("canvas");
        grainTile.width = grainTile.height = 128;
        const g = grainTile.getContext("2d")!;
        const data = g.createImageData(128, 128);
        let seed = 7;
        for (let i = 0; i < data.data.length; i += 4) {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            const v = seed >>> 24;
            data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
            data.data[i + 3] = 16;
        }
        g.putImageData(data, 0, 0);
    }
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = ctx.createPattern(grainTile, "repeat")!;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}
