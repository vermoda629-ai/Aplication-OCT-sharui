/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  PieChart as PieIcon, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  ShoppingBag, 
  MapPin, 
  Layers,
  Sparkles,
  ShieldCheck,
  Award
} from 'lucide-react';
import { Product, DailyLogEntry, Sale, Invoice } from '../types';
import { formatCurrency, formatDate, getDiffDaysFromNow } from '../lib/utils';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import * as XLSX from 'xlsx';

interface FinancialReportsSectionProps {
  products: Product[];
  logs: DailyLogEntry[];
  sales: Sale[];
  invoices: Invoice[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];

export default function FinancialReportsSection({
  products,
  logs,
  sales,
  invoices
}: FinancialReportsSectionProps) {
  const [period, setPeriod] = useState<'ALL' | '30' | '90' | 'YEAR'>('ALL');

  // Filter items based on selected period (calibrado)
  const filterByDate = (dateStr: string) => {
    if (period === 'ALL') return true;
    const diffDays = getDiffDaysFromNow(dateStr);

    if (period === '30') return diffDays <= 30;
    if (period === '90') return diffDays <= 90;
    if (period === 'YEAR') return diffDays <= 365;
    return true;
  };

  const filteredSales = sales.filter(s => filterByDate(s.date));
  const filteredLogs = logs.filter(l => filterByDate(l.date));

  // Core Financial Aggregations
  // 1. Total Sales Revenue
  const salesRevenue = filteredSales.filter(s => s.status === 'Compra').reduce((acc, s) => acc + s.price, 0);

  // 2. Accounting Incomes (exclude duplicate sales if logged, or sum entries)
  const accountingIncome = filteredLogs.filter(l => l.category === 'Ingresos').reduce((acc, l) => acc + l.amount, 0);
  const totalRevenue = Math.max(salesRevenue, accountingIncome);

  // 3. Operating Expenses
  const operatingExpenses = filteredLogs.filter(l => l.category !== 'Ingresos').reduce((acc, l) => acc + l.amount, 0);

  // 4. Net Profit and Profit Margin
  const netProfit = totalRevenue - operatingExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const averageTicket = filteredSales.length > 0 ? salesRevenue / filteredSales.length : 0;

  // Monthly Financial Evolution for Chart
  const monthlyMap: Record<string, { month: string; ingresos: number; egresos: number; utilidad: number }> = {};

  filteredSales.forEach(s => {
    if (s.status !== 'Compra') return;
    const monthKey = s.date.slice(0, 7); // YYYY-MM
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { month: monthKey, ingresos: 0, egresos: 0, utilidad: 0 };
    }
    monthlyMap[monthKey].ingresos += s.price;
  });

