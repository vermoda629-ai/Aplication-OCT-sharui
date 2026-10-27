/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';
import { 
  BarChart3, 
  Package, 
  BookOpen, 
  ShoppingCart, 
  Users, 
  LogOut, 
  LogIn, 
  Maximize, 
  Minimize, 
  FileText, 
  Zap, 
  Sparkles, 
  Clock,
  Table as TableIcon,
  Tag,
  Settings
} from 'lucide-react';
import { Section, Product, DailyLogEntry, Sale, Invoice, StoreSettings } from './types';
import { StorageService } from './lib/storage';
import { auth, db, signInWithGoogle, logout, testConnection } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { cn, formatDate } from './lib/utils';

// Core Application Sections
import ReportsPanelSection from './components/ReportsPanelSection';
import InventorySection from './components/InventorySection';
import CatalogFastSaleSection from './components/CatalogFastSaleSection';
import SalesAndInvoicesSection from './components/SalesAndInvoicesSection';
import AccountingSection from './components/AccountingSection';
import CustomersSection from './components/CustomersSection';
import StoreSettingsModal from './components/StoreSettingsModal';

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('CATALOGO');
  const [isNavVisible, setIsNavVisible] = useState(true);
  const { scrollY } = useScroll();
  const lastScrollY = useRef(0);

  // Smooth scroll to top when navigating or clicking current section
  const handleNavigateSection = (target: Section) => {
    setActiveSection(target);
    // Always scroll smoothly to the very top of the window
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Also scroll documentElement / body in case of nested scroll containers
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  // Core Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<DailyLogEntry[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(StorageService.getStoreSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Top navigation visibility tracking: floating nav ONLY appears when top nav is scrolled out of view
  const topNavRef = useRef<HTMLElement>(null);
  const [isTopNavVisible, setIsTopNavVisible] = useState(true);

  // Floating nav mouse idle detection: disappears if user does not use the mouse/touch
  const [isMouseActive, setIsMouseActive] = useState(true);
  const [isHoveringNav, setIsHoveringNav] = useState(false);
  const mouseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Floating nav lock: strictly hide when user is registering stock, registering sales, or any modal/recuadro/box is active
  const [isOverlayOrBusy, setIsOverlayOrBusy] = useState(false);

  useEffect(() => {
    const checkOverlayAndRegistrations = () => {
      // 1. Any open modal, dialog, or drawer (recuadros emergentes)
      const modalElements = document.querySelectorAll(
        '[role="dialog"], [data-modal="true"], [data-app-modal="true"], .fixed.inset-0.z-50, .fixed.inset-0.z-\\[100\\]'
      );
      const hasModal = modalElements.length > 0;

      // 2. Active stock registration form or editing box in Inventory
      const registrationForm = document.querySelector(
        '#inventory-edit-box, [data-registration-active="true"]'
      );
      const hasRegistrationForm = !!registrationForm;

      // 3. Settings modal or any global overlay
      const isSettingsActive = isSettingsOpen;

      setIsOverlayOrBusy(hasModal || hasRegistrationForm || isSettingsActive);
    };

    checkOverlayAndRegistrations();

    // Observe changes in DOM for immediate response when modals/forms appear or disappear
    const observer = new MutationObserver(() => {
      checkOverlayAndRegistrations();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'id', 'data-modal', 'data-registration-active', 'role']
    });

    window.addEventListener('scroll', checkOverlayAndRegistrations, { passive: true });
    window.addEventListener('resize', checkOverlayAndRegistrations, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', checkOverlayAndRegistrations);
      window.removeEventListener('resize', checkOverlayAndRegistrations);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    const handleScroll = () => {
      if (topNavRef.current) {
        const rect = topNavRef.current.getBoundingClientRect();
        // Top nav is hidden when its bottom has scrolled past the top of the window (<= 0)
        setIsTopNavVisible(rect.bottom > 0);
      } else {
        setIsTopNavVisible(window.scrollY < 70);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Track mouse movement, wheel, and touch to auto-hide floating nav when inactive
  useEffect(() => {
    const handleActivity = () => {
      setIsMouseActive(true);
      if (mouseTimerRef.current) {
        clearTimeout(mouseTimerRef.current);
      }
      mouseTimerRef.current = setTimeout(() => {
        setIsMouseActive(false);
      }, 2500); // hides after 2.5s of idle
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('pointermove', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });
    window.addEventListener('wheel', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('touchmove', handleActivity, { passive: true });

    handleActivity();

    return () => {
      if (mouseTimerRef.current) clearTimeout(mouseTimerRef.current);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('pointermove', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('wheel', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('touchmove', handleActivity);
    };
  }, []);

  // Initialize initial data from local storage and IndexedDB
  useEffect(() => {
    setProducts(StorageService.getProducts());
    setLogs(StorageService.getLogs());
    setSales(StorageService.getSales());
    setInvoices(StorageService.getInvoices());

    // Async hydration from IndexedDB for high capacity storage (900+ products with images)
    StorageService.loadFromIndexedDB().then((data) => {
      if (data.products.length > 0 || data.sales.length > 0 || data.logs.length > 0 || data.invoices.length > 0) {
        setProducts(data.products);
        setLogs(data.logs);
        setSales(data.sales);
        setInvoices(data.invoices);
      }
    }).catch(() => {});
  }, []);

  // Fullscreen support
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Real-Time Cloud Synchronization
  useEffect(() => {
    let unsubProducts: (() => void) | null = null;
    let unsubSales: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;
    let unsubInvoices: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);

      if (u) {
        try {
          // Products listener - allows emptying to 0 documents when user deletes all!
          const productsQuery = query(collection(db, 'products'), where('ownerId', '==', u.uid));
          unsubProducts = onSnapshot(productsQuery, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
            StorageService.setProductsRaw(list);
            setProducts(list);
          }, (err) => {
            console.error("Error al sincronizar productos:", err);
          });

          // Sales listener
          const salesQuery = query(collection(db, 'sales'), where('ownerId', '==', u.uid));
          unsubSales = onSnapshot(salesQuery, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
            StorageService.setSalesRaw(list);
            setSales(list);
          }, (err) => {
            console.error("Error al sincronizar ventas:", err);
          });

          // Accounting logs listener
          const logsQuery = query(collection(db, 'accounting'), where('ownerId', '==', u.uid));
          unsubLogs = onSnapshot(logsQuery, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as DailyLogEntry));
            StorageService.setLogsRaw(list);
            setLogs(list);
          }, (err) => {
            console.error("Error al sincronizar libro diario:", err);
          });

          // Invoices listener
          const invoicesQuery = query(collection(db, 'invoices'), where('ownerId', '==', u.uid));
          unsubInvoices = onSnapshot(invoicesQuery, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Invoice));
            StorageService.setInvoicesRaw(list);
            setInvoices(list);
          }, (err) => {
            console.error("Error al sincronizar facturas:", err);
          });
        } catch (e) {
          console.error("Error initializing snapshot listeners:", e);
        }
      } else {
        if (unsubProducts) unsubProducts();
        if (unsubSales) unsubSales();
        if (unsubLogs) unsubLogs();
        if (unsubInvoices) unsubInvoices();
      }
    });

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      clearInterval(timer);
      unsubscribe();
      if (unsubProducts) unsubProducts();
      if (unsubSales) unsubSales();
      if (unsubLogs) unsubLogs();
      if (unsubInvoices) unsubInvoices();
    };
  }, []);

  // Smooth scroll handler for mobile navigation
  useMotionValueEvent(scrollY, "change", (latest) => {
    const diff = latest - lastScrollY.current;
    if (Math.abs(diff) > 8) {
      if (diff > 0 && latest > 60) {
        setIsNavVisible(false);
      } else {
        setIsNavVisible(true);
      }
    }
    lastScrollY.current = latest;
  });

  const renderCurrentSection = () => {
    switch (activeSection) {
      case 'INFORMES':
        return (
          <ReportsPanelSection
            products={products}
            logs={logs}
            sales={sales}
            invoices={invoices}
            currentTime={currentTime}
            onNavigateToSection={(s) => setActiveSection(s)}
          />
        );
      case 'INVENTARIO':
        return (
          <InventorySection 
            products={products} 
            setProducts={setProducts} 
            sales={sales} 
          />
        );
      case 'CATALOGO':
        return (
          <CatalogFastSaleSection
            products={products}
            sales={sales}
            setSales={setSales}
            invoices={invoices}
            setInvoices={setInvoices}
            onNavigateToVentas={() => setActiveSection('VENTAS')}
            storeSettings={storeSettings}
          />
        );
      case 'VENTAS':
        return (
          <SalesAndInvoicesSection 
            sales={sales} 
            setSales={setSales} 
            invoices={invoices}
            setInvoices={setInvoices}
            products={products}
            setProducts={setProducts}
            storeSettings={storeSettings}
          />
        );
      case 'CLIENTES':
        return (
          <CustomersSection 
            sales={sales} 
          />
        );
      case 'INVENTARIO':
        return (
          <InventorySection 
            products={products} 
            setProducts={setProducts} 
            sales={sales} 
          />
        );
      case 'LIBRO':
        return (
          <AccountingSection 
            logs={logs} 
            setLogs={setLogs} 
          />
        );
      case 'INFORMES':
      default:
        return (
          <ReportsPanelSection
            products={products}
            logs={logs}
            sales={sales}
            invoices={invoices}
            currentTime={currentTime}
            onNavigateToSection={(s) => setActiveSection(s)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen pb-32 bg-brand-bg text-brand-text selection:bg-brand-accent selection:text-white overflow-x-hidden">
      {/* Background ambiance - clean subtle dark gradient */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[2200px] h-[300px] bg-gradient-to-b from-blue-900/10 via-neutral-900/5 to-transparent pointer-events-none -z-10" />

      {/* Top Header Navigation Bar - Differentiated visually with structured dark slate background */}
      <header 
        ref={topNavRef}
        className="relative z-40 bg-[#0f1117] border-b border-neutral-800 px-3 sm:px-5 lg:px-8 py-3 shadow-xl"
      >
        <div className="w-full max-w-[2200px] mx-auto flex items-center justify-between">
          <div 
            onClick={() => handleNavigateSection('CATALOGO')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-sm tracking-tighter">SH</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white leading-none">SHARUI</h1>
                <span className="text-[9px] font-black bg-blue-950 text-blue-300 px-2 py-0.5 rounded-full border border-blue-600/40">
                  ENTERPRISE
                </span>
              </div>
              <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                Business & Sales Intelligence
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links (Exact User Order: Catálogo, Ventas, Clientes, Inventario, Informes, Libro Diario) */}
          <nav className="hidden lg:flex items-center gap-1 bg-black/60 p-1.5 rounded-2xl border border-neutral-800">
            <TopNavLink 
              active={activeSection === 'CATALOGO'} 
              label="Catálogo" 
              icon={<Tag className="w-4 h-4" />} 
              onClick={() => handleNavigateSection('CATALOGO')} 
            />
            <TopNavLink 
              active={activeSection === 'VENTAS'} 
              label="Ventas" 
              icon={<ShoppingCart className="w-4 h-4" />} 
              onClick={() => handleNavigateSection('VENTAS')} 
            />
            <TopNavLink 
              active={activeSection === 'CLIENTES'} 
              label="Clientes" 
              icon={<Users className="w-4 h-4" />} 
              onClick={() => handleNavigateSection('CLIENTES')} 
            />
            <TopNavLink 
              active={activeSection === 'INVENTARIO'} 
              label="Inventario" 
              icon={<TableIcon className="w-4 h-4" />} 
              onClick={() => handleNavigateSection('INVENTARIO')} 
            />
            <TopNavLink 
              active={activeSection === 'INFORMES'} 
              label="Panel de Informes" 
              icon={<BarChart3 className="w-4 h-4" />} 
              onClick={() => handleNavigateSection('INFORMES')} 
            />
            <TopNavLink 
              active={activeSection === 'LIBRO'} 
              label="Libro Diario" 
              icon={<BookOpen className="w-4 h-4" />} 
              onClick={() => handleNavigateSection('LIBRO')} 
            />
          </nav>

          {/* Controls: Clock, Settings Gear, Fullscreen and Auth */}
          <div className="flex items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-300 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 font-mono" title="Fecha y hora oficial calibrada del sistema">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-neutral-400">{formatDate(currentTime)}</span>
              <span className="text-neutral-600">•</span>
              <span className="text-emerald-300 font-bold">{currentTime.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
            </div>

            {/* OPCIONES (Settings Gear Button at Top Right) */}
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-all cursor-pointer flex items-center gap-1.5"
              title="Opciones de la tienda (Nombre, WhatsApp, Logo, Eslogan y Dirección)"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-bold">Opciones</span>
            </button>

            <button 
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-all cursor-pointer"
              title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>

            {user ? (
              <div className="flex items-center gap-2 bg-neutral-900 p-1 rounded-2xl border border-neutral-800">
                <img 
                  src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} 
                  alt="" 
                  className="w-7 h-7 rounded-xl object-cover border border-neutral-700"
                />
                <span className="text-xs font-bold text-white px-1 hidden sm:inline max-w-[90px] truncate">
                  {user.displayName?.split(' ')[0] || 'Admin'}
                </span>
                <button 
                  onClick={logout}
                  title="Cerrar Sesión"
                  className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                  } catch (e) {
                    console.error("Login failed:", e);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-xs text-white uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Google Auth</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={cn(
        "mx-auto transition-all duration-200",
        activeSection === 'CATALOGO' 
          ? "w-full max-w-[2400px] px-2.5 sm:px-4 lg:px-6 pt-4 sm:pt-5" 
          : "max-w-7xl px-4 pt-6"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {renderCurrentSection()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Store Settings Modal */}
      <StoreSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={storeSettings}
        onSettingsUpdated={(newSettings) => setStoreSettings(newSettings)}
      />

      {/* Floating Navigation Bar - Semi-transparent, ONLY appears when browsing/navigating sections (top navbar is scrolled out of view, mouse is active, and NO modal/form/recuadro is open) */}
      <AnimatePresence>
        {!isTopNavVisible && !isOverlayOrBusy && (isMouseActive || isHoveringNav) && (
          <motion.nav
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onMouseEnter={() => setIsHoveringNav(true)}
            onMouseLeave={() => setIsHoveringNav(false)}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-black/65 backdrop-blur-xl rounded-3xl p-1.5 flex items-center justify-between gap-1 shadow-[0_15px_40px_rgba(0,0,0,0.85)] z-50 border border-neutral-700/60 w-[94%] max-w-[580px]"
          >
            <FloatingNavItem 
              active={activeSection === 'CATALOGO'} 
              icon={<Tag className="w-4 h-4" />} 
              label="Catálogo" 
              onClick={() => handleNavigateSection('CATALOGO')} 
            />
            <FloatingNavItem 
              active={activeSection === 'VENTAS'} 
              icon={<ShoppingCart className="w-4 h-4" />} 
              label="Ventas" 
              onClick={() => handleNavigateSection('VENTAS')} 
            />
            <FloatingNavItem 
              active={activeSection === 'CLIENTES'} 
              icon={<Users className="w-4 h-4" />} 
              label="Clientes" 
              onClick={() => handleNavigateSection('CLIENTES')} 
            />
            <FloatingNavItem 
              active={activeSection === 'INVENTARIO'} 
              icon={<TableIcon className="w-4 h-4" />} 
              label="Inventario" 
              onClick={() => handleNavigateSection('INVENTARIO')} 
            />
            <FloatingNavItem 
              active={activeSection === 'INFORMES'} 
              icon={<BarChart3 className="w-4 h-4" />} 
              label="Informes" 
              onClick={() => handleNavigateSection('INFORMES')} 
            />
            <FloatingNavItem 
              active={activeSection === 'LIBRO'} 
              icon={<BookOpen className="w-4 h-4" />} 
              label="Libro" 
              onClick={() => handleNavigateSection('LIBRO')} 
            />
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}

function TopNavLink({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer",
        active 
          ? "bg-blue-600 text-white font-black shadow-md shadow-blue-600/30" 
          : "text-neutral-300 hover:text-white hover:bg-neutral-800/80"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function FloatingNavItem({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-300 cursor-pointer",
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/40 font-black scale-100" 
          : "text-neutral-400 hover:text-white hover:bg-white/5 opacity-80"
      )}
    >
      {icon}
      <span className="text-[8px] font-bold tracking-tight mt-0.5">{label}</span>
    </button>
  );
}
