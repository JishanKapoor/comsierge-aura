import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Integrations = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16 px-6 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light text-foreground">Integrations</h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground">
            Connect Comsierge to the tools your team already uses.
          </p>

          <div className="mt-10 space-y-8">
            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">Phone + messaging</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Built to work with modern telephony providers and messaging channels.
              </p>
            </div>

            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">CRM and helpdesk (prototype)</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Planned connections to CRMs and ticketing systems for shared customer context.
              </p>
            </div>

            <div className="border border-border rounded-2xl p-6">
              <h2 className="text-lg font-medium text-foreground">Webhooks + API (prototype)</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Automate workflows and move data in/out of Comsierge.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Integrations;
