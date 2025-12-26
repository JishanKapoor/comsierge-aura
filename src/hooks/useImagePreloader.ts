import { useEffect, useState } from "react";

// Import all images to preload
import heroNyc from "@/assets/hero-nyc.jpg";
import heroLandscape from "@/assets/hero-landscape.jpg";
import authVisual from "@/assets/auth-visual.jpg";
import ctaBg from "@/assets/cta-bg.jpg";
import floatingCard1 from "@/assets/floating-card-1.jpg";
import floatingCard2 from "@/assets/floating-card-2.jpg";
import productConnect from "@/assets/product-connect.jpg";
import productRespond from "@/assets/product-respond.jpg";
import productSilence from "@/assets/product-silence.jpg";

// Critical images that should load first (above the fold)
const criticalImages = [heroNyc, heroLandscape];

// Non-critical images (can load lazily)
const lazyImages = [
  authVisual,
  ctaBg,
  floatingCard1,
  floatingCard2,
  productConnect,
  productRespond,
  productSilence,
];

export const useImagePreloader = () => {
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [criticalLoaded, setCriticalLoaded] = useState(false);

  useEffect(() => {
    // Load critical images first with high priority
    const loadCritical = async () => {
      await Promise.all(
        criticalImages.map(
          (src) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => resolve();
              img.onerror = () => resolve();
              img.src = src;
            })
        )
      );
      setCriticalLoaded(true);
    };

    loadCritical();

    // Load non-critical images after a delay
    const loadLazy = setTimeout(() => {
      let loadedCount = 0;
      lazyImages.forEach((src) => {
        const img = new Image();
        img.onload = img.onerror = () => {
          loadedCount++;
          if (loadedCount === lazyImages.length) {
            setImagesLoaded(true);
          }
        };
        img.src = src;
      });
    }, 100);

    return () => clearTimeout(loadLazy);
  }, []);

  return { imagesLoaded, criticalLoaded };
};

export const preloadedImages = {
  heroNyc,
  heroLandscape,
  authVisual,
  ctaBg,
  floatingCard1,
  floatingCard2,
  productConnect,
  productRespond,
  productSilence,
};
