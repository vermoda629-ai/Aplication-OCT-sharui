/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, DailyLogEntry, Sale, Invoice, StoreSettings, AppMovementLog, MovementType, Customer } from '../types';
import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
} from 'firebase/firestore';
import { idbGet, idbSet } from './indexedDb';
import { getLocalDateString, formatDate, formatTime, getSaleChronologicalTimestamp } from './utils';

const STORAGE_KEYS = {
  PRODUCTS: 'sharui_products_v4',
  LOGS: 'sharui_logs_v4',
  SALES: 'sharui_sales_v4',
  INVOICES: 'sharui_invoices_v4',
  SETTINGS: 'sharui_settings_v4',
  INITIALIZED: 'sharui_db_initialized_v4',
  MOVEMENTS: 'sharui_movements_v4',
  SECURITY_PIN: 'sharui_security_pin_v4',
  REGISTERED_CUSTOMERS: 'sharui_registered_customers_v4',
};



export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  storeName: 'SHARUI Calzados',
  phone: '77234567',
  whatsapp: '77234567',
  logo: '',
  slogan: 'Exclusividad, Calidad y Estilo en Cada Paso',
  address: 'Av. Heroínas #340, Galería Comercial',
  city: 'Cochabamba',
};

// Initial Seed data (only loaded the VERY FIRST TIME on a completely fresh browser)
const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    code: '8001',
    name: 'Sneakers Retro Urban Black & White',
    brand: 'KNUP',
    origin: 'Original',
    category: 'urbano',
    description: 'Zapatilla urbana de alta resistencia con amortiguación de aire y suela antideslizante.',
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80',
    totalCost: 1080,
    packageType: 'media_docena',
    unitsCount: 6,
    unitCost: 180,
    suggestedSalePrice: 320,
    salePrice: 320,
    costPrice: 180,
    variants: [
      {
        id: 'var-001-1',
        colorName: 'Negro / Blanco',
        subCode: 'F1',
        fullCode: '8001 F1',
        image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80',
        sizes: ['38', '39', '40', '40', '41', '42']
      }
    ],
    sizes: ['38', '39', '40', '40', '41', '42'],
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'prod-002',
    code: '9020',
    name: 'Runner Pro Hyper Velocity',
    brand: 'NIKE',
    origin: 'Original',
    category: 'running',
    description: 'Calzado técnico para running con malla transpirable y espuma reactiva.',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
    totalCost: 2640,
    packageType: 'docena',
    unitsCount: 12,
    unitCost: 220,
    suggestedSalePrice: 420,
    salePrice: 420,
    costPrice: 220,
    variants: [
      {
        id: 'var-002-1',
        colorName: 'Rojo Carmesí',
        subCode: 'R1',
        fullCode: '9020 R1',
        image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80',
        sizes: ['39', '40', '40', '41', '41', '42']
      },
      {
        id: 'var-002-2',
        colorName: 'Negro Stealth',
        subCode: 'B2',
        fullCode: '9020 B2',
        image: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&w=400&q=80',
        sizes: ['40', '41', '41', '42', '42', '43']
      }
    ],
    sizes: ['39', '40', '40', '41', '41', '42', '40', '41', '41', '42', '42', '43'],
    createdAt: Date.now() - 86400000 * 4,
  },
  {
    id: 'prod-003',
    code: '7500',
    name: 'Mocasín Ejecutivo Cuero Café',
    brand: 'SHARQ',
    origin: 'Original',
    category: 'clásico',
    description: 'Cuero genuino tratado a mano con plantilla acolchada de memoria y suela cosida.',
    image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=400&q=80',
    totalCost: 1500,
    packageType: 'media_docena',
    unitsCount: 6,
    unitCost: 250,
    suggestedSalePrice: 490,
    salePrice: 490,
    costPrice: 250,
    variants: [
      {
        id: 'var-003-1',
        colorName: 'Café Caramelo',
        subCode: 'C1',
        fullCode: '7500 C1',
        image: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=400&q=80',
        sizes: ['40', '40', '41', '41', '42', '42']
      }
    ],
    sizes: ['40', '40', '41', '41', '42', '42'],
    createdAt: Date.now() - 86400000 * 3,
  }
];

