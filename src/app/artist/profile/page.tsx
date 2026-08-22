"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { useGetBusinessSettingsQuery, useUpdateBusinessSettingsMutation } from "@/services/api";
import PhoneInput from "@/components/Shared/PhoneInput";

export default function ArtistProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const { data: settings, isLoading } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(true);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!settings) return;
    setName(settings.name || "");
    setAddress(settings.address || "");
    setPhone(settings.phone || "");
    setDescription(settings.description || "");
  }, [settings]);

  if (isLoading || !user) {
    return <div className="text-white p-10 text-center">Loading artist profile...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Artist profile</h2>
        <p className="text-zinc-400 mt-1">
          Basic artist information used by Super Admin during approval and later event bookings.
        </p>
      </div>
      <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Artist / stage name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          </div>
          <PhoneInput
            label="Phone"
            labelClassName="block text-sm font-medium text-zinc-400 mb-2"
            variant="dark"
            value={phone}
            onChange={setPhone}
            onValidChange={setPhoneValid}
            required={false}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Address / base city</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white"
            rows={2}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Bio / description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white"
            rows={4}
            placeholder="Genre, experience, performance style..."
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={async () => {
              try {
                await updateSettings({ bizId, body: { name, address, phone, description } }).unwrap();
                toast.success("Artist profile saved");
              } catch {
                toast.error("Failed to save profile");
              }
            }}
            disabled={saving || !phoneValid}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
