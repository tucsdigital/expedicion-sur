"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronDown, MapPin, Search, User, X } from "lucide-react";
import type { Paquete } from "@/types";

type Props = {
  paquetes: Paquete[];
};

export default function HomeSearchBar({ paquetes }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mes, setMes] = useState("");
  const [pax, setPax] = useState(2);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedDestino, setSelectedDestino] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = window.setTimeout(() => setDebouncedQ(q), 180);
    return () => window.clearTimeout(handler);
  }, [q]);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const mesesDisponibles = useMemo(() => {
    const setMeses = new Set<string>();
    paquetes.forEach((p) => {
      p.salidas?.forEach((s) => {
        if (s.fecha) setMeses.add(s.fecha.substring(0, 7));
      });
    });
    return Array.from(setMeses).sort();
  }, [paquetes]);

  const formatMes = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split("-");
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
    return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  };

  const suggestions = useMemo(() => {
    if (!debouncedQ.trim()) return { destinos: [], paquetes: [] as Array<{ titulo: string; slug: string; destino: string }> };
    const term = debouncedQ.toLowerCase().trim();
    const matchedDestinos = new Set<string>();
    const matchedPaquetes: Array<{ titulo: string; slug: string; destino: string }> = [];

    paquetes.forEach((p) => {
      const titulo = (p.titulo || "").toLowerCase();
      const destino = (p.destino || "").toLowerCase();
      const isMatch = titulo.includes(term) || destino.includes(term);
      if (!isMatch) return;
      if (destino && destino.includes(term)) matchedDestinos.add(p.destino as string);
      if (titulo.includes(term)) matchedPaquetes.push({ titulo: p.titulo, slug: p.slug, destino: p.destino || "" });
    });

    return { destinos: Array.from(matchedDestinos).slice(0, 4), paquetes: matchedPaquetes.slice(0, 6) };
  }, [debouncedQ, paquetes]);

  const totalSuggestions = suggestions.destinos.length + suggestions.paquetes.length;

  const selectSuggestion = (index: number) => {
    const destLen = suggestions.destinos.length;
    if (index < destLen) {
      const dest = suggestions.destinos[index];
      setQ(dest);
      setSelectedDestino(dest);
      setSelectedSlug(null);
    } else {
      const paq = suggestions.paquetes[index - destLen];
      setQ(paq.titulo);
      setSelectedSlug(paq.slug);
      setSelectedDestino(null);
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < totalSuggestions - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) selectSuggestion(activeIndex);
      else handleSearch();
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedSlug) params.set("slug", selectedSlug);
    else if (selectedDestino) params.set("destino", selectedDestino);
    else if (q.trim()) params.set("q", q.trim());
    if (mes) params.set("mes", mes);
    router.push(params.toString() ? `/experiencias?${params.toString()}` : "/experiencias");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex flex-col lg:flex-row items-stretch gap-2 rounded-[28px] bg-white/95 backdrop-blur-md shadow-[0_22px_60px_rgba(0,0,0,0.18)] border border-white/70 px-3 py-3 lg:py-2">
        <div className="relative flex-1">
          <div className="flex items-center gap-3 rounded-2xl lg:rounded-[22px] px-4 py-3 lg:py-4 hover:bg-black/[0.02] transition-colors">
            <MapPin className="h-5 w-5 text-[#0B6B8A]" />
            <div className="w-full">
              <div className="text-[11px] font-semibold text-gray-500">¿A dónde querés viajar?</div>
              <div className="flex items-center gap-2">
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setSelectedSlug(null);
                    setSelectedDestino(null);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={handleKeyDown}
                  placeholder="Destino o excursión"
                  className="w-full bg-transparent outline-none text-sm font-medium text-gray-900 placeholder:text-gray-400"
                  role="combobox"
                  aria-expanded={showSuggestions}
                  aria-autocomplete="list"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      setSelectedSlug(null);
                      setSelectedDestino(null);
                    }}
                    className="p-1.5 rounded-full hover:bg-gray-100"
                    aria-label="Limpiar"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {showSuggestions && debouncedQ.trim().length > 0 && totalSuggestions > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
              {suggestions.destinos.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Destinos</div>
                  {suggestions.destinos.map((dest, idx) => (
                    <div
                      key={`dest-${idx}`}
                      className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 ${
                        activeIndex === idx ? "bg-gray-50" : "hover:bg-gray-50"
                      }`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => selectSuggestion(idx)}
                    >
                      <MapPin className="w-4 h-4 text-[#0B6B8A]" />
                      <span className="text-sm">{dest}</span>
                    </div>
                  ))}
                </div>
              )}
              {suggestions.paquetes.length > 0 && (
                <div className="py-2 border-t border-gray-50">
                  <div className="px-4 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Excursiones</div>
                  {suggestions.paquetes.map((paq, idx) => {
                    const globalIdx = suggestions.destinos.length + idx;
                    return (
                      <div
                        key={`paq-${idx}`}
                        className={`px-4 py-2.5 cursor-pointer flex items-center gap-3 ${
                          activeIndex === globalIdx ? "bg-gray-50" : "hover:bg-gray-50"
                        }`}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        onClick={() => selectSuggestion(globalIdx)}
                      >
                        <Search className="w-4 h-4 text-gray-400" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{paq.titulo}</div>
                          {paq.destino && <div className="text-xs text-gray-500 truncate">{paq.destino}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden lg:block w-px bg-gray-200/70 self-stretch my-2" />

        <div className="w-full lg:w-[240px]">
          <div className="flex items-center gap-3 rounded-2xl lg:rounded-[22px] px-4 py-3 lg:py-4 hover:bg-black/[0.02] transition-colors">
            <Calendar className="h-5 w-5 text-[#0B6B8A]" />
            <div className="w-full">
              <div className="text-[11px] font-semibold text-gray-500">Fecha</div>
              <div className="relative">
                <select
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm font-medium text-gray-900 appearance-none pr-8 cursor-pointer"
                >
                  <option value="">Cualquier fecha</option>
                  {mesesDisponibles.map((m) => (
                    <option key={m} value={m}>
                      {formatMes(m)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-px bg-gray-200/70 self-stretch my-2" />

        <div className="w-full lg:w-[190px]">
          <div className="flex items-center gap-3 rounded-2xl lg:rounded-[22px] px-4 py-3 lg:py-4 hover:bg-black/[0.02] transition-colors">
            <User className="h-5 w-5 text-[#0B6B8A]" />
            <div className="w-full">
              <div className="text-[11px] font-semibold text-gray-500">Pasajeros</div>
              <input
                type="number"
                min={1}
                max={50}
                value={pax}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setPax(Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 1);
                }}
                className="w-full bg-transparent outline-none text-sm font-medium text-gray-900"
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          className="w-full lg:w-[150px] h-12 lg:h-auto rounded-2xl lg:rounded-[22px] bg-[#E30613] hover:bg-[#C70511] text-white font-semibold text-sm transition-colors flex items-center justify-center"
        >
          Buscar
        </button>
      </div>
    </div>
  );
}
