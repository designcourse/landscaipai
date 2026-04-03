"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ZONE_ORDER } from "@/lib/utils/zones";

interface ZoneSelectorProps {
  onSelect: (zone: string, zipCode?: string) => void;
  onCancel: () => void;
}

// Zone color mapping for the visual display
const ZONE_COLORS: Record<string, string> = {
  "3a": "#6B21A8", "3b": "#7C3AED",
  "4a": "#2563EB", "4b": "#3B82F6",
  "5a": "#0891B2", "5b": "#06B6D4",
  "6a": "#059669", "6b": "#10B981",
  "7a": "#65A30D", "7b": "#84CC16",
  "8a": "#CA8A04", "8b": "#EAB308",
  "9a": "#EA580C", "9b": "#F97316",
  "10a": "#DC2626", "10b": "#EF4444",
};

// Simplified US zone regions for the map labels
const ZONE_REGIONS: Record<string, string> = {
  "3a": "Northern MN, ND, MT",
  "3b": "WI, upper MI, ME",
  "4a": "IA, SD, NE, NH, VT",
  "4b": "southern MN, WI, MI, MT",
  "5a": "IA, NE, CO, MA, CT",
  "5b": "IN, OH, PA, CO, IL",
  "6a": "MO, KS, KY, NJ, UT",
  "6b": "PA, MD, VA, KY, NM",
  "7a": "VA, NC, TN, OK, NV",
  "7b": "NC, AR, TX, NM",
  "8a": "SC, GA, AL, MS, TX, WA",
  "8b": "LA, TX coast, OR coast",
  "9a": "FL, south TX, central CA",
  "9b": "south FL, south CA",
  "10a": "south FL, coastal CA",
  "10b": "Key West, southernmost CA",
};

export function ZoneSelector({ onSelect, onCancel }: ZoneSelectorProps) {
  const [zipCode, setZipCode] = useState("");
  const [zipError, setZipError] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [mode, setMode] = useState<"zip" | "map">("zip");

  async function handleZipLookup() {
    const cleaned = zipCode.replace(/\D/g, "").slice(0, 5);
    if (cleaned.length !== 5) return;

    setZipLoading(true);
    setZipError(false);

    const supabase = createClient();
    const { data } = await supabase
      .from("zip_to_zone")
      .select("zone")
      .eq("zip_code", cleaned)
      .single();

    setZipLoading(false);

    if (data?.zone) {
      onSelect(data.zone, cleaned);
    } else {
      setZipError(true);
    }
  }

  function handleZoneClick(zone: string) {
    setSelectedZone(zone);
  }

  function handleConfirmZone() {
    if (selectedZone) {
      onSelect(selectedZone);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4 shadow-md">
      {/* Tab toggle */}
      <div className="mb-4 flex gap-1 rounded-md bg-muted p-0.5">
        <button
          type="button"
          onClick={() => setMode("zip")}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "zip" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Zip Code
        </button>
        <button
          type="button"
          onClick={() => setMode("map")}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            mode === "map" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Select Zone
        </button>
      </div>

      {mode === "zip" ? (
        /* ── Zip code lookup ── */
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            Enter your zip code to auto-detect your USDA hardiness zone
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={zipCode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                setZipCode(v);
                setZipError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleZipLookup();
              }}
              placeholder="e.g. 90210"
              maxLength={5}
              className="w-28 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <button
              type="button"
              onClick={handleZipLookup}
              disabled={zipCode.length !== 5 || zipLoading}
              className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              {zipLoading ? "..." : "Look up"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          {zipError && (
            <p className="mt-2 text-xs text-muted-foreground">
              Zip not found.{" "}
              <button
                type="button"
                onClick={() => setMode("map")}
                className="text-primary hover:text-primary-light"
              >
                Select your zone manually
              </button>
            </p>
          )}
        </div>
      ) : (
        /* ── Visual zone picker ── */
        <div>
          <p className="mb-3 text-xs text-muted-foreground">
            Select your USDA Plant Hardiness Zone
          </p>

          {/* Zone grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {ZONE_ORDER.map((zone) => (
              <button
                key={zone}
                type="button"
                onClick={() => handleZoneClick(zone)}
                className={`group relative rounded-md px-2 py-2 text-left transition-all ${
                  selectedZone === zone
                    ? "ring-2 ring-primary ring-offset-1"
                    : "hover:ring-1 hover:ring-border"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: ZONE_COLORS[zone] }}
                  />
                  <span className="text-xs font-semibold text-foreground">
                    {zone.toUpperCase()}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                  {ZONE_REGIONS[zone]}
                </p>
              </button>
            ))}
          </div>

          {/* Reference map image link */}
          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            Not sure?{" "}
            <a
              href="https://planthardiness.ars.usda.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-light"
            >
              View official USDA zone map
            </a>
          </p>

          {/* Actions */}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmZone}
              disabled={!selectedZone}
              className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
            >
              Set Zone {selectedZone?.toUpperCase() ?? ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
