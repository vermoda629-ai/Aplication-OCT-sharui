/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  FileText, 
  Clock, 
  Phone, 
  MapPin, 
  CreditCard, 
  Banknote, 
  QrCode, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Search, 
  Filter, 
  Printer, 
  Share2, 
  ExternalLink, 
  Calendar,
  AlertCircle,
  Tag,
  X,
  Save,
  Check
} from 'lucide-react';
import { Sale, Invoice, Product, StoreSettings } from '../types';
import { StorageService } from '../lib/storage';
import { formatCurrency, formatDate, formatTime, formatDateTime, getLocalDateString, getLocalTimeString, getSaleChronologicalTimestamp } from '../lib/utils';
import InvoiceModal from './InvoiceModal';
import confetti from 'canvas-confetti';

interface SalesAndInvoicesSectionProps {
  sales: Sale[];
  setSales: (sales: Sale[]) => void;
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  products: Product[];
  setProducts?: (products: Product[]) => void;
  storeSettings?: StoreSettings;
}

const BOLIVIA_CITIES = [
  'Cochabamba',
  'La Paz',
  'Santa Cruz',
  'Oruro',
  'Potosí',
  'Chuquisaca',
  'Tarija',
  'Beni',
  'Pando',
  'El Alto'
];

export default function SalesAndInvoicesSection({
  sales,
  setSales,
  invoices,
  setInvoices,
  products,
  setProducts,
  storeSettings
}: SalesAndInvoicesSectionProps) {
  const [salesSearch, setSalesSearch] = useState('');
  const [salesStatusFilter, setSalesStatusFilter] = useState<'TODAS' | 'Compra' | 'Reserva'>('TODAS');

  // Modals state
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<Invoice | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  // Reservation Culmination Modal state
  const [reservationToComplete, setReservationToComplete] = useState<Sale | null>(null);
  const [remainingPaymentInput, setRemainingPaymentInput] = useState<string>('');
  const [completionPaymentMethod, setCompletionPaymentMethod] = useState<'Efectivo' | 'QR' | 'Tarjeta'>('Efectivo');

  // Edit Sale Modal state
  const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editSelectedSize, setEditSelectedSize] = useState('');
  const [editClientName, setEditClientName] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<'Efectivo' | 'QR' | 'Tarjeta'>('Efectivo');
  const [editStatus, setEditStatus] = useState<'Compra' | 'Reserva'>('Compra');
  const [editAdvancePayment, setEditAdvancePayment] = useState('');
  const [editLogistics, setEditLogistics] = useState<Sale['logistics']>('En tienda');
  const [editNotes, setEditNotes] = useState('');

  // Open reservation culmination modal
  const handleOpenCompleteReservation = (sale: Sale) => {
    const advance = sale.advancePayment || 0;
    const balance = sale.remainingBalance !== undefined ? sale.remainingBalance : Math.max(0, sale.price - advance);
    setReservationToComplete(sale);
    setRemainingPaymentInput(balance > 0 ? balance.toString() : '0');
    setCompletionPaymentMethod('Efectivo');
  };

  // Confirm culmination of reservation to definitive sale
  const handleConfirmCulmination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationToComplete) return;

    const remainingAmount = parseFloat(remainingPaymentInput) || 0;
    const prevAdvance = reservationToComplete.advancePayment || 0;
    const newTotalPaid = prevAdvance + remainingAmount;
    const newRemaining = Math.max(0, (reservationToComplete.remainingBalance || (reservationToComplete.price - prevAdvance)) - remainingAmount);

    const updatedSale: Sale = {
      ...reservationToComplete,
      status: 'Compra',
      advancePayment: newTotalPaid,
      remainingBalance: newRemaining,
      notes: `${reservationToComplete.notes || ''} [Culminado: Saldo de Bs. ${remainingAmount} pagado por ${completionPaymentMethod}]`.trim()
    };

    const updatedSales = sales.map(s => s.id === updatedSale.id ? updatedSale : s);
    setSales(updatedSales);
    await StorageService.saveSale(updatedSale);

    // Update corresponding invoice
    const matched = invoices.find(inv => inv.saleId === updatedSale.id || inv.invoiceNumber === updatedSale.invoiceId);
    if (matched) {
      const updatedInv: Invoice = {
        ...matched,
        status: 'Pagada',
        advancePayment: newTotalPaid,
        remainingBalance: newRemaining,
        notes: `Nota de venta completada en su totalidad. Saldo pagado en ${completionPaymentMethod}.`
      };
      setInvoices(invoices.map(i => i.id === updatedInv.id ? updatedInv : i));
      await StorageService.saveInvoice(updatedInv);
    }

    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 }
    });

    setReservationToComplete(null);
  };

  // Open edit modal for sale
  const handleOpenEditSale = (sale: Sale) => {
    setSaleToEdit(sale);
    setEditDate(sale.date || getLocalDateString());
    setEditTime(sale.time || getLocalTimeString());
    setEditSelectedSize(sale.selectedSize || '');
    setEditClientName(sale.clientName || '');
    setEditWhatsapp(sale.whatsapp || '');
    setEditCity(sale.city || 'Cochabamba');
    setEditPrice(sale.price.toString());
    setEditPaymentMethod(sale.paymentMethod || 'Efectivo');
    setEditStatus(sale.status);
    setEditAdvancePayment((sale.advancePayment || 0).toString());
    setEditLogistics(sale.logistics || 'En tienda');
    setEditNotes(sale.notes || '');
  };

  // Save changes to sale
  const handleSaveEditSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToEdit) return;

    const parsedPrice = parseFloat(editPrice) || saleToEdit.price;
    const parsedAdvance = editStatus === 'Reserva' ? (parseFloat(editAdvancePayment) || 0) : parsedPrice;
    const parsedRemaining = editStatus === 'Reserva' ? Math.max(0, parsedPrice - parsedAdvance) : 0;

    const cleanSize = editSelectedSize.replace(/^T/i, '').trim();

    const calibratedDate = editDate.trim() || saleToEdit.date || getLocalDateString();
    const calibratedTime = editTime.trim() || saleToEdit.time || getLocalTimeString();
    const calibratedDateTimeString = `${formatDate(calibratedDate)} ${calibratedTime}`;

    const updatedSale: Sale = {
      ...saleToEdit,
      date: calibratedDate,
      time: calibratedTime,
      dateTimeString: calibratedDateTimeString,
      selectedSize: cleanSize,
      clientName: editClientName.trim() || 'S/N',
      whatsapp: editWhatsapp.trim() || 'S/N',
      city: editCity.trim() || 'Cochabamba',
      price: parsedPrice,
      paymentMethod: editPaymentMethod,
      status: editStatus,
      advancePayment: parsedAdvance,
      remainingBalance: parsedRemaining,
      logistics: editLogistics,
      notes: editNotes.trim(),
    };

    const nextSales = sales.map(s => s.id === updatedSale.id ? updatedSale : s);
    setSales(nextSales);
    await StorageService.saveSale(updatedSale);

    // Update corresponding invoice if exists
    const matched = invoices.find(inv => inv.saleId === updatedSale.id || inv.invoiceNumber === updatedSale.invoiceId);
    if (matched) {
      const updatedInv: Invoice = {
        ...matched,
        date: calibratedDate,
        time: calibratedTime,
        dateTimeString: calibratedDateTimeString,
        clientName: updatedSale.clientName,
        clientPhone: updatedSale.whatsapp,
        clientCity: updatedSale.city,
        total: parsedPrice,
        subtotal: parsedPrice,
        advancePayment: parsedAdvance,
        remainingBalance: parsedRemaining,
        status: editStatus === 'Compra' ? 'Pagada' : 'Emitida',
        paymentMethod: editPaymentMethod,
        items: matched.items.map(it => ({
          ...it,
          size: cleanSize,
          unitPrice: parsedPrice,
          total: parsedPrice
        }))
      };
      setInvoices(invoices.map(i => i.id === updatedInv.id ? updatedInv : i));
      await StorageService.saveInvoice(updatedInv);
    }

    confetti({
      particleCount: 50,
      spread: 50,
      origin: { y: 0.6 }
    });

    setSaleToEdit(null);
  };

  // Delete sale: frees up the pair in both Catálogo and Inventario instantly
  const handleDeleteSale = async (id: string) => {
    const updatedSales = sales.filter(s => s.id !== id);
    setSales(updatedSales);
    setSaleToDelete(null);
    await StorageService.deleteSale(id);

    // Delete linked invoice
    const linkedInv = invoices.find(inv => inv.saleId === id);
    if (linkedInv) {
      setInvoices(invoices.filter(i => i.id !== linkedInv.id));
      await StorageService.deleteInvoice(linkedInv.id);
    }
  };

  // Filter sales and strictly sort in chronological order (most recent at the top, oldest at the bottom)
  const filteredSales = sales.filter(s => {
    const q = salesSearch.toLowerCase().trim();
    const matchesSearch = 
      s.clientName.toLowerCase().includes(q) ||
      s.productCode.toLowerCase().includes(q) ||
      (s.subCode && s.subCode.toLowerCase().includes(q)) ||
      (s.fullCode && s.fullCode.toLowerCase().includes(q)) ||
      (s.city && s.city.toLowerCase().includes(q)) ||
      s.whatsapp.includes(q);

    const matchesStatus = salesStatusFilter === 'TODAS' || s.status === salesStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedSales = [...filteredSales].sort((a, b) => {
    const timeA = getSaleChronologicalTimestamp(a);
    const timeB = getSaleChronologicalTimestamp(b);
    if (timeB !== timeA) return timeB - timeA;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });


  // Open professional receipt / invoice corresponding to sale
  const handleOpenSaleInvoice = (sale: Sale) => {
    const matched = invoices.find(inv => inv.saleId === sale.id || inv.invoiceNumber === sale.invoiceId);
    if (matched) {
      setSelectedInvoiceForModal(matched);
    } else {
      // Create instant receipt for this sale
      const count = invoices.length + 1;
      const currentYear = new Date().getFullYear();
      const invoiceNumber = `REC-${currentYear}-${String(count).padStart(3, '0')}`;

      const newInv: Invoice = {
        id: crypto.randomUUID(),
        invoiceNumber,
        date: sale.date,
        time: sale.time || formatTime(sale.createdAt),
        dateTimeString: sale.dateTimeString || formatDateTime(sale.createdAt),
        saleId: sale.id,
        clientName: sale.clientName,
        clientPhone: sale.whatsapp,
        clientCity: sale.city || 'Cochabamba',
        items: [
          {
            id: crypto.randomUUID(),
            description: sale.fullCode || sale.productCode,
            size: sale.selectedSize,
            quantity: 1,
            unitPrice: sale.price,
            total: sale.price
          }
        ],
        subtotal: sale.price,
        discount: sale.discount || 0,
        tax: 0,
        total: sale.price,
        advancePayment: sale.advancePayment !== undefined ? sale.advancePayment : (sale.status === 'Compra' ? sale.price : 0),
        remainingBalance: sale.remainingBalance !== undefined ? sale.remainingBalance : (sale.status === 'Compra' ? 0 : sale.price),
        status: sale.status === 'Compra' ? 'Pagada' : 'Emitida',
        paymentMethod: sale.paymentMethod || 'Efectivo',
        notes: `Nota de venta emitida para ${sale.clientName}.`,
        createdAt: Date.now()
      };

      StorageService.saveInvoice(newInv).then(() => {
        setInvoices(StorageService.getInvoices());
        setSelectedInvoiceForModal(newInv);
      });
    }
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
            Registro y Detalle de Ventas
          </h2>
          <p className="text-xs text-brand-text-dim mt-1">
            Registro detallado de cada venta efectuada con fecha y hora, opciones de cambio/edición y notas de venta profesionales
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(['TODAS', 'Compra', 'Reserva'] as const).map(st => (
            <button
              key={st}
              onClick={() => setSalesStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                salesStatusFilter === st 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                  : 'bg-white/5 text-brand-text-dim hover:text-white border border-white/5'
              }`}
            >
              {st === 'TODAS' ? 'Todas' : st === 'Compra' ? 'Compras' : 'Reservas'}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar & Chronological Order Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 text-brand-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Buscar venta por código, cliente o ciudad..."
            value={salesSearch}
            onChange={(e) => setSalesSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs font-bold text-white outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold self-start sm:self-auto">
          <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>Orden cronológico: Más reciente arriba • Más antiguo abajo ({sortedSales.length} ventas)</span>
        </div>
      </div>

      {/* Main Sales Table */}
      <div className="bg-brand-card rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-[9px] font-black text-brand-text-dim uppercase tracking-wider">
                <th className="px-5 py-3.5">Estado / Anticipo</th>
                <th className="px-5 py-3.5">Fecha y Hora</th>
                <th className="px-5 py-3.5">Código y Sub-Código</th>
                <th className="px-5 py-3.5 text-center">Talla</th>
                <th className="px-5 py-3.5 text-right">Precio Venta</th>
                <th className="px-5 py-3.5">Ciudad</th>
                <th className="px-5 py-3.5">Pago</th>
                <th className="px-5 py-3.5">Cliente</th>
                <th className="px-5 py-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {sortedSales.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-14 text-center text-brand-text-dim italic font-medium">
                    No hay registros de ventas que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
              {sortedSales.map(sale => {
                const cleanPhone = sale.whatsapp.replace(/\D/g, '');
                const phoneWithCode = cleanPhone.startsWith('591') ? cleanPhone : `591${cleanPhone}`;
                const isReservation = sale.status === 'Reserva';
                const advance = sale.advancePayment || 0;
                const remaining = sale.remainingBalance !== undefined ? sale.remainingBalance : Math.max(0, sale.price - advance);

                return (
                  <tr key={sale.id} className="hover:bg-white/[0.015] transition-colors group">
                    {/* Estado con desglose de anticipo/saldo para reservas */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {isReservation ? (
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-block">
                            Reserva
                          </span>
                          <p className="text-[9px] text-amber-300 font-mono font-bold">
                            Anticipo: {formatCurrency(advance)}
                          </p>
                          {remaining > 0 && (
                            <p className="text-[9px] text-red-400 font-mono">
                              Saldo: {formatCurrency(remaining)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Compra Pagada
                        </span>
                      )}
                    </td>

                    {/* Fecha y Hora Automática */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-bold text-white block">
                        {formatDate(sale.date)}
                      </span>
                      <span className="text-[10px] text-amber-400/90 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {sale.time || formatTime(sale.createdAt)}
                      </span>
                    </td>

                    {/* Código y Sub-Código */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="text-xs font-black text-blue-400 font-mono bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                        {sale.fullCode || sale.productCode}
                      </span>
                    </td>

                    {/* Talla: Solo número */}
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-xs font-black bg-slate-800 text-white border border-white/10 px-2.5 py-0.5 rounded-lg font-mono">
                        {String(sale.selectedSize).replace(/^T/i, '')}
                      </span>
                    </td>

                    {/* A cuánto se vendió */}
                    <td className="px-5 py-3.5 text-right font-mono">
                      <span className="text-sm font-black text-emerald-400">
                        {formatCurrency(sale.price)}
                      </span>
                    </td>

                    {/* De qué ciudad */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span>{sale.city || 'Cochabamba'}</span>
                      </div>
                    </td>

                    {/* Efectivo o QR o Tarjeta */}
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase ${
                        sale.paymentMethod === 'QR' 
                          ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' 
                          : sale.paymentMethod === 'Tarjeta'
                          ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {sale.paymentMethod || 'Efectivo'}
                      </span>
                    </td>

                    {/* Cliente */}
                    <td className="px-5 py-3.5">
                      {(!sale.clientName || ['s/n', 'sn', 'sin nombre', 'cliente casual', 'anónimo', 'anonimo', 'cliente'].includes(sale.clientName.trim().toLowerCase())) ? (
                        <div>
                          <span className="text-[10px] font-mono font-bold text-neutral-400 bg-neutral-800/80 px-2 py-0.5 rounded border border-neutral-700/60 inline-block">
                            S/N (Sin Nombre)
                          </span>
                          <p className="text-[8px] text-neutral-500 mt-0.5">Venta independiente</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-white uppercase truncate max-w-[130px]">{sale.clientName}</p>
                          <p className="text-[9px] text-brand-text-dim font-mono">{sale.whatsapp || 'Sin teléfono'}</p>
                        </div>
                      )}
                    </td>

                    {/* Acciones: Culminar Reserva, Editar, Ver Recibo, WhatsApp, Eliminar */}
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Botón Verde Check para Culminar Reserva con Monto Restante */}
                        {isReservation && (
                          <button
                            onClick={() => handleOpenCompleteReservation(sale)}
                            title="Culminar Venta: Abonar saldo restante y marcar como Vendido"
                            className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer shadow-sm shadow-emerald-500/20"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Botón Editar: Cambiar talla, datos o estado */}
                        <button
                          onClick={() => handleOpenEditSale(sale)}
                          title="Editar Venta o Cambiar Talla"
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-600 hover:text-white transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Botón Ver Nota de Venta / Recibo Oficial */}
                        <button
                          onClick={() => handleOpenSaleInvoice(sale)}
                          title="Ver Nota de Venta / Recibo"
                          className="p-1.5 rounded-lg bg-white/5 text-slate-300 hover:bg-white/20 hover:text-white transition-all cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>

                        {/* WhatsApp Directo */}
                        <a
                          href={`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(
                            `Hola ${sale.clientName}, te escribimos de ${storeSettings?.storeName || 'SHARUI'} respecto a tu compra del calzado ${sale.fullCode || sale.productCode} (Talla ${sale.selectedSize}).`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Enviar WhatsApp al cliente"
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {/* Eliminar Venta y reintegrar el par al catálogo e inventario */}
                        <button
                          onClick={() => setSaleToDelete(sale)}
                          title="Eliminar venta y reintegrar par al stock"
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all cursor-pointer"
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

      {/* ========================================================================= */}
      {/* MODAL 1: CULMINAR VENTA DE RESERVA (BOTÓN VERDE OK) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {reservationToComplete && (
          <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-emerald-500/30 p-6 rounded-3xl max-w-md w-full shadow-2xl relative my-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                      Culminar Venta de Reserva
                    </h3>
                    <p className="text-[10px] text-brand-text-dim">
                      Cancela el saldo restante y marca el calzado como definitivamente vendido
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setReservationToComplete(null)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-brand-text-dim hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Reservation summary cards */}
              <div className="my-4 p-4 bg-slate-950/60 rounded-2xl border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-bold">Cliente:</span>
                  <span className="font-black text-white uppercase">{reservationToComplete.clientName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-bold">Calzado / Código:</span>
                  <span className="font-black text-emerald-400 font-mono">
                    {reservationToComplete.fullCode || reservationToComplete.productCode} (Talla {reservationToComplete.selectedSize})
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-bold">Precio Total:</span>
                  <span className="font-mono font-black text-white">{formatCurrency(reservationToComplete.price)}</span>
                </div>
                <div className="flex justify-between items-center text-amber-400">
                  <span className="font-bold">Anticipo Ya Pagado:</span>
                  <span className="font-mono font-black">{formatCurrency(reservationToComplete.advancePayment || 0)}</span>
                </div>
              </div>

              <form onSubmit={handleConfirmCulmination} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                    Monto Restante a Cancelar Ahora (Bs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={remainingPaymentInput}
                    onChange={(e) => setRemainingPaymentInput(e.target.value)}
                    placeholder="Monto restante"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-emerald-500/40 text-base font-black text-emerald-300 font-mono outline-none focus:border-emerald-400"
                  />
                  <p className="text-[9px] text-slate-400">
                    Puedes ajustar el monto restante exacto que el cliente cancela ahora.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                    Forma de Pago del Saldo *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Efectivo', 'QR', 'Tarjeta'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCompletionPaymentMethod(m)}
                        className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
                          completionPaymentMethod === m
                            ? 'bg-emerald-600 text-white shadow-md border border-emerald-400'
                            : 'bg-slate-800 text-slate-400 border border-white/5 hover:text-white'
                        }`}
                      >
                        {m === 'QR' && <QrCode className="w-3.5 h-3.5" />}
                        {m === 'Efectivo' && <Banknote className="w-3.5 h-3.5" />}
                        {m === 'Tarjeta' && <CreditCard className="w-3.5 h-3.5" />}
                        <span>{m}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReservationToComplete(null)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black text-brand-text-dim uppercase cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar y Culminar Venta</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: EDITAR VENTA / CAMBIO DE TALLA O CLIENTE */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {saleToEdit && (
          <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-blue-500/30 p-6 rounded-3xl max-w-lg w-full shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                      Editar Registro de Venta
                    </h3>
                    <p className="text-[10px] text-brand-text-dim">
                      Permite cambiar la talla por cambio de modelo/horma, corregir cliente, precio o estado
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSaleToEdit(null)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-brand-text-dim hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditSale} className="space-y-4 pt-4">
                {/* Modelo y Calibración de Fecha y Hora */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                  <span className="text-brand-text-dim font-bold">Modelo:</span>
                  <span className="font-mono font-black text-blue-400">
                    {saleToEdit.fullCode || saleToEdit.productCode}
                  </span>
                </div>

                {/* Calibración de Fecha y Hora del Registro */}
                <div className="p-3.5 bg-slate-950/70 border border-emerald-500/20 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      Fecha y Hora de la Transacción *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditDate(getLocalDateString());
                        setEditTime(getLocalTimeString());
                      }}
                      className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                    >
                      ⚡ Calibrar a Hoy ({getLocalDateString()})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <span className="text-[9px] text-brand-text-dim block">Fecha Oficial:</span>
                      <input
                        type="date"
                        required
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-brand-text-dim block">Hora Oficial:</span>
                      <input
                        type="time"
                        required
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400">
                    Garantiza que la venta figure exactamente con la fecha y hora correcta, sin desfases de días.
                  </p>
                </div>

                {/* Cambio de Talla */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                    Talla del Par (Solo número) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editSelectedSize}
                    onChange={(e) => setEditSelectedSize(e.target.value)}
                    placeholder="Ej. 40"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs font-black text-white font-mono outline-none focus:border-blue-500"
                  />
                  <p className="text-[9px] text-slate-400">
                    Si el cliente solicita cambio de talla, modifícalo aquí para mantener actualizado el inventario.
                  </p>
                </div>

                {/* Datos del Cliente */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                      Nombre del Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={editClientName}
                      onChange={(e) => setEditClientName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                      WhatsApp / Teléfono *
                    </label>
                    <input
                      type="tel"
                      required
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Ciudad y Logística */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                      Ciudad *
                    </label>
                    <select
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none cursor-pointer"
                    >
                      {BOLIVIA_CITIES.map(c => (
                        <option key={c} value={c} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                      Método Logístico *
                    </label>
                    <select
                      value={editLogistics}
                      onChange={(e) => setEditLogistics(e.target.value as any)}
                      style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none cursor-pointer"
                    >
                      <option value="En tienda">En tienda</option>
                      <option value="Delivery o entrega">Delivery o entrega</option>
                      <option value="Envío interdepartamental">Envío interdepartamental</option>
                      <option value="Envío a domicilio">Envío a domicilio</option>
                    </select>
                  </div>
                </div>

                {/* Precio y Forma de Pago */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                      Precio de Venta (Bs.) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs font-black text-emerald-400 font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                      Forma de Pago *
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['QR', 'Efectivo', 'Tarjeta'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setEditPaymentMethod(m)}
                          className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer text-center ${
                            editPaymentMethod === m
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-slate-800 text-slate-400 border border-white/5 hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Estado: Compra vs Reserva */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                    Estado de la Transacción *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditStatus('Compra')}
                      className={`py-2.5 rounded-xl text-xs font-black uppercase cursor-pointer text-center ${
                        editStatus === 'Compra'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 border border-white/5'
                      }`}
                    >
                      Compra Pagada
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditStatus('Reserva')}
                      className={`py-2.5 rounded-xl text-xs font-black uppercase cursor-pointer text-center ${
                        editStatus === 'Reserva'
                          ? 'bg-amber-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 border border-white/5'
                      }`}
                    >
                      Reserva
                    </button>
                  </div>
                </div>

                {/* Si es Reserva, editar anticipo */}
                {editStatus === 'Reserva' && (
                  <div className="space-y-1.5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <label className="text-[10px] font-black text-amber-300 uppercase tracking-widest">
                      Anticipo Inicial Pagado (Bs.) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAdvancePayment}
                      onChange={(e) => setEditAdvancePayment(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-amber-500/30 text-xs font-bold text-amber-300 font-mono outline-none"
                    />
                  </div>
                )}

                {/* Acciones del Modal */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSaleToEdit(null)}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black text-brand-text-dim uppercase cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: NOTA DE VENTA / RECIBO COMERCIAL */}
      {/* ========================================================================= */}
      {selectedInvoiceForModal && (
        <InvoiceModal
          invoice={selectedInvoiceForModal}
          storeSettings={storeSettings}
          onClose={() => setSelectedInvoiceForModal(null)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ELIMINAR VENTA (REINTEGRA EL PAR AL INVENTARIO Y CATÁLOGO) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {saleToDelete && (
          <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-red-500/30 p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white uppercase">¿Eliminar Venta?</h3>
              <p className="text-xs text-brand-text-dim leading-relaxed">
                Se eliminará el registro de venta para <span className="text-white font-bold">{saleToDelete.clientName}</span> ({saleToDelete.fullCode || saleToDelete.productCode} - Talla {saleToDelete.selectedSize}).
              </p>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] text-emerald-300 font-bold">
                ✓ El par se reintegrará automáticamente como DISPONIBLE al inventario y al catálogo.
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setSaleToDelete(null)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black text-brand-text-dim uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeleteSale(saleToDelete.id)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-black text-white uppercase cursor-pointer shadow-lg shadow-red-600/30"
                >
                  Eliminar y Reintegrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
