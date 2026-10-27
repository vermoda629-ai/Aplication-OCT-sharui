/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Search, 
  ShoppingCart, 
  CheckCircle2, 
  Sparkles, 
  CreditCard, 
  QrCode, 
  Banknote, 
  User, 
  Tag, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  Truck, 
  Phone, 
  X, 
  Download, 
  CheckSquare, 
  Square, 
  Package, 
  Layers,
  FileDown,
  ShieldCheck,
  Filter,
  ArrowUpDown,
  Database,
  Clock,
  LayoutGrid,
  Lock,
  Grid2x2,
  Grid3x3
} from 'lucide-react';
import { Product, ProductColorVariant, Sale, Invoice, StoreSettings } from '../types';
import { StorageService } from '../lib/storage';
import { cn, formatCurrency, getCurrentDateTime, BOLIVIA_DEPARTMENTS, getCustomerTier, formatDate, getLocalDateString, getLocalTimeString } from '../lib/utils';
import confetti from 'canvas-confetti';
import InvoiceModal from './InvoiceModal';
import { jsPDF } from 'jspdf';

interface CatalogFastSaleSectionProps {
  products: Product[];
  sales: Sale[];
  setSales: (sales: Sale[]) => void;
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  onNavigateToVentas?: () => void;
  storeSettings?: StoreSettings;
}

