/**
 * Users Management Tab
 * View, create, edit, and manage users
 */

import React, { useEffect, useState } from "react";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Users,
  Shield,
  Truck,
  RefreshCw,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { usersApi } from "@/lib/api";
import type { User as UserType, UserRole } from "@shared/api";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

interface AdminTabProps {
  onNavigate?: (tab: string, id?: string) => void;
}

// Staff roles only - customers are managed in CustomersTab
type StaffRole = Exclude<UserRole, 'customer'>;

const getStaffRoleConfig = (isRTL: boolean): Record<StaffRole, { label: string; icon: React.ElementType; color: string }> => ({
  admin: { label: isRTL ? "مدير" : "Admin", icon: Shield, color: "bg-purple-100 text-purple-700" },
  staff: { label: isRTL ? "موظف" : "Staff", icon: Users, color: "bg-green-100 text-green-700" },
  delivery: { label: isRTL ? "سائق" : "Driver", icon: Truck, color: "bg-orange-100 text-orange-700" },
});

const translations = {
  en: {
    usersManagement: "Staff Management",
    totalUsers: "total staff",
    active: "active",
    refresh: "Refresh",
    addUser: "Add Staff",
    searchPlaceholder: "Search by name, email, or phone...",
    all: "All Staff",
    admins: "Admins",
    staffMembers: "Staff",
    drivers: "Drivers",
    user: "Staff Member",
    contact: "Contact",
    role: "Role",
    emirate: "Emirate",
    status: "Status",
    joined: "Joined",
    actions: "Actions",
    noUsersFound: "No staff members found",
    activeStatus: "Active",
    inactiveStatus: "Inactive",
    verified: "Verified",
    edit: "Edit",
    activate: "Activate",
    deactivate: "Deactivate",
    delete: "Delete",
    confirmDelete: "Are you sure you want to delete this staff member?",
    editUser: "Edit Staff Member",
    createUser: "Create Staff Member",
    username: "Username",
    firstName: "First Name",
    familyName: "Family Name",
    email: "Email",
    mobile: "Mobile",
    password: "Password",
    selectEmirate: "Emirate",
    selectRole: "Role",
    accountActive: "Account is active",
    cancel: "Cancel",
    saving: "Saving...",
    saveChanges: "Save Changes",
    dubai: "Dubai",
    abuDhabi: "Abu Dhabi",
    sharjah: "Sharjah",
    ajman: "Ajman",
    fujairah: "Fujairah",
    rasAlKhaimah: "Ras Al Khaimah",
    ummAlQuwain: "Umm Al Quwain",
  },
  ar: {
    usersManagement: "إدارة الموظفين",
    totalUsers: "إجمالي الموظفين",
    active: "نشط",
    refresh: "تحديث",
    addUser: "إضافة موظف",
    searchPlaceholder: "البحث بالاسم أو البريد الإلكتروني أو الهاتف...",
    all: "كل الموظفين",
    admins: "المديرون",
    staffMembers: "الموظفون",
    drivers: "السائقون",
    user: "عضو الفريق",
    contact: "التواصل",
    role: "الدور",
    emirate: "الإمارة",
    status: "الحالة",
    joined: "تاريخ الانضمام",
    actions: "الإجراءات",
    noUsersFound: "لم يتم العثور على موظفين",
    activeStatus: "نشط",
    inactiveStatus: "غير نشط",
    verified: "موثق",
    edit: "تعديل",
    activate: "تفعيل",
    deactivate: "إلغاء التفعيل",
    delete: "حذف",
    confirmDelete: "هل أنت متأكد من حذف هذا الموظف؟",
    editUser: "تعديل الموظف",
    createUser: "إنشاء موظف",
    username: "اسم المستخدم",
    firstName: "الاسم الأول",
    familyName: "اسم العائلة",
    email: "البريد الإلكتروني",
    mobile: "الهاتف المحمول",
    password: "كلمة المرور",
    selectEmirate: "الإمارة",
    selectRole: "الدور",
    accountActive: "الحساب نشط",
    cancel: "إلغاء",
    saving: "جاري الحفظ...",
    saveChanges: "حفظ التغييرات",
    dubai: "دبي",
    abuDhabi: "أبوظبي",
    sharjah: "الشارقة",
    ajman: "عجمان",
    fujairah: "الفجيرة",
    rasAlKhaimah: "رأس الخيمة",
    ummAlQuwain: "أم القيوين",
  },
};

