/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  DollarSign, 
  AlignLeft, 
  ListFilter, 
  CheckCircle2, 
  Trash2, 
  Edit3, 
  BookOpen, 
  FileSpreadsheet, 
  Image as ImageIcon,
  Printer,
  Download,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Lock
} from 'lucide-react';
import { DailyLogEntry } from '../types';
import { StorageService } from '../lib/storage';
import { cn, formatCurrency, formatDate, getLocalDateString, getLocalTimeString } from '../lib/utils';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface AccountingSectionProps {
  logs: DailyLogEntry[];
  setLogs: (logs: DailyLogEntry[]) => void;
}

const CATEGORIES = [
  'Ingresos',
  'Comunicaciones',
  'Transporte',
  'Administrativo',
  'Marketing y Publicidad',
  'Inversiones',
  'Mercadería',
  'Otros'
] as const;

export default function AccountingSection({ logs, setLogs }: AccountingSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<DailyLogEntry | null>(null);
  const [exportFormat, setExportFormat] = useState<'excel' | 'image' | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState('');

  // Form Fields
  const [date, setDate] = useState(getLocalDateString());
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [category, setCategory] = useState<DailyLogEntry['category']>('Ingresos');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      alert('Ingresa un monto válido mayor a 0');
      return;
    }

    const nowTime = getLocalTimeString(new Date());
    const newEntry: DailyLogEntry = {
      id: editingId || crypto.randomUUID(),
      date: date.trim() || getLocalDateString(),
      time: nowTime,
      amount: parseFloat(amount),
      concept: concept.trim(),
      category,
      createdAt: Date.now(),
    };

    await StorageService.saveLog(newEntry);
    setLogs(StorageService.getLogs());

    // Reset Form
    setEditingId(null);
    setDate(getLocalDateString());
    setAmount('');
    setConcept('');
    setCategory('Ingresos');
  };

  const deleteLog = async (id: string) => {
    setLogs(logs.filter(l => l.id !== id));
    setLogToDelete(null);
    await StorageService.deleteLog(id);
  };

  const handleEdit = (log: DailyLogEntry) => {
    setEditingId(log.id);
    setDate(log.date);
    setAmount(log.amount.toString());
    setConcept(log.concept);
    setCategory(log.category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPDF = () => {
    setIsExportingPdf(true);
    try {
      // Letter portrait with top 2cm, sides/bottom 1cm
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = 215.9;
      const pageHeight = 279.4;
      const marginLeft = 10;
      const marginRight = 10;
      const marginTop = 20;
      const marginBottom = 10;
      const availableWidth = pageWidth - marginLeft - marginRight; // 195.9 mm

      // Header Banner
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(marginLeft, marginTop, availableWidth, 15, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('SHARUI ENTERPRISE - LIBRO DIARIO & REGISTRO DE CAJA', marginLeft + 5, marginTop + 10);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Cochabamba • ${new Date().toLocaleDateString()}`, pageWidth - marginRight - 50, marginTop + 10);

      let y = marginTop + 20;

      // Financial Summary Box
      doc.setFillColor(241, 245, 249);
      doc.rect(marginLeft, y, availableWidth, 10, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`Ingresos (+): ${formatCurrency(totalInflow)}`, marginLeft + 5, y + 6.5);
      doc.text(`Egresos (-): ${formatCurrency(totalOutflow)}`, marginLeft + 75, y + 6.5);
      doc.text(`Saldo Neto: ${formatCurrency(currentBalance)}`, marginLeft + 140, y + 6.5);

      y += 14;

      // Table Header: Fecha (24), Concepto (85), Categoría (40), Monto (46.9) = 195.9mm
      const renderTableHeader = () => {
        doc.setFillColor(226, 232, 240);
        doc.rect(marginLeft, y, availableWidth, 7, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('FECHA', marginLeft + 3, y + 5);
        doc.text('CONCEPTO / DETALLE', marginLeft + 28, y + 5);
        doc.text('CATEGORÍA', marginLeft + 115, y + 5);
        doc.text('MONTO (BS.)', marginLeft + 160, y + 5);
        y += 7;
      };

      renderTableHeader();

      const rowHeight = 7;
      logs.forEach(l => {
        if (y + rowHeight > pageHeight - marginBottom) {
          doc.addPage();
          y = marginTop;
          renderTableHeader();
        }

        doc.setDrawColor(241, 245, 249);
        doc.rect(marginLeft, y, availableWidth, rowHeight, 'S');

        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(l.date, marginLeft + 3, y + 5);
        const conceptText = doc.splitTextToSize(l.concept, 82);
        doc.text(conceptText, marginLeft + 28, y + 5);
        doc.text(l.category, marginLeft + 115, y + 5);

        const isIncome = l.category === 'Ingresos';
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isIncome ? 16 : 220, isIncome ? 185 : 38, isIncome ? 129 : 38);
        doc.text(`${isIncome ? '+' : '-'}${formatCurrency(l.amount)}`, marginLeft + 160, y + 5);

        y += rowHeight;
      });

      doc.save(`SHARUI_Libro_Diario_Carta_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("Error generating ledger PDF:", err);
      alert("Hubo un detalle al exportar el libro diario en PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleConfirmExport = async () => {
    if (!exportFormat) return;

    if (exportFormat === 'excel') {
      const ws = XLSX.utils.json_to_sheet(logs.map(l => ({
        Fecha: l.date,
        Concepto: l.concept,
        Categoría: l.category,
        'Tipo de Movimiento': l.category === 'Ingresos' ? 'Ingreso (+)' : 'Egreso (-)',
        'Monto (Bs.)': l.amount
      })));
      // Page setup for vertical Letter printing with 2cm top and 1cm sides/bottom margins
      ws['!pageSetup'] = { orientation: 'portrait', paperSize: 1 };
      ws['!margins'] = { left: 0.394, right: 0.394, top: 0.787, bottom: 0.394, header: 0.2, footer: 0.2 };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Libro Diario SHARUI");
      XLSX.writeFile(wb, `SHARUI_Libro_Diario_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (exportFormat === 'image') {
      const input = document.getElementById('accounting-table-area');
      if (input) {
        const canvas = await html2canvas(input, { backgroundColor: '#0a0f1e', scale: 2 });
        const link = document.createElement('a');
        link.download = `SHARUI_Libro_Diario_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    }
    setExportFormat(null);
  };

  // Aggregated totals
  const totalInflow = logs.filter(l => l.category === 'Ingresos').reduce((acc, l) => acc + l.amount, 0);
  const totalOutflow = logs.filter(l => l.category !== 'Ingresos').reduce((acc, l) => acc + l.amount, 0);
  const currentBalance = totalInflow - totalOutflow;

  // Filtered logs
  const filteredLogs = logs.filter(l => {
    const matchesSearch = l.concept.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'TODAS' || l.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 pb-20">
      {/* Header and Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            Libro Diario & Contabilidad de Caja
          </h2>
          <p className="text-xs text-brand-text-dim mt-1">
            Registro diario de ingresos, gastos operativos, balance de caja y exportación
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportPDF}
            disabled={logs.length === 0 || isExportingPdf}
            className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
            title="Descargar Libro Diario en PDF Carta Vertical"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
          </button>
          <button
            onClick={() => setExportFormat('image')}
            disabled={logs.length === 0}
            className="px-4 py-2.5 bg-white/5 hover:bg-brand-accent/20 text-brand-text-dim hover:text-brand-accent border border-white/10 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Imagen</span>
          </button>
          <button
            onClick={() => setExportFormat('excel')}
            disabled={logs.length === 0}
            className="px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
            title="Descargar en Excel Carta Vertical"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Financial Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-brand-card p-5 rounded-3xl border border-white/5 shadow-2xl">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider">Entradas / Ingresos</span>
            <span className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(totalInflow)}</p>
          <p className="text-[9px] text-brand-text-dim/60 font-semibold mt-1">Cobros y capital registrado</p>
        </div>

        <div className="bg-brand-card p-5 rounded-3xl border border-white/5 shadow-2xl">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider">Salidas / Gastos</span>
            <span className="w-7 h-7 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-red-400 font-mono">-{formatCurrency(totalOutflow)}</p>
          <p className="text-[9px] text-brand-text-dim/60 font-semibold mt-1">Egresos operativos del negocio</p>
        </div>

        <div className="bg-brand-card p-5 rounded-3xl border border-white/5 shadow-2xl">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider">Saldo Disponible en Caja</span>
            <span className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className={`text-2xl font-black font-mono ${currentBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {formatCurrency(currentBalance)}
          </p>
          <p className="text-[9px] text-brand-text-dim/60 font-semibold mt-1">Liquidez neta en caja</p>
        </div>
      </div>

      {/* Accounting Entry Form */}
      <section className="bg-brand-card rounded-3xl border border-white/10 p-6 md:p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 rounded-l-3xl"></div>
        
        <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          {editingId ? 'Editar Movimiento Contable' : 'Asentar Nueva Operación en el Libro Diario'}
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Fecha Contable *
              </label>
              <button
                type="button"
                onClick={() => setDate(getLocalDateString())}
                className="text-[8px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded cursor-pointer"
                title="Calibrar a fecha actual de hoy"
              >
                ⚡ Hoy
              </button>
            </div>
            <input 
              type="date" 
              required
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none focus:border-emerald-500" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Monto (Bs.) *
            </label>
            <input 
              type="number" 
              step="0.01"
              required
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 font-mono text-xs font-bold text-emerald-400 outline-none focus:border-emerald-500" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-emerald-400" /> Categoría *
            </label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none cursor-pointer"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'Ingresos' ? '🟢 Ingresos (+)' : `🔴 ${cat} (-)`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-emerald-400" /> Glosa / Concepto *
            </label>
            <input 
              type="text" 
              required
              value={concept} 
              onChange={(e) => setConcept(e.target.value)}
              placeholder="¿Qué se pagó o ingresó?"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/5 text-xs font-bold text-white outline-none focus:border-emerald-500" 
            />
          </div>

          <div className="lg:col-span-4 mt-2 flex gap-3">
            <button 
              type="submit"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 py-4 rounded-xl font-black text-xs text-white uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              {editingId ? 'Actualizar Asiento' : 'Registrar en Libro Diario'}
            </button>
            {editingId && (
              <button 
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setAmount('');
                  setConcept('');
                }}
                className="px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-brand-text-dim font-black text-xs uppercase tracking-wider cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Filter and Category Selectors */}
      <div className="bg-brand-card p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-3 items-center justify-between">
        <input 
          type="text"
          placeholder="Buscar concepto o glosa en el libro..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full md:w-80 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white outline-none focus:border-emerald-500"
        />

        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {['TODAS', ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                categoryFilter === cat 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'bg-white/5 text-brand-text-dim hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Accounting Records Table */}
      <div id="accounting-table-area" className="bg-brand-card rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5 text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Concepto / Glosa</th>
                <th className="px-6 py-4">Categoría</th>
                <th className="px-6 py-4 text-right">Importe (Bs.)</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-brand-text-dim italic font-medium">
                    No se registran movimientos en el libro diario con los filtros aplicados.
                  </td>
                </tr>
              )}
              {filteredLogs.sort((a,b) => b.createdAt - a.createdAt).map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.015] transition-colors group">
                  <td className="px-6 py-4 text-xs whitespace-nowrap">
                    <span className="font-semibold text-white block">{formatDate(log.date)}</span>
                    <span className="text-[10px] text-brand-text-dim font-mono">{log.time || '12:00'}</span>
                  </td>

                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-white capitalize">{log.concept}</p>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider bg-white/5 text-slate-300 border border-white/10">
                      {log.category}
                    </span>
                  </td>

                  <td className={cn(
                    "px-6 py-4 text-right font-mono font-bold text-sm",
                    log.category === 'Ingresos' ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {log.category === 'Ingresos' ? `+` : `-`} {formatCurrency(log.amount)}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button 
                        onClick={() => handleEdit(log)}
                        className="p-2 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-xl transition-all cursor-pointer"
                        title="Editar asiento"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setLogToDelete(log)}
                        className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
                        title="Eliminar asiento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {logToDelete && (
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
                <h3 className="text-base font-black text-white uppercase">¿Eliminar Asiento?</h3>
                <p className="text-xs text-brand-text-dim mt-2">
                  Se eliminará permanentemente la operación <span className="text-white font-bold">"{logToDelete.concept}"</span> con importe de {formatCurrency(logToDelete.amount)}.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setLogToDelete(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black text-brand-text-dim uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteLog(logToDelete.id)}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-black text-white uppercase cursor-pointer"
                >
                  Sí, Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Confirmation Modal */}
      <AnimatePresence>
        {exportFormat && (
          <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-brand-card border border-white/10 p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-5 text-center relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                {exportFormat === 'excel' ? <FileSpreadsheet className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase">Exportar Libro Diario</h3>
                <p className="text-xs text-brand-text-dim mt-2">
                  Se generará y descargará el archivo en formato <span className="text-white font-bold">{exportFormat === 'excel' ? 'Excel (.xlsx)' : 'Imagen (.png)'}</span> con todos los {logs.length} asientos contables registrados.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black text-brand-text-dim uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmExport}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-xs font-black text-white uppercase cursor-pointer"
                >
                  Descargar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