export default function CatalogFastSaleSection({
  products,
  sales,
  setSales,
  invoices,
  setInvoices,
  onNavigateToVentas,
  storeSettings: propStoreSettings
}: CatalogFastSaleSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('TODAS');
  // Two new search filters: Category and Size
  const [catalogFilterCategory, setCatalogFilterCategory] = useState<string>('TODAS');
  const [catalogFilterSize, setCatalogFilterSize] = useState<string>('TODAS');

  // Sorting: brand (default A-Z), code, created_asc, created_desc
  const [sortBy, setSortBy] = useState<'brand' | 'code' | 'created_asc' | 'created_desc'>('brand');

  // Grid density: compact (more cards per row) or normal (adaptive)
  const [gridDensity, setGridDensity] = useState<'compact' | 'normal'>(() => {
    try {
      const saved = localStorage.getItem('catalog_grid_density');
      return saved === 'compact' ? 'compact' : 'normal';
    } catch {
      return 'normal';
    }
  });

  const handleSetDensity = (d: 'compact' | 'normal') => {
    setGridDensity(d);
    try {
      localStorage.setItem('catalog_grid_density', d);
    } catch {}
  };

  // Quick Sale Drawer / Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [targetVariant, setTargetVariant] = useState<ProductColorVariant | null>(null);
  const [targetCatalogItem, setTargetCatalogItem] = useState<any | null>(null);

  // Quick Sale Form Fields
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedSizeIndex, setSelectedSizeIndex] = useState<number>(0);
  const [advancePayment, setAdvancePayment] = useState<string>('50');
  const [price, setPrice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'QR' | 'Tarjeta'>('QR');
  const [selectedExistingCustomerName, setSelectedExistingCustomerName] = useState('');
  const [discountPercent, setDiscountPercent] = useState('0');

  // Detailed fields toggle
  const [showDetailedFields, setShowDetailedFields] = useState(false);
  const [customSaleDate, setCustomSaleDate] = useState('');
  const [customSaleTime, setCustomSaleTime] = useState('');
  const [customClientName, setCustomClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientCity, setClientCity] = useState<string>('Cochabamba');
  const [isReservation, setIsReservation] = useState(false);
  const [logistics, setLogistics] = useState<Sale['logistics']>('En tienda');
  const [notes, setNotes] = useState('');

  // Generated Invoice after sale
  const [newlyCreatedInvoice, setNewlyCreatedInvoice] = useState<Invoice | null>(null);

  // Catalog PDF Download Modal State & Filters
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedPdfItemKeys, setSelectedPdfItemKeys] = useState<string[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfFilterSize, setPdfFilterSize] = useState('TODAS');
  const [pdfFilterCategory, setPdfFilterCategory] = useState('TODAS');
  const [pdfFilterBrand, setPdfFilterBrand] = useState('TODAS');
  const [pdfFilterSearch, setPdfFilterSearch] = useState('');
  const [pdfDensity, setPdfDensity] = useState<'auto' | '2' | '3' | '4'>('auto');

  // Extract unique customers from previous sales
  const existingCustomersMap = new Map<string, { name: string; whatsapp: string; city: string; count: number }>();
  sales.forEach(s => {
    if (!s.clientName) return;
    const key = s.clientName.trim();
    if (!existingCustomersMap.has(key)) {
      existingCustomersMap.set(key, {
        name: s.clientName.trim(),
        whatsapp: s.whatsapp || '',
        city: s.city || 'Cochabamba',
        count: 1
      });
    } else {
      existingCustomersMap.get(key)!.count += 1;
    }
  });

  const existingCustomersList = Array.from(existingCustomersMap.values());

  // Flatten products into clickable items for the catalog
  const catalogItems = products.flatMap(p => {
    const vars = p.variants && p.variants.length > 0 ? p.variants : [
      {
        id: 'v-def',
        colorName: 'Principal',
        subCode: '',
        fullCode: p.code,
        image: p.image,
        sizes: p.sizes
      }
    ];

    return vars.map(v => {
      const codeToMatch = (v.fullCode || p.code).trim().toLowerCase();

      // Find all sales corresponding to this product/subcode
      const soldSales = sales.filter(s => {
        const sCode = (s.fullCode || s.productCode || '').trim().toLowerCase();
        return (sCode === codeToMatch || sCode === p.code.toLowerCase()) && s.status === 'Compra';
      });

      const reservedSales = sales.filter(s => {
        const sCode = (s.fullCode || s.productCode || '').trim().toLowerCase();
        return (sCode === codeToMatch || sCode === p.code.toLowerCase()) && s.status === 'Reserva';
      });

      // Pools of sold and reserved sizes
      const soldPool = soldSales.map(s => String(s.selectedSize).replace(/^T/i, '').trim());
      const reservedPool = reservedSales.map(s => String(s.selectedSize).replace(/^T/i, '').trim());

      // Track each size instance with status:
      // - DISPONIBLE (verde)
      // - RESERVADO (amarillo)
      // - VENDIDO (tachado y rojo)
      const allSizesWithStatus = v.sizes.map((sz, sIdx) => {
        const clean = String(sz).replace(/^T/i, '').trim();
        const soldIdx = soldPool.indexOf(clean);
        if (soldIdx > -1) {
          soldPool.splice(soldIdx, 1);
          return { size: clean, status: 'VENDIDO' as const, key: `${clean}-${sIdx}` };
        }
        const resIdx = reservedPool.indexOf(clean);
        if (resIdx > -1) {
          reservedPool.splice(resIdx, 1);
          return { size: clean, status: 'RESERVADO' as const, key: `${clean}-${sIdx}` };
        }
        return { size: clean, status: 'DISPONIBLE' as const, key: `${clean}-${sIdx}` };
      });

      const availableCount = allSizesWithStatus.filter(s => s.status === 'DISPONIBLE').length;
      const reservedCount = allSizesWithStatus.filter(s => s.status === 'RESERVADO').length;

      return {
        key: `${p.id}_${v.id}`,
        product: p,
        variant: v,
        fullCode: v.fullCode || p.code,
        brand: p.brand || 'KNUP',
        origin: p.origin || 'Original',
        category: p.category || 'calzado',
        image: v.image || p.image,
        colorName: v.colorName || 'Principal',
        allSizesWithStatus,
        availableCount,
        reservedCount,
        isSoldOut: availableCount === 0 && reservedCount === 0 && allSizesWithStatus.length > 0,
        salePrice: p.salePrice || 0,
      };
    });
  });

  // Filter and sort catalog items: Código is the default sorting
  const filteredCatalog = React.useMemo(() => {
    const list = catalogItems.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || (
        item.fullCode.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.colorName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );

      const matchesBrand = selectedBrand === 'TODAS' || item.brand === selectedBrand;

      const matchesCategory = catalogFilterCategory === 'TODAS' || 
        item.category.trim().toLowerCase() === catalogFilterCategory.trim().toLowerCase();

      const matchesSize = catalogFilterSize === 'TODAS' || 
        item.allSizesWithStatus.some(s => s.size === catalogFilterSize && s.status !== 'VENDIDO');

      return matchesSearch && matchesBrand && matchesCategory && matchesSize;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'code') {
        // Natural numerical sorting by code / subcode
        return (a.fullCode || '').localeCompare(b.fullCode || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'brand') {
        const brandComp = (a.brand || '').localeCompare(b.brand || '', undefined, { sensitivity: 'base' });
        if (brandComp !== 0) return brandComp;
        return (a.fullCode || '').localeCompare(b.fullCode || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'created_asc') {
        // Orden en que se agregó originalmente al sistema (cronológico)
        const aTime = a.product.createdAt || 0;
        const bTime = b.product.createdAt || 0;
        return aTime - bTime;
      }
      if (sortBy === 'created_desc') {
        // Últimos agregados primero
        const aTime = a.product.createdAt || 0;
        const bTime = b.product.createdAt || 0;
        return bTime - aTime;
      }
      return 0;
    });
  }, [catalogItems, searchTerm, selectedBrand, catalogFilterCategory, catalogFilterSize, sortBy]);

  // Extract all distinct sizes present in the catalog
  const allSizesInCatalog = React.useMemo(() => {
    const sizeSet = new Set<string>();
    catalogItems.forEach(it => {
      it.allSizesWithStatus.forEach(s => {
        if (s.size) sizeSet.add(s.size);
      });
    });
    return Array.from(sizeSet).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [catalogItems]);

  // Extract all categories available across products or standard list
  const allCategoriesInCatalog = React.useMemo(() => {
    const set = new Set<string>();
    // Pre-populate with standard footwear categories
    ['casual', 'deportivo', 'running', 'trekking', 'urbano', 'clásico'].forEach(c => set.add(c));
    // Add existing categories in catalog
    catalogItems.forEach(it => {
      if (it.category) set.add(it.category.trim().toLowerCase());
    });
    return ['TODAS', ...Array.from(set)];
  }, [catalogItems]);

  // Extract available sizes in stock for PDF catalog filtering
  const availableSizesInCatalog = React.useMemo(() => {
    const sizeSet = new Set<string>();
    catalogItems.forEach(it => {
      it.allSizesWithStatus.forEach(s => {
        if (s.status === 'DISPONIBLE') {
          sizeSet.add(s.size);
        }
      });
    });
    return Array.from(sizeSet).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [catalogItems]);

  // Extract available categories
  const availableCategoriesInCatalog = React.useMemo(() => {
    return ['TODAS', ...Array.from(new Set(catalogItems.map(it => it.category).filter(Boolean)))];
  }, [catalogItems]);

  // Extract available brands
  const availableBrandsInCatalog = React.useMemo(() => {
    return ['TODAS', ...Array.from(new Set(catalogItems.map(it => it.brand).filter(Boolean)))];
  }, [catalogItems]);

  // Filtered items inside the PDF Export Modal
  const pdfFilteredCatalog = React.useMemo(() => {
    return catalogItems.filter(item => {
      // Filter by size: must have that size available
      if (pdfFilterSize !== 'TODAS') {
        const hasSize = item.allSizesWithStatus.some(
          s => s.status === 'DISPONIBLE' && s.size === pdfFilterSize
        );
        if (!hasSize) return false;
      }
      // Filter by category
      if (pdfFilterCategory !== 'TODAS' && item.category !== pdfFilterCategory) {
        return false;
      }
      // Filter by brand
      if (pdfFilterBrand !== 'TODAS' && item.brand !== pdfFilterBrand) {
        return false;
      }
      // Filter by code / subcode / color text
      if (pdfFilterSearch.trim()) {
        const q = pdfFilterSearch.toLowerCase().trim();
        const matches = (item.fullCode || '').toLowerCase().includes(q) ||
                        (item.product.code || '').toLowerCase().includes(q) ||
                        (item.variant.subCode || '').toLowerCase().includes(q) ||
                        (item.brand || '').toLowerCase().includes(q) ||
                        (item.colorName || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [catalogItems, pdfFilterSize, pdfFilterCategory, pdfFilterBrand, pdfFilterSearch]);

  // Open 1-Click Sale Modal when image or a specific size is tapped
  const handleOpenFastSale = (
    item: typeof catalogItems[0], 
    initialSizeIndex?: number, 
    initialSize?: string
  ) => {
    setTargetProduct(item.product);
    setTargetVariant(item.variant);
    setTargetCatalogItem(item);
    setPrice(item.salePrice.toString());

    let targetIdx = -1;
    let chosenSize = '';

    if (initialSizeIndex !== undefined && initialSizeIndex >= 0 && item.allSizesWithStatus[initialSizeIndex]) {
      const targetObj = item.allSizesWithStatus[initialSizeIndex];
      // Only select if DISPONIBLE
      if (targetObj.status === 'DISPONIBLE') {
        targetIdx = initialSizeIndex;
        chosenSize = targetObj.size;
      }
    } else if (initialSize) {
      const foundIdx = item.allSizesWithStatus.findIndex(s => s.size === initialSize && s.status === 'DISPONIBLE');
      if (foundIdx >= 0) {
        targetIdx = foundIdx;
        chosenSize = item.allSizesWithStatus[foundIdx].size;
      }
    }

    // If no available size was chosen yet, pick the first DISPONIBLE size
    if (targetIdx < 0) {
      // Prioritize active filtered size if it is DISPONIBLE
      const filterIdx = catalogFilterSize !== 'TODAS'
        ? item.allSizesWithStatus.findIndex(s => s.size === catalogFilterSize && s.status === 'DISPONIBLE')
        : -1;

      if (filterIdx >= 0) {
        targetIdx = filterIdx;
        chosenSize = item.allSizesWithStatus[filterIdx].size;
      } else {
        const firstAvailableIdx = item.allSizesWithStatus.findIndex(s => s.status === 'DISPONIBLE');
        if (firstAvailableIdx >= 0) {
          targetIdx = firstAvailableIdx;
          chosenSize = item.allSizesWithStatus[firstAvailableIdx].size;
        } else {
          // If no available sizes remain (all sold or reserved)
          targetIdx = -1;
          chosenSize = '';
        }
      }
    }

    setSelectedSizeIndex(targetIdx);
    setSelectedSize(chosenSize);
    setAdvancePayment('50');

    setDiscountPercent('0');
    setSelectedExistingCustomerName('');
    setCustomClientName('');
    setClientPhone('');
    setClientCity('Cochabamba');
    setIsReservation(false);
    setLogistics('En tienda');
    setShowDetailedFields(false);
    setNotes('');
    setCustomSaleDate(getLocalDateString());
    setCustomSaleTime(getLocalTimeString());
    setIsModalOpen(true);
  };

  // If selecting existing customer, auto-fill phone, city and suggested discount based on tier
  const handleSelectCustomer = (name: string) => {
    setSelectedExistingCustomerName(name);
    if (!name) return;

    const found = existingCustomersList.find(c => c.name === name);
    if (found) {
      setCustomClientName(found.name);
      setClientPhone(found.whatsapp);
      setClientCity(found.city || 'Cochabamba');

      const tier = getCustomerTier(found.count);
      if (tier === 'Premium') setDiscountPercent('10');
      else if (tier === 'VIP') setDiscountPercent('7');
      else if (tier === 'Frecuente') setDiscountPercent('5');
      else setDiscountPercent('0');
    }
  };

  // Price calculation
  const basePrice = parseFloat(price) || 0;
  const discountVal = (basePrice * (parseFloat(discountPercent) || 0)) / 100;
  const finalPrice = Math.max(0, basePrice - discountVal);

  // Submit Sale / Reservation
  const handleConfirmFastSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProduct || !targetVariant) return;

    if (!selectedSize) {
      alert('Por favor selecciona una talla disponible.');
      return;
    }

    const cleanSelectedSize = String(selectedSize).replace(/^T/i, '').trim();

    // Verify size is not already reserved or sold
    if (targetCatalogItem) {
      const currentStatusObj = targetCatalogItem.allSizesWithStatus[selectedSizeIndex] || 
        targetCatalogItem.allSizesWithStatus.find((s: any) => s.size === cleanSelectedSize);
      if (currentStatusObj && currentStatusObj.status === 'RESERVADO') {
        alert(`La talla ${cleanSelectedSize} ya se encuentra RESERVADA por otro cliente y no puede ser utilizada para otra venta o reserva hasta que se libere.`);
        return;
      }
      if (currentStatusObj && currentStatusObj.status === 'VENDIDO') {
        alert(`La talla ${cleanSelectedSize} ya fue VENDIDA y no está disponible.`);
        return;
      }
    }

    const dateToRecord = customSaleDate.trim() || getLocalDateString();
    const timeToRecord = customSaleTime.trim() || getLocalTimeString();
    const fullDateStringToRecord = `${formatDate(dateToRecord)} ${timeToRecord}`;

    const clientNameToUse = selectedExistingCustomerName || customClientName.trim() || 'S/N';
    const clientPhoneToUse = clientPhone.trim() || 'S/N';
    const cityToUse = 'Cochabamba';
    const fullCodeToRecord = targetVariant.fullCode || targetProduct.code;
    const saleId = crypto.randomUUID();

    const advVal = isReservation ? (parseFloat(advancePayment) || 0) : finalPrice;
    const remVal = isReservation ? Math.max(0, finalPrice - advVal) : 0;

    // 1. Record Sale or Reservation
    const newSale: Sale = {
      id: saleId,
      date: dateToRecord,
      time: timeToRecord,
      dateTimeString: fullDateStringToRecord,
      status: isReservation ? 'Reserva' : 'Compra',
      productCode: fullCodeToRecord,
      subCode: targetVariant.subCode,
      fullCode: fullCodeToRecord,
      selectedSize: String(selectedSize).replace(/^T/i, '').trim(),
      selectedSizeIndex: selectedSizeIndex,
      price: finalPrice,
      advancePayment: advVal,
      remainingBalance: remVal,
      paymentMethod,
      clientName: clientNameToUse,
      whatsapp: clientPhoneToUse,
      city: cityToUse,
      logistics,
      discount: discountVal,
      notes: notes.trim() || (isReservation ? `Reserva con anticipo de Bs. ${advVal}. Saldo: Bs. ${remVal}.` : 'Venta directa en mostrador.'),
      createdAt: Date.now(),
    };

    // 2. Automatically generate Receipt / Nota de Venta
    const count = invoices.length + 1;
    const currentYear = new Date().getFullYear();
    const invoiceNumber = `REC-${currentYear}-${String(count).padStart(3, '0')}`;

    const newInvoice: Invoice = {
      id: crypto.randomUUID(),
      invoiceNumber,
      date: dateToRecord,
      time: timeToRecord,
      dateTimeString: fullDateStringToRecord,
      saleId,
      clientName: clientNameToUse,
      clientPhone: clientPhoneToUse,
      clientCity: cityToUse,
      items: [
        {
          id: crypto.randomUUID(),
          description: fullCodeToRecord,
          size: selectedSize,
          quantity: 1,
          unitPrice: basePrice,
          total: basePrice
        }
      ],
      subtotal: basePrice,
      discount: discountVal,
      tax: 0,
      total: finalPrice,
      advancePayment: advVal,
      remainingBalance: remVal,
      status: isReservation ? 'Emitida' : 'Pagada',
      paymentMethod,
      notes: `Nota de venta registrada desde Catálogo. Fecha y hora: ${fullDateStringToRecord}.`,
      terms: 'Garantía oficial de 3 días para cambio por motivo de horma incorrecta.',
      createdAt: Date.now(),
    };

    newSale.invoiceId = invoiceNumber;

    // Save and update in live state
    await StorageService.saveSale(newSale);
    await StorageService.saveInvoice(newInvoice);

    setSales(StorageService.getSales());
    setInvoices(StorageService.getInvoices());

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    setIsModalOpen(false);
    setNewlyCreatedInvoice(newInvoice);
  };

  // Open PDF Download Modal
  const handleOpenPdfModal = () => {
    setPdfFilterSize('TODAS');
    setPdfFilterCategory('TODAS');
    setPdfFilterBrand('TODAS');
    setPdfFilterSearch('');
    // Select all items currently available in catalog by default
    setSelectedPdfItemKeys(catalogItems.map(it => it.key));
    setIsPdfModalOpen(true);
  };

  const handleSelectFilteredPdf = () => {
    const keysToAdd = pdfFilteredCatalog.map(it => it.key);
    setSelectedPdfItemKeys(prev => Array.from(new Set([...prev, ...keysToAdd])));
  };

  const handleDeselectFilteredPdf = () => {
    const keysToRemove = new Set(pdfFilteredCatalog.map(it => it.key));
    setSelectedPdfItemKeys(prev => prev.filter(k => !keysToRemove.has(k)));
  };

  const handleToggleSelectAllPdf = () => {
    if (selectedPdfItemKeys.length === catalogItems.length) {
      setSelectedPdfItemKeys([]);
    } else {
      setSelectedPdfItemKeys(catalogItems.map(it => it.key));
    }
  };

  const handleTogglePdfItem = (key: string) => {
    setSelectedPdfItemKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Export catalog and inventory in structured JSON backup format
  const handleExportCatalogJSON = () => {
    try {
      const backupPayload = {
        app: "SHARUI Enterprise",
        version: "1.0",
        exportDate: new Date().toISOString(),
        totalProducts: products.length,
        totalModels: products.length,
        totalVariants: products.reduce((acc, p) => acc + (p.variants?.length || 1), 0),
        totalUnits: products.reduce((acc, p) => acc + (p.sizes?.length || p.unitsCount || 0), 0),
        products: products.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name || `${p.brand} ${p.code}`,
          brand: p.brand || 'KNUP',
          origin: p.origin || 'Original',
          category: p.category || 'calzado',
          description: p.description || '',
          totalCost: Number(p.totalCost || 0),
          packageType: p.packageType || 'manual',
          unitsCount: Number(p.unitsCount || p.sizes?.length || 0),
          unitCost: Number(p.unitCost || 0),
          suggestedSalePrice: Number(p.suggestedSalePrice || 0),
          salePrice: Number(p.salePrice || 0),
          costPrice: Number(p.costPrice || p.unitCost || 0),
          image: p.image || '',
          sizes: p.sizes || [],
          createdAt: Number(p.createdAt || Date.now()),
          variants: (p.variants && p.variants.length > 0 ? p.variants : [
            {
              id: crypto.randomUUID(),
              colorName: 'Color Principal',
              subCode: 'F1',
              fullCode: `${p.code} F1`,
              image: p.image || '',
              sizes: p.sizes || []
            }
          ]).map(v => ({
            id: v.id,
            colorName: v.colorName || 'Principal',
            subCode: v.subCode || 'F1',
            fullCode: v.fullCode || `${p.code} ${v.subCode || 'F1'}`,
            image: v.image || p.image || '',
            sizes: v.sizes || []
          }))
        }))
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SHARUI_Catalogo_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting catalog JSON:", err);
    }
  };

  // Generate Catalog PDF with Anti-Theft Watermarks, Strict 1:1 Photos, Adaptive Density (2, 3, 4 cols) & Grouping
  const handleGenerateCatalogPDF = async () => {
    const itemsToExport = catalogItems.filter(it => selectedPdfItemKeys.includes(it.key));
    if (itemsToExport.length === 0) {
      alert('Por favor selecciona al menos un modelo para exportar.');
      return;
    }

    // Sort items by product code and subcode to group models together
    itemsToExport.sort((a, b) => {
      const c1 = a.product.code.localeCompare(b.product.code, undefined, { numeric: true });
      if (c1 !== 0) return c1;
      return (a.variant.subCode || '').localeCompare(b.variant.subCode || '', undefined, { numeric: true });
    });

    setIsGeneratingPdf(true);
    try {
      const storeSettings = propStoreSettings || StorageService.getStoreSettings();

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter' // Carta vertical: 215.9 x 279.4 mm
      });

      const pageWidth = 215.9;
      const pageHeight = 279.4;
      const marginLeft = 10; // 1 cm margen izquierdo
      const marginRight = 10; // 1 cm margen derecho
      const marginTop = 18; // Margen superior
      const marginBottom = 12; // Margen inferior
      const availableWidth = pageWidth - marginLeft - marginRight; // 195.9 mm

      // Adaptive or user-chosen column count: 2, 3, or 4 images per row
      let cols = 3;
      if (pdfDensity === '2') cols = 2;
      else if (pdfDensity === '3') cols = 3;
      else if (pdfDensity === '4') cols = 4;
      else {
        // 'auto': 2 for few products (<=6), 3 for medium (7-15), 4 for many (16+)
        if (itemsToExport.length <= 6) cols = 2;
        else if (itemsToExport.length <= 15) cols = 3;
        else cols = 4;
      }

      // Card geometry and dimensions
      const gapX = cols === 2 ? 6 : (cols === 3 ? 4.5 : 3.5);
      const cardWidth = (availableWidth - gapX * (cols - 1)) / cols;

      // Photo inside card: STRICT 1:1 Square Aspect Ratio (NEVER stretched)
      const photoPadding = cols === 4 ? 2 : 2.5;
      const photoW = cardWidth - (photoPadding * 2);
      const photoH = photoW; // EXACT 1:1 SQUARE (Height = Width)

      const cardHeaderH = cols === 4 ? 6.5 : (cols === 3 ? 7.5 : 8);
      const cardFooterH = cols === 4 ? 12 : (cols === 3 ? 14 : 15);
      const cardHeight = cardHeaderH + photoH + cardFooterH + 2;
      const gapY = cols === 4 ? 3.5 : (cols === 3 ? 4.5 : 5.5);

      const maxRowsPerPage = Math.floor((pageHeight - marginTop - 15 - marginBottom) / (cardHeight + gapY));

      let colIdx = 0;
      let rowIdx = 0;
      let pageNumber = 1;

      // Anti-Theft Watermark Function
      const renderWatermark = () => {
        // 1. Semi-transparent store logo in center of page
        if (storeSettings.logo && storeSettings.logo.startsWith('data:image')) {
          try {
            doc.saveGraphicsState();
            doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
            const logoW = 55;
            const logoH = 55;
            doc.addImage(
              storeSettings.logo,
              'JPEG',
              (pageWidth - logoW) / 2,
              (pageHeight - logoH) / 2,
              logoW,
              logoH
            );
            doc.restoreGraphicsState();
          } catch {
            // fallback
          }
        }

        // 2. Diagonal watermark text across the page
        try {
          doc.saveGraphicsState();
          doc.setGState(new (doc as any).GState({ opacity: 0.09 }));
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(cols === 4 ? 22 : 26);
          doc.setFont('helvetica', 'bold');
          const storeUpper = (storeSettings.storeName || 'SHARUI CALZADOS').toUpperCase();
          doc.text(`${storeUpper} • CATÁLOGO OFICIAL`, 25, 110, { angle: 33 });
          doc.text(`${storeUpper} • COCHABAMBA`, 25, 205, { angle: 33 });
          doc.restoreGraphicsState();
        } catch {
          doc.setTextColor(230, 235, 245);
          doc.setFontSize(cols === 4 ? 22 : 26);
          doc.setFont('helvetica', 'bold');
          const storeUpper = (storeSettings.storeName || 'SHARUI CALZADOS').toUpperCase();
          doc.text(`${storeUpper} • CATÁLOGO OFICIAL`, 25, 110, { angle: 33 });
          doc.text(`${storeUpper} • COCHABAMBA`, 25, 205, { angle: 33 });
        }

        // 3. Security Anti-Theft Notice in Footer
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(148, 163, 184);
        doc.text(
          `🔒 Catálogo exclusivo de ${storeSettings.storeName || 'SHARUI Calzados'} • WhatsApp: ${storeSettings.whatsapp || storeSettings.phone || ''} • Prohibida su copia o uso por terceros`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        );
      };

      const renderHeader = (pNum: number) => {
        // Page Header
        doc.setFillColor(15, 23, 42); // #0f172a
        doc.rect(marginLeft, marginTop, availableWidth, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(cols === 4 ? 9.5 : 10.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`CATÁLOGO DE PRODUCTOS - ${storeSettings.storeName.toUpperCase()}`, marginLeft + 4, marginTop + 7.5);

        doc.setFontSize(7.0);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.text(`Pág. ${pNum} • ${new Date().toLocaleDateString()}`, pageWidth - marginRight - 32, marginTop + 7.5);

        // Subheader Legend: Estado de Tallas
        doc.setFontSize(6.2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(203, 213, 225);
        doc.text('Leyenda: [Azul] Disponible  •  [Ámbar R] Reservada  •  [Tachado] Vendida', marginLeft + 4, marginTop + 10.5);

        renderWatermark();
      };

      renderHeader(pageNumber);

      let startY = marginTop + 15;

      for (let i = 0; i < itemsToExport.length; i++) {
        const item = itemsToExport[i];

        // Check if new page needed
        if (rowIdx >= maxRowsPerPage) {
          doc.addPage();
          pageNumber++;
          renderHeader(pageNumber);
          rowIdx = 0;
          colIdx = 0;
          startY = marginTop + 15;
        }

        const x = marginLeft + colIdx * (cardWidth + gapX);
        const y = startY + rowIdx * (cardHeight + gapY);

        // Card Container Border & Background
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, 'S');

        // Top Header of Card: Código y Sub-código + Marca
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(x, y, cardWidth, cardHeaderH, 2.5, 2.5, 'F');
        doc.rect(x, y + cardHeaderH - 2, cardWidth, 2, 'F'); // square bottom of card header

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(cols === 4 ? 7 : (cols === 3 ? 8 : 9));
        doc.setFont('helvetica', 'bold');
        doc.text(item.fullCode, x + 3, y + (cardHeaderH * 0.65));

        doc.setTextColor(203, 213, 225); // neutral slate-300
        doc.setFontSize(cols === 4 ? 6.5 : (cols === 3 ? 7 : 8));
        doc.text(item.brand, x + cardWidth - 3, y + (cardHeaderH * 0.65), { align: 'right' });

        // Product Photo with Strict 4:3 Proportion
        const photoX = x + photoPadding;
        const photoY = y + cardHeaderH + 1;

        if (item.image && item.image.startsWith('data:image')) {
          try {
            doc.addImage(item.image, 'JPEG', photoX, photoY, photoW, photoH);
          } catch {
            doc.setFillColor(241, 245, 249);
            doc.rect(photoX, photoY, photoW, photoH, 'F');
            doc.setFontSize(6.5);
            doc.setTextColor(148, 163, 184);
            doc.text('Foto de Calzado', photoX + (photoW / 2), photoY + (photoH / 2), { align: 'center' });
          }
        } else {
          doc.setFillColor(241, 245, 249);
          doc.rect(photoX, photoY, photoW, photoH, 'F');
          doc.setFontSize(6.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Foto de Calzado', photoX + (photoW / 2), photoY + (photoH / 2), { align: 'center' });
        }

        // Store Watermark on photo itself (anti-theft)
        doc.setFillColor(15, 23, 42);
        const wmBadgeW = Math.min(26, photoW * 0.45);
        const wmBadgeH = 3.6;
        doc.rect(photoX + photoW - wmBadgeW, photoY + photoH - wmBadgeH, wmBadgeW, wmBadgeH, 'F');
        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`© ${storeSettings.storeName || 'SHARUI'}`, photoX + photoW - (wmBadgeW / 2), photoY + photoH - 1.2, { align: 'center' });

        // Separating line between photo and sizes
        const footerY = photoY + photoH + 1.2;
        doc.setDrawColor(226, 232, 240);
        doc.line(x, footerY, x + cardWidth, footerY);

        // Footer Header: Tallas y Resumen
        doc.setFontSize(cols === 4 ? 5.5 : (cols === 3 ? 6.2 : 6.8));
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('ESTADO DE TALLAS:', x + 2.5, footerY + 3.2);

        // Render individual size pill boxes with clear states:
        // - DISPONIBLE: Recuadro azul/blanco con texto azul o negro
        // - RESERVADO: Recuadro ámbar con [R]
        // - VENDIDO: Recuadro gris con línea roja tachada
        const szList = item.allSizesWithStatus || [];
        const szBoxW = cols === 4 ? 5.8 : (cols === 3 ? 6.8 : 7.5);
        const szBoxH = cols === 4 ? 4.2 : (cols === 3 ? 4.8 : 5.2);
        const szGap = cols === 4 ? 0.8 : 1.0;
        const maxBoxes = Math.floor((cardWidth - 5) / (szBoxW + szGap));
        const szStartX = x + 2.5;
        const szStartY = footerY + 4.2;

        if (szList.length === 0) {
          doc.setFontSize(6.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Consultar disponibilidad', szStartX, szStartY + 4);
        } else {
          szList.forEach((szObj: any, sIdx: number) => {
            const col = sIdx % maxBoxes;
            const rowNum = Math.floor(sIdx / maxBoxes);
            if (rowNum >= 2) return; // Máximo 2 filas de tallas en tarjeta

            const bx = szStartX + col * (szBoxW + szGap);
            const by = szStartY + rowNum * (szBoxH + szGap);

            if (szObj.status === 'VENDIDO') {
              // VENDIDO: fondo gris claro, número atenuado y tachado con línea roja
              doc.setFillColor(241, 245, 249);
              doc.setDrawColor(203, 213, 225);
              doc.roundedRect(bx, by, szBoxW, szBoxH, 0.6, 0.6, 'FD');

              doc.setFontSize(cols === 4 ? 5.0 : 5.8);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(148, 163, 184);
              doc.text(szObj.size, bx + szBoxW / 2, by + (szBoxH * 0.7), { align: 'center' });

              doc.setDrawColor(239, 68, 68); // línea roja
              doc.setLineWidth(0.3);
              doc.line(bx + 0.6, by + szBoxH / 2, bx + szBoxW - 0.6, by + szBoxH / 2);
              doc.setLineWidth(0.2);
            } else if (szObj.status === 'RESERVADO') {
              // RESERVADO: fondo ámbar con borde ámbar y pequeña 'R'
              doc.setFillColor(254, 243, 199);
              doc.setDrawColor(217, 119, 6);
              doc.roundedRect(bx, by, szBoxW, szBoxH, 0.6, 0.6, 'FD');

              doc.setFontSize(cols === 4 ? 4.8 : 5.6);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(180, 83, 9);
              doc.text(szObj.size, bx + (szBoxW / 2) - 0.6, by + (szBoxH * 0.7), { align: 'center' });

              doc.setFontSize(3.2);
              doc.setTextColor(217, 119, 6);
              doc.text('R', bx + szBoxW - 1.2, by + 1.8);
            } else {
              // DISPONIBLE: fondo blanco con borde azul marino y número azul nítido
              doc.setFillColor(239, 246, 255);
              doc.setDrawColor(37, 99, 235);
              doc.roundedRect(bx, by, szBoxW, szBoxH, 0.6, 0.6, 'FD');

              doc.setFontSize(cols === 4 ? 5.2 : 6.0);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(29, 78, 216);
              doc.text(szObj.size, bx + szBoxW / 2, by + (szBoxH * 0.7), { align: 'center' });
            }
          });
        }

        // Move grid pointer
        colIdx++;
        if (colIdx >= cols) {
          colIdx = 0;
          rowIdx++;
        }
      }

      doc.save(`SHARUI_Catalogo_${new Date().toISOString().split('T')[0]}.pdf`);
      setIsPdfModalOpen(false);
    } catch (err) {
      console.error("Error generating catalog PDF:", err);
      alert("Hubo un detalle al generar el PDF del catálogo.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const allBrands = ['TODAS', ...Array.from(new Set(products.map(p => p.brand).filter(Boolean)))];

  return (
    <div className="space-y-8 pb-20">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-lg shadow-blue-600/10">
              <Tag className="w-5 h-5 text-white" />
            </div>
            Catálogo de Productos
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Galería visual de modelos en formato cuadrado 1:1. Toca directamente la foto de cualquier calzado para registrar la venta o reserva.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* White Download Catalog Button */}
          <button
            onClick={handleOpenPdfModal}
            className="px-4 py-3 bg-white hover:bg-neutral-200 text-black rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl transition-all"
            title="Descargar Catálogo en PDF seleccionando modelos"
          >
            <Download className="w-4 h-4 text-black" />
            <span>Descargar Catálogo PDF</span>
          </button>

          {/* White Download JSON Backup Button */}
          <button
            onClick={handleExportCatalogJSON}
            className="px-4 py-3 bg-white hover:bg-neutral-200 text-black rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl transition-all"
            title="Descargar respaldo completo del catálogo en formato JSON"
          >
            <Database className="w-4 h-4 text-black" />
            <span>Descargar JSON</span>
          </button>

          {onNavigateToVentas && (
            <button
              onClick={onNavigateToVentas}
              className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-2xl text-xs font-bold transition-all border border-neutral-800 cursor-pointer shadow-lg"
            >
              Ver Ventas Realizadas →
            </button>
          )}
        </div>
      </div>

      {/* Filter, Code Search and Sorting Bar */}
      <div className="bg-[#0e1015] p-3.5 sm:p-4 rounded-2xl border border-neutral-800 space-y-3 shadow-xl">
        {/* Main Controls Row: búsqueda de código -> 1. talla -> 2. categoría -> 3. orden de registro -> vista */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* 1. Búsqueda de código (barra compacta) */}
          <div className="relative w-36 sm:w-44 shrink-0">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar cód..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-7 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none focus:border-blue-600 placeholder:text-neutral-500"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-0.5"
                title="Borrar búsqueda"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* 1. Filtro por Talla */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 shrink-0" title="1. Filtrar modelos por talla disponible">
            <Tag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">1. Talla:</span>
            <select
              value={catalogFilterSize}
              onChange={(e) => setCatalogFilterSize(e.target.value)}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer"
            >
              <option value="TODAS" className="bg-[#0e1015] text-white">Todas</option>
              {allSizesInCatalog.map(sz => (
                <option key={sz} value={sz} className="bg-[#0e1015] text-white">
                  Talla {sz}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filtro por Categoría */}
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 shrink-0" title="2. Filtrar modelos por categoría">
            <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider whitespace-nowrap">2. Categoría:</span>
            <select
              value={catalogFilterCategory}
              onChange={(e) => setCatalogFilterCategory(e.target.value)}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer capitalize max-w-[120px] truncate"
            >
              <option value="TODAS" className="bg-[#0e1015] text-white">Todas</option>
              {allCategoriesInCatalog.filter(c => c !== 'TODAS').map(c => (
                <option key={c} value={c} className="bg-[#0e1015] text-white capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Orden de registro (con letra más pequeña) */}
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1.5 shrink-0" title="3. Orden de registro">
            <ArrowUpDown className="w-3 h-3 text-blue-400 shrink-0" />
            <span className="text-[9px] font-medium text-neutral-400 whitespace-nowrap">3. orden de registro:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white font-medium text-[10px] outline-none cursor-pointer"
            >
              <option value="brand" className="bg-[#0e1015] text-white">Marca (A - Z)</option>
              <option value="code" className="bg-[#0e1015] text-white">Código</option>
              <option value="created_asc" className="bg-[#0e1015] text-white">Registro (Primeros)</option>
              <option value="created_desc" className="bg-[#0e1015] text-white">Registro (Últimos)</option>
            </select>
          </div>

          {/* Vista (trasladada a la derecha, sólo iconos: Compacto y Adaptable) */}
          <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-xl p-1 ml-auto shrink-0" title="Vista: Compacto o Adaptable">
            <button
              type="button"
              onClick={() => handleSetDensity('compact')}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                gridDensity === 'compact' ? "bg-blue-600 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              )}
              title="Vista Compacta"
              aria-label="Vista Compacta"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetDensity('normal')}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer",
                gridDensity === 'normal' ? "bg-blue-600 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              )}
              title="Vista Adaptable"
              aria-label="Vista Adaptable"
            >
              <Grid2x2 className="w-4 h-4" />
            </button>
          </div>

          {/* Reset Filters button when active */}
          {(catalogFilterCategory !== 'TODAS' || catalogFilterSize !== 'TODAS' || selectedBrand !== 'TODAS' || searchTerm.trim()) && (
            <button
              onClick={() => {
                setCatalogFilterCategory('TODAS');
                setCatalogFilterSize('TODAS');
                setSelectedBrand('TODAS');
                setSearchTerm('');
              }}
              className="px-2 py-1 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 hover:text-white border border-red-800/60 text-[9px] font-bold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Restablecer filtros"
            >
              <X className="w-3 h-3" />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        {/* Brand chips */}
        <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/80 overflow-x-auto pb-0.5">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider shrink-0">Marca:</span>
          {allBrands.map(b => (
            <button
              key={b}
              onClick={() => setSelectedBrand(b)}
              className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                selectedBrand === b 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Status Legend & Viewport Efficiency Counter */}
      <div className="flex items-center justify-between text-[10px] font-bold px-2 py-1 flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-neutral-400 uppercase tracking-wider">Estado de Tallas:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span className="text-blue-400">Disponible</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="text-amber-300 font-bold">Reservado (Bloqueado)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-600"></span>
            <span className="text-neutral-500 line-through">Vendido</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-neutral-400 text-[10px] font-mono flex-wrap">
          {catalogFilterCategory !== 'TODAS' && (
            <span className="px-2 py-0.5 rounded-md bg-blue-950/70 text-blue-300 border border-blue-800/60 text-[9px] font-bold uppercase">
              Cat: {catalogFilterCategory}
            </span>
          )}
          {catalogFilterSize !== 'TODAS' && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 text-[9px] font-bold">
              Talla: {catalogFilterSize}
            </span>
          )}
          {selectedBrand !== 'TODAS' && (
            <span className="px-2 py-0.5 rounded-md bg-purple-950/70 text-purple-300 border border-purple-800/60 text-[9px] font-bold uppercase">
              Marca: {selectedBrand}
            </span>
          )}
          <span>Mostrando <strong className="text-white">{filteredCatalog.length}</strong> modelos</span>
          <span className="text-neutral-600">•</span>
          <span className="text-emerald-400 font-bold">Pantalla Adaptada</span>
        </div>
      </div>

      {/* Sneaker Grid - Click directly on image/card to register sale */}
      {filteredCatalog.length === 0 ? (
        <div className="py-16 text-center bg-[#0e1015] rounded-3xl border border-neutral-800 w-full space-y-3">
          <Package className="w-12 h-12 text-neutral-600 mx-auto opacity-30" />
          <p className="text-xs text-neutral-400 font-bold">No se encontraron modelos con los filtros seleccionados.</p>
          {(catalogFilterCategory !== 'TODAS' || catalogFilterSize !== 'TODAS' || selectedBrand !== 'TODAS' || searchTerm.trim()) && (
            <button
              type="button"
              onClick={() => {
                setCatalogFilterCategory('TODAS');
                setCatalogFilterSize('TODAS');
                setSelectedBrand('TODAS');
                setSearchTerm('');
              }}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Restablecer Filtros</span>
            </button>
          )}
        </div>
      ) : (
        <div 
          className="catalog-grid-adaptive gap-2.5 sm:gap-3.5 lg:gap-4 transition-all"
          style={{ 
            '--card-min-size': gridDensity === 'compact' ? '175px' : '205px' 
          } as React.CSSProperties}
        >
          {filteredCatalog.map((item, idx) => {
            return (
              <div
                key={`${item.key}_${idx}`}
                onClick={() => handleOpenFastSale(item)}
                className="bg-[#0e1015] rounded-2xl sm:rounded-3xl border border-neutral-800 hover:border-blue-600/50 overflow-hidden shadow-2xl flex flex-col group transition-all relative cursor-pointer hover:-translate-y-1 hover:shadow-blue-900/10"
                title="Toca para registrar venta o reserva de este modelo"
              >
                {/* Top of Image Header: Código y Sub-código juntos + Marca */}
                <div className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between gap-1">
                  <span className="text-xs font-black text-white font-mono tracking-wider truncate">
                    {item.fullCode}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-black text-neutral-300 uppercase tracking-widest bg-neutral-800 px-1.5 sm:px-2 py-0.5 rounded-lg border border-neutral-700 shrink-0">
                    {item.brand}
                  </span>
                </div>

                {/* Prominent High-Definition Photo Area with Strict 1:1 Square Aspect Ratio */}
                <div className="aspect-square w-full relative overflow-hidden bg-black flex items-center justify-center">
                  {item.image ? (
                    <img 
                      src={item.image} 
                      alt={item.fullCode} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                  ) : (
                    <div className="text-center p-3 sm:p-4">
                      <Package className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-600 mx-auto mb-1" />
                      <span className="text-[8px] sm:text-[9px] text-neutral-500 font-bold uppercase">Sin Foto</span>
                    </div>
                  )}

                  {item.isSoldOut && (
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="px-2.5 sm:px-3 py-1 bg-neutral-900 border border-neutral-700 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg">
                        Agotado
                      </span>
                    </div>
                  )}
                </div>

                {/* Tallas Strip: Blue for Available, Neutral Gray for Reserved, Strike-through for Sold */}
                <div className="p-2 sm:p-2.5 bg-neutral-900/90 border-t border-neutral-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="font-black text-neutral-400 uppercase tracking-wider">
                      Tallas:
                    </span>
                    <span className="font-mono font-bold text-neutral-400">
                      {item.availableCount} disp.
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 sm:gap-1.5 max-h-16 overflow-y-auto content-start">
                    {item.allSizesWithStatus.map((szObj, sIdx) => {
                      const isFilteredSize = catalogFilterSize !== 'TODAS' && szObj.size === catalogFilterSize;
                      if (szObj.status === 'VENDIDO') {
                        return (
                          <span 
                            key={szObj.key}
                            className={cn(
                              "px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-neutral-950 border border-neutral-800 text-[9px] sm:text-[10px] font-mono font-bold text-neutral-500 line-through opacity-50 cursor-not-allowed",
                              isFilteredSize && "border-neutral-600 opacity-60"
                            )}
                            title="Talla Vendida (Agotada)"
                          >
                            {szObj.size}
                          </span>
                        );
                      }
                      if (szObj.status === 'RESERVADO') {
                        return (
                          <span 
                            key={szObj.key}
                            className={cn(
                              "px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-amber-950/70 border border-amber-600/50 text-[9px] sm:text-[10px] font-mono font-bold text-amber-300 flex items-center gap-0.5 cursor-not-allowed opacity-90 select-none",
                              isFilteredSize && "ring-2 ring-amber-400 font-extrabold"
                            )}
                            title={`Talla ${szObj.size} RESERVADA (Bloqueada para otros movimientos hasta liberarse)`}
                          >
                            <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            <span>{szObj.size}</span>
                          </span>
                        );
                      }
                      return (
                        <button 
                          key={szObj.key}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFastSale(item, sIdx, szObj.size);
                          }}
                          className={cn(
                            "px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-blue-950/70 hover:bg-blue-600 border border-blue-600/50 hover:border-blue-400 text-[9px] sm:text-[10px] font-mono font-black text-blue-300 hover:text-white transition-all cursor-pointer shadow-sm hover:scale-110 active:scale-95",
                            isFilteredSize && "ring-2 ring-emerald-400 bg-blue-600 text-white font-extrabold scale-110 shadow-emerald-900/30"
                          )}
                          title={`Elegir Talla ${szObj.size} para registrar venta directa`}
                        >
                          {szObj.size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK SALE / RESERVATION MODAL (ACCESSIBLE BY TAPPING ANY PRODUCT) */}
      <AnimatePresence>
        {isModalOpen && targetProduct && targetVariant && (
          <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-brand-text-dim hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Header with Product Preview */}
              <div className="flex items-center gap-4 pb-5 border-b border-white/5 pr-8">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-neutral-700 bg-black shrink-0 shadow-md">
                  <img src={targetVariant.image || targetProduct.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-white font-mono uppercase">
                      {targetVariant.fullCode || targetProduct.code}
                    </span>
                    <span className="text-[10px] font-black bg-blue-950 text-blue-300 px-2 py-0.5 rounded-full border border-blue-600/40">
                      {targetProduct.brand}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white mt-1">{targetProduct.name}</h3>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleConfirmFastSale} className="space-y-4 pt-4">
                {/* 1. Seleccionar Talla (Identificación individual por par, sin seleccionar repetidas) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest flex items-center gap-2">
                      <span>Talla seleccionada:</span>
                      {selectedSize ? (
                        <span className="px-2 py-0.5 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs shadow-sm">
                          Talla {selectedSize}
                        </span>
                      ) : (
                        <span className="text-amber-400">Sin seleccionar</span>
                      )}
                    </label>
                    <span className="text-[9px] text-brand-text-dim font-mono">
                      {targetCatalogItem ? `${targetCatalogItem.availableCount} disp. / ${targetCatalogItem.allSizesWithStatus.length} total` : ''}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    Talla elegida automáticamente. Si prefieres otra talla, haz clic en cualquiera de las disponibles para cambiarla:
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {(targetCatalogItem?.allSizesWithStatus || targetVariant.sizes.map((s, idx) => ({
                      size: String(s).replace(/^T/i, '').trim(),
                      status: 'DISPONIBLE' as const,
                      key: `${s}-${idx}`
                    }))).map((szObj: any, sIdx: number) => {
                      const isSelected = selectedSizeIndex === sIdx;
                      const isSold = szObj.status === 'VENDIDO';
                      const isReserved = szObj.status === 'RESERVADO';
                      const isDisabled = isSold || isReserved;

                      return (
                        <button
                          key={szObj.key || sIdx}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            setSelectedSizeIndex(sIdx);
                            setSelectedSize(szObj.size);
                          }}
                          className={`px-3.5 py-2 rounded-xl font-mono text-xs font-black transition-all relative flex items-center gap-1 ${
                            isSold 
                              ? 'bg-neutral-950 text-neutral-600 border border-neutral-800 line-through cursor-not-allowed opacity-40'
                              : isReserved
                              ? 'bg-amber-950/60 text-amber-400 border border-amber-700/60 cursor-not-allowed opacity-80 select-none'
                              : isSelected
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400 scale-105 z-10 cursor-pointer'
                              : 'bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 cursor-pointer'
                          }`}
                          title={isSold ? 'Talla ya vendida (Agotada)' : isReserved ? 'Talla RESERVADA - Bloqueada para otro cliente hasta que se libere' : 'Talla disponible para venta o reserva'}
                        >
                          {isReserved && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                          <span>{szObj.size}</span>
                          {isReserved && <span className="text-[8px] font-sans font-bold text-amber-400/90 ml-0.5">Bloqueada</span>}
                          {isSelected && !isDisabled && (
                            <span className="ml-1 text-[9px] font-sans font-bold">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {targetCatalogItem?.allSizesWithStatus.some((s: any) => s.status === 'RESERVADO') && (
                    <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-800/40 flex items-center gap-2 text-[10px] text-amber-300">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Las tallas con candado están actualmente reservadas y quedan protegidas para no usarse en otra venta hasta liberarse.</span>
                    </div>
                  )}
                </div>

                {/* 2. Tipo de Operación: Compra Final vs Reserva */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                    Tipo de Operación *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsReservation(false)}
                      className={`py-3 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer text-center flex items-center justify-center gap-2 ${
                        !isReservation 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-500' 
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Compra Definitiva</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsReservation(true)}
                      className={`py-3 px-3 rounded-xl text-xs font-black uppercase transition-all cursor-pointer text-center flex items-center justify-center gap-2 ${
                        isReservation 
                          ? 'bg-blue-900/60 text-white shadow-lg shadow-blue-900/30 border border-blue-500' 
                          : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
                      }`}
                    >
                      <Tag className="w-4 h-4" />
                      <span>Reserva</span>
                    </button>
                  </div>
                </div>

                {/* Si es reserva: Campo de Monto Inicial Adelantado y Saldo Restante */}
                {isReservation && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-400" />
                        Condiciones de la Reserva
                      </span>
                      <span className="text-[10px] text-neutral-300 font-mono">
                        Total acordado: Bs. {finalPrice.toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-300 uppercase tracking-widest">
                          Monto Inicial Adelantado (Bs.) *
                        </label>
                        <input 
                          type="number"
                          step="0.01"
                          required
                          value={advancePayment}
                          onChange={(e) => setAdvancePayment(e.target.value)}
                          placeholder="Ej. 50"
                          className="w-full px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-sm font-black text-white font-mono outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                          Saldo Restante a Cancelar
                        </label>
                        <div className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-sm font-black text-neutral-300 font-mono flex items-center justify-between">
                          <span>Bs. {Math.max(0, finalPrice - (parseFloat(advancePayment) || 0)).toFixed(2)}</span>
                          <span className="text-[9px] text-neutral-400 uppercase font-sans">Pendiente</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 3. Monto y Forma de Pago */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                      Monto Acordado (Bs.) *
                    </label>
                    <input 
                      type="number"
                      step="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-sm font-black text-white font-mono outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Forma de Pago con botones dedicados sin select bug */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                      Forma de Pago *
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['QR', 'Efectivo', 'Tarjeta'] as const).map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPaymentMethod(m)}
                          className={`py-2 px-1 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1 ${
                            paymentMethod === m
                              ? 'bg-blue-600 text-white shadow-md border border-blue-400'
                              : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'
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
                </div>

                {/* 4. Selector de Cliente con Descuento Opcional */}
                <div className="space-y-2 p-3.5 bg-neutral-900/80 border border-neutral-800 rounded-2xl">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest flex items-center justify-between">
                      <span>Cliente Registrado (Opcional):</span>
                      <span className="text-[8px] text-blue-400 font-bold">Aplica descuento por nivel</span>
                    </label>
                    <select
                      value={selectedExistingCustomerName}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                      style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}
                      className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-xs font-bold text-white outline-none cursor-pointer"
                    >
                      <option value="" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                        -- Cliente Mostrador / Nuevo Comprador --
                      </option>
                      {existingCustomersList.map(c => {
                        const tier = getCustomerTier(c.count);
                        return (
                          <option key={c.name} value={c.name} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                            {c.name} • {tier.toUpperCase()} ({c.count} pares)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Descuento por nivel de cliente */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[9px] font-bold text-brand-text-dim">Descuento Especial (%):</span>
                    <div className="flex items-center gap-1">
                      {['0', '5', '7', '10', '15'].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountPercent(pct)}
                          className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all cursor-pointer ${
                            discountPercent === pct 
                              ? 'bg-blue-600 text-white font-black' 
                              : 'bg-neutral-800 text-neutral-300 hover:text-white'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Final Price Breakdown */}
                <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black text-brand-text-dim uppercase block">Total a Cobrar:</span>
                    {discountVal > 0 && (
                      <span className="text-[9px] text-blue-400">Descuento: -{formatCurrency(discountVal)}</span>
                    )}
                  </div>
                  <span className="text-xl font-black text-white font-mono">
                    {formatCurrency(finalPrice)}
                  </span>
                </div>

                {/* Toggle to Expand Detailed Fields */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDetailedFields(!showDetailedFields)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-black uppercase text-brand-text-dim hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>{showDetailedFields ? 'Ocultar Datos de Envío y Fecha' : 'Agregar Celular, Ciudad, Envío o Modificar Fecha'}</span>
                    {showDetailedFields ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Detailed Fields Section */}
                <AnimatePresence>
                  {showDetailedFields && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden space-y-3 pt-2"
                    >
                      {/* Fecha y Hora Exacta de Registro Calibrada */}
                      <div className="p-2.5 bg-neutral-900 border border-emerald-500/20 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[8px] font-black text-emerald-400 uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-400" /> Fecha y Hora Oficial:
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomSaleDate(getLocalDateString());
                              setCustomSaleTime(getLocalTimeString());
                            }}
                            className="text-[8px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded cursor-pointer"
                          >
                            ⚡ Calibrar a Ahora ({getLocalDateString()})
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={customSaleDate}
                            onChange={(e) => setCustomSaleDate(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-emerald-500"
                          />
                          <input
                            type="time"
                            value={customSaleTime}
                            onChange={(e) => setCustomSaleTime(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-xs font-bold text-white outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-brand-text-dim uppercase">Nombre Completo:</label>
                          <input 
                            type="text"
                            value={customClientName}
                            onChange={(e) => setCustomClientName(e.target.value)}
                            placeholder="Nombre del cliente..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-brand-text-dim uppercase">Celular / WhatsApp:</label>
                          <input 
                            type="tel"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            placeholder="77234567..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Ciudad: 9 Departamentos de Bolivia */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-brand-text-dim uppercase">Ciudad:</label>
                          <select
                            value={clientCity}
                            onChange={(e) => setClientCity(e.target.value)}
                            style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white outline-none cursor-pointer"
                          >
                            {BOLIVIA_DEPARTMENTS.map(dept => (
                              <option key={dept} value={dept} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Método Logístico */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-brand-text-dim uppercase">Logística:</label>
                          <select
                            value={logistics}
                            onChange={(e) => setLogistics(e.target.value as any)}
                            style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}
                            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-xs text-white outline-none cursor-pointer"
                          >
                            <option value="En tienda" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>En tienda</option>
                            <option value="Delivery o entrega" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Delivery o entrega</option>
                            <option value="Envío interdepartamental" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>Envío interdepartamental</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!selectedSize}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xs text-white uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{isReservation ? 'Registrar Reserva' : 'Completar Venta y Generar Factura'}</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CATALOG PDF DOWNLOAD SELECTION MODAL */}
      <AnimatePresence>
        {isPdfModalOpen && (
          <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-[#0e1015] border border-neutral-800 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl relative my-auto max-h-[92vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-neutral-800 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                    <FileDown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      Descargar Catálogo en PDF
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-neutral-800 text-neutral-300 border border-neutral-700 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-blue-400" />
                        Marca de Agua Anticopia
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Filtra por talla disponible, categoría, marca o código. Organiza imágenes en 4:3 sin ensanchamiento y con marca de agua de la tienda.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsPdfModalOpen(false)}
                  className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Advanced Filter Toolbar for PDF Catalog */}
              <div className="py-3 border-b border-neutral-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Filter: Code or Sub-code Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={pdfFilterSearch}
                      onChange={(e) => setPdfFilterSearch(e.target.value)}
                      placeholder="Código o subcódigo..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder:text-neutral-500 outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Filter: Tallas Disponibles en Inventario */}
                  <div className="relative">
                    <select
                      value={pdfFilterSize}
                      onChange={(e) => setPdfFilterSize(e.target.value)}
                      style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="TODAS" style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                        Talla Disponible: TODAS
                      </option>
                      {availableSizesInCatalog.map(sz => (
                        <option key={sz} value={sz} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                          Talla disponible: {sz}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter: Categoría */}
                  <div className="relative">
                    <select
                      value={pdfFilterCategory}
                      onChange={(e) => setPdfFilterCategory(e.target.value)}
                      style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none cursor-pointer"
                    >
                      {availableCategoriesInCatalog.map(cat => (
                        <option key={cat} value={cat} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                          {cat === 'TODAS' ? 'Categoría: TODAS' : `Categoría: ${cat.toUpperCase()}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter: Marca */}
                  <div className="relative">
                    <select
                      value={pdfFilterBrand}
                      onChange={(e) => setPdfFilterBrand(e.target.value)}
                      style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white outline-none cursor-pointer"
                    >
                      {availableBrandsInCatalog.map(b => (
                        <option key={b} value={b} style={{ backgroundColor: '#0f172a', color: '#f8fafc' }}>
                          {b === 'TODAS' ? 'Marca: TODAS' : `Marca: ${b}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sub-row: Density (2, 3 or 4 cols) & Quick Select Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                  {/* Density Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-neutral-400">
                      Fotos por Fila en PDF:
                    </span>
                    <div className="flex items-center bg-neutral-900 rounded-xl p-0.5 border border-neutral-800">
                      {(['auto', '2', '3', '4'] as const).map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setPdfDensity(d)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer",
                            pdfDensity === d
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-neutral-400 hover:text-white"
                          )}
                        >
                          {d === 'auto' ? 'Auto' : `${d} por fila`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selection Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSelectFilteredPdf}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-blue-400 hover:text-white rounded-lg text-[10px] font-bold border border-neutral-700 cursor-pointer flex items-center gap-1"
                    >
                      <CheckSquare className="w-3 h-3" />
                      <span>Seleccionar Filtrados ({pdfFilteredCatalog.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeselectFilteredPdf}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-lg text-[10px] font-bold border border-neutral-700 cursor-pointer flex items-center gap-1"
                    >
                      <Square className="w-3 h-3" />
                      <span>Deseleccionar Filtrados</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleSelectAllPdf}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-blue-400 hover:text-white rounded-lg text-[10px] font-bold border border-neutral-700 cursor-pointer"
                    >
                      {selectedPdfItemKeys.length === catalogItems.length ? 'Limpiar Todo' : 'Seleccionar Todo'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status counter */}
              <div className="flex items-center justify-between py-2 text-xs font-mono">
                <span className="text-neutral-400">
                  Mostrando <strong className="text-white">{pdfFilteredCatalog.length}</strong> modelos filtrados de {catalogItems.length}
                </span>
                <span className="text-blue-400 font-bold">
                  {selectedPdfItemKeys.length} seleccionados para el catálogo PDF
                </span>
              </div>

              {/* Grid of selectable products */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 py-3 overflow-y-auto max-h-[46vh] pr-1">
                {pdfFilteredCatalog.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-neutral-400 text-xs">
                    No hay modelos disponibles con los filtros seleccionados (talla, categoría o marca).
                  </div>
                ) : (
                  pdfFilteredCatalog.map(it => {
                    const isSelected = selectedPdfItemKeys.includes(it.key);
                    const availableSizesList = it.allSizesWithStatus.filter(s => s.status === 'DISPONIBLE').map(s => s.size);

                    return (
                      <div
                        key={it.key}
                        onClick={() => handleTogglePdfItem(it.key)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                          isSelected 
                            ? 'bg-blue-950/40 border-blue-500/70 shadow-md ring-1 ring-blue-500/30' 
                            : 'bg-neutral-900/60 border-neutral-800 opacity-60 hover:opacity-100 hover:border-neutral-700'
                        }`}
                      >
                        {/* 4:3 Thumbnail Preview */}
                        <div className="w-16 h-12 rounded-xl overflow-hidden bg-black shrink-0 border border-neutral-700 relative">
                          {it.image ? (
                            <img src={it.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-neutral-500">
                              Sin Foto
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="overflow-hidden flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black text-white font-mono block truncate">
                              {it.fullCode}
                            </span>
                            <span className="text-[10px] text-neutral-300 font-bold uppercase shrink-0">
                              {it.brand}
                            </span>
                          </div>

                          <span className="text-[10px] text-neutral-400 block truncate mt-0.5">
                            {it.colorName} • {it.category}
                          </span>

                          {/* Available sizes pills */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {availableSizesList.slice(0, 5).map((sz, szI) => (
                              <span
                                key={szI}
                                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-md bg-neutral-800 border border-neutral-700 text-[9px] font-mono font-bold text-neutral-200"
                              >
                                {sz}
                              </span>
                            ))}
                            {availableSizesList.length > 5 && (
                              <span className="text-[9px] font-mono text-neutral-400 self-center">
                                +{availableSizesList.length - 5}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Checkbox indicator */}
                        <div className="shrink-0 text-blue-400 pt-0.5">
                          {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-neutral-600" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Watermark Security Info Banner */}
              <div className="mt-2 p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center gap-2.5 text-[11px] text-neutral-300">
                <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">
                  El PDF generado mantendrá proporción 4:3 sin ensanchamiento e incluirá la marca de agua oficial de la tienda para protección ante copias.
                </span>
              </div>

              {/* Action Buttons: Pure WHITE export button */}
              <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-3 mt-3">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-bold cursor-pointer transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={selectedPdfItemKeys.length === 0 || isGeneratingPdf}
                  onClick={handleGenerateCatalogPDF}
                  className="px-6 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-xl cursor-pointer disabled:opacity-40 transition-all"
                >
                  <Download className="w-4 h-4 text-black" />
                  <span>{isGeneratingPdf ? 'Generando Catálogo con Marca de Agua...' : `Exportar Catálogo PDF (${selectedPdfItemKeys.length})`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Generated Invoice Modal View after sale */}
      {newlyCreatedInvoice && (
        <InvoiceModal
          invoice={newlyCreatedInvoice}
          onClose={() => setNewlyCreatedInvoice(null)}
          onStatusChange={async (inv, newStatus) => {
            const updated = { ...inv, status: newStatus };
            await StorageService.saveInvoice(updated);
            setInvoices(StorageService.getInvoices());
            setNewlyCreatedInvoice(updated);
          }}
        />
      )}
    </div>
  );
}
