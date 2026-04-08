import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ADDRESS_CARD_FADE_FRAMES } from "../lib/timing";

export interface AddressCardProps {
  address: string;
  /**
   * Composition frame at which the card should begin fading out. The card
   * fades over ADDRESS_CARD_FADE_FRAMES and is fully gone shortly after.
   * Pass a frame past the end of the composition to keep it visible the
   * whole time.
   */
  fadeOutAtFrame: number;
}

/**
 * Glass-morphism address card overlaying the bottom-left of the frame
 * for the duration of the veo phase. Fades in at frame 0 and fades out
 * shortly before the asset cards take over the bottom-left area.
 */
export const AddressCard: React.FC<AddressCardProps> = ({
  address,
  fadeOutAtFrame,
}) => {
  const frame = useCurrentFrame();

  // Fade in over ADDRESS_CARD_FADE_FRAMES at frame 0
  const fadeIn = interpolate(
    frame,
    [0, ADDRESS_CARD_FADE_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Fade out over ADDRESS_CARD_FADE_FRAMES ending at fadeOutAtFrame
  const fadeOut = interpolate(
    frame,
    [fadeOutAtFrame - ADDRESS_CARD_FADE_FRAMES, fadeOutAtFrame],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = Math.min(fadeIn, fadeOut);
  if (opacity <= 0) return null;

  // Subtle slide-up on entry
  const translateY = interpolate(
    frame,
    [0, ADDRESS_CARD_FADE_FRAMES],
    [12, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

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
          opacity,
          transform: `translateY(${translateY}px)`,
          // Glass morphism: dark frosted card with a subtle inner highlight
          backgroundColor: "rgba(15, 15, 18, 0.55)",
          backdropFilter: "blur(20px) saturate(140%)",
          WebkitBackdropFilter: "blur(20px) saturate(140%)",
          borderRadius: 14,
          padding: "12px 18px",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow:
            "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 16,
          fontWeight: 500,
          color: "white",
          letterSpacing: -0.1,
          maxWidth: 480,
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
        }}
      >
        {address}
      </div>
    </AbsoluteFill>
  );
};
