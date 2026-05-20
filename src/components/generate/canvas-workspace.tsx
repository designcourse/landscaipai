"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePurchaseCredits } from "@/components/billing/purchase-credits-modal-context";
import { validateImageFile, ACCEPTED_IMAGE_TYPES } from "@/lib/utils/images";
import { getUploadPath, BUCKET_UPLOADS } from "@/lib/utils/storage";
import {
  STYLE_PRESETS,
  TIME_OF_DAY_OPTIONS,
  SEASON_OPTIONS,
  WEATHER_OPTIONS,
} from "@/lib/gemini/prompts";
import { InfiniteCanvas } from "./infinite-canvas";
import { CanvasImageCard, type CanvasItem } from "./canvas-image-card";
import { MobileVideoFramePicker } from "./mobile-video-frame-picker";
import { CanvasToolbar } from "./canvas-toolbar";
import { CanvasBottomBar } from "./canvas-bottom-bar";
import { CanvasMobileToolbar } from "./canvas-mobile-toolbar";
import { CanvasMobileDock } from "./canvas-mobile-dock";
import { ZoomIndicator } from "./zoom-indicator";
import { InpaintCanvas } from "./inpaint-canvas";
import { PlantBrowser } from "./plant-browser";
import { VideoGenerationModal, type VideoGenerationSubmit } from "./video-generation-modal";
import { FinalizeVideoModal } from "./finalize-video-modal";
import { EditorOnboarding } from "./editor-onboarding";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  VIDEO_MODELS,
  CAMERA_PRESETS,
  TRANSITION_PRESETS,
} from "@/lib/gemini/video-prompts";
import { useCanvasViewport } from "@/hooks/use-canvas-viewport";
import {
  useCanvasPositions,
  DEFAULT_WIDTH,
  GENERATION_OFFSET_X,
  type CanvasItemSeed,
} from "@/hooks/use-canvas-positions";
import type {
  Image,
  Generation,
  LibraryItem,
  VideoFinalization,
  VideoGeneration,
} from "@/types";

type GenerationWithUrl = Generation & { url: string };
type ImageWithUrl = Image & { url: string };
type VideoGenerationWithUrl = VideoGeneration & { url: string };
type VideoFinalizationWithUrl = VideoFinalization & { url: string };

interface CanvasWorkspaceProps {
  project: { id: string; name: string; hardiness_zone: string | null };
  images: ImageWithUrl[];
  generations: GenerationWithUrl[];
  videoGenerations?: VideoGenerationWithUrl[];
  videoFinalizations?: VideoFinalizationWithUrl[];
  creditsBalance: number;
  userProfile: { full_name: string | null; avatar_url: string | null; email: string };
  userId: string;
}

// Build a human-readable prompt summary from generation metadata
function buildDisplayPrompt(gen: GenerationWithUrl): string {
  const parts: string[] = [];
  if (gen.style_preset) {
    const preset = STYLE_PRESETS.find((s) => s.id === gen.style_preset);
    if (preset) parts.push(preset.name + " style");
  }
  if (gen.time_of_day) parts.push(gen.time_of_day);
  if (gen.season) parts.push(gen.season);
  if (gen.weather) parts.push(gen.weather);
  return parts.join(" · ");
}

function buildCanvasItems(
  images: ImageWithUrl[],
  generations: GenerationWithUrl[],
  videos: VideoGenerationWithUrl[] = [],
  finalizations: VideoFinalizationWithUrl[] = []
): CanvasItem[] {
  const items: CanvasItem[] = [];

  for (const img of images) {
    items.push({
      id: img.id,
      type: "original",
      imageId: img.id,
      url: img.url,
      naturalWidth: img.width ?? 1200,
      naturalHeight: img.height ?? 900,
      status: "ready",
    });
  }

  for (const gen of generations) {
    // Inherit dimensions from the source image so aspect ratio matches
    const sourceImage = images.find((img) => img.id === gen.image_id);
    const natWidth = sourceImage?.width ?? 1200;
    const natHeight = sourceImage?.height ?? 900;

    items.push({
      id: gen.id,
      type: "generation",
      imageId: gen.image_id,
      url: gen.url,
      naturalWidth: natWidth,
      naturalHeight: natHeight,
      generation: gen,
      title: gen.style_preset
        ? STYLE_PRESETS.find((s) => s.id === gen.style_preset)?.name?.toUpperCase() ?? "AI GENERATED"
        : "AI GENERATED",
      // DB-loaded: use custom_prompt from DB, plus settings summary
      userPrompt: gen.custom_prompt || undefined,
      settingsSummary: buildDisplayPrompt(gen) || undefined,
      // DB-loaded library tags
      libraryTags: gen.selected_library_items?.map((li) => ({
        id: li.id,
        name: li.name,
        thumbnailUrl: li.thumbnail_url,
      })) ?? undefined,
      status: "ready",
    });
  }

  for (const vg of videos) {
    // Resolve the "source image" this video chain belongs to (use start frame's image)
    const startImageId =
      vg.start_image_id ||
      generations.find((g) => g.id === vg.start_generation_id)?.image_id ||
      null;
    const sourceImage = startImageId ? images.find((i) => i.id === startImageId) : undefined;
    const natWidth = vg.width ?? sourceImage?.width ?? 1200;
    const natHeight = vg.height ?? sourceImage?.height ?? 900;

    const modelShort = vg.model.includes("fast") ? "VEO FAST" : "VEO";
    const cameraLabel = vg.camera_preset
      ? vg.camera_preset.replace(/_/g, " ").toUpperCase()
      : "VIDEO";
    const resLabel = vg.resolution === "1080p" ? "1080p" : "720p";

    items.push({
      id: vg.id,
      type: "video",
      imageId: startImageId ?? vg.id,
      url: vg.url,
      naturalWidth: natWidth,
      naturalHeight: natHeight,
      title: `${modelShort} · ${cameraLabel}`,
      settingsSummary: `${resLabel} · ${vg.duration_seconds}s · ${vg.transition_preset ?? ""}`,
      status: "ready",
    });
  }

  // Finalized videos — siblings of their source veo video, with a "Finalized" badge.
  // Inherit dimensions from the source veo so the card aspect ratio matches.
  for (const fin of finalizations) {
    const sourceVideo = videos.find((v) => v.id === fin.video_generation_id);
    if (!sourceVideo) continue; // shouldn't happen — DB FK guarantees this

    const startImageId =
      sourceVideo.start_image_id ||
      generations.find((g) => g.id === sourceVideo.start_generation_id)?.image_id ||
      null;

    const natWidth =
      sourceVideo.actual_width ?? sourceVideo.width ?? 1280;
    const natHeight =
      sourceVideo.actual_height ?? sourceVideo.height ?? 720;

    items.push({
      id: fin.id,
      type: "finalized_video",
      imageId: startImageId ?? sourceVideo.id,
      url: fin.url,
      naturalWidth: natWidth,
      naturalHeight: natHeight,
      title: "FINALIZED",
      settingsSummary: "Branded · Ready to share",
      status: "ready",
      sourceVideoGenerationId: sourceVideo.id,
    });
  }

  return items;
}

