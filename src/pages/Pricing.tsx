import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Pricing = () => {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />

      <section className="pt-24 pb-16 px-6 md:px-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light text-foreground">Pricing</h1>
          <p className="mt-3 text-sm md:text-base text-muted-foreground">
            Simple pricing for early users. (Prototype)
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="border border-border rounded-2xl p-6">
              <div className="text-sm text-muted-foreground">Starter</div>
              <div className="mt-2 text-2xl font-medium text-foreground">$0</div>
              <p className="mt-2 text-sm text-muted-foreground">For testing the experience.</p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li>Inbox + routing basics</li>
                <li>Limited usage</li>
                <li>Email support</li>
              </ul>
            </div>

            <div className="border border-border rounded-2xl p-6">
              <div className="text-sm text-muted-foreground">Pro</div>
              <div className="mt-2 text-2xl font-medium text-foreground">Contact</div>
              <p className="mt-2 text-sm text-muted-foreground">
                For teams that want onboarding and higher limits.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                <li>Higher message volume</li>
                <li>Priority support</li>
                <li>Custom workflows (prototype)</li>
              </ul>
            </div>
          </div>

          <p className="mt-10 text-xs text-muted-foreground">
            Pricing is subject to change as we learn from early users.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Pricing;
