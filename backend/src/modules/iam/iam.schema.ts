import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createCompanySchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(150),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const createBranchSchema = z.object({
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(150),
});
export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const createWarehouseSchema = z.object({
  branchId: z.string().uuid(),
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(150),
});
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;

export const createUserSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  fullName: z.string().min(2).max(150),
  roleIds: z.array(z.string().uuid()).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
