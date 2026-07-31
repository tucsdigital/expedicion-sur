'use client';

import { motion } from 'framer-motion';
import { getWhatsAppLink } from '@/lib/utils/whatsapp';
import { WHATSAPP_NUMBER } from '@/lib/constants';
import WhatsAppOfficialIcon from '@/components/WhatsAppOfficialIcon';

export default function WhatsAppButton() {
  if (!WHATSAPP_NUMBER) return null;
  return (
    <motion.a
      href={getWhatsAppLink()}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-6 right-6 z-[110] inline-flex h-14 items-center gap-2 rounded-full bg-[#111111] px-4 text-sm font-semibold text-[#CBBBA0] shadow-[0_24px_60px_rgba(17,17,17,0.28)] transition-colors hover:bg-[#E30613] hover:text-[#CBBBA0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E30613]/40"
      aria-label="Contactar por WhatsApp"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/12">
        <WhatsAppOfficialIcon className="h-4 w-4" />
      </span>
      <span className="hidden sm:inline">Reservar</span>
    </motion.a>
  );
}
