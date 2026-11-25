"use client";

import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import { useEffect, useRef, useState } from "react";
import { GPS_RULES } from "@/lib/meros/config";
import type { PlaceLocation } from "@/lib/meros/content/places";
import { Icon, Note } from "./ui";

interface Hit {
  name: string;
  lat: number;
  lng: number;
}

const PIN_HTML =
  '<svg viewBox="0 0 24 24" width="36" height="36" style="filter:drop-shadow(0 3px 4px rgb(0 0 0/.35))"><path d="M12 22s-7-6.2-7-11.5A7 7 0 0 1 19 10.5C19 15.8 12 22 12 22z" fill="#761011" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="10.5" r="2.6" fill="#fff"/></svg>';

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Set a spot anywhere, from anywhere: search an address or place name, tap the map, drag the pin,
 * or use where you are now. The circle is the check-in area.
 */
export default function LocationPicker({
  value,
  defaultLabel,
  near,
  onChange,
}: {
  value: PlaceLocation | null;
  defaultLabel: string;
  /** Where to start the map when nothing is set yet (e.g. another saved place). */
  near?: { lat: number; lng: number } | null;
  onChange: (next: PlaceLocation) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const pin = useRef<Leaflet.Marker | null>(null);
  const ring = useRef<Leaflet.Circle | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const latest = useRef({ value, onChange, defaultLabel });
  latest.current = { value, onChange, defaultLabel };
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState<"search" | "gps" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const place = (lat: number, lng: number, label?: string) => {
    const v = latest.current.value;
    latest.current.onChange({
      lat: round6(lat),
      lng: round6(lng),
      radiusM: v?.radiusM ?? GPS_RULES.defaultRadiusM,
      label: label ?? v?.label ?? latest.current.defaultLabel,
    });
  };

  // Build the map once (Leaflet needs the browser, so it loads here, not during render).
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((mod) => {
      const L = (mod as unknown as { default: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      if (cancelled || !box.current || map.current) return;
      lib.current = L;
      const start = latest.current.value ?? near ?? null;
      const m = L.map(box.current, { zoomControl: false, attributionControl: true }).setView(start ? [start.lat, start.lng] : [39.5, -98.35], start ? 16 : 4);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      L.control.zoom({ position: "bottomright" }).addTo(m);
      m.on("click", (e: Leaflet.LeafletMouseEvent) => place(e.latlng.lat, e.latlng.lng));
      map.current = m;
      sync();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      pin.current = null;
      ring.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin and the circle on the current value.
  function sync() {
    const L = lib.current;
    const m = map.current;
    const v = latest.current.value;
    if (!L || !m || !v) return;
    const at: Leaflet.LatLngExpression = [v.lat, v.lng];
    if (!pin.current) {
      pin.current = L.marker(at, {
        draggable: true,
        icon: L.divIcon({ html: PIN_HTML, className: "", iconSize: [36, 36], iconAnchor: [18, 34] }),
        keyboard: true,
        title: "Drag to move",
      }).addTo(m);
      pin.current.on("dragend", () => {
        const p = pin.current!.getLatLng();
        place(p.lat, p.lng);
      });
      ring.current = L.circle(at, { radius: v.radiusM, color: "#761011", weight: 2, fillColor: "#761011", fillOpacity: 0.12 }).addTo(m);
    } else {
      pin.current.setLatLng(at);
      ring.current?.setLatLng(at).setRadius(v.radiusM);
    }
  }
  useEffect(sync, [value]);

  const flyTo = (lat: number, lng: number) => map.current?.flyTo([lat, lng], 17, { duration: 0.8 });

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setBusy("search");
    setError(null);
    try {
      const c = map.current?.getCenter();
      const bias = c && (map.current?.getZoom() ?? 0) >= 9 ? `&viewbox=${c.lng - 0.6},${c.lat + 0.4},${c.lng + 0.6},${c.lat - 0.4}` : "";
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=0${bias}&q=${encodeURIComponent(q)}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(String(res.status));
      const rows = (await res.json()) as { display_name: string; lat: string; lon: string; name?: string }[];
      setHits(rows.map((r) => ({ name: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })));
    } catch {
      setError("Search isn't answering. Tap the map instead.");
    } finally {
      setBusy(null);
    }
  }

  function pick(h: Hit) {
    const short = h.name.split(",")[0]?.trim();
    place(h.lat, h.lng, latest.current.value?.label && latest.current.value.label !== latest.current.defaultLabel ? latest.current.value.label : short || latest.current.defaultLabel);
    flyTo(h.lat, h.lng);
    setHits(null);
  }

  function here() {
    if (!("geolocation" in navigator)) return setError("This browser can't read your location.");
    setBusy("gps");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        place(pos.coords.latitude, pos.coords.longitude);
        flyTo(pos.coords.latitude, pos.coords.longitude);
        setBusy(null);
      },
      (err) => {
        setBusy(null);
        setError(err.code === err.PERMISSION_DENIED ? "Location is off for this site. Search or tap the map instead." : "No fix right now. Search or tap the map.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form className="flex gap-2" onSubmit={search} role="search">
        <input className="field" type="search" enterKeyHint="search" placeholder="Search a place or address" aria-label="Search a place or address" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="submit" className="btn btn-secondary w-12 shrink-0 px-0" aria-label="Search" disabled={busy === "search"}>
          <Icon name="search" />
        </button>
      </form>
      {hits && (
        <ul className="m-list -mt-1 flex flex-col rounded-xl border-[1.5px] border-blood" aria-label="Results">
          {hits.length === 0 && <li className="p-3 text-sm font-bold">No matches. Try a street or city.</li>}
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lng},${i}`} className={i ? "rule" : ""}>
              <button type="button" className="flex w-full items-start gap-2 p-3 text-left text-sm" onClick={() => pick(h)}>
                <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0" /> <span className="line-clamp-2">{h.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <div ref={box} className="h-64 w-full overflow-hidden rounded-2xl border-[1.5px] border-blood bg-white" aria-label="Map: tap to drop the pin" role="application" />
        <button type="button" onClick={here} disabled={busy === "gps"} className="btn btn-secondary absolute top-2 left-2 z-[500] min-h-10 bg-white px-3 text-sm">
          <Icon name="pin" className="h-4 w-4" /> {busy === "gps" ? "Locating…" : "Here"}
        </button>
        {!value && <span className="pointer-events-none absolute inset-x-0 bottom-3 z-[500] mx-auto w-max rounded-full bg-blood px-3 py-1 text-sm font-bold text-white">Tap to drop the pin</span>}
      </div>
      {error && <Note tone="warn">{error}</Note>}
      {value && (
        <div className="m-rise grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2">
          <input className="field" aria-label="Place name" value={value.label} maxLength={60} onChange={(e) => onChange({ ...value, label: e.target.value })} />
          <span className="font-display text-lg whitespace-nowrap">{value.radiusM} m</span>
          <input
            type="range"
            aria-label="Check-in area radius"
            min={GPS_RULES.minRadiusM}
            max={GPS_RULES.maxRadiusM}
            step={10}
            value={value.radiusM}
            className="col-span-2 w-full"
            onChange={(e) => onChange({ ...value, radiusM: Number(e.target.value) })}
          />
        </div>
      )}
    </div>
  );
}
