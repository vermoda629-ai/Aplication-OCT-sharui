/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  Package, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  FileSpreadsheet, 
  ShoppingBag, 
  Sparkles, 
  Award, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck,
  Zap,
  Tag,
  Phone,
  MapPin,
  Flame,
  CalendarDays,
  Download,
  Printer,
  Lock,
  Unlock,
  Key,
  Shield,
  History,
  Search,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Save,
  Check
} from 'lucide-react';
import { Product, DailyLogEntry, Sale, Invoice, CustomerTier, AppMovementLog, MovementType } from '../types';
import { formatCurrency, formatDate, formatTime, getCustomerTier, getCustomerFollowUpAlert, getDayOfWeekName, getDiffDaysFromNow, cn } from '../lib/utils';
import { StorageService } from '../lib/storage';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

interface ReportsPanelSectionProps {
  products: Product[];
  logs: DailyLogEntry[];
  sales: Sale[];
  invoices: Invoice[];
  currentTime: Date;
  onNavigateToSection: (sectionKey: any) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];

export default function ReportsPanelSection({
  products,
  logs,
  sales,
  invoices,
  currentTime,
  onNavigateToSection
}: ReportsPanelSectionProps) {
  const [activeReportTab, setActiveReportTab] = useState<'TODOS' | 'STOCK' | 'CLIENTES' | 'FINANCIERO' | 'ESTADISTICAS' | 'AUDITORIA'>('TODOS');

  // Security & 4-Digit PIN State for Movement Audit
  const [isAuditUnlocked, setIsAuditUnlocked] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'TODOS' | MovementType>('TODOS');
  const [movementsUpdateKey, setMovementsUpdateKey] = useState(0);

  // Load audit movements with automatic 5-day expiration enforcement
  const rawMovements = React.useMemo(() => {
    return StorageService.getMovements();
  }, [movementsUpdateKey, products, sales, logs]);

  const handleVerifyPin = (pinToTest?: string) => {
    const pin = pinToTest !== undefined ? pinToTest : enteredPin;
    const actualPin = StorageService.getSecurityPin();
    if (pin.trim() === actualPin.trim()) {
      setIsAuditUnlocked(true);
      setPinError('');
      setEnteredPin('');
    } else {
      setPinError('Contraseña de 4 dígitos incorrecta. Intente de nuevo.');
      setEnteredPin('');
    }
  };

  const handleKeypadPress = (val: string) => {
    setPinError('');
    if (val === 'C') {
      setEnteredPin('');
      return;
    }
    if (val === 'BACK') {
      setEnteredPin(prev => prev.slice(0, -1));
      return;
    }
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + val;
      setEnteredPin(nextPin);
      if (nextPin.length === 4) {
        handleVerifyPin(nextPin);
      }
    }
  };

  const handleSaveNewPin = () => {
    if (!/^\d{4}$/.test(newPinInput)) {
      setPinError('La contraseña debe tener exactamente 4 dígitos numéricos.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinError('Las contraseñas no coinciden. Verifíquelas.');
      return;
    }
    StorageService.setSecurityPin(newPinInput);
    setPinChangeSuccess('¡Contraseña de 4 dígitos actualizada con éxito!');
    setPinError('');
    setTimeout(() => {
      setIsChangingPin(false);
      setNewPinInput('');
      setConfirmPinInput('');
      setPinChangeSuccess('');
    }, 1800);
  };

  const filteredMovements = rawMovements.filter(m => {
    const matchesType = movementTypeFilter === 'TODOS' || m.type === movementTypeFilter;
    const q = movementSearch.toLowerCase().trim();
    const matchesSearch = 
      m.title.toLowerCase().includes(q) ||
      m.details.toLowerCase().includes(q) ||
      m.date.toLowerCase().includes(q) ||
      (m.author && m.author.toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  const handleExportMovementsPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    const pageWidth = 215.9;
    const pageHeight = 279.4;
    const marginLeft = 10;
    const marginRight = 10;
    const marginTop = 15;
    const marginBottom = 10;
    const availableWidth = pageWidth - marginLeft - marginRight;
    let y = marginTop;

    const renderHeader = (pageNumber: number) => {
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(marginLeft, y, availableWidth, 11, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('SHARUI ENTERPRISE - REGISTRO DE MOVIMIENTOS Y AUDITORÍA', marginLeft + 4, y + 7.2);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Página ${pageNumber} • Historial 5 Días • ${new Date().toLocaleDateString()}`, pageWidth - marginRight - 65, y + 7.2);
      y += 14;

      doc.setFillColor(241, 245, 249);
      doc.rect(marginLeft, y, availableWidth, 6, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(marginLeft, y, availableWidth, 6, 'S');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(7.2);
      doc.setFont('helvetica', 'bold');
      doc.text('FECHA Y HORA', marginLeft + 2, y + 4.2);
      doc.text('TIPO', marginLeft + 34, y + 4.2);
      doc.text('MOVIMIENTO / ACCIÓN', marginLeft + 68, y + 4.2);
      doc.text('DETALLES', marginLeft + 124, y + 4.2);
      y += 6.5;
    };

    let currentPage = 1;
    renderHeader(currentPage);

    const rowH = 13.5;
    for (let i = 0; i < filteredMovements.length; i++) {
      const mov = filteredMovements[i];
      if (y + rowH > pageHeight - marginBottom) {
        doc.addPage();
        currentPage++;
        y = marginTop;
        renderHeader(currentPage);
      }

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(marginLeft, y + rowH, marginLeft + availableWidth, y + rowH);

      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`${mov.date}\n${mov.time}`, marginLeft + 2, y + 4.8);

      doc.setFontSize(6.5);
      doc.setTextColor(59, 130, 246);
      doc.text(mov.type.replace('_', ' '), marginLeft + 34, y + 6);

      doc.setFontSize(7.0);
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(mov.title, 52);
      doc.text(titleLines, marginLeft + 68, y + 5);

      doc.setFontSize(6.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const detailLines = doc.splitTextToSize(mov.details, 68);
      doc.text(detailLines, marginLeft + 124, y + 5);

      y += rowH;
    }

    doc.save(`SHARUI_Registro_Movimientos_5Dias_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleExportMovementsExcel = () => {
    const data = filteredMovements.map(m => ({
      'FECHA': m.date,
      'HORA': m.time,
      'TIPO': m.type,
      'ACCIÓN / REGISTRO': m.title,
      'DETALLES': m.details,
      'USUARIO': m.author || 'Usuario'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos_5_Dias");
    XLSX.writeFile(wb, `SHARUI_Registro_Movimientos_5Dias_${new Date().toISOString().split('T')[0]}.xlsx`);
  };


  // ==========================================
  // 1. INFORME DE STOCK & ALERTAS
  // ==========================================
  const totalRegisteredUnits = products.reduce((acc, p) => acc + p.sizes.length, 0);
  const totalPurchasedUnits = sales.filter(s => s.status === 'Compra').length;
  const currentAvailableStockUnits = Math.max(0, totalRegisteredUnits - totalPurchasedUnits);

  // Low stock alerts: Models or variants with <= 2 units remaining or out of stock
  interface StockAlertItem {
    productId: string;
    code: string;
    variantCode: string;
    name: string;
    brand: string;
    color: string;
    image: string;
    totalStock: number;
    soldCount: number;
    remainingStock: number;
    isCritical: boolean;
  }

  const stockAlerts: StockAlertItem[] = [];

  products.forEach(p => {
    const variants = p.variants && p.variants.length > 0 ? p.variants : [
      {
        id: 'var-1',
        colorName: 'Principal',
        subCode: '',
        fullCode: p.code,
        image: p.image,
        sizes: p.sizes
      }
    ];

    variants.forEach(v => {
      const codeMatch = v.fullCode || p.code;
      const sold = sales.filter(s => 
        (s.productCode.toLowerCase() === p.code.toLowerCase() || 
         s.productCode.toLowerCase() === codeMatch.toLowerCase()) && 
        s.status === 'Compra'
      ).length;

      const remaining = Math.max(0, v.sizes.length - sold);
      if (remaining <= 2) {
        stockAlerts.push({
          productId: p.id,
          code: p.code,
          variantCode: codeMatch,
          name: p.name,
          brand: p.brand,
          color: v.colorName || 'Estándar',
          image: v.image || p.image,
          totalStock: v.sizes.length,
          soldCount: sold,
          remainingStock: remaining,
          isCritical: remaining === 0
        });
      }
    });
  });

  // ==========================================
  // 2. INFORME DE CLIENTES & SEGUIMIENTO
  // ==========================================
  const customerMap = new Map<string, {
    name: string;
    whatsapp: string;
    city: string;
    pairsBought: number;
    lastPurchaseDate: string;
    lastPurchaseTime?: string;
    tier: CustomerTier;
    followUpAlert: string;
  }>();

  sales.forEach(sale => {
    const cleanPhone = sale.whatsapp.replace(/\D/g, '') || 'sin-numero';
    const key = `${sale.clientName.trim().toLowerCase()}_${cleanPhone}`;

    if (!customerMap.has(key)) {
      customerMap.set(key, {
        name: sale.clientName.trim(),
        whatsapp: sale.whatsapp.trim(),
        city: sale.city.trim() || 'La Paz',
        pairsBought: sale.status === 'Compra' ? 1 : 0,
        lastPurchaseDate: sale.date,
        lastPurchaseTime: sale.time,
        tier: 'Casual',
        followUpAlert: ''
      });
    } else {
      const item = customerMap.get(key)!;
      if (sale.status === 'Compra') {
        item.pairsBought += 1;
      }
      if (sale.date >= item.lastPurchaseDate) {
        item.lastPurchaseDate = sale.date;
        item.lastPurchaseTime = sale.time;
      }
      customerMap.set(key, item);
    }
  });

  const allClientsList = Array.from(customerMap.values()).map(c => {
    const tier = getCustomerTier(c.pairsBought);
    const { alert } = getCustomerFollowUpAlert(tier);
    return {
      ...c,
      tier,
      followUpAlert: alert
    };
  });

  const totalClientsCount = allClientsList.length;
  // Potential clients: registered in inquiries or reservations without final purchase
  const potentialClientsCount = allClientsList.filter(c => c.pairsBought === 0).length;

  // ==========================================
  // 3. INFORME FINANCIERO CONSOLIDADO
  // ==========================================
  // Ingresos Generales: Ventas realizadas + Entradas del libro diario
  const salesRevenue = sales.filter(s => s.status === 'Compra').reduce((acc, s) => acc + s.price, 0);
  const accountingIncomes = logs.filter(l => l.category === 'Ingresos').reduce((acc, l) => acc + l.amount, 0);
  const generalIncome = salesRevenue + accountingIncomes;

  // Egresos Generales: Gastos operativos del libro diario + Costos de nuevo stock registrado
  const operationalExpenses = logs.filter(l => l.category !== 'Ingresos').reduce((acc, l) => acc + l.amount, 0);
  const stockAcquisitionCosts = products.reduce((acc, p) => acc + (p.totalCost || ((p.unitCost || 0) * p.sizes.length)), 0);
  const generalExpenses = operationalExpenses + stockAcquisitionCosts;

  const consolidatedNetBalance = generalIncome - generalExpenses;
  const consolidatedMargin = generalIncome > 0 ? (consolidatedNetBalance / generalIncome) * 100 : 0;

  // ==========================================
  // 4. INFORME ESTADÍSTICO DE MOVIMIENTOS
  // ==========================================
  // A) Qué modelo salió más (Top Modelo)
  const modelFrequency: Record<string, { code: string; brand: string; count: number; revenue: number }> = {};
  sales.filter(s => s.status === 'Compra').forEach(s => {
    const c = s.productCode.toUpperCase();
    const prod = products.find(p => p.code.toUpperCase() === c || p.variants?.some(v => v.fullCode.toUpperCase() === c));
    if (!modelFrequency[c]) {
      modelFrequency[c] = {
        code: c,
        brand: prod?.brand || 'SHARUI',
        count: 0,
        revenue: 0
      };
    }
    modelFrequency[c].count += 1;
    modelFrequency[c].revenue += s.price;
  });

  const topModelsList = Object.values(modelFrequency).sort((a,b) => b.count - a.count);
  const topStarModel = topModelsList[0] || null;

  // B) Qué tallas más llevan (Size Frequency)
  const sizeFrequency: Record<string, number> = {};
  sales.filter(s => s.status === 'Compra').forEach(s => {
    const sz = `T${s.selectedSize}`;
    sizeFrequency[sz] = (sizeFrequency[sz] || 0) + 1;
  });

  const sizeChartData = Object.entries(sizeFrequency)
    .map(([size, count]) => ({ size, count }))
    .sort((a,b) => b.count - a.count)
    .slice(0, 8);

  // C) Qué días de la semana hay más movimiento (calibrado sin desfase UTC)
  const dayMovement: Record<string, number> = {
    'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0
  };

  sales.forEach(s => {
    try {
      const dayName = getDayOfWeekName(s.date);
      if (dayMovement[dayName] !== undefined) {
        dayMovement[dayName] += 1;
      }
    } catch {}
  });

  const dayMovementData = Object.entries(dayMovement).map(([dia, ventas]) => ({ dia, ventas }));

  // D) Cuántos clientes nuevos por semana, mes y año (calibrado)
  let newClientsThisWeek = 0;
  let newClientsThisMonth = 0;
  let newClientsThisYear = 0;

  allClientsList.forEach(c => {
    try {
      const diffDays = getDiffDaysFromNow(c.lastPurchaseDate);
      if (diffDays <= 7) newClientsThisWeek++;
      if (diffDays <= 30) newClientsThisMonth++;
      if (diffDays <= 365) newClientsThisYear++;
    } catch {}
  });

  // Export Executive Consolidated Report to Excel
  const handleExportConsolidatedReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Resumen General
    const summaryData = [
      { Métrica: 'Unidades de Stock Registradas', Valor: totalRegisteredUnits },
      { Métrica: 'Ventas Totales Realizadas', Valor: totalPurchasedUnits },
      { Métrica: 'Stock Disponible en Vitrina', Valor: currentAvailableStockUnits },
      { Métrica: 'Modelos con Alerta de Stock Bajo', Valor: stockAlerts.length },
      { Métrica: 'Ingresos Generales (Ventas + Libro Diario)', Valor: formatCurrency(generalIncome) },
      { Métrica: 'Egresos Generales (Gastos + Adquisición Stock)', Valor: formatCurrency(generalExpenses) },
      { Métrica: 'Resultado Financiero Neto', Valor: formatCurrency(consolidatedNetBalance) },
      { Métrica: 'Clientes Nuevos (Último Mes)', Valor: newClientsThisMonth },
      { Métrica: 'Modelo Más Vendido', Valor: topStarModel ? `${topStarModel.code} (${topStarModel.count} pares)` : 'N/A' },
    ];
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    // Page setup for vertical Letter printing with 2cm top and 1cm sides/bottom margins
    const pageSetup = { orientation: 'portrait', paperSize: 1 };
    const pageMargins = { left: 0.394, right: 0.394, top: 0.787, bottom: 0.394, header: 0.2, footer: 0.2 };
    
    ws1['!pageSetup'] = pageSetup;
    ws1['!margins'] = pageMargins;
    XLSX.utils.book_append_sheet(wb, ws1, "Resumen Ejecutivo");

    // Sheet 2: Stock bajo
    const ws2 = XLSX.utils.json_to_sheet(stockAlerts.map(a => ({
      'Código': a.variantCode,
      'Marca': a.brand,
      'Color': a.color,
      'Unidades Totales': a.totalStock,
      'Vendidos': a.soldCount,
      'Saldo Disponible': a.remainingStock,
      'Estado Alerta': a.isCritical ? 'AGOTADO CRÍTICO' : 'STOCK MUY BAJO (<= 2)'
    })));
    ws2['!pageSetup'] = pageSetup;
    ws2['!margins'] = pageMargins;
    XLSX.utils.book_append_sheet(wb, ws2, "Alertas Stock Bajo");

    // Sheet 3: Clientes y Seguimiento
    const ws3 = XLSX.utils.json_to_sheet(allClientsList.map(c => ({
      'Cliente': c.name,
      'WhatsApp': c.whatsapp,
      'Ciudad': c.city,
      'Pares Comprados': c.pairsBought,
      'Categoría': c.tier,
      'Última Fecha': c.lastPurchaseDate,
      'Acción de Seguimiento Recomendada': c.followUpAlert
    })));
    ws3['!pageSetup'] = pageSetup;
    ws3['!margins'] = pageMargins;
    XLSX.utils.book_append_sheet(wb, ws3, "Seguimiento Clientes");

    XLSX.writeFile(wb, `SHARUI_Panel_Informes_Ejecutivo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export Executive Consolidated Report to PDF in VERTICAL LETTER (Carta Vertical, margen sup 2cm, laterales 1cm)
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportConsolidatedPDF = () => {
    setIsExportingPdf(true);
    try {
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
      doc.rect(marginLeft, marginTop, availableWidth, 16, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('SHARUI ENTERPRISE - INFORME EJECUTIVO CONSOLIDADO', marginLeft + 5, marginTop + 10.5);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Cochabamba • ${new Date().toLocaleDateString()}`, pageWidth - marginRight - 48, marginTop + 10.5);

      let y = marginTop + 22;

      // Section 1: Métricas Financieras y Stock
      doc.setFillColor(241, 245, 249);
      doc.rect(marginLeft, y, availableWidth, 7, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('1. RESUMEN FINANCIERO Y CONTROL DE STOCK', marginLeft + 3, y + 5);
      y += 10;

      const metrics = [
        { label: 'Unidades de Stock Registradas:', val: `${totalRegisteredUnits} pares` },
        { label: 'Ventas Totales Realizadas:', val: `${totalPurchasedUnits} pares` },
        { label: 'Stock Disponible en Vitrina:', val: `${currentAvailableStockUnits} pares` },
        { label: 'Modelos con Alerta de Stock Bajo:', val: `${stockAlerts.length} modelos` },
        { label: 'Ingresos Generales (Ventas + Libro):', val: formatCurrency(generalIncome) },
        { label: 'Egresos Generales (Gastos + Stock):', val: formatCurrency(generalExpenses) },
        { label: 'Resultado Financiero Neto:', val: formatCurrency(consolidatedNetBalance) },
        { label: 'Clientes Nuevos (Último Mes):', val: `${newClientsThisMonth} clientes` },
        { label: 'Modelo Más Vendido:', val: topStarModel ? `${topStarModel.code} (${topStarModel.count} pares)` : 'N/A' },
      ];

      doc.setFontSize(8);
      metrics.forEach((m, idx) => {
        const col = idx % 2;
        const x = marginLeft + col * (availableWidth / 2);
        if (col === 0 && idx > 0) y += 6;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(m.label, x + 3, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(m.val, x + 58, y);
      });

      y += 12;

      // Section 2: Alertas de Stock Bajo
      doc.setFillColor(241, 245, 249);
      doc.rect(marginLeft, y, availableWidth, 7, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('2. ALERTAS DE MODELOS CON STOCK CRÍTICO O BAJO (<= 2 PARES)', marginLeft + 3, y + 5);
      y += 10;

      doc.setFillColor(226, 232, 240);
      doc.rect(marginLeft, y, availableWidth, 6, 'F');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text('CÓDIGO', marginLeft + 3, y + 4.5);
      doc.text('MARCA', marginLeft + 35, y + 4.5);
      doc.text('COLOR', marginLeft + 65, y + 4.5);
      doc.text('TOTAL', marginLeft + 105, y + 4.5);
      doc.text('VENDIDOS', marginLeft + 125, y + 4.5);
      doc.text('DISPONIBLE', marginLeft + 152, y + 4.5);
      doc.text('ESTADO', marginLeft + 175, y + 4.5);
      y += 6;

      const topAlerts = stockAlerts.slice(0, 8);
      topAlerts.forEach(a => {
        doc.setDrawColor(241, 245, 249);
        doc.rect(marginLeft, y, availableWidth, 6, 'S');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text(a.variantCode, marginLeft + 3, y + 4.5);
        doc.text(a.brand, marginLeft + 35, y + 4.5);
        doc.text(a.color || 'Estándar', marginLeft + 65, y + 4.5);
        doc.text(String(a.totalStock), marginLeft + 108, y + 4.5);
        doc.text(String(a.soldCount), marginLeft + 128, y + 4.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(a.isCritical ? 220 : 217, a.isCritical ? 38 : 119, a.isCritical ? 38 : 6);
        doc.text(String(a.remainingStock), marginLeft + 155, y + 4.5);
        doc.text(a.isCritical ? 'AGOTADO' : 'BAJO', marginLeft + 175, y + 4.5);
        y += 6;
      });

      y += 8;

      // Section 3: Cartera de Clientes Destacados
      doc.setFillColor(241, 245, 249);
      doc.rect(marginLeft, y, availableWidth, 7, 'F');
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('3. CARTERA DE CLIENTES Y SEGUIMIENTO', marginLeft + 3, y + 5);
      y += 10;

      const topClients = allClientsList.slice(0, 6);
      topClients.forEach(c => {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`• ${c.name} (${c.city})`, marginLeft + 3, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);
        doc.text(`Categoría: ${c.tier} | Pares Comprados: ${c.pairsBought} | Seguimiento: ${c.followUpAlert}`, marginLeft + 50, y);
        y += 5.5;
      });

      doc.save(`SHARUI_Informe_Ejecutivo_Carta_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("Error generating executive PDF:", err);
      alert("Hubo un detalle al exportar el informe en PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Header and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center text-brand-accent">
              <BarChart3 className="w-5 h-5" />
            </div>
            Panel de Informes & Inteligencia de Negocio
          </h2>
          <p className="text-xs text-brand-text-dim mt-1">
            Resultados consolidados de stock, cartera de clientes, finanzas y estadísticas de movimiento
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportConsolidatedPDF}
            disabled={isExportingPdf}
            className="px-4 py-3 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50"
            title="Descargar Informe en PDF Carta Vertical"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
          </button>

          <button
            onClick={handleExportConsolidatedReport}
            className="px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            title="Descargar en Excel Carta Vertical"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Descargar Excel</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs for Reports */}
      <div className="flex items-center gap-1.5 bg-brand-card p-1.5 rounded-2xl border border-white/5 overflow-x-auto">
        {(['TODOS', 'STOCK', 'CLIENTES', 'FINANCIERO', 'ESTADISTICAS', 'AUDITORIA'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveReportTab(tab)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeReportTab === tab
                ? tab === 'AUDITORIA' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25' : 'bg-brand-accent text-white shadow-md'
                : 'text-brand-text-dim hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'TODOS' ? 'Informe Integral' : 
             tab === 'STOCK' ? '1. Stock & Alertas' : 
             tab === 'CLIENTES' ? '2. Clientes' : 
             tab === 'FINANCIERO' ? '3. Finanzas P&L' : 
             tab === 'ESTADISTICAS' ? '4. Estadísticas' : 
             (
               <>
                 <Lock className="w-3.5 h-3.5 text-amber-400" />
                 <span>5. Movimientos & Seguridad</span>
               </>
             )}
          </button>
        ))}
      </div>

      {/* =========================================================================
          INFORME 1: INFORME DE STOCK & AVISO SI SE ESTÁ QUEDANDO SIN STOCK
          ========================================================================= */}
      {(activeReportTab === 'TODOS' || activeReportTab === 'STOCK') && (
        <section className="bg-brand-card rounded-3xl border border-white/5 p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                INFORME N° 1
              </span>
              <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <Package className="w-5 h-5 text-blue-400" />
                Informe de Stock & Existencias
              </h3>
            </div>
            <span className="text-xs text-brand-text-dim font-bold">
              Actualizado: {currentTime.toLocaleTimeString()}
            </span>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-brand-text-dim uppercase">Unidades Registradas</span>
              <p className="text-2xl font-black text-white font-mono mt-1">{totalRegisteredUnits} uds</p>
              <p className="text-[8px] text-brand-text-dim mt-0.5">Total adquirido en lotes</p>
            </div>
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-brand-text-dim uppercase">Ventas Realizadas</span>
              <p className="text-2xl font-black text-emerald-400 font-mono mt-1">{totalPurchasedUnits} uds</p>
              <p className="text-[8px] text-emerald-400/80 mt-0.5">Calzados entregados</p>
            </div>
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-brand-text-dim uppercase">Saldo Disponible</span>
              <p className="text-2xl font-black text-blue-400 font-mono mt-1">{currentAvailableStockUnits} uds</p>
              <p className="text-[8px] text-brand-text-dim mt-0.5">Listas en inventario</p>
            </div>
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-amber-400 uppercase">Alertas de Stock Bajo</span>
              <p className="text-2xl font-black text-amber-400 font-mono mt-1">{stockAlerts.length} modelos</p>
              <p className="text-[8px] text-amber-400/80 mt-0.5">Requieren resurtido urgente</p>
            </div>
          </div>

          {/* AVISO SI UN MODELO SE ESTÁ QUEDANDO SIN STOCK */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Avisos de Reabastecimiento Crítico (Stock &le; 2 Unidades o Agotado):
            </h4>

            {stockAlerts.length === 0 ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-xs font-semibold text-emerald-300">
                  ¡Excelente! Todos los modelos y colores cuentan con suficiente stock en vitrina. No hay alertas críticas en este momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {stockAlerts.map((alert, i) => (
                  <div 
                    key={i}
                    className={`p-3.5 rounded-2xl border flex items-center gap-3 transition-all ${
                      alert.isCritical 
                        ? 'bg-red-500/10 border-red-500/30' 
                        : 'bg-amber-500/10 border-amber-500/30'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-slate-900">
                      <img src={alert.image} alt="" className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-white font-mono uppercase truncate">{alert.variantCode}</span>
                        <span className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase ${
                          alert.isCritical ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'
                        }`}>
                          {alert.isCritical ? 'AGOTADO' : 'QUEDAN 1-2'}
                        </span>
                      </div>
                      <p className="text-[10px] text-brand-text-dim truncate">{alert.brand} • {alert.color}</p>
                      <p className={`text-[10px] font-black font-mono mt-0.5 ${
                        alert.isCritical ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        Saldo Restante: {alert.remainingStock} de {alert.totalStock} uds
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          INFORME 2: INFORME DE CLIENTES & AVISO PARA SEGUIMIENTO
          ========================================================================= */}
      {(activeReportTab === 'TODOS' || activeReportTab === 'CLIENTES') && (
        <section className="bg-brand-card rounded-3xl border border-white/5 p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div>
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                INFORME N° 2
              </span>
              <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <Users className="w-5 h-5 text-purple-400" />
                Informe de Clientes & Avisos de Seguimiento por Categoría
              </h3>
            </div>
            <span className="text-xs text-purple-400 font-bold bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
              {totalClientsCount} Compradores Registrados
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-brand-text-dim uppercase">Clientes Efectivos</span>
              <p className="text-2xl font-black text-white font-mono mt-1">{totalClientsCount - potentialClientsCount}</p>
              <p className="text-[8px] text-brand-text-dim mt-0.5">Con al menos 1 compra final</p>
            </div>
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-brand-text-dim uppercase">Clientes Potenciales</span>
              <p className="text-2xl font-black text-amber-400 font-mono mt-1">{potentialClientsCount}</p>
              <p className="text-[8px] text-amber-400/80 mt-0.5">En reservas o consultas</p>
            </div>
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-purple-400 uppercase">Clientes VIP / Premium</span>
              <p className="text-2xl font-black text-purple-300 font-mono mt-1">
                {allClientsList.filter(c => c.tier === 'VIP' || c.tier === 'Premium').length}
              </p>
              <p className="text-[8px] text-purple-400/80 mt-0.5">Con 7 o más pares comprados</p>
            </div>
          </div>

          {/* Client follow up breakdown table */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Aviso & Estrategia de Seguimiento Según Categoría del Cliente:
            </h4>

            <div className="overflow-x-auto rounded-2xl border border-white/5">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-[9px] font-black text-brand-text-dim uppercase tracking-wider">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Ciudad</th>
                    <th className="px-4 py-3 text-center">Pares Llevados</th>
                    <th className="px-4 py-3">Rango</th>
                    <th className="px-4 py-3">Aviso de Seguimiento Recomendado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.02]">
                  {allClientsList.slice(0, 6).map((c, i) => (
                    <tr key={i} className="hover:bg-white/[0.015]">
                      <td className="px-4 py-3">
                        <p className="font-bold text-white uppercase">{c.name}</p>
                        <p className="text-[9px] text-emerald-400 font-mono">{c.whatsapp}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{c.city}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">{c.pairsBought} pares</td>
                      <td className="px-4 py-3">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/5 text-purple-300 border border-purple-500/20 uppercase">
                          {c.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-200 text-[11px] font-medium">
                        {c.followUpAlert}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          INFORME 3: INFORME FINANCIERO CONSOLIDADO (VENTAS + LIBRO DIARIO)
          ========================================================================= */}
      {(activeReportTab === 'TODOS' || activeReportTab === 'FINANCIERO') && (
        <section className="bg-brand-card rounded-3xl border border-white/5 p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                INFORME N° 3
              </span>
              <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Informe Financiero Consolidado
              </h3>
            </div>
            <span className="text-xs text-brand-text-dim">
              Balances en Bolivianos (Bs.)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ingresos Generales */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Ingresos Generales</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(generalIncome)}</p>
              <div className="text-[9px] text-brand-text-dim space-y-0.5 pt-1 border-t border-white/5">
                <p>• Ventas de Mercadería: <span className="text-white font-mono">{formatCurrency(salesRevenue)}</span></p>
                <p>• Entradas Libro Diario: <span className="text-white font-mono">{formatCurrency(accountingIncomes)}</span></p>
              </div>
            </div>

            {/* Egresos Generales */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">Egresos Generales</span>
                <ArrowDownRight className="w-4 h-4 text-red-400" />
              </div>
              <p className="text-2xl font-black text-red-400 font-mono">-{formatCurrency(generalExpenses)}</p>
              <div className="text-[9px] text-brand-text-dim space-y-0.5 pt-1 border-t border-white/5">
                <p>• Gastos Libro Diario: <span className="text-white font-mono">-{formatCurrency(operationalExpenses)}</span></p>
                <p>• Adquisición de Stock: <span className="text-white font-mono">-{formatCurrency(stockAcquisitionCosts)}</span></p>
              </div>
            </div>

            {/* Utilidad Neta Consolidada */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Balance Operativo Neto</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  consolidatedNetBalance >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {consolidatedMargin.toFixed(1)}% margen
                </span>
              </div>
              <p className={`text-2xl font-black font-mono ${
                consolidatedNetBalance >= 0 ? 'text-blue-400' : 'text-red-400'
              }`}>
                {formatCurrency(consolidatedNetBalance)}
              </p>
              <p className="text-[9px] text-brand-text-dim pt-1 border-t border-white/5">
                {consolidatedNetBalance >= 0 ? 'Superávit económico consolidado' : 'Requiere optimización de compras'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          INFORME 4: INFORME ESTADÍSTICO DE MOVIMIENTOS
          (Modelo que más salió, tallas más pedidas, días con más movimiento, nuevos clientes)
          ========================================================================= */}
      {(activeReportTab === 'TODOS' || activeReportTab === 'ESTADISTICAS') && (
        <section className="bg-brand-card rounded-3xl border border-white/5 p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div>
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                INFORME N° 4
              </span>
              <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Informe Estadístico de Movimientos & Tendencias
              </h3>
            </div>
            <span className="text-xs text-brand-text-dim">Patrones de Venta</span>
          </div>

          {/* 4 Cards: Top Model, Top Size, Best Day, New Clients Growth */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Modelo que más salió */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-amber-400 uppercase flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Modelo Estrella
              </span>
              <p className="text-xl font-black text-white font-mono mt-1 uppercase">
                {topStarModel ? topStarModel.code : 'Sin datos'}
              </p>
              <p className="text-[9px] text-brand-text-dim mt-0.5">
                {topStarModel ? `${topStarModel.count} pares vendidos (${formatCurrency(topStarModel.revenue)})` : 'Registra ventas para ver el líder'}
              </p>
            </div>

            {/* Tallas que más llevan */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-blue-400 uppercase flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" /> Talla Más Demandada
              </span>
              <p className="text-xl font-black text-blue-400 font-mono mt-1">
                {sizeChartData[0] ? `${sizeChartData[0].size}` : 'Sin datos'}
              </p>
              <p className="text-[9px] text-brand-text-dim mt-0.5">
                {sizeChartData[0] ? `${sizeChartData[0].count} pedidos en esta talla` : 'Aún no hay compras'}
              </p>
            </div>

            {/* Días con más movimiento */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-purple-400 uppercase flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> Día con Mayor Flujo
              </span>
              <p className="text-xl font-black text-white mt-1">
                {Object.entries(dayMovement).sort((a,b) => b[1] - a[1])[0]?.[0] || 'Lunes'}
              </p>
              <p className="text-[9px] text-brand-text-dim mt-0.5">
                Mayor concentración de compras de la semana
              </p>
            </div>

            {/* Nuevos Clientes por Semana / Mes / Año */}
            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
              <span className="text-[9px] font-black text-emerald-400 uppercase flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Crecimiento de Clientes
              </span>
              <div className="flex items-baseline justify-between mt-1 text-xs font-mono">
                <span>Semana: <strong className="text-white">{newClientsThisWeek}</strong></span>
                <span>Mes: <strong className="text-white">{newClientsThisMonth}</strong></span>
                <span>Año: <strong className="text-white">{newClientsThisYear}</strong></span>
              </div>
              <p className="text-[8px] text-brand-text-dim mt-1">Nuevos compradores captados</p>
            </div>
          </div>

          {/* Charts: Tallas Más Llevadas & Movimiento por Día */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Tallas más pedidas Chart */}
            <div className="bg-white/[0.015] p-5 rounded-2xl border border-white/5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-400" />
                Frecuencia de Tallas Vendidas
              </h4>
              <p className="text-[9px] text-brand-text-dim mb-4">Cantidad de pares vendidos por número de talla</p>

              <div className="h-[180px] w-full">
                {sizeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sizeChartData}>
                      <XAxis dataKey="size" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#151b2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Pares Vendidos" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-brand-text-dim italic">
                    Sin ventas registradas
                  </div>
                )}
              </div>
            </div>

            {/* Días de la semana con más movimiento */}
            <div className="bg-white/[0.015] p-5 rounded-2xl border border-white/5">
              <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-purple-400" />
                Ventas por Día de la Semana
              </h4>
              <p className="text-[9px] text-brand-text-dim mb-4">Días con mayor actividad comercial en el negocio</p>

              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayMovementData}>
                    <XAxis dataKey="dia" stroke="#64748b" fontSize={9} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#151b2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                    />
                    <Bar dataKey="ventas" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Operaciones" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          INFORME 5 / SISTEMA DE SEGURIDAD: REGISTRO DE MOVIMIENTOS & AUDITORÍA
          ========================================================================= */}
      {(activeReportTab === 'TODOS' || activeReportTab === 'AUDITORIA') && (
        <section className="bg-brand-card rounded-3xl border border-white/5 p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                SISTEMA DE SEGURIDAD & AUDITORÍA INTERNA
              </span>
              <h3 className="text-lg font-black text-white flex items-center gap-2 mt-0.5">
                <Shield className="w-5 h-5 text-amber-400" />
                Registro de Movimientos del Sistema
              </h3>
              <p className="text-xs text-brand-text-dim mt-0.5">
                Control estricto con contraseña de 4 dígitos para evitar que modifiquen o borren datos sin autorización.
              </p>
            </div>

            {isAuditUnlocked && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportMovementsPDF}
                  className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  title="Descargar registro de movimientos en PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PDF</span>
                </button>

                <button
                  onClick={handleExportMovementsExcel}
                  className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                  title="Descargar registro de movimientos en Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Descargar Excel</span>
                </button>

                <button
                  onClick={() => {
                    setIsChangingPin(!isChangingPin);
                    setPinError('');
                    setPinChangeSuccess('');
                  }}
                  className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isChangingPin ? 'Cerrar Cambio PIN' : 'Cambiar PIN'}</span>
                </button>

                <button
                  onClick={() => setIsAuditUnlocked(false)}
                  className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white border border-amber-500/30 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Bloquear</span>
                </button>
              </div>
            )}
          </div>

          {!isAuditUnlocked ? (
            /* BLOQUE PROTEGIDO: ACCESO CON CONTRASEÑA DE 4 DÍGITOS */
            <div className="max-w-md mx-auto py-8 px-6 bg-slate-950/80 rounded-3xl border border-amber-500/30 shadow-2xl text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
                <Lock className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-black text-white">Área Protegida por Contraseña</h4>
                <p className="text-xs text-brand-text-dim mt-1.5">
                  Ingresa tu PIN de 4 dígitos para ver el registro completo de ingresos de stock, ventas, ediciones y eliminaciones.
                </p>
              </div>

              {/* Indicador visual de 4 dígitos */}
              <div className="flex items-center justify-center gap-3 py-2">
                {[0, 1, 2, 3].map(idx => {
                  const hasDigit = enteredPin.length > idx;
                  return (
                    <div 
                      key={idx}
                      className={cn(
                        "w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-xl font-black transition-all",
                        hasDigit 
                          ? "border-amber-400 bg-amber-500/20 text-amber-300 scale-105 shadow-md shadow-amber-500/20" 
                          : "border-white/10 bg-slate-900 text-transparent"
                      )}
                    >
                      {hasDigit ? '●' : '○'}
                    </div>
                  );
                })}
              </div>

              {/* Error Feedback */}
              {pinError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              {/* Input físico directo */}
              <div className="relative">
                <input
                  type="password"
                  maxLength={4}
                  value={enteredPin}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setEnteredPin(clean);
                    setPinError('');
                    if (clean.length === 4) {
                      handleVerifyPin(clean);
                    }
                  }}
                  placeholder="Escribe aquí los 4 dígitos..."
                  className="w-full text-center tracking-[0.5em] py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono font-bold text-sm outline-none focus:border-amber-500"
                />
              </div>

              {/* Teclado numérico táctil interactivo */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'BACK'].map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKeypadPress(k)}
                    className={cn(
                      "py-3 rounded-xl font-black text-sm transition-all cursor-pointer",
                      k === 'C' 
                        ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20" 
                        : k === 'BACK'
                        ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-xs"
                        : "bg-white/5 text-white hover:bg-white/15 border border-white/10 shadow-sm"
                    )}
                  >
                    {k === 'BACK' ? '⌫' : k}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-white/5 text-[10px] text-brand-text-dim">
                <span>PIN de fábrica predeterminado: </span>
                <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">1234</span>
                <p className="mt-1 text-[9px] text-neutral-400">Podrás cambiar este PIN a cualquier contraseña de 4 dígitos una vez dentro.</p>
              </div>
            </div>
          ) : (
            /* RECUADRO CON TODOS LOS MOVIMIENTOS DENTRO DE LA APLICACIÓN */
            <div className="space-y-6">
              {/* Formulario de Cambio de PIN si fue activado */}
              {isChangingPin && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-4 max-w-lg">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <KeyRound className="w-4 h-4" />
                      Configurar Nueva Contraseña de 4 Dígitos
                    </h4>
                    <button 
                      onClick={() => setIsChangingPin(false)}
                      className="text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-neutral-300 font-bold block mb-1">Nueva Clave (4 dígitos):</label>
                      <input 
                        type="password"
                        maxLength={4}
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="Ej: 5821"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-mono font-bold text-center tracking-widest outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-300 font-bold block mb-1">Confirmar Nueva Clave:</label>
                      <input 
                        type="password"
                        maxLength={4}
                        value={confirmPinInput}
                        onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="Repite los 4 dígitos"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-mono font-bold text-center tracking-widest outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {pinError && (
                    <p className="text-xs text-red-400 font-semibold">{pinError}</p>
                  )}
                  {pinChangeSuccess && (
                    <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      {pinChangeSuccess}
                    </p>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleSaveNewPin}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Guardar Nueva Contraseña
                    </button>
                  </div>
                </div>
              )}

              {/* Aviso de Auto-Borrado de 5 Días para ahorro inteligente de espacio */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">
                    Depuración automática de 5 días activa: los movimientos con más de 5 días se eliminan solos para no ocupar almacenamiento en tu dispositivo.
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                  {rawMovements.length} eventos registrados
                </span>
              </div>

              {/* Contadores Resumen de Movimientos (5 Días) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                  <span className="text-[9px] font-black text-brand-text-dim uppercase">Total Movimientos</span>
                  <p className="text-xl font-black text-white font-mono mt-0.5">{rawMovements.length}</p>
                  <p className="text-[8px] text-brand-text-dim mt-0.5">Últimos 5 días</p>
                </div>

                <div className="p-3 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                  <span className="text-[9px] font-black text-blue-400 uppercase">Ingresos Stock</span>
                  <p className="text-xl font-black text-blue-400 font-mono mt-0.5">
                    {rawMovements.filter(m => m.type === 'STOCK_INGRESO').length}
                  </p>
                  <p className="text-[8px] text-blue-400/80 mt-0.5">Nuevos calzados</p>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                  <span className="text-[9px] font-black text-emerald-400 uppercase">Ventas / Reservas</span>
                  <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                    {rawMovements.filter(m => m.type === 'VENTA').length}
                  </p>
                  <p className="text-[8px] text-emerald-400/80 mt-0.5">Operaciones registradas</p>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  <span className="text-[9px] font-black text-amber-400 uppercase">Ediciones</span>
                  <p className="text-xl font-black text-amber-400 font-mono mt-0.5">
                    {rawMovements.filter(m => m.type === 'EDICION').length}
                  </p>
                  <p className="text-[8px] text-amber-400/80 mt-0.5">Modificaciones</p>
                </div>

                <div className="p-3 rounded-2xl bg-red-500/5 border border-red-500/20">
                  <span className="text-[9px] font-black text-red-400 uppercase">Eliminaciones</span>
                  <p className="text-xl font-black text-red-400 font-mono mt-0.5">
                    {rawMovements.filter(m => m.type === 'ELIMINACION').length}
                  </p>
                  <p className="text-[8px] text-red-400/80 mt-0.5">Registros borrados</p>
                </div>

                <div className="p-3 rounded-2xl bg-purple-500/5 border border-purple-500/20">
                  <span className="text-[9px] font-black text-purple-400 uppercase">Libro Diario</span>
                  <p className="text-xl font-black text-purple-400 font-mono mt-0.5">
                    {rawMovements.filter(m => m.type === 'LIBRO_DIARIO').length}
                  </p>
                  <p className="text-[8px] text-purple-400/80 mt-0.5">Ingresos / Gastos</p>
                </div>
              </div>

              {/* Filtros de Tipo y Buscador */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  {(['TODOS', 'STOCK_INGRESO', 'VENTA', 'EDICION', 'ELIMINACION', 'LIBRO_DIARIO'] as const).map(tp => (
                    <button
                      key={tp}
                      onClick={() => setMovementTypeFilter(tp)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer",
                        movementTypeFilter === tp
                          ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                          : "bg-white/5 text-neutral-400 hover:text-white"
                      )}
                    >
                      {tp === 'TODOS' ? 'Todos' :
                       tp === 'STOCK_INGRESO' ? '📦 Stock' :
                       tp === 'VENTA' ? '🛒 Ventas' :
                       tp === 'EDICION' ? '✏️ Ediciones' :
                       tp === 'ELIMINACION' ? '🗑️ Bajas' :
                       '📖 Libro Diario'}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    placeholder="Buscar movimiento..."
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Tabla Sencilla y Compacta de Movimientos */}
              <div className="rounded-2xl border border-white/5 overflow-hidden bg-slate-950/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-[9px] font-black text-brand-text-dim uppercase tracking-wider">
                        <th className="px-4 py-3">Fecha y Hora</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Movimiento / Acción</th>
                        <th className="px-4 py-3">Detalles</th>
                        <th className="px-4 py-3">Responsable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.02] text-xs">
                      {filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-brand-text-dim italic">
                            No hay movimientos registrados en este período o filtro.
                          </td>
                        </tr>
                      ) : (
                        filteredMovements.map(mov => {
                          const badgeColor = 
                            mov.type === 'STOCK_INGRESO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                            mov.type === 'VENTA' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                            mov.type === 'EDICION' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                            mov.type === 'ELIMINACION' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                            'bg-purple-500/10 text-purple-400 border-purple-500/30';

                          return (
                            <tr key={mov.id} className="hover:bg-white/[0.015] transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="font-bold text-white block text-xs">{mov.date}</span>
                                <span className="text-[10px] text-amber-400/90 font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {mov.time}
                                </span>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider", badgeColor)}>
                                  {mov.type.replace('_', ' ')}
                                </span>
                              </td>

                              <td className="px-4 py-3">
                                <span className="font-bold text-white text-xs">{mov.title}</span>
                              </td>

                              <td className="px-4 py-3">
                                <span className="text-neutral-300 text-xs font-mono">{mov.details}</span>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap text-[11px] text-neutral-400 font-mono">
                                {mov.author || 'Usuario'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
