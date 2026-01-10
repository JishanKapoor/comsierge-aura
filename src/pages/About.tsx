import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const About = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16 px-6 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light text-foreground">About</h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground">
            Comsierge helps teams manage calls and messages with an AI-first inbox.
          </p>

          <div className="mt-10 space-y-8">
            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">What we’re building</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A unified communications layer that routes, summarizes, and prioritizes customer conversations.
              </p>
            </div>

            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">Who it’s for</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Small businesses and lean teams who want a professional, fast response experience.
              </p>
            </div>

            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">Stage</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Prototype—built for early users and investors.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default About;
