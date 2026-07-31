'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedAmountInput } from '@/components/ui/formatted-amount-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { Salida } from '@/types';

interface SalidasManagerProps {
  salidas: Salida[];
  onSalidasChange: (salidas: Salida[]) => void;
}

export default function SalidasManager({ salidas, onSalidasChange }: SalidasManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Omit<Salida, 'id'>>({
    fecha: '',
    fechaVuelta: '',
    ciudadSalida: '',
    precio: 0,
    moneda: 'ARS',
    cupo: undefined,
    observaciones: '',
  });

  const resetForm = () => {
    setFormData({
      fecha: '',
      fechaVuelta: '',
      ciudadSalida: '',
      precio: 0,
      moneda: 'ARS',
      cupo: undefined,
      observaciones: '',
    });
  };

  const handleAdd = () => {
    if (formData.precio <= 0) {
      alert('El precio es obligatorio');
      return;
    }

    const fecha = formData.fecha?.trim() || '';
    const fechaVuelta = formData.fechaVuelta?.trim() || '';
    const ciudadSalida = formData.ciudadSalida?.trim() || '';

    // Sanitizar datos antes de guardar
    const sanitizedData: Partial<Salida> = {
      fecha,
      ciudadSalida,
      precio: Number(formData.precio) || 0,
      moneda: formData.moneda,
      observaciones: formData.observaciones?.trim() || '',
    };

    if (fechaVuelta) {
      sanitizedData.fechaVuelta = fechaVuelta;
    }
    
    // Solo agregar cupo si tiene un valor válido
    if (formData.cupo && formData.cupo > 0) {
      sanitizedData.cupo = Number(formData.cupo);
    }

    const newSalida: Salida = {
      id: `salida-${Date.now()}`,
      ...sanitizedData,
    } as Salida;

    onSalidasChange([...salidas, newSalida]);
    resetForm();
    setIsAdding(false);
  };

  const handleEdit = (salida: Salida) => {
    setEditingId(salida.id);
    setFormData({
      fecha: salida.fecha,
      fechaVuelta: salida.fechaVuelta || '',
      ciudadSalida: salida.ciudadSalida,
      precio: salida.precio,
      moneda: salida.moneda,
      cupo: salida.cupo,
      observaciones: salida.observaciones || '',
    });
  };

  const handleSaveEdit = () => {
    if (formData.precio <= 0) {
      alert('El precio es obligatorio');
      return;
    }

    const fecha = formData.fecha?.trim() || '';
    const fechaVuelta = formData.fechaVuelta?.trim() || '';
    const ciudadSalida = formData.ciudadSalida?.trim() || '';

    // Sanitizar datos antes de guardar
    const sanitizedData: Partial<Salida> = {
      fecha,
      ciudadSalida,
      precio: Number(formData.precio) || 0,
      moneda: formData.moneda,
      observaciones: formData.observaciones?.trim() || '',
    };

    if (fechaVuelta) {
      sanitizedData.fechaVuelta = fechaVuelta;
    }
    
    // Solo agregar cupo si tiene un valor válido
    if (formData.cupo && formData.cupo > 0) {
      sanitizedData.cupo = Number(formData.cupo);
    }

    const updatedSalidas = salidas.map((s) =>
      s.id === editingId
        ? { ...s, ...sanitizedData } as Salida
        : s
    );

    onSalidasChange(updatedSalidas);
    resetForm();
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    resetForm();
    setEditingId(null);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta salida?')) {
      onSalidasChange(salidas.filter((s) => s.id !== id));
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'A confirmar';
    const date = new Date(dateString + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return 'A confirmar';
    return date.toLocaleDateString('es-AR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Ordenar salidas por fecha
  const sortedSalidas = [...salidas].sort((a, b) => {
    const aTime = a.fecha ? new Date(a.fecha).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.fecha ? new Date(b.fecha).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });

  return (
    <div className="space-y-4">
      {/* Botón para agregar nueva salida */}
      {!isAdding && !editingId && (
        <Button
          type="button"
          onClick={() => setIsAdding(true)}
          variant="outline"
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Agregar Salida
        </Button>
      )}

      {/* Formulario de agregar/editar */}
      {(isAdding || editingId) && (
        <div className="border border-gray-300 rounded-lg p-4 space-y-4 bg-gray-50">
          <h4 className="font-semibold text-base text-gray-900">
            {editingId ? 'Editar Salida' : 'Nueva Salida'}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fecha" className="text-sm">Fecha de Ida</Label>
              <Input
                id="fecha"
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="fechaVuelta" className="text-sm">Fecha de Vuelta</Label>
              <Input
                id="fechaVuelta"
                type="date"
                value={formData.fechaVuelta}
                onChange={(e) => setFormData({ ...formData, fechaVuelta: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ciudadSalida" className="text-sm">Ciudad de Salida</Label>
              <Input
                id="ciudadSalida"
                value={formData.ciudadSalida}
                onChange={(e) => setFormData({ ...formData, ciudadSalida: e.target.value })}
                placeholder="Ej: Buenos Aires"
                className="mt-1"
              />
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="precio" className="text-sm">Precio *</Label>
              <FormattedAmountInput
                id="precio"
                value={formData.precio}
                onChange={(v) => setFormData({ ...formData, precio: v })}
                placeholder="0"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="moneda" className="text-sm">Moneda *</Label>
              <Select
                value={formData.moneda}
                onValueChange={(value: 'USD' | 'ARS' | 'EUR') => setFormData({ ...formData, moneda: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS (Pesos Argentinos)</SelectItem>
                  <SelectItem value="USD">USD (Dólares)</SelectItem>
                  <SelectItem value="EUR">EUR (Euros)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cupo" className="text-sm">Cupo (Opcional)</Label>
              <Input
                id="cupo"
                type="number"
                value={formData.cupo || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({ 
                    ...formData, 
                    cupo: value && !isNaN(Number(value)) && Number(value) > 0 ? Number(value) : undefined 
                  });
                }}
                placeholder="Ej: 20"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observaciones" className="text-sm">Observaciones (Opcional)</Label>
            <Textarea
              id="observaciones"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Ej: Incluye vuelos desde Córdoba"
              rows={2}
              className="mt-1"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
            >
              <X className="mr-1 h-4 w-4" />
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={editingId ? handleSaveEdit : handleAdd}
              className="bg-gray-900 hover:bg-gray-800 text-white"
            >
              <Check className="mr-1 h-4 w-4" />
              {editingId ? 'Guardar' : 'Agregar'}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de salidas */}
      {sortedSalidas.length > 0 ? (
        <div className="space-y-2">
          <p className="text-base font-medium text-gray-700">
            Salidas programadas ({sortedSalidas.length})
          </p>
          {sortedSalidas.map((salida) => (
            <div
              key={salida.id}
              className="border border-gray-200 rounded-lg p-3 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-gray-900">
                      {formatDate(salida.fecha)}
                      {salida.fechaVuelta && (
                        <span className="text-gray-600 font-normal"> → {formatDate(salida.fechaVuelta)}</span>
                      )}
                    </span>
                    {salida.ciudadSalida && (
                      <span className="text-base text-gray-600">
                        desde {salida.ciudadSalida}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 text-base">
                    <span className="font-bold text-green-700">
                      {salida.moneda} ${salida.precio.toLocaleString('es-AR')}
                    </span>
                    {salida.cupo && (
                      <span className="text-gray-600">
                        Cupo: {salida.cupo} personas
                      </span>
                    )}
                  </div>

                  {salida.observaciones && (
                    <p className="text-sm text-gray-600 mt-2">
                      {salida.observaciones}
                    </p>
                  )}
                </div>

                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(salida)}
                    disabled={isAdding || editingId !== null}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(salida.id)}
                    disabled={isAdding || editingId !== null}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg bg-gray-50">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-2" />
          <p className="text-base text-gray-600">No hay salidas programadas</p>
          <p className="text-sm text-gray-500 mt-1">
            Agrega salidas si el paquete las necesita
          </p>
        </div>
      )}
    </div>
  );
}
