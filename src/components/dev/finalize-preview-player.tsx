"use client";

import { Player } from "@remotion/player";
import {
  FinalizeVideo,
  FinalizeVideoProps,
} from "../../../remotion/compositions/FinalizeVideo";
import {
  COMPOSITION_FPS,
  FREEZE_HOLD_SECONDS,
} from "../../../remotion/lib/timing";

export function FinalizePreviewPlayer(props: FinalizeVideoProps) {
  // Mirror calculateFinalizeVideoMetadata client-side so the Player can
  // size the composition without re-running the metadata callback.
  const fps = COMPOSITION_FPS;
  const veoFrames = Math.round(props.veoDurationSeconds * fps);
  const freezeFrames = FREEZE_HOLD_SECONDS * fps;
  const durationInFrames = veoFrames + freezeFrames;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-black">
      <Player
        component={FinalizeVideo}
        inputProps={props}
        durationInFrames={durationInFrames}
        compositionWidth={props.veoWidth}
        compositionHeight={props.veoHeight}
        fps={fps}
        controls
        loop={false}
        style={{ width: "100%", aspectRatio: `${props.veoWidth} / ${props.veoHeight}` }}
      />
    </div>
  );
}
