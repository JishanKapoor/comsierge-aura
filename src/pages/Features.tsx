import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Features = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16 px-6 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light text-foreground">Features</h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground">
            A quick overview of what Comsierge can do today.
          </p>

          <div className="mt-10 space-y-8">
            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">AI inbox</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Triage messages, surface priority conversations, and keep everything organized.
              </p>
            </div>

            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">Calls + SMS</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Route calls, respond to texts, and maintain a consistent customer experience.
              </p>
            </div>

            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">Rules and routing</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Configure what matters most—priority contacts, blocked senders, and automations.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Features;