export function UsersTab({ onNavigate }: AdminTabProps) {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const t = translations[language];
  const STAFF_ROLE_CONFIG = getStaffRoleConfig(isRTL);
  
  const [users, setUsers] = useState<UserType[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    customers: number;
    admins: number;
    staff: number;
    delivery: number;
    active: number;
    verified: number;
    newThisMonth: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<StaffRole | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editModal, setEditModal] = useState<UserType | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    // Only fetch staff roles (exclude customers)
    const params: { role?: string; excludeRole?: string } = {};
    if (roleFilter !== "all") {
      params.role = roleFilter;
    }

    const [usersRes, statsRes] = await Promise.all([
      usersApi.getAll(params),
      usersApi.getStats(),
    ]);

    if (usersRes.success && usersRes.data) {
      // Filter out customers from the users list
      const staffUsers = usersRes.data.filter((u: UserType) => u.role !== 'customer');
      setUsers(staffUsers);
    }
    if (statsRes.success && statsRes.data) setStats(statsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [roleFilter]);

  const handleToggleActive = async (user: UserType) => {
    setUpdating(user.id);
    await usersApi.toggleActive(user.id, !user.isActive);
    await fetchData();
    setUpdating(null);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(t.confirmDelete)) return;
    setUpdating(userId);
    await usersApi.delete(userId);
    await fetchData();
    setUpdating(null);
  };

  const handleCreateUser = async (userData: {
    username: string;
    email: string;
    mobile: string;
    password: string;
    firstName: string;
    familyName: string;
    emirate: string;
    role: string;
  }) => {
    const response = await usersApi.create(userData);
    if (response.success) {
      await fetchData();
      setCreateModal(false);
    }
  };

  const handleUpdateUser = async (userId: string, userData: Partial<UserType>) => {
    const response = await usersApi.update(userId, userData);
    if (response.success) {
      await fetchData();
      setEditModal(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.firstName.toLowerCase().includes(query) ||
      user.familyName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.mobile.includes(query)
    );
  });

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t.usersManagement}</h3>
          <p className="text-sm text-slate-500">
            {stats?.total || 0} {t.totalUsers} • {stats?.active || 0} {t.active}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            {t.refresh}
          </button>
          <button
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            {t.addUser}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {Object.entries(STAFF_ROLE_CONFIG).map(([role, config]) => {
            const count = stats[role as keyof typeof stats] || 0;
            const Icon = config.icon;
            return (
              <div key={role} className="bg-white rounded-xl shadow-sm p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-slate-500 truncate">{config.label}s</p>
                    <p className="text-lg sm:text-2xl font-bold text-slate-900">{count}</p>
                  </div>
                  <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0", config.color)}>
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className={cn(
              "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400",
              isRTL ? "right-3" : "left-3"
            )} />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none",
                isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
              )}
            />
          </div>
          <div className="flex gap-2 flex-nowrap overflow-x-auto pb-2 sm:pb-0 sm:flex-wrap">
            <button
              onClick={() => setRoleFilter("all")}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                roleFilter === "all"
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {t.all}
            </button>
            {Object.entries(STAFF_ROLE_CONFIG).map(([role, config]) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role as StaffRole)}
                className={cn(
                  "px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0",
                  roleFilter === role
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {config.label}{isRTL ? "" : "s"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">{t.noUsersFound}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className={cn(
                    "px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap",
                    isRTL ? "text-right" : "text-left"
                  )}>
                    {t.user}
                  </th>
                  <th className={cn(
                    "px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden sm:table-cell",
                    isRTL ? "text-right" : "text-left"
                  )}>
                    {t.contact}
                  </th>
                  <th className={cn(
                    "px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap",
                    isRTL ? "text-right" : "text-left"
                  )}>
                    {t.role}
                  </th>
                  <th className={cn(
                    "px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden lg:table-cell",
                    isRTL ? "text-right" : "text-left"
                  )}>
                    {t.emirate}
                  </th>
                  <th className={cn(
                    "px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden md:table-cell",
                    isRTL ? "text-right" : "text-left"
                  )}>
                    {t.status}
                  </th>
                  <th className={cn(
                    "px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap hidden lg:table-cell",
                    isRTL ? "text-right" : "text-left"
                  )}>
                    {t.joined}
                  </th>
                  <th className={cn(
                    "px-3 sm:px-6 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap",
                    isRTL ? "text-left" : "text-right"
                  )}>
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((user) => {
                  return (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm sm:text-lg font-bold text-slate-600">
                              {user.firstName[0]}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 text-sm sm:text-base truncate">
                              {user.firstName} {user.familyName}
                            </p>
                            <p className="text-xs text-slate-500 truncate sm:hidden">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 hidden sm:table-cell">
                        <p className="text-sm text-slate-900">{user.email}</p>
                        <p className="text-xs text-slate-500">{user.mobile}</p>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        {(() => {
                          const roleConfig = STAFF_ROLE_CONFIG[user.role as StaffRole];
                          if (!roleConfig) return null;
                          const RoleIcon = roleConfig.icon;
                          return (
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                              roleConfig.color
                            )}>
                              <RoleIcon className="w-3 h-3" />
                              <span className="hidden sm:inline">{roleConfig.label}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-500 hidden lg:table-cell">
                        {user.emirate}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium w-fit",
                            user.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          )}>
                            {user.isActive ? t.activeStatus : t.inactiveStatus}
                          </span>
                          {user.isVerified && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium w-fit">
                              {t.verified}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-slate-500 hidden lg:table-cell">
                        {new Date(user.createdAt).toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE')}
                      </td>
                      <td className="px-3 sm:px-6 py-3 sm:py-4">
                        <div className={cn(
                          "flex items-center gap-1 sm:gap-2",
                          isRTL ? "justify-start" : "justify-end"
                        )}>
                          <button
                            onClick={() => setEditModal(user)}
                            className="p-1.5 sm:p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            title={t.edit}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(user)}
                            disabled={updating === user.id}
                            className={cn(
                              "p-2 rounded-lg",
                              user.isActive
                                ? "text-slate-500 hover:text-orange-600 hover:bg-orange-50"
                                : "text-slate-500 hover:text-green-600 hover:bg-green-50"
                            )}
                            title={user.isActive ? t.deactivate : t.activate}
                          >
                            {user.isActive ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            disabled={updating === user.id}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            title={t.delete}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {createModal && (
        <UserFormModal
          onClose={() => setCreateModal(false)}
          onSave={handleCreateUser}
          isRTL={isRTL}
          t={t}
        />
      )}

      {/* Edit User Modal */}
      {editModal && (
        <UserFormModal
          user={editModal}
          onClose={() => setEditModal(null)}
          onSave={(data) => handleUpdateUser(editModal.id, data)}
          isRTL={isRTL}
          t={t}
        />
      )}
    </div>
  );
}

function UserFormModal({
  user,
  onClose,
  onSave,
  isRTL,
  t,
}: {
  user?: UserType;
  onClose: () => void;
  onSave: (data: any) => void;
  isRTL: boolean;
  t: typeof translations.en;
}) {
  const STAFF_ROLE_CONFIG = getStaffRoleConfig(isRTL);
  const [formData, setFormData] = useState({
    username: user?.username || "",
    firstName: user?.firstName || "",
    familyName: user?.familyName || "",
    email: user?.email || "",
    mobile: user?.mobile || "",
    emirate: user?.emirate || "Dubai",
    role: user?.role || "staff", // Default to staff role for admin-created users
    password: "",
    isActive: user?.isActive ?? true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const data = user
      ? {
          username: formData.username,
          firstName: formData.firstName,
          familyName: formData.familyName,
          email: formData.email,
          mobile: formData.mobile,
          emirate: formData.emirate,
          role: formData.role,
          isActive: formData.isActive,
        }
      : formData;

    await onSave(data);
    setSubmitting(false);
  };

  const emirates = [
    { value: "Dubai", label: t.dubai },
    { value: "Abu Dhabi", label: t.abuDhabi },
    { value: "Sharjah", label: t.sharjah },
    { value: "Ajman", label: t.ajman },
    { value: "Fujairah", label: t.fujairah },
    { value: "Ras Al Khaimah", label: t.rasAlKhaimah },
    { value: "Umm Al Quwain", label: t.ummAlQuwain },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {user ? t.editUser : t.createUser}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Username field */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.username} *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
              required
              placeholder={isRTL ? "مثال: user123" : "e.g., user123"}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.firstName} *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.familyName} *
              </label>
              <input
                type="text"
                value={formData.familyName}
                onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.email} *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t.mobile} *
            </label>
            <input
              type="tel"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              required
              placeholder="+971501234567"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.password} *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  className={cn(
                    "w-full py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none",
                    isRTL ? "pr-4 pl-10" : "pl-4 pr-10"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600",
                    isRTL ? "left-3" : "right-3"
                  )}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.selectEmirate} *
              </label>
              <select
                value={formData.emirate}
                onChange={(e) => setFormData({ ...formData, emirate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              >
                {emirates.map((emirate) => (
                  <option key={emirate.value} value={emirate.value}>
                    {emirate.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t.selectRole} *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as StaffRole })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              >
                {Object.entries(STAFF_ROLE_CONFIG).map(([role, config]) => (
                  <option key={role} value={role}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                {t.accountActive}
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? t.saving : user ? t.saveChanges : t.createUser}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
