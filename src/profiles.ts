// ---------------------------------------------------------------------------
// Profiles: the Netflix-style layer on top of an account. Each profile owns its
// own set of goal tabs (scoped by profile_id in cloudStore). Same RLS trust
// domain as the account — profile separation is UX, not a security boundary.
//
// The active profile is remembered PER BROWSER TAB (sessionStorage): a fresh
// tab returns to the picker; reloading the same tab stays in the profile.
// ---------------------------------------------------------------------------

import { supabase } from "./supabase";
import type { Profile } from "./types";
import { ANIMALS } from "./animalShapes";

const TABLE = "profiles";
const ACTIVE_KEY = "aditya.profile.v1";

/** The avatars offered in the profile editor (the app's own creatures). */
export const AVATAR_PRESETS = ANIMALS.map((a) => ({ id: a.id, name: a.name, color: a.color }));

interface ProfileRow {
  id: string;
  name: string;
  avatar_id: string | null;
  avatar_image: string | null;
  theme_pack_id: string | null;
  color: string;
  created_at: string;
}

const fromRow = (r: ProfileRow): Profile => ({
  id: r.id,
  name: r.name,
  avatarId: r.avatar_id,
  avatarImage: r.avatar_image,
  themePackId: r.theme_pack_id,
  color: r.color,
  createdAt: new Date(r.created_at).getTime(),
});

export async function fetchProfiles(): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, avatar_id, avatar_image, theme_pack_id, color, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`profiles load failed: ${error.message}`);
  return (data ?? []).map((r) => fromRow(r as ProfileRow));
}

export interface ProfileInput {
  name: string;
  avatarId?: string | null;
  avatarImage?: string | null;
  themePackId?: string | null;
  color?: string;
}

export async function createProfile(input: ProfileInput): Promise<Profile> {
  if (!supabase) throw new Error("cloud disabled");
  // Never send user_id — the column default (auth.uid()) fills it under RLS.
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: input.name,
      avatar_id: input.avatarId ?? null,
      avatar_image: input.avatarImage ?? null,
      theme_pack_id: input.themePackId ?? null,
      color: input.color ?? "sage",
    })
    .select("id, name, avatar_id, avatar_image, theme_pack_id, color, created_at")
    .single();
  if (error) throw new Error(`profile create failed: ${error.message}`);
  return fromRow(data as ProfileRow);
}

export async function updateProfile(
  id: string,
  patch: Partial<ProfileInput>,
): Promise<void> {
  if (!supabase) return;
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.avatarId !== undefined) row.avatar_id = patch.avatarId;
  if (patch.avatarImage !== undefined) row.avatar_image = patch.avatarImage;
  if (patch.themePackId !== undefined) row.theme_pack_id = patch.themePackId;
  if (patch.color !== undefined) row.color = patch.color;
  const { error } = await supabase.from(TABLE).update(row).eq("id", id);
  if (error) throw new Error(`profile update failed: ${error.message}`);
}

/** Deletes the profile; the DB cascades and removes all its workspaces. */
export async function deleteProfile(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(`profile delete failed: ${error.message}`);
}

// --- active profile, per browser tab --------------------------------------

export function getActiveProfileId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}
export function setActiveProfileId(id: string): void {
  try {
    sessionStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}
export function clearActiveProfileId(): void {
  try {
    sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

// --- image upload: downscale to a small square data URL --------------------

const MAX_AVATAR_PX = 256;

/** Read an image File, cover-crop to a square, downscale, return a data URL. */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("That file isn't an image."));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error("That image is too large — please pick one under 15MB."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = MAX_AVATAR_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Couldn't process the image."));
        return;
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, MAX_AVATAR_PX, MAX_AVATAR_PX);
      resolve(canvas.toDataURL("image/webp", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't load that image."));
    };
    img.src = url;
  });
}