const INITIAL_SALES: Sale[] = [
  {
    id: 'sale-001',
    date: getLocalDateString(new Date(Date.now() - 86400000 * 2)),
    time: '10:30',
    dateTimeString: `${formatDate(getLocalDateString(new Date(Date.now() - 86400000 * 2)))} 10:30`,
    status: 'Compra',
    productCode: '8001 F1',
    subCode: 'F1',
    fullCode: '8001 F1',
    selectedSize: '40',
    price: 320,
    paymentMethod: 'QR',
    clientName: 'Carlos Mendoza Rios',
    whatsapp: '77234567',
    city: 'La Paz',
    logistics: 'Delivery o entrega',
    createdAt: Date.now() - 86400000 * 2,
    invoiceId: 'FAC-2026-001',
  },
  {
    id: 'sale-002',
    date: getLocalDateString(new Date(Date.now() - 86400000 * 1)),
    time: '15:45',
    dateTimeString: `${formatDate(getLocalDateString(new Date(Date.now() - 86400000 * 1)))} 15:45`,
    status: 'Compra',
    productCode: '9020 R1',
    subCode: 'R1',
    fullCode: '9020 R1',
    selectedSize: '41',
    price: 420,
    paymentMethod: 'QR',
    clientName: 'Valeria Torrico',
    whatsapp: '76543210',
    city: 'Santa Cruz',
    logistics: 'Envío interdepartamental',
    createdAt: Date.now() - 86400000 * 1,
    invoiceId: 'FAC-2026-002',
  },
  {
    id: 'sale-003',
    date: getLocalDateString(new Date()),
    time: '11:15',
    dateTimeString: `${formatDate(getLocalDateString(new Date()))} 11:15`,
    status: 'Reserva',
    productCode: '7500 C1',
    subCode: 'C1',
    fullCode: '7500 C1',
    selectedSize: '42',
    price: 490,
    paymentMethod: 'Efectivo',
    clientName: 'Alejandro Morales',
    whatsapp: '71239845',
    city: 'Cochabamba',
    logistics: 'En tienda',
    createdAt: Date.now() - 3600000 * 3,
  },
];

const INITIAL_LOGS: DailyLogEntry[] = [
  {
    id: 'log-001',
    date: getLocalDateString(new Date(Date.now() - 86400000 * 2)),
    time: '09:00',
    amount: 320,
    concept: 'Venta Sneakers Retro Urban Black (Carlos Mendoza)',
    category: 'Ingresos',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'log-002',
    date: getLocalDateString(new Date(Date.now() - 86400000 * 2)),
    time: '11:20',
    amount: 50,
    concept: 'Campaña publicitaria en Meta Ads (Facebook/Instagram)',
    category: 'Marketing y Publicidad',
    createdAt: Date.now() - 86400000 * 2 + 1000,
  },
  {
    id: 'log-003',
    date: getLocalDateString(new Date(Date.now() - 86400000 * 1)),
    time: '14:10',
    amount: 420,
    concept: 'Venta Runner Pro Hyper Velocity (Valeria Torrico)',
    category: 'Ingresos',
    createdAt: Date.now() - 86400000 * 1,
  },
  {
    id: 'log-004',
    date: getLocalDateString(new Date(Date.now() - 86400000 * 1)),
    time: '16:30',
    amount: 35,
    concept: 'Envío encomienda flota interdepartamental a Santa Cruz',
    category: 'Transporte',
    createdAt: Date.now() - 86400000 * 1 + 2000,
  },
  {
    id: 'log-005',
    date: getLocalDateString(new Date()),
    time: '10:00',
    amount: 60,
    concept: 'Recarga saldo corporativo y WhatsApp Business API',
    category: 'Comunicaciones',
    createdAt: Date.now() - 3600000 * 4,
  },
];

