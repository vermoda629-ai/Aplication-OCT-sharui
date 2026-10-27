/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Phone, 
  MapPin, 
  Tag, 
  Search, 
  FileSpreadsheet, 
  ShoppingBag, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Award,
  AlertCircle,
  UserPlus,
  Upload,
  Download,
  Trash2,
  X,
  CheckCircle2,
  FileDown
} from 'lucide-react';
import { Sale, CustomerTier, Customer } from '../types';
import { formatDate, formatTime, getCustomerTier, getCustomerFollowUpAlert, BOLIVIA_DEPARTMENTS } from '../lib/utils';
import { StorageService } from '../lib/storage';
import * as XLSX from 'xlsx';

interface CustomersSectionProps {
  sales: Sale[];
}

// Detector estricto para descartar ventas sin nombre o S/N del listado de clientes
export const isSinNombre = (name?: string): boolean => {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  return (
    n === '' ||
    n === 's/n' ||
    n === 'sn' ||
    n === 's.n.' ||
    n === 's / n' ||
    n === 's/ n' ||
    n === 'sin nombre' ||
    n === 'sin-nombre' ||
    n === 'cliente sin nombre' ||
    n === 'cliente casual' ||
    n === 'anónimo' ||
    n === 'anonimo' ||
    n === 'cliente' ||
    n === 'desconocido' ||
    n === 'ninguno'
  );
};

