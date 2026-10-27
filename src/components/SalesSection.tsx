/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  Plus, 
  Clock, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Search, 
  Filter, 
  Phone, 
  MapPin, 
  Truck, 
  FileText, 
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Sale, Product, Invoice } from '../types';
import { StorageService } from '../lib/storage';
import { cn, formatCurrency, formatDate, getLocalDateString, getLocalTimeString, getSaleChronologicalTimestamp } from '../lib/utils';
import InvoiceModal from './InvoiceModal';

interface SalesSectionProps {
  sales: Sale[];
  setSales: (sales: Sale[]) => void;
  products: Product[];
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
}

const LOGISTICS_OPTIONS = [
  'Envío a domicilio',
  'Entrega en punto estratégico',
  'Envío interdepartamental',
  'Recojo en tienda'
] as const;

export default function SalesSection({ 
  sales, 
  setSales, 
  products, 
  invoices, 
  setInvoices 
}: SalesSectionProps) {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODAS' | 'Compra' | 'Reserva'>('TODAS');

  // Form Fields
  const [date, setDate] = useState(getLocalDateString());
  const [status, setStatus] = useState<'Compra' | 'Reserva'>('Compra');
  const [productCode, setProductCode] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [price, setPrice] = useState('');
  const [clientName, setClientName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');
  const [logistics, setLogistics] = useState<Sale['logistics']>('Envío a domicilio');
  const [notes, setNotes] = useState('');

  // Auto detect product details and available sizes
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [availableSizes, setAvailableSizes] = useState<string[]>([]);
  const [reservedSizes, setReservedSizes] = useState<string[]>([]);

  useEffect(() => {
    const cleanInput = productCode.trim().toLowerCase();
    const found = products.find(p => 
      p.code.toLowerCase() === cleanInput ||
      p.variants?.some(v => v.fullCode.toLowerCase() === cleanInput || v.subCode.toLowerCase() === cleanInput)
    );

    if (found) {
      // Pick variant image and sizes if matching full code or sub code
      const matchingVariant = found.variants?.find(v => 
        v.fullCode.toLowerCase() === cleanInput || v.subCode.toLowerCase() === cleanInput
      );

      const targetSizes = matchingVariant?.sizes || found.sizes;
      const displayProduct: Product = {
        ...found,
        image: matchingVariant?.image || found.image,
        sizes: targetSizes
      };
      setPreviewProduct(displayProduct);

      // Pre-fill price if product has a standard salePrice and price field is empty
      if (found.salePrice && !price && !editingSale) {
        setPrice(found.salePrice.toString());
      }

      // Filter sold vs reserved sizes
      const otherSales = sales.filter(s => 
        (s.productCode.toLowerCase() === found.code.toLowerCase() ||
         s.productCode.toLowerCase() === cleanInput) && 
        s.id !== editingSale?.id
      );

      const soldSizes = otherSales
        .filter(s => s.status === 'Compra')
        .map(s => s.selectedSize);

      const resSizes = otherSales
        .filter(s => s.status === 'Reserva')
        .map(s => s.selectedSize);

      const remainingPool = [...targetSizes];
      soldSizes.forEach(s => {
        const idx = remainingPool.indexOf(s);
        if (idx > -1) remainingPool.splice(idx, 1);
      });

      const freeSizes: string[] = [];
      const holdSizes: string[] = [];

      remainingPool.forEach(sz => {
        if (resSizes.includes(sz)) {
          holdSizes.push(sz);
        } else {
          freeSizes.push(sz);
        }
      });

      setAvailableSizes(freeSizes);
      setReservedSizes(holdSizes);

      if (freeSizes.length > 0 && (!selectedSize || !freeSizes.includes(selectedSize))) {
        setSelectedSize(freeSizes[0]);
      }
    } else {
      setPreviewProduct(null);
      setAvailableSizes([]);
      setReservedSizes([]);
      if (!editingSale) setSelectedSize('');
    }
  }, [productCode, products, sales, editingSale]);

  const resetForm = () => {
    setEditingSale(null);
    setProductCode('');
    setSelectedSize('');
    setPrice('');
    setClientName('');
    setWhatsapp('');
    setCity('');
    setNotes('');
    setIsFormVisible(false);
  };

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setDate(sale.date);
    setStatus(sale.status);
    setProductCode(sale.productCode);
    setSelectedSize(sale.selectedSize);
    setPrice(sale.price.toString());
    setClientName(sale.clientName);
    setWhatsapp(sale.whatsapp);
    setCity(sale.city);
    setLogistics(sale.logistics);
    setNotes(sale.notes || '');
    setIsFormVisible(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmReservation = async (sale: Sale) => {
    if (confirm(`¿Confirmar venta final para ${sale.clientName}? La reserva pasará al estado COMPRA DEFINITIVA.`)) {
      const updated: Sale = { ...sale, status: 'Compra' };
      await StorageService.saveSale(updated);
      setSales(StorageService.getSales());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSize) {
      alert('Debe seleccionar una talla válida para registrar la operación.');
      return;
    }

    if (reservedSizes.includes(selectedSize) && (!editingSale || editingSale.selectedSize !== selectedSize)) {
      alert(`La talla ${selectedSize} se encuentra RESERVADA y bloqueada para cualquier otro movimiento hasta que se libere.`);
      return;
    }

    const newSale: Sale = {
      id: editingSale ? editingSale.id : crypto.randomUUID(),
      date,
      time: editingSale?.time || new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false }),
      dateTimeString: editingSale?.dateTimeString || `${date} ${new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
      status,
      productCode: productCode.trim().toUpperCase(),
      selectedSize: String(selectedSize),
      price: parseFloat(price) || 0,
      paymentMethod: editingSale?.paymentMethod || 'Efectivo',
      clientName: clientName.trim(),
      whatsapp: whatsapp.trim().replace(/\D/g, ''),
      city: city.trim(),
      logistics,
      notes: notes.trim(),
      createdAt: editingSale ? editingSale.createdAt : Date.now(),
    };

    await StorageService.saveSale(newSale);
    setSales(StorageService.getSales());
    resetForm();
  };

  const deleteSale = async (id: string) => {
    await StorageService.deleteSale(id);
    setSales(StorageService.getSales());
    setSaleToDelete(null);
  };

  // Quick Generate Invoice from Sale
  const handleGenerateInvoiceFromSale = async (sale: Sale) => {
    const existing = invoices.find(inv => inv.saleId === sale.id);
    if (existing) {
      setSelectedInvoiceForModal(existing);
      return;
    }

    const product = products.find(p => p.code.toLowerCase() === sale.productCode.toLowerCase());
    const count = invoices.length + 1;
    const currentYear = new Date().getFullYear();
    const invoiceNumber = `FAC-${currentYear}-${String(count).padStart(3, '0')}`;

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      invoiceNumber,
      date: sale.date,
      saleId: sale.id,
      clientName: sale.clientName,
      clientPhone: sale.whatsapp,
      clientCity: sale.city,
      items: [
        {
          id: crypto.randomUUID(),
          description: product ? `${product.name} (${sale.productCode})` : `Calzado Ref. ${sale.productCode}`,
          size: sale.selectedSize,
          quantity: 1,
          unitPrice: sale.price,
          total: sale.price
        }
      ],
      subtotal: sale.price,
      discount: 0,
      tax: 0,
      total: sale.price,
      status: sale.status === 'Compra' ? 'Pagada' : 'Emitida',
      paymentMethod: 'Transferencia QR',
      notes: `Venta registrada por despacho: ${sale.logistics}.`,
      terms: 'Comprobante válido para garantía de 30 días.',
      createdAt: Date.now(),
    };

    await StorageService.saveInvoice(newInvoice);
    setInvoices(StorageService.getInvoices());

    // Update sale with invoice reference
    const updatedSale = { ...sale, invoiceId: newInvoice.invoiceNumber };
    await StorageService.saveSale(updatedSale);
    setSales(StorageService.getSales());

    setSelectedInvoiceForModal(newInvoice);
  };

  // Filtered sales list
  const filteredSales = sales.filter(s => {
    const matchesSearch = 
      s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.whatsapp.includes(searchTerm) ||
      s.city.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'TODAS' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedSales = [...filteredSales].sort((a, b) => {
    const timeA = getSaleChronologicalTimestamp(a);
    const timeB = getSaleChronologicalTimestamp(b);
    if (timeB !== timeA) return timeB - timeA;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });


  return (
    <div className="space-y-8 pb-20">
      {/* Header and Add Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            Gestión de Ventas & Reservas
          </h2>
          <p className="text-xs text-brand-text-dim mt-1">
            Registro de pedidos con deducción de stock en tiempo real y enlace directo a WhatsApp
          </p>
        </div>

        <button 
          onClick={() => isFormVisible ? resetForm() : setIsFormVisible(true)}
          className={cn(
            "px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg",
            isFormVisible 
              ? "bg-white/10 text-white border border-white/10" 
              : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
          )}
        >
          {isFormVisible ? <Plus className="w-4 h-4 rotate-45" /> : <Plus className="w-4 h-4" />}
          {isFormVisible ? 'Cerrar Panel' : 'Registrar Venta / Reserva'}
        </button>
      </div>

      {/* Sale Form Section */}
      <AnimatePresence>
        {isFormVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-brand-card rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl relative">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500 rounded-l-3xl"></div>

              {/* Floating Product Preview Thumbnail */}
              <AnimatePresence>
                {previewProduct && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, x: 20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 20 }}
                    className="absolute -top-3 right-3 sm:top-6 sm:right-6 z-20 pointer-events-none"
                  >
                    <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-amber-500 shadow-2xl bg-slate-900 relative">
                      <img src={previewProduct.image} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5 text-center">
                        <p className="text-[8px] font-black text-white uppercase truncate">{previewProduct.name}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  {editingSale ? 'Editar Transacción Comercial' : 'Registrar Nueva Transacción'}
                </h3>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">Fecha de Venta *</label>
                  <input 
                    type="date" 
                    required 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)} 
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 outline-none font-bold text-xs text-white" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                    Código de Calzado / Producto *
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={productCode} 
                    onChange={(e) => setProductCode(e.target.value)} 
                    placeholder="Ej. SH-URBAN-01"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 font-bold text-xs text-white uppercase outline-none focus:border-amber-500" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                    Talla a Despachar *
                  </label>
                  <select 
                    value={selectedSize} 
                    onChange={(e) => setSelectedSize(e.target.value)} 
                    required 
                    disabled={!previewProduct}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="">{previewProduct ? '-- Seleccionar Talla --' : 'Ingresa el código arriba...'}</option>
                    {availableSizes.map((s, i) => (
                      <option key={`av-${i}`} value={s}>Talla {s} (DISPONIBLE EN STOCK)</option>
                    ))}
                    {reservedSizes.map((s, i) => (
                      <option key={`res-${i}`} value={s} disabled className="text-amber-500 italic">
                        Talla {s} [ACTUALMENTE EN RESERVA]
                      </option>
                    ))}
                    {editingSale && (
                      <option value={editingSale.selectedSize}>Talla {editingSale.selectedSize} (Actual en edición)</option>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">Tipo de Operación *</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value as any)} 
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="Compra">COMPRA FINAL (Descuenta stock)</option>
                    <option value="Reserva">RESERVA TEMPORAL (Bloquea talla)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">Importe Acordado (Bs.) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={price} 
                    onChange={(e) => setPrice(e.target.value)} 
                    placeholder="320.00"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 font-mono font-bold text-xs text-emerald-400 outline-none focus:border-amber-500" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">Nombre Completo del Cliente *</label>
                  <input 
                    type="text" 
                    required 
                    value={clientName} 
                    onChange={(e) => setClientName(e.target.value)} 
                    placeholder="Ej. Carlos Mendoza"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 font-bold text-xs text-white outline-none focus:border-amber-500" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">WhatsApp de Contacto *</label>
                  <input 
                    type="tel" 
                    required 
                    value={whatsapp} 
                    onChange={(e) => setWhatsapp(e.target.value)} 
                    placeholder="Ej. 77234567"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 font-bold text-xs text-white outline-none focus:border-amber-500" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">Ciudad de Entrega *</label>
                  <input 
                    type="text" 
                    required 
                    value={city} 
                    onChange={(e) => setCity(e.target.value)} 
                    placeholder="Ej. La Paz, Santa Cruz, Cochabamba..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 font-bold text-xs text-white outline-none focus:border-amber-500" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">Método Logístico *</label>
                  <select 
                    value={logistics} 
                    onChange={(e) => setLogistics(e.target.value as any)} 
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    {LOGISTICS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2 lg:col-span-3 pt-2">
                  <button 
                    type="submit" 
                    disabled={!selectedSize} 
                    className="w-full bg-amber-500 hover:bg-amber-600 py-4 rounded-xl font-black text-xs text-white uppercase tracking-[0.15em] shadow-xl shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4 inline-block mr-2" />
                    {editingSale ? 'Guardar Cambios' : 'Confirmar y Registrar Venta'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter and Search Bar */}
      <div className="bg-brand-card p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-brand-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Buscar por cliente, calzado, WhatsApp o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['TODAS', 'Compra', 'Reserva'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === st 
                  ? 'bg-amber-500 text-white shadow-md' 
                  : 'bg-white/5 text-brand-text-dim hover:text-white'
              }`}
            >
              {st === 'TODAS' ? 'Todas las Ventas' : st === 'Compra' ? 'Compras Finales' : 'Reservas Activas'}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-brand-card rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5 text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                <th className="px-5 py-4">Estado</th>
                <th className="px-5 py-4">Fecha</th>
                <th className="px-5 py-4">Calzado & Talla</th>
                <th className="px-5 py-4">Cliente & Contacto</th>
                <th className="px-5 py-4">Logística</th>
                <th className="px-5 py-4 text-right">Monto</th>
                <th className="px-5 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredSales.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-brand-text-dim italic font-medium">
                    No se encontraron transacciones registradas.
                  </td>
                </tr>
              )}
              {sortedSales.map((sale) => {
                const product = products.find(p => p.code.toLowerCase() === sale.productCode.toLowerCase());
                const cleanPhone = sale.whatsapp.replace(/\D/g, '');
                const phoneWithCode = cleanPhone.startsWith('591') ? cleanPhone : `591${cleanPhone}`;

                return (
                  <tr key={sale.id} className="hover:bg-white/[0.015] transition-colors group">
                    <td className="px-5 py-4">
                      <span className={cn(
                        "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider",
                        sale.status === 'Compra' 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      )}>
                        {sale.status}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs font-semibold text-brand-text-dim whitespace-nowrap">
                      {formatDate(sale.date)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {product?.image ? (
                          <img src={product.image} alt="" className="w-9 h-9 rounded-xl object-cover border border-white/10" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center font-black text-[9px] text-brand-accent">
                            SH
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-white font-mono uppercase">{sale.productCode}</span>
                            <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 px-1.5 py-0.2 rounded border border-blue-500/30">
                              T{sale.selectedSize}
                            </span>
                          </div>
                          {product?.name && (
                            <p className="text-[9px] text-brand-text-dim truncate max-w-[130px]">{product.name}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-xs font-bold text-white uppercase">{sale.clientName}</p>
                      <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 font-mono mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{sale.whatsapp}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-xs font-semibold text-slate-300">{sale.city}</p>
                      <p className="text-[8px] text-brand-text-dim/70 truncate max-w-[120px]">{sale.logistics}</p>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <p className="text-xs font-black text-emerald-400 font-mono">
                        {formatCurrency(sale.price)}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Convert reservation to definitive buy */}
                        {sale.status === 'Reserva' && (
                          <button 
                            onClick={() => confirmReservation(sale)} 
                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl transition-all cursor-pointer"
                            title="Confirmar Venta Final"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* WhatsApp dispatch */}
                        <a 
                          href={`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(
                            `¡Hola ${sale.clientName}! Te contactamos de SHARUI respecto a tu ${sale.status === 'Compra' ? 'compra' : 'reserva'} del calzado ${sale.productCode} (Talla ${sale.selectedSize}).`
                          )}`}
                          target="_blank" 
                          rel="noreferrer"
                          title="Contactar por WhatsApp"
                          className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-all cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {/* Generate / View Invoice */}
                        <button
                          onClick={() => handleGenerateInvoiceFromSale(sale)}
                          title="Generar / Ver Factura"
                          className="p-2 bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-white rounded-xl transition-all cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit */}
                        <button 
                          onClick={() => handleEdit(sale)} 
                          title="Editar"
                          className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button 
                          onClick={() => setSaleToDelete(sale)} 
                          title="Eliminar registro"
                          className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Viewer Modal */}
      {selectedInvoiceForModal && (
        <InvoiceModal
          invoice={selectedInvoiceForModal}
          onClose={() => setSelectedInvoiceForModal(null)}
          onStatusChange={async (inv, newStatus) => {
            const updated = { ...inv, status: newStatus };
            await StorageService.saveInvoice(updated);
            setInvoices(StorageService.getInvoices());
            setSelectedInvoiceForModal(updated);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {saleToDelete && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-brand-card border border-white/10 p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-5 text-center relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase">¿Eliminar Operación?</h3>
                <p className="text-xs text-brand-text-dim mt-2">
                  Se eliminará la operación del calzado <span className="text-white font-bold">{saleToDelete.productCode}</span> (Talla {saleToDelete.selectedSize}) por valor de {formatCurrency(saleToDelete.price)}.
                </p>
                <p className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 p-2 rounded-xl mt-3">
                  ✨ La talla volverá a estar disponible automáticamente en el inventario.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSaleToDelete(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black text-brand-text-dim uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteSale(saleToDelete.id)}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-black text-white uppercase cursor-pointer"
                >
                  Sí, Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