const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-001',
    invoiceNumber: 'FAC-2026-001',
    date: getLocalDateString(new Date(Date.now() - 86400000 * 2)),
    time: '10:30',
    dateTimeString: `${formatDate(getLocalDateString(new Date(Date.now() - 86400000 * 2)))} 10:30`,
    saleId: 'sale-001',
    clientName: 'Carlos Mendoza Rios',
    clientTaxId: '4938201018',
    clientPhone: '77234567',
    clientCity: 'La Paz',
    items: [
      {
        id: 'item-1',
        description: 'KNUP 8001 F1 (Talla 40)',
        size: '40',
        quantity: 1,
        unitPrice: 320,
        total: 320
      }
    ],
    subtotal: 320,
    discount: 0,
    tax: 0,
    total: 320,
    status: 'Pagada',
    paymentMethod: 'QR',
    notes: 'Entregado a conformidad.',
    terms: 'Garantía oficial de 30 días.',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'inv-002',
    invoiceNumber: 'FAC-2026-002',
    date: getLocalDateString(new Date(Date.now() - 86400000 * 1)),
    time: '15:45',
    dateTimeString: `${formatDate(getLocalDateString(new Date(Date.now() - 86400000 * 1)))} 15:45`,
    saleId: 'sale-002',
    clientName: 'Valeria Torrico',
    clientTaxId: '6382910014',
    clientPhone: '76543210',
    clientCity: 'Santa Cruz',
    items: [
      {
        id: 'item-2',
        description: 'NIKE 9020 R1 (Talla 41)',
        size: '41',
        quantity: 1,
        unitPrice: 420,
        total: 420
      }
    ],
    subtotal: 420,
    discount: 0,
    tax: 0,
    total: 420,
    status: 'Pagada',
    paymentMethod: 'QR',
    notes: 'Guía de transporte interdepartamental adjunta.',
    terms: 'Cambio de talla sujeto a stock en 48h.',
    createdAt: Date.now() - 86400000 * 1,
  }
];

const INITIAL_MOVEMENTS: AppMovementLog[] = [
  {
    id: 'mov-init-1',
    timestamp: Date.now() - 86400000 * 2,
    date: formatDate(getLocalDateString(new Date(Date.now() - 86400000 * 2))),
    time: '10:30',
    type: 'VENTA',
    title: 'Venta registrada: 8001 F1 (Compra)',
    details: 'Cliente: Carlos Mendoza Rios • Talla: 40 • Monto: Bs 320.00 • Pago: QR',
    author: 'Administrador'
  },
  {
    id: 'mov-init-2',
    timestamp: Date.now() - 86400000 * 1,
    date: formatDate(getLocalDateString(new Date(Date.now() - 86400000 * 1))),
    time: '15:45',
    type: 'VENTA',
    title: 'Venta registrada: 9020 R1 (Compra)',
    details: 'Cliente: Valeria Torrico • Talla: 41 • Monto: Bs 420.00 • Pago: QR',
    author: 'Administrador'
  },
  {
    id: 'mov-init-3',
    timestamp: Date.now() - 3600000 * 4,
    date: formatDate(getLocalDateString(new Date())),
    time: '10:00',
    type: 'LIBRO_DIARIO',
    title: 'Registro Libro Diario: Comunicaciones',
    details: 'Concepto: Recarga saldo corporativo y WhatsApp Business API • Monto: Bs 60.00',
    author: 'Administrador'
  },
  {
    id: 'mov-init-4',
    timestamp: Date.now() - 3600000 * 3,
    date: formatDate(getLocalDateString(new Date())),
    time: '11:15',
    type: 'VENTA',
    title: 'Reserva registrada: 7500 C1 (Reserva)',
    details: 'Cliente: Alejandro Morales • Talla: 42 • Monto: Bs 490.00 • Anticipo: Bs 150.00',
    author: 'Administrador'
  }
];

export class StorageService {
  private static memoryCache: {
    products?: Product[];
    logs?: DailyLogEntry[];
    sales?: Sale[];
    invoices?: Invoice[];
    settings?: StoreSettings;
    movements?: AppMovementLog[];
    registeredCustomers?: Customer[];
  } = {};


