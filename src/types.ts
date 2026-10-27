/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Section = 
  | 'CATALOGO'
  | 'VENTAS'
  | 'CLIENTES'
  | 'INVENTARIO'
  | 'INFORMES'
  | 'LIBRO';

export interface StoreSettings {
  storeName: string; // e.g. "SHARUI Calzados"
  phone: string; // e.g. "77234567"
  whatsapp: string;
  logo: string; // Base64 or URL
  slogan: string; // e.g. "Exclusividad, Calidad y Estilo en Cada Paso"
  address: string; // e.g. "Av. Heroínas #340, Cochabamba"
  city: string; // "Cochabamba"
}

export interface ProductColorVariant {
  id: string;
  colorName: string;
  subCode: string; // e.g. "F1"
  fullCode: string; // e.g. "8001 F1"
  image: string; // Catalog photo for this specific color
  sizes: string[]; // e.g. ['39', '40', '40', '41', '42'] (duplicates allowed)
}

export interface Product {
  id: string;
  code: string; // Main code, e.g. "8001"
  name: string; // Derived or custom name (e.g. "Tenis Knup Urbano")
  brand: string; // KNUP, SHARQ, MATT MILL, NIKE, PUMA, ADIDAS, NEW BALANCE, BUSS, LACOSTE, I-RUN, AMIRI, VANS, Otros
  origin: string; // Original, 5g, brasilero, peruano, vietnamita, chino, coreano, Otros
  category: string; // casual, deportivo, running, trekking, urbano, clásico, Otros
  description: string;
  
  // Batch costing and units (Page 1)
  totalCost: number; // Total cost paid for the batch
  packageType: 'docena' | 'media_docena' | 'dos_docenas' | 'manual';
  unitsCount: number; // Total units entered (e.g. 12, 6, 24, or manual)
  unitCost: number; // Calculated: totalCost / unitsCount
  suggestedSalePrice: number; // Suggested selling price
  salePrice: number; // Final selling price

  // Variants and colors (Page 2)
  variants: ProductColorVariant[];

  // Flat helper properties for backward compatibility
  image: string; // Primary image (from first variant)
  sizes: string[]; // Flat list of all sizes across variants
  
  createdAt: number;
  ownerId?: string;
  costPrice?: number;
}

export type ProductSize = string;

export interface DailyLogEntry {
  id: string;
  date: string;
  time?: string;
  amount: number;
  concept: string;
  category: 'Ingresos' | 'Comunicaciones' | 'Transporte' | 'Administrativo' | 'Marketing y Publicidad' | 'Inversiones' | 'Mercadería' | 'Otros';
  isLocked?: boolean;
  createdAt: number;
  ownerId?: string;
}

export interface Sale {
  id: string;
  date: string;
  time: string; // e.g. "14:35"
  dateTimeString: string; // e.g. "30/09/2026, 14:35"
  status: 'Compra' | 'Reserva';
  productCode: string; // main code or fullCode
  subCode?: string; // subcode e.g. "F1"
  fullCode?: string; // e.g. "8001 F1"
  selectedSize: string;
  selectedSizeIndex?: number;
  price: number;
  advancePayment?: number; // Monto inicial adelantado al reservar
  remainingBalance?: number; // Monto restante a pagar
  paymentMethod: 'Efectivo' | 'QR' | 'Tarjeta';
  clientName: string;
  whatsapp: string;
  city: 'La Paz' | 'Santa Cruz' | 'Cochabamba' | 'Oruro' | 'Potosí' | 'Chuquisaca' | 'Tarija' | 'Beni' | 'Pando' | string;
  logistics: 'En tienda' | 'Delivery o entrega' | 'Envío interdepartamental' | 'Envío a domicilio' | 'Entrega en punto estratégico' | 'Recojo en tienda';
  discount?: number;
  createdAt: number;
  ownerId?: string;
  invoiceId?: string;
  notes?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  time?: string;
  dateTimeString?: string;
  dueDate?: string;
  saleId?: string;
  clientName: string;
  clientTaxId?: string; // NIT / CI
  clientPhone?: string;
  clientCity?: string;
  clientAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number; // e.g. IVA or 0
  total: number;
  advancePayment?: number;
  remainingBalance?: number;
  status: 'Emitida' | 'Pagada' | 'Anulada';
  paymentMethod: 'Efectivo' | 'QR' | 'Tarjeta' | 'Transferencia QR' | 'Depósito Bancario' | 'Contra Entrega';
  notes?: string;
  terms?: string;
  createdAt: number;
  ownerId?: string;
}

export type CustomerTier = 'Casual' | 'Intermitente' | 'Frecuente' | 'VIP' | 'Premium';

export interface Customer {
  id: string;
  name: string;
  whatsapp: string;
  city: string;
  tier: CustomerTier;
  totalPairsPurchased: number;
  sizesRequested: string[];
  lastPurchaseDate: string;
  lastPurchaseTime?: string;
  followUpAlert: string;
  notes?: string;
  createdAt: number;
  source?: 'manual' | 'excel' | 'sale';
}


export type MovementType = 
  | 'STOCK_INGRESO' 
  | 'VENTA' 
  | 'EDICION' 
  | 'ELIMINACION' 
  | 'LIBRO_DIARIO';

export interface AppMovementLog {
  id: string;
  timestamp: number;
  date: string;
  time: string;
  type: MovementType;
  title: string;
  details: string;
  author?: string;
}

