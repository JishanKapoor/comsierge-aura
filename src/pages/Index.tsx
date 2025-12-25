import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import FeaturesGrid from "@/components/FeaturesGrid";
import InfrastructureSection from "@/components/InfrastructureSection";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <ManifestoSection />
      <FeaturesGrid />
      <InfrastructureSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  );
};

export default Index;
