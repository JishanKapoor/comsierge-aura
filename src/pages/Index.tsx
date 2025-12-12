import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import IntroSection from "@/components/IntroSection";
import FeaturesSection from "@/components/FeaturesSection";
import CapabilitiesSection from "@/components/CapabilitiesSection";
import StatsSection from "@/components/StatsSection";
import LogoMarquee from "@/components/LogoMarquee";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <IntroSection />
      <FeaturesSection />
      <CapabilitiesSection />
      <StatsSection />
      <LogoMarquee />
      <CTASection />
      <Footer />
    </main>
  );
};

export default Index;
