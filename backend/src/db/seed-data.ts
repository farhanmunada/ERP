export const PERMISSIONS = [
  { code: 'company:create', description: 'Membuat company baru' },
  { code: 'user:create', description: 'Membuat user' },
  { code: 'coa:create', description: 'Membuat akun COA' },
  { code: 'journal:create', description: 'Membuat jurnal' },
  { code: 'journal:reverse', description: 'Reversal jurnal' },
  { code: 'approval:rule:manage', description: 'Mengelola rule approval' },
  { code: 'approval:decide', description: 'Menyetujui/menolak approval' },
  { code: 'inventory:manage', description: 'Mengelola inventory' },
  { code: 'po:create', description: 'Membuat purchase order' },
  { code: 'po:approve', description: 'Menyetujui purchase order' },
  { code: 'so:create', description: 'Membuat sales order' },
  { code: 'so:approve', description: 'Menyetujui sales order' },
] as const;

// Standard retail COA. Debit-normal unless noted (LIABILITY/EQUITY/REVENUE are credit-normal).
export const DEFAULT_COA = [
  { code: '1100', name: 'Kas', type: 'ASSET' },
  { code: '1200', name: 'Piutang Usaha', type: 'ASSET' },
  { code: '1300', name: 'Persediaan Barang Dagang', type: 'ASSET' },
  { code: '2100', name: 'Utang Usaha', type: 'LIABILITY' },
  { code: '2110', name: 'PPN Keluaran', type: 'LIABILITY' },
  { code: '2120', name: 'PPN Masukan', type: 'ASSET' },
  { code: '3100', name: 'Modal Disetor', type: 'EQUITY' },
  { code: '4100', name: 'Penjualan', type: 'REVENUE' },
  { code: '5100', name: 'Harga Pokok Penjualan', type: 'EXPENSE' },
  { code: '5200', name: 'Beban Operasional', type: 'EXPENSE' },
] as const;

export const DEFAULT_COMPANY_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_BRANCH_ID = '00000000-0000-4000-8000-000000000002';
export const DEFAULT_WAREHOUSE_ID = '00000000-0000-4000-8000-000000000003';
export const SECOND_WAREHOUSE_ID = '00000000-0000-4000-8000-000000000004';
export const DEFAULT_ADMIN_EMAIL = 'admin@erp.local';
export const DEFAULT_ADMIN_PASSWORD = 'admin12345';

export const DEFAULT_BRANCH = { code: 'PST', name: 'Kantor Pusat' } as const;

export const DEFAULT_WAREHOUSES = [
  { id: DEFAULT_WAREHOUSE_ID, code: 'GD-UTAMA', name: 'Gudang Utama' },
  { id: SECOND_WAREHOUSE_ID, code: 'GD-CABANG', name: 'Gudang Cabang' },
] as const;

// Sample master items covering both costing methods and batch/serial tracking.
export const DEFAULT_ITEMS = [
  { code: 'ITM-001', name: 'Kopi Arabika 1kg', uom: 'KG', costingMethod: 'MOVING_AVERAGE', trackBatch: false, trackSerial: false, reorderPoint: '20' },
  { code: 'ITM-002', name: 'Gula Pasir 1kg', uom: 'KG', costingMethod: 'FIFO', trackBatch: false, trackSerial: false, reorderPoint: '15' },
  { code: 'ITM-003', name: 'Susu UHT 1L (Batch)', uom: 'PCS', costingMethod: 'MOVING_AVERAGE', trackBatch: true, trackSerial: false, reorderPoint: '10' },
  { code: 'ITM-004', name: 'Mesin Espresso Pro (Serial)', uom: 'UNIT', costingMethod: 'FIFO', trackBatch: false, trackSerial: true, reorderPoint: '1' },
] as const;
