"use client";

import { UniversalVenueLayout } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://bookmybota-backend.onrender.com";

export async function fetchTemplatesApi() {
  try {
    const res = await fetch(`${API_BASE}/api/venue-designer/templates`);
    if (!res.ok) throw new Error("Failed to load templates");
    return await res.json();
  } catch (err) {
    console.warn("Using offline templates fallback:", err);
    return null;
  }
}

export async function fetchLayoutApi(layoutId: string): Promise<UniversalVenueLayout | null> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const res = await fetch(`${API_BASE}/api/venue-designer/layouts/${layoutId}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });
    if (!res.ok) throw new Error("Failed to load venue layout");
    const json = await res.json();
    return json.data || json;
  } catch (err) {
    console.error("fetchLayoutApi error:", err);
    return null;
  }
}

export async function saveDraftLayoutApi(layout: UniversalVenueLayout): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const res = await fetch(`${API_BASE}/api/venue-designer/layouts/${layout.id}/draft`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(layout),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Failed to save draft");
    }
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function publishLayoutApi(layoutId: string, layout: UniversalVenueLayout): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";
    const res = await fetch(`${API_BASE}/api/venue-designer/layouts/${layoutId}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(layout),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || "Failed to publish layout");
    }
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