  filteredLogs.forEach(l => {
    const monthKey = l.date.slice(0, 7);
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { month: monthKey, ingresos: 0, egresos: 0, utilidad: 0 };
    }
    if (l.category === 'Ingresos') {
      // already represented or fallback
      if (monthlyMap[monthKey].ingresos === 0) {
        monthlyMap[monthKey].ingresos += l.amount;
      }
    } else {
      monthlyMap[monthKey].egresos += l.amount;
    }
  });

  const monthlyEvolutionData = Object.values(monthlyMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      ...m,
      utilidad: m.ingresos - m.egresos,
      monthLabel: m.month
    }));

  // Expenses by Category Pie Chart
  const expenseByCategoryMap: Record<string, number> = {};
  filteredLogs.filter(l => l.category !== 'Ingresos').forEach(l => {
    expenseByCategoryMap[l.category] = (expenseByCategoryMap[l.category] || 0) + l.amount;
  });

  const expenseCategoryData = Object.entries(expenseByCategoryMap).map(([name, value]) => ({
    name,
    value
  }));

  // Sales by City
  const salesByCityMap: Record<string, { city: string; total: number; count: number }> = {};
  filteredSales.forEach(s => {
    if (!salesByCityMap[s.city]) {
      salesByCityMap[s.city] = { city: s.city, total: 0, count: 0 };
    }
    salesByCityMap[s.city].total += s.price;
    salesByCityMap[s.city].count += 1;
  });

  const salesByCityData = Object.values(salesByCityMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Top Selling Products
  const productSalesMap: Record<string, { code: string; name: string; units: number; revenue: number }> = {};
  filteredSales.forEach(s => {
    if (s.status !== 'Compra') return;
    const p = products.find(prod => prod.code.toLowerCase() === s.productCode.toLowerCase());
    const code = s.productCode;
    if (!productSalesMap[code]) {
      productSalesMap[code] = {
        code,
        name: p?.name || `Ref. ${code}`,
        units: 0,
        revenue: 0
      };
    }
    productSalesMap[code].units += 1;
    productSalesMap[code].revenue += s.price;
  });

  const topSellingProducts = Object.values(productSalesMap).sort((a, b) => b.revenue - a.revenue);

  // Export Financial Report to Excel
  const exportFinancialReport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: P&L Summary
    const plData = [
      { Concepto: 'Ingresos Totales por Ventas', 'Monto (Bs.)': totalRevenue },
      { Concepto: 'Gastos Operativos Totales', 'Monto (Bs.)': operatingExpenses },
      { Concepto: 'Utilidad Neta del Ejercicio', 'Monto (Bs.)': netProfit },
      { Concepto: 'Margen de Rentabilidad (%)', 'Monto (Bs.)': `${profitMargin.toFixed(1)}%` },
      { Concepto: 'Ticket Promedio por Venta', 'Monto (Bs.)': averageTicket },
    ];
    // Page setup for vertical Letter printing with 2cm top and 1cm sides/bottom margins
    const pageSetup = { orientation: 'portrait', paperSize: 1 };
    const pageMargins = { left: 0.394, right: 0.394, top: 0.787, bottom: 0.394, header: 0.2, footer: 0.2 };

    const ws1 = XLSX.utils.json_to_sheet(plData);
    ws1['!pageSetup'] = pageSetup;
    ws1['!margins'] = pageMargins;
    XLSX.utils.book_append_sheet(wb, ws1, 'Estado de Resultados');

    // Sheet 2: Expenses by category
    const ws2 = XLSX.utils.json_to_sheet(expenseCategoryData.map(c => ({
      Categoría: c.name,
      'Total Egresos (Bs.)': c.value,
      'Participación (%)': `${((c.value / (operatingExpenses || 1)) * 100).toFixed(1)}%`
    })));
    ws2['!pageSetup'] = pageSetup;
    ws2['!margins'] = pageMargins;
    XLSX.utils.book_append_sheet(wb, ws2, 'Desglose de Gastos');

    // Sheet 3: Sales by City
    const ws3 = XLSX.utils.json_to_sheet(salesByCityData.map(c => ({
      Ciudad: c.city,
      'Total Vendido (Bs.)': c.total,
      'Cantidad de Pedidos': c.count
    })));
    ws3['!pageSetup'] = pageSetup;
    ws3['!margins'] = pageMargins;
    XLSX.utils.book_append_sheet(wb, ws3, 'Ventas por Ciudad');

    XLSX.writeFile(wb, `SHARUI_Informe_Financiero_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header and Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            Informes Financieros & P&L Ejecutivo
          </h2>
          <p className="text-xs text-brand-text-dim mt-1">
            Análisis de rentabilidad, márgenes operativos, flujo de caja y ventas consolidadas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="bg-brand-card p-1 rounded-2xl border border-white/5 flex items-center gap-1">
            {(['ALL', '30', '90', 'YEAR'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  period === p
                    ? 'bg-brand-accent text-white shadow-md'
                    : 'text-brand-text-dim hover:text-white'
                }`}
              >
                {p === 'ALL' ? 'Histórico' : p === '30' ? '30 Días' : p === '90' ? '3 Meses' : 'Año'}
              </button>
            ))}
          </div>

          <button
            onClick={exportFinancialReport}
            className="px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar Informe</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-brand-card p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" /> Bruto
            </span>
          </div>
          <p className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider">Ingresos Totales</p>
          <p className="text-2xl font-black text-white font-mono mt-1">{formatCurrency(totalRevenue)}</p>
          <p className="text-[9px] text-brand-text-dim/60 font-semibold mt-1">Facturación y entradas registradas</p>
        </div>

        {/* Operating Expenses */}
        <div className="bg-brand-card p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <ArrowDownRight className="w-3 h-3" /> Egresos
            </span>
          </div>
          <p className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider">Gastos Operativos</p>
          <p className="text-2xl font-black text-red-400 font-mono mt-1">{formatCurrency(operatingExpenses)}</p>
          <p className="text-[9px] text-brand-text-dim/60 font-semibold mt-1">Costos de envío, marketing y adm.</p>
        </div>

        {/* Net Profit */}
        <div className="bg-brand-card p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {profitMargin.toFixed(1)}% margen
            </span>
          </div>
          <p className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider">Utilidad Neta</p>
          <p className={`text-2xl font-black font-mono mt-1 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="text-[9px] text-brand-text-dim/60 font-semibold mt-1">Beneficio libre disponible</p>
        </div>

        {/* Average Ticket */}
        <div className="bg-brand-card p-5 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
              {filteredSales.length} ventas
            </span>
          </div>
          <p className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider">Ticket Promedio</p>
          <p className="text-2xl font-black text-purple-300 font-mono mt-1">{formatCurrency(averageTicket)}</p>
          <p className="text-[9px] text-brand-text-dim/60 font-semibold mt-1">Valor medio por pedido</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Revenue vs Expenses Evolution Chart */}
        <div className="lg:col-span-2 bg-brand-card p-6 rounded-3xl border border-white/5 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-brand-accent" />
                Flujo de Ingresos vs Egresos
              </h3>
              <p className="text-[10px] text-brand-text-dim font-bold">Comportamiento financiero en el tiempo</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Ingresos
              </span>
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Egresos
              </span>
            </div>
          </div>

          <div className="h-[250px] w-full">
            {monthlyEvolutionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyEvolutionData}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="monthLabel" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => `${v} Bs`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#151b2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="ingresos" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#incomeGrad)" name="Ingresos (Bs)" />
                  <Area type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#expenseGrad)" name="Egresos (Bs)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-brand-text-dim italic">
                Sin movimientos financieros en el periodo seleccionado
              </div>
            )}
          </div>
        </div>

        {/* Expenses Distribution Pie */}
        <div className="bg-brand-card p-6 rounded-3xl border border-white/5 shadow-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-1">
              <PieIcon className="w-4 h-4 text-emerald-400" />
              Estructura de Gastos
            </h3>
            <p className="text-[10px] text-brand-text-dim font-bold mb-4">Distribución por categoría operativa</p>

            <div className="h-[180px] w-full">
              {expenseCategoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {expenseCategoryData.map((_, i) => (
                        <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#151b2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px' }}
                      formatter={(v: any) => [`${formatCurrency(Number(v))}`, 'Monto']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-brand-text-dim italic">
                  No hay gastos registrados
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-white/5">
            {expenseCategoryData.slice(0, 4).map((c, i) => (
              <div key={i} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-300 font-semibold truncate max-w-[120px]">{c.name}</span>
                </div>
                <span className="font-mono font-bold text-white">{formatCurrency(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row: Top Products & Sales by City */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Products */}
        <div className="bg-brand-card p-6 rounded-3xl border border-white/5 shadow-2xl">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-amber-400" />
            Top Calzados Más Vendidos
          </h3>
          <p className="text-[10px] text-brand-text-dim font-bold mb-4">Productos con mayor rotación e ingresos</p>

          <div className="space-y-3">
            {topSellingProducts.length === 0 && (
              <p className="text-xs text-brand-text-dim italic py-8 text-center">
                Aún no hay compras finalizadas en este periodo.
              </p>
            )}
            {topSellingProducts.slice(0, 5).map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-brand-accent/30 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-400 font-black text-xs flex items-center justify-center">
                    #{idx + 1}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white line-clamp-1">{p.name}</p>
                    <p className="text-[9px] text-brand-text-dim font-mono">{p.code} • {p.units} ud. vendidas</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs font-black text-emerald-400 font-mono">{formatCurrency(p.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="bg-brand-card p-6 rounded-3xl border border-white/5 shadow-2xl">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-blue-400" />
            Ventas por Ciudad & Logística
          </h3>
          <p className="text-[10px] text-brand-text-dim font-bold mb-4">Volumen financiero por destino de despacho</p>

          <div className="h-[220px] w-full">
            {salesByCityData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByCityData} layout="vertical">
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `${v} Bs`} />
                  <YAxis type="category" dataKey="city" stroke="#64748b" fontSize={10} width={90} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#151b2d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                    formatter={(v: any) => [`${formatCurrency(Number(v))}`, 'Ingresos']}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[0, 8, 8, 0]} name="Ingresos (Bs)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-brand-text-dim italic">
                Sin datos de ciudades registrados
              </div>
            )}
          </div>
        </div>
      </div>

      {/* P&L Executive Table */}
      <div className="bg-brand-card rounded-3xl border border-white/5 p-6 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-brand-accent" />
            Resumen de Estado de Resultados (P&L)
          </h3>
          <span className="text-[9px] font-bold text-brand-text-dim uppercase tracking-widest">
            Moneda: Bolivianos (Bs.)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-[9px] font-black text-brand-text-dim uppercase tracking-wider">
                <th className="py-3 px-4">Concepto Contable</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-right">Importe</th>
                <th className="py-3 px-4 text-right">% Sobre Ingresos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-semibold text-slate-300">
              <tr>
                <td className="py-3 px-4 font-bold text-white">Ingresos por Ventas de Inventario</td>
                <td className="py-3 px-4 text-brand-text-dim">Ventas en Firme</td>
                <td className="py-3 px-4 text-right font-mono text-emerald-400 font-bold">{formatCurrency(totalRevenue)}</td>
                <td className="py-3 px-4 text-right font-mono">100.0%</td>
              </tr>
              {expenseCategoryData.map((cat, i) => (
                <tr key={i} className="text-slate-400">
                  <td className="py-2.5 px-4 pl-8">(-) {cat.name}</td>
                  <td className="py-2.5 px-4 text-[10px] text-brand-text-dim">Gasto Operativo</td>
                  <td className="py-2.5 px-4 text-right font-mono text-red-400">-{formatCurrency(cat.value)}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs">
                    {totalRevenue > 0 ? ((cat.value / totalRevenue) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
              <tr className="bg-white/[0.03] border-t-2 border-white/10 text-sm font-black">
                <td className="py-4 px-4 text-white uppercase tracking-wider">UTILIDAD NETA FINAL</td>
                <td className="py-4 px-4 text-brand-accent text-xs font-bold">Resultado Operativo</td>
                <td className={`py-4 px-4 text-right font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(netProfit)}
                </td>
                <td className={`py-4 px-4 text-right font-mono ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {profitMargin.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
