export interface JournalLine {
  cuenta: string;
  debe: number;
  haber: number;
}

export interface Transaction {
  id: string; // Add a unique ID so we can edit/delete individual transactions reliably!
  concepto: string;
  fecha?: string;
  lineas: JournalLine[];
}

export interface LedgerHistoryItem {
  pda: string;
  debe: number;
  haber: number;
}

export interface AccountLedger {
  num: number;
  name: string;
  debe: number;
  haber: number;
  history: LedgerHistoryItem[];
  balance: number;
  balanceType: 'Deudor' | 'Acreedor' | 'Nulo';
}

export type AppTab = 'diario' | 'mayor' | 'balance';
