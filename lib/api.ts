import axios from "axios";
export interface ApiResponse<T> { success: boolean; message: string; data: T; }
export interface UserRecord { _id: string; name?: string; email?: string; userId?: string; phone?: string; role?: string; avatar?: { url?: string }; createdAt?: string; isBlocked?: boolean; }
export interface GuardianRecord { _id: string; name: string; email: string; phone: string; relationship: string; isPrimary: boolean; status: string; createdAt?: string; user?: { _id: string; name?: string; email?: string; userId?: string }; }
export interface Pagination { page: number; limit: number; total: number; totalPages: number; }
export interface NewsItem { _id: string; title: string; category: string; description: string; coverImage?: { url?: string }; readTime?: string; createdAt?: string; isPublished?: boolean; }
export interface SubscriptionPlan { _id: string; name: string; benefits: string[]; priceMonthly: number; priceYearly: number; isActive: boolean; }
export interface TermsRecord { _id: string; content: string; version: string; isActive: boolean; updatedAt?: string; }
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTPUBLICBASEURL || "http://localhost:5011/api/v1";
export const api = axios.create({ baseURL: BASE_URL, timeout: 20000 });
api.interceptors.request.use(async (config) => { if (typeof window !== "undefined") { const { getSession } = await import("next-auth/react"); const session = await getSession(); if (session?.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`; } return config; });
api.interceptors.response.use((response) => response, (error) => Promise.reject(error));
export async function loginApi(credentials: { email: string; password: string }) { const { data } = await api.post<ApiResponse<UserRecord & { accessToken: string }>>("/auth/login", credentials); return data.data; }
export const forgotPassword = (email: string) => api.post<ApiResponse<null>>("/auth/forgot-password", { email }).then(r => r.data);
export const verifyOtp = (email: string, otp: string) => api.post<ApiResponse<{ verified: boolean }>>("/auth/verify-otp", { email, otp }).then(r => r.data);
export const resetPassword = (payload: { email: string; otp: string; newPassword: string; confirmPassword: string }) => api.post<ApiResponse<null>>("/auth/reset-password", payload).then(r => r.data);
export const getDashboardStats = () => api.get<ApiResponse<{ totalUsers: number; totalGuardians: number; totalNews: number; chartData: { labels: string[]; totalUsers: number[]; totalGuardian: number[]; newJoined: number[] } }>>("/admin/dashboard/stats").then(r => r.data.data);
export const getRecentUsers = () => api.get<ApiResponse<UserRecord[]>>("/admin/dashboard/recent-users").then(r => r.data.data);
export const getUsers = (page = 1, limit = 10, search = "") => api.get<ApiResponse<{ users: UserRecord[]; pagination: Pagination }>>("/users/admin/list", { params: { page, limit, search } }).then(r => r.data.data);
export const updateUser = (id: string, payload: FormData) => api.patch<ApiResponse<UserRecord>>(`/users/admin/list/${id}`, payload).then(r => r.data);
export const deleteUser = (id: string) => api.delete<ApiResponse<null>>(`/users/admin/list/${id}`).then(r => r.data);
export const setUserBlocked = (id: string, isBlocked: boolean) => api.patch<ApiResponse<{ _id: string; isBlocked: boolean }>>(`/admin/users/${id}/block`, { isBlocked }).then(r => r.data);
export const getGuardians = (page = 1, limit = 10, search = "") => api.get<ApiResponse<{ guardians: GuardianRecord[]; pagination: Pagination }>>("/admin/guardians", { params: { page, limit, search } }).then(r => r.data.data);
export const getProfile = () => api.get<ApiResponse<UserRecord>>("/users/profile").then(r => r.data.data);
export const updateProfile = (payload: FormData) => api.patch<ApiResponse<UserRecord>>("/users/update-profile", payload).then(r => r.data);
export const changePassword = (payload: { currentPassword: string; newPassword: string; confirmPassword: string }) => api.post<ApiResponse<UserRecord>>("/users/change-password", payload).then(r => r.data);
export const getNews = (category?: string) => api.get<ApiResponse<NewsItem[]>>("/news", { params: category ? { category } : {} }).then(r => r.data.data);
export const createNews = (payload: FormData) => api.post<ApiResponse<NewsItem>>("/news", payload).then(r => r.data);
export const updateNews = (id: string, payload: FormData) => api.put<ApiResponse<NewsItem>>(`/news/${id}`, payload).then(r => r.data);
export const deleteNews = (id: string) => api.delete<ApiResponse<null>>(`/news/${id}`).then(r => r.data);
export const getTerms = () => api.get<ApiResponse<TermsRecord>>("/terms").then(r => r.data.data);
export const saveTerms = (content: string, version: string) => api.put<ApiResponse<TermsRecord>>("/terms", { content, version }).then(r => r.data);
export const getSubscriptions = () => api.get<ApiResponse<SubscriptionPlan[]>>("/subscriptions").then(r => r.data.data);
export const createSubscription = (payload: Omit<SubscriptionPlan, "_id">) => api.post<ApiResponse<SubscriptionPlan>>("/subscriptions", payload).then(r => r.data);
export const updateSubscription = (id: string, payload: Partial<SubscriptionPlan>) => api.patch<ApiResponse<SubscriptionPlan>>(`/subscriptions/${id}`, payload).then(r => r.data);
export const deleteSubscription = (id: string) => api.delete<ApiResponse<SubscriptionPlan>>(`/subscriptions/${id}`).then(r => r.data);
export interface LearningItem { _id: string; title: string; description: string; image?: { url?: string; public_id?: string }; author?: { _id: string; name?: string; email?: string }; isPublished?: boolean; createdAt?: string; updatedAt?: string; }
export const getLearnings = (page = 1, limit = 10, search = "") => api.get<ApiResponse<{ learnings: LearningItem[]; pagination: Pagination }>>("/learnings", { params: { page, limit, search } }).then(r => r.data.data);
export const getLearningById = (id: string) => api.get<ApiResponse<LearningItem>>(`/learnings/${id}`).then(r => r.data.data);
export const createLearning = (payload: FormData) => api.post<ApiResponse<LearningItem>>("/learnings", payload).then(r => r.data);
export const updateLearning = (id: string, payload: FormData) => api.put<ApiResponse<LearningItem>>(`/learnings/${id}`, payload).then(r => r.data);
export const deleteLearning = (id: string) => api.delete<ApiResponse<null>>(`/learnings/${id}`).then(r => r.data);
export type VerificationStatus = "verified" | "fraudulent";
export interface VerificationRecord { _id: string; email: string; phone: string; account: string; website: string; status?: VerificationStatus | "fraud"; source?: string; createdAt?: string; updatedAt?: string; }
export interface VerificationList { verifications: VerificationRecord[]; pagination: Pagination; }
export const getVerifications = (page = 1, limit = 10, search = "") => api.get<ApiResponse<VerificationList>>("/verifications", { params: { page, limit, search } }).then(r => r.data.data);
export const createVerification = (payload: Partial<VerificationRecord>) => api.post<ApiResponse<VerificationRecord>>("/verifications", payload).then(r => r.data);
export const updateVerification = (id: string, payload: Partial<VerificationRecord>) => api.put<ApiResponse<VerificationRecord>>(`/verifications/${id}`, payload).then(r => r.data);
export const deleteVerification = (id: string) => api.delete<ApiResponse<null>>(`/verifications/${id}`).then(r => r.data);
export const uploadVerificationCSV = (file: File) => { const formData = new FormData(); formData.append("file", file); return api.post<ApiResponse<{ count: number }>>("/verifications/upload-csv", formData).then(r => r.data); };
