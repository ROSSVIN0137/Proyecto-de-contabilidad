import { useState, useEffect, useRef, FormEvent, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Trash2, 
  Plus, 
  Download, 
  Upload, 
  CheckCircle, 
  AlertTriangle,
  FolderOpen,
  PieChart,
  Calculator,
  ChevronRight,
  ShieldCheck,
  Undo2,
  Users,
  Menu,
  ChevronDown
} from 'lucide-react';
import { Transaction, JournalLine, AccountLedger, AppTab } from './types';

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<AppTab>('diario');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Toast notifications for feedback and Undo actions
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    action?: {
      label: string;
      onTrigger: () => void;
    };
  } | null>(null);

  // Form states for manual registration - starts empty & clean as requested
  const [formConcept, setFormConcept] = useState('');
  const [formLines, setFormLines] = useState<Array<{ cuenta: string; debe: string; haber: string }>>([
    { cuenta: '', debe: '', haber: '' },
    { cuenta: '', debe: '', haber: '' }
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from local storage - falls back to an empty list as requested ("aparezca sin ningun dato")
  useEffect(() => {
    try {
      const stored = localStorage.getItem('contabilidad_pro_data');
      if (stored) {
        setTransactions(JSON.parse(stored));
      } else {
        setTransactions([]);
        localStorage.setItem('contabilidad_pro_data', JSON.stringify([]));
      }
    } catch (e) {
      showToast('Error al cargar datos contables locales.', 'error');
    }
  }, []);

  const saveTransactions = (newTxs: Transaction[]) => {
    setTransactions(newTxs);
    localStorage.setItem('contabilidad_pro_data', JSON.stringify(newTxs));
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', action?: { label: string; onTrigger: () => void }) => {
    setToast({ message, type, action });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, toast.action ? 8000 : 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- LEDGER ALGORITHMS ---
  const calculateEngine = (): AccountLedger[] => {
    const dict: Record<string, { num: number; name: string; debe: number; haber: number; history: Array<{ pda: string; debe: number; haber: number }> }> = {};
    let accountCounter = 1;

    transactions.forEach((tx, idx) => {
      tx.lineas.forEach(line => {
        let cleanName = line.cuenta.trim();
        if (!cleanName) return;

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

  // Compute balance sums
  const globalSums = catalog.reduce((acc, current) => {
    acc.debeSum += current.debe;
    acc.haberSum += current.haber;
    if (current.balanceType === 'Deudor') acc.deudorSum += current.balance;
    if (current.balanceType === 'Acreedor') acc.acreedorSum += current.balance;
    return acc;
  }, { debeSum: 0, haberSum: 0, deudorSum: 0, acreedorSum: 0 });

  const isBalanced = Math.abs(globalSums.debeSum - globalSums.haberSum) < 0.01;

  // --- ACTIONS ---
  const handleDeleteTransaction = (id: string) => {
    const backupTxs = [...transactions];
    const filtered = transactions.filter(t => t.id !== id);
    saveTransactions(filtered);

    showToast(
      'Partida eliminada.',
      'success',
      {
        label: 'Deshacer',
        onTrigger: () => {
          saveTransactions(backupTxs);
          showToast('Registro restaurado.', 'success');
        }
      }
    );
  };

  const handleRemoveFormLine = (index: number) => {
    if (formLines.length <= 2) {
      showToast('Se requiere un mínimo de 2 líneas para el registro.', 'error');
      return;
    }
    const updated = formLines.filter((_, i) => i !== index);
    setFormLines(updated);
  };

  const handleClearAllData = () => {
    const backupTxs = [...transactions];
    saveTransactions([]);
    setShowConfirmModal(false);
    showToast('Datos limpiados.', 'info', {
      label: 'Deshacer',
      onTrigger: () => {
        saveTransactions(backupTxs);
        showToast('Datos restaurados.', 'success');
      }
    });
  };

  // --- MANUAL FORM REGISTRATION ---
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
      showToast('Ingresa el concepto de la operación.', 'error');
      return;
    }

    const filledLines = formLines.filter(line => 
      line.cuenta.trim() !== '' || line.debe !== '' || line.haber !== ''
    );

    if (filledLines.length < 2) {
      showToast('Ingresa al menos 2 líneas para la partida.', 'error');
      return;
    }

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
        showToast(`Falta cuenta en línea ${i + 1}.`, 'error');
        hasValidationError = true;
        break;
      }
      if (dbVal <= 0 && hbVal <= 0) {
        showToast(`Monto debe ser mayor a 0 en "${accountName}".`, 'error');
        hasValidationError = true;
        break;
      }
      if (dbVal > 0 && hbVal > 0) {
        showToast(`Registro doble error en "${accountName}".`, 'error');
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

    if (Math.abs(sumDebe - sumHaber) > 0.01) {
      showToast(`No cuadra. Debe: ${formatCurrency(sumDebe)}, Haber: ${formatCurrency(sumHaber)}.`, 'error');
      return;
    }

    const nextIdx = transactions.length + 1;
    const officialConcept = /^pda/i.test(concept) ? concept : `Pda ${nextIdx} - ${concept}`;

    const newTx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      concepto: officialConcept,
      fecha: new Date().toISOString().split('T')[0],
      lineas: sanitizedLines
    };

    saveTransactions([...transactions, newTx]);

    // Reset Form
    setFormConcept('');
    setFormLines([
      { cuenta: '', debe: '', haber: '' },
      { cuenta: '', debe: '', haber: '' }
    ]);

    showToast('Partida guardada.');
  };

  // --- SHEET EXPORT & IMPORT ---
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
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        const importedTxs: Transaction[] = [];
        let currentTx: Transaction | null = null;

        rows.forEach((row, rIdx) => {
          if (!row || row.length === 0) return;
          
          const colA = String(row[0] || "").trim();
          const colB = String(row[1] || "").trim();
          
          if (colA.toLowerCase().includes('suma') || colB.toLowerCase().includes('suma')) return;

          const cleanNumber = (val: any): number => {
            if (val == null || val === '') return 0;
            if (typeof val === 'number') return val;
            const str = String(val).replace(/[^0-9\.\-]/g, '');
            return parseFloat(str) || 0;
          };

          const debeVal = cleanNumber(row[2]);
          const haberVal = cleanNumber(row[3]);

          if (/^(pda|partida)/i.test(colA) || /^(pda|partida)/i.test(colB)) {
            if (currentTx && currentTx.lineas.length > 0) {
              importedTxs.push(currentTx);
            }
            currentTx = {
              id: `imported-${rIdx}-${Date.now()}`,
              concepto: colA || colB,
              fecha: new Date().toISOString().split('T')[0],
              lineas: []
            };
            return;
          }

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

        if (currentTx && currentTx.lineas.length > 0) {
          importedTxs.push(currentTx);
        }

        if (importedTxs.length > 0) {
          saveTransactions(importedTxs);
          showToast(`Se importaron ${importedTxs.length} partidas de Excel.`);
        } else {
          showToast('Formato de Excel no compatible.', 'error');
        }
      } catch (err) {
        showToast('Error de importación.', 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExportExcel = () => {
    if (catalog.length === 0) {
      showToast('No hay datos para exportar.', 'error');
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      
      // 1. GENERAR PESTAÑA: LIBRO DIARIO
      const diarioRows: any[][] = [
        ["SISTEMA CONTABLE"],
        ["LIBRO DIARIO DE OPERACIONES"],
        [],
        ["Cuentas / Detalle", "Debe (Q)", "Haber (Q)"]
      ];

      transactions.forEach((tx) => {
        // Título de la partida
        diarioRows.push([tx.concepto, "", ""]);
        
        let txSumDebe = 0;
        let txSumHaber = 0;

        tx.lineas.forEach(l => {
          const isHaber = l.haber > 0;
          // Aplicar sangría si es una cuenta del haber, exactamente como se ve en la página
          const cuentaConSangria = isHaber ? "    " + l.cuenta : l.cuenta;
          
          diarioRows.push([
            cuentaConSangria,
            l.debe > 0 ? formatCurrency(l.debe) : "",
            l.haber > 0 ? formatCurrency(l.haber) : ""
          ]);
          
          txSumDebe += l.debe;
          txSumHaber += l.haber;
        });

        // Totales de la partida
        diarioRows.push([
          "  Totales de la Partida",
          formatCurrency(txSumDebe),
          formatCurrency(txSumHaber)
        ]);
        
        // Fila vacía de separación
        diarioRows.push(["", "", ""]);
      });

      const wsDiario = XLSX.utils.aoa_to_sheet(diarioRows);
      wsDiario['!cols'] = [
        { wch: 45 }, // Cuentas / Detalle
        { wch: 20 }, // Monto Debe
        { wch: 20 }  // Monto Haber
      ];
      XLSX.utils.book_append_sheet(wb, wsDiario, "Libro Diario");


      // 2. GENERAR PESTAÑA: LIBRO MAYOR (CUENTAS T)
      const mayorRows: any[][] = [
        ["SISTEMA CONTABLE"],
        ["LIBRO MAYOR (CUENTAS T)"],
        [],
      ];

      catalog.forEach((c) => {
        // Encabezado de la cuenta
        mayorRows.push([`${c.num}. ${c.name.toUpperCase()}`, "", "", ""]);
        mayorRows.push(["DEBE (Cargos)", "", "HABER (Abonos)", ""]);
        mayorRows.push(["Referencia", "Monto (Q)", "Referencia", "Monto (Q)"]);

        const charges = c.history.filter(h => h.debe > 0);
        const payments = c.history.filter(h => h.haber > 0);
        const maxLen = Math.max(charges.length, payments.length);

        for (let i = 0; i < maxLen; i++) {
          const chg = charges[i];
          const pay = payments[i];
          mayorRows.push([
            chg ? chg.pda : "",
            chg ? formatCurrency(chg.debe) : "",
            pay ? pay.pda : "",
            pay ? formatCurrency(pay.haber) : ""
          ]);
        }

        // Sumas de las columnas
        mayorRows.push([
          "Suma Debe:",
          formatCurrency(c.debe),
          "Suma Haber:",
          formatCurrency(c.haber)
        ]);

        // Fila de saldo final
        const saldoStr = c.balanceType === 'Nulo' ? "Liquidada" : `${c.balanceType} (${formatCurrency(c.balance)})`;
        mayorRows.push([
          "Saldo Final (Saldo):",
          saldoStr,
          "",
          ""
        ]);

        // Separador para la siguiente cuenta T
        mayorRows.push(["", "", "", ""]);
        mayorRows.push(["", "", "", ""]);
      });

      const wsMayor = XLSX.utils.aoa_to_sheet(mayorRows);
      wsMayor['!cols'] = [
        { wch: 18 }, // Referencia Debe
        { wch: 20 }, // Valor Debe
        { wch: 18 }, // Referencia Haber
        { wch: 20 }  // Valor Haber
      ];
      XLSX.utils.book_append_sheet(wb, wsMayor, "Libro Mayor");


      // 3. GENERAR PESTAÑA: BALANCE DE COMPROBACIÓN
      const balanceRows: any[][] = [
        ["SISTEMA CONTABLE"],
        ["BALANCE DE COMPROBACIÓN"],
        [],
        ["No.", "Cuenta Mayor", "Suma Debe (Q)", "Suma Haber (Q)", "Saldo Deudor (Q)", "Saldo Acreedor (Q)"]
      ];

      catalog.forEach((c) => {
        balanceRows.push([
          c.num,
          c.name,
          formatCurrency(c.debe),
          formatCurrency(c.haber),
          c.balanceType === 'Deudor' ? formatCurrency(c.balance) : "",
          c.balanceType === 'Acreedor' ? formatCurrency(c.balance) : ""
        ]);
      });

      // Sumas iguales de comprobación
      balanceRows.push([
        "",
        "SUMAS IGUALES",
        formatCurrency(globalSums.debeSum),
        formatCurrency(globalSums.haberSum),
        formatCurrency(globalSums.deudorSum),
        formatCurrency(globalSums.acreedorSum)
      ]);

      const wsBalance = XLSX.utils.aoa_to_sheet(balanceRows);
      wsBalance['!cols'] = [
        { wch: 8 },  // No.
        { wch: 35 }, // Cuenta Mayor
        { wch: 20 }, // Suma Debe
        { wch: 20 }, // Suma Haber
        { wch: 20 }, // Saldo Deudor
        { wch: 20 }  // Saldo Acreedor
      ];
      XLSX.utils.book_append_sheet(wb, wsBalance, "Balance de Comprobación");


      // Guardar archivo Excel
      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Reporte_Contable_${dateStr}.xlsx`);
      showToast('Saldos exportados a Excel.');
    } catch (e) {
      showToast('Fallo al exportar.', 'error');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ',
      minimumFractionDigits: 2,
    }).format(amount).replace('GTQ', 'Q ');
  };

  return (
    <div className="min-h-screen bg-[#ECF0F1] text-[#2C3E50] font-sans antialiased selection:bg-[#34495E]/20">
      
      {/* 1. INITIAL LANDING/CREDITS WELCOME SCREEN */}
      <AnimatePresence mode="wait">
        {!isStarted ? (
          <motion.div 
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col justify-center items-center p-6 relative overflow-hidden"
          >
            {/* Minimalist Grid Layout Containing Credits Side-Boxes + Middle Start Card */}
            <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              
              {/* Left Column: Separated boxes displaying the names */}
              <div className="lg:col-span-3 space-y-4">
                <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-sm transition-all text-center">
                  <span className="text-[10px] font-bold text-[#34495E]/50 uppercase tracking-widest block mb-1">INTEGRANTE</span>
                  <p className="font-extrabold text-[#2C3E50] text-[13.5px] leading-snug">
                    Mardoqueo Alfredo González López
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-sm transition-all text-center">
                  <span className="text-[10px] font-bold text-[#34495E]/50 uppercase tracking-widest block mb-1">INTEGRANTE</span>
                  <p className="font-extrabold text-[#2C3E50] text-[13.5px] leading-snug">
                    Erik Diego Francisco Orozco Vásquez
                  </p>
                </div>
              </div>

              {/* Centered Area: Simplified start card with button in center, no secondary description text */}
              <div className="lg:col-span-6 bg-white rounded-2xl border-2 border-[#2C3E50] p-10 md:p-14 text-center shadow-md relative">
                <div className="mx-auto w-14 h-14 bg-[#ECF0F1] rounded-xl flex items-center justify-center mb-6 text-[#2C3E50] border border-slate-200">
                  <Calculator className="w-7 h-7" />
                </div>

                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#2C3E50] mb-8">
                  Sistema Contable
                </h1>

                {/* Single Centered Iniciar Button */}
                <button
                  id="iniciar-btn"
                  onClick={() => setIsStarted(true)}
                  className="inline-flex items-center justify-center gap-3 px-12 py-3.5 bg-[#2C3E50] hover:bg-[#34495E] text-white font-extrabold text-sm rounded-xl tracking-wider select-none active:scale-95 cursor-pointer transition-all w-full sm:w-auto"
                >
                  Iniciar
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Right Column: Separated boxes displaying the names */}
              <div className="lg:col-span-3 space-y-4">
                <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-sm transition-all text-center">
                  <span className="text-[10px] font-bold text-[#34495E]/50 uppercase tracking-widest block mb-1">INTEGRANTE</span>
                  <p className="font-extrabold text-[#2C3E50] text-[13.5px] leading-snug">
                    Jefferson Daniel Paredes Orozco
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-sm transition-all text-center">
                  <span className="text-[10px] font-bold text-[#34495E]/50 uppercase tracking-widest block mb-1">INTEGRANTE</span>
                  <p className="font-extrabold text-[#2C3E50] text-[13.5px] leading-snug">
                    Rossvin Omar Chúm Godínez
                  </p>
                </div>
              </div>

            </div>
          </motion.div>
        ) : (
          
          /* 2. MAIN ACTIVE SYSTEM WORKSPACE */
          <motion.div 
            key="workspace"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8"
          >
            {/* SIMPLE WORKSPACE HEADER */}
            <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6 relative">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#2C3E50] text-white rounded-xl shadow-md border border-[#34495E]/20">
                  <Calculator className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#2C3E50]">Sistema Contable</h1>
              </div>

              {/* Status information area */}
              <div className="flex flex-wrap items-center gap-3">
                
                {/* Cuadrado / No cuadrado status pill (No other complex text tags) */}
                <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border shadow-xs ${
                  isBalanced && transactions.length > 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-250'
                    : transactions.length === 0
                    ? 'bg-amber-50 text-amber-600 border-amber-200'
                    : 'bg-[#E74C3C]/5 text-[#E74C3C] border-[#E74C3C]/20'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isBalanced && transactions.length > 0 ? 'bg-emerald-500 animate-pulse' : transactions.length === 0 ? 'bg-amber-500' : 'bg-[#E74C3C]'
                  }`} />
                  {isBalanced && transactions.length > 0 ? 'Cuadrado' : transactions.length === 0 ? 'Sin Registros' : 'No cuadrado'}
                </div>

                {/* Only records counter - strictly no "correlativos" word as requested */}
                <div className="bg-white text-[#2C3E50] px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-300 shadow-xs">
                  Registros: <span className="font-mono text-sm font-extrabold">{transactions.length}</span>
                </div>

                {/* Back to land button */}
                <button
                  onClick={() => setIsStarted(false)}
                  className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-[#34495E] rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 border border-slate-300"
                >
                  <Users className="w-3.5 h-3.5" />
                  Créditos
                </button>
              </div>
            </header>

            {/* BAR UTILS CONTROLLERS */}
            <nav className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between mb-8">
              <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                <button
                  id="tab-diario-btn"
                  onClick={() => setActiveTab('diario')}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all ${
                    activeTab === 'diario'
                      ? 'bg-[#2C3E50] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-[#2C3E50]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Libro Diario
                </button>
                
                <button
                  id="tab-mayor-btn"
                  onClick={() => setActiveTab('mayor')}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all ${
                    activeTab === 'mayor'
                      ? 'bg-[#2C3E50] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-[#2C3E50]'
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  Libro Mayor
                </button>

                <button
                  id="tab-balance-btn"
                  onClick={() => setActiveTab('balance')}
                  className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all ${
                    activeTab === 'balance'
                      ? 'bg-[#2C3E50] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-[#2C3E50]'
                  }`}
                >
                  <PieChart className="w-4 h-4" />
                  Balance de Comprobación
                </button>
              </div>

              {/* DATA OPERATIONS ACTIONS */}
              <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                
                {/* Excel Import */}
                <div className="relative inline-block">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[#34495E] text-xs font-bold rounded-lg cursor-pointer transition-all animate-none"
                  >
                    <Upload className="w-3.5 h-3.5" />
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

                {/* Excel Export */}
                <button
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#2C3E50] hover:bg-[#34495E] text-white text-xs font-bold rounded-lg cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar XLS
                </button>

                {/* Delete Entire History with red/action indicators */}
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="inline-flex items-center justify-center p-2 rounded-lg bg-white border border-slate-300 text-[#C0392B] hover:bg-[#E74C3C]/5 hover:border-[#E74C3C]/30 cursor-pointer transition-all"
                  title="Borrar movimientos"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </nav>

            {/* TAB SCREENS RENDER BLOCK */}
            <main className="min-h-[480px]">

              {/* VIEW 1: LIBRO DIARIO */}
              {activeTab === 'diario' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* LEFT: DOUBLE ENTRY GENERAL PARTIDAS */}
                  <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-[#2C3E50] flex items-center gap-2">
                        <BookOpen className="w-4.5 h-4.5 text-[#34495E]" />
                        Asientos del Libro Diario
                      </h2>
                    </div>

                    {transactions.length === 0 ? (
                      <div className="bg-white rounded-xl border border-slate-300 border-dashed p-14 text-center">
                        <div className="p-3.5 bg-slate-50 text-slate-400 rounded-full w-fit mx-auto mb-3">
                          <BookOpen className="w-6.5 h-6.5" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700">Libro Diario Despejado</h3>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {transactions.map((tx) => {
                          const totalDebe = tx.lineas.reduce((acc, current) => acc + current.debe, 0);
                          const totalHaber = tx.lineas.reduce((acc, current) => acc + current.haber, 0);
                          const isTxBalanced = Math.abs(totalDebe - totalHaber) < 0.01;

                          return (
                            <motion.div 
                              key={tx.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs"
                            >
                              {/* Header & Working single delete action target */}
                              <div className="bg-slate-50 border-b border-slate-200 px-5 py-3.5 flex items-center justify-between gap-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-[#2C3E50]">
                                    {tx.concepto}
                                  </span>
                                  {tx.fecha && (
                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">Fecha: {tx.fecha}</span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {!isTxBalanced && (
                                    <span className="bg-[#E74C3C]/10 text-[#E74C3C] text-[10px] font-bold px-2 py-0.5 rounded border border-[#E74C3C]/20">
                                      No cuadrado
                                    </span>
                                  )}
                                  
                                  {/* DELETE SINGLE RE-CONFIRMED ACTION BUTTON */}
                                  <button
                                    id={`delete-btn-${tx.id}`}
                                    onClick={() => handleDeleteTransaction(tx.id)}
                                    className="p-1.5 bg-white border border-slate-255 text-slate-400 hover:text-[#C0392B] hover:border-[#E74C3C]/30 rounded-lg shadow-xs transition-colors cursor-pointer"
                                    title="Eliminar partida permanentemente del diario"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Rows Table */}
                              <div className="overflow-x-auto w-full">
                                <table className="w-full text-sm border-none">
                                  <thead>
                                    <tr className="bg-slate-50/50">
                                      <th className="text-left py-2 px-5 text-slate-500 text-xs font-bold border-b border-slate-100">Cuentas</th>
                                      <th className="text-right py-2 px-5 text-slate-500 text-xs font-bold border-b border-slate-100 w-28">Debe</th>
                                      <th className="text-right py-2 px-5 text-slate-500 text-xs font-bold border-b border-slate-100 w-28">Haber</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tx.lineas.map((line, lIdx) => {
                                      const isHaber = line.haber > 0;
                                      return (
                                        <tr key={lIdx} className="border-b border-slate-100 hover:bg-slate-55/35">
                                          <td className={`py-2 px-5 ${isHaber ? 'pl-9 text-slate-505' : 'font-semibold text-[#2C3E50]'}`}>
                                            {line.cuenta}
                                          </td>
                                          <td className="text-right py-2 px-5 font-mono text-xs font-bold text-slate-600">
                                            {line.debe > 0 ? formatCurrency(line.debe) : '—'}
                                          </td>
                                          <td className="text-right py-2 px-5 font-mono text-xs font-bold text-slate-600">
                                            {line.haber > 0 ? formatCurrency(line.haber) : '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    
                                    <tr className="bg-slate-50/20 font-bold text-xs">
                                      <td className="py-2.5 px-5 text-right text-slate-500 uppercase font-extrabold">Totales</td>
                                      <td className="text-right py-2.5 px-5 font-mono text-[#2C3E50] border-t border-slate-200">
                                        {formatCurrency(totalDebe)}
                                      </td>
                                      <td className="text-right py-2.5 px-5 font-mono text-[#2C3E50] border-t border-slate-200">
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

                  {/* RIGHT: COMPILATION & REGISTRATION FORM */}
                  <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-xs lg:sticky lg:top-4">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-150">
                      <Calculator className="w-5 h-5 text-[#34495E]" />
                      <h2 className="text-base font-bold text-[#2C3E50]">Registrar Partida Manual</h2>
                    </div>

                    <form onSubmit={handleSaveTransaction} className="space-y-5">
                      
                      {/* Concept - NO PLACEHOLDER AS REQUESTED ("no pongas nada") */}
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
                          placeholder=""
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-sm focus:outline-hidden focus:border-[#2C3E50] transition-colors"
                          autoComplete="off"
                        />
                      </div>

                      {/* Account entries */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase">
                            Cuentas y Valores
                          </label>
                        </div>

                        <div className="space-y-2.5 max-h-[290px] overflow-y-auto">
                          {formLines.map((line, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                required
                                value={line.cuenta}
                                onChange={(e) => handleFormLineChange(idx, 'cuenta', e.target.value)}
                                placeholder="Nombre de cuenta"
                                className="flex-[2] min-w-0 px-3 py-2 bg-slate-50 border border-slate-250 rounded-lg text-xs focus:outline-hidden"
                                autoComplete="off"
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={line.debe}
                                onChange={(e) => handleFormLineChange(idx, 'debe', e.target.value)}
                                placeholder="Debe"
                                className="flex-1 min-w-0 px-2.5 py-2 bg-slate-50 border border-slate-250 rounded-lg text-xs font-mono text-right focus:outline-hidden"
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={line.haber}
                                onChange={(e) => handleFormLineChange(idx, 'haber', e.target.value)}
                                placeholder="Haber"
                                className="flex-1 min-w-0 px-2.5 py-2 bg-slate-50 border border-slate-250 rounded-lg text-xs font-mono text-right focus:outline-hidden"
                              />
                              
                              {/* DELETE ROW FROM CURRENT DRAFTS */}
                              <button
                                type="button"
                                onClick={() => handleRemoveFormLine(idx)}
                                className="p-2 text-slate-405 hover:text-[#C0392B] rounded-lg transition-colors cursor-pointer"
                                title="Eliminar línea"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* button labels changed strictly to "Agregar Cuenta" as requested */}
                        <button
                          type="button"
                          onClick={handleAddFormLine}
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#2C3E50] hover:text-[#34495E] bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl cursor-pointer transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          Agregar Cuenta
                        </button>
                      </div>

                      {/* Math Summary of Active Inputs */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                          <span>Total Debe:</span>
                          <span className="font-mono text-slate-800">{formatCurrency(currentFormDebe)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-slate-500">
                          <span>Total Haber:</span>
                          <span className="font-mono text-slate-800">{formatCurrency(currentFormHaber)}</span>
                        </div>
                        
                        {/* Status label: strictly only outputs "Cuadrado" or "No cuadrado" as requested */}
                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-extrabold">
                          <span className="text-[#2C3E50] uppercase tracking-wide">Estado:</span>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg font-bold ${
                            isFormBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-[#E74C3C]/5 text-[#E74C3C]'
                          }`}>
                            {isFormBalanced ? 'Cuadrado' : 'No cuadrado'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#2C3E50] text-white rounded-xl text-sm font-bold shadow-xs hover:bg-[#34495E] active:scale-99 transition-all cursor-pointer"
                      >
                        Guardar en Libro Diario
                      </button>
                    </form>
                  </div>

                </div>
              )}

              {/* VIEW 2: LIBRO MAYOR (CUNTAS T) */}
              {activeTab === 'mayor' && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-lg font-bold text-[#2C3E50] flex items-center gap-2">
                      <FolderOpen className="w-4.5 h-4.5 text-[#34495E]" />
                      Libro Mayor (Cuentas T)
                    </h2>
                  </div>

                  {catalog.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-300 border-dashed p-16 text-center">
                      <div className="p-4 bg-slate-50 text-slate-400 rounded-full w-fit mx-auto mb-3">
                        <FolderOpen className="w-7 h-7" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-700">Libro Mayor Vacío</h3>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {catalog.map(c => {
                        return (
                          <motion.div 
                            key={c.num}
                            initial={{ scale: 0.98, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex flex-col justify-between"
                          >
                            <header className="bg-slate-50 border-b border-slate-200 px-4 py-3 text-center">
                              <span className="text-xs text-slate-400 font-bold font-mono mr-1">{c.num}.</span>
                              <span className="text-sm font-extrabold text-[#2C3E50]">{c.name}</span>
                            </header>

                            <div className="grid grid-cols-2 text-xs border-b border-slate-100 min-h-[140px] divide-x divide-slate-150">
                              
                              {/* DEBE */}
                              <div className="p-3.5 space-y-1.5 flex flex-col justify-between">
                                <div>
                                  <div className="text-center font-bold text-slate-400 text-[10px] tracking-wider uppercase pb-1.5 border-b border-slate-100 mb-2">Debe</div>
                                  <div className="space-y-1">
                                    {c.history.filter(h => h.debe > 0).map((h, i) => (
                                      <div key={i} className="flex justify-between items-center text-[10px] text-slate-600">
                                        <span className="font-bold text-slate-400 bg-slate-100 px-1 rounded">{h.pda}</span>
                                        <span className="font-mono">{formatCurrency(h.debe)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-bold text-slate-500 text-[10px] mt-4">
                                  <span>Suma:</span>
                                  <span className="font-mono text-[#2C3E50]">{formatCurrency(c.debe)}</span>
                                </div>
                              </div>

                              {/* HABER */}
                              <div className="p-3.5 space-y-1.5 flex flex-col justify-between">
                                <div>
                                  <div className="text-center font-bold text-slate-400 text-[10px] tracking-wider uppercase pb-1.5 border-b border-slate-100 mb-2">Haber</div>
                                  <div className="space-y-1">
                                    {c.history.filter(h => h.haber > 0).map((h, i) => (
                                      <div key={i} className="flex justify-between items-center text-[10px] text-slate-600">
                                        <span className="font-mono">{formatCurrency(h.haber)}</span>
                                        <span className="font-bold text-slate-400 bg-slate-100 px-1 rounded">{h.pda}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-bold text-slate-500 text-[10px] mt-4">
                                  <span>Suma:</span>
                                  <span className="font-mono text-[#2C3E50]">{formatCurrency(c.haber)}</span>
                                </div>
                              </div>

                            </div>

                            <footer className="bg-slate-50 p-3 flex justify-between items-center text-[11px]">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo Final</span>
                              {c.balanceType === 'Nulo' ? (
                                <span className="font-bold text-slate-400 uppercase text-[10px]">Liquidada</span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                    c.balanceType === 'Deudor' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-150 text-[#34495E]'
                                  }`}>
                                    {c.balanceType}
                                  </span>
                                  <span className="font-bold font-mono text-[#2C3E50]">
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

              {/* VIEW 3: BALANCE DE COMPROBACIÓN */}
              {activeTab === 'balance' && (
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-lg font-bold text-[#2C3E50] flex items-center gap-2">
                      <PieChart className="w-4.5 h-4.5 text-[#34495E]" />
                      Balance de Comprobación
                    </h2>
                    
                    {/* Live balance indicator: strictly displays ONLY "Cuadrado" or "No cuadrado" format */}
                    <div className={`px-4 py-1.5 rounded-xl text-xs font-bold border ${
                      isBalanced && transactions.length > 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-[#E74C3C]/5 border-[#E74C3C]/20 text-[#E74C3C]'
                    }`}>
                      {isBalanced && transactions.length > 0 ? "Cuadrado" : "No cuadrado"}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-sm border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th rowSpan={2} className="py-4 px-5 text-slate-700 text-xs font-bold uppercase border-r border-slate-150 w-16 text-center">No.</th>
                            <th rowSpan={2} className="py-4 px-5 text-slate-700 text-xs font-bold uppercase border-r border-slate-150">Cuenta Mayor</th>
                            <th colSpan={2} className="py-2 px-5 text-slate-700 text-xs font-bold uppercase border-b border-slate-200 border-r border-slate-150 text-center bg-slate-100/40">Sumas</th>
                            <th colSpan={2} className="py-2 px-5 text-slate-700 text-xs font-bold uppercase border-b border-slate-200 text-center bg-emerald-50/10">Saldos</th>
                          </tr>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                            <th className="py-2 px-4 text-right border-r border-slate-100 w-28 bg-slate-100/10">Debe</th>
                            <th className="py-2 px-4 text-right border-r border-slate-150 w-28 bg-slate-100/10">Haber</th>
                            <th className="py-2 px-4 text-right border-r border-slate-100 w-28 bg-emerald-50/20 text-emerald-800">Deudor</th>
                            <th className="py-2 px-4 text-right w-28 bg-emerald-50/20 text-emerald-800">Acreedor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catalog.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-12 text-slate-450 font-bold">
                                Sin saldos que reportar. Registra partidas primero.
                              </td>
                            </tr>
                          ) : (
                            catalog.map((c, index) => {
                              return (
                                <tr key={c.num} className="border-b border-slate-150 hover:bg-slate-50/40 font-medium select-all">
                                  <td className="py-2 px-5 text-center font-mono text-xs text-slate-400 border-r border-slate-150">{index + 1}</td>
                                  <td className="py-2 px-5 text-[#2C3E50] font-bold border-r border-slate-150">{c.name}</td>
                                  <td className="py-2 px-4 text-right font-mono text-xs border-r border-slate-100">{formatCurrency(c.debe)}</td>
                                  <td className="py-2 px-4 text-right font-mono text-xs border-r border-slate-150">{formatCurrency(c.haber)}</td>
                                  <td className="py-2 px-4 text-right font-mono text-xs border-r border-slate-100 text-emerald-700 bg-emerald-50/5 font-semibold">
                                    {c.balanceType === 'Deudor' ? formatCurrency(c.balance) : '—'}
                                  </td>
                                  <td className="py-2 px-4 text-right font-mono text-xs text-emerald-700 bg-emerald-50/5 font-semibold">
                                    {c.balanceType === 'Acreedor' ? formatCurrency(c.balance) : '—'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                          
                          {/* Totals compiling Row */}
                          {catalog.length > 0 && (
                            <tr className="bg-[#2C3E50] text-white font-extrabold text-xs">
                              <td colSpan={2} className="py-3 px-5 text-right uppercase tracking-wider border-r border-white/10 font-black">Sumas Iguales</td>
                              <td className="py-3 px-4 text-right font-mono border-r border-white/10">{formatCurrency(globalSums.debeSum)}</td>
                              <td className="py-3 px-4 text-right font-mono border-r border-white/10">{formatCurrency(globalSums.haberSum)}</td>
                              <td className="py-3 px-4 text-right font-mono border-r border-white/10 bg-slate-800/20">{formatCurrency(globalSums.deudorSum)}</td>
                              <td className="py-3 px-4 text-right font-mono bg-slate-800/20">{formatCurrency(globalSums.acreedorSum)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION CLEAR SYSTEM DRAFTS DIALOG */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl border border-slate-200 p-6 max-w-sm w-full shadow-lg"
          >
            <h3 className="text-base font-extrabold text-[#2C3E50] mb-2">¿Borrar todos los movimientos?</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Esta acción limpiará permanentemente todas las partidas contables cargadas en el sistema.
            </p>
            <div className="flex justify-end gap-2 text-xs font-bold">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 hover:bg-slate-100 text-slate-500 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAllData}
                className="px-4 py-2 bg-[#C0392B] hover:bg-rose-700 text-white rounded-lg cursor-pointer"
              >
                Limpiar todo
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* TOAST SYSTEM POPUP */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center justify-between gap-4 px-4 py-3 rounded-xl shadow-md border text-xs font-bold ${
              toast.type === 'error' 
                ? 'bg-rose-900 border-rose-800 text-white' 
                : 'bg-[#2C3E50] border-[#34495E] text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onTrigger();
                  setToast(null);
                }}
                className="ml-2 flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
