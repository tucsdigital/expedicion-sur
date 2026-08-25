'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DepartureSeat, SeatLayoutSpecialCell, SeatLayoutTemplate, SeatStatus } from '@/types';

type Props = {
  template: SeatLayoutTemplate;
  seats: DepartureSeat[];
  selectedSeatIds?: string[];
  maxSelectable?: number;
  onChangeSelected?: (next: string[]) => void;
  onSeatClick?: (seat: DepartureSeat) => void;
  compact?: boolean;
  activeFloor?: number;
  onActiveFloorChange?: (floor: number) => void;
  onSeatPreviewChange?: (seat: DepartureSeat | null) => void;
};

function getRowLetter(index: number) {
  let current = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);
  return label;
}

function getDisplayColumns(cols: number, aisleCols: number[]) {
  const sorted = [...aisleCols]
    .filter((value) => value > 0 && value < cols)
    .sort((a, b) => a - b);

  const result: Array<{ kind: 'cell'; col: number } | { kind: 'aisle'; key: string }> = [];
  for (let col = 0; col < cols; col += 1) {
    result.push({ kind: 'cell', col });
    if (sorted.includes(col + 1)) {
      result.push({ kind: 'aisle', key: `aisle-${col}` });
    }
  }
  return result;
}

function specialCellLabel(cell: SeatLayoutSpecialCell, compact?: boolean) {
  if (cell.label && cell.label.trim()) return cell.label.trim();
  if (cell.type === 'driver') return compact ? 'C' : 'Chofer';
  if (cell.type === 'wc') return compact ? 'B' : 'Baño';
  if (cell.type === 'stairs') return compact ? 'E' : 'Esc';
  return '';
}

function seatTone(status: SeatStatus, selected: boolean) {
  if (selected) return 'border-[#E30613] bg-[#E30613] text-white shadow-[0_10px_18px_rgba(227,6,19,0.24)]';
  if (status === 'available') return 'border-[#D9E8F7] bg-white text-[#334E71] hover:border-[#E30613] hover:bg-[#FFF1F1]';
  if (status === 'held') return 'border-[#F2D089] bg-[#FFF8EA] text-[#B7791F]';
  if (status === 'paid' || status === 'reserved') return 'border-gray-200 bg-gray-100 text-gray-500';
  if (status === 'blocked') return 'border-[#F2C7D3] bg-[#FFF4F7] text-[#C24162]';
  return 'border-[#E0E8EF] bg-[#F6FAFD] text-[#7B8EA5]';
}

function specialTone(type: SeatLayoutSpecialCell['type']) {
  if (type === 'driver') return 'border-[#F8D7A5] bg-[#FFF8EC] text-[#CA7A03]';
  if (type === 'wc') return 'border-[#BFD6FF] bg-[#F4F8FF] text-[#336FF4]';
  if (type === 'stairs') return 'border-[#D8C9FF] bg-[#F8F5FF] text-[#8155F6]';
  return 'border-[#D6E1EC] bg-[#F8FBFE] text-[#70839E]';
}

