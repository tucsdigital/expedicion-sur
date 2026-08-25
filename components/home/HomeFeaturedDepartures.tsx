"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import type { Paquete } from "@/types";
import PaqueteCard from "@/components/PaqueteCard";
import { motion } from "framer-motion";

type Props = {
  paquetes: Paquete[];
};

export default function HomeFeaturedDepartures({ paquetes }: Props) {
  const items = paquetes.slice(0, 10);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [showNext, setShowNext] = useState(false);
  if (items.length === 0) return null;

  useEffect(() => {
    const node = railRef.current;
    if (!node) return;

    const update = () => {
      setShowNext(node.scrollLeft + node.clientWidth < node.scrollWidth - 8);
    };

    update();
    node.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items.length]);

  const handleNext = () => {
    const node = railRef.current;
    if (!node) return;
    node.scrollBy({ left: 272, behavior: "smooth" });
  };

  return (
    <section id="experiencias" className="bg-white py-10 md:py-14">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="mb-6 flex items-center justify-between gap-4 md:mb-7"
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-140px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#E7EEF5] bg-white shadow-[0_10px_24px_rgba(17,43,73,0.08)]">
              <Star className="h-4.5 w-4.5 text-[#F6C54F]" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A1ACB8]">
                Excursiones destacadas
              </div>
              <div className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-[#112B49] md:text-[28px]">
                Excursiones destacadas
              </div>
            </div>
          </div>
          <Link
            href="/experiencias"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#F4D1D4] bg-white px-4 py-2 text-sm font-extrabold text-[#112B49] shadow-[0_10px_24px_rgba(17,43,73,0.08)] transition-all hover:-translate-y-0.5 hover:border-[#E30613] hover:bg-[#FFF1F1] hover:text-[#E30613] hover:shadow-[0_14px_30px_rgba(17,43,73,0.12)]"
          >
            Ver todas las experiencias <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <div className="relative">
          <motion.div
            ref={railRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pr-12 scrollbar-hide md:gap-5"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-140px" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          >
            {items.map((p, index) => (
              <div key={p.id} className="snap-start w-[258px] shrink-0">
                <PaqueteCard paquete={p} index={index} />
              </div>
            ))}
          </motion.div>

          {showNext ? (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-0 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[#E7EEF5] bg-white text-[#E30613] shadow-[0_16px_36px_rgba(17,43,73,0.14)] transition hover:scale-[1.02] hover:shadow-[0_20px_42px_rgba(17,43,73,0.18)] md:inline-flex"
              aria-label="Ver más experiencias"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
