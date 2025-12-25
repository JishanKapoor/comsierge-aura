import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ManifestoSection from "@/components/ManifestoSection";
import TrustedCompanies from "@/components/TrustedCompanies";
import FeaturesGrid from "@/components/FeaturesGrid";
import ProductsSection from "@/components/ProductsSection";
import ResearchSection from "@/components/ResearchSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <ManifestoSection />
      <TrustedCompanies />
      <FeaturesGrid />
      <ProductsSection />
      <ResearchSection />
      <CTASection />
      <Footer />
    </main>
  );
};

export default Index;