export default function SeatMap({
  template,
  seats,
  selectedSeatIds,
  maxSelectable,
  onChangeSelected,
  onSeatClick,
  compact,
  activeFloor: controlledActiveFloor,
  onActiveFloorChange,
  onSeatPreviewChange,
}: Props) {
  const selected = selectedSeatIds ?? [];
  const [internalActiveFloor, setInternalActiveFloor] = useState(0);

  const seatByPos = useMemo(() => {
    const map = new Map<string, DepartureSeat>();
    for (const seat of seats) {
      map.set(`${seat.floor}:${seat.row}:${seat.col}`, seat);
    }
    return map;
  }, [seats]);

  const specialByPos = useMemo(() => {
    const map = new Map<string, SeatLayoutSpecialCell>();
    for (const cell of template.specialCells ?? []) {
      map.set(`${cell.floor}:${cell.row}:${cell.col}`, cell);
    }
    return map;
  }, [template.specialCells]);

  const cols = Math.max(1, Number(template.cols ?? 1));
  const rows = Math.max(1, Number(template.rows ?? 1));
  const floors = Math.max(1, Number(template.floors ?? 1));
  const displayColumns = useMemo(() => getDisplayColumns(cols, template.aisleCols ?? []), [cols, template.aisleCols]);
  const showRowLabels = template.showRowLabels !== false;
  const activeFloor = Math.max(0, Math.min(controlledActiveFloor ?? internalActiveFloor, floors - 1));

  useEffect(() => {
    if (controlledActiveFloor == null) {
      setInternalActiveFloor((prev) => Math.max(0, Math.min(prev, floors - 1)));
    } else if (controlledActiveFloor !== activeFloor) {
      onActiveFloorChange?.(activeFloor);
    }
  }, [activeFloor, controlledActiveFloor, floors, onActiveFloorChange]);

  const setFloor = (floor: number) => {
    if (controlledActiveFloor == null) {
      setInternalActiveFloor(floor);
    }
    onActiveFloorChange?.(floor);
  };

  const handleToggle = (seat: DepartureSeat) => {
    onSeatPreviewChange?.(seat);
    if (onSeatClick) {
      onSeatClick(seat);
      return;
    }
    if (!onChangeSelected) return;
    if (seat.status !== 'available' && !selected.includes(seat.seatId)) return;

    const exists = selected.includes(seat.seatId);
    // Incluir fila y columna en el ID temporal para que el backend lo reciba
    const seatIdWithInfo = `${seat.seatId}|${seat.label}|${getRowLetter(seat.row)}|${seat.col + 1}`;
    
    const next = exists 
      ? selected.filter((id) => id !== seat.seatId) 
      : [...selected, seat.seatId];
    
    const limited = typeof maxSelectable === 'number' ? next.slice(0, Math.max(0, maxSelectable)) : next;
    onChangeSelected(limited);
  };

  const floorStats = useMemo(() => {
    const map = new Map<number, number>();
    for (const seat of seats) {
      map.set(seat.floor, (map.get(seat.floor) ?? 0) + 1);
    }
    return map;
  }, [seats]);

  const activeSelectedSeat = useMemo(() => {
    const activeSeats = seats.filter((seat) => seat.floor === activeFloor && selected.includes(seat.seatId));
    return activeSeats.at(-1) ?? null;
  }, [activeFloor, seats, selected]);

  useEffect(() => {
    if (onSeatPreviewChange) {
      onSeatPreviewChange(activeSelectedSeat);
    }
  }, [activeSelectedSeat, onSeatPreviewChange]);

  return (
    <div className="space-y-4">
      {floors > 1 ? (
        <div className="border-b border-[#E4EEF7]">
          <div className="flex flex-wrap gap-6">
            {Array.from({ length: floors }, (_, floor) => (
              <button
                key={`seatmap-floor-${floor}`}
                type="button"
                onClick={() => setFloor(floor)}
                className={cn(
                  'border-b-2 px-1 pb-3 text-[13px] font-black transition-colors',
                  activeFloor === floor
                    ? 'border-[#08A7C7] text-[#118CA7]'
                    : 'border-transparent text-[#8398B0] hover:text-[#12325D]'
                )}
              >
                Piso {floor + 1}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[26px] border border-[#DCEAF8] bg-[linear-gradient(180deg,#FCFEFF_0%,#F4FAFF_100%)] p-4 sm:p-5">
        <div className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7C95AE]">
          Frente del vehiculo
        </div>
        <div className="mt-2 flex justify-center">
          <svg width={compact ? '220' : '280'} height="22" viewBox="0 0 280 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 18C60 6 220 6 270 18" stroke="#BFD8EE" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="mx-auto flex w-fit items-start gap-3">
            {showRowLabels ? (
              <div className={cn(compact ? 'pt-[70px]' : 'pt-[84px]')}>
                <div className={cn(compact ? 'space-y-1.5' : 'space-y-2')}>
                  {Array.from({ length: rows }, (_, row) => (
                    <div
                      key={`row-label-${activeFloor}-${row}`}
                      className={cn(
                        'flex items-center justify-center text-center font-black text-[#1A93B7]',
                        compact ? 'h-8 w-5 text-[10px]' : 'h-10 w-6 text-[11px]'
                      )}
                    >
                      {getRowLetter(row)}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="relative rounded-[30px] border border-[#D5E3F0] bg-white p-[10px] shadow-[0_14px_30px_rgba(18,89,150,0.08)]">
              <div className="absolute inset-x-4 top-3 h-10 rounded-full bg-[linear-gradient(180deg,rgba(168,182,198,0.55)_0%,rgba(255,255,255,0.12)_100%)]" />
              <div className="relative rounded-[24px] border border-[#DCE8F4] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FBFF_100%)] px-3 pb-3 pt-4">
                <div className="mx-auto mb-4 h-8 w-[76%] rounded-full border border-[#C8D6E4] bg-[linear-gradient(180deg,#E5EAF0_0%,#FAFCFE_100%)]" />

                <div className={cn(compact ? 'space-y-1.5' : 'space-y-2')}>
                  {Array.from({ length: rows }, (_, row) => (
                    <div
                      key={`floor-${activeFloor}-row-${row}`}
                      className={cn('grid items-center', compact ? 'gap-1.5' : 'gap-2')}
                      style={{
                        gridTemplateColumns: displayColumns
                          .map((item) => (item.kind === 'aisle' ? (compact ? '10px' : '14px') : compact ? '32px' : '40px'))
                          .join(' '),
                      }}
                    >
                      {displayColumns.map((item) => {
                        if (item.kind === 'aisle') {
                          return (
                            <div key={item.key} className="flex justify-center">
                              <div className={cn('rounded-full bg-[#E0EAF4]', compact ? 'h-8 w-[6px]' : 'h-10 w-[8px]')} />
                            </div>
                          );
                        }

                        const key = `${activeFloor}:${row}:${item.col}`;
                        const special = specialByPos.get(key);
                        if (special) {
                          return (
                            <div
                              key={key}
                              className={cn(
                                'flex items-center justify-center rounded-xl border text-center font-black tracking-[-0.02em]',
                                compact ? 'h-8 w-8 text-[9px]' : 'h-10 w-10 text-[10px]',
                                specialTone(special.type)
                              )}
                              title={specialCellLabel(special)}
                            >
                              {specialCellLabel(special, compact)}
                            </div>
                          );
                        }

                        const seat = seatByPos.get(key);
                        if (!seat) {
                          return (
                            <div
                              key={key}
                              className={cn(compact ? 'h-8 w-8' : 'h-10 w-10')}
                            />
                          );
                        }

                        const isSelected = selected.includes(seat.seatId);
                        const disabled =
                          (!onSeatClick && !onChangeSelected) || (seat.status !== 'available' && !isSelected);

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleToggle(seat)}
                            disabled={disabled}
                            className={cn(
                              'relative flex items-center justify-center rounded-xl border font-black tracking-[-0.02em] transition-all duration-200 will-change-transform',
                              compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-[11px]',
                              seatTone(seat.status, isSelected),
                              disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-0 active:scale-[0.98]'
                            )}
                            title={`Butaca ${seat.label} (${seat.status})`}
                            aria-label={`Butaca ${seat.label}`}
                          >
                            <span>{seat.label}</span>
                            {isSelected ? (
                              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_4px_10px_rgba(8,46,86,0.16)]">
                                <Check className="h-3 w-3 text-[#E30613]" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <LegendItem label="Disponible" className="border-[#D9E8F7] bg-white" />
                          <LegendItem label="Seleccionada" className="border-[#E30613] bg-[#E30613]" />
          <LegendItem label="En hold" className="border-[#F2D089] bg-[#FFF8EA]" />
          <LegendItem label="Ocupada" className="border-gray-200 bg-gray-100" />
          <LegendItem label="Bloqueada" className="border-[#F2C7D3] bg-[#FFF4F7]" />
          <LegendItem label="Deshabilitada" className="border-[#E0E8EF] bg-[#F6FAFD]" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#607B9C]">
        <div>
          Piso activo: <span className="font-semibold text-[#12325D]">Piso {activeFloor + 1}</span>
          <span className="mx-2 text-[#D0DCE8]">•</span>
          <span>{floorStats.get(activeFloor) ?? 0} butacas</span>
        </div>
        {typeof maxSelectable === 'number' ? (
          <div>
            Seleccionadas: <span className="font-semibold text-[#12325D]">{selected.length}</span> / {maxSelectable}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LegendItem({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[#5E7898]">
      <span className={cn('h-4 w-4 rounded border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]', className)} />
      <span>{label}</span>
    </div>
  );
}
