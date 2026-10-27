/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Palette, 
  Check, 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Package, 
  Filter, 
  CheckCircle2, 
  Table as TableIcon, 
  Crop, 
  X, 
  ArrowUpDown,
  Upload,
  FileCode,
  Database,
  Lock
} from 'lucide-react';
import { Product, ProductColorVariant, Sale } from '../types';
import { StorageService } from '../lib/storage';
import { cn, formatCurrency, formatDateTime } from '../lib/utils';
import { compressImage } from '../lib/indexedDb';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import ImageCropModal from './ImageCropModal';

interface InventorySectionProps {
  products: Product[];
  setProducts: (products: Product[]) => void;
  sales: Sale[];
}

const BRANDS_LIST = [
  'KNUP',
  'SHARQ',
  'MATT MILL',
  'NIKE',
  'PUMA',
  'ADIDAS',
  'NEW BALANCE',
  'BUSS',
  'LACOSTE',
  'I-RUN',
  'AMIRI',
  'VANS',
  'Otros'
] as const;

const ORIGINS_LIST = [
  'Original',
  '5g',
  'brasilero',
  'peruano',
  'vietnamita',
  'chino',
  'coreano',
  'Otros'
] as const;

const CATEGORIES_LIST = [
  'casual',
  'deportivo',
  'running',
  'trekking',
  'urbano',
  'clásico',
  'Otros'
] as const;

const QUICK_SIZES = ['37', '38', '39', '40', '41', '42', '43', '44', '45'];

