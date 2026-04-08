import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ASSET_CARD_ENTRY_FRAMES } from "../lib/timing";

export interface AssetCardProps {
  thumbnailUrl: string;
  name: string;
  delayFrames: number;
}

/**
 * A single glass-morphism card showing a plant/hardscape thumbnail and
 * name. Slides up + fades in starting at `delayFrames` over
 * ASSET_CARD_ENTRY_FRAMES.
 */
export const AssetCard: React.FC<AssetCardProps> = ({
  thumbnailUrl,
  name,
  delayFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - delayFrames);

  const enterSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 200, mass: 0.8 },
    durationInFrames: ASSET_CARD_ENTRY_FRAMES,
  });

  const opacity = interpolate(localFrame, [0, ASSET_CARD_ENTRY_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(enterSpring, [0, 1], [24, 0]);

  if (frame < delayFrames) {
    return null;
  }

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        // Glass morphism: dark frosted card matching the address + branding
        backgroundColor: "rgba(15, 15, 18, 0.55)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        borderRadius: 16,
        padding: "12px 16px 12px 12px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
        minWidth: 220,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          overflow: "hidden",
          // Thumbnails have white backgrounds, so keep an inner white plate
          // so the contrast against the dark glass card is correct.
          backgroundColor: "white",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid rgba(255, 255, 255, 0.2)",
        }}
      >
        <Img
          src={thumbnailUrl}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
      <div
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 18,
          fontWeight: 600,
          color: "white",
          letterSpacing: -0.2,
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
        }}
      >
        {name}
      </div>
    </div>
  );
};

export interface AssetCardsProps {
  assets: { thumbnailUrl: string; name: string }[];
  startFrame: number;
  staggerFrames: number;
}

/**
 * Row of asset cards anchored to the bottom-left of the frame, animating
 * in sequentially starting at `startFrame`. The row is width-constrained
 * to leave space for the BrandingCard at bottom-right.
 */
export const AssetCards: React.FC<AssetCardsProps> = ({
  assets,
  startFrame,
  staggerFrames,
}) => {
  if (assets.length === 0) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "flex-start",
        padding: 48,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          // Cap at ~50% width so the BrandingCard has room on the right.
          maxWidth: "55%",
        }}
      >
        {assets.map((asset, i) => (
          <AssetCard
            key={`${asset.name}-${i}`}
            thumbnailUrl={asset.thumbnailUrl}
            name={asset.name}
            delayFrames={startFrame + i * staggerFrames}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
