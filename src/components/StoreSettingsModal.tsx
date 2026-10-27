/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Settings, 
  Store, 
  Phone, 
  Image as ImageIcon, 
  Sparkles, 
  MapPin, 
  CheckCircle2, 
  Upload, 
  Trash2 
} from 'lucide-react';
import { StoreSettings } from '../types';
import { StorageService } from '../lib/storage';
import { compressImage } from '../lib/indexedDb';
import confetti from 'canvas-confetti';

interface StoreSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSettingsUpdated: (newSettings: StoreSettings) => void;
}

export default function StoreSettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsUpdated
}: StoreSettingsModalProps) {
  const [storeName, setStoreName] = useState(settings.storeName || 'SHARUI Calzados');
  const [phone, setPhone] = useState(settings.phone || '77234567');
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp || '77234567');
  const [logo, setLogo] = useState(settings.logo || '');
  const [slogan, setSlogan] = useState(settings.slogan || 'Exclusividad, Calidad y Estilo en Cada Paso');
  const [address, setAddress] = useState(settings.address || 'Av. Heroínas #340, Galería Comercial');
  const [city, setCity] = useState(settings.city || 'Cochabamba');

  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressImage(file).then((compressed) => {
        setLogo(compressed);
      }).catch(err => {
        console.error("Error compressing logo image:", err);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updated: StoreSettings = {
        storeName: storeName.trim() || 'SHARUI Calzados',
        phone: phone.trim() || '77234567',
        whatsapp: whatsapp.trim() || phone.trim() || '77234567',
        logo: logo.trim(),
        slogan: slogan.trim() || 'Exclusividad, Calidad y Estilo en Cada Paso',
        address: address.trim() || 'Av. Heroínas #340, Galería Comercial',
        city: city.trim() || 'Cochabamba',
      };

      await StorageService.saveStoreSettings(updated);
      onSettingsUpdated(updated);

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });

      onClose();
    } catch (err) {
      console.error("Error saving store settings:", err);
      alert("Hubo un detalle al guardar las opciones de la tienda.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-900 border border-white/10 rounded-3xl max-w-xl w-full p-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Opciones y Datos de la Tienda
              </h3>
              <p className="text-xs text-brand-text-dim mt-0.5">
                Configura los datos del servidor comercial para el encabezado y notas de venta
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {/* Logo Section */}
          <div className="p-4 bg-slate-800/50 rounded-2xl border border-white/5 space-y-3">
            <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest block">
              Logo de la Tienda (Para notas de venta y encabezados)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                {logo ? (
                  <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-7 h-7 text-slate-600" />
                )}
              </div>

              <div className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{logo ? 'Cambiar Logo' : 'Cargar Logo'}</span>
                </button>

                {logo && (
                  <button
                    type="button"
                    onClick={() => setLogo('')}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer"
                    title="Quitar logo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Nombre de la Tienda */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
              Nombre de la Tienda / Negocio *
            </label>
            <div className="relative">
              <Store className="w-4 h-4 text-brand-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ej. SHARUI Calzados Exclusivos"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Teléfono / WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                Número Telefónico *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-brand-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (!whatsapp || whatsapp === phone) setWhatsapp(e.target.value);
                  }}
                  placeholder="Ej. 77234567"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                WhatsApp Oficial *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="Ej. 77234567"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Eslogan */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
              Eslogan Comercial *
            </label>
            <div className="relative">
              <Sparkles className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Ej. Exclusividad, Calidad y Estilo en Cada Paso"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Dirección y Ciudad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                Dirección del Local / Galería *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-red-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ej. Av. Heroínas #340, Cochabamba"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                Ciudad Base *
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Cochabamba"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Opciones'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