export default function InventorySection({ products, setProducts, sales }: InventorySectionProps) {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Edit box reference for smooth slide navigation
  const editFormRef = useRef<HTMLDivElement>(null);
  const inventoryTopRef = useRef<HTMLDivElement>(null);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  // JSON Import & Export State
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<{
    fileName: string;
    products: Product[];
    totalVariants: number;
    totalSizes: number;
  } | null>(null);
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null);

  // Filters & Sorting: 'code' is the default sorting requested
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('TODAS');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('TODAS');
  const [sortBy, setSortBy] = useState<'code' | 'brand' | 'created_asc' | 'created_desc'>('code');

  // --- PAGE 1: Cost, Units, Price ---
  const [code, setCode] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [packageType, setPackageType] = useState<'docena' | 'media_docena' | 'dos_docenas' | 'manual'>('docena');
  const [manualUnits, setManualUnits] = useState('12');
  const [salePrice, setSalePrice] = useState('');
  const [marginPercent, setMarginPercent] = useState('50');

  const computedUnitsCount = packageType === 'docena' 
    ? 12 
    : packageType === 'media_docena' 
    ? 6 
    : packageType === 'dos_docenas'
    ? 24
    : Math.max(1, parseInt(manualUnits) || 1);

  const parsedTotalCost = parseFloat(totalCost) || 0;
  const computedUnitCost = parsedTotalCost > 0 && computedUnitsCount > 0 
    ? parsedTotalCost / computedUnitsCount 
    : 0;

  const suggestedPrice = computedUnitCost > 0 
    ? Math.round(computedUnitCost * (1 + (parseFloat(marginPercent) || 50) / 100))
    : 0;

  useEffect(() => {
    if (!salePrice && suggestedPrice > 0 && !editingProductId) {
      setSalePrice(suggestedPrice.toString());
    }
  }, [suggestedPrice, editingProductId]);

  // --- PAGE 2: Details & Colors ---
  const [brand, setBrand] = useState<string>('KNUP');
  const [customBrand, setCustomBrand] = useState('');
  const [origin, setOrigin] = useState<string>('Original'); // Default: Original
  const [customOrigin, setCustomOrigin] = useState('');
  const [category, setCategory] = useState<string>('urbano');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');

  const [variants, setVariants] = useState<ProductColorVariant[]>([
    {
      id: crypto.randomUUID(),
      colorName: '',
      subCode: 'F1',
      fullCode: '',
      image: '',
      sizes: []
    }
  ]);
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [currentSizeInput, setCurrentSizeInput] = useState('');

  const totalAssignedSizes = variants.reduce((sum, v) => sum + v.sizes.length, 0);
  const sizesMatchUnits = totalAssignedSizes === computedUnitsCount;
  const sizesDiff = computedUnitsCount - totalAssignedSizes;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetWizard = () => {
    setIsFormVisible(false);
    setWizardStep(1);
    setEditingProductId(null);
    setCode('');
    setTotalCost('');
    setPackageType('docena');
    setManualUnits('12');
    setSalePrice('');
    setBrand('KNUP');
    setCustomBrand('');
    setOrigin('Original');
    setCustomOrigin('');
    setCategory('urbano');
    setCustomCategory('');
    setDescription('');
    setVariants([
      {
        id: crypto.randomUUID(),
        colorName: '',
        subCode: 'F1',
        fullCode: '',
        image: '',
        sizes: []
      }
    ]);
    setActiveVariantIndex(0);
    setCurrentSizeInput('');
  };

  const handleStartEdit = (product: Product) => {
    setEditingProductId(product.id);
    setCode(product.code);
    setTotalCost((product.totalCost || (product.unitCost || 0) * (product.unitsCount || product.sizes.length)).toString());
    setPackageType(product.packageType || 'manual');
    setManualUnits((product.unitsCount || product.sizes.length).toString());
    setSalePrice((product.salePrice || 0).toString());

    if (BRANDS_LIST.includes(product.brand as any)) {
      setBrand(product.brand);
      setCustomBrand('');
    } else {
      setBrand('Otros');
      setCustomBrand(product.brand || '');
    }

    if (ORIGINS_LIST.includes(product.origin as any)) {
      setOrigin(product.origin);
      setCustomOrigin('');
    } else {
      setOrigin('Otros');
      setCustomOrigin(product.origin || '');
    }

    if (CATEGORIES_LIST.includes(product.category as any)) {
      setCategory(product.category);
      setCustomCategory('');
    } else {
      setCategory('Otros');
      setCustomCategory(product.category || '');
    }

    setDescription(product.description || '');

    if (product.variants && product.variants.length > 0) {
      setVariants(product.variants);
    } else {
      setVariants([
        {
          id: crypto.randomUUID(),
          colorName: 'Color Principal',
          subCode: 'F1',
          fullCode: `${product.code} F1`,
          image: product.image,
          sizes: product.sizes
        }
      ]);
    }

    setActiveVariantIndex(0);
    setWizardStep(1);
    setIsFormVisible(true);

    // Smoothly slide to the edit box instead of staying in the same place
    setTimeout(() => {
      if (editFormRef.current) {
        editFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const el = document.getElementById('inventory-edit-box');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  };

  // Image Cropping Modal State
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>('');

  const handleVariantImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCropImageSrc(reader.result);
          setCropModalOpen(true);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleCropComplete = (croppedBase64: string) => {
    setVariants(prev => {
      const next = [...prev];
      if (next[activeVariantIndex]) {
        next[activeVariantIndex] = {
          ...next[activeVariantIndex],
          image: croppedBase64
        };
      }
      return next;
    });
  };

  const handleAddSizeToActiveVariant = (sizeToAdd?: string) => {
    const s = (sizeToAdd !== undefined ? sizeToAdd : currentSizeInput).trim();
    if (!s) return;

    if (totalAssignedSizes >= computedUnitsCount) {
      alert(`Ya se completaron las ${computedUnitsCount} unidades registradas en la Página 1.`);
      return;
    }

    setVariants(prev => {
      const next = [...prev];
      const current = next[activeVariantIndex];
      next[activeVariantIndex] = {
        ...current,
        sizes: [...current.sizes, s]
      };
      return next;
    });

    if (sizeToAdd === undefined) {
      setCurrentSizeInput('');
    }
  };

  const handleRemoveSizeFromActiveVariant = (idx: number) => {
    setVariants(prev => {
      const next = [...prev];
      const current = next[activeVariantIndex];
      next[activeVariantIndex] = {
        ...current,
        sizes: current.sizes.filter((_, i) => i !== idx)
      };
      return next;
    });
  };

  const handleAddNewColorVariant = () => {
    const nextSub = `F${variants.length + 1}`;
    const newVar: ProductColorVariant = {
      id: crypto.randomUUID(),
      colorName: '',
      subCode: nextSub,
      fullCode: `${code.trim().toUpperCase()} ${nextSub}`,
      image: '',
      sizes: []
    };
    setVariants(prev => [...prev, newVar]);
    setActiveVariantIndex(variants.length);
  };

  const handleRemoveColorVariant = (vIdx: number) => {
    if (variants.length <= 1) return;
    setVariants(prev => prev.filter((_, i) => i !== vIdx));
    setActiveVariantIndex(Math.max(0, vIdx - 1));
  };

  const handleUpdateVariantField = (field: keyof ProductColorVariant, value: string) => {
    setVariants(prev => {
      const next = [...prev];
      const current = { ...next[activeVariantIndex], [field]: value };
      if (field === 'subCode' || field === 'colorName') {
        const cleanSub = field === 'subCode' ? value.trim().toUpperCase() : current.subCode;
        current.fullCode = cleanSub ? `${code.trim().toUpperCase()} ${cleanSub}` : code.trim().toUpperCase();
      }
      next[activeVariantIndex] = current;
      return next;
    });
  };

  const handleProceedToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || parsedTotalCost <= 0 || computedUnitsCount <= 0) {
      alert('Por favor completa todos los campos del costo y unidades.');
      return;
    }
    setVariants(prev => prev.map(v => ({
      ...v,
      fullCode: v.subCode ? `${code.trim().toUpperCase()} ${v.subCode.trim().toUpperCase()}` : code.trim().toUpperCase()
    })));
    setWizardStep(2);
  };

  const handleSaveStock = async (keepOpenForNext: boolean = false) => {
    if (!sizesMatchUnits) {
      alert(`Las tallas asignadas (${totalAssignedSizes}) deben coincidir exactamente con las ${computedUnitsCount} unidades del lote.`);
      return;
    }

    const firstImage = variants.find(v => v.image)?.image || '';
    if (!firstImage) {
      alert('Por favor carga la foto de catálogo de los tenis.');
      return;
    }

    const finalBrand = brand === 'Otros' ? (customBrand.trim() || 'Genérico') : brand;
    const finalOrigin = origin === 'Otros' ? (customOrigin.trim() || 'Sin origen') : origin;
    const finalCategory = category === 'Otros' ? (customCategory.trim() || 'Calzado') : category;
    const finalSalePrice = parseFloat(salePrice) || suggestedPrice || computedUnitCost;

    const allSizesFlat: string[] = [];
    variants.forEach(v => allSizesFlat.push(...v.sizes));

    const finalProduct: Product = {
      id: editingProductId || crypto.randomUUID(),
      code: code.trim().toUpperCase(),
      name: `${finalBrand} ${finalCategory.toUpperCase()} ${code.trim().toUpperCase()}`,
      brand: finalBrand,
      origin: finalOrigin,
      category: finalCategory,
      description: description.trim(),
      totalCost: parsedTotalCost,
      packageType,
      unitsCount: computedUnitsCount,
      unitCost: computedUnitCost,
      suggestedSalePrice: suggestedPrice,
      salePrice: finalSalePrice,
      costPrice: computedUnitCost,
      variants,
      image: firstImage,
      sizes: allSizesFlat,
      createdAt: Date.now()
    };

    await StorageService.saveProduct(finalProduct);
    setProducts(StorageService.getProducts());

    confetti({
      particleCount: 75,
      spread: 60,
      origin: { y: 0.6 }
    });

    if (keepOpenForNext) {
      resetWizard();
      setIsFormVisible(true);
    } else {
      resetWizard();
    }

    // Scroll to the very top of the inventory section automatically when registration is completed
    setTimeout(() => {
      if (inventoryTopRef.current) {
        inventoryTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
  };

  const deleteProduct = async (id: string) => {
    // Immediately remove from UI state so it disappears instantly and cleanly
    setProducts(products.filter(p => p.id !== id));
    setProductToDelete(null);
    // Persist deletion to StorageService & Firestore
    await StorageService.deleteProduct(id);
  };

  // Flatten every product and its color variants into an Excel-like line item row!
  // Structure strictly requested:
  // 1. Foto miniatura del producto
  // 2. Marca
  // 3. Código y Sub-código juntos (ej. 8001 F1)
  // 4. Tallas (sin ninguna T, solo números con espacios)
  // 5. Un espacio en blanco que ocupe el doble de espacio (con nombre DESCRIPCIÓN)
  const flattenedInventoryRows = products.flatMap(p => {
    const vars = p.variants && p.variants.length > 0 ? p.variants : [
      {
        id: 'var-default',
        colorName: 'Estándar',
        subCode: '',
        fullCode: p.code,
        image: p.image,
        sizes: p.sizes
      }
    ];

    return vars.map(v => {
      const codeToMatch = (v.fullCode || p.code).trim().toLowerCase();
      
      // Calculate sales for this variant/product
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

      // Map each physical size with its true status
      const sizesWithStatus = v.sizes.map((sz, sIdx) => {
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

      // Group sizes to show counts e.g. "38(x2), 39, 40(x3)"
      const sizeMap: Record<string, number> = {};
      v.sizes.forEach(sz => {
        sizeMap[sz] = (sizeMap[sz] || 0) + 1;
      });

      const formattedSizesString = Object.entries(sizeMap)
        .sort((a,b) => a[0].localeCompare(b[0]))
        .map(([sz, cnt]) => cnt > 1 ? `${sz} (x${cnt})` : `${sz}`)
        .join(', ');

      // Clean space-separated numbers without any 'T' prefix
      const cleanSizesNumbers = v.sizes
        .map(sz => String(sz).replace(/^T/i, '').trim())
        .filter(Boolean)
        .join('   ');

      // Available sizes with markers for Excel/text exports e.g. "38  39(Reserva)  40(Vendida)"
      const cleanSizesAnnotated = sizesWithStatus
        .map(s => s.status === 'VENDIDO' ? `${s.size}[Vendido]` : s.status === 'RESERVADO' ? `${s.size}[Reserva]` : s.size)
        .join('   ');

      const availableStock = sizesWithStatus.filter(s => s.status === 'DISPONIBLE').length;

      return {
        productId: p.id,
        parentProduct: p,
        variantId: v.id,
        image: v.image || p.image,
        brand: p.brand || 'KNUP',
        origin: p.origin || 'Original',
        fullCode: v.fullCode || p.code,
        colorName: v.colorName || 'Principal',
        sizesFormatted: formattedSizesString,
        cleanSizes: cleanSizesNumbers || 'Sin tallas',
        cleanSizesAnnotated: cleanSizesAnnotated || 'Sin tallas',
        sizesWithStatus,
        description: p.description || '',
        totalUnits: v.sizes.length,
        availableUnits: availableStock,
        unitCost: p.unitCost || p.costPrice || 0,
        salePrice: p.salePrice || 0,
      };
    });
  });

  // Filtered and sorted rows: Código is the default sorting requested
  const filteredRows = React.useMemo(() => {
    const list = flattenedInventoryRows.filter(row => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = 
        row.fullCode.toLowerCase().includes(q) ||
        row.brand.toLowerCase().includes(q) ||
        row.colorName.toLowerCase().includes(q) ||
        row.sizesFormatted.toLowerCase().includes(q) ||
        row.cleanSizes.includes(q);

      const matchesBrand = selectedBrandFilter === 'TODAS' || row.brand === selectedBrandFilter;
      const matchesCategory = selectedCategoryFilter === 'TODAS' || row.parentProduct.category === selectedCategoryFilter;

      return matchesSearch && matchesBrand && matchesCategory;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'code') {
        // Natural numerical comparison: 8001 comes before 9020, F1 before F2
        return (a.fullCode || '').localeCompare(b.fullCode || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'brand') {
        const brandComp = (a.brand || '').localeCompare(b.brand || '', undefined, { sensitivity: 'base' });
        if (brandComp !== 0) return brandComp;
        return (a.fullCode || '').localeCompare(b.fullCode || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'created_asc') {
        // Orden en que se agregó originalmente al sistema
        const aTime = a.parentProduct.createdAt || 0;
        const bTime = b.parentProduct.createdAt || 0;
        return aTime - bTime;
      }
      if (sortBy === 'created_desc') {
        // Últimos agregados primero
        const aTime = a.parentProduct.createdAt || 0;
        const bTime = b.parentProduct.createdAt || 0;
        return bTime - aTime;
      }
      return 0;
    });
  }, [flattenedInventoryRows, searchTerm, selectedBrandFilter, selectedCategoryFilter, sortBy]);

  // Export Inventory Excel with ONLY the 5 requested columns:
  // 1. foto del producto
  // 2. marca
  // 3. código y subcódigo juntos
  // 4. tallas (solo números con espacios, sin ninguna T)
  // 5. espacio en blanco con nombre DESCRIPCIÓN (el doble de espacio que las demás celdas)
  const handleExportInventoryExcel = () => {
    const dataForExcel = filteredRows.map(r => ({
      'FOTO DEL PRODUCTO': '[ IMAGEN ]',
      'MARCA': r.brand,
      'CÓDIGO Y SUBCÓDIGO JUNTOS': r.fullCode,
      'TALLAS': r.cleanSizesAnnotated || r.cleanSizes,
      'DESCRIPCIÓN': r.description || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataForExcel);

    // Column widths: Double width for DESCRIPCIÓN
    ws['!cols'] = [
      { wch: 20 }, // FOTO DEL PRODUCTO
      { wch: 20 }, // MARCA
      { wch: 26 }, // CÓDIGO Y SUBCÓDIGO JUNTOS
      { wch: 32 }, // TALLAS
      { wch: 65 }, // DESCRIPCIÓN (el doble de espacio que las demás celdas)
    ];

    // Page setup for vertical Letter printing with 2cm top and 1cm side/bottom margins
    ws['!pageSetup'] = { 
      orientation: 'portrait', 
      paperSize: 1 // 1 = Letter paper size
    };
    ws['!margins'] = { 
      left: 0.394,   // 1 cm = ~0.394 in
      right: 0.394,  // 1 cm = ~0.394 in
      top: 0.787,    // 2 cm = ~0.787 in
      bottom: 0.394, // 1 cm = ~0.394 in
      header: 0.2, 
      footer: 0.2 
    };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `SHARUI_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export PDF of Inventory in VERTICAL LETTER (Carta Vertical, Margen superior 2cm, laterales e inferior 1cm)
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportInventoryPDF = async () => {
    setIsExportingPdf(true);
    try {
      // Filtrar ÚNICAMENTE modelos con stock disponible y excluir modelos 100% agotados
      const availableModels = filteredRows.filter(r => (r.availableUnits || 0) > 0);

      if (availableModels.length === 0) {
        alert("No hay productos con tallas disponibles para exportar en este momento.");
        setIsExportingPdf(false);
        return;
      }

      // Conteo total de pares disponibles en todo el inventario/selección
      const totalAvailablePairs = availableModels.reduce((acc, r) => acc + (r.availableUnits || 0), 0);

      // Formato Carta Vertical (215.9 mm x 279.4 mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = 215.9;
      const pageHeight = 279.4;
      const marginLeft = 10;   // 1 cm margen izquierdo
      const marginRight = 10;  // 1 cm margen derecho
      const marginTop = 14;    // margen superior calibrado
      const marginBottom = 10; // 1 cm margen inferior
      const availableWidth = pageWidth - marginLeft - marginRight; // 195.9 mm
      let y = marginTop;

      // Altura compacta por fila de modelo (19.4 mm permite entre 11 y 12 modelos por página)
      const rowHeight = 19.4;

      const renderHeader = (pageNumber: number) => {
        if (pageNumber === 1) {
          // Encabezado principal en la primera hoja
          doc.setFillColor(15, 23, 42); // slate-900
          doc.rect(marginLeft, y, availableWidth, 11, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('SHARUI ENTERPRISE - PLANILLA DE INVENTARIO DISPONIBLE', marginLeft + 4, y + 7.2);
          
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(148, 163, 184);
          doc.text(`Página ${pageNumber} • Cochabamba • ${new Date().toLocaleDateString()}`, pageWidth - marginRight - 55, y + 7.2);
          y += 12;
        } else {
          // Encabezado compacto en hojas subsiguientes
          doc.setFillColor(248, 250, 252);
          doc.rect(marginLeft, y, availableWidth, 6, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(marginLeft, y, availableWidth, 6, 'S');
          doc.setTextColor(71, 85, 105);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('SHARUI ENTERPRISE - INVENTARIO DISPONIBLE', marginLeft + 3, y + 4.2);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(148, 163, 184);
          doc.text(`Página ${pageNumber}`, pageWidth - marginRight - 16, y + 4.2);
          y += 7;
        }

        // ESPACIO ENTRE ENCABEZADO Y TÍTULOS DE COLUMNAS:
        // CONTEO DE PARES DISPONIBLES CON NÚMEROS EN COLOR ROJO (SOLO EN LA 1RA HOJA)
        if (pageNumber === 1) {
          doc.setFillColor(254, 242, 242); // red-50 sutil
          doc.rect(marginLeft, y, availableWidth, 5.8, 'F');
          doc.setDrawColor(254, 202, 202); // red-200 border
          doc.rect(marginLeft, y, availableWidth, 5.8, 'S');

          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59); // slate-800
          const labelPrefix = 'TOTAL PARES DISPONIBLES: ';
          doc.text(labelPrefix, marginLeft + 3, y + 4.0);

          const prefixWidth = doc.getTextWidth(labelPrefix);
          // NÚMERO EN COLOR ROJO
          doc.setTextColor(220, 38, 38); // red-600 vibrante
          doc.setFontSize(8.5);
          doc.text(`${totalAvailablePairs} PARES EN STOCK`, marginLeft + 3 + prefixWidth, y + 4.1);

          // Contador secundario a la derecha
          doc.setFontSize(6.8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 116, 139);
          doc.text(`${availableModels.length} modelos con disponibilidad • Exclusivo tallas disponibles`, pageWidth - marginRight - 4, y + 4.0, { align: 'right' });

          y += 6.8;
        }


        // CELDAS CON TÍTULOS DE CADA COLUMNA EXACTAMENTE CON LOS NOMBRES SOLICITADOS:
        // IMAGE (20mm) | MARCA (24mm) | CÓDIGO (34mm) | TALLAS (46mm) | DESCRIPCIÓN (CONTROL FÍSICO) (71.9mm) = 195.9mm
        doc.setFillColor(241, 245, 249);
        doc.rect(marginLeft, y, availableWidth, 6, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(marginLeft, y, availableWidth, 6, 'S');

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7.2);
        doc.setFont('helvetica', 'bold');
        doc.text('IMAGE', marginLeft + 2, y + 4.2);
        doc.text('MARCA', marginLeft + 22, y + 4.2);
        doc.text('CÓDIGO', marginLeft + 46, y + 4.2);
        doc.text('TALLAS', marginLeft + 82, y + 4.2);
        doc.text('DESCRIPCIÓN (CONTROL FÍSICO)', marginLeft + 128, y + 4.2);

        y += 6.5;
      };

      let currentPage = 1;
      renderHeader(currentPage);

      // Precalcular dimensiones y aspecto real de imágenes para no deformarlas ni alargarlas
      const imageAspectCache: Record<string, number> = {};
      const loadAspect = (src: string): Promise<number> => {
        return new Promise((resolve) => {
          if (!src || !src.startsWith('data:image')) {
            resolve(4 / 3);
            return;
          }
          if (imageAspectCache[src]) {
            resolve(imageAspectCache[src]);
            return;
          }
          const img = new Image();
          img.onload = () => {
            const w = img.naturalWidth || 4;
            const h = img.naturalHeight || 3;
            const ratio = w / h;
            imageAspectCache[src] = ratio;
            resolve(ratio);
          };
          img.onerror = () => resolve(4 / 3);
          img.src = src;
        });
      };

      // RENDERIZAR CADA MODELO DISPONIBLE
      for (let i = 0; i < availableModels.length; i++) {
        const row = availableModels[i];

        // Verificar si la fila sobrepasa la página
        if (y + rowHeight > pageHeight - marginBottom) {
          doc.addPage();
          currentPage++;
          y = marginTop;
          renderHeader(currentPage);
        }

        // LÍNEA SEPARADORA ENTRE CADA MODELO (CÓDIGO) DIFERENTE
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.35);
        doc.line(marginLeft, y + rowHeight, marginLeft + availableWidth, y + rowHeight);

        // IMAGEN: Conserva la foto real sin alargarla, y casi juntas verticalmente
        const maxImgBoxW = 18;
        const maxImgBoxH = 16.5;
        const imgBoxX = marginLeft + 1;
        const imgBoxY = y + 1.45;

        if (row.image && row.image.startsWith('data:image')) {
          try {
            const ratio = await loadAspect(row.image);
            const boxRatio = maxImgBoxW / maxImgBoxH;
            let drawW = maxImgBoxW;
            let drawH = maxImgBoxH;

            if (ratio > boxRatio) {
              drawW = maxImgBoxW;
              drawH = maxImgBoxW / ratio;
            } else {
              drawH = maxImgBoxH;
              drawW = maxImgBoxH * ratio;
            }

            const drawX = imgBoxX + (maxImgBoxW - drawW) / 2;
            const drawY = imgBoxY + (maxImgBoxH - drawH) / 2;

            doc.addImage(row.image, 'JPEG', drawX, drawY, drawW, drawH);
          } catch {
            doc.setFillColor(241, 245, 249);
            doc.rect(imgBoxX, imgBoxY, maxImgBoxW, maxImgBoxH, 'F');
            doc.setFontSize(5.5);
            doc.setTextColor(148, 163, 184);
            doc.text('Sin Foto', imgBoxX + 4, imgBoxY + 9);
          }
        } else {
          doc.setFillColor(241, 245, 249);
          doc.rect(imgBoxX, imgBoxY, maxImgBoxW, maxImgBoxH, 'F');
          doc.setFontSize(5.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Sin Foto', imgBoxX + 4, imgBoxY + 9);
        }

        // MARCA
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(row.brand || 'KNUP', marginLeft + 22, y + 10.5);

        // CÓDIGO
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(row.fullCode || '8001', marginLeft + 46, y + 10.5);

        // TALLAS: SOLO TALLAS DISPONIBLES (Las vendidas se excluyen por completo de la hoja)
        const availableSizesList = (row.sizesWithStatus && row.sizesWithStatus.length > 0)
          ? row.sizesWithStatus.filter((s: any) => s.status === 'DISPONIBLE')
          : (row.cleanSizes || '').split(/\s+/).filter(Boolean).map((s: string) => ({ size: s, status: 'DISPONIBLE' }));

        const boxW = 7.0;
        const boxH = 4.8;
        const gapX = 1.0;
        const gapY = 1.0;
        const startX = marginLeft + 82;
        const startY = y + 2.6;
        const maxBoxesPerRow = 5;

        if (availableSizesList.length === 0) {
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text('-', startX + 2, startY + 4);
        } else {
          availableSizesList.forEach((szObj: any, sIdx: number) => {
            const col = sIdx % maxBoxesPerRow;
            const rowNum = Math.floor(sIdx / maxBoxesPerRow);
            const bx = startX + col * (boxW + gapX);
            const by = startY + rowNum * (boxH + gapY);

            if (rowNum < 3) {
              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(59, 130, 246); // azul disponible
              doc.roundedRect(bx, by, boxW, boxH, 0.6, 0.6, 'FD');

              doc.setFontSize(6.4);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(15, 23, 42);
              const cleanSizeText = String(szObj.size || '').replace(/^T/i, '');
              doc.text(cleanSizeText, bx + boxW / 2, by + 3.4, { align: 'center' });
            }
          });
        }

        // DESCRIPCIÓN (CONTROL FÍSICO)
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        const descText = doc.splitTextToSize(row.description || '', 65);
        doc.text(descText, marginLeft + 128, y + 6.5);

        y += rowHeight;
      }

      doc.save(`SHARUI_Inventario_Disponibles_Carta_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error("Error generating inventory PDF:", err);
      alert("Hubo un detalle al exportar la planilla en PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export full inventory data in structured JSON format
  const handleExportInventoryJSON = () => {
    try {
      setIsExportingJson(true);
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
      a.download = `SHARUI_Inventario_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting inventory JSON:", err);
    } finally {
      setIsExportingJson(false);
    }
  };

  // Trigger file selection for JSON import
  const handleTriggerImportJSON = () => {
    if (jsonFileInputRef.current) {
      jsonFileInputRef.current.value = '';
      jsonFileInputRef.current.click();
    }
  };

  // Handle selected JSON file
  const handleImportInventoryJSONFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("El archivo está vacío");

        const parsed = JSON.parse(text);
        const rawProducts: any[] = Array.isArray(parsed) 
          ? parsed 
          : (Array.isArray(parsed.products) ? parsed.products : []);

        if (rawProducts.length === 0) {
          alert("No se encontraron productos válidos en el archivo JSON. Verifica que contenga la estructura del inventario.");
          return;
        }

        // Sanitize and validate every product
        const sanitizedProducts: Product[] = rawProducts.map((item: any, idx: number) => {
          const code = String(item.code || `PROD-${idx + 1}`).trim();
          const brand = String(item.brand || 'KNUP').trim();
          const category = String(item.category || 'calzado').trim();
          const origin = String(item.origin || 'Original').trim();
          const name = String(item.name || `${brand} ${code}`).trim();
          const description = String(item.description || '').trim();
          const totalCost = Number(item.totalCost || 0);
          const packageType = (['docena', 'media_docena', 'dos_docenas', 'manual'].includes(item.packageType) 
            ? item.packageType 
            : 'manual') as Product['packageType'];
          const unitCost = Number(item.unitCost || 0);
          const salePrice = Number(item.salePrice || 0);
          const suggestedSalePrice = Number(item.suggestedSalePrice || salePrice || 0);
          const costPrice = Number(item.costPrice || unitCost || 0);
          const createdAt = Number(item.createdAt || (Date.now() - idx * 1000));
          const id = String(item.id || crypto.randomUUID());

          // Sanitize variants
          let variants: ProductColorVariant[] = [];
          if (Array.isArray(item.variants) && item.variants.length > 0) {
            variants = item.variants.map((v: any, vIdx: number) => {
              const subCode = String(v.subCode || `F${vIdx + 1}`).trim();
              const fullCode = String(v.fullCode || `${code} ${subCode}`).trim();
              const colorName = String(v.colorName || `Color #${vIdx + 1}`).trim();
              const image = String(v.image || item.image || '').trim();
              const sizes = Array.isArray(v.sizes) 
                ? v.sizes.map((s: any) => String(s).replace(/^T/i, '').trim()).filter(Boolean)
                : [];
              return {
                id: String(v.id || crypto.randomUUID()),
                colorName,
                subCode,
                fullCode,
                image,
                sizes
              };
            });
          } else {
            const rawSizes = Array.isArray(item.sizes) 
              ? item.sizes.map((s: any) => String(s).replace(/^T/i, '').trim()).filter(Boolean)
              : [];
            variants = [{
              id: crypto.randomUUID(),
              colorName: 'Color Principal',
              subCode: 'F1',
              fullCode: `${code} F1`,
              image: String(item.image || '').trim(),
              sizes: rawSizes
            }];
          }

          // Compute flat sizes and image
          const flatSizes = variants.flatMap(v => v.sizes);
          const primaryImage = variants[0]?.image || String(item.image || '');
          const unitsCount = Number(item.unitsCount || flatSizes.length || 1);

          return {
            id,
            code,
            name,
            brand,
            origin,
            category,
            description,
            totalCost,
            packageType,
            unitsCount,
            unitCost,
            suggestedSalePrice,
            salePrice,
            costPrice,
            variants,
            image: primaryImage,
            sizes: flatSizes,
            createdAt
          };
        });

        const totalVariantsCount = sanitizedProducts.reduce((sum, p) => sum + p.variants.length, 0);
        const totalSizesCount = sanitizedProducts.reduce((sum, p) => sum + p.sizes.length, 0);

        setPendingImportData({
          fileName: file.name,
          products: sanitizedProducts,
          totalVariants: totalVariantsCount,
          totalSizes: totalSizesCount
        });
        setIsImportModalOpen(true);
      } catch (err: any) {
        console.error("JSON parse error:", err);
        alert(`Error al leer el archivo JSON: ${err.message || 'Formato no reconocido'}`);
      }
    };
    reader.readAsText(file);
  };

  // Perform Final Import (Replace or Merge)
  const handleConfirmImport = async (mode: 'replace' | 'merge') => {
    if (!pendingImportData) return;

    let finalProducts: Product[];
    if (mode === 'replace') {
      finalProducts = pendingImportData.products;
    } else {
      // Merge: Update existing products by code, add new ones
      const existingMap = new Map<string, Product>();
      products.forEach(p => {
        existingMap.set(p.code.toLowerCase().trim(), p);
      });
      pendingImportData.products.forEach(p => {
        existingMap.set(p.code.toLowerCase().trim(), p);
      });
      finalProducts = Array.from(existingMap.values());
    }

    // Save to state and storage
    setProducts(finalProducts);
    StorageService.setProductsRaw(finalProducts);

    // Save each to cloud if authenticated
    for (const p of finalProducts) {
      StorageService.saveProduct(p).catch(() => {});
    }

    setIsImportModalOpen(false);
    const count = pendingImportData.products.length;
    setPendingImportData(null);

    setImportStatusMessage(`¡${count} modelos restaurados con éxito! El catálogo y el inventario están 100% listos.`);
    setTimeout(() => setImportStatusMessage(null), 6000);

    confetti({
      particleCount: 75,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handlePrintSheet = () => {
    window.print();
  };

  return (
    <div ref={inventoryTopRef} id="inventory-section-top" className="space-y-8 pb-20">
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <TableIcon className="w-5 h-5" />
            </div>
            Inventario de Mercadería
          </h2>
          <p className="text-xs text-brand-text-dim mt-1">
            Registro en 2 pasos (costo de lote y variantes de color con sub-código) y planilla de inventario con espacio para control físico
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* White Download Buttons */}
          <button
            onClick={handleExportInventoryPDF}
            disabled={isExportingPdf}
            className="px-4 py-3 bg-white hover:bg-neutral-200 text-black rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl transition-all disabled:opacity-50"
            title="Descargar Planilla con Fotos en PDF"
          >
            <Download className="w-4 h-4 text-black" />
            <span>{isExportingPdf ? 'Generando PDF...' : 'Descargar PDF'}</span>
          </button>

          <button
            onClick={handleExportInventoryExcel}
            className="px-4 py-3 bg-white hover:bg-neutral-200 text-black rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl transition-all"
            title="Descargar en Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-black" />
            <span>Descargar Excel</span>
          </button>

          {/* JSON Backup Export Button */}
          <button
            onClick={handleExportInventoryJSON}
            disabled={isExportingJson}
            className="px-4 py-3 bg-white hover:bg-neutral-200 text-black rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl transition-all"
            title="Descargar copia de seguridad completa del inventario en archivo JSON"
          >
            <Database className="w-4 h-4 text-black" />
            <span>Descargar JSON</span>
          </button>

          {/* JSON Restore Import Button */}
          <button
            onClick={handleTriggerImportJSON}
            className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-xl transition-all hover:border-blue-500"
            title="Importar y restaurar inventario completo desde archivo JSON"
          >
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Importar JSON</span>
          </button>

          {/* Hidden JSON File Input */}
          <input 
            type="file" 
            ref={jsonFileInputRef} 
            onChange={handleImportInventoryJSONFile} 
            accept=".json,application/json" 
            className="hidden" 
          />

          <button 
            onClick={() => isFormVisible ? resetWizard() : setIsFormVisible(true)}
            className={cn(
              "px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg",
              isFormVisible 
                ? (editingProductId ? "bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 hover:text-white" : "bg-neutral-800 text-white border border-neutral-700") 
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
            )}
          >
            {isFormVisible ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{editingProductId ? 'Cancelar Edición (Sin Cambios)' : (isFormVisible ? 'Cerrar Registro' : 'Registrar Mercadería')}</span>
          </button>
        </div>
      </div>

      {/* Import Status Success Message */}
      <AnimatePresence>
        {importStatusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-2xl bg-blue-950/80 border border-blue-500/50 text-blue-200 flex items-center justify-between gap-3 shadow-xl"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-white">{importStatusMessage}</span>
            </div>
            <button 
              onClick={() => setImportStatusMessage(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2-PAGE REGISTRATION WIZARD */}
      <AnimatePresence>
        {isFormVisible && (
          <motion.div
            ref={editFormRef}
            id="inventory-edit-box"
            data-registration-active="true"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden scroll-mt-24"
          >
            <div className={`bg-[#0e1015] rounded-3xl border ${editingProductId ? 'border-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.18)] ring-1 ring-blue-500/40' : 'border-neutral-800'} p-6 md:p-8 shadow-2xl relative transition-all duration-300`}>
              <div className={`absolute top-0 left-0 w-1.5 h-full rounded-l-3xl transition-colors ${
                sizesMatchUnits && wizardStep === 2 ? 'bg-blue-600' : 'bg-neutral-700'
              }`} />

              {/* Mode indicator banner when editing */}
              {editingProductId && (
                <div className="mb-6 p-4 rounded-2xl bg-blue-950/40 border border-blue-600/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                      <Edit3 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-wider">
                        Modo Edición: Modificando Modelo "{code || 'Seleccionado'}"
                      </p>
                      <p className="text-[10px] text-blue-200">
                        Puedes modificar cualquier campo. Haz clic en "Guardar Cambios" para actualizar o "Cancelar" para salir sin alterar el inventario.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetWizard}
                      className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl uppercase transition-all cursor-pointer"
                    >
                      Cancelar Edición (Sin Cambios)
                    </button>
                    {sizesMatchUnits && (
                      <button
                        type="button"
                        onClick={() => handleSaveStock(false)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Guardar Cambios
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Progress Steps Header */}
              <div className="flex items-center justify-between pb-6 mb-6 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                    wizardStep === 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                  }`}>
                    1
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Paso 1: Costo del Lote & Unidades
                    </h3>
                    <p className="text-[10px] text-neutral-400">Código, costo de inversión, docenas y precio de venta</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-8 h-0.5 bg-neutral-800 hidden sm:block" />
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                    wizardStep === 2 
                      ? (sizesMatchUnits ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-neutral-700 text-white') 
                      : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                  }`}>
                    2
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Paso 2: Colores, Tallas & Catálogo
                    </h3>
                    <p className="text-[10px] text-brand-text-dim">Foto, sub-códigos, marcas y asignación de tallas</p>
                  </div>
                </div>
              </div>

              {/* STEP 1: COST, UNITS & PRICES */}
              {wizardStep === 1 && (
                <form onSubmit={handleProceedToStep2} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Código Principal */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                        1. Código Principal a Registrar *
                      </label>
                      <input 
                        type="text" 
                        required 
                        value={code} 
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Ej. 8001"
                        className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-brand-accent outline-none text-sm font-black text-white uppercase"
                      />
                      <p className="text-[9px] text-brand-text-dim">Identificador base del modelo (ej. 8001, 7500, 9020)</p>
                    </div>

                    {/* Costo Total */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                        2. Precio que Costó el Lote (Inversión Total) *
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          step="0.01"
                          required 
                          value={totalCost} 
                          onChange={(e) => setTotalCost(e.target.value)}
                          placeholder="Ej. 1200.00"
                          className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 focus:border-brand-accent outline-none text-sm font-black text-emerald-400 font-mono"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-text-dim">Bs.</span>
                      </div>
                      <p className="text-[9px] text-brand-text-dim">Monto total pagado por la docena o unidades adquiridas</p>
                    </div>

                    {/* Selección de unidades */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                        3. Unidades que Están Entrando *
                      </label>
                      <select
                        value={packageType}
                        onChange={(e) => setPackageType(e.target.value as any)}
                        className="w-full px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-white outline-none cursor-pointer"
                      >
                        <option value="docena">1 Docena (12 unidades)</option>
                        <option value="media_docena">Media Docena (6 unidades)</option>
                        <option value="dos_docenas">2 Docenas (24 unidades)</option>
                        <option value="manual">Selección Manual (escribir número exacto)</option>
                      </select>
                      <p className="text-[9px] text-brand-text-dim">Determina el límite exacto de tallas a registrar</p>
                    </div>
                  </div>

                  {packageType === 'manual' && (
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl max-w-md">
                      <label className="text-[10px] font-black text-brand-accent uppercase tracking-widest block mb-1">
                        Escribir Cantidad Exacta de Unidades (desde 1 ud) *:
                      </label>
                      <input 
                        type="number"
                        min="1"
                        required
                        value={manualUnits}
                        onChange={(e) => setManualUnits(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-white"
                        placeholder="Ej. 8, 15, 20..."
                      />
                    </div>
                  )}

                  {/* Calculations & Price Recommendation Box */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-brand-text-dim uppercase tracking-wider block">
                        Precio Unitario de Costo
                      </span>
                      <p className="text-xl font-black text-white font-mono">
                        {formatCurrency(computedUnitCost)}
                        <span className="text-xs font-normal text-brand-text-dim"> / ud</span>
                      </p>
                      <p className="text-[8px] text-brand-text-dim">Calculado: {parsedTotalCost} Bs ÷ {computedUnitsCount} uds</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-brand-accent uppercase tracking-wider">
                          Precio Sugerido Venta
                        </span>
                        <select
                          value={marginPercent}
                          onChange={(e) => {
                            setMarginPercent(e.target.value);
                            const m = parseFloat(e.target.value) || 50;
                            const newSug = Math.round(computedUnitCost * (1 + m / 100));
                            setSalePrice(newSug.toString());
                          }}
                          className="text-[9px] bg-white/5 px-2 py-0.5 rounded border border-white/10 text-brand-text-dim"
                        >
                          <option value="30">+30% margen</option>
                          <option value="40">+40% margen</option>
                          <option value="50">+50% margen</option>
                          <option value="60">+60% margen</option>
                          <option value="80">+80% margen</option>
                          <option value="100">+100% margen</option>
                        </select>
                      </div>
                      <p className="text-xl font-black text-emerald-400 font-mono">
                        {formatCurrency(suggestedPrice)}
                      </p>
                      <p className="text-[8px] text-brand-text-dim">Ganancia de {formatCurrency(suggestedPrice - computedUnitCost)} / ud</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-white uppercase tracking-wider block">
                        Precio Final para la Venta (Editable) *
                      </span>
                      <div className="relative">
                        <input 
                          type="number"
                          step="0.01"
                          required
                          value={salePrice}
                          onChange={(e) => setSalePrice(e.target.value)}
                          placeholder="350.00"
                          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-black text-emerald-400 font-mono"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-text-dim">Bs.</span>
                      </div>
                      <p className="text-[8px] text-brand-text-dim">Puedes ajustar libremente este monto</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={resetWizard}
                      className="w-full sm:w-auto px-6 py-3.5 bg-white/5 hover:bg-white/10 text-brand-text-dim hover:text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/5"
                    >
                      <X className="w-4 h-4" />
                      <span>{editingProductId ? 'Cancelar Edición (Sin Guardar Cambios)' : 'Cancelar Registro'}</span>
                    </button>

                    <button
                      type="submit"
                      className="w-full sm:w-auto px-8 py-4 bg-brand-accent hover:opacity-90 rounded-2xl font-black text-xs text-white uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl shadow-brand-accent/20 cursor-pointer"
                    >
                      <span>{editingProductId ? 'Siguiente: Colores & Tallas →' : 'Siguiente: Registrar Colores & Tallas →'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: COLORS, SIZES & DETAILS */}
              {wizardStep === 2 && (
                <div className="space-y-8">
                  {/* Model Header Status */}
                  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-brand-text-dim uppercase tracking-wider">Código Modelo:</span>
                      <span className="text-sm font-black text-white bg-white/5 px-3 py-1 rounded-xl border border-white/10 font-mono">
                        {code}
                      </span>
                      <span className="text-xs font-black text-brand-text-dim">• Unidades a Distribuir:</span>
                      <span className="text-sm font-black text-blue-400 bg-blue-500/10 px-3 py-1 rounded-xl border border-blue-500/20 font-mono">
                        {computedUnitsCount} pares
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="text-xs font-bold text-brand-accent hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Volver a Página 1 (Costos)
                    </button>
                  </div>

                  {/* Brand, Origin, Category */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* MARCA */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                        Marca del Calzado *
                      </label>
                      <select
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white outline-none cursor-pointer"
                      >
                        {BRANDS_LIST.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                      {brand === 'Otros' && (
                        <input 
                          type="text"
                          required
                          value={customBrand}
                          onChange={(e) => setCustomBrand(e.target.value)}
                          placeholder="Escribe la marca..."
                          className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
                        />
                      )}
                    </div>

                    {/* CALIDAD / PROCEDENCIA (Original por defecto) */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                        Procedencia (Predeterminado: Original) *
                      </label>
                      <select
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white outline-none cursor-pointer"
                      >
                        {ORIGINS_LIST.map(o => (
                          <option key={o} value={o}>{o === 'Original' ? '⭐ Original (Genuino)' : o.toUpperCase()}</option>
                        ))}
                      </select>
                      {origin === 'Otros' && (
                        <input 
                          type="text"
                          required
                          value={customOrigin}
                          onChange={(e) => setCustomOrigin(e.target.value)}
                          placeholder="Escribe el origen..."
                          className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
                        />
                      )}
                    </div>

                    {/* CATEGORÍA */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                        Categoría *
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white outline-none cursor-pointer uppercase"
                      >
                        {CATEGORIES_LIST.map(c => (
                          <option key={c} value={c}>{c.toUpperCase()}</option>
                        ))}
                      </select>
                      {category === 'Otros' && (
                        <input 
                          type="text"
                          required
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="Escribe la categoría..."
                          className="w-full mt-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white"
                        />
                      )}
                    </div>
                  </div>

                  {/* COLOR VARIANTS TABS */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2 overflow-x-auto py-1">
                        <span className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider mr-1">Colores:</span>
                        {variants.map((v, idx) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setActiveVariantIndex(idx)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                              activeVariantIndex === idx 
                                ? 'bg-brand-accent text-white shadow-md' 
                                : 'bg-white/5 text-brand-text-dim hover:text-white'
                            }`}
                          >
                            <Palette className="w-3.5 h-3.5" />
                            <span>{v.colorName ? `${v.colorName} (${v.subCode || `F${idx + 1}`})` : `Color #${idx + 1}`}</span>
                            <span className="text-[9px] bg-black/40 px-1.5 py-0.2 rounded-md font-mono">{v.sizes.length} uds</span>
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddNewColorVariant}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-brand-accent/20 text-brand-accent border border-brand-accent/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar Otro Color</span>
                      </button>
                    </div>

                    {variants[activeVariantIndex] && (() => {
                      const activeVar = variants[activeVariantIndex];
                      const fullSearchCode = activeVar.subCode 
                        ? `${code.trim().toUpperCase()} ${activeVar.subCode.trim().toUpperCase()}` 
                        : code.trim().toUpperCase();

                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white/[0.015] p-5 rounded-3xl border border-white/5">
                          {/* Image */}
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest block">
                              Foto de Catálogo ({activeVar.colorName || `Color #${activeVariantIndex + 1}`}) *
                            </label>

                            <div 
                              onClick={() => fileInputRef.current?.click()}
                              className={`aspect-square max-w-[280px] w-full mx-auto rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${
                                activeVar.image ? 'border-brand-accent bg-brand-accent/5' : 'border-white/15 hover:border-brand-accent/50 bg-white/5'
                              }`}
                            >
                              {activeVar.image ? (
                                <>
                                  <img src={activeVar.image} alt="Preview" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 p-2 text-white text-xs font-bold transition-opacity">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCropImageSrc(activeVar.image);
                                        setCropModalOpen(true);
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                                    >
                                      <Crop className="w-3.5 h-3.5" />
                                      <span>Recortar / Encuadrar</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        fileInputRef.current?.click();
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] uppercase flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <Camera className="w-3 h-3" />
                                      <span>Subir Otra Foto</span>
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="text-center p-4">
                                  <Camera className="w-8 h-8 text-brand-accent mx-auto mb-2 opacity-80" />
                                  <p className="text-white text-xs font-bold">Cargar Foto de este Color</p>
                                  <p className="text-[9px] text-emerald-400 mt-1 font-bold">
                                    ✂️ Podrás recortar y elegir qué parte usar
                                  </p>
                                </div>
                              )}
                              <input type="file" ref={fileInputRef} onChange={handleVariantImageUpload} className="hidden" accept="image/*" />
                            </div>

                            {activeVar.image && (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCropImageSrc(activeVar.image);
                                    setCropModalOpen(true);
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                                >
                                  <Crop className="w-3.5 h-3.5" />
                                  <span>Recortar Foto</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>Cambiar</span>
                                </button>
                              </div>
                            )}

                            <div className="p-3 bg-brand-card rounded-2xl border border-white/5 text-center">
                              <p className="text-[9px] font-black text-brand-text-dim uppercase">CÓDIGO Y SUB-CÓDIGO JUNTOS:</p>
                              <p className="text-base font-black text-brand-accent font-mono mt-0.5 tracking-wider">
                                {fullSearchCode}
                              </p>
                            </div>
                          </div>

                          {/* Color Name, Subcode and Tallas */}
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                                  Nombre del Color *
                                </label>
                                <input 
                                  type="text"
                                  required
                                  value={activeVar.colorName}
                                  onChange={(e) => handleUpdateVariantField('colorName', e.target.value)}
                                  placeholder="Ej. Negro / Blanco"
                                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white outline-none focus:border-brand-accent"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                                  Sub-Código (ej. F1) *
                                </label>
                                <input 
                                  type="text"
                                  required
                                  value={activeVar.subCode}
                                  onChange={(e) => handleUpdateVariantField('subCode', e.target.value)}
                                  placeholder="Ej. F1, B2..."
                                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-white uppercase outline-none focus:border-brand-accent"
                                />
                              </div>
                            </div>

                            {/* Tallas con duplicados permitidos */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-brand-text-dim uppercase tracking-widest">
                                  Tallas de este color ({activeVar.sizes.length} pares)
                                </label>
                                <span className="text-[8px] text-brand-text-dim italic">
                                  Permite duplicar tallas (ej. dos 40)
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <input 
                                  type="text"
                                  value={currentSizeInput}
                                  onChange={(e) => setCurrentSizeInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddSizeToActiveVariant();
                                    }
                                  }}
                                  placeholder="Escribe la talla y pulsa ENTER..."
                                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white outline-none focus:border-brand-accent placeholder:text-slate-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddSizeToActiveVariant()}
                                  className="px-5 rounded-xl bg-brand-accent hover:opacity-90 font-black text-xs text-white uppercase cursor-pointer"
                                >
                                  + Enter
                                </button>
                              </div>

                              {/* Quick chips */}
                              <div className="flex flex-wrap items-center gap-1 pt-1">
                                <span className="text-[8px] font-bold text-brand-text-dim uppercase mr-1">Rápido:</span>
                                {QUICK_SIZES.map(sz => (
                                  <button
                                    key={sz}
                                    type="button"
                                    onClick={() => handleAddSizeToActiveVariant(sz)}
                                    className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/15 text-[9px] font-bold text-white border border-white/5 cursor-pointer"
                                  >
                                    +{sz}
                                  </button>
                                ))}
                              </div>

                              {/* Badges */}
                              <div className="flex flex-wrap gap-1.5 mt-2 min-h-[45px] max-h-32 overflow-y-auto p-2.5 border border-white/10 rounded-2xl bg-white/[0.02]">
                                {activeVar.sizes.length === 0 ? (
                                  <p className="text-[10px] text-brand-text-dim italic m-auto">
                                    No hay tallas en este color. Escribe arriba y presiona Enter.
                                  </p>
                                ) : (
                                  activeVar.sizes.map((s, idx) => (
                                    <div key={idx} className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-xs font-black font-mono">
                                      <span>T{s}</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSizeFromActiveVariant(idx)}
                                        className="text-red-400 hover:text-red-300 p-0.5 cursor-pointer"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>

                              {variants.length > 1 && (
                                <div className="pt-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveColorVariant(activeVariantIndex)}
                                    className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase cursor-pointer"
                                  >
                                    Eliminar este Color
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Description Box */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-brand-text-dim uppercase tracking-widest">
                      Descripción General / Notas del Calzado
                    </label>
                    <textarea 
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Materiales, cuidados, características especiales..."
                      className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none resize-none"
                    />
                  </div>

                  {/* PROGRESS BAR & VERIFICATION INDICATOR */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    sizesMatchUnits 
                      ? 'bg-blue-950/40 border-blue-500/40 text-blue-300' 
                      : sizesDiff > 0 
                      ? 'bg-neutral-900 border-neutral-800 text-neutral-300' 
                      : 'bg-red-950/30 border-red-500/30 text-red-400'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                          sizesMatchUnits ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-300'
                        }`}>
                          {sizesMatchUnits ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider">
                            Control de Unidades del Lote: {totalAssignedSizes} / {computedUnitsCount} Tallas Asignadas
                          </p>
                          <p className="text-[10px] font-semibold opacity-90 mt-0.5">
                            {sizesMatchUnits 
                              ? '✨ ¡Perfecto! La cantidad de tallas coincide exactamente con las unidades de la Página 1. Ya se puede registrar.'
                              : sizesDiff > 0 
                              ? `Faltan registrar ${sizesDiff} ${sizesDiff === 1 ? 'talla' : 'tallas'} entre tus colores para completar el lote.`
                              : `Has registrado ${Math.abs(sizesDiff)} tallas de más respecto al límite de ${computedUnitsCount}.`
                            }
                          </p>
                        </div>
                      </div>

                      <div className="w-full sm:w-36 bg-black/60 h-2 rounded-full overflow-hidden border border-neutral-700">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            sizesMatchUnits ? 'bg-blue-600' : sizesDiff > 0 ? 'bg-neutral-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, (totalAssignedSizes / computedUnitsCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS (TURNS BLUE WHEN VALID) */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={resetWizard}
                        className="w-full sm:w-auto px-5 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border border-neutral-700 transition-all flex items-center justify-center gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        <span>{editingProductId ? 'Cancelar Edición (Sin Cambios)' : 'Cancelar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWizardStep(1)}
                        className="w-full sm:w-auto px-5 py-3.5 bg-neutral-900 hover:bg-neutral-800 rounded-xl text-xs font-black text-neutral-300 hover:text-white uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 border border-neutral-800"
                      >
                        <ArrowLeft className="w-4 h-4" /> 
                        <span>Página 1 (Costos)</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={!sizesMatchUnits}
                        onClick={() => handleSaveStock(false)}
                        className={cn(
                          "w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer",
                          sizesMatchUnits 
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 scale-[1.02]" 
                            : "bg-neutral-900 text-neutral-500 opacity-40 cursor-not-allowed border border-neutral-800"
                        )}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {sizesMatchUnits 
                            ? (editingProductId ? 'GUARDAR CAMBIOS' : 'GUARDAR EN INVENTARIO') 
                            : `Faltan ${sizesDiff} tallas`}
                        </span>
                      </button>

                      {!editingProductId && sizesMatchUnits && (
                        <button
                          type="button"
                          onClick={() => handleSaveStock(true)}
                          className="w-full sm:w-auto px-6 py-4 bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Guardar y Siguiente →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-brand-card p-4 rounded-2xl border border-white/5 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-brand-text-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar por código (8001), sub-código (F1), color o marca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-white outline-none focus:border-brand-accent placeholder:text-neutral-500"
            />
          </div>

          {/* Sort Selector: Código (predeterminado), Marca, Orden agregado */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 w-full sm:w-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-[10px] font-black text-brand-text-dim uppercase tracking-wider whitespace-nowrap">Ordenar:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-white font-bold text-xs outline-none cursor-pointer w-full sm:w-auto"
            >
              <option value="code" className="bg-[#0e1015] text-white">Código (Predeterminado)</option>
              <option value="brand" className="bg-[#0e1015] text-white">Marca (A - Z)</option>
              <option value="created_asc" className="bg-[#0e1015] text-white">Orden agregado (Primeros registrados)</option>
              <option value="created_desc" className="bg-[#0e1015] text-white">Orden agregado (Últimos registrados)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {/* Brand Filter */}
          <select
            value={selectedBrandFilter}
            onChange={(e) => setSelectedBrandFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase text-white outline-none cursor-pointer"
          >
            <option value="TODAS">Marca: TODAS</option>
            {BRANDS_LIST.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase text-white outline-none cursor-pointer"
          >
            <option value="TODAS">Categoría: TODAS</option>
            {CATEGORIES_LIST.map(c => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* INVENTORY TABLE - EXCEL STYLE PRESENTATION */}
      {/* Required structure:
          1. Foto miniatura del producto
          2. Marca
          3. Código y Sub-código juntos (ej. 8001 F1)
          4. Tallas
          5. Un espacio en blanco que ocupe el doble de espacio (para control físico/impresión)
          6. Acciones
      */}
      <div className="bg-brand-card rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-[9px] font-black text-brand-text-dim uppercase tracking-wider">
                <th className="px-4 py-3.5 w-20 text-center">Foto del Producto</th>
                <th className="px-4 py-3.5 w-28">Marca</th>
                <th className="px-4 py-3.5 w-40">Código y Sub-Código</th>
                <th className="px-4 py-3.5 w-72">
                  <div className="flex items-center gap-1.5">
                    <span>Tallas</span>
                    <span className="text-[8px] font-normal text-neutral-400 lowercase">(azul: disp • ámbar: reserv • tachado: agotado)</span>
                  </div>
                </th>
                {/* Blank space that occupies double width */}
                <th className="px-6 py-3.5 min-w-[260px] bg-white/[0.01] border-l border-r border-white/5 text-center text-slate-400">
                  Descripción (Espacio para Control Físico / Anotaciones)
                </th>
                <th className="px-4 py-3.5 w-24 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-brand-text-dim italic font-medium">
                    No se encontraron registros de inventario con los filtros aplicados.
                  </td>
                </tr>
              )}
              {filteredRows.map((row, idx) => (
                <tr key={`${row.productId}_${row.variantId}_${idx}`} className="hover:bg-white/[0.015] transition-colors group">
                  {/* 1. Foto miniatura del producto */}
                  <td className="px-4 py-3 text-center">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 mx-auto bg-slate-900 shadow-md">
                      <img 
                        src={row.image} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                      />
                    </div>
                  </td>

                  {/* 2. Marca */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-black text-white uppercase block">{row.brand}</span>
                    <span className="text-[9px] text-neutral-400 font-bold uppercase">{row.origin}</span>
                  </td>

                  {/* 3. Código y Sub-código juntos */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-black text-white font-mono bg-blue-950/60 px-3 py-1.5 rounded-xl border border-blue-600/40 block w-fit">
                      {row.fullCode}
                    </span>
                    <span className="text-[9px] text-neutral-400 block mt-1">{row.colorName}</span>
                  </td>

                  {/* 4. Tallas en cuadrados individuales con estado real (Disponible, Reservado, Vendido) */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                      {(row.sizesWithStatus && row.sizesWithStatus.length > 0 
                        ? row.sizesWithStatus 
                        : (row.cleanSizes || '').split(/\s+/).filter(Boolean).map((s: string, idx: number) => ({
                            size: s,
                            status: 'DISPONIBLE' as const,
                            key: `${s}-${idx}`
                          }))
                      ).map((szObj: any, szIdx: number) => {
                        const isSold = szObj.status === 'VENDIDO';
                        const isReserved = szObj.status === 'RESERVADO';

                        if (isSold) {
                          return (
                            <span 
                              key={szObj.key || szIdx}
                              className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-neutral-950/80 border border-neutral-800 text-[11px] font-mono font-bold text-neutral-500 line-through opacity-50 cursor-not-allowed select-none shadow-sm"
                              title={`Talla ${szObj.size} VENDIDA (Agotada)`}
                            >
                              {szObj.size}
                            </span>
                          );
                        }

                        if (isReserved) {
                          return (
                            <span 
                              key={szObj.key || szIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-950/70 border border-amber-600/60 text-[11px] font-mono font-black text-amber-300 shadow-sm cursor-not-allowed select-none"
                              title={`Talla ${szObj.size} RESERVADA (Bloqueada para otro cliente)`}
                            >
                              <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span>{szObj.size}</span>
                            </span>
                          );
                        }

                        return (
                          <span 
                            key={szObj.key || szIdx}
                            className="inline-flex items-center justify-center px-2 py-0.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-blue-500/40 text-[11px] font-mono font-black text-white shadow-sm"
                            title={`Talla ${szObj.size} DISPONIBLE`}
                          >
                            {szObj.size}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[9px] font-bold text-neutral-400">
                        {row.totalUnits} total
                      </span>
                      <span className="text-[9px] font-black text-blue-300 bg-blue-950/60 border border-blue-600/40 px-1.5 py-0.5 rounded">
                        {row.availableUnits} disponibles
                      </span>
                      {row.sizesWithStatus?.some((s: any) => s.status === 'RESERVADO') && (
                        <span className="text-[9px] font-black text-amber-300 bg-amber-950/60 border border-amber-600/40 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5 text-amber-400" />
                          {row.sizesWithStatus.filter((s: any) => s.status === 'RESERVADO').length} reserv.
                        </span>
                      )}
                      {row.sizesWithStatus?.some((s: any) => s.status === 'VENDIDO') && (
                        <span className="text-[9px] font-bold text-neutral-400 bg-neutral-900 border border-neutral-700 px-1.5 py-0.5 rounded line-through">
                          {row.sizesWithStatus.filter((s: any) => s.status === 'VENDIDO').length} vend.
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 5. Espacio en blanco que ocupe el doble de espacio con nombre DESCRIPCIÓN */}
                  <td className="px-6 py-3 bg-white/[0.01] border-l border-r border-white/5">
                    {row.description ? (
                      <p className="text-xs text-neutral-300 line-clamp-2 mb-1.5 font-medium">{row.description}</p>
                    ) : null}
                    <div className="h-9 border border-dashed border-neutral-700 rounded-xl flex items-center px-3 text-[9px] text-neutral-500 italic bg-white/[0.01]">
                      [ Espacio en blanco doble para verificación y conteo de almacén ]
                    </div>
                  </td>

                  {/* 6. Acciones: Editar, Guardar o Cancelar */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => {
                          if (editingProductId === row.productId) {
                            resetWizard();
                          } else {
                            handleStartEdit(row.parentProduct);
                          }
                        }}
                        title={editingProductId === row.productId ? "Cerrar edición sin cambios" : "Editar modelo y tallas"}
                        className={cn(
                          "p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1",
                          editingProductId === row.productId 
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/40 animate-pulse" 
                            : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white"
                        )}
                      >
                        <Edit3 className="w-4 h-4" />
                        {editingProductId === row.productId && (
                          <span className="text-[10px] font-black uppercase">Editando</span>
                        )}
                      </button>
                      <button
                        onClick={() => setProductToDelete(row.parentProduct)}
                        title="Eliminar modelo"
                        className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
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
                <h3 className="text-base font-black text-white uppercase">¿Eliminar Mercadería?</h3>
                <p className="text-xs text-brand-text-dim mt-2">
                  Se eliminará permanentemente el modelo <span className="text-white font-bold">{productToDelete.code}</span> ({productToDelete.brand}) de todo el inventario.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black text-brand-text-dim uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => deleteProduct(productToDelete.id)}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-xs font-black text-white uppercase cursor-pointer"
                >
                  Sí, Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* JSON IMPORT CONFIRMATION & RESTORE MODAL */}
      <AnimatePresence>
        {isImportModalOpen && pendingImportData && (
          <div role="dialog" aria-modal="true" data-modal="true" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#0e1015] border border-neutral-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative my-auto space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                      Importar / Restaurar Inventario
                    </h3>
                    <p className="text-[10px] text-neutral-400">
                      Archivo: <span className="font-mono text-white">{pendingImportData.fileName}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Summary of Data */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800 text-center">
                <div>
                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Modelos</span>
                  <span className="text-xl font-black text-white font-mono">{pendingImportData.products.length}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Subcódigos</span>
                  <span className="text-xl font-black text-blue-400 font-mono">{pendingImportData.totalVariants}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block">Pares Totales</span>
                  <span className="text-xl font-black text-white font-mono">{pendingImportData.totalSizes}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30 space-y-1">
                <p className="text-xs font-bold text-blue-200">
                  ¿Cómo deseas cargar esta información en el sistema?
                </p>
                <p className="text-[10px] text-neutral-300">
                  Si tu inventario fue reiniciado o se borró el contenido, selecciona <strong className="text-white">"Restaurar / Reemplazar Todo"</strong> para que el catálogo aparezca completo con todas sus fotos 1:1, códigos, subcódigos y tallas.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleConfirmImport('replace')}
                  className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Restaurar / Reemplazar Todo ({pendingImportData.products.length} modelos)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmImport('merge')}
                  className="w-full py-3 px-4 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-800 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Combinar con el inventario actual (sin borrar)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="w-full py-2.5 text-center text-xs font-bold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Cropping Modal */}
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={cropImageSrc}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleCropComplete}
        initialAspectRatio={1}
      />
    </div>
  );
}
