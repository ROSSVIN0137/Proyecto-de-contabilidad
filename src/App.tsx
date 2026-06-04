import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Trash2, 
  Plus, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle,
  FolderOpen,
  PieChart,
  Calculator,
  Eye,
  RotateCcw,
  PlusCircle,
  TrendingUp,
  Coins,
  ShieldCheck,
  Undo2
} from 'lucide-react';
import { Transaction, JournalLine, AccountLedger, AppTab } from './types';

const defaultTransactions: Transaction[] = [
  {
    id: "tx-1",
    concepto: "Pda 1 - Constitución de la Sociedad (Apertura)",
    fecha: "2026-06-01",
    lineas: [
      { cuenta: "Caja y Bancos", debe: 150000, haber: 0 },
      { cuenta: "Mobiliario y Equipo", debe: 25000, haber: 0 },
      { cuenta: "Capital Social", debe: 0, haber: 175000 }
    ]
  },
  {
    id: "tx-2",
    concepto: "Pda 2 - Compra de Mercaderías de Inventario al contado",
    fecha: "2026-06-02",
    lineas: [
      { cuenta: "Inventario de Mercaderías", debe: 40000, haber: 0 },
      { cuenta: "Caja y Bancos", debe: 0, haber: 40000 }
    ]
  },
  {
    id: "tx-3",
    concepto: "Pda 3 - Venta de Mercaderías al contado",
    fecha: "2026-06-03",
    lineas: [
      { cuenta: "Caja y Bancos", debe: 35000, haber: 0 },
      { cuenta: "Venta de Mercaderías", debe: 0, haber: 35000 }
    ]
  },
  {
    id: "tx-4",
    concepto: "Pda 4 - Pago de Alquiler de Oficinas",
    fecha: "2026-06-04",
    lineas: [
      { cuenta: "Gastos de Alquiler", debe: 5000, haber: 0 },
      { cuenta: "Caja y Bancos", debe: 0, haber: 5000 }
    ]
  }
];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>('diario');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Toast notification state supporting action triggers (like Undo!)
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    action?: {
      label: string;
      onTrigger: () => void;
    };
  } | null>(null);

  // Form states for manual registration
  const [formConcept, setFormConcept] = useState('');
  const [formLines, setFormLines] = useState<Array<{ cuenta: string; debe: string; haber: string }>>([
    { cuenta: '', debe: '', haber: '' },
    { cuenta: '', debe: '', haber: '' }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from local storage or set defaults
  useEffect(() => {
    try {
      const stored = localStorage.getItem('contabilidad_pro_data');
      if (stored) {
        setTransactions(JSON.parse(stored));
      } else {
        setTransactions(defaultTransactions);
        localStorage.setItem('contabilidad_pro_data', JSON.stringify(defaultTransactions));
      }
    } catch (e) {
      showToast('Error al cargar datos contables locales.', 'error');
    }
  }, []);

  // Save to storage helper
  const saveTransactions = (newTxs: Transaction[]) => {
    setTransactions(newTxs);
    localStorage.setItem('contabilidad_pro_data', JSON.stringify(newTxs));
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', action?: { label: string; onTrigger: () => void }) => {
    setToast({ message, type, action });
  };

  // Dismiss toast after some seconds unless it has an action button
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, toast.action ? 8000 : 4000); // Give users more time to click action
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- BUSINESS LOGIC: LEDGER INGENUITY ---
  const calculateEngine = (): AccountLedger[] => {
    const dict: Record<string, { num: number; name: string; debe: number; haber: number; history: Array<{ pda: string; debe: number; haber: number }> }> = {};
    let accountCounter = 1;

    // Process transactions sequentially
    transactions.forEach((tx, idx) => {
      tx.lineas.forEach(line => {
        let cleanName = line.cuenta.trim();
        if (!cleanName) return;

        // Clean prefix "a. " or "a " frequently used in conventional Latin journals for credits
        const normalizedName = cleanName.replace(/^a[\.\s]+|^a\s+/i, '').trim();
        const key = normalizedName.toUpperCase();

        if (!dict[key]) {
          dict[key] = {
            num: accountCounter++,
            name: normalizedName,
            debe: 0,
            haber: 0,
            history: []
          };
        }

        dict[key].debe += line.debe;
        dict[key].haber += line.haber;
        dict[key].history.push({
          pda: tx.concepto.split(' - ')[0] || `Pda ${idx + 1}`,
          debe: line.debe,
          haber: line.haber
        });
      });
    });

    return Object.values(dict).map(acc => {
      const balance = Math.abs(acc.debe - acc.haber);
      let balanceType: 'Deudor' | 'Acreedor' | 'Nulo' = 'Nulo';
      
      if (acc.debe > acc.haber) {
        balanceType = 'Deudor';
      } else if (acc.haber > acc.debe) {
        balanceType = 'Acreedor';
      }

      return {
        ...acc,
        balance,
        balanceType
      };
    }).sort((a, b) => a.num - b.num);
  };

  const catalog = calculateEngine();

  // Calculate global summary sums
  const globalSums = catalog.reduce((acc, current) => {
    acc.debeSum += current.debe;
    acc.haberSum += current.haber;
    if (current.balanceType === 'Deudor') acc.deudorSum += current.balance;
    if (current.balanceType === 'Acreedor') acc.acreedorSum += current.balance;
    return acc;
  }, { debeSum: 0, haberSum: 0, deudorSum: 0, acreedorSum: 0 });

  const isBalanced = Math.abs(globalSums.debeSum - globalSums.haberSum) < 0.01;

  // --- DELETING AND REMOVING ACTIONS (USER REQUEST ENABLERS) ---

  // 1. Delete INDIVIDUAL transaction from the journal
  const handleDeleteTransaction = (id: string) => {
    const backupTxs = [...transactions];
    const txToDelete = transactions.find(t => t.id === id);
    if (!txToDelete) return;

    const filtered = transactions.filter(t => t.id !== id);
    // Auto re-index and sanitize if applicable
    saveTransactions(filtered);

    // Show highly useful success toast with fully functional Undo!
    showToast(
      `Partida eliminada con éxito.`,
      'success',
      {
        label: 'Deshacer',
        onTrigger: () => {
          saveTransactions(backupTxs);
          showToast('Movimiento restaurado correctamente.', 'success');
        }
      }
    );
  };

  // 2. Remove line inside the manual entry builder form
  const handleRemoveFormLine = (index: number) => {
    if (formLines.length <= 2) {
      showToast('Una partida contable correcta requiere de al menos 2 líneas para la partida doble.', 'error');
      return;
    }
    const updated = formLines.filter((_, i) => i !== index);
    setFormLines(updated);
  };

  // 3. Clear all transactions completely
  const handleClearAllData = () => {
    const backupTxs = [...transactions];
    saveTransactions([]);
    setShowConfirmModal(false);
    showToast('Se han eliminado todos los registros del libro diario.', 'info', {
      label: 'Deshacer',
      onTrigger: () => {
        saveTransactions(backupTxs);
        showToast('Datos restaurados con éxito.', 'success');
      }
    });
  };

  // Reload standard test entries
  const handleLoadDefaults = () => {
    saveTransactions(defaultTransactions);
    showToast('Se cargaron las partidas demostrativas por defecto.');
  };

  // --- MANUAL JOURNAL REGISTRATION ---
  const handleAddFormLine = () => {
    setFormLines([...formLines, { cuenta: '', debe: '', haber: '' }]);
  };

  const handleFormLineChange = (index: number, field: 'cuenta' | 'debe' | 'haber', value: string) => {
    const updated = [...formLines];
    updated[index][field] = value;
    setFormLines(updated);
  };

  const calcActiveFormTotals = () => {
    let tDebe = 0;
    let tHaber = 0;
    formLines.forEach(line => {
      tDebe += parseFloat(line.debe) || 0;
      tHaber += parseFloat(line.haber) || 0;
    });
    return { tDebe, tHaber };
  };

  const { tDebe: currentFormDebe, tHaber: currentFormHaber } = calcActiveFormTotals();
  const isFormBalanced = currentFormDebe > 0 && Math.abs(currentFormDebe - currentFormHaber) < 0.01;

  const handleSaveTransaction = (e: FormEvent) => {
    e.preventDefault();
    
    const concept = formConcept.trim();
    if (!concept) {
      showToast('Por favor, ingresa el concepto de la operación.', 'error');
      return;
    }

    // Filter out rows that are entirely empty
    const filledLines = formLines.filter(line => 
      line.cuenta.trim() !== '' || line.debe !== '' || line.haber !== ''
    );

    if (filledLines.length < 2) {
      showToast('Ingresa al menos 2 líneas contables operables para guardar.', 'error');
      return;
    }

    // Validate account names and values
    let hasValidationError = false;
    const sanitizedLines: JournalLine[] = [];
    let sumDebe = 0;
    let sumHaber = 0;

    for (let i = 0; i < filledLines.length; i++) {
      const line = filledLines[i];
      const accountName = line.cuenta.trim();
      const dbVal = parseFloat(line.debe) || 0;
      const hbVal = parseFloat(line.haber) || 0;

      if (!accountName) {
        showToast(`Falta el nombre de la cuenta en la línea ${i + 1}.`, 'error');
        hasValidationError = true;
        break;
      }
      if (dbVal <= 0 && hbVal <= 0) {
        showToast(`La cuenta "${accountName}" debe tener un valor en Debe u Haber superior a cero.`, 'error');
        hasValidationError = true;
        break;
      }
      if (dbVal > 0 && hbVal > 0) {
        showToast(`La cuenta "${accountName}" no puede registrar montos en el Debe y el Haber al mismo tiempo.`, 'error');
        hasValidationError = true;
        break;
      }

      sanitizedLines.push({
        cuenta: accountName,
        debe: dbVal,
        haber: hbVal
      });
      sumDebe += dbVal;
      sumHaber += hbVal;
    }

    if (hasValidationError) return;

    // Check balance
    if (Math.abs(sumDebe - sumHaber) > 0.01) {
      showToast(`La partida no cuadra matemáticamente. Debe: ${formatCurrency(sumDebe)}, Haber: ${formatCurrency(sumHaber)}.`, 'error');
      return;
    }

    // Append auto-increments prefix
    const nextIdx = transactions.length + 1;
    const officialConcept = /^pda/i.test(concept) ? concept : `Pda ${nextIdx} - ${concept}`;

    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      concepto: officialConcept,
      fecha: new Date().toISOString().split('T')[0],
      lineas: sanitizedLines
    };

    const updated = [...transactions, newTx];
    saveTransactions(updated);

    // Reset Form
    setFormConcept('');
    setFormLines([
      { cuenta: '', debe: '', haber: '' },
      { cuenta: '', debe: '', haber: '' }
    ]);

    showToast('Partida registrada con éxito en el Libro Diario.');
  };

  // --- SHEET IMPORT HANDLING ---
  const handleImportExcel = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        if (!evt.target?.result) return;
        const data = new Uint8Array(evt.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to row arrays
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        const importedTxs: Transaction[] = [];
        let currentTx: Transaction | null = null;

        rows.forEach((row, rIdx) => {
          if (!row || row.length === 0) return;
          
          const colA = String(row[0] || "").trim();
          const colB = String(row[1] || "").trim();
          
          // Skip header row if it references sum calculations
          if (colA.toLowerCase().includes('suma') || colB.toLowerCase().includes('suma')) return;

          // Clean numbers
          const cleanNumber = (val: any): number => {
            if (val == null || val === '') return 0;
            if (typeof val === 'number') return val;
            const str = String(val).replace(/[^0-9\.\-]/g, '');
            return parseFloat(str) || 0;
          };

          const debeVal = cleanNumber(row[2]);
          const haberVal = cleanNumber(row[3]);

          // Identify start of a new Partida (Pda)
          if (/^(pda|partida)/i.test(colA) || /^(pda|partida)/i.test(colB)) {
            // Save state of previous transaction if completed
            if (currentTx && currentTx.lineas.length > 0) {
              importedTxs.push(currentTx);
            }
            currentTx = {
              id: `imported-${rIdx}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              concepto: colA || colB,
              fecha: new Date().toISOString().split('T')[0],
              lineas: []
            };
            return;
          }

          // If we have accounts and amounts, push to current transaction
          if (colB && (debeVal > 0 || haberVal > 0)) {
            if (!currentTx) {
              currentTx = {
                id: `imported-unnamed-${rIdx}`,
                concepto: 'Pda Importada ' + (importedTxs.length + 1),
                fecha: new Date().toISOString().split('T')[0],
                lineas: []
              };
            }
            currentTx.lineas.push({
              cuenta: colB,
              debe: debeVal,
              haber: haberVal
            });
          }
        });

        // Push last one
        if (currentTx && currentTx.lineas.length > 0) {
          importedTxs.push(currentTx);
        }

        if (importedTxs.length > 0) {
          // Confirm balance for imported entries
          let allBalanced = true;
          importedTxs.forEach((tx) => {
            const sumD = tx.lineas.reduce((sum, l) => sum + l.debe, 0);
            const sumH = tx.lineas.reduce((sum, l) => sum + l.haber, 0);
            if (Math.abs(sumD - sumH) > 0.05) allBalanced = false;
          });

          if (!allBalanced) {
            showToast('Aviso: Algunas partidas importadas están descuadradas pero se guardaron para corregir.', 'info');
          }

          saveTransactions(importedTxs);
          showToast(`¡Se importaron ${importedTxs.length} partidas de Excel con éxito!`);
        } else {
          showToast('No se encontró un formato de partidas compatible en la primera hoja de Excel.', 'error');
        }
      } catch (err) {
        showToast('Fallo crítico al leer archivo contable.', 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  // --- SHEET EXPORT HANDLING ---
  const handleExportExcel = () => {
    if (catalog.length === 0) {
      showToast('No existen datos procesados para exportar.', 'error');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      
      // sheet 1: BALANCE DE COMPROBACIÓN
      const balanceHeaders = [["SISTEMA CONTABLE PRO - REPORTE DE BALANCE DE COMPROBACIÓN"], [], ["No.", "Cuenta Contable", "Suma Debe", "Suma Haber", "Saldo Deudor", "Saldo Acreedor"]];
      const balanceData = catalog.map(c => [
        c.num,
        c.name,
        c.debe,
        c.haber,
        c.balanceType === 'Deudor' ? c.balance : 0,
        c.balanceType === 'Acreedor' ? c.balance : 0
      ]);

      // Add summary line
      balanceData.push([
        "",
        "SUMAS IGUALES",
        globalSums.debeSum,
        globalSums.haberSum,
        globalSums.deudorSum,
        globalSums.acreedorSum
      ]);

      const wsBalance = XLSX.utils.aoa_to_sheet([...balanceHeaders, ...balanceData]);
      XLSX.utils.book_append_sheet(wb, wsBalance, "Balance de Comprobación");

      // sheet 2: LIBRO DIARIO ARCHIVO
      const diarioHeaders = [["LIBRO DIARIO DE OPERACIONES"], [], ["Partida/Cuenta", "Descripción / Glosa", "Monto Debe (Q)", "Monto Haber (Q)"]];
      const diarioData: any[][] = [];

      transactions.forEach((tx) => {
        diarioData.push([tx.concepto, "", "", ""]);
        tx.lineas.forEach(l => {
          diarioData.push(["", l.cuenta, l.debe > 0 ? l.debe : "", l.haber > 0 ? l.haber : ""]);
        });
        const sumD = tx.lineas.reduce((sum, line) => sum + line.debe, 0);
        const sumH = tx.lineas.reduce((sum, line) => sum + line.haber, 0);
        diarioData.push(["", "Sumas Iguales", sumD, sumH]);
        diarioData.push(["", "", "", ""]); // Spacer
      });

      const wsDiario = XLSX.utils.aoa_to_sheet([...diarioHeaders, ...diarioData]);
      XLSX.utils.book_append_sheet(wb, wsDiario, "Libro Diario");

      // Save file
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Reporte_Contable_${dateStr}.xlsx`);
      showToast('Reporte financiero exportado con éxito a Excel.');
    } catch (e) {
      showToast('Error al fabricar el archivo de exportación.', 'error');
    }
  };

  // Global helper to format currency values cleanly
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ',
      minimumFractionDigits: 2,
    }).format(amount).replace('GTQ', 'Q ');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      
      {/* HEADER SECTION */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-md">
              <Calculator className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Sistema Contable Pro</h1>
              <p className="text-sm font-medium text-slate-500">Gestor Profesional de Partida Doble • Local Storage</p>
            </div>
          </div>
        </div>
        
        {/* Real-time Ledger Safety Status Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-xs ${
            isBalanced && transactions.length > 0
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : transactions.length === 0
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isBalanced && transactions.length > 0 ? 'bg-emerald-500 animate-pulse' : transactions.length === 0 ? 'bg-amber-500' : 'bg-rose-500'
            }`} />
            {isBalanced && transactions.length > 0 ? 'Sistema Cuadrado' : transactions.length === 0 ? 'Sin Registros' : 'Balance Descuadrado'}
          </div>

          <div className="bg-slate-200/60 text-slate-700 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-slate-300">
            Cuentas Activas: <b className="text-slate-900 font-mono text-sm ml-0.5">{catalog.length}</b>
          </div>
        </div>
      </header>

      {/* CORE TOOLBAR */}
      <nav className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between mb-8">
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          <button
            id="tab-diario-btn"
            onClick={() => setActiveTab('diario')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all ${
              activeTab === 'diario'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Libro Diario
          </button>
          
          <button
            id="tab-mayor-btn"
            onClick={() => setActiveTab('mayor')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all ${
              activeTab === 'mayor'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Libro Mayor
          </button>

          <button
            id="tab-balance-btn"
            onClick={() => setActiveTab('balance')}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all ${
              activeTab === 'balance'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Balance de Comprobación
          </button>
        </div>

        {/* DATA OPERATIONS CONTAINER */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
          
          {/* Load Sample Data Button if empty */}
          {transactions.length === 0 && (
            <button
              onClick={handleLoadDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-xl hover:bg-indigo-100 active:scale-98 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Cargar Muestra
            </button>
          )}

          {/* Import EXCEL block */}
          <div className="relative inline-block">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-xl active:scale-98 transition-all cursor-pointer"
              title="Importar archivo XLSX del Libro Diario"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Importar Excel
            </button>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleImportExcel} 
              accept=".xlsx,.xls" 
              className="hidden" 
            />
          </div>

          {/* Export Report to Sheet */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-550 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl active:scale-98 transition-all cursor-pointer bg-emerald-600"
            title="Exportar Libro de Diario y Balance a Libro de Excel"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar XLS
          </button>

          {/* GLOBAL WIPE / CLEAR DATABASE ACTION BUTTON (USER INTENT SUPPORT) */}
          <button
            onClick={() => setShowConfirmModal(true)}
            className="inline-flex items-center justify-center p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all text-xs font-semibold cursor-pointer"
            title="Borrar todos los datos de operaciones"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* TOAST SYSTEM WITH UNDO ACTION INTERFACE */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'error' 
                ? 'bg-rose-900 text-white border-rose-800' 
                : toast.type === 'info'
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <AlertTriangle className="w-4.5 h-4.5 text-rose-300 shrink-0" />
              ) : (
                <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            
            {/* ACTION UNDO CONTROL LINKED TO EXPLICIT USER TASK */}
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onTrigger();
                  setToast(null);
                }}
                className="ml-2 flex items-center gap-1 px-3 py-1 bg-white/15 hover:bg-white/25 active:bg-white/10 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* GLOBAL DELETE WIPE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 max-w-md w-full shadow-xl"
          >
            <div className="flex gap-3 mb-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full h-fit">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">¿Borrar todos los datos contables?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Esta acción eliminará todas las partidas almacenadas del Libro Diario, borrando las cuentas del Mayor y el Balance de Comprobación correlativo.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAllData}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                Confirmar Borrado
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* RENDER ACTIVE SCREEN */}
      <main className="min-h-[500px]">

        {/* TAB 1: LIBRO DIARIO COMPONENT */}
        {activeTab === 'diario' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT SIDE: JOURNAL OPERATIONS (PDA ENTRIES WITH DELETE SUPPORT) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-slate-600" />
                  Asientos del Libro Diario
                </h2>
                <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-md">
                  Correlativos: {transactions.length} Registros
                </span>
              </div>

              {transactions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center shadow-xs">
                  <div className="p-4 bg-slate-50 text-slate-400 rounded-full w-fit mx-auto mb-4">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Libro Diario Despejado</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
                    No se registran transacciones contables operativas por el momento. Puedes ingresar una partida manual en el panel de la derecha o restaurar los datos de muestra.
                  </p>
                  <button
                    onClick={handleLoadDefaults}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer transition-all active:scale-98"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Cargar Data Demostrativa
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((tx, txIdx) => {
                    const totalDebe = tx.lineas.reduce((acc, current) => acc + current.debe, 0);
                    const totalHaber = tx.lineas.reduce((acc, current) => acc + current.haber, 0);
                    const isTxBalanced = Math.abs(totalDebe - totalHaber) < 0.01;

                    return (
                      <motion.div 
                        key={tx.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                      >
                        {/* Partida Header containing INDIVIDUAL TRASH DELETE BUTTON */}
                        <div className="bg-slate-50/70 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between gap-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 inline-flex items-center gap-2">
                              {tx.concepto}
                            </span>
                            {tx.fecha && (
                              <span className="text-[10px] text-slate-500 font-mono mt-0.5">Fecha de Operación: {tx.fecha}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {!isTxBalanced && (
                              <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-150">
                                Descuadrada
                              </span>
                            )}
                            
                            {/* EXPLICIT WORKABLE DELETE BUTTON requested by the user */}
                            <button
                              id={`delete-btn-${tx.id}`}
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 rounded-lg shadow-sm transition-all cursor-pointer active:scale-90"
                              title="Eliminar partida permanentemente del diario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Transaction lines table */}
                        <div className="table-responsive">
                          <table className="w-full text-sm border-0">
                            <thead>
                              <tr className="bg-slate-50/30">
                                <th className="text-left py-2 px-5 text-slate-500 text-xs font-semibold capitalize border-b border-slate-100">Cuentas Ejecutadas</th>
                                <th className="text-right py-2 px-5 text-slate-500 text-xs font-semibold capitalize border-b border-slate-100 w-32">Debe</th>
                                <th className="text-right py-2 px-5 text-slate-500 text-xs font-semibold capitalize border-b border-slate-100 w-32">Haber</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tx.lineas.map((line, lIdx) => {
                                const isHaber = line.haber > 0;
                                return (
                                  <tr key={lIdx} className="hover:bg-slate-50/40 transition-colors border-b border-slate-100">
                                    <td className={`py-2 px-5 ${isHaber ? 'pl-10 text-slate-500' : 'font-medium text-slate-900'}`}>
                                      {line.cuenta}
                                    </td>
                                    <td className="text-right py-2 px-5 font-mono text-xs font-medium text-slate-900">
                                      {line.debe > 0 ? formatCurrency(line.debe) : '—'}
                                    </td>
                                    <td className="text-right py-2 px-5 font-mono text-xs font-medium text-slate-900">
                                      {line.haber > 0 ? formatCurrency(line.haber) : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                              
                              {/* Ledger verification totals footer */}
                              <tr className="bg-slate-50/20 font-semibold text-xs">
                                <td className="py-2.5 px-5 text-right text-slate-500 uppercase tracking-wider font-bold">Sumas Iguales</td>
                                <td className="text-right py-2.5 px-5 font-mono text-slate-900 border-t border-slate-200">
                                  {formatCurrency(totalDebe)}
                                </td>
                                <td className="text-right py-2.5 px-5 font-mono text-slate-900 border-t border-slate-200">
                                  {formatCurrency(totalHaber)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT SIDE: MANUAL REGISTRATION FORM (DYNAMIC ROW ADDITION & ROW DELETION) */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs sticky top-4">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                <Calculator className="w-5 h-5 text-slate-700" />
                <h2 className="text-base font-bold text-slate-900">Registrar Partida Manual</h2>
              </div>

              <form onSubmit={handleSaveTransaction} className="space-y-5">
                
                {/* Concept/Glosa Input */}
                <div>
                  <label htmlFor="form-concept" className="block text-xs font-bold text-slate-500 uppercase mb-2">
                    Concepto de Operación
                  </label>
                  <input
                    id="form-concept"
                    type="text"
                    required
                    value={formConcept}
                    onChange={(e) => setFormConcept(e.target.value)}
                    placeholder="Ej. Pago de Honorarios de Auditoría"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all placeholder:text-slate-400"
                    autoComplete="off"
                  />
                </div>

                {/* Account Rows List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase">
                      Cuentas y Valores
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">
                      Debe / Haber (Solo uno)
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {formLines.map((line, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          required
                          value={line.cuenta}
                          onChange={(e) => handleFormLineChange(idx, 'cuenta', e.target.value)}
                          placeholder={`Cuenta ${idx + 1}`}
                          className="flex-[2] min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-slate-900 transition-all"
                          autoComplete="off"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={line.debe}
                          onChange={(e) => handleFormLineChange(idx, 'debe', e.target.value)}
                          placeholder="Debe"
                          className="flex-1 min-w-0 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-right focus:outline-hidden focus:border-slate-900 transition-all"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={line.haber}
                          onChange={(e) => handleFormLineChange(idx, 'haber', e.target.value)}
                          placeholder="Haber"
                          className="flex-1 min-w-0 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-right focus:outline-hidden focus:border-slate-900 transition-all"
                        />
                        
                        {/* INDIVIDUAL ROW WIPE CONTROL - Allows deleting row from draft */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFormLine(idx)}
                          className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-50 cursor-pointer shrink-0 transition-colors"
                          title="Remover esta línea del formulario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Row Block */}
                  <button
                    type="button"
                    onClick={handleAddFormLine}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                  >
                    <Plus className="w-3 h-3" />
                    Anexar Cuenta
                  </button>
                </div>

                {/* Mathematical Live Balance Sheet Review */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500">Monto Debe compilado:</span>
                    <span className="font-mono text-slate-800">{formatCurrency(currentFormDebe)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-500">Monto Haber compilado:</span>
                    <span className="font-mono text-slate-800">{formatCurrency(currentFormHaber)}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-700 uppercase">Estado Cuadrante:</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                      isFormBalanced ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isFormBalanced ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                      {isFormBalanced ? 'Partida Cuadrada' : 'Aún Descuadrada'}
                    </span>
                  </div>
                </div>

                {/* Final Form Submission trigger */}
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 active:scale-99 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Guardar en Libro Diario
                </button>
              </form>
            </div>

          </div>
        )}

        {/* TAB 2: LIBRO MAYOR COMPONENT (T-ACCOUNTS) */}
        {activeTab === 'mayor' && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-slate-600" />
                  Libro Mayor (Cuentas T)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Asientos reorganizados agrupados de forma automática por cuenta mayor.</p>
              </div>
              <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200">
                Total Registros: {catalog.length} Cuentas T
              </span>
            </div>

            {catalog.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-16 text-center shadow-xs">
                <div className="p-4 bg-slate-50 text-slate-400 lg:p-5 rounded-full w-fit mx-auto mb-4">
                  <FolderOpen className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Libro Mayor Vacío</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Registra partidas cuadradamente dentro del Libro de Diario para generar los cargos y abonos automatizados de cada cuenta mayor.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catalog.map(c => {
                  return (
                    <motion.div 
                      key={c.num}
                      initial={{ scale: 0.98, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between"
                    >
                      {/* Account T Header */}
                      <header className="bg-slate-50 border-b border-slate-200 px-4 py-3 text-center">
                        <span className="text-xs text-slate-400 font-bold font-mono mr-1">{c.num}.</span>
                        <span className="text-sm font-bold text-slate-800">{c.name}</span>
                      </header>

                      {/* T Body dual splitting columns */}
                      <div className="grid grid-cols-2 text-xs border-b border-slate-100 min-h-[140px] divide-x divide-slate-150">
                        
                        {/* LEFT COLUMN: DEBE */}
                        <div className="p-3.5 space-y-1.5 flex flex-col justify-between">
                          <div>
                            <div className="text-center font-bold text-slate-500 text-[10px] tracking-wider uppercase pb-1.5 border-b border-slate-100 mb-2">Debe</div>
                            <div className="space-y-1">
                              {c.history.filter(h => h.debe > 0).map((h, i) => (
                                <div key={i} className="flex justify-between items-center text-[11px] text-slate-700">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-1 rounded">{h.pda}</span>
                                  <span className="font-mono">{formatCurrency(h.debe)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Left Totals summary */}
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-bold text-slate-500 text-[11px] mt-4">
                            <span>Suma Debe:</span>
                            <span className="font-mono text-slate-700">{formatCurrency(c.debe)}</span>
                          </div>
                        </div>

                        {/* RIGHT COLUMN: HABER */}
                        <div className="p-3.5 space-y-1.5 flex flex-col justify-between">
                          <div>
                            <div className="text-center font-bold text-slate-500 text-[10px] tracking-wider uppercase pb-1.5 border-b border-slate-100 mb-2">Haber</div>
                            <div className="space-y-1">
                              {c.history.filter(h => h.haber > 0).map((h, i) => (
                                <div key={i} className="flex justify-between items-center text-[11px] text-slate-700">
                                  <span className="font-mono">{formatCurrency(h.haber)}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-50 px-1 rounded">{h.pda}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Right Totals summary */}
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-bold text-slate-500 text-[11px] mt-4">
                            <span>Suma Haber:</span>
                            <span className="font-mono text-slate-700">{formatCurrency(c.haber)}</span>
                          </div>
                        </div>

                      </div>

                      {/* Account T Saldo Summary Block */}
                      <footer className="bg-slate-50/50 p-3.5 flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Saldo Final</span>
                        {c.balanceType === 'Nulo' ? (
                          <span className="text-xs font-semibold text-slate-500">Cuenta Liquidada</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                              c.balanceType === 'Deudor' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                            }`}>
                              {c.balanceType}
                            </span>
                            <span className="text-xs font-bold font-mono text-slate-950">
                              {formatCurrency(c.balance)}
                            </span>
                          </div>
                        )}
                      </footer>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BALANCE DE COMPROBACIÓN COMPONENT */}
        {activeTab === 'balance' && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-slate-600" />
                  Balance de Comprobación
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Informe unificado del estado de sumas y saldos para cierre contable de período.</p>
              </div>
              
              <div className={`px-4 py-2 rounded-xl text-xs font-bold border ${
                isBalanced && transactions.length > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {isBalanced && transactions.length > 0 ? "✓ SUMAS IGUALES CUADRADAS" : "⚠ FALLA DE CUADRE EN SALDOS"}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="table-responsive">
                <table className="w-full text-sm border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th rowSpan={2} className="py-4 px-5 text-slate-700 text-xs font-bold uppercase tracking-wide border-r border-slate-200 w-16 text-center">No.</th>
                      <th rowSpan={2} className="py-4 px-5 text-slate-700 text-xs font-bold uppercase tracking-wide border-r border-slate-200">Cuenta Mayor</th>
                      <th colSpan={2} className="py-2.5 px-5 text-slate-700 text-xs font-bold uppercase tracking-wide border-b border-slate-200 border-r border-slate-200 text-center bg-slate-100/50">Sumas Consolidadas</th>
                      <th colSpan={2} className="py-2.5 px-5 text-slate-700 text-xs font-bold uppercase tracking-wide border-b border-slate-200 text-center bg-emerald-50/35 text-emerald-950">Saldos de Período</th>
                    </tr>
                    <tr className="bg-slate-50/50 border-b border-slate-200">
                      <th className="py-2.5 px-5 text-slate-600 text-[11px] font-semibold tracking-wider text-right uppercase border-r border-slate-200 w-36">Debe</th>
                      <th className="py-2.5 px-5 text-slate-600 text-[11px] font-semibold tracking-wider text-right uppercase border-r border-slate-200 w-36">Haber</th>
                      <th className="py-2.5 px-5 text-emerald-800 text-[11px] font-semibold tracking-wider text-right uppercase border-r border-slate-200 bg-emerald-50/15 w-36">Deudor</th>
                      <th className="py-2.5 px-5 text-emerald-800 text-[11px] font-semibold tracking-wider text-right uppercase w-36 bg-emerald-50/15">Acreedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-16 text-slate-400">
                          <Coins className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                          <span className="text-sm font-semibold block text-slate-600">No se registran saldos</span>
                          <span className="text-xs text-slate-400 mt-1 block">Inserta movimientos en el Libro Diario para poblar los saldos finales.</span>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {catalog.map(c => {
                          const isDeudor = c.balanceType === 'Deudor';
                          const isAcreedor = c.balanceType === 'Acreedor';
                          return (
                            <tr key={c.num} className="hover:bg-slate-550/5 hover:bg-slate-50/40 border-b border-slate-150 transition-colors">
                              <td className="py-3 px-5 text-center font-mono text-slate-400 text-xs border-r border-slate-150">{c.num}</td>
                              <td className="py-3 px-5 font-semibold text-slate-900 border-r border-slate-150">{c.name}</td>
                              <td className="py-3 px-5 text-right font-mono text-slate-600 border-r border-slate-150">{formatCurrency(c.debe)}</td>
                              <td className="py-3 px-5 text-right font-mono text-slate-600 border-r border-slate-150">{formatCurrency(c.haber)}</td>
                              <td className="py-3 px-5 text-right font-mono text-emerald-800 border-r border-slate-150 bg-emerald-50/5">{isDeudor ? formatCurrency(c.balance) : '—'}</td>
                              <td className="py-3 px-5 text-right font-mono text-emerald-800 bg-emerald-50/5">{isAcreedor ? formatCurrency(c.balance) : '—'}</td>
                            </tr>
                          );
                        })}
                        
                        {/* Table Balance validation footer totals */}
                        <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-950">
                          <td colSpan={2} className="py-4 px-5 text-right uppercase tracking-wider font-extrabold border-r border-slate-800">SUMAS IGUALES</td>
                          <td className="py-4 px-5 text-right font-mono border-r border-slate-800 text-sm">{formatCurrency(globalSums.debeSum)}</td>
                          <td className="py-4 px-5 text-right font-mono border-r border-slate-800 text-sm">{formatCurrency(globalSums.haberSum)}</td>
                          <td className="py-4 px-5 text-right font-mono border-r border-slate-800 bg-emerald-950/70 text-emerald-300 text-sm">{formatCurrency(globalSums.deudorSum)}</td>
                          <td className="py-4 px-5 text-right font-mono bg-emerald-950/70 text-emerald-300 text-sm">{formatCurrency(globalSums.acreedorSum)}</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* General Ledger Assurance Certificate */}
            {catalog.length > 0 && isBalanced && (
              <div className="mt-6 bg-emerald-50 border border-emerald-150 rounded-xl p-4 flex gap-3 text-emerald-800 text-xs items-center">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold block">Verificación de Balance Ejecutado</span>
                  <span className="text-emerald-700">Se confirma la paridad numérica exacta entre las cargas y los abonos ({formatCurrency(globalSums.debeSum)}). El sistema se encuentra matemáticamente cuadrado.</span>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
      
      {/* Dynamic footer decoration */}
      <footer className="mt-16 pt-8 border-t border-slate-200 text-center text-xs text-slate-400 font-semibold uppercase tracking-widest pb-12">
        SISTEMA CONTABLE PRO • DISEÑO SUIZO DE ALTA PRECISIÓN CONTABLE
      </footer>

    </div>
  );
}
