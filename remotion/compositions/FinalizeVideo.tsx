import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Freeze,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
} from "remotion";

import { AddressCard } from "../components/AddressCard";
import { AssetCards } from "../components/AssetCard";
import { BrandingCard } from "../components/BrandingCard";
import {
  ASSET_CARDS_LEAD_IN_SECONDS,
  ASSET_CARD_STAGGER_FRAMES,
  COMPOSITION_FPS,
  FREEZE_HOLD_SECONDS,
} from "../lib/timing";

export type FinalizeVideoAsset = {
  thumbnailUrl: string;
  name: string;
};

export type FinalizeVideoBranding = {
  logoUrl: string | null;
  companyName: string;
  companyPhone: string | null;
  note: string | null;
};

// Note: must be a `type` (not `interface`) so it satisfies Remotion's
// `Record<string, unknown>` constraint on Composition / Player props.
export type FinalizeVideoProps = {
  /** Signed URL or remote URL of the source veo MP4 */
  veoUrl: string;
  /** Exact source duration in seconds (probed via parseMedia at upload time) */
  veoDurationSeconds: number;
  /** Source video dimensions — used to set composition dimensions */
  veoWidth: number;
  veoHeight: number;
  /** Auto-detected and user-curated library assets used in the design */
  assets: FinalizeVideoAsset[];
  /** Optional address card shown for the duration of the veo phase */
  address: string | null;
  /** Closing branding card shown on the frozen end frame */
  branding: FinalizeVideoBranding | null;
};

const fps = COMPOSITION_FPS;

/**
 * Computes composition dimensions and total duration from input props.
 * Required because the source veo can be 720p or 1080p and the exact
 * duration is only known after probing the actual MP4.
 */
export const calculateFinalizeVideoMetadata: CalculateMetadataFunction<FinalizeVideoProps> =
  ({ props }) => {
    const veoFrames = Math.round(props.veoDurationSeconds * fps);
    const freezeFrames = FREEZE_HOLD_SECONDS * fps;

    return {
      durationInFrames: veoFrames + freezeFrames,
      fps,
      width: props.veoWidth || 1920,
      height: props.veoHeight || 1080,
    };
  };

/**
 * Single-AbsoluteFill composition (no TransitionSeries) so that:
 *   1. The video is never remounted at the veo→freeze boundary, eliminating
 *      the black-frame flash that happened with separate sequences.
 *   2. The asset cards persist across the boundary without re-animating.
 *   3. The branding card can show up the instant the freeze begins.
 *
 * Layering, bottom to top:
 *   1. Live <OffthreadVideo>     — opacity drops to 0 at the freeze boundary
 *   2. Frozen <OffthreadVideo>   — mounts FREEZE_PRELOAD_FRAMES before the
 *                                  boundary so it has time to load + seek,
 *                                  but NOT from frame 0 (would double the
 *                                  bandwidth and cause buffering in Player)
 *   3. AddressCard               — visible during the veo phase
 *   4. AssetCards                — start animating in during the last 2s
 *                                  of the veo phase, persist through freeze
 *   5. BrandingCard              — mounts at the start of the freeze phase
 */

// How many frames before the freeze boundary to mount the freeze video.
// Long enough for the browser to load + seek (~1s); short enough to avoid
// bandwidth-doubling for most of the playback.
const FREEZE_PRELOAD_FRAMES = COMPOSITION_FPS;

export const FinalizeVideo: React.FC<FinalizeVideoProps> = ({
  veoUrl,
  veoDurationSeconds,
  assets,
  address,
  branding,
}) => {
  const frame = useCurrentFrame();

  const veoFrames = Math.round(veoDurationSeconds * fps);

  // Asset cards begin entering during the LAST `lead-in` seconds of the veo
  // phase. They keep their `delayFrames` references after the freeze, so
  // they stay visible (no re-animation).
  const assetEntryStartFrame = Math.max(
    0,
    veoFrames - ASSET_CARDS_LEAD_IN_SECONDS * fps
  );

  // The freeze frame uses the very last source frame.
  const freezeAtFrame = Math.max(0, veoFrames - 1);

  const inFreezePhase = frame >= veoFrames;

  // Mount the freeze video shortly before the boundary so it has time to
  // load + seek without doubling bandwidth for the entire veo phase. The
  // live video stays mounted throughout (with opacity 0 after the boundary)
  // so it can be deduped from the browser cache.
  const showFreezeVideo = frame >= veoFrames - FREEZE_PRELOAD_FRAMES;

  // Address card fades out as the asset cards start entering — same window.
  // Pass the fade-out frame so the AddressCard owns its own timing.
  const addressFadeOutAtFrame = assetEntryStartFrame;

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {/*
        Live veo video. Always mounted; opacity flips to 0 the instant we
        cross into the freeze phase.
      */}
      <AbsoluteFill style={{ opacity: inFreezePhase ? 0 : 1 }}>
        <OffthreadVideo src={veoUrl} muted />
      </AbsoluteFill>

      {/*
        Frozen final frame. Mounted only during the pre-load window + freeze
        phase to avoid bandwidth-doubling earlier in playback (which caused
        Player buffering hiccups when both video elements were independently
        downloading the same source).
      */}
      {showFreezeVideo && (
        <AbsoluteFill style={{ opacity: inFreezePhase ? 1 : 0 }}>
          <Freeze frame={freezeAtFrame}>
            <OffthreadVideo src={veoUrl} muted />
          </Freeze>
        </AbsoluteFill>
      )}

      {/* Address card — visible during the veo phase only */}
      {address && !inFreezePhase && (
        <AddressCard
          address={address}
          fadeOutAtFrame={addressFadeOutAtFrame}
        />
      )}

      {/* Asset cards — animate in during last 2s of veo, persist into freeze */}
      {assets.length > 0 && (
        <AssetCards
          assets={assets}
          startFrame={assetEntryStartFrame}
          staggerFrames={ASSET_CARD_STAGGER_FRAMES}
        />
      )}

      {/*
        Branding card — wrapped in a Sequence that starts at the freeze
        boundary so its useCurrentFrame() rebases to 0, giving the spring
        entry animation a clean starting point. Sequence handles the gating.
      */}
      {branding && (
        <Sequence from={veoFrames} layout="none">
          <BrandingCard {...branding} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
