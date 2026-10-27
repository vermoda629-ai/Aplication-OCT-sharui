/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Crop, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Check, 
  X, 
  Sparkles,
  Move,
  Maximize2
} from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
  initialAspectRatio?: number; // default 1 (1:1 square)
}

export default function ImageCropModal({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  initialAspectRatio = 1
}: ImageCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // in degrees: 0, 90, 180, 270
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: 440, height: 330 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Measure container when modal opens or resizes
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    }
  }, [isOpen, imageLoaded]);

  // Reset controls when modal opens with a new image
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setImageLoaded(false);
    }
  }, [isOpen, imageSrc]);

  // Handle Drag / Pan (Mouse and Touch)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Calculate base scale so image completely fills the 4:3 box without any white margin filling
  const boxW = containerSize.width || 440;
  const boxH = containerSize.height || 330;
  const nw = naturalDimensions.width || 800;
  const nh = naturalDimensions.height || 600;

  // If rotation is 90 or 270 deg, effective natural aspect ratio is flipped
  const isRotatedPerpendicular = rotation % 180 !== 0;
  const effectiveW = isRotatedPerpendicular ? nh : nw;
  const effectiveH = isRotatedPerpendicular ? nw : nh;
  const baseScale = Math.max(boxW / effectiveW, boxH / effectiveH);

  const displayW = nw * baseScale;
  const displayH = nh * baseScale;

  // Perform Final Crop on Canvas with exact 1:1 square pixel-perfect mapping (800 x 800)
  const handleConfirmCrop = useCallback(() => {
    if (!imageRef.current) return;
    const img = imageRef.current;

    // Output canvas size: strict 1:1 square aspect ratio (800 x 800 px)
    const outputWidth = 800;
    const outputHeight = 800;

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale ratio between on-screen preview box and high-res canvas
    const scaleFactor = outputWidth / boxW;

    ctx.save();
    // Translate to center of canvas + scaled pan offset
    ctx.translate(outputWidth / 2 + pan.x * scaleFactor, outputHeight / 2 + pan.y * scaleFactor);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    const canvasRenderW = displayW * scaleFactor;
    const canvasRenderH = displayH * scaleFactor;
    ctx.drawImage(img, -canvasRenderW / 2, -canvasRenderH / 2, canvasRenderW, canvasRenderH);
    ctx.restore();

    // Export optimized high-quality JPEG without blank margins
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onCropComplete(croppedDataUrl);
    onClose();
  }, [boxW, pan, rotation, zoom, displayW, displayH, onCropComplete, onClose]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-slate-900 border border-white/10 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl relative my-auto flex flex-col max-h-[95vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                Encuadrar y Recortar Foto
              </h3>
              <p className="text-[10px] text-brand-text-dim">
                Arrastra la imagen y usa el zoom para enfocar el calzado con precisión (Formato 1:1 Cuadrado)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-brand-text-dim hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Badge: 1:1 square standard */}
        <div className="flex items-center justify-between gap-2 pt-3 pb-2">
          <span className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider">
            Encuadre Multimedia:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase bg-blue-600 text-white shadow-md flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              1:1 Cuadrado (Estándar Oficial)
            </span>
          </div>
        </div>

        {/* Viewport / Crop Box: Strict 1:1 Square */}
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={(e) => {
            e.preventDefault();
            setZoom(prev => Math.min(3.5, Math.max(1, +(prev - e.deltaY * 0.0015).toFixed(2))));
          }}
          className="relative w-full max-w-[340px] aspect-square max-h-[340px] bg-slate-950 rounded-2xl overflow-hidden border-2 border-blue-500/50 select-none cursor-grab active:cursor-grabbing flex items-center justify-center shadow-inner my-2 mx-auto"
        >
          {/* Rule of thirds grid lines */}
          <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-10 opacity-30">
            <div className="border-r border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-b border-white" />
            <div className="border-r border-white" />
            <div className="border-r border-white" />
            <div />
          </div>

          {/* Hint Overlay */}
          <div className="absolute top-2 left-2 z-20 pointer-events-none bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] text-white/90 font-bold flex items-center gap-1.5 border border-white/10">
            <Move className="w-3 h-3 text-emerald-400" />
            <span>Arrastra para encuadrar</span>
          </div>

          {/* Image Being Transformed with Exact Proportions matching Canvas Output */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Preview"
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth && el.naturalHeight) {
                setNaturalDimensions({ width: el.naturalWidth, height: el.naturalHeight });
              }
              setImageLoaded(true);
            }}
            style={{
              width: `${displayW}px`,
              height: `${displayH}px`,
              maxWidth: 'none',
              maxHeight: 'none',
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            className="pointer-events-none select-none shrink-0"
          />
        </div>

        {/* Toolbar: Zoom Slider, Rotate, Reset */}
        <div className="space-y-3 pt-2">
          {/* Zoom Control */}
          <div className="flex items-center gap-3 bg-slate-950/60 p-2.5 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => setZoom(prev => Math.max(1, prev - 0.15))}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />

            <button
              type="button"
              onClick={() => setZoom(prev => Math.min(3, prev + 0.15))}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono font-bold text-emerald-400 w-12 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Rotate & Reset Buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-white/5 cursor-pointer transition-all"
                title="Girar 90 grados"
              >
                <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                <span>Girar 90°</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-white/5 cursor-pointer transition-all"
                title="Restablecer posición y zoom"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Restablecer</span>
              </button>
            </div>

            <div className="text-[10px] text-brand-text-dim font-bold">
              Rotación: {rotation}°
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-2.5 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmCrop}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Recorte</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
