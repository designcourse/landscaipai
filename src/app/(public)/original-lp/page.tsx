import "@/components/landing/landing.css";
import { PwaLandingGuard } from "@/components/shared/pwa-landing-guard";
import { LandingHero } from "@/components/landing-v1/landing-hero";
import { LandingLibrary } from "@/components/landing-v1/landing-library";
import { LandingPlantDetail } from "@/components/landing-v1/landing-plant-detail";
import { LandingLogos } from "@/components/landing-v1/landing-logos";
import { LandingVideoTransform } from "@/components/landing-v1/landing-video-transform";
import { LandingHowItWorks } from "@/components/landing-v1/landing-how-it-works";
import { LandingGallery } from "@/components/landing-v1/landing-gallery";
import { LandingShaderReveal } from "@/components/landing-v1/landing-shader-reveal";
import { LandingAudience } from "@/components/landing-v1/landing-audience";
import { LandingFeatures } from "@/components/landing-v1/landing-features";
import { LandingPricing } from "@/components/landing-v1/landing-pricing";
import { LandingTestimonials } from "@/components/landing-v1/landing-testimonials";
import { LandingFAQ } from "@/components/landing-v1/landing-faq";
import { LandingCTA } from "@/components/landing-v1/landing-cta";
import { LandingRevealObserver } from "@/components/landing-v1/landing-reveal-observer";
import { LandingSmoothScroll } from "@/components/landing-v1/landing-smooth-scroll";

export const metadata = {
  title: "Landscaip — Original Landing (Archive)",
  description:
    "Frozen snapshot of the original Landscaip landing page. Kept for reference only.",
  robots: { index: false, follow: false },
};

export default function OriginalLpPage() {
  return (
    <main className="landing-root">
      <PwaLandingGuard />
      <LandingHero />
      <LandingLibrary />
      <LandingPlantDetail />
      <LandingLogos />
      <LandingVideoTransform />
      <LandingHowItWorks />
      <LandingGallery />
      <LandingShaderReveal />
      <LandingAudience />
      <LandingFeatures />
      <LandingPricing />
      <LandingTestimonials />
      <LandingFAQ />
      <LandingCTA />
      <LandingRevealObserver />
      <LandingSmoothScroll />
    </main>
  );
}
