'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Experience } from '@/components/landing-reserva/types';
import ExperienceCard from '@/components/ExperienceCard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X, SlidersHorizontal, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortExperiencias = 'relevancia' | 'nombre' | 'precio';

interface ExperienciasClientProps {
  experiencias: Experience[];
}

export default function ExperienciasClient({ experiencias }: ExperienciasClientProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForWho, setSelectedForWho] = useState<string[]>([]);
  const [selectedIncluye, setSelectedIncluye] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortExperiencias>('relevancia');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Filtros dinámicos: Para quién (forWho) e Incluye
  const forWhoOpciones = useMemo(() => {
    const set = new Set<string>();
    experiencias.forEach((e) => {
      (e.forWho || []).forEach((item) => {
        const t = String(item).trim();
        if (t) set.add(t);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [experiencias]);

  const incluyeOpciones = useMemo(() => {
    const set = new Set<string>();
    experiencias.forEach((e) => {
      (e.includes || []).forEach((item) => {
        const t = String(item).trim();
        if (t) set.add(t);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [experiencias]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedForWho, selectedIncluye, sortBy]);

  const experienciasFiltradas = useMemo(() => {
    let list = experiencias.filter((exp) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const searchable =
          [exp.title, exp.subtitle, exp.supportText, (exp.includes || []).join(' '), (exp.forWho || []).join(' ')]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        if (!searchable.includes(term)) return false;
      }
      if (selectedForWho.length > 0) {
        const expForWho = (exp.forWho || []).map((i) => String(i).trim());
        const tieneAlguno = selectedForWho.some((sel) => expForWho.includes(sel));
        if (!tieneAlguno) return false;
      }
      if (selectedIncluye.length > 0) {
        const expIncluye = (exp.includes || []).map((i) => String(i).trim());
        const tieneTodos = selectedIncluye.every((sel) => expIncluye.includes(sel));
        if (!tieneTodos) return false;
      }
      return true;
    });

    // Ordenar
    if (sortBy === 'nombre') {
      list = [...list].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortBy === 'precio') {
      list = [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    }
    // relevancia: mantener orden original (orden de la lista)

    return list;
  }, [experiencias, searchTerm, selectedForWho, selectedIncluye, sortBy]);

  const totalPages = Math.ceil(experienciasFiltradas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginadas = useMemo(
    () => experienciasFiltradas.slice(startIndex, endIndex),
    [experienciasFiltradas, startIndex, endIndex]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const toggleForWho = (item: string) => {
    setSelectedForWho((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const toggleIncluye = (item: string) => {
    setSelectedIncluye((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const limpiarFiltros = () => {
    setSearchTerm('');
    setSelectedForWho([]);
    setSelectedIncluye([]);
  };

  const hayFiltrosActivos =
    searchTerm.trim() !== '' || selectedForWho.length > 0 || selectedIncluye.length > 0;

  return (
    <section className="pt-6 pb-12 md:pt-10 md:pb-16 bg-cream">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          <aside className="lg:col-span-1">
            <div className="lg:hidden mb-4">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="w-full border-gray-300 bg-white hover:bg-gray-50 text-black h-11 font-semibold"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
              </Button>
            </div>

            <div
              className={`${showFilters ? 'block' : 'hidden'} lg:block bg-white border border-gray-200 rounded-xl p-5 sticky top-4 shadow-sm`}
            >
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-gray-100">
                <h2 className="text-base font-bold text-black">Filtros</h2>
                {hayFiltrosActivos && (
                  <Button onClick={limpiarFiltros} variant="ghost" size="sm" className="text-gray-600 hover:bg-gray-100 text-xs">
                    Limpiar
                  </Button>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Título, descripción..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-10 border-gray-200 focus:border-black focus:ring-1 focus:ring-black bg-gray-50/80 text-sm"
                    />
                  </div>
                </div>

                {forWhoOpciones.length > 0 && (
                  <div className="pt-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">
                      Para quién ({forWhoOpciones.length})
                    </Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {forWhoOpciones.map((item) => (
                        <label
                          key={item}
                          className="flex items-center gap-2.5 cursor-pointer group"
                        >
                          <Checkbox
                            checked={selectedForWho.includes(item)}
                            onCheckedChange={() => toggleForWho(item)}
                            className="border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-black">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {incluyeOpciones.length > 0 && (
                  <div className="pt-1 border-t border-gray-100">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">
                      Incluye ({incluyeOpciones.length})
                    </Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {incluyeOpciones.map((item) => (
                        <label
                          key={item}
                          className="flex items-center gap-2.5 cursor-pointer group"
                        >
                          <Checkbox
                            checked={selectedIncluye.includes(item)}
                            onCheckedChange={() => toggleIncluye(item)}
                            className="border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-black">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <div className="lg:col-span-3">
            {/* Barra: resultados + ordenar + por página */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-black">{experienciasFiltradas.length}</span>{' '}
                {experienciasFiltradas.length === 1 ? 'experiencia' : 'experiencias'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">Ordenar:</span>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortExperiencias)}>
                    <SelectTrigger className="w-[160px] h-9 bg-white border-gray-200 text-sm text-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevancia">Relevancia</SelectItem>
                      <SelectItem value="nombre">Nombre A–Z</SelectItem>
                      <SelectItem value="precio">Precio (menor a mayor)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(v) => {
                    setItemsPerPage(Number(v));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[130px] h-9 bg-white border-gray-200 text-sm text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 por página</SelectItem>
                    <SelectItem value="24">24 por página</SelectItem>
                    <SelectItem value="48">48 por página</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {experiencias.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 mb-6">
                  <X className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-bold text-black mb-3">No hay experiencias disponibles</h3>
                <p className="text-gray-600 max-w-md mx-auto">Aún no hay experiencias publicadas.</p>
              </div>
            ) : experienciasFiltradas.length > 0 ? (
              <>
                <div className="text-xs text-gray-500 mb-4">
                  Mostrando {startIndex + 1}–{Math.min(endIndex, experienciasFiltradas.length)} de{' '}
                  {experienciasFiltradas.length}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
                  >
                    {paginadas.map((exp, index) => (
                      <ExperienceCard key={exp.id} experience={exp} index={startIndex + index} />
                    ))}
                  </motion.div>
                </AnimatePresence>

                {totalPages > 1 && (
                  <div className="mt-12 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="h-9 w-9 p-0 border-gray-300 text-black hover:bg-gray-100"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-9 w-9 p-0 border-gray-300 text-black hover:bg-gray-100"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                          .map((p, i, arr) => {
                            const prev = i > 0 ? arr[i - 1] : 0;
                            const showEllipsis = prev && p - prev > 1;
                            return (
                              <div key={p} className="flex items-center gap-1">
                                {showEllipsis && <span className="px-2 text-gray-400">...</span>}
                                <Button
                                  variant={currentPage === p ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setCurrentPage(p)}
                                  className={`h-9 w-9 p-0 ${
                                    currentPage === p
                                      ? 'bg-black text-white hover:bg-gray-800 border-black'
                                      : 'border-gray-300 text-black hover:bg-gray-100'
                                  }`}
                                >
                                  {p}
                                </Button>
                              </div>
                            );
                          })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="h-9 w-9 p-0 border-gray-300 text-black hover:bg-gray-100"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-9 w-9 p-0 border-gray-300 text-black hover:bg-gray-100"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Página {currentPage} de {totalPages}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 mb-6">
                  <X className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-bold text-black mb-3">No se encontraron experiencias</h3>
                <p className="text-gray-600 mb-4 max-w-md mx-auto">
                  No hay experiencias que coincidan con los filtros.
                </p>
                {hayFiltrosActivos && (
                  <Button
                    onClick={limpiarFiltros}
                    className="bg-black text-white hover:bg-gray-800"
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
