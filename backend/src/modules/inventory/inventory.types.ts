export const COSTING_METHODS = ['MOVING_AVERAGE', 'FIFO'] as const;
export type CostingMethod = (typeof COSTING_METHODS)[number];

export const MOVEMENT_TYPES = {
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  TRANSFER_OUT: 'TRANSFER_OUT',
  TRANSFER_IN: 'TRANSFER_IN',
  OPNAME_ADJUSTMENT: 'OPNAME_ADJUSTMENT',
} as const;
export type MovementType = (typeof MOVEMENT_TYPES)[keyof typeof MOVEMENT_TYPES];

export const TRANSFER_STATUS = {
  IN_TRANSIT: 'IN_TRANSIT',
  COMPLETED: 'COMPLETED',
} as const;
export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];

export const OPNAME_STATUS = { POSTED: 'POSTED' } as const;
export type OpnameStatus = (typeof OPNAME_STATUS)[keyof typeof OPNAME_STATUS];

export const SERIAL_STATUS = { IN_STOCK: 'IN_STOCK', ISSUED: 'ISSUED' } as const;
export type SerialStatus = (typeof SERIAL_STATUS)[keyof typeof SERIAL_STATUS];

// Standard COA codes used to auto-post opname adjustment journals (see seed-data DEFAULT_COA).
export const INVENTORY_ACCOUNT_CODE = '1300';
export const ADJUSTMENT_ACCOUNT_CODE = '5200';

export const OUTBOX_EVENT_TYPES = {
  STOCK_IN: 'inventory.stock_in',
  STOCK_OUT: 'inventory.stock_out',
  TRANSFER_COMPLETED: 'inventory.transfer_completed',
  OPNAME_POSTED: 'inventory.opname_posted',
} as const;
