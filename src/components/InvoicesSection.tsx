/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Eye, 
  Printer, 
  Share2, 
  Trash2, 
  ShoppingBag,
  User,
  Calendar,
  CreditCard,
  Sparkles,
  Download
} from 'lucide-react';
import { Invoice, InvoiceItem, Sale, Product } from '../types';
import { StorageService } from '../lib/storage';
import { formatCurrency, formatDate, getLocalDateString, getLocalTimeString } from '../lib/utils';
import InvoiceModal from './InvoiceModal';
import confetti from 'canvas-confetti';

interface InvoicesSectionProps {
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  sales: Sale[];
  products: Product[];
}

export default function InvoicesSection({ invoices, setInvoices, sales, products }: InvoicesSectionProps) {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'Emitida' | 'Pagada' | 'Anulada'>('TODOS');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  // Form State
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientTaxId, setClientTaxId] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Invoice['paymentMethod']>('Transferencia QR');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0'); // percentage
  
  // Custom Items
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: '1', description: '', size: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);

  // When a sale is selected in the form, autofill
  const handleSelectSale = (saleId: string) => {
    setSelectedSaleId(saleId);
    if (!saleId) return;

    const sale = sales.find(s => s.id === saleId);
    if (sale) {
      setClientName(sale.clientName);
      setClientPhone(sale.whatsapp);
      setClientCity(sale.city);

      const product = products.find(p => p.code.toLowerCase() === sale.productCode.toLowerCase());
      const desc = product ? `${product.name} (${sale.productCode})` : `Calzado Ref. ${sale.productCode}`;

      setItems([
        {
          id: crypto.randomUUID(),
          description: desc,
          size: sale.selectedSize,
          quantity: 1,
          unitPrice: sale.price,
          total: sale.price
        }
      ]);
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = Number(field === 'quantity' ? value : updated[index].quantity) || 0;
      const p = Number(field === 'unitPrice' ? value : updated[index].unitPrice) || 0;
      updated[index].total = q * p;
    }
    setItems(updated);
  };

  const addItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), description: '', size: '', quantity: 1, unitPrice: 0, total: 0 }
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (it.total || 0), 0);
  const discountVal = Math.max(0, parseFloat(discount) || 0);
  const taxableAmount = Math.max(0, subtotal - discountVal);
  const taxVal = (taxableAmount * (parseFloat(taxRate) || 0)) / 100;
  const total = taxableAmount + taxVal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      alert('El nombre del cliente es obligatorio');
      return;
    }

    if (items.length === 0 || !items[0].description.trim()) {
      alert('Debe incluir al menos un producto o concepto en el detalle');
      return;
    }

    // Auto generate sequential invoice number
    const currentYear = new Date().getFullYear();
    const count = invoices.length + 1;
    const invoiceNumber = `FAC-${currentYear}-${String(count).padStart(3, '0')}`;

    const nowLocal = new Date();
    const localDate = getLocalDateString(nowLocal);
    const localTime = getLocalTimeString(nowLocal);

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      invoiceNumber,
      date: localDate,
      time: localTime,
      dateTimeString: `${formatDate(localDate)} ${localTime}`,
      saleId: selectedSaleId || undefined,
      clientName: clientName.trim(),
      clientTaxId: clientTaxId.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientCity: clientCity.trim() || undefined,
      items: items.map(it => ({ ...it, description: it.description.trim() })),
      subtotal,
      discount: discountVal,
      tax: taxVal,
      total,
      status: 'Emitida',
      paymentMethod,
      notes: notes.trim() || 'Comprobante válido de venta y entrega de mercadería.',
      terms: 'Garantía legal de 30 días contra desperfectos de fabricación.',
      createdAt: Date.now(),
    };

    await StorageService.saveInvoice(newInvoice);
    setInvoices(StorageService.getInvoices());

    // Trigger celebratory confetti
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 }
    });

    // Reset Form
    setIsFormVisible(false);
    setSelectedSaleId('');
    setClientName('');
    setClientTaxId('');
    setClientPhone('');
    setClientCity('');
    setNotes('');
    setDiscount('0');
    setTaxRate('0');
    setItems([{ id: '1', description: '', size: '', quantity: 1, unitPrice: 0, total: 0 }]);

    // Auto open modal for preview/print
    setSelectedInvoice(newInvoice);
  };

  const handleDeleteInvoice = async (id: string) => {
    await StorageService.deleteInvoice(id);
    setInvoices(StorageService.getInvoices());
    setInvoiceToDelete(null);
  };

  const handleStatusChange = async (inv: Invoice, newStatus: 'Emitida' | 'Pagada' | 'Anulada') => {
    const updated = { ...inv, status: newStatus };
    await StorageService.saveInvoice(updated);
    setInvoices(StorageService.getInvoices());
    setSelectedInvoice(updated);
  };

  // Filtered invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.clientTaxId && inv.clientTaxId.includes(searchTerm)) ||
      (inv.clientCity && inv.clientCity.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'TODOS' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // KPI Metrics
  const totalBilled = invoices.filter(i => i.status !== 'Anulada').reduce((acc, i) => acc + i.total, 0);
  const paidCount = invoices.filter(i => i.status === 'Pagada').length;
  const pendingCount = invoices.filter(i => i.status === 'Emitida').length;

  return (
    <div className="space-y-8 pb-20">
      {/* Top Banner & KPIs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center text-brand-accent">
              <FileText className="w-5 h-5" />
            </div>
            Gestión de Facturación y Comprobantes
          </h2>
          <p className="text-xs text-brand-text-dim mt-1">
            Generación oficial de facturas, notas de venta, recibos y resúmenes para WhatsApp
          </p>
        </div>

        <button
          onClick={() => setIsFormVisible(!isFormVisible)}
          className="px-6 py-3.5 bg-brand-accent hover:opacity-90 rounded-2xl font-black text-xs text-white uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/20 transition-all hover:scale-[1.02] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {isFormVisible ? 'Cerrar Formulario' : 'Emitir Nueva Factura'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 bg-brand-card rounded-2xl border border-white/5 shadow-xl">
          <p className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider mb-1">Total Facturado</p>
          <p className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(totalBilled)}</p>
          <p className="text-[9px] text-brand-text-dim/60 font-bold mt-1">Ventas válidas emitidas</p>
        </div>
        <div className="p-4 bg-brand-card rounded-2xl border border-white/5 shadow-xl">
          <p className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider mb-1">Comprobantes Pagados</p>
          <p className="text-2xl font-black text-white">{paidCount} doc.</p>
          <p className="text-[9px] text-emerald-400 font-bold mt-1">Cobro efectivo registrado</p>
        </div>
        <div className="p-4 bg-brand-card rounded-2xl border border-white/5 shadow-xl">
          <p className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider mb-1">Por Cobrar / Pendientes</p>
          <p className="text-2xl font-black text-amber-400">{pendingCount} doc.</p>
          <p className="text-[9px] text-brand-text-dim/60 font-bold mt-1">En estado "Emitida"</p>
        </div>
        <div className="p-4 bg-brand-card rounded-2xl border border-white/5 shadow-xl">
          <p className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider mb-1">Total Comprobantes</p>
          <p className="text-2xl font-black text-blue-400">{invoices.length} reg.</p>
          <p className="text-[9px] text-brand-text-dim/60 font-bold mt-1">Histórico en sistema</p>
        </div>
      </div>

      {/* New Invoice Form */}
      <AnimatePresence>
        {isFormVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-brand-card rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl relative">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-accent rounded-l-3xl"></div>

              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brand-accent" />
                    Emisor de Comprobante Mercantil
                  </h3>
                  <p className="text-xs text-brand-text-dim">Completa los campos o importa una venta registrada.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormVisible(false)}
                  className="p-2 rounded-xl bg-white/5 text-brand-text-dim hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sale quick-import dropdown */}
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest block mb-2">
                    ⚡ Autocompletar desde una Venta Existente (Opcional):
                  </label>
                  <select
                    value={selectedSaleId}
                    onChange={(e) => handleSelectSale(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="">-- Ingresar datos manualmente --</option>
                    {sales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.date} • {s.clientName} ({s.productCode} - T{s.selectedSize}) - {formatCurrency(s.price)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Client Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                      Nombre o Razón Social *
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Ej. Juan Pérez"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none focus:border-brand-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                      NIT / CI (Opcional)
                    </label>
                    <input
                      type="text"
                      value={clientTaxId}
                      onChange={(e) => setClientTaxId(e.target.value)}
                      placeholder="Ej. 1029384019"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none focus:border-brand-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                      WhatsApp / Teléfono
                    </label>
                    <input
                      type="tel"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="Ej. 77234567"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none focus:border-brand-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                      Ciudad / Destino
                    </label>
                    <input
                      type="text"
                      value={clientCity}
                      onChange={(e) => setClientCity(e.target.value)}
                      placeholder="Ej. La Paz, Santa Cruz..."
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none focus:border-brand-accent"
                    />
                  </div>
                </div>

                {/* Items Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                      Detalle de Productos / Ítems
                    </label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="px-3 py-1.5 rounded-lg bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-white transition-all text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar Ítem
                    </button>
                  </div>

                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                        <div className="col-span-6 md:col-span-5">
                          <input
                            type="text"
                            required
                            placeholder="Descripción del calzado o producto..."
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs font-bold text-white outline-none"
                          />
                        </div>

                        <div className="col-span-2 md:col-span-2">
                          <input
                            type="text"
                            placeholder="Talla (ej. 41)"
                            value={item.size || ''}
                            onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs font-bold text-white text-center outline-none"
                          />
                        </div>

                        <div className="col-span-2 md:col-span-1">
                          <input
                            type="number"
                            min="1"
                            placeholder="Cant"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-2 rounded-lg bg-white/5 border border-white/5 text-xs font-bold text-white text-center outline-none"
                          />
                        </div>

                        <div className="col-span-2 md:col-span-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Precio (Bs)"
                            value={item.unitPrice || ''}
                            onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs font-bold text-white text-right outline-none"
                          />
                        </div>

                        <div className="col-span-12 md:col-span-2 flex items-center justify-between md:justify-end gap-3 pt-1 md:pt-0">
                          <span className="text-xs font-black text-white font-mono">
                            {formatCurrency(item.total)}
                          </span>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="text-red-400 hover:text-red-300 p-1"
                              title="Quitar ítem"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Conditions & Totals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                        Método de Pago
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none cursor-pointer"
                      >
                        <option value="Transferencia QR">Transferencia QR (Simple / Banco)</option>
                        <option value="Efectivo">Efectivo en Tienda</option>
                        <option value="Tarjeta">Tarjeta Débito / Crédito</option>
                        <option value="Depósito Bancario">Depósito Bancario</option>
                        <option value="Contra Entrega">Contra Entrega</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                        Notas u Observaciones del Comprobante
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ej. Entregado con empaque original. Cambio de talla en 48h."
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white outline-none resize-none"
                      />
                    </div>
                  </div>

                  <div className="bg-white/[0.02] p-5 rounded-2xl border border-white/5 space-y-3">
                    <div className="flex justify-between text-xs text-brand-text-dim">
                      <span>Subtotal de ítems:</span>
                      <span className="font-mono font-bold text-white">{formatCurrency(subtotal)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] font-black text-brand-text-dim uppercase">Descuento (Bs):</label>
                        <input
                          type="number"
                          min="0"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs text-emerald-400 font-bold outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] font-black text-brand-text-dim uppercase">Impuesto/IVA (%):</label>
                        <input
                          type="number"
                          min="0"
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-xs text-white font-bold outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                      <span className="text-sm font-black text-white uppercase tracking-wider">Total a Facturar:</span>
                      <span className="text-xl font-black text-emerald-400 font-mono">
                        {formatCurrency(total)}
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="w-full mt-2 py-4 bg-brand-accent hover:opacity-90 rounded-xl font-black text-xs text-white uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl shadow-brand-accent/20 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Emitir y Generar Comprobante
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search and Filters Bar */}
      <div className="bg-brand-card p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-brand-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por N° factura, cliente, NIT o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white outline-none focus:border-brand-accent"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['TODOS', 'Emitida', 'Pagada', 'Anulada'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === st
                  ? 'bg-brand-accent text-white shadow-md'
                  : 'bg-white/5 text-brand-text-dim hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-brand-card rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5 text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                <th className="px-6 py-4">N° Comprobante</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Método de Pago</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Importe Total</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-brand-text-dim italic font-medium">
                    No se encontraron comprobantes de venta con los filtros aplicados.
                  </td>
                </tr>
              )}
              {filteredInvoices.sort((a,b) => b.createdAt - a.createdAt).map((invoice) => (
                <tr key={invoice.id} className="hover:bg-white/[0.015] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-black text-xs">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-white font-mono">{invoice.invoiceNumber}</p>
                        <p className="text-[8px] text-brand-text-dim font-bold">{invoice.items.length} artículo(s)</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 text-xs font-semibold text-brand-text-dim whitespace-nowrap">
                    {formatDate(invoice.date)}
                  </td>

                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-white uppercase">{invoice.clientName}</p>
                    <p className="text-[9px] text-brand-text-dim font-medium">
                      {invoice.clientCity || 'Sin ciudad'} {invoice.clientTaxId ? `• NIT: ${invoice.clientTaxId}` : ''}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-xs font-semibold text-slate-300">
                    <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px]">
                      {invoice.paymentMethod}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      invoice.status === 'Pagada'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : invoice.status === 'Emitida'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {invoice.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-black text-emerald-400 font-mono">
                      {formatCurrency(invoice.total)}
                    </p>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        title="Ver y Descargar Factura"
                        className="p-2 rounded-xl bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent border border-brand-accent/20 transition-all cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedInvoice(invoice);
                        }}
                        title="Imprimir"
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 transition-all cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setInvoiceToDelete(invoice)}
                        title="Eliminar Comprobante"
                        className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Viewer Modal */}
      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {invoiceToDelete && (
          <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
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
                <h3 className="text-base font-black text-white uppercase">¿Eliminar Comprobante?</h3>
                <p className="text-xs text-brand-text-dim mt-2">
                  Se eliminará permanentemente la factura <span className="text-white font-bold">{invoiceToDelete.invoiceNumber}</span> emitida para <span className="text-white font-bold">{invoiceToDelete.clientName}</span>.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setInvoiceToDelete(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black text-brand-text-dim uppercase"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteInvoice(invoiceToDelete.id)}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-black text-white uppercase"
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
