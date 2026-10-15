/**
 * CleanShot backgrounds as data. The swatch grid, the renderer and (later)
 * the Edit popover all read this one schema. Client-safe.
 */

export type Background =
    | { kind: "linear"; colors: string[]; angle: number; grain: boolean }
    | { kind: "radial"; colors: string[]; center: [number, number]; grain: boolean }
    | { kind: "solid"; color: string }
    | { kind: "glass" }
    | { kind: "dots"; color: string; dot: string }
    | { kind: "transparent" };

export interface Preset {
    id: string;
    name: string;
    background: Background;
}

/** Neutral gradient used by "Match" when the screenshot has no usable color. */
export const MATCH_FALLBACK: Background = {
    kind: "linear",
    colors: ["#d6d3d1", "#a8a29e"],
    angle: 135,
    grain: true,
};

export const PRESETS: Preset[] = [
    // "Match" is filled in from the screenshot's own colors at load time.
    { id: "match", name: "Match", background: MATCH_FALLBACK },
    // "Pick from image": a solid color the user clicks on in the screenshot.
    { id: "picked", name: "Pick from image", background: { kind: "solid", color: "#e7e5e4" } },

    // Linear
    { id: "sunset", name: "Sunset", background: { kind: "linear", colors: ["#fb923c", "#ec4899", "#8b5cf6"], angle: 135, grain: true } },
    { id: "ocean", name: "Ocean", background: { kind: "linear", colors: ["#2dd4bf", "#2563eb"], angle: 135, grain: true } },
    { id: "grape", name: "Grape", background: { kind: "linear", colors: ["#4f7cf7", "#9b5cf6"], angle: 135, grain: true } },
    { id: "peach", name: "Peach", background: { kind: "linear", colors: ["#fed7aa", "#fda4af"], angle: 135, grain: true } },
    { id: "dusk", name: "Dusk", background: { kind: "linear", colors: ["#1e1b4b", "#6d28d9"], angle: 135, grain: true } },
    { id: "mint", name: "Mint", background: { kind: "linear", colors: ["#a7f3d0", "#5eead4"], angle: 135, grain: true } },

    // Radial
    { id: "midnight-glow", name: "Midnight glow", background: { kind: "radial", colors: ["#4338ca", "#0f0a2e"], center: [0.5, 0.5], grain: true } },
    { id: "warm-glow", name: "Warm glow", background: { kind: "radial", colors: ["#fde68a", "#f97316"], center: [0.15, 0.1], grain: true } },
    { id: "pastel-glow", name: "Pastel glow", background: { kind: "radial", colors: ["#fbcfe8", "#c7d2fe"], center: [0.85, 0.15], grain: true } },

    // Solid
    { id: "off-white", name: "Off-white", background: { kind: "solid", color: "#f5f4f0" } },
    { id: "ink", name: "Ink", background: { kind: "solid", color: "#1c1917" } },
    { id: "sand", name: "Sand", background: { kind: "solid", color: "#e7dfcf" } },
    { id: "stone", name: "Stone", background: { kind: "solid", color: "#57534e" } },

    // Special
    { id: "glass", name: "Glass", background: { kind: "glass" } },
    { id: "dots", name: "Dot grid", background: { kind: "dots", color: "#f5f4f0", dot: "#d6d3d1" } },
    { id: "transparent", name: "Transparent", background: { kind: "transparent" } },
];

export const DEFAULT_PRESET = "match";

export function findPreset(id: string): Preset {
    return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}
