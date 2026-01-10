import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Careers = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16 px-6 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light text-foreground">Careers</h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground">
            We’re building Comsierge with a small, high-ownership team.
          </p>

          <div className="mt-10 space-y-8">
            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">Open roles</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                No public openings yet. If you’re interested, send a note.
              </p>
            </div>

            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">Contact</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Email us at {" "}
                <a
                  href="mailto:jishan.kapoor@mail.utoronto.ca"
                  className="text-foreground/90 hover:text-foreground underline underline-offset-4"
                >
                  jishan.kapoor@mail.utoronto.ca
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Careers;
