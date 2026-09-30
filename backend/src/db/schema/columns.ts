import { char, decimal, timestamp, varchar } from 'drizzle-orm/mysql-core';

// Money precision (DECIMAL(18,2)); qty precision (DECIMAL(18,4)). Returned as string by driver.
export const MONEY_PRECISION = { precision: 18, scale: 2 } as const;
export const QTY_PRECISION = { precision: 18, scale: 4 } as const;

export const money = (name: string) => decimal(name, MONEY_PRECISION);
export const qty = (name: string) => decimal(name, QTY_PRECISION);
export const uuid = (name: string) => char(name, { length: 36 });
export const docNumber = (name: string) => varchar(name, { length: 50 });

export const createdAt = () => timestamp('created_at', { mode: 'string' }).notNull().defaultNow();
export const updatedAt = () => timestamp('updated_at', { mode: 'string' }).notNull().defaultNow().onUpdateNow();
