import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Terms = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16 px-6 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light text-foreground">Terms of Service</h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground">
            Prototype terms. This is not legal advice.
          </p>

          <div className="mt-10 space-y-6 text-sm text-muted-foreground">
            <p>
              By using Comsierge, you agree to use the service responsibly and comply with applicable laws.
            </p>
            <p>
              The service is provided “as is” during the prototype phase and may change without notice.
            </p>
            <p>
              For questions, contact {" "}
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
      </section>

      <Footer />
    </main>
  );
};

export default Terms;
