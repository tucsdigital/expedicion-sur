"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Calendar, X } from "lucide-react";
import { Paquete } from "@/types";
import { Button } from "@/components/ui/button";

interface HeroSearchProps {
  paquetes: Paquete[];
}

export default function HeroSearch({ paquetes }: HeroSearchProps) {
  const router = useRouter();
  const suggestionsListId = "hero-search-suggestions";
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mes, setMes] = useState("");
  
  // Para evitar que q y selectedSlug viajen juntos si no tienen sentido
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedDestino, setSelectedDestino] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(handler);
  }, [q]);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mesesDisponibles = useMemo(() => {
    const setMeses = new Set<string>();
    paquetes.forEach(p => {
      p.salidas?.forEach(s => {
        if (s.fecha) {
          const yyyyMm = s.fecha.substring(0, 7);
          setMeses.add(yyyyMm);
        }
      });
    });
    return Array.from(setMeses).sort();
  }, [paquetes]);

  const formatMes = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  };

  const suggestions = useMemo(() => {
    if (!debouncedQ.trim()) return { destinos: [], paquetes: [] };
    const term = debouncedQ.toLowerCase().trim();
    
    const matchedDestinos = new Set<string>();
    const matchedPaquetes: { titulo: string; slug: string; destino: string }[] = [];

    paquetes.forEach(p => {
      const isMatch = p.titulo.toLowerCase().includes(term) || (p.destino && p.destino.toLowerCase().includes(term));
      if (isMatch) {
        if (p.destino && p.destino.toLowerCase().includes(term)) {
          matchedDestinos.add(p.destino);
        }
        if (p.titulo.toLowerCase().includes(term)) {
          matchedPaquetes.push({ titulo: p.titulo, slug: p.slug, destino: p.destino || "" });
        }
      }
    });

    return {
      destinos: Array.from(matchedDestinos).slice(0, 4),
      paquetes: matchedPaquetes.slice(0, 6)
    };
  }, [debouncedQ, paquetes]);

  const totalSuggestions = suggestions.destinos.length + suggestions.paquetes.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => (prev < totalSuggestions - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        selectSuggestion(activeIndex);
      } else {
        handleSearch();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

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

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedSlug) {
      params.set("slug", selectedSlug);
    } else if (selectedDestino) {
      params.set("destino", selectedDestino);
    } else if (q.trim()) {
      params.set("q", q.trim());
    }
    
    if (mes) {
      params.set("mes", mes);
    }

    router.push(params.toString() ? `/paquetes?${params.toString()}` : "/paquetes");
  };

  return (
    <div className="relative mx-auto w-full max-w-4xl rounded-[20px] bg-white p-1.5 shadow-xl text-gray-800 md:rounded-2xl md:p-4" ref={containerRef}>
      <div className="flex flex-col gap-1.5 md:flex-row md:gap-3">
        {/* Input Buscador */}
        <div className="relative flex-1">
          <div className="flex items-center rounded-[15px] border border-transparent bg-gray-50 px-3 py-2 transition-colors focus-within:border-primary focus-within:bg-white md:rounded-xl md:px-4 md:py-3">
            <Search className="mr-2 h-3.5 w-3.5 text-gray-400 md:mr-3 md:h-5 md:w-5" />
            <input 
              type="text"
              placeholder="¿A dónde quieres viajar?"
              className="w-full bg-transparent text-[12px] text-gray-700 outline-none placeholder:text-[12px] placeholder:text-gray-400 md:text-base md:placeholder:text-base"
              value={q}
              onChange={e => {
                setQ(e.target.value);
                setSelectedSlug(null);
                setSelectedDestino(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={suggestionsListId}
              aria-autocomplete="list"
            />
            {q && (
              <button onClick={() => { setQ(""); setSelectedSlug(null); setSelectedDestino(null); }} className="rounded-full p-1 hover:bg-gray-200">
                <X className="h-3.5 w-3.5 text-gray-500" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showSuggestions && (debouncedQ.trim().length > 0) && totalSuggestions > 0 && (
            <div
              id={suggestionsListId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-[16px] border border-gray-100 bg-white shadow-2xl md:mt-2 md:rounded-xl"
            >
              {suggestions.destinos.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 md:text-xs">Destinos</div>
                  {suggestions.destinos.map((dest, idx) => (
                    <div 
                      key={`dest-${idx}`}
                      className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[12px] ${activeIndex === idx ? "bg-gray-50" : "hover:bg-gray-50"} md:gap-3 md:px-4 md:text-base`}
                      onClick={() => selectSuggestion(idx)}
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary md:h-4 md:w-4" />
                      <span>{dest}</span>
                    </div>
                  ))}
                </div>
              )}
              {suggestions.paquetes.length > 0 && (
                <div className="py-2 border-t border-gray-50">
                  <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 md:text-xs">Excursiones</div>
                  {suggestions.paquetes.map((paq, idx) => {
                    const globalIdx = suggestions.destinos.length + idx;
                    return (
                      <div 
                        key={`paq-${idx}`}
                        className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 ${activeIndex === globalIdx ? "bg-gray-50" : "hover:bg-gray-50"} md:gap-3 md:px-4`}
                        onClick={() => selectSuggestion(globalIdx)}
                      >
                        <Search className="h-3.5 w-3.5 text-gray-400 md:h-4 md:w-4" />
                        <div>
                          <div className="text-[12px] font-medium md:text-base">{paq.titulo}</div>
                          {paq.destino && <div className="text-[11px] text-gray-500 md:text-xs">{paq.destino}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selector de Mes */}
        <div className="relative w-full md:w-56">
          <div className="flex h-full items-center rounded-[15px] border border-transparent bg-gray-50 px-3 py-2 transition-colors focus-within:border-primary focus-within:bg-white md:rounded-xl md:px-4 md:py-3">
            <Calendar className="mr-2 h-3.5 w-3.5 shrink-0 text-gray-400 md:mr-3 md:h-5 md:w-5" />
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-full cursor-pointer appearance-none truncate bg-transparent text-[12px] text-gray-700 outline-none md:text-base"
            >
              <option value="">Cualquier fecha</option>
              {mesesDisponibles.map((m) => (
                <option key={m} value={m}>
                  {formatMes(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botón Buscar */}
        <Button 
          onClick={handleSearch}
          className="h-10 rounded-[15px] bg-primary px-5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-primary/90 md:h-auto md:rounded-xl md:px-8 md:py-3 md:text-base"
        >
          Buscar
        </Button>
      </div>
    </div>
  );
}
