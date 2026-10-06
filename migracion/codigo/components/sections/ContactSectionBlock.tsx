'use client';

import { motion, Variants } from 'framer-motion';
import ContactSplitSection from '@/components/ContactSplitSection';

const defaultVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
} as Variants;

interface ContactSectionBlockProps {
  interestOptions?: string[];
  fadeInLeftVariants?: Variants;
  fadeInRightVariants?: Variants;
  fadeInUpVariants?: Variants;
  fadeInDownVariants?: Variants;
  fadeInScaleVariants?: Variants;
  staggerFastVariants?: Variants;
}

export default function ContactSectionBlock({
  interestOptions = [],
  fadeInScaleVariants = defaultVariants,
}: ContactSectionBlockProps = {}) {
  return (
    <section
      id="contacto"
      className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.14)_0%,rgba(241,234,225,0.22)_100%)] py-12 md:py-16"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-secondary/5 blur-[100px] opacity-60" />
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          variants={fadeInScaleVariants}
          transition={{ duration: 0.85, delay: 0.08 }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          <ContactSplitSection interestOptions={interestOptions} />
        </motion.div>
      </div>
    </section>
  );
}