  // Check if initial run
  private static checkAndInit(): void {
    if (typeof window === 'undefined') return;
    const isInit = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!isInit) {
      // First time initialization ONLY
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      this.saveToStorage(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS);
      this.saveToStorage(STORAGE_KEYS.SALES, INITIAL_SALES);
      this.saveToStorage(STORAGE_KEYS.LOGS, INITIAL_LOGS);
      this.saveToStorage(STORAGE_KEYS.INVOICES, INITIAL_INVOICES);
      this.saveToStorage(STORAGE_KEYS.SETTINGS, DEFAULT_STORE_SETTINGS);
      this.saveToStorage(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
      localStorage.setItem(STORAGE_KEYS.SECURITY_PIN, '1234');
      // Also async save to IndexedDB
      idbSet(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS).catch(() => {});
      idbSet(STORAGE_KEYS.SALES, INITIAL_SALES).catch(() => {});
      idbSet(STORAGE_KEYS.LOGS, INITIAL_LOGS).catch(() => {});
      idbSet(STORAGE_KEYS.INVOICES, INITIAL_INVOICES).catch(() => {});
      idbSet(STORAGE_KEYS.SETTINGS, DEFAULT_STORE_SETTINGS).catch(() => {});
      idbSet(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS).catch(() => {});
    } else {
      // Ensure movements exist if upgrading from earlier version
      if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) {
        this.saveToStorage(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
      }
      if (!localStorage.getItem(STORAGE_KEYS.SECURITY_PIN)) {
        localStorage.setItem(STORAGE_KEYS.SECURITY_PIN, '1234');
      }
    }
  }

  // Load from IndexedDB if available (e.g. for large image sets beyond 5MB localStorage limit)
  static async loadFromIndexedDB(): Promise<{
    products: Product[];
    sales: Sale[];
    logs: DailyLogEntry[];
    invoices: Invoice[];
    settings: StoreSettings;
  }> {
    try {
      const [idbProducts, idbSales, idbLogs, idbInvoices, idbSettings] = await Promise.all([
        idbGet<Product[]>(STORAGE_KEYS.PRODUCTS),
        idbGet<Sale[]>(STORAGE_KEYS.SALES),
        idbGet<DailyLogEntry[]>(STORAGE_KEYS.LOGS),
        idbGet<Invoice[]>(STORAGE_KEYS.INVOICES),
        idbGet<StoreSettings>(STORAGE_KEYS.SETTINGS),
      ]);

      if (idbProducts !== null) {
        this.memoryCache.products = idbProducts;
      }
      if (idbSales !== null) {
        this.memoryCache.sales = idbSales;
      }
      if (idbLogs !== null) {
        this.memoryCache.logs = idbLogs;
      }
      if (idbInvoices !== null) {
        this.memoryCache.invoices = idbInvoices;
      }
      if (idbSettings !== null) {
        this.memoryCache.settings = idbSettings;
      }

      return {
        products: this.getProducts(),
        sales: this.getSales(),
        logs: this.getLogs(),
        invoices: this.getInvoices(),
        settings: this.getStoreSettings(),
      };
    } catch (e) {
      console.warn("IndexedDB load error:", e);
      return {
        products: this.getProducts(),
        sales: this.getSales(),
        logs: this.getLogs(),
        invoices: this.getInvoices(),
        settings: this.getStoreSettings(),
      };
    }
  }

