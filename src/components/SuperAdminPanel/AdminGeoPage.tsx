"use client";

import { useState } from "react";
import {
  useGetAdminGeoCountriesQuery,
  useCreateAdminGeoCountryMutation,
  useGetAdminGeoStatesQuery,
  useCreateAdminGeoStateMutation,
  useGetCitiesQuery,
  useGetAdminGeoLocationsQuery,
  useCreateAdminGeoLocationMutation,
} from "@/services/api";
import { toast } from "sonner";

export default function AdminGeoPage() {
  const { data: countries = [] } = useGetAdminGeoCountriesQuery();
  const [countryId, setCountryId] = useState<number | "">("");
  const [cityId, setCityId] = useState<number | "">("");
  const { data: states = [] } = useGetAdminGeoStatesQuery(
    countryId ? { country_id: Number(countryId) } : undefined
  );
  const { data: cities = [] } = useGetCitiesQuery();
  const { data: locations = [] } = useGetAdminGeoLocationsQuery(
    cityId ? { city_id: Number(cityId) } : undefined
  );

  const [createCountry] = useCreateAdminGeoCountryMutation();
  const [createState] = useCreateAdminGeoStateMutation();
  const [createLocation] = useCreateAdminGeoLocationMutation();

  const [countryName, setCountryName] = useState("");
  const [stateName, setStateName] = useState("");
  const [locationName, setLocationName] = useState("");

  const cityList = cities;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Location hierarchy</h1>
        <p className="text-sm text-slate-500 mt-1">
          Country → Region/State → City (existing City Masters) → Location/locality
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">Countries</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="New country"
            value={countryName}
            onChange={(e) => setCountryName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm"
            onClick={async () => {
              try {
                await createCountry({ name: countryName }).unwrap();
                setCountryName("");
                toast.success("Country added");
              } catch (e) {
                toast.error((e as { data?: { error?: string } })?.data?.error || "Failed");
              }
            }}
          >
            Add
          </button>
        </div>
        <ul className="text-sm text-slate-600 space-y-1">
          {(Array.isArray(countries) ? countries : []).map((c: { id: number; name: string }) => (
            <li key={c.id}>{c.name}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">States / regions</h2>
        <select
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={countryId}
          onChange={(e) => setCountryId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select country</option>
          {(Array.isArray(countries) ? countries : []).map((c: { id: number; name: string }) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="New state / region"
            value={stateName}
            onChange={(e) => setStateName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm"
            onClick={async () => {
              if (!countryId) return toast.error("Select a country");
              try {
                await createState({ country_id: Number(countryId), name: stateName }).unwrap();
                setStateName("");
                toast.success("State added");
              } catch (e) {
                toast.error((e as { data?: { error?: string } })?.data?.error || "Failed");
              }
            }}
          >
            Add
          </button>
        </div>
        <ul className="text-sm text-slate-600 space-y-1">
          {states.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">Locations under a city</h2>
        <select
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={cityId}
          onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Select city</option>
          {cityList.map((c: { id: number; name: string }) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="New locality (e.g. Bole)"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg bg-slate-900 text-white px-3 py-2 text-sm"
            onClick={async () => {
              if (!cityId) return toast.error("Select a city");
              try {
                await createLocation({ city_id: Number(cityId), name: locationName }).unwrap();
                setLocationName("");
                toast.success("Location added");
              } catch (e) {
                toast.error((e as { data?: { error?: string } })?.data?.error || "Failed");
              }
            }}
          >
            Add
          </button>
        </div>
        <ul className="text-sm text-slate-600 space-y-1">
          {locations.map((l) => (
            <li key={l.id}>{l.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
