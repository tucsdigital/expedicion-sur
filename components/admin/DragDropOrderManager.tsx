'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy as firestoreOrderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  GripVertical, 
  Loader2,
  Save,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';

interface OrderItem {
  id: string;
  nombre?: string;
  titulo?: string;
  orden: number;
  activa?: boolean;
  visible?: boolean;
  destacada?: boolean;
  destacado?: boolean;
}

interface DragDropOrderManagerProps {
  collectionName: 'categorias' | 'paquetes' | string;
  currentId?: string;
  onOrdersChange?: (items: { id: string; orden: number }[]) => void;
  onPositionChange?: (position: number) => void; // ⭐ NUEVO: Callback para posición elegida
  newItemName?: string; // ⭐ NUEVO: Nombre del elemento que se está creando
  maxItems?: number;
  onlyDestacados?: boolean;
  hideSaveButton?: boolean; // ⭐ NUEVO: Si true, oculta botón de guardar (para creación)
}

// Componente de item arrastrable
function SortableItem({ 
  item, 
  isEditing, 
  isNew,
  index 
}: { 
  item: OrderItem; 
  isEditing: boolean;
  isNew: boolean;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const nombre = item.nombre || item.titulo || 'Sin nombre';
  const isDestacado = item.destacada || item.destacado;
  const isInactivo = item.activa === false || item.visible === false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-4 rounded-lg border-2 transition-all
        ${isNew
          ? 'bg-gradient-to-r from-[#ff843a] to-[#ffa366] text-white border-[#ff843a] shadow-xl'
          : isEditing 
          ? 'bg-black text-white border-black shadow-lg' 
          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
        }
        ${isDragging ? 'cursor-grabbing z-50' : 'cursor-grab'}
      `}
      {...attributes}
      {...listeners}
    >
      {/* Handle para drag */}
      <div className={`flex-shrink-0 ${isNew || isEditing ? 'text-white' : 'text-gray-400'}`}>
        <GripVertical className="h-5 w-5" />
      </div>

      {/* Número de orden */}
      <div className={`
        flex items-center justify-center w-10 h-10 rounded-full font-bold text-base
        ${isNew || isEditing ? 'bg-white text-black' : 'bg-gray-100 text-gray-700'}
      `}>
        {index + 1}
      </div>

      {/* Info del elemento */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isNew || isEditing ? 'text-white' : 'text-gray-900'}`}>
          {isNew && <span className="mr-2">✨</span>}
          {nombre}
          {isNew && <span className="ml-2 text-base opacity-90">(nuevo - en creación)</span>}
          {isEditing && !isNew && <span className="ml-2 text-base opacity-75">(editando)</span>}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {isDestacado && (
            <Badge className={`text-sm font-semibold ${
              isNew || isEditing 
                ? 'bg-white text-black hover:bg-white' 
                : 'bg-black text-white hover:bg-black'
            }`}>
              Destacado
            </Badge>
          )}
          {isInactivo && (
            <Badge variant="secondary" className="text-sm font-medium">
              Inactivo
            </Badge>
          )}
        </div>
      </div>

      {/* Indicador visual */}
      <div className={`h-1 w-1 rounded-full ${isNew || isEditing ? 'bg-white' : 'bg-gray-300'}`} />
    </div>
  );
}

