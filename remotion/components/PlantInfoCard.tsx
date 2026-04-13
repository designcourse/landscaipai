import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Manrope";
import type { FinalizeVideoAsset } from "../compositions/FinalizeVideo";
import {
  COMPOSITION_FPS,
  PLANT_INFO_ENTER_FRAMES,
  PLANT_INFO_EXIT_FRAMES,
  PLANT_INFO_PILL_STAGGER_FRAMES,
  PLANT_INFO_SECONDS_PER_ASSET,
  PLANT_INFO_TEXT_STAGGER_FRAMES,
} from "../lib/timing";

const { fontFamily } = loadFont();

const ASSET_FRAMES = PLANT_INFO_SECONDS_PER_ASSET * COMPOSITION_FPS; // 150

// Exact colors from Figma design
const SLIDE_BG = "#FFFFFF";
const PILL_BG = "#F9F2E7";

/** Format a min/max range into a human-readable string. */
function formatRange(
  min: number | null,
  max: number | null,
  unit: string
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    return min === max ? `${min} ${unit}` : `${min}-${max} ${unit}`;
  }
  return `${min ?? max} ${unit}`;
}

/** Format hardiness zone range. */
function formatZone(min: string | null, max: string | null): string | null {
  if (!min && !max) return null;
  if (min && max) return `${min}-${max}`;
  return min ?? max;
}

interface AttributePill {
  label: string;
  value: string;
}

function getAttributePills(asset: FinalizeVideoAsset): AttributePill[] {
  const pills: AttributePill[] = [];

  const zone = formatZone(asset.zoneMin, asset.zoneMax);
  if (zone) pills.push({ label: "Hardiness Zone", value: zone });

  const height = formatRange(asset.heightMinFt, asset.heightMaxFt, "ft");
  if (height) pills.push({ label: "Height", value: height });

  const spread = formatRange(asset.spreadMinFt, asset.spreadMaxFt, "ft");
  if (spread) pills.push({ label: "Spread", value: spread });

  if (asset.sunRequirement) {
    pills.push({ label: "Sun", value: asset.sunRequirement });
  }
  if (asset.waterNeeds) {
    pills.push({ label: "Water", value: asset.waterNeeds });
  }
  if (asset.growthRate) {
    pills.push({ label: "Growth Rate", value: asset.growthRate });
  }
  if (asset.maintenanceLevel) {
    pills.push({ label: "Maintenance", value: asset.maintenanceLevel });
  }

  return pills;
}

