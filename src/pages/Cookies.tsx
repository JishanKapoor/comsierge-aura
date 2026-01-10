import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Cookies = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16 px-6 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light text-foreground">Cookies</h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground">
            Prototype notice about cookies and similar technologies.
          </p>

          <div className="mt-10 space-y-6 text-sm text-muted-foreground">
            <p>
              We may use cookies or local storage to keep you signed in and remember preferences.
            </p>
            <p>
              You can disable cookies in your browser settings, but some features may not work.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Cookies;