  // --- STORE SETTINGS ---
  static getStoreSettings(): StoreSettings {
    if (this.memoryCache.settings) return this.memoryCache.settings;
    const settings = this.getFromStorage<StoreSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_STORE_SETTINGS);
    this.memoryCache.settings = settings;
    return settings;
  }

  static setStoreSettingsRaw(settings: StoreSettings): void {
    this.memoryCache.settings = settings;
    this.saveToStorage(STORAGE_KEYS.SETTINGS, settings);
  }

  static async saveStoreSettings(settings: StoreSettings): Promise<void> {
    this.setStoreSettingsRaw(settings);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const docRef = doc(db, 'settings', currentUser.uid);
        await setDoc(docRef, {
          ...settings,
          updatedAt: Date.now(),
          ownerId: currentUser.uid,
        }, { merge: true });
      } catch (err) {
        console.error("Error saving store settings to Firestore:", err);
      }
    }
  }

  private static getFromStorage<T>(key: string, defaultValue: T): T {
    try {
      this.checkAndInit();
      const data = localStorage.getItem(key);
      if (data !== null) {
        return JSON.parse(data);
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private static saveToStorage<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // Save to IndexedDB as high-capacity backing store (can hold 50-90MB+ of images)
      idbSet(key, value).catch(() => {});
    } catch (e) {
      console.warn(`LocalStorage write error (${key}), saving to IndexedDB:`, e);
      idbSet(key, value).catch(() => {});
    }
  }

  // --- PRODUCTS ---
  static getProducts(): Product[] {
    if (this.memoryCache.products) return this.memoryCache.products;
    const list = this.getFromStorage<Product[]>(STORAGE_KEYS.PRODUCTS, []);
    this.memoryCache.products = list;
    return list;
  }

  static setProductsRaw(products: Product[]): void {
    this.memoryCache.products = products;
    this.saveToStorage(STORAGE_KEYS.PRODUCTS, products);
  }

  static async saveProduct(product: Product): Promise<void> {
    const current = this.getProducts();
    const index = current.findIndex(p => p.id === product.id);
    let updated: Product[];

    if (index >= 0) {
      updated = [...current];
      updated[index] = product;
      this.recordMovement(
        'EDICION', 
        `Edición de calzado: ${product.code}`, 
        `Marca: ${product.brand} • Tallas: ${product.sizes.join(', ')} • Precio: Bs ${product.salePrice}`
      );
    } else {
      updated = [product, ...current];
      this.recordMovement(
        'STOCK_INGRESO', 
        `Ingreso de nuevo stock: ${product.code}`, 
        `Marca: ${product.brand} • Cantidad: ${product.sizes.length} pares • Tallas: ${product.sizes.join(', ')} • Costo Total: Bs ${product.totalCost}`
      );
    }

    this.setProductsRaw(updated);

    // Sync to Firestore if authenticated
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const ownerId = currentUser.uid;
        const docRef = doc(db, 'products', product.id);
        await setDoc(docRef, {
          id: product.id,
          image: product.image,
          code: product.code,
          category: product.category,
          name: product.name,
          sizes: product.sizes,
          description: product.description || '',
          createdAt: product.createdAt || Date.now(),
          ownerId: ownerId,
          brand: product.brand || 'Otros',
          origin: product.origin || 'Original',
          totalCost: Number(product.totalCost || 0),
          packageType: product.packageType || 'manual',
          unitsCount: Number(product.unitsCount || product.sizes.length),
          unitCost: Number(product.unitCost || 0),
          suggestedSalePrice: Number(product.suggestedSalePrice || 0),
          salePrice: Number(product.salePrice || 0),
          costPrice: Number(product.costPrice || product.unitCost || 0),
          variants: product.variants || [],
        }, { merge: true });
      } catch (err) {
        console.warn("Operating in local/offline mode, Firestore product sync pending:", err);
      }
    }
  }

  static async deleteProduct(id: string): Promise<void> {
    const current = this.getProducts();
    const target = current.find(p => p.id === id);
    if (target) {
      this.recordMovement(
        'ELIMINACION', 
        `Eliminación de calzado: ${target.code}`, 
        `Marca: ${target.brand} • Tallas que tenía: ${target.sizes.join(', ')}`
      );
    }
    const updated = current.filter(p => p.id !== id);
    this.setProductsRaw(updated);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (err) {
        console.error('Error deleting product from Firestore:', err);
      }
    }
  }

  // --- ACCOUNTING LOGS ---
  static getLogs(): DailyLogEntry[] {
    if (this.memoryCache.logs) return this.memoryCache.logs;
    const list = this.getFromStorage<DailyLogEntry[]>(STORAGE_KEYS.LOGS, []);
    this.memoryCache.logs = list;
    return list;
  }

  static setLogsRaw(logs: DailyLogEntry[]): void {
    this.memoryCache.logs = logs;
    this.saveToStorage(STORAGE_KEYS.LOGS, logs);
  }

  static async saveLog(log: DailyLogEntry): Promise<void> {
    const current = this.getLogs();
    const index = current.findIndex(l => l.id === log.id);
    let updated: DailyLogEntry[];

    if (index >= 0) {
      updated = [...current];
      updated[index] = log;
      this.recordMovement(
        'EDICION', 
        `Edición Libro Diario: ${log.category}`, 
        `Concepto: ${log.concept} • Monto: Bs ${log.amount}`
      );
    } else {
      updated = [log, ...current];
      this.recordMovement(
        'LIBRO_DIARIO', 
        `Registro Libro Diario: ${log.category}`, 
        `Concepto: ${log.concept} • Monto: Bs ${log.amount}`
      );
    }
    this.setLogsRaw(updated);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const docRef = doc(db, 'accounting', log.id);
        await setDoc(docRef, {
          id: log.id,
          date: log.date,
          amount: Number(log.amount),
          concept: log.concept,
          category: log.category,
          isLocked: Boolean(log.isLocked),
          createdAt: log.createdAt || Date.now(),
          ownerId: currentUser.uid,
        }, { merge: true });
      } catch (err) {
        console.warn("Operating in local/offline mode, Firestore accounting sync pending:", err);
      }
    }
  }

  static async deleteLog(id: string): Promise<void> {
    const current = this.getLogs();
    const target = current.find(l => l.id === id);
    if (target) {
      this.recordMovement(
        'ELIMINACION', 
        `Eliminación asiento Libro Diario: ${target.category}`, 
        `Concepto: ${target.concept} • Monto: Bs ${target.amount}`
      );
    }
    const updated = current.filter(l => l.id !== id);
    this.setLogsRaw(updated);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'accounting', id));
      } catch (err) {
        console.error('Error deleting log from Firestore:', err);
      }
    }
  }

  // --- SALES ---
  static getSales(): Sale[] {
    if (this.memoryCache.sales) return this.memoryCache.sales;
    const list = this.getFromStorage<Sale[]>(STORAGE_KEYS.SALES, []);
    const sorted = [...list].sort((a, b) => getSaleChronologicalTimestamp(b) - getSaleChronologicalTimestamp(a));
    this.memoryCache.sales = sorted;
    return sorted;
  }

  static setSalesRaw(sales: Sale[]): void {
    const sorted = [...sales].sort((a, b) => getSaleChronologicalTimestamp(b) - getSaleChronologicalTimestamp(a));
    this.memoryCache.sales = sorted;
    this.saveToStorage(STORAGE_KEYS.SALES, sorted);
  }

  static async saveSale(sale: Sale): Promise<void> {
    const current = this.getSales();
    const index = current.findIndex(s => s.id === sale.id);
    let updated: Sale[];

    if (index >= 0) {
      updated = [...current];
      updated[index] = sale;
      this.recordMovement(
        'EDICION', 
        `Edición de venta: ${sale.fullCode || sale.productCode}`, 
        `Cliente: ${sale.clientName} • Talla: ${sale.selectedSize} • Monto: Bs ${sale.price} • Estado: ${sale.status}`
      );
    } else {
      updated = [sale, ...current];
      this.recordMovement(
        'VENTA', 
        `Venta registrada: ${sale.fullCode || sale.productCode} (${sale.status})`, 
        `Cliente: ${sale.clientName} • Talla: ${sale.selectedSize} • Monto: Bs ${sale.price} • Pago: ${sale.paymentMethod}`
      );
    }
    this.setSalesRaw(updated);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const docRef = doc(db, 'sales', sale.id);
        await setDoc(docRef, {
          id: sale.id,
          date: sale.date,
          time: sale.time || '',
          dateTimeString: sale.dateTimeString || '',
          status: sale.status,
          productCode: sale.productCode,
          subCode: sale.subCode || '',
          fullCode: sale.fullCode || sale.productCode,
          selectedSize: String(sale.selectedSize || ''),
          selectedSizeIndex: sale.selectedSizeIndex !== undefined ? Number(sale.selectedSizeIndex) : null,
          price: Number(sale.price),
          advancePayment: sale.advancePayment !== undefined ? Number(sale.advancePayment) : Number(sale.price),
          remainingBalance: sale.remainingBalance !== undefined ? Number(sale.remainingBalance) : 0,
          paymentMethod: sale.paymentMethod || 'Efectivo',
          clientName: sale.clientName,
          whatsapp: sale.whatsapp,
          city: sale.city,
          logistics: sale.logistics,
          discount: Number(sale.discount || 0),
          invoiceId: sale.invoiceId || '',
          notes: sale.notes || '',
          createdAt: sale.createdAt || Date.now(),
          ownerId: currentUser.uid,
        }, { merge: true });
      } catch (err) {
        console.warn("Operating in local/offline mode, Firestore sale sync pending:", err);
      }
    }
  }

  static async deleteSale(id: string): Promise<void> {
    const current = this.getSales();
    const target = current.find(s => s.id === id);
    if (target) {
      this.recordMovement(
        'ELIMINACION', 
        `Eliminación de venta: ${target.fullCode || target.productCode}`, 
        `Cliente: ${target.clientName} • Talla: ${target.selectedSize} • Monto: Bs ${target.price}`
      );
    }
    const updated = current.filter(s => s.id !== id);
    this.setSalesRaw(updated);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'sales', id));
      } catch (err) {
        console.error('Error deleting sale from Firestore:', err);
      }
    }
  }

  // --- INVOICES ---
  static getInvoices(): Invoice[] {
    if (this.memoryCache.invoices) return this.memoryCache.invoices;
    const list = this.getFromStorage<Invoice[]>(STORAGE_KEYS.INVOICES, []);
    this.memoryCache.invoices = list;
    return list;
  }

  static setInvoicesRaw(invoices: Invoice[]): void {
    this.memoryCache.invoices = invoices;
    this.saveToStorage(STORAGE_KEYS.INVOICES, invoices);
  }

  static async saveInvoice(invoice: Invoice): Promise<void> {
    const current = this.getInvoices();
    const index = current.findIndex(i => i.id === invoice.id);
    let updated: Invoice[];

    if (index >= 0) {
      updated = [...current];
      updated[index] = invoice;
    } else {
      updated = [invoice, ...current];
    }
    this.setInvoicesRaw(updated);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const docRef = doc(db, 'invoices', invoice.id);
        await setDoc(docRef, {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          time: invoice.time || '',
          dateTimeString: invoice.dateTimeString || '',
          saleId: invoice.saleId || '',
          clientName: invoice.clientName,
          clientTaxId: invoice.clientTaxId || '',
          clientPhone: invoice.clientPhone || '',
          clientCity: invoice.clientCity || '',
          items: invoice.items,
          subtotal: Number(invoice.subtotal),
          discount: Number(invoice.discount || 0),
          tax: Number(invoice.tax || 0),
          total: Number(invoice.total),
          advancePayment: invoice.advancePayment !== undefined ? Number(invoice.advancePayment) : Number(invoice.total),
          remainingBalance: invoice.remainingBalance !== undefined ? Number(invoice.remainingBalance) : 0,
          status: invoice.status,
          paymentMethod: invoice.paymentMethod,
          notes: invoice.notes || '',
          createdAt: invoice.createdAt || Date.now(),
          ownerId: currentUser.uid,
        }, { merge: true });
      } catch (err) {
        console.error('Error saving invoice to Firestore:', err);
      }
    }
  }

  static async deleteInvoice(id: string): Promise<void> {
    const current = this.getInvoices();
    const updated = current.filter(i => i.id !== id);
    this.setInvoicesRaw(updated);

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'invoices', id));
      } catch (err) {
        console.error('Error deleting invoice from Firestore:', err);
      }
    }
  }

  // --- APP MOVEMENTS AUDIT LOG (WITH STRICT 5-DAY AUTO-PURGE) ---
  static getMovements(): AppMovementLog[] {
    if (this.memoryCache.movements) {
      const now = Date.now();
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      const valid = this.memoryCache.movements.filter(m => (now - m.timestamp) <= fiveDaysMs);
      if (valid.length !== this.memoryCache.movements.length) {
        this.memoryCache.movements = valid;
        this.saveToStorage(STORAGE_KEYS.MOVEMENTS, valid);
      }
      return valid;
    }

    const list = this.getFromStorage<AppMovementLog[]>(STORAGE_KEYS.MOVEMENTS, INITIAL_MOVEMENTS);
    const now = Date.now();
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
    // Auto-delete movements older than 5 days to preserve permanent storage space
    const valid = list.filter(m => (now - m.timestamp) <= fiveDaysMs);
    if (valid.length !== list.length) {
      this.saveToStorage(STORAGE_KEYS.MOVEMENTS, valid);
    }
    const sorted = valid.sort((a, b) => b.timestamp - a.timestamp);
    this.memoryCache.movements = sorted;
    return sorted;
  }

  static recordMovement(
    type: MovementType, 
    title: string, 
    details: string, 
    author: string = 'Usuario'
  ): void {
    try {
      const current = this.getMovements();
      const now = new Date();
      const newEntry: AppMovementLog = {
        id: 'mov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        timestamp: Date.now(),
        date: formatDate(getLocalDateString(now)),
        time: formatTime(now),
        type,
        title,
        details,
        author: auth.currentUser?.email || author,
      };

      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
      const updated = [newEntry, ...current].filter(m => (Date.now() - m.timestamp) <= fiveDaysMs);
      this.memoryCache.movements = updated;
      this.saveToStorage(STORAGE_KEYS.MOVEMENTS, updated);
    } catch (e) {
      console.warn("Error recording app movement:", e);
    }
  }

  // --- 4-DIGIT SECURITY PIN ---
  static getSecurityPin(): string {
    try {
      const pin = localStorage.getItem(STORAGE_KEYS.SECURITY_PIN);
      return pin && pin.trim().length === 4 ? pin.trim() : '1234';
    } catch {
      return '1234';
    }
  }

  static setSecurityPin(pin: string): void {
    try {
      const clean = pin.trim().slice(0, 4);
      localStorage.setItem(STORAGE_KEYS.SECURITY_PIN, clean);
    } catch (e) {
      console.warn("Error saving security PIN:", e);
    }
  }

  // --- REGISTERED CUSTOMERS (MANUAL CREATION & EXCEL IMPORT) ---
  static getRegisteredCustomers(): Customer[] {
    if (this.memoryCache.registeredCustomers) return this.memoryCache.registeredCustomers;
    const list = this.getFromStorage<Customer[]>(STORAGE_KEYS.REGISTERED_CUSTOMERS, []);
    this.memoryCache.registeredCustomers = list;
    return list;
  }

  static setRegisteredCustomersRaw(customers: Customer[]): void {
    this.memoryCache.registeredCustomers = customers;
    this.saveToStorage(STORAGE_KEYS.REGISTERED_CUSTOMERS, customers);
  }

  static saveRegisteredCustomer(customer: Customer): void {
    const current = this.getRegisteredCustomers();
    const index = current.findIndex(c => c.id === customer.id || (c.whatsapp && c.whatsapp === customer.whatsapp && c.name.toLowerCase() === customer.name.toLowerCase()));
    let updated: Customer[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...current[index], ...customer };
      this.recordMovement('EDICION', `Edición de cliente: ${customer.name}`, `Contacto: ${customer.whatsapp} • Ciudad: ${customer.city} • Categoría: ${customer.tier}`);
    } else {
      updated = [customer, ...current];
      this.recordMovement('EDICION', `Registro de cliente: ${customer.name}`, `Contacto: ${customer.whatsapp} • Ciudad: ${customer.city} • Categoría: ${customer.tier}`);
    }
    this.setRegisteredCustomersRaw(updated);
  }

  static saveRegisteredCustomersBatch(customers: Customer[]): void {
    const current = this.getRegisteredCustomers();
    const updated = [...current];
    customers.forEach(nc => {
      const idx = updated.findIndex(c => (c.whatsapp && c.whatsapp.length > 5 && c.whatsapp === nc.whatsapp) || c.name.toLowerCase() === nc.name.toLowerCase());
      if (idx >= 0) {
        updated[idx] = { ...updated[idx], ...nc };
      } else {
        updated.push(nc);
      }
    });
    this.setRegisteredCustomersRaw(updated);
    this.recordMovement('EDICION', `Importación Excel de ${customers.length} clientes`, `Clientes registrados en cartera comercial`);
  }

  static deleteRegisteredCustomer(id: string): void {
    const current = this.getRegisteredCustomers();
    const target = current.find(c => c.id === id);
    if (target) {
      this.recordMovement('ELIMINACION', `Baja de cliente registrado: ${target.name}`, `Contacto: ${target.whatsapp}`);
    }
    const updated = current.filter(c => c.id !== id);
    this.setRegisteredCustomersRaw(updated);
  }
}

