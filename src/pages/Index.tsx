import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import InboxDemoSection from "@/components/InboxDemoSection";
import PrototypeSection from "@/components/PrototypeSection";
import BusinessSection from "@/components/BusinessSection";
import FAQSection from "@/components/FAQSection";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <InboxDemoSection />
      <PrototypeSection />
      <BusinessSection />
      <FAQSection />
      <CTASection />
      <Footer />
    </main>
  );
};

export default Index;
