"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, ChevronDown, Compass, MapPin, Search, X, type LucideIcon } from "lucide-react";
import {
  buildSearchHref,
  buildSearchIndex,
  findExperience,
  formatMonthLabel,
  getAvailableMonths,
  getExperiences,
  normalizeSearchText,
  type SearchData,
} from "@/lib/search/home-search";

interface HeroSearchProps {
  data: SearchData;
}

type Option = { value: string; label: string; hint?: string };

type FieldProps = {
  label: string;
  icon: LucideIcon;
  placeholder: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
  allLabel?: string;
  emptyText: string;
};

function Field({
  label,
  icon: Icon,
  placeholder,
  options,
  value,
  onChange,
  searchable = true,
  allLabel,
  emptyText,
}: FieldProps) {
  const baseId = useId();
  const listId = `${baseId}-list`;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((option) => option.value === value) ?? null;

  const visible = useMemo(() => {
    const term = normalizeSearchText(query);
    const filtered = term
      ? options.filter((option) => normalizeSearchText(`${option.label} ${option.hint ?? ""}`).includes(term))
      : options;
    return allLabel && !term ? [{ value: "", label: allLabel }, ...filtered] : filtered;
  }, [allLabel, options, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const openList = () => {
    setActive(Math.max(0, visible.findIndex((option) => option.value === value)));
    setOpen(true);
    if (searchable) inputRef.current?.focus();
    else buttonRef.current?.focus();
  };

  const choose = (option: Option) => {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) return openList();
      setActive((current) => Math.min(visible.length - 1, current + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(0, current - 1));
    } else if (event.key === "Enter") {
      if (open && visible[active]) {
        event.preventDefault();
        choose(visible[active]);
      } else if (!open) {
        event.preventDefault();
        openList();
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${baseId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, baseId, open]);

  const showValue = Boolean(selected) && !open;
  const displayText = selected && !open ? selected.label : "";

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <div
        role="presentation"
        onClick={() => (open ? undefined : openList())}
        className={`group flex h-full min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl px-4 py-2.5 transition-colors md:rounded-full md:px-6 ${
          open ? "bg-[#F7F3ED]" : "hover:bg-[#F7F3ED]/70"
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[#CBBBA0] transition-colors group-hover:bg-[#E30613]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">{label}</div>
          {searchable ? (
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open ? `${baseId}-opt-${active}` : undefined}
              aria-label={label}
              value={open ? query : displayText}
              placeholder={placeholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => !open && openList()}
              onKeyDown={onKeyDown}
              autoComplete="off"
              className={`w-full truncate bg-transparent text-[15px] font-semibold outline-none placeholder:font-medium ${
                showValue ? "text-[#111111]" : "text-[#111111] placeholder:text-neutral-400"
              }`}
            />
          ) : (
            <button
              ref={buttonRef}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-haspopup="listbox"
              aria-label={label}
              aria-activedescendant={open ? `${baseId}-opt-${active}` : undefined}
              onKeyDown={onKeyDown}
              className="block w-full truncate text-left text-[15px] font-semibold outline-none"
            >
              <span className={selected ? "text-[#111111]" : "font-medium text-neutral-400"}>
                {selected ? selected.label : placeholder}
              </span>
            </button>
          )}
        </div>
        {value ? (
          <button
            type="button"
            aria-label={`Quitar ${label.toLowerCase()}`}
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
              setQuery("");
            }}
            className="rounded-full p-1.5 text-neutral-400 transition hover:bg-black/5 hover:text-neutral-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </div>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 min-w-[260px] overflow-y-auto rounded-2xl border border-black/5 bg-white p-1.5 shadow-[0_24px_60px_rgba(17,17,17,0.18)] md:right-auto md:w-[22rem]"
        >
          {visible.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-neutral-500">{emptyText}</div>
          ) : (
            visible.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={`${option.value}-${index}`}
                  id={`${baseId}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                    index === active ? "bg-[#F7F3ED]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className={`truncate ${isSelected ? "font-bold" : "font-semibold"} text-[#111111]`}>{option.label}</div>
                    {option.hint ? <div className="truncate text-xs text-neutral-500">{option.hint}</div> : null}
                  </div>
                  {isSelected ? <Check className="h-4 w-4 shrink-0 text-[#E30613]" /> : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function HeroSearch({ data }: HeroSearchProps) {
  const router = useRouter();
  const [destino, setDestino] = useState("");
  const [slug, setSlug] = useState("");
  const [mes, setMes] = useState("");

  const index = useMemo(() => buildSearchIndex(data.entries, data.destinations), [data]);

  const destinationOptions = useMemo<Option[]>(
    () =>
      index.destinations.map((item) => ({
        value: item.id,
        label: item.label,
        hint: `${item.count} ${item.count === 1 ? "experiencia" : "experiencias"}`,
      })),
    [index]
  );

  const destinationLabels = useMemo(() => new Map(index.destinations.map((item) => [item.id, item.label])), [index]);

  const experienceOptions = useMemo<Option[]>(
    () =>
      getExperiences(index, destino).map((item) => ({
        value: item.slug,
        label: item.title,
        hint: item.destinationIds.map((id) => destinationLabels.get(id)).filter(Boolean).join(' · ') || undefined,
      })),
    [destino, destinationLabels, index]
  );

  const monthOptions = useMemo<Option[]>(
    () => getAvailableMonths(index, destino, slug).map((month) => ({ value: month, label: formatMonthLabel(month) })),
    [destino, index, slug]
  );

  const handleDestinoChange = (next: string) => {
    const current = slug ? findExperience(index, slug) : null;
    const keepSlug = !next || !current || current.destinationIds.includes(next);
    const nextSlug = keepSlug ? slug : "";
    setDestino(next);
    setSlug(nextSlug);
    if (mes && !getAvailableMonths(index, next, nextSlug).includes(mes)) setMes("");
  };

  const handleExperienceChange = (nextSlug: string) => {
    const experience = nextSlug ? findExperience(index, nextSlug) : null;
    const nextDestino =
      !experience || experience.destinationIds.length === 0 || experience.destinationIds.includes(destino)
        ? destino
        : experience.destinationIds[0];
    setSlug(nextSlug);
    setDestino(nextDestino);
    if (mes && !getAvailableMonths(index, nextDestino, nextSlug).includes(mes)) setMes("");
  };

  const handleSearch = () => {
    const destinationLabel = index.destinations.find((item) => item.id === destino)?.label;
    router.push(buildSearchHref({ slug, destinationLabel, month: mes }));
  };

  return (
    <div className="mx-auto w-full max-w-5xl rounded-[28px] border border-white/60 bg-white/95 p-2 shadow-[0_30px_70px_rgba(17,17,17,0.28)] backdrop-blur-xl md:rounded-full md:p-2.5">
      <div className="flex flex-col gap-1 md:flex-row md:items-stretch md:gap-0">
        <Field
          label="Destino"
          icon={MapPin}
          placeholder="¿A dónde querés ir?"
          options={destinationOptions}
          value={destino}
          onChange={handleDestinoChange}
          allLabel="Todos los destinos"
          emptyText="No encontramos destinos"
        />
        <div className="mx-4 h-px bg-black/5 md:mx-0 md:my-3 md:h-auto md:w-px" />
        <Field
          label="Experiencia"
          icon={Compass}
          placeholder={destino ? "Elegí una experiencia" : "Buscá una experiencia"}
          options={experienceOptions}
          value={slug}
          onChange={handleExperienceChange}
          allLabel="Todas las experiencias"
          emptyText="No encontramos experiencias"
        />
        <div className="mx-4 h-px bg-black/5 md:mx-0 md:my-3 md:h-auto md:w-px" />
        <Field
          label="Fecha"
          icon={Calendar}
          placeholder="Cualquier fecha"
          options={monthOptions}
          value={mes}
          onChange={setMes}
          searchable={false}
          allLabel="Cualquier fecha"
          emptyText="Sin salidas próximas"
        />
        <button
          type="button"
          onClick={handleSearch}
          className="mt-1 inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#111111] px-8 text-[15px] font-semibold text-[#CBBBA0] transition hover:bg-[#E30613] active:scale-[0.98] md:ml-2 md:mt-0 md:h-auto md:rounded-full"
        >
          <Search className="h-4 w-4" />
          Buscar
        </button>
      </div>
    </div>
  );
}
