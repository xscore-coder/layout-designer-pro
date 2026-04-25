import type { ZoneShape } from "@/types/floorplan";

/** Returns CSS clip-path polygon for the shape, sized to 100% of container. */
export function shapeClipPath(shape: ZoneShape): string | undefined {
  switch (shape) {
    case "rect":
      return undefined;
    case "rounded":
      return undefined; // handled via border-radius
    case "hex":
      return "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)";
    case "oval":
      return "ellipse(50% 50% at 50% 50%)";
    case "rhombus":
      return "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
    case "parallelogram":
      return "polygon(15% 0, 100% 0, 85% 100%, 0 100%)";
    default:
      return undefined;
  }
}

export function shapeLabel(shape: ZoneShape): string {
  return {
    rect: "Rectangle",
    rounded: "Rounded",
    hex: "Hexagon",
    oval: "Oval",
    rhombus: "Rhombus",
    parallelogram: "Parallelogram",
  }[shape];
}

export const ALL_SHAPES: ZoneShape[] = ["rect", "rounded", "hex", "oval", "rhombus", "parallelogram"];

export function snap(n: number, grid = 10): number {
  return Math.round(n / grid) * grid;
}
