// ---------------------------------------------------------------------------
// Scenery: the layered scene that lives behind each tab, hidden in the dark and
// unveiled by the cursor's reveal-trail. Users pick a built-in scene or upload
// their own image; the choice rides on the Workspace object, so it syncs like
// everything else.
// ---------------------------------------------------------------------------

import type { Scenery } from "./types";

export const SCENES: { id: string; name: string }[] = [
  { id: "mountains", name: "Mountains" },
  { id: "forest", name: "Forest" },
  { id: "starfield", name: "Starfield" },
];

export const DEFAULT_SCENERY: Scenery = { kind: "scene", id: "mountains" };

export const resolveScenery = (s?: Scenery): Scenery => s ?? DEFAULT_SCENERY;

const MAX_SCENERY_PX = 1280;

/** Read an image File, downscale to fit MAX_SCENERY_PX, return a data URL. */
export function fileToSceneryDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("That file isn't an image."));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      reject(new Error("That image is too large — please pick one under 20MB."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_SCENERY_PX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Couldn't process the image."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/webp", 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't load that image."));
    };
    img.src = url;
  });
}
