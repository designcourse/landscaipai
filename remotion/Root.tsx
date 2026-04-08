import React from "react";
import { Composition } from "remotion";
import {
  FinalizeVideo,
  FinalizeVideoProps,
  calculateFinalizeVideoMetadata,
} from "./compositions/FinalizeVideo";
import { COMPOSITION_FPS } from "./lib/timing";

/**
 * Default props used by Remotion Studio (`npm run remotion:studio`)
 * to render a static preview without needing real input data. The
 * actual production renders pass real props via inputProps.
 *
 * IMPORTANT: replace `veoUrl` with a real signed URL when iterating
 * locally — the placeholder below will fail to load.
 */
const defaultProps: FinalizeVideoProps = {
  veoUrl: "https://remotion.media/BigBuckBunny.mp4",
  veoDurationSeconds: 8,
  veoWidth: 1280,
  veoHeight: 720,
  assets: [
    {
      name: "Arborvitae (Emerald Green)",
      thumbnailUrl:
        "https://bedufmdktgpokgsfwxri.supabase.co/storage/v1/object/public/plant-library/shrubs/arborvitae-emerald-green.webp",
    },
    {
      name: "Boxwood",
      thumbnailUrl:
        "https://bedufmdktgpokgsfwxri.supabase.co/storage/v1/object/public/plant-library/shrubs/arborvitae-emerald-green.webp",
    },
  ],
  address: "1234 Maple Avenue, Springfield",
  branding: {
    logoUrl: null,
    companyName: "Greenleaf Landscaping",
    companyPhone: "(555) 123-4567",
    note: "Contact us today and we can make this happen.",
  },
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="FinalizeVideo"
        component={FinalizeVideo}
        // durationInFrames, width, height are computed dynamically per render
        durationInFrames={1}
        fps={COMPOSITION_FPS}
        width={1280}
        height={720}
        defaultProps={defaultProps}
        calculateMetadata={calculateFinalizeVideoMetadata}
      />
    </>
  );
};
