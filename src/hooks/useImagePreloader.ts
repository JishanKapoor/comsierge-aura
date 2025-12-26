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

const imagesToPreload = [
  heroNyc,
  heroLandscape,
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

  useEffect(() => {
    let loadedCount = 0;
    const totalImages = imagesToPreload.length;

    imagesToPreload.forEach((src) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          setImagesLoaded(true);
        }
      };
      img.src = src;
    });
  }, []);

  return { imagesLoaded };
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
