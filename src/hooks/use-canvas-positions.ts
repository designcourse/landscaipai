"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface ItemPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_PREFIX = "canvas-layout-";
const SAVE_DEBOUNCE_MS = 500;

// Default image width on canvas (matching Figma card width)
const DEFAULT_WIDTH = 880;
const HORIZONTAL_GAP = 100;
const GENERATION_OFFSET_X = 30;
const GENERATION_VERTICAL_GAP = 160; // Extra space for metadata (title + tags + prompt) below each generation

export interface CanvasItemSeed {
  id: string;
  // Videos and finalized videos share generation layout semantics —
  // they're auto-laid-out as siblings to the right of their source image.
  type: "original" | "generation" | "video" | "finalized_video";
  imageId: string; // parent image ID (for generations/videos, their source)
  naturalWidth: number;
  naturalHeight: number;
}

function computeAutoLayout(items: CanvasItemSeed[]): Record<string, ItemPosition> {
  const positions: Record<string, ItemPosition> = {};

  // Separate originals and generations (videos share generation layout semantics)
  const originals = items.filter((i) => i.type === "original");
  const generationsByImage: Record<string, CanvasItemSeed[]> = {};

  for (const item of items) {
    if (
      item.type === "generation" ||
      item.type === "video" ||
      item.type === "finalized_video"
    ) {
      if (!generationsByImage[item.imageId]) generationsByImage[item.imageId] = [];
      generationsByImage[item.imageId].push(item);
    }
  }

  let currentX = 0;

  for (const orig of originals) {
    const aspect = orig.naturalHeight && orig.naturalWidth
      ? orig.naturalHeight / orig.naturalWidth
      : 3 / 4;
    const width = DEFAULT_WIDTH;
    const height = Math.round(width * aspect);

    positions[orig.id] = { x: currentX, y: 0, width, height };

    // Place generations horizontally to the right of the original
    const gens = generationsByImage[orig.id] ?? [];
    let genX = currentX + width + GENERATION_OFFSET_X;

    for (const gen of gens) {
      const genAspect = gen.naturalHeight && gen.naturalWidth
        ? gen.naturalHeight / gen.naturalWidth
        : aspect;
      const genWidth = width;
      const genHeight = Math.round(genWidth * genAspect);

      positions[gen.id] = { x: genX, y: 0, width: genWidth, height: genHeight };

      // Each subsequent generation goes further right
      genX += genWidth + GENERATION_OFFSET_X;
    }

    // Advance x past all generations
    currentX = (gens.length > 0 ? genX : currentX + width) + HORIZONTAL_GAP;
  }

  // Handle orphan generations/videos/finalizations (whose parent image isn't in originals list)
  const orphanGens = items.filter(
    (i) =>
      (i.type === "generation" ||
        i.type === "video" ||
        i.type === "finalized_video") &&
      !originals.some((o) => o.id === i.imageId)
  );
  for (const gen of orphanGens) {
    if (positions[gen.id]) continue;
    const aspect = gen.naturalHeight && gen.naturalWidth
      ? gen.naturalHeight / gen.naturalWidth
      : 3 / 4;
    const width = DEFAULT_WIDTH;
    const height = Math.round(width * aspect);
    positions[gen.id] = { x: currentX, y: 0, width, height };
    currentX += width + HORIZONTAL_GAP;
  }

  return positions;
}

export function useCanvasPositions(projectId: string, seeds: CanvasItemSeed[]) {
  const storageKey = STORAGE_PREFIX + projectId;

  // Always start with auto-layout (deterministic, same on server and client)
  const [positions, setPositions] = useState<Record<string, ItemPosition>>(() =>
    computeAutoLayout(seeds)
  );

  // Hydrate from localStorage on mount (client-only)
  const hasHydrated = useRef(false);
  useEffect(() => {
    if (hasHydrated.current) return;
    hasHydrated.current = true;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, ItemPosition>;
        const autoLayout = computeAutoLayout(seeds);
        const merged: Record<string, ItemPosition> = {};
        for (const seed of seeds) {
          merged[seed.id] = parsed[seed.id] ?? autoLayout[seed.id] ?? { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_WIDTH * 0.75 };
        }
        setPositions(merged);
      }
    } catch {
      // Corrupted storage — keep auto-layout
    }
  }, [storageKey, seeds]);

  // Debounced save to localStorage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const persistPositions = useCallback(
    (updated: Record<string, ItemPosition>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // localStorage full or unavailable — ignore
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [storageKey]
  );

  const updatePosition = useCallback(
    (id: string, partial: Partial<ItemPosition>) => {
      setPositions((prev) => {
        const current = prev[id];
        if (!current) return prev;
        const updated = { ...prev, [id]: { ...current, ...partial } };
        persistPositions(updated);
        return updated;
      });
    },
    [persistPositions]
  );

  // Add a new item at a specific position (for newly uploaded images or new generations)
  const addItemPosition = useCallback(
    (id: string, position: ItemPosition) => {
      setPositions((prev) => {
        const updated = { ...prev, [id]: position };
        persistPositions(updated);
        return updated;
      });
    },
    [persistPositions]
  );

  // Replace an item's key (e.g. swap placeholder UUID → real DB ID after generation)
  const replaceItemId = useCallback(
    (oldId: string, newId: string) => {
      setPositions((prev) => {
        const pos = prev[oldId];
        if (!pos || oldId === newId) return prev;
        const updated = { ...prev, [newId]: pos };
        delete updated[oldId];
        persistPositions(updated);
        return updated;
      });
    },
    [persistPositions]
  );

  // Remove items from the position map (for deletion)
  const removeItemPositions = useCallback(
    (ids: string[]) => {
      setPositions((prev) => {
        const updated = { ...prev };
        for (const id of ids) delete updated[id];
        persistPositions(updated);
        return updated;
      });
    },
    [persistPositions]
  );

  return {
    positions,
    updatePosition,
    addItemPosition,
    replaceItemId,
    removeItemPositions,
  };
}

export { DEFAULT_WIDTH, GENERATION_OFFSET_X };
