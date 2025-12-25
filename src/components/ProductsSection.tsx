import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import productSilence from "@/assets/product-silence.jpg";
import productRespond from "@/assets/product-respond.jpg";
import productConnect from "@/assets/product-connect.jpg";

interface ProductCardProps {
  image: string;
  label: string;
  title: string;
  description: string;
  delay?: number;
}

const ProductCard = ({ image, label, title, description, delay = 0 }: ProductCardProps) => {
  return (
    <motion.div
      className="group relative rounded-2xl overflow-hidden bg-card border border-border/50 hover:border-border transition-all duration-500"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      viewport={{ once: true, margin: "-50px" }}
    >
      {/* Image */}
      <div className="aspect-[16/10] overflow-hidden">
        <img 
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <h3 className="text-xl md:text-2xl font-light text-foreground mt-2">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{description}</p>
        
        <div className="mt-4 flex items-center gap-2 text-foreground opacity-0 group-hover:opacity-100 transition-all duration-300">
          <span className="text-sm font-medium">Explore</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </motion.div>
  );
};

const ProductsSection = () => {
  const products = [
    {
      image: productSilence,
      label: "Intercept",
      title: "Zero noise. Always.",
      description: "Every unknown call verified. Every spam blocked. Context-aware intelligence."
    },
    {
      image: productRespond,
      label: "Respond",
      title: "Your voice, automated.",
      description: "AI that speaks like you—scheduling, declining, routing. Seamlessly."
    },
    {
      image: productConnect,
      label: "Unify",
      title: "One stream. All channels.",
      description: "SMS, WhatsApp, Telegram, email—summarized, translated, prioritized."
    }
  ];

  return (
    <section id="respond" className="py-24 md:py-32 px-6 md:px-16 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <span className="section-label">What we build</span>
          <h2 className="section-headline text-foreground mt-4">
            Three engines. Complete control.
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((product, i) => (
            <ProductCard key={product.label} {...product} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductsSection;
