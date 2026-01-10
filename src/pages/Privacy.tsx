import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Privacy = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16 px-6 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light text-foreground">Privacy Policy</h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground">
            Prototype policy. This is not legal advice.
          </p>

          <div className="mt-10 space-y-6 text-sm text-muted-foreground">
            <p>
              We collect information you provide (like your email) and information needed to operate
              the service (like message metadata).
            </p>
            <p>
              We use this data to provide the product, improve reliability, and support your account.
            </p>
            <p>
              If you have questions, contact {" "}
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

export default Privacy;
