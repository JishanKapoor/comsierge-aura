import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import IntegrationsSection from "@/components/IntegrationsSection";
import FeaturesGrid from "@/components/FeaturesGrid";
import InfrastructureSection from "@/components/InfrastructureSection";
import ProductsSection from "@/components/ProductsSection";
import ResearchSection from "@/components/ResearchSection";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <ManifestoSection />
      <IntegrationsSection />
      <FeaturesGrid />
      <InfrastructureSection />
      <ProductsSection />
      <ResearchSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  );
};

export default Index;