export default function DragDropOrderManager({
  collectionName,
  currentId,
  onOrdersChange,
  onPositionChange,
  newItemName,
  maxItems,
  onlyDestacados = false,
  hideSaveButton = false
}: DragDropOrderManagerProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [originalItems, setOriginalItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Determinar si es un elemento nuevo
  const isNewItem = !currentId && newItemName;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px de movimiento antes de activar drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const q = query(collection(db, collectionName), firestoreOrderBy('orden', 'asc'));
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as OrderItem));
      
      // Filtrar solo destacados si se indica
      if (onlyDestacados) {
        data = data.filter(item => item.destacado === true || item.destacada === true);
      }
      
      // ⭐ Agregar elemento nuevo si existe
      if (isNewItem && newItemName) {
        const newItem: OrderItem = {
          id: 'nuevo-temp',
          nombre: collectionName === 'categorias' ? newItemName : undefined,
          titulo: collectionName === 'paquetes' || collectionName === 'paquetes_f1' || collectionName === 'blog' ? newItemName : undefined,
          orden: data.length > 0 ? Math.max(...data.map(item => item.orden)) + 1 : 1,
        };
        data.push(newItem);
        
        // Notificar posición inicial (al final)
        if (onPositionChange) {
          onPositionChange(data.length);
        }
      }
      
      setItems(data);
      setOriginalItems(data);
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Error al cargar elementos');
    } finally {
      setLoading(false);
    }
  }, [collectionName, onlyDestacados, isNewItem, newItemName, onPositionChange]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ⭐ Actualizar el nombre del elemento nuevo si cambia
  useEffect(() => {
    if (isNewItem && newItemName) {
      setItems((currentItems) => {
        const newItemIndex = currentItems.findIndex(item => item.id === 'nuevo-temp');
        if (newItemIndex !== -1) {
          const currentName = currentItems[newItemIndex].nombre || currentItems[newItemIndex].titulo;
          if (currentName !== newItemName) {
            const updatedItems = [...currentItems];
            updatedItems[newItemIndex] = {
              ...updatedItems[newItemIndex],
              nombre: collectionName === 'categorias' ? newItemName : updatedItems[newItemIndex].nombre,
              titulo: collectionName === 'paquetes' || collectionName === 'paquetes_f1' || collectionName === 'blog' ? newItemName : updatedItems[newItemIndex].titulo,
            };
            return updatedItems;
          }
        }
        return currentItems;
      });
    }
  }, [newItemName, isNewItem, collectionName]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        const reordered = arrayMove(items, oldIndex, newIndex);
        setHasChanges(true);
        
        // ⭐ Notificar la nueva posición si es un elemento nuevo
        if (isNewItem && onPositionChange && active.id === 'nuevo-temp') {
          setTimeout(() => {
            onPositionChange(newIndex + 1); // +1 porque el orden empieza en 1
          }, 0);
        }
        
        return reordered;
      });
    }
  };

  const handleSave = async () => {
    // Verificar si realmente hay cambios
    if (!hasChanges) {
      toast.info('No hay cambios para guardar', {
        description: 'El orden ya está actualizado',
      });
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      // Actualizar orden de todos los elementos (empezando desde 1)
      items.forEach((item, index) => {
        const itemRef = doc(db, collectionName, item.id);
        batch.update(itemRef, { orden: index + 1 });
      });

      await batch.commit();
      
      toast.success('Orden guardado correctamente', {
        description: `${items.length} elementos reordenados`,
      });
      
      setOriginalItems(items);
      setHasChanges(false);
      
      // Notificar cambios al padre si existe callback
      if (onOrdersChange) {
        onOrdersChange(items.map((item, index) => ({ 
          id: item.id, 
          orden: index + 1 
        })));
      }
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Error al guardar orden');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setItems(originalItems);
    setHasChanges(false);
    toast.info('Orden restaurado');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Orden de visualización
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {onlyDestacados ? 'Orden de Destacados' : 'Orden de visualización'}
            </CardTitle>
            <p className="text-base text-gray-500 mt-1.5">
              {onlyDestacados 
                ? 'Arrastra para ordenar los paquetes destacados en la homepage' 
                : 'Arrastra los elementos para cambiar su orden de aparición'
              }
            </p>
          </div>
          {maxItems && (
            <Badge variant="outline" className="text-sm">
              Máximo {maxItems} destacados
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista Drag & Drop */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-base font-medium text-gray-700">
              {items.length} {onlyDestacados ? (items.length === 1 ? 'destacado' : 'destacados') : (items.length === 1 ? 'elemento' : 'elementos')}
            </p>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  Cambios sin guardar
                </Badge>
              </motion.div>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 max-h-[500px] overflow-y-auto p-1 custom-scrollbar">
                <AnimatePresence>
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                    >
                      <SortableItem
                        item={item}
                        isEditing={item.id === currentId}
                        isNew={item.id === 'nuevo-temp'}
                        index={index}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Botones de Acción - Solo mostrar si no está oculto y hay cambios */}
        {!hideSaveButton && (
          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2 pt-4 border-t"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving}
                  className="flex-1"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Deshacer cambios
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-black hover:bg-gray-800 text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar orden
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  );
}

