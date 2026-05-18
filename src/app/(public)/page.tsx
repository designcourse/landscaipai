import "@/components/landing/landing.css";
import { PwaLandingGuard } from "@/components/shared/pwa-landing-guard";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingLibrary } from "@/components/landing/landing-library";
import { LandingPlantDetail } from "@/components/landing/landing-plant-detail";
import { LandingLogos } from "@/components/landing/landing-logos";
import { LandingVideoTransform } from "@/components/landing/landing-video-transform";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { LandingGallery } from "@/components/landing/landing-gallery";
import { LandingShaderReveal } from "@/components/landing/landing-shader-reveal";
import { LandingAudience } from "@/components/landing/landing-audience";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { LandingTestimonials } from "@/components/landing/landing-testimonials";
import { LandingFAQ } from "@/components/landing/landing-faq";
import { LandingCTA } from "@/components/landing/landing-cta";
import { LandingRevealObserver } from "@/components/landing/landing-reveal-observer";
import { LandingSmoothScroll } from "@/components/landing/landing-smooth-scroll";

export const metadata = {
  title: "Landscaip — AI Landscape Design",
  description:
    "Upload a photo of your house, pick a style, get a professional landscaping design in seconds.",
};

export default function LandingPage() {
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
