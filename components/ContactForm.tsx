'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { collection, addDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, firebaseEnabled, getAuthInstance } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import type { Cliente } from '@/types';

const formSchema = z.object({
  servicio: z.enum(['paquete', 'destino', 'asistencia', 'otro'], {
    required_error: 'Seleccioná un servicio',
  }),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  whatsapp: z.string().min(8, 'WhatsApp inválido'),
  fechas: z.string().optional(),
  cantidadPersonas: z.coerce.number().min(1).max(10),
  mensaje: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ContactFormProps {
  paqueteTitulo?: string;
  paqueteId?: string;
}

export default function ContactForm({ paqueteTitulo, paqueteId }: ContactFormProps = {}) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      servicio: 'paquete',
      cantidadPersonas: 1,
    },
  });

  useEffect(() => {
    if (!firebaseEnabled) return;
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const setIfEmpty = (field: keyof FormData, value?: string) => {
        const current = getValues(field);
        if (!current && value) {
          setValue(field, value);
        }
      };

      setIfEmpty('nombre', user.displayName || '');

      try {
        const ref = doc(db, 'clientes', user.uid);
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) return;
        const cliente = snapshot.data() as Cliente;
        const fullName =
          cliente.nombreCompleto ||
          [cliente.nombre, cliente.apellido].filter(Boolean).join(' ').trim();

        setIfEmpty('nombre', fullName);
        setIfEmpty('whatsapp', cliente.telefono);
      } catch (error) {
        console.error('Error loading cliente profile:', error);
      }
    });

    return () => unsubscribe();
  }, [getValues, setValue]);

  const onSubmit = async (data: FormData) => {
    if (!firebaseEnabled) {
      toast.error('Formulario deshabilitado', {
        description: 'Falta configurar Firebase en .env.local',
      });
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'consultas'), {
        ...data,
        ...(paqueteTitulo && { paquete: paqueteTitulo }),
        ...(paqueteId && { paqueteId }),
        fechaCreacion: Timestamp.now(),
        leida: false,
      });

      toast.success('¡Consulta enviada!', {
        description: 'Te contactaremos a la brevedad.',
      });

      reset();
    } catch (error) {
      console.error('Error al enviar consulta:', error);
      toast.error('Error al enviar la consulta', {
        description: 'Por favor, intenta nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-5">
      <div className="space-y-4 md:space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-900">¿Qué querés cotizar?</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'paquete', label: 'Excursión' },
              { value: 'destino', label: 'Destino' },
              { value: 'asistencia', label: 'Asistencia' },
              { value: 'otro', label: 'Otro' },
            ].map((item) => {
              const active = watch('servicio') === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setValue('servicio', item.value as FormData['servicio'], { shouldValidate: true })}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-success text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {errors.servicio && <p className="text-xs text-red-600">{errors.servicio.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3 md:gap-4">
          <div className="space-y-1">
            <Label htmlFor="nombre" className="text-xs font-medium text-gray-900">
              Nombre
            </Label>
            <Input
              id="nombre"
              {...register('nombre')}
              placeholder="Tu nombre completo"
              className="h-8 w-full rounded-xl border-gray-200 bg-gray-50/70 text-xs focus:border-primary focus:ring-primary/30"
            />
            {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="whatsapp" className="text-xs font-medium text-gray-900">
              WhatsApp
            </Label>
            <Input
              id="whatsapp"
              {...register('whatsapp')}
              placeholder="+54 9 11 1234-5678"
              className="h-8 w-full rounded-xl border-gray-200 bg-gray-50/70 text-xs focus:border-primary focus:ring-primary/30"
            />
            {errors.whatsapp && <p className="text-xs text-red-600 mt-1">{errors.whatsapp.message}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="fechas" className="text-xs font-medium text-gray-900">
              Fechas tentativas
            </Label>
            <Input
              id="fechas"
              {...register('fechas')}
              placeholder="Ej: mayo 2026 o 10/6 al 20/6"
              className="h-8 w-full rounded-xl border-gray-200 bg-gray-50/70 text-xs focus:border-primary focus:ring-primary/30"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="cantidadPersonas" className="text-xs font-medium text-gray-900">
              Cantidad de personas
            </Label>
            <Controller
              name="cantidadPersonas"
              control={control}
              render={({ field }) => (
                <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                  <SelectTrigger
                    id="cantidadPersonas"
                    className="h-8 w-full rounded-xl border-gray-200 bg-gray-50/70 text-xs focus:border-primary focus:ring-primary/30"
                  >
                    <SelectValue placeholder="Cantidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }).map((_, index) => {
                      const value = index + 1;
                      return (
                        <SelectItem key={value} value={String(value)}>
                          {value}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.cantidadPersonas && (
              <p className="text-xs text-red-600 mt-1">Seleccioná una cantidad válida</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="mensaje" className="text-xs font-medium text-gray-900">
            Mensaje (opcional)
          </Label>
          <Textarea
            id="mensaje"
            {...register('mensaje')}
            placeholder="Ej: destino, presupuesto aproximado y si ya tienen fechas definidas."
            rows={5}
            className="w-full rounded-xl border-gray-200 bg-gray-50/70 focus:border-primary focus:ring-primary/30 resize-none text-xs py-2.5"
          />
        </div>

        <Button
          type="submit"
          variant="success"
          className="h-11 w-full rounded-xl text-sm font-semibold shadow-lg transition-all hover:shadow-xl"
          disabled={loading || !firebaseEnabled}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            'Quiero que me contacten'
          )}
        </Button>
      </div>
    </form>
  );
}
