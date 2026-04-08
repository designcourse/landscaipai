import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  BRANDING_ELEMENT_ENTRY_FRAMES,
  BRANDING_ELEMENT_STAGGER_FRAMES,
} from "../lib/timing";

export interface BrandingCardProps {
  logoUrl: string | null;
  companyName: string;
  companyPhone: string | null;
  note: string | null;
}

/**
 * Glass-morphism closing card anchored to the bottom-right of the frame.
 * Stays compact so the frozen design stays visible. Each text/image
 * element animates in with a small stagger.
 */
export const BrandingCard: React.FC<BrandingCardProps> = ({
  logoUrl,
  companyName,
  companyPhone,
  note,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card itself slides up and fades in immediately on mount
  const cardEnter = spring({
    frame,
    fps,
    config: { damping: 200, mass: 0.9 },
    durationInFrames: 22,
  });
  const cardOpacity = interpolate(cardEnter, [0, 1], [0, 1]);
  const cardTranslateY = interpolate(cardEnter, [0, 1], [32, 0]);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "flex-end",
        padding: 48,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          opacity: cardOpacity,
          transform: `translateY(${cardTranslateY}px)`,
          // Glass morphism matching the address + asset cards
          backgroundColor: "rgba(15, 15, 18, 0.55)",
          backdropFilter: "blur(20px) saturate(140%)",
          WebkitBackdropFilter: "blur(20px) saturate(140%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 18,
          padding: "20px 28px",
          boxShadow:
            "0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          gap: 20,
          maxWidth: 480,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "white",
        }}
      >
        {logoUrl && (
          <BrandingElement delayFrames={0}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                backgroundColor: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 6,
                flexShrink: 0,
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              <Img
                src={logoUrl}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
            </div>
          </BrandingElement>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 0,
          }}
        >
          {companyName && (
            <BrandingElement delayFrames={BRANDING_ELEMENT_STAGGER_FRAMES}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: -0.4,
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {companyName}
              </div>
            </BrandingElement>
          )}

          {companyPhone && (
            <BrandingElement delayFrames={BRANDING_ELEMENT_STAGGER_FRAMES * 2}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: "rgba(255, 255, 255, 0.85)",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
                }}
              >
                {companyPhone}
              </div>
            </BrandingElement>
          )}

          {note && (
            <BrandingElement delayFrames={BRANDING_ELEMENT_STAGGER_FRAMES * 3}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: 1.4,
                  color: "rgba(255, 255, 255, 0.9)",
                  marginTop: 6,
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.4)",
                  maxWidth: 320,
                }}
              >
                {note}
              </div>
            </BrandingElement>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Wraps a child element with a delayed slide-up + fade-in animation.
 * Used for the staggered logo / name / phone / note entries.
 */
const BrandingElement: React.FC<{
  children: React.ReactNode;
  delayFrames: number;
}> = ({ children, delayFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - delayFrames);
  const enter = spring({
    frame: localFrame,
    fps,
    config: { damping: 200, mass: 0.6 },
    durationInFrames: BRANDING_ELEMENT_ENTRY_FRAMES,
  });

  const opacity = interpolate(localFrame, [0, BRANDING_ELEMENT_ENTRY_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(enter, [0, 1], [10, 0]);

  if (frame < delayFrames) return null;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {children}
    </div>
  );
};