export function CanvasWorkspace({
  project,
  images: initialImages,
  generations: initialGenerations,
  videoGenerations: initialVideoGenerations = [],
  videoFinalizations: initialVideoFinalizations = [],
  creditsBalance: initialCredits,
  userProfile,
  userId,
}: CanvasWorkspaceProps) {
  const router = useRouter();
  const { open: openPurchaseCredits } = usePurchaseCredits();
  const isMobile = useIsMobile(1024);

  // Canvas items state
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>(() =>
    buildCanvasItems(
      initialImages,
      initialGenerations,
      initialVideoGenerations,
      initialVideoFinalizations
    )
  );
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  // Parallel ordered list to preserve selection order (first = start frame for video)
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);
  // Counter that fires the mobile dock to open the Prompt panel after an upload.
  const [openPromptSignal, setOpenPromptSignal] = useState(0);
  // Shared signal: true while a two-finger pinch gesture is active. InfiniteCanvas
  // writes to this ref; image cards read it to stop their own drag/resize math
  // so pinch-zoom-over-a-card works correctly.
  const pinchActiveRef = useRef(false);

  // Video generation state
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  // Mobile-only: when true the frame-picker sheet is open. Tapping the
  // selection bar's "Video" button sets this; confirming the picker writes
  // selection state in start→end order and opens the video modal.
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [videoSubmitting, setVideoSubmitting] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Finalize Video modal — holds the videoGenerationId being finalized.
  // null means the modal is closed.
  const [finalizeVideoId, setFinalizeVideoId] = useState<string | null>(null);

  // Credits
  const [credits, setCredits] = useState(initialCredits);

  // Form state
  const [style, setStyle] = useState<string | null>(null);
  const [timeOfDay, setTimeOfDay] = useState("");
  const [season, setSeason] = useState("");
  const [weather, setWeather] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI model choice (persisted). Options:
  //   "gemini" = Nano Banana 2, "gemini-pro" = Nano Banana Pro, "openai" = OpenAI Image 2.0
  const [imageModel, setImageModel] = useState<"gemini" | "gemini-pro" | "openai">("gemini");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("landscaip-image-model");
    if (stored === "gemini" || stored === "gemini-pro" || stored === "openai") setImageModel(stored);
  }, []);
  const handleImageModelChange = useCallback((next: "gemini" | "gemini-pro" | "openai") => {
    setImageModel(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("landscaip-image-model", next);
    }
  }, []);

  // First-run editor tour. Shown once per user (localStorage keyed by userId).
  const onboardingStorageKey = `landscaip-editor-onboarding-seen-${userId}`;
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(onboardingStorageKey);
    if (!seen) setShowOnboarding(true);
  }, [onboardingStorageKey]);
  const handleCloseOnboarding = useCallback(() => {
    setShowOnboarding(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(onboardingStorageKey, "1");
    }
  }, [onboardingStorageKey]);

  // In-painting state
  const [inpaintMode, setInpaintMode] = useState(false);
  const [inpaintImageUrl, setInpaintImageUrl] = useState<string>("");
  const [maskBase64, setMaskBase64] = useState<string | null>(null);
  const [rawMaskBase64, setRawMaskBase64] = useState<string | null>(null);

  // Plant browser state
  const [browserOpen, setBrowserOpen] = useState(false);
  const [selectedLibraryItems, setSelectedLibraryItems] = useState<LibraryItem[]>([]);
  const [browserFocusId, setBrowserFocusId] = useState<string | null>(null);

  // Upload refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Viewport (zoom/pan)
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const {
    viewport,
    setViewport,
    handleWheel,
    zoomIn,
    zoomOut,
    resetZoom,
    isSpaceDown,
    handleKeyDown,
    handleKeyUp,
    handlePointerDownForPan,
    handlePointerMoveForPan,
    handlePointerUpForPan,
  } = useCanvasViewport(project.id);

  // Positions (localStorage-backed)
  const positionSeeds: CanvasItemSeed[] = useMemo(
    () =>
      canvasItems.map((item) => ({
        id: item.id,
        type: item.type,
        imageId: item.imageId,
        naturalWidth: item.naturalWidth,
        naturalHeight: item.naturalHeight,
      })),
    [canvasItems]
  );
  const { positions, updatePosition, addItemPosition, replaceItemId, removeItemPositions } = useCanvasPositions(
    project.id,
    positionSeeds
  );

  // Keep a ref to the latest positions so the finalization-merge effect
  // below can read them without depending on `positions` (which would cause
  // it to re-fire on every drag).
  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // After router.refresh() (e.g. when a video finalization completes), the
  // server component re-runs and passes new initialVideoFinalizations down
  // as a prop. The useState initializer for canvasItems above only runs once
  // on mount, so without this effect the new finalized cards never make it
  // into local state. Merge any newly-arrived finalizations in AND position
  // them right next to their source veo video so the user sees them appear
  // close to where they kicked off the finalize.
  useEffect(() => {
    const fresh = buildCanvasItems(
      initialImages,
      initialGenerations,
      initialVideoGenerations,
      initialVideoFinalizations
    );

    setCanvasItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const newOnes = fresh.filter(
        (item) =>
          item.type === "finalized_video" && !existingIds.has(item.id)
      );
      if (newOnes.length === 0) return prev;

      // Position each new finalized video directly below its source veo so
      // it's clearly associated and doesn't collide with horizontal siblings
      // (other generations/videos for the same source image).
      for (const item of newOnes) {
        const sourceId = item.sourceVideoGenerationId;
        const sourcePos = sourceId ? positionsRef.current[sourceId] : null;
        if (sourcePos) {
          // Match the source aspect ratio at the same width
          const aspect = item.naturalHeight / item.naturalWidth;
          const width = sourcePos.width;
          const height = Math.round(width * aspect);
          addItemPosition(item.id, {
            x: sourcePos.x,
            y: sourcePos.y + sourcePos.height + 60,
            width,
            height,
          });
        }
      }

      return [...prev, ...newOnes];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVideoFinalizations]);

  // Keyboard listeners for space (pan), delete, and shortcuts
  const handleDeleteKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
        e.preventDefault();
        handleDeleteKeypress();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedItemIds.size, inpaintMode]
  );

  // Ctrl+C: copy the selected image to clipboard (single selection only)
  const handleCopyKey = useCallback(
    async (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "c") return;
      if (selectedItemIds.size !== 1) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;

      const item = canvasItems.find((i) => i.id === [...selectedItemIds][0]);
      if (!item) return;

      e.preventDefault();
      try {
        const res = await fetch(item.url);
        const blob = await res.blob();
        // Clipboard API requires image/png; convert if needed
        if (blob.type === "image/png") {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        } else {
          // Convert to PNG via canvas
          const imgEl = new window.Image();
          imgEl.crossOrigin = "anonymous";
          const blobUrl = URL.createObjectURL(blob);
          await new Promise<void>((resolve, reject) => {
            imgEl.onload = () => {
              const cvs = document.createElement("canvas");
              cvs.width = imgEl.naturalWidth;
              cvs.height = imgEl.naturalHeight;
              cvs.getContext("2d")!.drawImage(imgEl, 0, 0);
              cvs.toBlob(async (pngBlob) => {
                URL.revokeObjectURL(blobUrl);
                if (!pngBlob) { reject(new Error("Conversion failed")); return; }
                await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
                resolve();
              }, "image/png");
            };
            imgEl.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("Load failed")); };
            imgEl.src = blobUrl;
          });
        }
      } catch (err) {
        console.error("Failed to copy image:", err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedItemIds, canvasItems]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keydown", handleDeleteKey);
    window.addEventListener("keydown", handleCopyKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keydown", handleDeleteKey);
      window.removeEventListener("keydown", handleCopyKey);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp, handleDeleteKey, handleCopyKey]);

  // Fit-to-view on initial load — skip if viewport was restored from localStorage
  const hasAutoFit = useRef(false);
  useEffect(() => {
    if (hasAutoFit.current) return;
    const container = canvasContainerRef.current;
    if (!container || Object.keys(positions).length === 0) return;
    hasAutoFit.current = true;

    // If we already restored a viewport from localStorage, don't override it
    const storedViewport = localStorage.getItem(`canvas-viewport-${project.id}`);
    if (storedViewport) return;

    // Compute bounding box of all items
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pos of Object.values(positions)) {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + pos.width);
      maxY = Math.max(maxY, pos.y + pos.height + 120); // extra for metadata
    }
    if (!isFinite(minX)) return;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const padding = 80; // px padding around content
    const toolbarHeight = 74;
    const bottomBarHeight = 100;
    const availableWidth = container.clientWidth - padding * 2;
    const availableHeight = container.clientHeight - toolbarHeight - bottomBarHeight - padding * 2;

    const zoom = Math.min(
      availableWidth / contentWidth,
      availableHeight / contentHeight,
      1 // Don't zoom in past 100%
    );

    // Center the content
    const panX = -minX + (availableWidth / zoom - contentWidth) / 2 + padding / zoom;
    const panY = -minY + (availableHeight / zoom - contentHeight) / 2 + padding / zoom;

    setViewport({ zoom, panX, panY });
  }, [positions, setViewport]);

  // Primary selected item (last selected — used for generation context)
  const [primarySelectedId, setPrimarySelectedId] = useState<string | null>(null);
  const selectedItem = canvasItems.find((i) => i.id === primarySelectedId) ?? null;

  // Prompt collapse state (collapses when clicking canvas background)
  const [promptCollapsed, setPromptCollapsed] = useState(false);

  // Reference attachments (images pasted or attached by user as context for AI)
  interface ReferenceAttachment {
    id: string;
    name: string;
    previewUrl: string;
    blob: Blob;
  }
  const [referenceAttachments, setReferenceAttachments] = useState<ReferenceAttachment[]>([]);
  const MAX_ATTACHMENTS = 5;
  const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB per source file (compressed before send)
  const COMPRESS_MAX_DIM = 2048; // px — max dimension for compressed reference images
  const COMPRESS_QUALITY = 0.85;

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Compress/resize an image Blob to webp with a max dimension
  async function compressImage(source: Blob): Promise<Blob> {
    const url = URL.createObjectURL(source);
    try {
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = url;
      });
      const { naturalWidth: nw, naturalHeight: nh } = img;
      const scale = Math.min(1, COMPRESS_MAX_DIM / Math.max(nw, nh));
      const w = Math.max(1, Math.round(nw * scale));
      const h = Math.max(1, Math.round(nh * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2d context unavailable");
      ctx.drawImage(img, 0, 0, w, h);
      const out = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/webp", COMPRESS_QUALITY)
      );
      if (!out) throw new Error("Compression failed");
      return out;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function addCompressedAttachments(
    sources: { blob: Blob; name: string }[]
  ) {
    const remaining = MAX_ATTACHMENTS - referenceAttachments.length;
    if (remaining <= 0) {
      setError(`Max ${MAX_ATTACHMENTS} attachments allowed.`);
      return;
    }
    const slice = sources.slice(0, remaining);
    const errors: string[] = [];
    const added: ReferenceAttachment[] = [];

    for (const src of slice) {
      if (!src.blob.type.startsWith("image/")) {
        errors.push(`${src.name}: not an image`);
        continue;
      }
      if (src.blob.size > MAX_ATTACHMENT_SIZE) {
        errors.push(`${src.name}: ${formatBytes(src.blob.size)} exceeds ${formatBytes(MAX_ATTACHMENT_SIZE)} limit`);
        continue;
      }
      try {
        const compressed = await compressImage(src.blob);
        added.push({
          id: crypto.randomUUID(),
          name: src.name,
          previewUrl: URL.createObjectURL(compressed),
          blob: compressed,
        });
      } catch (err) {
        errors.push(`${src.name}: ${err instanceof Error ? err.message : "compression failed"}`);
      }
    }

    if (added.length > 0) {
      setReferenceAttachments((prev) => [...prev, ...added]);
    }
    if (errors.length > 0) {
      setError(errors.join(" · "));
    } else if (added.length > 0) {
      setError(null);
    }
  }

  function handleAddAttachmentFiles(files: FileList) {
    const sources: { blob: Blob; name: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      sources.push({ blob: files[i], name: files[i].name });
    }
    void addCompressedAttachments(sources);
  }

  function handlePasteAttachment(blob: Blob, name: string) {
    void addCompressedAttachments([{ blob, name }]);
  }

  function handleRemoveAttachment(id: string) {
    setReferenceAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  // Select an item. CTRL+click toggles in/out of selection.
  // If item is already selected (part of multi-select), just set it as primary for dragging.
  function handleSelectItem(id: string, e?: React.PointerEvent | React.MouseEvent) {
    const ctrlHeld = e?.ctrlKey || e?.metaKey;

    if (ctrlHeld) {
      // Toggle this item in/out of the selection set
      setSelectedItemIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          if (primarySelectedId === id) {
            setPrimarySelectedId(next.size > 0 ? [...next][next.size - 1] : null);
          }
        } else {
          next.add(id);
          setPrimarySelectedId(id);
        }
        return next;
      });
      // Update ordered list
      setSelectionOrder((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        return [...prev, id];
      });
    } else if (selectedItemIds.has(id) && selectedItemIds.size > 1) {
      // Item is already part of a multi-selection — just update primary for drag, don't deselect others
      setPrimarySelectedId(id);
    } else {
      setSelectedItemIds(new Set([id]));
      setSelectionOrder([id]);
      setPrimarySelectedId(id);
    }
    // Un-collapse the prompt when selecting an item
    setPromptCollapsed(false);
  }

  // Marquee selection: replace selection with a set of IDs
  function handleMarqueeSelect(ids: string[]) {
    const newSet = new Set(ids);
    setSelectedItemIds(newSet);
    setSelectionOrder(ids);
    if (ids.length > 0) setPrimarySelectedId(ids[ids.length - 1]);
    else setPrimarySelectedId(null);
  }

  // When selecting a generation, load its settings into the form (including prompt and library tags)
  useEffect(() => {
    if (!selectedItem || selectedItem.type !== "generation" || !selectedItem.generation) return;
    const gen = selectedItem.generation;
    setStyle(gen.style_preset ?? null);
    setTimeOfDay(gen.time_of_day ?? "");
    setSeason(gen.season ?? "");
    setWeather(gen.weather ?? "");
    // Restore the user's custom prompt
    setCustomPrompt(selectedItem.userPrompt ?? "");
    // Restore library tags as selected library items
    if (selectedItem.libraryTags && selectedItem.libraryTags.length > 0) {
      setSelectedLibraryItems(
        selectedItem.libraryTags.map((tag) => ({
          id: tag.id ?? tag.name,
          common_name: tag.name,
          item_type: "plant" as const,
          category: "",
          subcategory: "",
          scientific_name: null,
          description: null,
          image_path: null,
          thumbnail_path: tag.thumbnailUrl
            ? tag.thumbnailUrl.replace(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-library/`,
                ""
              )
            : null,
          zone_min: null,
          zone_max: null,
          height_min_ft: null,
          height_max_ft: null,
          spread_min_ft: null,
          spread_max_ft: null,
          sun_requirement: null,
          water_needs: null,
          growth_rate: null,
          maintenance_level: null,
          foliage_type: null,
          bloom_season: null,
          flower_colors: null,
          foliage_colors: null,
          drought_tolerant: false,
          deer_resistant: false,
          attracts_pollinators: false,
          native_regions: null,
          toxic_to_pets: false,
          material_type: null,
          color_options: null,
          design_styles: null,
          common_uses: null,
          created_at: "",
        }))
      );
    } else {
      setSelectedLibraryItems([]);
    }
  }, [primarySelectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear mask when selection changes
  useEffect(() => {
    setMaskBase64(null);
    setRawMaskBase64(null);
    setInpaintMode(false);
  }, [primarySelectedId]);

  // --- Handlers ---

  function handleCanvasDeselect() {
    setSelectedItemIds(new Set());
    setSelectionOrder([]);
    setPrimarySelectedId(null);
    setPromptCollapsed(true);
  }

  function handleEditRegion(id: string) {
    const item = canvasItems.find((i) => i.id === id);
    if (!item) return;
    handleSelectItem(id);
    setInpaintImageUrl(item.url);
    setInpaintMode(true);
  }

  // Group drag: move all selected items by the same delta
  function handleGroupPositionChange(id: string, partial: Partial<{ x: number; y: number }>) {
    if (selectedItemIds.has(id) && selectedItemIds.size > 1 && partial.x !== undefined && partial.y !== undefined) {
      const oldPos = positions[id];
      if (!oldPos) return;
      const dx = partial.x - oldPos.x;
      const dy = partial.y - oldPos.y;
      for (const selectedId of selectedItemIds) {
        const pos = positions[selectedId];
        if (pos) {
          updatePosition(selectedId, { x: pos.x + dx, y: pos.y + dy });
        }
      }
    } else {
      updatePosition(id, partial);
    }
  }

  function handleMaskConfirm(overlayDataUrl: string, rawMaskDataUrl: string) {
    setMaskBase64(overlayDataUrl.replace(/^data:image\/\w+;base64,/, ""));
    setRawMaskBase64(rawMaskDataUrl.replace(/^data:image\/\w+;base64,/, ""));
    setInpaintMode(false);
  }

  function handleMaskCancel() {
    setInpaintMode(false);
  }

  // --- Video generation ---

  // Resolve the two selected items in selection order (first = start, second = end).
  // Returns null if we don't have exactly 2 valid non-video selections.
  const videoFrames = useMemo(() => {
    const ordered = selectionOrder
      .filter((id) => selectedItemIds.has(id))
      .map((id) => canvasItems.find((i) => i.id === id))
      .filter((i): i is CanvasItem => !!i && i.type !== "video");
    if (ordered.length !== 2) return null;
    return { start: ordered[0], end: ordered[1] };
  }, [selectionOrder, selectedItemIds, canvasItems]);

  // Button state: needs 2 items, same aspect ratio (within 1% tolerance)
  const videoButtonState: "disabled-no-selection" | "disabled-aspect-mismatch" | "enabled" =
    useMemo(() => {
      if (!videoFrames) return "disabled-no-selection";
      const s = videoFrames.start;
      const e = videoFrames.end;
      if (!s.naturalWidth || !s.naturalHeight || !e.naturalWidth || !e.naturalHeight) {
        return "disabled-aspect-mismatch";
      }
      const sr = s.naturalWidth / s.naturalHeight;
      const er = e.naturalWidth / e.naturalHeight;
      if (Math.abs(sr - er) > 0.01) return "disabled-aspect-mismatch";
      return "enabled";
    }, [videoFrames]);

  function handleOpenVideoModal() {
    if (videoButtonState !== "enabled") return;
    setVideoError(null);
    setVideoModalOpen(true);
  }

  function buildVideoTitle(modelId: string, cameraId: string): string {
    const model = VIDEO_MODELS.find((m) => m.id === modelId);
    const cam = CAMERA_PRESETS.find((c) => c.id === cameraId);
    const modelShort = model?.name?.replace("Veo 3.1", "VEO").toUpperCase() ?? "VIDEO";
    return `${modelShort} · ${cam?.name?.toUpperCase() ?? "VIDEO"}`;
  }

  function buildVideoSettingsSummary(
    resolution: string,
    durationS: number,
    transitionId: string
  ): string {
    const tr = TRANSITION_PRESETS.find((t) => t.id === transitionId);
    const resLabel = resolution === "1080p" ? "1080p" : "720p";
    return `${resLabel} · ${durationS}s · ${tr?.name ?? ""}`;
  }

  async function handleVideoSubmit(values: VideoGenerationSubmit) {
    if (!videoFrames) return;
    // Apply the modal's swap toggle: if the user flipped them, the original
    // first-selected becomes the end frame and vice versa.
    const startItem = values.swapped ? videoFrames.end : videoFrames.start;
    const endItem = values.swapped ? videoFrames.start : videoFrames.end;

    // Close the modal immediately so the user can watch the placeholder appear
    // and the generation animation run on the canvas. Errors after this point
    // surface via the canvas-level error bar, not the modal.
    setVideoModalOpen(false);
    setVideoError(null);
    setVideoSubmitting(true);

    // Build frame source refs for the API
    const startFrame =
      startItem.type === "generation"
        ? { kind: "generation" as const, id: startItem.id }
        : { kind: "image" as const, id: startItem.imageId };
    const endFrame =
      endItem.type === "generation"
        ? { kind: "generation" as const, id: endItem.id }
        : { kind: "image" as const, id: endItem.imageId };

    // Create placeholder card on canvas — positioned below/right of the end frame
    const endPos = positions[endItem.id];
    const placeholderId = crypto.randomUUID();
    const placeholderWidth = endPos?.width ?? DEFAULT_WIDTH;
    const placeholderHeight = endPos?.height ?? DEFAULT_WIDTH * 0.75;

    // Place below the end frame so it doesn't collide with existing generations to the right
    let placeholderX = endPos?.x ?? 0;
    let placeholderY = (endPos?.y ?? 0) + placeholderHeight + 220;

    // Shift right if there's an overlap
    const metadataHeight = 200;
    const maxAttempts = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let hasOverlap = false;
      for (const [posId, pos] of Object.entries(positions)) {
        const posBottom = pos.y + pos.height + metadataHeight;
        const newBottom = placeholderY + placeholderHeight + metadataHeight;
        if (
          placeholderX < pos.x + pos.width &&
          placeholderX + placeholderWidth > pos.x &&
          placeholderY < posBottom &&
          newBottom > pos.y &&
          posId !== startItem.id &&
          posId !== endItem.id
        ) {
          placeholderX = pos.x + pos.width + GENERATION_OFFSET_X;
          hasOverlap = true;
          break;
        }
      }
      if (!hasOverlap) break;
    }

    const placeholderTitle = buildVideoTitle(values.modelId, values.cameraPresetId);
    const placeholderSettings = buildVideoSettingsSummary(
      values.resolution,
      8,
      values.transitionPresetId
    );

    const placeholder: CanvasItem = {
      id: placeholderId,
      type: "video",
      imageId: startItem.imageId,
      url: "",
      sourceUrl: startItem.url, // show start frame as poster during generation
      naturalWidth: startItem.naturalWidth,
      naturalHeight: startItem.naturalHeight,
      status: "generating",
      title: placeholderTitle,
      settingsSummary: placeholderSettings,
    };

    setCanvasItems((prev) => [...prev, placeholder]);
    addItemPosition(placeholderId, {
      x: placeholderX,
      y: placeholderY,
      width: placeholderWidth,
      height: placeholderHeight,
    });

    // Center viewport on placeholder
    const container = canvasContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setViewport({
        ...viewport,
        panX: -placeholderX + rect.width / 2 / viewport.zoom - placeholderWidth / 2,
        panY: -placeholderY + rect.height / 2 / viewport.zoom - placeholderHeight / 2,
      });
    }

    try {
      const res = await fetch("/api/generate/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          startFrame,
          endFrame,
          modelId: values.modelId,
          cameraPresetId: values.cameraPresetId,
          transitionPresetId: values.transitionPresetId,
          resolution: values.resolution,
          customPrompt: values.customPrompt || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Remove placeholder
        setCanvasItems((prev) => prev.filter((i) => i.id !== placeholderId));
        removeItemPositions([placeholderId]);
        if (data.code === "NO_CREDITS") {
          openPurchaseCredits({
            title: "Not enough credits for this video",
            subtitle: "Buy more credits to render this clip.",
          });
        } else {
          setError(data.error || "Failed to start video generation.");
        }
        setVideoSubmitting(false);
        return;
      }

      // Success — swap placeholder ID to real DB ID so polling lines up
      const realId = data.videoGeneration.id as string;
      setCanvasItems((prev) =>
        prev.map((i) => (i.id === placeholderId ? { ...i, id: realId } : i))
      );
      replaceItemId(placeholderId, realId);
      setCredits(data.credits_remaining);
      setVideoSubmitting(false);

      // Kick off polling — it runs independently of the modal being open
      pollVideoGeneration(realId);
    } catch (err) {
      console.error("Video generation request failed:", err);
      setCanvasItems((prev) => prev.filter((i) => i.id !== placeholderId));
      removeItemPositions([placeholderId]);
      setError("Network error. Please try again.");
      setVideoSubmitting(false);
    }
  }

  // Poll the video generation until it completes or fails.
  // Runs for up to ~10 minutes (60 attempts * 10s).
  async function pollVideoGeneration(videoGenerationId: string) {
    const MAX_ATTEMPTS = 60;
    const INTERVAL_MS = 10000;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));

      try {
        const res = await fetch(`/api/generate/video/${videoGenerationId}`);
        const data = await res.json();

        if (!res.ok) {
          // Mark the canvas item as failed
          setCanvasItems((prev) =>
            prev.map((i) =>
              i.id === videoGenerationId ? { ...i, status: "ready" as const } : i
            )
          );
          setError(data.error || "Video generation failed");
          return;
        }

        const vg = data.videoGeneration;
        if (vg.status === "completed" && vg.url) {
          // Swap placeholder to the real video
          setCanvasItems((prev) =>
            prev.map((i) =>
              i.id === videoGenerationId
                ? {
                    ...i,
                    url: vg.url,
                    status: "ready" as const,
                  }
                : i
            )
          );
          // Refresh credits (no-op if unchanged)
          return;
        }
        if (vg.status === "failed") {
          setCanvasItems((prev) => prev.filter((i) => i.id !== videoGenerationId));
          removeItemPositions([videoGenerationId]);
          setError(vg.error_message || "Video generation failed");
          return;
        }
        // Still processing — continue the loop
      } catch (err) {
        console.error("Video poll error:", err);
        // Transient network error — keep polling
      }
    }

    // Timeout — leave the placeholder, tell the user
    setError("Video generation is taking longer than expected. Refresh to check status.");
  }

  // --- Deletion ---
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Triggered from 3-dot menu on a single item or from keyboard shortcut
  function handleRequestDelete(id: string) {
    // If the item isn't already selected, select it so the modal reflects it
    if (!selectedItemIds.has(id)) {
      setSelectedItemIds(new Set([id]));
      setSelectionOrder([id]);
      setPrimarySelectedId(id);
    }
    setDeleteConfirmOpen(true);
  }

  // Triggered by Delete/Backspace key when items are selected
  function handleDeleteKeypress() {
    if (selectedItemIds.size === 0) return;
    // Don't show delete dialog if we're in an input or in inpaint mode
    if (inpaintMode) return;
    setDeleteConfirmOpen(true);
  }

  async function handleConfirmDelete() {
    if (deleting || selectedItemIds.size === 0) return;
    setDeleting(true);

    const idsToDelete = [...selectedItemIds];
    const itemsToDelete = canvasItems.filter((i) => idsToDelete.includes(i.id));

    // Also find any generations whose source original is being deleted
    const deletedOriginalImageIds = itemsToDelete
      .filter((i) => i.type === "original")
      .map((i) => i.imageId);

    // Gather child generations that would be orphaned
    const orphanedGenerationIds = canvasItems
      .filter(
        (i) =>
          i.type === "generation" &&
          deletedOriginalImageIds.includes(i.imageId) &&
          !idsToDelete.includes(i.id)
      )
      .map((i) => i.id);

    const allIdsToRemove = [...idsToDelete, ...orphanedGenerationIds];

    try {
      // Call the appropriate API for each item (in parallel)
      const deletePromises = itemsToDelete.map((item) => {
        const endpoint =
          item.type === "original"
            ? `/api/images/${item.imageId}`
            : item.type === "video"
              ? `/api/generate/video/${item.id}`
              : `/api/generations/${item.id}`;
        return fetch(endpoint, { method: "DELETE" });
      });

      const results = await Promise.allSettled(deletePromises);

      // Check for errors
      const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
      if (failed.length > 0) {
        console.error("Some deletions failed:", failed);
      }

      // Remove from canvas state
      setCanvasItems((prev) => prev.filter((i) => !allIdsToRemove.includes(i.id)));
      removeItemPositions(allIdsToRemove);
      setSelectedItemIds(new Set());
      setSelectionOrder([]);
      setPrimarySelectedId(null);
    } catch (err) {
      console.error("Delete failed:", err);
      setError("Failed to delete. Please try again.");
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  // --- Generation ---
  async function handleGenerate() {
    if (generating) return;
    if (!selectedItem) {
      setError("Select an image on the canvas first.");
      return;
    }

    // Validation
    if (maskBase64) {
      if (!customPrompt.trim()) {
        setError("Enter a prompt describing what to change in the selected area.");
        return;
      }
    } else {
      if (!style && !customPrompt.trim()) {
        setError("Select a style or enter a custom prompt.");
        return;
      }
    }

    setError(null);
    setGenerating(true);

    // Capture the user's prompt NOW (before async), so it's not lost across re-renders
    const capturedUserPrompt = customPrompt.trim();

    // Determine source image ID (the original upload this chain goes back to)
    const sourceImageId = selectedItem.imageId;
    const parentGenerationId =
      selectedItem.type === "generation" ? selectedItem.id : null;

    // Create placeholder to the right of the selected item, avoiding overlaps
    const selectedPos = positions[selectedItem.id];
    const placeholderId = crypto.randomUUID();
    const placeholderWidth = selectedPos?.width ?? DEFAULT_WIDTH;
    const placeholderHeight = selectedPos?.height ?? DEFAULT_WIDTH * 0.75;
    const placeholderY = selectedPos?.y ?? 0;
    // Extra height for metadata (title + tags + prompt) below the image
    const metadataHeight = 160;

    let placeholderX = (selectedPos?.x ?? 0) + (selectedPos?.width ?? DEFAULT_WIDTH) + GENERATION_OFFSET_X;

    // Check for overlaps and shift right until free
    const maxAttempts = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let hasOverlap = false;
      for (const [id, pos] of Object.entries(positions)) {
        if (id === selectedItem.id) continue;
        const posBottom = pos.y + pos.height + metadataHeight;
        const newBottom = placeholderY + placeholderHeight + metadataHeight;
        // Check if rectangles overlap
        if (
          placeholderX < pos.x + pos.width &&
          placeholderX + placeholderWidth > pos.x &&
          placeholderY < posBottom &&
          newBottom > pos.y
        ) {
          // Shift to the right edge of the overlapping item + gap
          placeholderX = pos.x + pos.width + GENERATION_OFFSET_X;
          hasOverlap = true;
          break;
        }
      }
      if (!hasOverlap) break;
    }

    const placeholder: CanvasItem = {
      id: placeholderId,
      type: "generation",
      imageId: sourceImageId,
      url: selectedItem.url,
      sourceUrl: selectedItem.url,
      naturalWidth: selectedItem.naturalWidth,
      naturalHeight: selectedItem.naturalHeight,
      status: "generating",
      title: style
        ? STYLE_PRESETS.find((s) => s.id === style)?.name?.toUpperCase() ?? "GENERATING..."
        : "GENERATING...",
    };

    setCanvasItems((prev) => [...prev, placeholder]);
    addItemPosition(placeholderId, {
      x: placeholderX,
      y: placeholderY,
      width: placeholderWidth,
      height: placeholderHeight,
    });

    // Center the viewport on the new generation
    const container = canvasContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setViewport({
        ...viewport,
        panX: -placeholderX + (rect.width / 2) / viewport.zoom - placeholderWidth / 2,
        panY: -placeholderY + (rect.height / 2) / viewport.zoom - placeholderHeight / 2,
      });
    }

    try {
      const endpoint = maskBase64 ? "/api/generate/inpaint" : "/api/generate";
      const selectedPlants = selectedLibraryItems
        .filter((i) => i.item_type === "plant")
        .map((i) => ({
          common_name: i.common_name,
          scientific_name: i.scientific_name,
          image_path: i.image_path,
        }));
      const selectedHardscape = selectedLibraryItems
        .filter((i) => i.item_type === "hardscape")
        .map((i) => ({ common_name: i.common_name, image_path: i.image_path }));

      // Convert reference attachments to base64 for the API
      let referenceImagesPayload: { base64: string; mimeType: string }[] | undefined;
      if (referenceAttachments.length > 0) {
        referenceImagesPayload = await Promise.all(
          referenceAttachments.map(async (att) => {
            const arrayBuffer = await att.blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = "";
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return {
              base64: btoa(binary),
              mimeType: att.blob.type || "image/png",
            };
          })
        );
      }

      const payload: Record<string, unknown> = {
        imageId: sourceImageId,
        projectId: project.id,
        style,
        timeOfDay: timeOfDay || undefined,
        season: season || undefined,
        weather: weather || undefined,
        customPrompt: customPrompt.trim() || undefined,
        parentGenerationId: parentGenerationId || undefined,
        selectedPlants: selectedPlants.length > 0 ? selectedPlants : undefined,
        selectedHardscape: selectedHardscape.length > 0 ? selectedHardscape : undefined,
        referenceImages: referenceImagesPayload,
        model: imageModel,
      };

      if (maskBase64) {
        payload.maskOverlayBase64 = maskBase64;
        payload.rawMaskBase64 = rawMaskBase64;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Remove placeholder on failure
        setCanvasItems((prev) => prev.filter((i) => i.id !== placeholderId));
        if (data.code === "NO_CREDITS") {
          openPurchaseCredits({
            title: "You're out of credits",
            subtitle: "Buy credits to keep generating.",
          });
        } else {
          setError(data.error || "Generation failed. Please try again.");
        }
        return;
      }

      // Build the real generation item from API response
      const genData = data.generation;
      const libraryTags = selectedLibraryItems.map((li) => ({
        name: li.common_name,
        id: li.id,
        thumbnailUrl: li.thumbnail_path
          ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-library/${li.thumbnail_path}`
          : "",
      }));

      // Build settings summary separately from user prompt
      const settingsParts: string[] = [];
      if (genData.style_preset) {
        const preset = STYLE_PRESETS.find((s: { id: string }) => s.id === genData.style_preset);
        if (preset) settingsParts.push(preset.name + " style");
      }
      if (genData.time_of_day) settingsParts.push(genData.time_of_day);
      if (genData.season) settingsParts.push(genData.season);
      if (genData.weather) settingsParts.push(genData.weather);
      const settingsSummary = settingsParts.join(" · ");

      // Replace placeholder with real generation — use the DB ID so positions persist across refresh
      const realId = genData.id as string;

      setCanvasItems((prev) =>
        prev.map((item) =>
          item.id === placeholderId
            ? {
                ...item,
                id: realId,
                url: genData.url,
                status: "revealing" as const,
                title: genData.style_preset
                  ? STYLE_PRESETS.find((s) => s.id === genData.style_preset)?.name?.toUpperCase() ?? "AI GENERATED"
                  : "AI GENERATED",
                generation: {
                  id: realId,
                  image_id: genData.image_id,
                  user_id: userId,
                  parent_generation_id: parentGenerationId,
                  storage_path: "",
                  prompt: genData.prompt,
                  custom_prompt: capturedUserPrompt || null,
                  selected_library_items: genData.selected_library_items ?? null,
                  style_preset: genData.style_preset,
                  time_of_day: genData.time_of_day,
                  season: genData.season,
                  weather: genData.weather,
                  is_inpaint: !!maskBase64,
                  input_tokens: null,
                  output_tokens: null,
                  generation_cost_cents: null,
                  status: "completed" as const,
                  error_message: null,
                  created_at: new Date().toISOString(),
                  image_model: genData.image_model ?? null,
                  url: genData.url,
                },
                libraryTags: libraryTags.length > 0 ? libraryTags : undefined,
                userPrompt: capturedUserPrompt || undefined,
                settingsSummary: settingsSummary || undefined,
              }
            : item
        )
      );

      // Swap position key from placeholder UUID → real DB ID so it persists across refresh
      replaceItemId(placeholderId, realId);

      setCredits(data.credits_remaining);
      setMaskBase64(null);
      setRawMaskBase64(null);
      handleSelectItem(realId);

      // After 2s reveal animation, set status to ready
      setTimeout(() => {
        setCanvasItems((prev) =>
          prev.map((item) =>
            item.id === realId ? { ...item, status: "ready" as const } : item
          )
        );
      }, 2200);
    } catch {
      setCanvasItems((prev) => prev.filter((i) => i.id !== placeholderId));
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // --- Upload ---
  async function handleUploadFile(file: File) {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const supabase = createClient();
    const imageId = crypto.randomUUID();
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = getUploadPath(userId, project.id, imageId, ext);

    // Get dimensions
    const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => {
        resolve({ width: 1200, height: 900 });
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_UPLOADS)
      .upload(storagePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setError("Upload failed: " + uploadError.message);
      return;
    }

    const { data: imageRecord, error: dbError } = await supabase
      .from("images")
      .insert({
        id: imageId,
        project_id: project.id,
        user_id: userId,
        storage_path: storagePath,
        original_filename: file.name,
        width: dimensions.width || null,
        height: dimensions.height || null,
        file_size_bytes: file.size,
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from(BUCKET_UPLOADS).remove([storagePath]);
      setError("Failed to save image: " + dbError.message);
      return;
    }

    const { data: urlData } = await supabase.storage
      .from(BUCKET_UPLOADS)
      .createSignedUrl(storagePath, 3600);

    const newItem: CanvasItem = {
      id: imageRecord.id,
      type: "original",
      imageId: imageRecord.id,
      url: urlData?.signedUrl ?? "",
      naturalWidth: dimensions.width,
      naturalHeight: dimensions.height,
      status: "ready",
    };

    // Place below all existing items (no overlap) and center view on it
    const container = canvasContainerRef.current;
    const aspect = dimensions.height / dimensions.width;
    const width = DEFAULT_WIDTH;
    const height = Math.round(width * aspect);

    // Find the bottom-most Y of existing items
    let maxBottom = 0;
    for (const pos of Object.values(positions)) {
      const bottom = pos.y + pos.height + 160; // 160 accounts for metadata below generations
      if (bottom > maxBottom) maxBottom = bottom;
    }

    const gap = 60;
    const newX = 0;
    const newY = Object.keys(positions).length > 0 ? maxBottom + gap : 0;

    setCanvasItems((prev) => [...prev, newItem]);
    addItemPosition(imageRecord.id, { x: newX, y: newY, width, height });
    handleSelectItem(imageRecord.id);

    // Center the viewport on the newly placed image
    if (container) {
      const rect = container.getBoundingClientRect();
      const panX = -newX + (rect.width / 2) / viewport.zoom - width / 2;
      const panY = -newY + (rect.height / 2) / viewport.zoom - height / 2;
      setViewport({ ...viewport, panX, panY });
    }

    // On mobile, surface the Prompt panel automatically so the user can
    // start describing what they want without hunting for the dock tab.
    if (isMobile) {
      setOpenPromptSignal((n) => n + 1);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleCameraClick() {
    cameraInputRef.current?.click();
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
    if (e.target) e.target.value = "";
  }

  // --- Zoom indicator helpers ---
  function handleZoomIn() {
    const el = canvasContainerRef.current;
    if (el) zoomIn(el.clientWidth, el.clientHeight);
  }

  function handleZoomOut() {
    const el = canvasContainerRef.current;
    if (el) zoomOut(el.clientWidth, el.clientHeight);
  }

  return (
    <div className="relative flex h-full w-full flex-col" ref={canvasContainerRef}>
      {/* Hidden file inputs for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Top Toolbar — mobile vs desktop variant */}
      {isMobile ? (
        <CanvasMobileToolbar
          projectId={project.id}
          projectName={project.name}
          credits={credits}
          onUpload={handleUploadClick}
        />
      ) : (
        <CanvasToolbar
          projectId={project.id}
          projectName={project.name}
          credits={credits}
          userProfile={userProfile}
          onUpload={handleUploadClick}
        />
      )}

      {/* Canvas area (fills remaining space) */}
      <div className="relative flex-1">
        <InfiniteCanvas
          viewport={viewport}
          setViewport={setViewport}
          onWheel={handleWheel}
          onPointerDown={handlePointerDownForPan}
          onPointerMove={handlePointerMoveForPan}
          onPointerUp={handlePointerUpForPan}
          isSpaceDown={isSpaceDown}
          onCanvasClick={handleCanvasDeselect}
          positions={positions}
          canvasItems={canvasItems}
          onMarqueeSelect={handleMarqueeSelect}
          pinchActiveRef={pinchActiveRef}
        >
          {canvasItems.map((item) => {
            const pos = positions[item.id];
            if (!pos) return null;
            return (
              <CanvasImageCard
                key={item.id}
                item={item}
                position={pos}
                selected={selectedItemIds.has(item.id)}
                zoom={viewport.zoom}
                isSpaceDown={isSpaceDown}
                onSelect={handleSelectItem}
                onPositionChange={handleGroupPositionChange}
                onEditRegion={handleEditRegion}
                onRequestDelete={handleRequestDelete}
                onLibraryTagClick={(tagId) => {
                  setBrowserFocusId(tagId);
                  setBrowserOpen(true);
                }}
                onRequestFinalize={(videoGenerationId) =>
                  setFinalizeVideoId(videoGenerationId)
                }
                pinchActiveRef={pinchActiveRef}
              />
            );
          })}
        </InfiniteCanvas>

        {/* Empty-state upload CTA — shown when project has no images */}
        {canvasItems.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
            <div
              className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border border-border bg-white p-6 text-center"
              style={{ boxShadow: "var(--shadow-md)" }}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--color-credits-badge-bg)" }}
              >
                <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">Add your first photo</p>
                <p className="text-sm text-muted-foreground">
                  Upload a picture of your home or yard to start designing.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2">
                {isMobile && (
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-light"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take photo
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className={
                    isMobile
                      ? "flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-white text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                      : "flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-light"
                  }
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  Choose photo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Zoom Indicator */}
        <ZoomIndicator
          zoom={viewport.zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={resetZoom}
        />

        {/* Bottom Bar — mobile dock vs desktop bar */}
        {isMobile ? (
          <CanvasMobileDock
            style={style}
            onStyleChange={setStyle}
            timeOfDay={timeOfDay}
            onTimeOfDayChange={setTimeOfDay}
            season={season}
            onSeasonChange={setSeason}
            weather={weather}
            onWeatherChange={setWeather}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            onGenerate={handleGenerate}
            onOpenLibrary={() => setBrowserOpen(true)}
            onOpenVideoModal={handleOpenVideoModal}
            videoButtonState={videoButtonState}
            generating={generating}
            credits={credits}
            hasSelection={selectedItemIds.size > 0}
            hasMask={!!maskBase64}
            error={error}
            selectedLibraryItems={selectedLibraryItems}
            onRemoveLibraryItem={(id) =>
              setSelectedLibraryItems((prev) => prev.filter((i) => i.id !== id))
            }
            onLibraryItemClick={(id) => {
              setBrowserFocusId(id);
              setBrowserOpen(true);
            }}
            attachments={referenceAttachments.map((a) => ({
              id: a.id,
              name: a.name,
              previewUrl: a.previewUrl,
            }))}
            onAddAttachmentFiles={handleAddAttachmentFiles}
            onPasteAttachment={handlePasteAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            imageModel={imageModel}
            onImageModelChange={handleImageModelChange}
            onEditRegion={
              primarySelectedId ? () => handleEditRegion(primarySelectedId) : undefined
            }
            onRequestDelete={
              primarySelectedId ? () => handleRequestDelete(primarySelectedId) : undefined
            }
            onOpenVideoPicker={
              primarySelectedId ? () => setVideoPickerOpen(true) : undefined
            }
            openPromptSignal={openPromptSignal}
          />
        ) : (
          <CanvasBottomBar
            style={style}
            onStyleChange={setStyle}
            timeOfDay={timeOfDay}
            onTimeOfDayChange={setTimeOfDay}
            season={season}
            onSeasonChange={setSeason}
            weather={weather}
            onWeatherChange={setWeather}
            customPrompt={customPrompt}
            onCustomPromptChange={setCustomPrompt}
            onGenerate={handleGenerate}
            onOpenLibrary={() => setBrowserOpen(true)}
            onOpenVideoModal={handleOpenVideoModal}
            videoButtonState={videoButtonState}
            generating={generating}
            credits={credits}
            hasSelection={selectedItemIds.size > 0}
            hasMask={!!maskBase64}
            error={error}
            selectedLibraryItems={selectedLibraryItems}
            onRemoveLibraryItem={(id) =>
              setSelectedLibraryItems((prev) => prev.filter((i) => i.id !== id))
            }
            onLibraryItemClick={(id) => {
              setBrowserFocusId(id);
              setBrowserOpen(true);
            }}
            promptCollapsed={promptCollapsed}
            attachments={referenceAttachments.map((a) => ({
              id: a.id,
              name: a.name,
              previewUrl: a.previewUrl,
            }))}
            onAddAttachmentFiles={handleAddAttachmentFiles}
            onPasteAttachment={handlePasteAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            imageModel={imageModel}
            onImageModelChange={handleImageModelChange}
          />
        )}
      </div>

      {/* In-painting canvas overlay */}
      {inpaintMode && (
        <InpaintCanvas
          imageUrl={inpaintImageUrl}
          onConfirm={handleMaskConfirm}
          onCancel={handleMaskCancel}
        />
      )}

      {/* Mobile video frame picker — sets selection in start→end order then
          opens the existing video modal so the rest of the pipeline is shared. */}
      {videoPickerOpen && (
        <MobileVideoFramePicker
          items={canvasItems}
          initialStartId={primarySelectedId}
          onCancel={() => setVideoPickerOpen(false)}
          onConfirm={(startId, endId) => {
            setSelectedItemIds(new Set([startId, endId]));
            setSelectionOrder([startId, endId]);
            setPrimarySelectedId(startId);
            setVideoPickerOpen(false);
            setVideoError(null);
            setVideoModalOpen(true);
          }}
        />
      )}

      {/* Video generation modal */}
      {videoModalOpen && videoFrames && (
        <VideoGenerationModal
          startFrame={{
            url: videoFrames.start.url,
            width: videoFrames.start.naturalWidth,
            height: videoFrames.start.naturalHeight,
          }}
          endFrame={{
            url: videoFrames.end.url,
            width: videoFrames.end.naturalWidth,
            height: videoFrames.end.naturalHeight,
          }}
          credits={credits}
          submitting={videoSubmitting}
          error={videoError}
          onClose={() => {
            if (!videoSubmitting) {
              setVideoModalOpen(false);
              setVideoError(null);
            }
          }}
          onSubmit={handleVideoSubmit}
        />
      )}

      {/* Finalize video modal */}
      {finalizeVideoId && (
        <FinalizeVideoModal
          videoGenerationId={finalizeVideoId}
          hardinessZone={project.hardiness_zone}
          onClose={() => setFinalizeVideoId(null)}
          onCompleted={() => {
            // Refresh the canvas so the new finalized video card appears.
            // Task 10 will wire the actual finalized_video item type into
            // the project query — for now, a server-component refresh is
            // enough to pick it up once that's done.
            router.refresh();
          }}
        />
      )}

      {/* Plant browser slide-over */}
      {browserOpen && (
        <PlantBrowser
          hardinessZone={project.hardiness_zone ?? null}
          selectedItems={selectedLibraryItems}
          onSelectionChange={setSelectedLibraryItems}
          onClose={() => {
            setBrowserOpen(false);
            setBrowserFocusId(null);
          }}
          focusItemId={browserFocusId}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmOpen && (() => {
        const selectedItems = canvasItems.filter((i) => selectedItemIds.has(i.id));
        const originalCount = selectedItems.filter((i) => i.type === "original").length;
        const generationCount = selectedItems.filter((i) => i.type === "generation").length;
        // Count orphaned generations (children of selected originals not themselves selected)
        const deletedOriginalImageIds = selectedItems.filter((i) => i.type === "original").map((i) => i.imageId);
        const orphanedCount = canvasItems.filter(
          (i) => i.type === "generation" && deletedOriginalImageIds.includes(i.imageId) && !selectedItemIds.has(i.id)
        ).length;
        const totalCount = selectedItems.length + orphanedCount;

        return (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
            onClick={() => !deleting && setDeleteConfirmOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-lg p-6"
              style={{ backgroundColor: "var(--color-background)", border: "1px solid var(--color-border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-1 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(220, 38, 38, 0.1)" }}
                >
                  <svg className="h-5 w-5" style={{ color: "var(--color-destructive)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--color-foreground)" }}>
                  Delete {totalCount === 1 ? "item" : `${totalCount} items`}?
                </h3>
              </div>

              <p className="mb-6 mt-3 text-sm leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
                {originalCount > 0 && (
                  <>
                    {originalCount === 1 ? "1 original photo" : `${originalCount} original photos`}
                    {orphanedCount > 0 && ` and ${orphanedCount === 1 ? "its 1 generation" : `their ${orphanedCount} generations`}`}
                    {generationCount > 0 && `, plus ${generationCount === 1 ? "1 generation" : `${generationCount} generations`}`}
                  </>
                )}
                {originalCount === 0 && (
                  <>{generationCount === 1 ? "1 AI generation" : `${generationCount} AI generations`}</>
                )}
                {" "}will be permanently deleted. This cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deleting}
                  className="rounded-md px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    color: "var(--color-foreground)",
                    backgroundColor: "var(--color-muted)",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
                  style={{
                    backgroundColor: deleting ? "#a3a3a3" : "var(--color-destructive)",
                  }}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* First-run editor tour */}
      {showOnboarding && <EditorOnboarding onClose={handleCloseOnboarding} />}

      {/* Shimmer animation keyframes */}
      <style jsx global>{`
        @keyframes canvas-shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </div>
  );
}
