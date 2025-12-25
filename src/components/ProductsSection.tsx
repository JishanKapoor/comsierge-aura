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
      className="product-card group cursor-pointer"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay }}
      viewport={{ once: true, margin: "-50px" }}
    >
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden">
        <img 
          src={image}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      {/* Content */}
      <div className="p-6 md:p-8">
        <span className="section-label">{label}</span>
        <h3 className="text-xl md:text-2xl font-light text-foreground mt-3">{title}</h3>
        <p className="body-text text-sm md:text-base mt-3">{description}</p>
        
        <div className="mt-6 flex items-center gap-2 text-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-2">
          <span className="text-sm font-medium">Learn more</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
};

const ProductsSection = () => {
  const products = [
    {
      image: productSilence,
      label: "01",
      title: "Zero noise. Zero interruptions.",
      description: "AI that intercepts every unknown call, verifies intent, and only connects what matters."
    },
    {
      image: productRespond,
      label: "02",
      title: "Replies that sound like you.",
      description: "Automated responses across SMS, WhatsApp, and Telegram that maintain your voice."
    },
    {
      image: productConnect,
      label: "03",
      title: "Unified. Intelligent. Yours.",
      description: "All channels flow into one stream—summarized, translated, prioritized."
    }
  ];

  return (
    <section id="respond" className="py-24 md:py-40 px-6 md:px-16 bg-background">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <span className="section-label">What we build</span>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {products.map((product, i) => (
            <ProductCard key={product.label} {...product} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductsSection;
