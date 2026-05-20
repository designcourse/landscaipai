export function LandingVideoTransform() {
  return (
    <section className="vid-transform" aria-label="AI transformation video">
      <div className="vt-head reveal">
        <span className="sec-eyebrow">
          <span className="dot" />
          New · Motion
        </span>
        <h2 className="sec-title">
          Visualize your landscaping transformation <em>with video.</em>
        </h2>
        <p className="sec-sub">
          Go beyond a still image. Watch the yard grow in.
        </p>
      </div>
      <div className="vt-stage reveal">
        <video
          className="vt-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source src="/landing/transform-demo.mp4" type="video/mp4" />
        </video>
        <div className="vt-chip">
          <span className="vt-dot" />
          Auto-generating
        </div>
      </div>
      <div className="vt-foot reveal">
        <div className="vt-foot-col">
          <span className="vt-num">1</span>
          <h4>Pick a before photo</h4>
          <p>
            Snap your current yard, or paste any listing photo. Raw, unstaged,
            no prep.
          </p>
        </div>
        <div className="vt-foot-col">
          <span className="vt-num">2</span>
          <h4>Choose an after</h4>
          <p>
            Select any generated design, or drop your own inspiration image.
            Two frames is all we need.
          </p>
        </div>
        <div className="vt-foot-col">
          <span className="vt-num">3</span>
          <h4>Get a transformation video</h4>
          <p>
            Our system interpolates a smooth reveal you can share with clients,
            HOA boards, or your group chat.
          </p>
        </div>
      </div>
    </section>
  );
}