// ---------------------------------------------------------------------------
// Animated element: clip-mask Y-axis reveal with spring
// ---------------------------------------------------------------------------
const AnimatedReveal: React.FC<{
  children: React.ReactNode;
  delayFrames: number;
  exitStartFrame: number;
}> = ({ children, delayFrames, exitStartFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Enter animation
  const enterLocal = Math.max(0, frame - delayFrames);
  const enterSpring = spring({
    frame: enterLocal,
    fps,
    config: { damping: 200, mass: 0.7 },
    durationInFrames: PLANT_INFO_ENTER_FRAMES,
  });
  const enterY = interpolate(enterSpring, [0, 1], [40, 0]);
  const enterOpacity = interpolate(
    enterLocal,
    [0, PLANT_INFO_ENTER_FRAMES * 0.6],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Exit animation
  const exitLocal = Math.max(0, frame - exitStartFrame);
  const exitProgress = interpolate(
    exitLocal,
    [0, PLANT_INFO_EXIT_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const exitY = interpolate(exitProgress, [0, 1], [0, -30]);
  const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);

  // Combined
  const isBeforeEntry = frame < delayFrames;
  const isExiting = frame >= exitStartFrame;

  if (isBeforeEntry) return null;

  const opacity = isExiting ? exitOpacity : enterOpacity;
  const translateY = isExiting ? exitY : enterY;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Single plant info card (one full-screen slide per asset)
// ---------------------------------------------------------------------------
const PlantInfoSlide: React.FC<{
  asset: FinalizeVideoAsset;
}> = ({ asset }) => {
  const { width, height } = useVideoConfig();
  const isLandscape = width > height;

  const pills = getAttributePills(asset);

  // Proportional sizing — all values relative to composition dimensions
  const scale = Math.min(width, height) / 1080;

  // Exit starts near the end of this slide's time window, leaving room
  // for the exit animation to complete.
  const exitStartFrame = ASSET_FRAMES - PLANT_INFO_EXIT_FRAMES;

  // Thumbnail animation has no delay (enters first)
  const thumbnailDelay = 0;
  // Title enters slightly after thumbnail
  const titleDelay = PLANT_INFO_TEXT_STAGGER_FRAMES;
  // Description enters after title
  const descDelay = titleDelay + PLANT_INFO_TEXT_STAGGER_FRAMES;
  // First pill enters after description
  const pillsStartDelay = descDelay + PLANT_INFO_TEXT_STAGGER_FRAMES;

  const thumbnailSize = isLandscape
    ? { w: width * 0.3, h: height * 0.55 }
    : { w: width * 0.55, h: height * 0.32 };

  const titleFontSize = Math.round(59 * scale * (isLandscape ? 1 : 0.85));
  const descFontSize = Math.round(31 * scale * (isLandscape ? 1 : 0.85));
  const pillFontSize = Math.round(28 * scale * (isLandscape ? 1 : 0.8));
  const pillPadX = Math.round(35 * scale);
  const pillPadY = Math.round(18 * scale);
  const pillGap = Math.round(12 * scale);
  const sectionGap = Math.round(70 * scale);
  const textGap = Math.round(20 * scale);

  // Shared pill list renderer
  const pillList = pills.length > 0 && (
    <div style={{ display: "flex", flexDirection: "column", gap: pillGap }}>
      {pills.map((pill, i) => (
        <AnimatedReveal
          key={pill.label}
          delayFrames={pillsStartDelay + i * PLANT_INFO_PILL_STAGGER_FRAMES}
          exitStartFrame={exitStartFrame}
        >
          <div
            style={{
              backgroundColor: PILL_BG,
              borderRadius: 80,
              padding: `${pillPadY}px ${pillPadX}px`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 700,
                fontSize: pillFontSize,
                lineHeight: 1,
                color: "black",
              }}
            >
              {pill.label}
            </span>
            <span
              style={{
                fontFamily,
                fontWeight: 400,
                fontSize: pillFontSize,
                lineHeight: 1,
                color: "black",
              }}
            >
              {pill.value}
            </span>
          </div>
        </AnimatedReveal>
      ))}
    </div>
  );

  if (isLandscape) {
    // ---- LANDSCAPE: flex row — image | divider | text ----
    const sidePad = Math.round(width * 0.06);
    const dividerGap = Math.round(50 * scale);

    return (
      <AbsoluteFill style={{ backgroundColor: SLIDE_BG }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            padding: `0 ${sidePad}px`,
          }}
        >
          {/* Thumbnail — left side */}
          <AnimatedReveal delayFrames={thumbnailDelay} exitStartFrame={exitStartFrame}>
            <div
              style={{
                width: thumbnailSize.w,
                height: thumbnailSize.h,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Img
                src={asset.thumbnailUrl}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          </AnimatedReveal>

          {/* Vertical divider */}
          <AnimatedReveal delayFrames={thumbnailDelay} exitStartFrame={exitStartFrame}>
            <div
              style={{
                width: 1,
                height: height * 0.76,
                backgroundColor: "#e0e0e0",
                flexShrink: 0,
                marginLeft: dividerGap,
                marginRight: dividerGap,
              }}
            />
          </AnimatedReveal>

          {/* Text content — right side */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: sectionGap,
            }}
          >
            {/* Name + description */}
            <div style={{ display: "flex", flexDirection: "column", gap: textGap }}>
              <AnimatedReveal delayFrames={titleDelay} exitStartFrame={exitStartFrame}>
                <div
                  style={{
                    fontFamily,
                    fontWeight: 700,
                    fontSize: titleFontSize,
                    lineHeight: 1.2,
                    color: "black",
                  }}
                >
                  {asset.name}
                </div>
              </AnimatedReveal>
              {asset.description && (
                <AnimatedReveal delayFrames={descDelay} exitStartFrame={exitStartFrame}>
                  <div
                    style={{
                      fontFamily,
                      fontWeight: 400,
                      fontSize: descFontSize,
                      lineHeight: 1.45,
                      color: "black",
                    }}
                  >
                    {asset.description}
                  </div>
                </AnimatedReveal>
              )}
            </div>

            {pillList}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // ---- PORTRAIT: flex column — image top, text below (centered) ----
  const topPad = Math.round(height * 0.06);
  const sidePadP = Math.round(width * 0.08);
  const imageTextGap = Math.round(30 * scale);

  return (
    <AbsoluteFill style={{ backgroundColor: SLIDE_BG }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: `${topPad}px ${sidePadP}px`,
        }}
      >
        {/* Thumbnail — top center */}
        <AnimatedReveal delayFrames={thumbnailDelay} exitStartFrame={exitStartFrame}>
          <div
            style={{
              width: thumbnailSize.w,
              height: thumbnailSize.h,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Img
              src={asset.thumbnailUrl}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        </AnimatedReveal>

        <div style={{ height: imageTextGap, flexShrink: 0 }} />

        {/* Text content — below thumbnail */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: sectionGap,
          }}
        >
          {/* Name + description (centered) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: textGap,
              textAlign: "center",
            }}
          >
            <AnimatedReveal delayFrames={titleDelay} exitStartFrame={exitStartFrame}>
              <div
                style={{
                  fontFamily,
                  fontWeight: 700,
                  fontSize: titleFontSize,
                  lineHeight: 1.2,
                  color: "black",
                }}
              >
                {asset.name}
              </div>
            </AnimatedReveal>
            {asset.description && (
              <AnimatedReveal delayFrames={descDelay} exitStartFrame={exitStartFrame}>
                <div
                  style={{
                    fontFamily,
                    fontWeight: 400,
                    fontSize: descFontSize,
                    lineHeight: 1.45,
                    color: "black",
                  }}
                >
                  {asset.description}
                </div>
              </AnimatedReveal>
            )}
          </div>

          {pillList}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// PlantInfoSequence: renders all asset slides back-to-back
// ---------------------------------------------------------------------------
export interface PlantInfoSequenceProps {
  assets: FinalizeVideoAsset[];
  /** The frame (in composition time) where the first plant info slide starts. */
  startFrame: number;
}

/**
 * Renders one full-screen plant info slide per asset, each lasting
 * PLANT_INFO_SECONDS_PER_ASSET seconds. Wraps each in a <Sequence> so
 * useCurrentFrame() rebases to 0 for clean animation timing.
 */
export const PlantInfoSequence: React.FC<PlantInfoSequenceProps> = ({
  assets,
  startFrame,
}) => {
  if (assets.length === 0) return null;

  return (
    <>
      {assets.map((asset, i) => (
        <Sequence
          key={`plant-info-${asset.name}-${i}`}
          from={startFrame + i * ASSET_FRAMES}
          durationInFrames={ASSET_FRAMES}
          layout="none"
        >
          <PlantInfoSlide asset={asset} />
        </Sequence>
      ))}
    </>
  );
};
