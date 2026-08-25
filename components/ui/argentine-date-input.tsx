"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatArDateValue(value: string): string {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return trimmed;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function parseArDateValue(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  if (!day || !month || !year || month > 12 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return iso;
}

type ArgentineDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  className?: string;
  iconClassName?: string;
};

export function ArgentineDateInput({
  value,
  onChange,
  onBlur,
  id,
  placeholder = "18/05/2025",
  className,
  iconClassName,
}: ArgentineDateInputProps) {
  const [draft, setDraft] = useState(formatArDateValue(value));

  useEffect(() => {
    setDraft(formatArDateValue(value));
  }, [value]);

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        lang="es-AR"
        value={draft}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const parsed = parseArDateValue(next);
          if (parsed !== null) {
            onChange(parsed);
          }
          if (!next.trim()) {
            onChange("");
          }
        }}
        onBlur={() => {
          const parsed = parseArDateValue(draft);
          if (parsed === null) {
            setDraft(formatArDateValue(value));
          } else {
            setDraft(formatArDateValue(parsed));
            onChange(parsed);
          }
          onBlur?.();
        }}
        placeholder={placeholder}
        className={cn("pl-10", className)}
      />
      <Calendar className={cn("absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400", iconClassName)} />
    </div>
  );
}
