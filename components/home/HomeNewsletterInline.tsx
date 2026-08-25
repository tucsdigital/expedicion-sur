"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { addDoc, collection, getDocs, query, Timestamp, where } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";

export default function HomeNewsletterInline() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Ingresá un email válido");
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, "newsletter"), where("email", "==", email.toLowerCase()));
      const existing = await getDocs(q);
      if (!existing.empty) {
        toast.error("Este email ya está suscrito");
        return;
      }
      await addDoc(collection(db, "newsletter"), {
        email: email.toLowerCase(),
        fechaSuscripcion: Timestamp.now(),
        activo: true,
      });
      toast.success("¡Suscripción exitosa!");
      setEmail("");
    } catch {
      toast.error("No se pudo suscribir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-[#F5FAFF] py-10 md:py-12">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="rounded-3xl bg-white border border-gray-100 shadow-[0_14px_45px_rgba(0,0,0,0.06)] p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="h-12 w-12 rounded-2xl bg-[#E8F6FF] text-[#E30613] flex items-center justify-center shrink-0">
              <Mail className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-gray-900">Recibí nuestras novedades</div>
              <div className="text-xs text-gray-500">Ofertas exclusivas, nuevos destinos y salidas especiales.</div>
            </div>
          </div>

          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu email"
              className="h-12 w-full sm:w-[320px] rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="h-12 rounded-2xl bg-[#E30613] hover:bg-[#C70511] text-white font-semibold text-sm px-6 transition-colors disabled:opacity-70"
            >
              Suscribirme
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

