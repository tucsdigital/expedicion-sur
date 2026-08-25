'use client';

import { useState, useCallback } from 'react';
import { X, Upload, Image as ImageIcon, Move } from 'lucide-react';
import Image from 'next/image';

interface ImageUploaderProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  label?: string;
  description?: string;
}

export default function ImageUploader({
  images,
  onImagesChange,
  maxImages = 10,
  label = 'Imágenes',
  description = 'Arrastra imágenes o haz clic para seleccionar',
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    const remainingSlots = maxImages - images.length;
    const filesToAdd = files.slice(0, remainingSlots);

    // Convertir todos los archivos a base64 usando Promise.all
    const imagePromises = filesToAdd.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    // Esperar a que todas las imágenes se carguen
    const newImages = await Promise.all(imagePromises);
    
    // Actualizar el estado una sola vez con todas las imágenes
    onImagesChange([...images, ...newImages]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    );

    handleFiles(files);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleDropReorder = (dropIndex: number) => {
    if (draggedIndex === null) return;

    const newImages = [...images];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedImage);

    onImagesChange(newImages);
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-base font-medium mb-2">{label}</label>
        <p className="text-base text-gray-500 mb-4">{description}</p>
      </div>

      {/* Drop Zone */}
      {images.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
            isDragging
              ? 'border-gray-900 bg-gray-50'
              : 'border-gray-300 bg-gray-50/50 hover:border-gray-400'
          }`}
        >
          <input
            type="file"
            id="image-upload"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="text-center pointer-events-none">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-base font-medium text-gray-700 mb-1">
              Arrastra imágenes aquí o haz clic para seleccionar
            </p>
            <p className="text-sm text-gray-500">
              PNG, JPG hasta 10MB • {images.length}/{maxImages} imágenes
            </p>
          </div>
        </div>
      )}

      {/* Grid de Imágenes */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={index}
              draggable={maxImages > 1}
              onDragStart={() => maxImages > 1 && handleDragStart(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (maxImages > 1) handleDropReorder(index);
              }}
              className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                maxImages > 1 ? 'cursor-move' : ''
              } ${
                draggedIndex === index
                  ? 'opacity-50 border-gray-900 scale-95'
                  : 'border-gray-200 hover:border-gray-400 hover:shadow-lg'
              }`}
            >
              <Image
                src={image}
                alt={maxImages === 1 ? 'Imagen de portada' : `Imagen ${index + 1}`}
                fill
                className="object-cover"
              />

              {/* Overlay con acciones */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                    title="Eliminar imagen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {maxImages > 1 && (
                  <div className="flex items-center gap-1 text-white text-sm">
                    <Move className="h-3 w-3" />
                    <span>Arrastra para ordenar</span>
                  </div>
                )}
              </div>

              {/* Número de orden - solo si hay más de 1 imagen */}
              {maxImages > 1 && (
                <div className="absolute top-2 left-2 bg-black/80 text-white text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {index + 1}
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {/* Indicador de imágenes */}
      {images.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 text-base text-gray-700">
            <ImageIcon className="h-4 w-4" />
            <span className="font-medium">{images.length} imagen{images.length !== 1 ? 'es' : ''} seleccionada{images.length !== 1 ? 's' : ''}</span>
          </div>
          {images.length === maxImages && (
            <span className="text-sm text-gray-500">Límite alcanzado</span>
          )}
        </div>
      )}
    </div>
  );
}

