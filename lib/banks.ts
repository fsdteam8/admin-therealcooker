import { api } from "@/lib/api";
import type { ApiResponse } from "@/lib/api";

export interface BankRecord { _id: string; name: string; logo: { url: string }; isActive: boolean; sortOrder: number }
export const getBanks = () => api.get<ApiResponse<BankRecord[]>>("/admin/banks").then(response => response.data.data);
export const createBank = (form: FormData) => api.post<ApiResponse<BankRecord>>("/admin/banks", form).then(response => response.data.data);
export const updateBank = (id: string, form: FormData) => api.patch<ApiResponse<BankRecord>>(`/admin/banks/${id}`, form).then(response => response.data.data);
