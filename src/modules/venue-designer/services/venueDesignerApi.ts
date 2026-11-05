"use client";

import { LayoutCategory, LayoutStandardTemplate, SeatType, UniversalVenueLayout, UniversalVenueObject } from "../types";
import { getActiveSession } from "@/lib/authStorage";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";


function authHeaders(): Record<string, string> {
  const token = getActiveSession()?.token || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body?.error || body?.message || fallback;
}

export async function fetchLayoutApi(layoutId: string): Promise<UniversalVenueLayout | null> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/venue-designer/layouts/${layoutId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await readError(res, "Failed to load venue layout"));
    const json = await res.json();
    return json.data || json;
  } catch (err) {
    console.error("fetchLayoutApi error:", err);
    return null;
  }
}

export async function saveDraftLayoutApi(layout: UniversalVenueLayout): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/venue-designer/layouts/${layout.id}/draft`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(layout),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to save draft"));
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function publishLayoutApi(layoutId: string, layout: UniversalVenueLayout): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/venue-designer/layouts/${layoutId}/publish`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(layout),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to publish layout"));
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Standard (reusable) templates ──

export async function listStandardTemplatesApi(): Promise<{ data: LayoutStandardTemplate[]; error?: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/venue-designer/templates`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await readError(res, "Failed to load saved templates"));
    const json = await res.json();
    return { data: json.data || [] };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export interface SaveStandardTemplateInput {
  name: string;
  description?: string;
  category: LayoutCategory;
  isShared: boolean;
  canvasWidth: number;
  canvasHeight: number;
  objects: UniversalVenueObject[];
  seatTypes: SeatType[];
  capacity: number;
}

export async function saveStandardTemplateApi(
  input: SaveStandardTemplateInput
): Promise<{ success: boolean; data?: LayoutStandardTemplate; error?: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/venue-designer/templates`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to save template"));
    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateStandardTemplateApi(
  id: string,
  patch: { name?: string; description?: string | null; isShared?: boolean; category?: LayoutCategory }
): Promise<{ success: boolean; data?: LayoutStandardTemplate; error?: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/venue-designer/templates/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to update template"));
    const json = await res.json();
    return { success: true, data: json.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteStandardTemplateApi(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/venue-designer/templates/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await readError(res, "Failed to delete template"));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
