/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Printer, 
  Download, 
  Share2, 
  Building2, 
  FileText, 
  Calendar, 
  User, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  Clock,
  Sparkles,
  Receipt,
  FileCheck
} from 'lucide-react';
import { Invoice, StoreSettings } from '../types';
import { formatCurrency } from '../lib/utils';
import { StorageService } from '../lib/storage';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  storeSettings?: StoreSettings;
  onStatusChange?: (invoice: Invoice, newStatus: any) => Promise<void> | void;
}

export default function InvoiceModal({ invoice, onClose, storeSettings }: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  // Receipt format: 'letter' for Carta standard sheet, 'pos' for mini thermal ticket/POS printer
  const [receiptFormat, setReceiptFormat] = useState<'letter' | 'pos'>('letter');

  // Retrieve current store settings or fallback
  const currentSettings = storeSettings || StorageService.getStoreSettings();

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    setIsExporting(true);
    try {
      const element = invoiceRef.current;
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      if (receiptFormat === 'letter') {
        // Carta vertical: 215.9 x 279.4 mm
        // Margen superior: 20 mm (2 cm), márgenes laterales e inferior: 10 mm (1 cm)
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'letter',
        });

        const imgWidth = 195.9; // 215.9 - 10 - 10
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 10, 20, imgWidth, imgHeight);
        pdf.save(`Nota_de_Venta_${invoice.invoiceNumber}.pdf`);
      } else {
        // Ticket POS: 80 mm de ancho térmico
        const rollWidth = 80;
        const rollHeight = Math.max(130, (canvas.height * 76) / canvas.width + 10);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [rollWidth, rollHeight],
        });
        pdf.addImage(imgData, 'PNG', 2, 4, 76, (canvas.height * 76) / canvas.width);
        pdf.save(`Ticket_POS_${invoice.invoiceNumber}.pdf`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Hubo un problema al generar el PDF. Puedes usar la opción de Imprimir.');
    } finally {
      setIsExporting(false);
    }
  };

  // Client info automated fallbacks:
  // "si no registré nombre o sin numero de celular colocar ' S/N '; ciudad sí o si Cochabamba"
  const clientNameDisplay = (invoice.clientName && invoice.clientName.trim() && invoice.clientName.trim().toLowerCase() !== 'cliente mostrador') 
    ? invoice.clientName.trim() 
    : 'S/N';

  const clientPhoneDisplay = (invoice.clientPhone && invoice.clientPhone.trim() && invoice.clientPhone.replace(/\D/g, '') !== '77000000') 
    ? invoice.clientPhone.trim() 
    : 'S/N';

  // Items automated description:
  // "no poner la marca dos veces; no poner la categoría (trekking, casual, etc.); marcar solo codigo-subcodigo, talla (solo el numero en negritas)"
  const cleanedItems = invoice.items.map(item => {
    let cleanDesc = item.description || '';
    // Strip brand and categories from description if included
    cleanDesc = cleanDesc
      .replace(/^(KNUP|SHARQ|MATT MILL|NIKE|PUMA|ADIDAS|NEW BALANCE|BUSS|LACOSTE|I-RUN|AMIRI|VANS|Otros|Calzado Ref\.|Calzado Código)\s*/gi, '')
      .replace(/\b(casual|deportivo|running|trekking|urbano|clásico)\b/gi, '')
      .replace(/[\(\)]/g, '')
      .trim();

    if (!cleanDesc) {
      cleanDesc = item.size ? `Calzado ${item.size}` : 'Calzado';
    }

    // Clean talla: only number, no 'T'
    const cleanSize = (item.size || '').replace(/^T/i, '').trim();

    return {
      ...item,
      cleanDescription: cleanDesc,
      cleanSize
    };
  });

  // Real QR Code Content
  const qrTextSummary = `TIENDA: ${currentSettings.storeName} | NOTA DE VENTA: ${invoice.invoiceNumber} | FECHA: ${invoice.date} ${invoice.time || ''} | CIUDAD: Cochabamba | CLIENTE: ${clientNameDisplay} | TOTAL: Bs. ${invoice.total}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrTextSummary)}`;

  const handleShareWhatsApp = () => {
    const phoneToUse = clientPhoneDisplay !== 'S/N' ? clientPhoneDisplay.replace(/\D/g, '') : '';
    const itemsSummary = cleanedItems
      .map(it => `• ${it.quantity}x ${it.cleanDescription} [Talla: *${it.cleanSize}*] = ${formatCurrency(it.total)}`)
      .join('%0A');

    const message = 
      `*${currentSettings.storeName.toUpperCase()} - NOTA DE VENTA*%0A` +
      `_${currentSettings.slogan}_%0A%0A` +
      `📄 *Nota de Venta N°:* ${invoice.invoiceNumber}%0A` +
      `📅 *Fecha y Hora:* ${invoice.date} ${invoice.time || ''}%0A` +
      `🏙️ *Ciudad:* Cochabamba, Bolivia%0A` +
      `👤 *Cliente:* ${clientNameDisplay}%0A` +
      `💳 *Forma de Pago:* ${invoice.paymentMethod}%0A%0A` +
      `*DETALLE DE CALZADO:*%0A${itemsSummary}%0A%0A` +
      `*TOTAL A CANCELAR:* *${formatCurrency(invoice.total)}*%0A%0A` +
      `_Garantía de 3 días para cambio por motivo de horma incorrecta. Si el producto presenta algún uso, desgaste o daño la garantía se elimina._%0A%0A` +
      `_Emitido a través del sistema SHARUI Business Intelligence_`;

    if (phoneToUse) {
      const phoneWithCode = phoneToUse.startsWith('591') ? phoneToUse : `591${phoneToUse}`;
      window.open(`https://wa.me/${phoneWithCode}?text=${message}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  return (
    <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]"
      >
        {/* Top Control Bar */}
        <div className="p-4 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 bg-[#0e1015]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                Nota de Venta
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {invoice.status === 'Emitida' && invoice.advancePayment ? 'Reserva' : 'Recibo Comercial'}
                </span>
              </h3>
              <p className="text-[10px] text-neutral-400 font-bold">{invoice.invoiceNumber}</p>
            </div>
          </div>

          {/* Format Switcher (Carta vs Ticket POS pequeño) */}
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            <button
              type="button"
              onClick={() => setReceiptFormat('letter')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                receiptFormat === 'letter'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Formato Carta estándar (vertical con 2cm de margen superior y 1cm lateral)"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Carta</span>
            </button>
            <button
              type="button"
              onClick={() => setReceiptFormat('pos')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                receiptFormat === 'pos'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Formato Ticket / POS Térmico (adaptable a impresoras térmicas de 58mm y 80mm)"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Ticket POS</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShareWhatsApp}
              title="Compartir por WhatsApp"
              className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            {/* White Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              title="Descargar PDF"
              className="p-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black border border-white transition-all flex items-center gap-1.5 text-xs font-black disabled:opacity-50 cursor-pointer shadow-lg"
            >
              <Download className="w-4 h-4 text-black" />
              <span className="hidden sm:inline">{isExporting ? 'Generando...' : 'Descargar PDF'}</span>
            </button>
            <button
              onClick={handlePrint}
              title="Imprimir (se ajusta automáticamente al papel o impresora POS)"
              className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic @page and media print styles matching selected format */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              ${receiptFormat === 'letter' 
                ? 'size: letter portrait; margin-top: 20mm; margin-bottom: 10mm; margin-left: 10mm; margin-right: 10mm;' 
                : 'size: auto; margin: 2mm;'
              }
            }
            #printable-receipt-container {
              width: 100% !important;
              max-width: 100% !important;
              padding: ${receiptFormat === 'letter' ? '0' : '2mm'} !important;
              margin: 0 auto !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}} />

        {/* Printable Document Area */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 bg-slate-950/60 flex justify-center">
          <div 
            id="printable-receipt-container"
            ref={invoiceRef}
            className={`bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 font-sans selection:bg-blue-100 ${
              receiptFormat === 'letter' 
                ? 'p-6 md:p-8 max-w-xl w-full text-xs' 
                : 'p-4 max-w-[340px] w-full text-[11px] leading-tight'
            }`}
          >
            {/* ============================================================== */}
            {/* FORMATO 1: HOJA CARTA ESTÁNDAR (CON MÁRGENES 2CM SUP / 1CM LAT) */}
            {/* ============================================================== */}
            {receiptFormat === 'letter' ? (
              <div>
                {/* Header: Store details from settings, Cochabamba, No NIT, No Autorización */}
                <div className="flex justify-between items-start pb-5 border-b-2 border-slate-900 gap-4">
                  <div className="flex items-start gap-3">
                    {currentSettings.logo ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shrink-0">
                        <img src={currentSettings.logo} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0">
                        SH
                      </div>
                    )}
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
                        {currentSettings.storeName}
                      </h1>
                      <p className="text-[10px] font-bold text-slate-600 mt-1 italic">
                        "{currentSettings.slogan}"
                      </p>
                      <p className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-red-500 inline" />
                        <span>{currentSettings.address} • Cochabamba, Bolivia</span>
                      </p>
                      <p className="text-[10px] text-slate-600 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600 inline" />
                        <span>WhatsApp / Celular: (+591) {currentSettings.whatsapp || currentSettings.phone}</span>
                      </p>
                    </div>
                  </div>

                  {/* Document Number and Date/Time */}
                  <div className="text-right shrink-0">
                    <div className="bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-300">
                      <p className="text-[8px] uppercase font-black text-slate-500 tracking-wider">
                        Nota de Venta N°
                      </p>
                      <p className="text-sm font-black text-slate-900 font-mono">
                        {invoice.invoiceNumber}
                      </p>
                    </div>
                    <div className="mt-1.5 text-[9px] text-slate-600 space-y-0.5 font-medium">
                      <p><span className="font-bold">Fecha:</span> {invoice.date}</p>
                      <p><span className="font-bold">Hora:</span> {invoice.time || '12:00'}</p>
                      <p><span className="font-bold">Ciudad:</span> Cochabamba</p>
                    </div>
                  </div>
                </div>

                {/* Client Data Box (Automated S/N if empty) */}
                <div className="my-5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-0.5">DATOS DEL CLIENTE</p>
                    <p className="font-black text-slate-900 text-sm">
                      {clientNameDisplay}
                    </p>
                    <p className="text-slate-600 text-[10px] mt-0.5">
                      <span className="font-bold">Teléfono / WhatsApp:</span> {clientPhoneDisplay}
                    </p>
                    <p className="text-slate-600 text-[10px]">
                      <span className="font-bold">Ciudad:</span> Cochabamba
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-0.5">DETALLES DE PAGO</p>
                    <p className="text-slate-800 font-bold">
                      <span className="text-[10px] text-slate-500 font-normal">Forma de Pago: </span>
                      {invoice.paymentMethod}
                    </p>
                    <p className="text-slate-800 font-bold">
                      <span className="text-[10px] text-slate-500 font-normal">Estado: </span>
                      <span className="text-emerald-700 font-black uppercase">
                        {invoice.advancePayment && invoice.remainingBalance && invoice.remainingBalance > 0 
                          ? 'RESERVA (CON ANTICIPO)' 
                          : 'VENTA PAGADA'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Products Table */}
                <div className="overflow-hidden border border-slate-200 rounded-xl mb-5">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[9px] font-black uppercase border-b border-slate-200">
                        <th className="py-2 px-3 w-10 text-center">Cant.</th>
                        <th className="py-2 px-3">Código y Sub-Código</th>
                        <th className="py-2 px-3 text-center w-14">Talla</th>
                        <th className="py-2 px-3 text-right w-20">Precio</th>
                        <th className="py-2 px-3 text-right w-20">Descuento</th>
                        <th className="py-2 px-3 text-right w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {cleanedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-bold text-slate-800 text-center">{item.quantity}</td>
                          <td className="py-2 px-3 font-bold text-slate-900 font-mono tracking-wide">
                            {item.cleanDescription}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <strong className="text-sm font-black text-slate-900 font-mono">
                              {item.cleanSize || '-'}
                            </strong>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-slate-700">
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-emerald-600">
                            {invoice.discount && invoice.discount > 0 ? `-${formatCurrency(invoice.discount)}` : 'Bs. 0.00'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-black text-slate-900">
                            {formatCurrency(item.total - (invoice.discount || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Section: QR + Totals */}
                <div className="flex justify-between items-start gap-4 pt-1">
                  <div className="w-1/2 flex items-center gap-3">
                    <div className="w-20 h-20 bg-white rounded-xl border border-slate-300 p-1 flex items-center justify-center shrink-0 shadow-sm">
                      <img 
                        src={qrCodeUrl} 
                        alt="Código QR de Verificación" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-800 uppercase tracking-tight">
                        CÓDIGO QR DE COMPRA
                      </p>
                      <p className="text-[8px] text-slate-500 leading-tight mt-0.5">
                        Escanea para verificar la autenticidad y detalles del recibo.
                      </p>
                      <p className="text-[7.5px] text-emerald-700 font-bold flex items-center gap-1 mt-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Registro Verificado</span>
                      </p>
                    </div>
                  </div>

                  <div className="w-5/12 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span>Subtotal:</span>
                      <span className="font-mono font-semibold">{formatCurrency(invoice.subtotal)}</span>
                    </div>

                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-emerald-600 text-[10px]">
                        <span>Descuento:</span>
                        <span className="font-mono font-semibold">-{formatCurrency(invoice.discount)}</span>
                      </div>
                    )}

                    {invoice.advancePayment !== undefined && invoice.remainingBalance !== undefined && invoice.remainingBalance > 0 && (
                      <>
                        <div className="flex justify-between text-amber-600 text-[10px] font-bold">
                          <span>Anticipo Pagado:</span>
                          <span className="font-mono">{formatCurrency(invoice.advancePayment)}</span>
                        </div>
                        <div className="flex justify-between text-red-600 text-[10px] font-bold">
                          <span>Saldo Pendiente:</span>
                          <span className="font-mono">{formatCurrency(invoice.remainingBalance)}</span>
                        </div>
                      </>
                    )}

                    <div className="border-t-2 border-slate-300 pt-1.5 flex justify-between items-baseline">
                      <span className="text-xs font-black text-slate-900 uppercase">Total:</span>
                      <span className="text-base font-black text-slate-900 font-mono">
                        {formatCurrency(invoice.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Legal Warranty & Footer */}
                <div className="mt-6 pt-3 border-t border-slate-200 text-center space-y-1">
                  <p className="text-[9px] font-black text-slate-800 uppercase tracking-tight">
                    Garantía de 3 días para cambio por motivo de horma incorrecta.
                  </p>
                  <p className="text-[8px] text-slate-500 font-medium">
                    Si el producto presenta algún uso, desgaste o daño la garantía se elimina.
                  </p>
                  <p className="text-[7.5px] text-slate-400 font-mono pt-1">
                    Emitido a través del sistema SHARUI Business Intelligence
                  </p>
                </div>
              </div>
            ) : (
              /* ============================================================== */
              /* FORMATO 2: TICKET POS TÉRMICO (DISPOSITIVOS PEQUEÑOS 58mm/80mm) */
              /* ============================================================== */
              <div className="text-center space-y-2">
                {currentSettings.logo && (
                  <div className="w-10 h-10 mx-auto rounded-lg overflow-hidden border border-slate-300 mb-1">
                    <img src={currentSettings.logo} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  {currentSettings.storeName}
                </h2>
                <p className="text-[9px] italic text-slate-600">
                  "{currentSettings.slogan}"
                </p>
                <p className="text-[9px] text-slate-600">
                  {currentSettings.address}
                </p>
                <p className="text-[9px] font-bold text-slate-700">
                  Cochabamba • Tel/WhatsApp: {currentSettings.whatsapp || currentSettings.phone}
                </p>

                <div className="border-t border-b border-dashed border-slate-400 py-1.5 my-2 text-left text-[10px] space-y-0.5">
                  <p><span className="font-bold">NOTA DE VENTA:</span> {invoice.invoiceNumber}</p>
                  <p><span className="font-bold">FECHA:</span> {invoice.date} {invoice.time || '12:00'}</p>
                  <p><span className="font-bold">CLIENTE:</span> {clientNameDisplay}</p>
                  <p><span className="font-bold">TELÉFONO:</span> {clientPhoneDisplay}</p>
                  <p><span className="font-bold">CIUDAD:</span> Cochabamba</p>
                  <p><span className="font-bold">PAGO:</span> {invoice.paymentMethod}</p>
                </div>

                {/* Items Compact */}
                <div className="text-left text-[10px] space-y-1.5 my-2">
                  <div className="flex justify-between font-bold border-b border-slate-300 pb-0.5 text-[9px] uppercase">
                    <span>CANT / CÓDIGO</span>
                    <span>TALLA</span>
                    <span>TOTAL</span>
                  </div>
                  {cleanedItems.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{item.quantity}x {item.cleanDescription}</span>
                        <span className="font-black">Talla: {item.cleanSize}</span>
                        <span>{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-slate-400 pt-1.5 space-y-0.5 text-right text-[10px]">
                  <p className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                  </p>
                  {invoice.discount > 0 && (
                    <p className="flex justify-between text-emerald-700 font-bold">
                      <span>Descuento:</span>
                      <span>-{formatCurrency(invoice.discount)}</span>
                    </p>
                  )}
                  {invoice.advancePayment !== undefined && invoice.remainingBalance !== undefined && invoice.remainingBalance > 0 && (
                    <>
                      <p className="flex justify-between text-amber-700 font-bold">
                        <span>Anticipo Pagado:</span>
                        <span>{formatCurrency(invoice.advancePayment)}</span>
                      </p>
                      <p className="flex justify-between text-red-600 font-bold">
                        <span>Saldo Pendiente:</span>
                        <span>{formatCurrency(invoice.remainingBalance)}</span>
                      </p>
                    </>
                  )}
                  <p className="flex justify-between text-xs font-black text-slate-900 pt-1 border-t border-slate-300">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </p>
                </div>

                {/* Real Centered QR */}
                <div className="pt-2 flex flex-col items-center justify-center">
                  <div className="w-24 h-24 bg-white p-1 border border-slate-300 rounded-lg">
                    <img src={qrCodeUrl} alt="QR" className="w-full h-full object-contain" />
                  </div>
                  <p className="text-[7.5px] text-slate-500 uppercase font-bold mt-1">
                    CÓDIGO QR DE COMPRA
                  </p>
                </div>

                {/* Warranty */}
                <div className="pt-2 border-t border-dashed border-slate-400 text-[8px] text-slate-600 space-y-0.5">
                  <p className="font-bold">Garantía de 3 días para cambio por motivo de horma incorrecta.</p>
                  <p>Si el producto presenta algún uso, desgaste o daño la garantía se elimina.</p>
                  <p className="text-[7px] text-slate-400 pt-0.5 font-mono">
                    Emitido a través del sistema SHARUI Business Intelligence
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
