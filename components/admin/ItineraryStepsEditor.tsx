'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import RichTextEditor from '@/components/admin/RichTextEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ItineraryStepFormItem } from '@/lib/packages/admin-form';

function createStepId() {
  return `step-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type Props = {
  steps: ItineraryStepFormItem[];
  onChange: (steps: ItineraryStepFormItem[]) => void;
  disabled?: boolean;
};

export default function ItineraryStepsEditor({ steps, onChange, disabled }: Props) {
  const items = Array.isArray(steps) ? steps : [];

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    onChange(next);
  };

  const updateStep = (index: number, patch: Partial<ItineraryStepFormItem>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const removeStep = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addStep = () => {
    onChange([
      ...items,
      {
        id: createStepId(),
        titulo: '',
        descripcion: '',
      },
    ]);
  };

  return (
    <div className="space-y-4">
      {items.length > 0 ? (
        <div className="grid gap-3">
          {items.map((step, index) => (
            <div key={step.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-900 px-2 text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <div className="text-sm font-semibold text-gray-900">Paso</div>
                  </div>

                  <div>
                    <Label className="text-sm">Título (opcional)</Label>
                    <Input
                      value={step.titulo}
                      onChange={(event) => updateStep(index, { titulo: event.target.value })}
                      placeholder="Ej: Día 1 · Llegada"
                      className="mt-1.5"
                      disabled={disabled}
                    />
                  </div>

                  <div>
                    <Label className="text-sm">Descripción</Label>
                    <div className="mt-1.5">
                      <RichTextEditor
                        content={step.descripcion || ''}
                        onChange={(html) => updateStep(index, { descripcion: html })}
                        placeholder="Detalle del paso..."
                        enableMedia={false}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => moveStep(index, index - 1)}
                    disabled={disabled || index === 0}
                    aria-label="Subir paso"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => moveStep(index, index + 1)}
                    disabled={disabled || index === items.length - 1}
                    aria-label="Bajar paso"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeStep(index)}
                    disabled={disabled}
                    aria-label="Eliminar paso"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
          <div className="text-sm font-semibold text-gray-900">Todavía no hay pasos cargados</div>
          <div className="mt-1 text-xs text-gray-500">Agregá el primer paso para armar el itinerario.</div>
        </div>
      )}

      <Button type="button" variant="outline" onClick={addStep} disabled={disabled} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Agregar paso
      </Button>
    </div>
  );
}