export default function CustomersSection({ sales }: CustomersSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState<'TODOS' | CustomerTier>('TODOS');
  const [selectedCustomerDetailKey, setSelectedCustomerDetailKey] = useState<string | null>(null);

  // Clientes registrados manualmente o mediante Excel
  const [registeredCustomers, setRegisteredCustomers] = useState<Customer[]>(() => {
    return StorageService.getRegisteredCustomers();
  });

  // Modal para agregar cliente manual
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCity, setFormCity] = useState('Cochabamba');
  const [formTier, setFormTier] = useState<CustomerTier>('Intermitente');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Notificación de éxito
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Referencia al input de archivo Excel
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Guardar cliente manual
  const handleSaveManualCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('El nombre del cliente es obligatorio.');
      return;
    }

    if (isSinNombre(formName)) {
      setFormError('No se permite registrar nombres genéricos o "S/N" en la cartera de clientes.');
      return;
    }

    // Determinar cantidad base de pares según el rango/categoría seleccionado
    const basePairsByTier: Record<CustomerTier, number> = {
      Casual: 1,
      Intermitente: 2,
      Frecuente: 4,
      VIP: 7,
      Premium: 10
    };

    const newCustomer: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: formName.trim(),
      whatsapp: formPhone.trim(),
      city: formCity.trim() || 'Cochabamba',
      tier: formTier,
      totalPairsPurchased: basePairsByTier[formTier] || 2,
      sizesRequested: [],
      lastPurchaseDate: new Date().toISOString().split('T')[0],
      lastPurchaseTime: new Date().toTimeString().slice(0, 5),
      followUpAlert: getCustomerFollowUpAlert(formTier).alert,
      notes: formNotes.trim(),
      createdAt: Date.now(),
      source: 'manual'
    };

    StorageService.saveRegisteredCustomer(newCustomer);
    setRegisteredCustomers(StorageService.getRegisteredCustomers());
    setIsAddModalOpen(false);
    setFormName('');
    setFormPhone('');
    setFormCity('Cochabamba');
    setFormTier('Intermitente');
    setFormNotes('');
    setFormError('');
    showNotification(`Cliente "${newCustomer.name}" registrado correctamente.`);
  };

  // Importar archivo Excel (.xlsx, .xls, .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawData || rawData.length === 0) {
          alert('El archivo Excel está vacío o no contiene filas con datos.');
          return;
        }

        const importedCustomers: Customer[] = [];

        rawData.forEach((row, index) => {
          // Extraer campos mapeando posibles encabezados
          const name = String(
            row['NOMBRE'] || 
            row['Nombre'] || 
            row['CLIENTE'] || 
            row['Cliente'] || 
            row['NAME'] || 
            row['name'] || 
            ''
          ).trim();

          // Ignorar filas sin nombre o registros "S/N"
          if (!name || isSinNombre(name)) return;

          const contact = String(
            row['CONTACTO'] || 
            row['Contacto'] || 
            row['WHATSAPP'] || 
            row['Whatsapp'] || 
            row['TELEFONO'] || 
            row['Teléfono'] || 
            row['Telefono'] || 
            row['CELULAR'] || 
            row['Celular'] || 
            ''
          ).trim();

          const city = String(
            row['CIUDAD'] || 
            row['Ciudad'] || 
            row['DEPARTAMENTO'] || 
            row['Departamento'] || 
            row['CITY'] || 
            'Cochabamba'
          ).trim();

          const rawTier = String(
            row['RANGO CATEGORIA'] || 
            row['RANGO CATEGORÍA'] || 
            row['RANGO'] || 
            row['Rango'] || 
            row['CATEGORIA'] || 
            row['CATEGORÍA'] || 
            row['Categoria'] || 
            row['Categoría'] || 
            row['TIER'] || 
            row['PARES'] || 
            row['Pares'] || 
            ''
          ).trim().toLowerCase();

          let tier: CustomerTier = 'Intermitente';
          let pairs = 2; // Default 2 pares como solicitó el usuario para clientes previos

          if (rawTier.includes('prem') || rawTier.includes('10')) {
            tier = 'Premium';
            pairs = 10;
          } else if (rawTier.includes('vip') || rawTier.includes('7') || rawTier.includes('8') || rawTier.includes('9')) {
            tier = 'VIP';
            pairs = 7;
          } else if (rawTier.includes('frec') || rawTier.includes('4') || rawTier.includes('5') || rawTier.includes('6')) {
            tier = 'Frecuente';
            pairs = 4;
          } else if (rawTier.includes('inter') || rawTier.includes('2') || rawTier.includes('3')) {
            tier = 'Intermitente';
            pairs = 2;
          } else if (rawTier.includes('cas') || rawTier.includes('1')) {
            tier = 'Casual';
            pairs = 1;
          } else {
            const numericPairs = parseInt(rawTier, 10);
            if (!isNaN(numericPairs) && numericPairs > 0) {
              pairs = numericPairs;
              tier = getCustomerTier(pairs);
            }
          }

          importedCustomers.push({
            id: `cust-xl-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
            name,
            whatsapp: contact,
            city: city || 'Cochabamba',
            tier,
            totalPairsPurchased: pairs,
            sizesRequested: [],
            lastPurchaseDate: new Date().toISOString().split('T')[0],
            lastPurchaseTime: '10:00',
            followUpAlert: getCustomerFollowUpAlert(tier).alert,
            notes: 'Importado de Excel',
            createdAt: Date.now(),
            source: 'excel'
          });
        });

        if (importedCustomers.length === 0) {
          alert('No se encontraron clientes válidos en el archivo. Asegúrate de incluir las columnas: NOMBRE, CONTACTO, CIUDAD, RANGO CATEGORIA.');
          return;
        }

        StorageService.saveRegisteredCustomersBatch(importedCustomers);
        setRegisteredCustomers(StorageService.getRegisteredCustomers());
        showNotification(`¡Éxito! Se importaron ${importedCustomers.length} clientes a la cartera comercial.`);
      } catch (err) {
        console.error("Error al procesar archivo Excel:", err);
        alert('Ocurrió un error al leer el archivo Excel. Verifica el formato e intenta nuevamente.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  // Descargar plantilla Excel oficial
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'NOMBRE': 'Juan Carlos Rodriguez',
        'CONTACTO': '77234567',
        'CIUDAD': 'Cochabamba',
        'RANGO CATEGORIA': 'Intermitente'
      },
      {
        'NOMBRE': 'Maria Elena Flores',
        'CONTACTO': '68901234',
        'CIUDAD': 'La Paz',
        'RANGO CATEGORIA': 'VIP'
      },
      {
        'NOMBRE': 'Pedro Alvarez',
        'CONTACTO': '71239845',
        'CIUDAD': 'Santa Cruz',
        'RANGO CATEGORIA': 'Frecuente'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla Clientes");
    XLSX.writeFile(wb, "SHARUI_Plantilla_Clientes.xlsx");
  };

  // Eliminar cliente registrado manualmente
  const handleDeleteRegistered = (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar al cliente "${name}" de la cartera registrada?`)) {
      StorageService.deleteRegisteredCustomer(id);
      setRegisteredCustomers(StorageService.getRegisteredCustomers());
      if (selectedCustomerDetailKey) setSelectedCustomerDetailKey(null);
      showNotification(`Cliente "${name}" eliminado.`);
    }
  };

  // CONSOLIDAR CLIENTES:
  // 1. Clientes registrados (manual / Excel)
  // 2. Clientes de ventas (EXCLUYENDO estrictamente ventas sin nombre o S/N)
  const customerMap = new Map<string, {
    key: string;
    id?: string;
    name: string;
    whatsapp: string;
    city: string;
    totalPairsPurchased: number;
    sizesRequested: string[];
    purchases: Sale[];
    lastPurchaseDate: string;
    lastPurchaseTime?: string;
    tier: CustomerTier;
    followUpAlert: string;
    isRegistered?: boolean;
    notes?: string;
  }>();

  // 1. Agregar clientes registrados
  registeredCustomers.forEach(rc => {
    const cleanPhone = rc.whatsapp.replace(/\D/g, '') || 'sin-telefono';
    const key = `${rc.name.trim().toLowerCase()}_${cleanPhone}`;

    customerMap.set(key, {
      key,
      id: rc.id,
      name: rc.name.trim(),
      whatsapp: rc.whatsapp.trim(),
      city: rc.city.trim() || 'Cochabamba',
      totalPairsPurchased: rc.totalPairsPurchased || 2,
      sizesRequested: rc.sizesRequested || [],
      purchases: [],
      lastPurchaseDate: rc.lastPurchaseDate || new Date().toISOString().split('T')[0],
      lastPurchaseTime: rc.lastPurchaseTime || '10:00',
      tier: rc.tier || 'Intermitente',
      followUpAlert: getCustomerFollowUpAlert(rc.tier || 'Intermitente').alert,
      isRegistered: true,
      notes: rc.notes
    });
  });

  // 2. Asociar ventas reales a clientes (EXCLUYENDO S/N O SIN NOMBRE)
  sales.forEach(sale => {
    // Si la venta no tiene nombre o es S/N, IGNORAR COMPLETAMENTE
    if (isSinNombre(sale.clientName)) {
      return;
    }

    const cleanPhone = sale.whatsapp.replace(/\D/g, '') || 'sin-telefono';
    const key = `${sale.clientName.trim().toLowerCase()}_${cleanPhone}`;

    // Buscar si ya existe por key o por nombre
    let target = customerMap.get(key);
    if (!target) {
      // Buscar por nombre si no coincide el teléfono exacto
      for (const val of customerMap.values()) {
        if (val.name.toLowerCase() === sale.clientName.trim().toLowerCase()) {
          target = val;
          break;
        }
      }
    }

    const cleanSize = String(sale.selectedSize || '').replace(/^T/i, '').trim();

    if (!target) {
      // Cliente nuevo originado directamente desde una venta
      customerMap.set(key, {
        key,
        name: sale.clientName.trim(),
        whatsapp: sale.whatsapp.trim(),
        city: sale.city.trim() || 'Cochabamba',
        totalPairsPurchased: sale.status === 'Compra' ? 1 : 0,
        sizesRequested: cleanSize ? [cleanSize] : [],
        purchases: [sale],
        lastPurchaseDate: sale.date,
        lastPurchaseTime: sale.time || formatTime(sale.createdAt),
        tier: 'Casual',
        followUpAlert: '',
        isRegistered: false
      });
    } else {
      if (sale.status === 'Compra') {
        target.totalPairsPurchased += 1;
      }
      if (cleanSize && !target.sizesRequested.includes(cleanSize)) {
        target.sizesRequested.push(cleanSize);
      }
      target.purchases.push(sale);
      if (sale.date >= target.lastPurchaseDate) {
        target.lastPurchaseDate = sale.date;
        target.lastPurchaseTime = sale.time || formatTime(sale.createdAt);
      }
      customerMap.set(target.key, target);
    }
  });

  // Re-calcular niveles y alertas dinámicas
  const customerList = Array.from(customerMap.values()).map(c => {
    // Si el cliente fue registrado con un rango inicial, asegurar que no baje
    const calculatedTier = getCustomerTier(c.totalPairsPurchased);
    const tierPriority: Record<CustomerTier, number> = {
      Casual: 1,
      Intermitente: 2,
      Frecuente: 3,
      VIP: 4,
      Premium: 5
    };
    
    // Si tiene compras mayores a su categoría base, asciende
    const finalTier: CustomerTier = tierPriority[calculatedTier] > tierPriority[c.tier] ? calculatedTier : c.tier;
    const { alert } = getCustomerFollowUpAlert(finalTier);

    return {
      ...c,
      tier: finalTier,
      followUpAlert: alert
    };
  });

  // Conteo de rangos
  const tierCounts: Record<CustomerTier, number> = {
    Casual: 0,
    Intermitente: 0,
    Frecuente: 0,
    VIP: 0,
    Premium: 0
  };

  customerList.forEach(c => {
    tierCounts[c.tier] = (tierCounts[c.tier] || 0) + 1;
  });

  // Clientes filtrados por búsqueda y rango
  const filteredCustomers = customerList.filter(c => {
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      c.name.toLowerCase().includes(q) ||
      c.whatsapp.includes(q) ||
      c.city.toLowerCase().includes(q);

    const matchesTier = selectedTierFilter === 'TODOS' || c.tier === selectedTierFilter;
    return matchesSearch && matchesTier;
  });

  // Exportar lista actual a Excel
  const handleExportExcel = () => {
    const data = customerList.map(c => ({
      'Nombre del Cliente': c.name,
      'WhatsApp / Teléfono': c.whatsapp,
      'Ciudad': c.city,
      'Pares Comprados': c.totalPairsPurchased,
      'Categoría de Cliente': c.tier,
      'Tallas que Calza': c.sizesRequested.join(', '),
      'Última Operación': `${c.lastPurchaseDate} ${c.lastPurchaseTime || ''}`,
      'Recomendación de Seguimiento': c.followUpAlert
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clientes SHARUI");
    XLSX.writeFile(wb, `SHARUI_Directorio_Clientes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400 font-bold text-xs"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input oculto para carga de Excel */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".xlsx,.xls,.csv" 
        className="hidden" 
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            Supervisión & Cartera de Clientes
          </h2>
          <p className="text-xs text-brand-text-dim mt-1">
            Registro personal, segmentación por pares comprados (Casual, Intermitente, Frecuente, VIP, Premium) e importación de clientes previos.
          </p>
        </div>

        {/* Action Buttons: Agregar Cliente + Importar Excel + Plantilla + Exportar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Nuevo Cliente Manual */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/20"
            title="Registrar manualmente un cliente nuevo o previo"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Agregar Cliente</span>
          </button>

          {/* Botón Importar Excel */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            title="Importar lista de clientes desde un archivo Excel (.xlsx)"
          >
            <Upload className="w-4 h-4 text-purple-400" />
            <span>Importar Excel</span>
          </button>

          {/* Botón Descargar Plantilla */}
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Descargar formato modelo de Excel para llenar datos de clientes"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">Plantilla</span>
          </button>

          {/* Botón Exportar Lista a Excel */}
          <button
            onClick={handleExportExcel}
            className="px-4 py-3 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white border border-purple-500/30 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg"
            title="Exportar cartera actual a hoja de cálculo"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* Tiers Distribution Cards (Strictly pairs and counts, NO money) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Casual */}
        <div 
          onClick={() => setSelectedTierFilter(selectedTierFilter === 'Casual' ? 'TODOS' : 'Casual')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedTierFilter === 'Casual' ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg' : 'bg-brand-card border-white/5 hover:border-emerald-500/40'
          }`}
        >
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Casual</p>
          <p className="text-2xl font-black text-white mt-1">{tierCounts.Casual}</p>
          <p className="text-[8px] text-brand-text-dim mt-1">1 par comprado</p>
        </div>

        {/* Intermitente */}
        <div 
          onClick={() => setSelectedTierFilter(selectedTierFilter === 'Intermitente' ? 'TODOS' : 'Intermitente')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedTierFilter === 'Intermitente' ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-lg' : 'bg-brand-card border-white/5 hover:border-cyan-500/40'
          }`}
        >
          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">Intermitente</p>
          <p className="text-2xl font-black text-white mt-1">{tierCounts.Intermitente}</p>
          <p className="text-[8px] text-brand-text-dim mt-1">2 a 3 pares</p>
        </div>

        {/* Frecuente */}
        <div 
          onClick={() => setSelectedTierFilter(selectedTierFilter === 'Frecuente' ? 'TODOS' : 'Frecuente')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedTierFilter === 'Frecuente' ? 'bg-blue-500/20 border-blue-500 text-white shadow-lg' : 'bg-brand-card border-white/5 hover:border-blue-500/40'
          }`}
        >
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Frecuente</p>
          <p className="text-2xl font-black text-white mt-1">{tierCounts.Frecuente}</p>
          <p className="text-[8px] text-brand-text-dim mt-1">4 a 6 pares</p>
        </div>

        {/* VIP */}
        <div 
          onClick={() => setSelectedTierFilter(selectedTierFilter === 'VIP' ? 'TODOS' : 'VIP')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedTierFilter === 'VIP' ? 'bg-purple-500/20 border-purple-500 text-white shadow-lg' : 'bg-brand-card border-white/5 hover:border-purple-500/40'
          }`}
        >
          <p className="text-[10px] font-black text-purple-400 uppercase tracking-wider">VIP</p>
          <p className="text-2xl font-black text-white mt-1">{tierCounts.VIP}</p>
          <p className="text-[8px] text-brand-text-dim mt-1">7 a 9 pares</p>
        </div>

        {/* Premium */}
        <div 
          onClick={() => setSelectedTierFilter(selectedTierFilter === 'Premium' ? 'TODOS' : 'Premium')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            selectedTierFilter === 'Premium' ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg' : 'bg-brand-card border-white/5 hover:border-amber-500/40'
          }`}
        >
          <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider">Premium ⭐</p>
          <p className="text-2xl font-black text-white mt-1">{tierCounts.Premium}</p>
          <p className="text-[8px] text-brand-text-dim mt-1">10 o más pares</p>
        </div>
      </div>

      {/* Search Bar & Tier Filter Pills */}
      <div className="bg-brand-card p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-brand-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            placeholder="Buscar cliente por nombre, WhatsApp o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['TODOS', 'Casual', 'Intermitente', 'Frecuente', 'VIP', 'Premium'] as const).map(tier => (
            <button
              key={tier}
              onClick={() => setSelectedTierFilter(tier)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                selectedTierFilter === tier 
                  ? 'bg-purple-600 text-white shadow-md' 
                  : 'bg-white/5 text-brand-text-dim hover:text-white'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Customers List Table (Strictly NO money amounts, and strictly NO 'S/N' anonymous group!) */}
      <div className="bg-brand-card rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-[9px] font-black text-brand-text-dim uppercase tracking-wider">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Contacto WhatsApp</th>
                <th className="px-6 py-4">Ciudad</th>
                <th className="px-6 py-4 text-center">Pares Comprados</th>
                <th className="px-6 py-4">Rango / Categoría</th>
                <th className="px-6 py-4">Tallas Solicitadas</th>
                <th className="px-6 py-4">Última Operación</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-brand-text-dim italic font-medium">
                    No se encontraron clientes registrados con los filtros aplicados.
                  </td>
                </tr>
              )}
              {filteredCustomers.sort((a,b) => b.totalPairsPurchased - a.totalPairsPurchased).map(customer => {
                const cleanPhone = customer.whatsapp.replace(/\D/g, '');
                const phoneWithCode = cleanPhone.startsWith('591') ? cleanPhone : `591${cleanPhone}`;
                const tierInfo = getCustomerFollowUpAlert(customer.tier);

                return (
                  <tr key={customer.key} className="hover:bg-white/[0.015] transition-colors group">
                    {/* Cliente */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-black text-white uppercase">{customer.name}</p>
                        {customer.isRegistered && (
                          <span className="text-[8px] font-black bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30">
                            Registrado
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-brand-text-dim font-bold">
                        {customer.purchases.length} operaciones registradas
                      </p>
                    </td>

                    {/* WhatsApp */}
                    <td className="px-6 py-4 text-xs font-mono text-emerald-400">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{customer.whatsapp || 'Sin registrar'}</span>
                      </div>
                    </td>

                    {/* Ciudad */}
                    <td className="px-6 py-4 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        <span>{customer.city}</span>
                      </div>
                    </td>

                    {/* Pares Comprados */}
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-black text-white font-mono bg-white/5 px-3 py-1 rounded-xl border border-white/10">
                        {customer.totalPairsPurchased} pares
                      </span>
                    </td>

                    {/* Categoría */}
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border ${tierInfo.color}`}>
                        {tierInfo.badge}
                      </span>
                    </td>

                    {/* Tallas que suele pedir */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {customer.sizesRequested.length > 0 ? (
                          customer.sizesRequested.map((sz, i) => (
                            <span key={i} className="text-[8px] font-mono font-bold bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-slate-300">
                              T{sz}
                            </span>
                          ))
                        ) : (
                          <span className="text-[9px] text-brand-text-dim italic">Por registrar</span>
                        )}
                      </div>
                    </td>

                    {/* Fecha y hora última compra */}
                    <td className="px-6 py-4 text-xs whitespace-nowrap">
                      <span className="text-slate-300 block">{formatDate(customer.lastPurchaseDate)}</span>
                      <span className="text-[10px] text-brand-text-dim font-mono">{customer.lastPurchaseTime}</span>
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {customer.whatsapp && cleanPhone.length > 5 && (
                          <a
                            href={`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(
                              `Hola ${customer.name}, te saludamos de SHARUI Calzados. Esperamos que te encuentres muy bien. ¿En qué modelo podemos asesorarte hoy?`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Chat WhatsApp"
                            className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl transition-all cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => setSelectedCustomerDetailKey(
                            selectedCustomerDetailKey === customer.key ? null : customer.key
                          )}
                          title="Ver ficha de seguimiento"
                          className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl transition-all cursor-pointer"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                        </button>

                        {customer.id && (
                          <button
                            onClick={() => handleDeleteRegistered(customer.id!, customer.name)}
                            title="Eliminar cliente de cartera registrada"
                            className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Agregar Cliente Manualmente */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#12141c] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase">Registrar Nuevo Cliente</h3>
                    <p className="text-[10px] text-brand-text-dim">Para clientes previos o nuevos compradores</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveManualCustomer} className="space-y-3.5">
                {/* NOMBRE */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-300 uppercase tracking-wider block">
                    NOMBRE DEL CLIENTE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Roberto Gomez"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>

                {/* CONTACTO */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-300 uppercase tracking-wider block">
                    CONTACTO (WHATSAPP / TELÉFONO)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 77234567"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>

                {/* CIUDAD */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-300 uppercase tracking-wider block">
                    CIUDAD
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ej. Cochabamba"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  {/* Quick City suggestions */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {BOLIVIA_DEPARTMENTS.slice(0, 5).map(dept => (
                      <button
                        type="button"
                        key={dept}
                        onClick={() => setFormCity(dept)}
                        className={`text-[9px] px-2 py-0.5 rounded-lg border cursor-pointer transition-all ${
                          formCity.toLowerCase() === dept.toLowerCase() 
                            ? 'bg-purple-600/30 text-purple-300 border-purple-500' 
                            : 'bg-white/5 text-neutral-400 border-white/5 hover:text-white'
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                </div>

                {/* RANGO CATEGORIA */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-300 uppercase tracking-wider block">
                    RANGO CATEGORÍA (SEGMENTACIÓN POR PARES)
                  </label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value as CustomerTier)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none focus:border-purple-500 cursor-pointer font-bold"
                  >
                    <option value="Casual" className="bg-[#12141c]">Casual (1 par comprado)</option>
                    <option value="Intermitente" className="bg-[#12141c]">Intermitente (2 a 3 pares)</option>
                    <option value="Frecuente" className="bg-[#12141c]">Frecuente (4 a 6 pares)</option>
                    <option value="VIP" className="bg-[#12141c]">VIP (7 a 9 pares)</option>
                    <option value="Premium" className="bg-[#12141c]">Premium ⭐ (10 o más pares)</option>
                  </select>
                  <p className="text-[9px] text-brand-text-dim italic">
                    Ideal para clientes que llevaron 2 o más calzados antes del sistema.
                  </p>
                </div>

                {/* NOTAS */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-neutral-300 uppercase tracking-wider block">
                    NOTAS O PREFERENCIAS (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Calza talla 40, prefiere modelos deportivos"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-purple-600/30"
                  >
                    Guardar Cliente
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Customer Detail Drawer with Follow-Up Alert */}
      <AnimatePresence>
        {selectedCustomerDetailKey && (() => {
          const cust = customerList.find(c => c.key === selectedCustomerDetailKey);
          if (!cust) return null;
          const tierInfo = getCustomerFollowUpAlert(cust.tier);

          return (
            <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-brand-card border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5"
              >
                <div className="flex justify-between items-start border-b border-white/5 pb-4">
                  <div>
                    <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border uppercase ${tierInfo.color}`}>
                      {tierInfo.badge}
                    </span>
                    <h3 className="text-xl font-black text-white uppercase mt-2">{cust.name}</h3>
                    <p className="text-xs text-brand-text-dim flex items-center gap-2 mt-1">
                      <span>WhatsApp: {cust.whatsapp || 'Sin registrar'}</span> • <span>Ciudad: {cust.city}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCustomerDetailKey(null)}
                    className="p-2 rounded-xl bg-white/5 text-brand-text-dim hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Follow Up Alert Banner */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Recomendación de Seguimiento:
                  </p>
                  <p className="text-xs font-semibold text-slate-200">
                    {cust.followUpAlert}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-brand-text-dim">Pares Totales Comprados:</span>
                    <span className="font-black text-white font-mono">{cust.totalPairsPurchased} pares</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-brand-text-dim">Tallas que Calza:</span>
                    <span className="font-bold text-blue-400 font-mono">
                      {cust.sizesRequested.length > 0 ? cust.sizesRequested.join(', ') : 'Ninguna registrada aún'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-brand-text-dim">Última Compra / Registro:</span>
                    <span className="font-semibold text-slate-300">{formatDate(cust.lastPurchaseDate)} {cust.lastPurchaseTime}</span>
                  </div>
                  {cust.notes && (
                    <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5">
                      <span className="text-brand-text-dim">Notas:</span>
                      <span className="text-slate-300 italic">{cust.notes}</span>
                    </div>
                  )}
                </div>

                {/* Purchases list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Historial de Calzados Llevados:</h4>
                  {cust.purchases.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center text-xs text-brand-text-dim italic">
                      Cliente ingresado por cartera manual o Excel (no registra ventas en esta sesión aún).
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {cust.purchases.map(p => (
                        <div key={p.id} className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-white uppercase">{p.fullCode || p.productCode}</span>
                              <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-1.5 rounded">T{p.selectedSize}</span>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase ${
                                p.status === 'Compra' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                              }`}>{p.status}</span>
                            </div>
                            <p className="text-[9px] text-brand-text-dim mt-0.5">{formatDate(p.date)} {p.time} • {p.city} ({p.logistics})</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {cust.id && (
                    <button
                      onClick={() => handleDeleteRegistered(cust.id!, cust.name)}
                      className="py-3 px-4 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-bold text-xs uppercase cursor-pointer transition-all"
                    >
                      Eliminar Cliente
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedCustomerDetailKey(null)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-black text-xs text-brand-text-dim uppercase cursor-pointer"
                  >
                    Cerrar Ficha
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
