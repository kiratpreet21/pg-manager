"use client";

import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Receipt, 
  Download, 
  Trash2, 
  Filter, 
  Calendar, 
  Tag, 
  Building, 
  Sparkles, 
  IndianRupee, 
  PieChart, 
  CheckCircle2, 
  AlertCircle,
  X,
  CreditCard,
  Zap,
  Wifi,
  Droplets,
  Utensils,
  Wrench,
  Sparkle,
  Layers,
  HelpCircle
} from "lucide-react";
import { formatINR } from "@/lib/decimal";
import { formatDate } from "@/lib/billing-cycle";

interface ExpenseItem {
  id: number;
  category: string;
  title: string;
  amount: string;
  expenseDate: string;
  paymentMode: string;
  vendorName: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

interface SummaryData {
  totalExpenses: string;
  totalRevenue: string;
  netProfit: string;
  profitMargin: string;
  isProfitable: boolean;
  categoryBreakdown: {
    category: string;
    total: string;
    count: number;
    percentage: string;
  }[];
  count: number;
}

const CATEGORIES: Record<string, { label: string; icon: any; color: string; badgeClass: string; bgClass: string }> = {
  electricity_discom: {
    label: "Main Electricity (DISCOM)",
    icon: Zap,
    color: "text-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    bgClass: "from-amber-500/10 to-transparent",
  },
  wifi: {
    label: "WiFi & Internet",
    icon: Wifi,
    color: "text-cyan-500",
    badgeClass: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    bgClass: "from-cyan-500/10 to-transparent",
  },
  water: {
    label: "Water Supply & Tanker",
    icon: Droplets,
    color: "text-blue-500",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    bgClass: "from-blue-500/10 to-transparent",
  },
  groceries: {
    label: "Groceries & Kitchen LPG",
    icon: Utensils,
    color: "text-orange-500",
    badgeClass: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    bgClass: "from-orange-500/10 to-transparent",
  },
  cook_salary: {
    label: "Cook & Maid Staff Salary",
    icon: Sparkles,
    color: "text-purple-500",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    bgClass: "from-purple-500/10 to-transparent",
  },
  repairs: {
    label: "Repairs & Maintenance",
    icon: Wrench,
    color: "text-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    bgClass: "from-rose-500/10 to-transparent",
  },
  cleaning: {
    label: "Cleaning & Supplies",
    icon: Sparkle,
    color: "text-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    bgClass: "from-emerald-500/10 to-transparent",
  },
  other: {
    label: "Other Operational",
    icon: Layers,
    color: "text-slate-500",
    badgeClass: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    bgClass: "from-slate-500/10 to-transparent",
  },
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");

  // Form State
  const [category, setCategory] = useState("electricity_discom");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentMode, setPaymentMode] = useState("upi");
  const [vendorName, setVendorName] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedCategory]);

  async function loadData() {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (selectedMonth) query.append("month", selectedMonth);
      if (selectedCategory) query.append("category", selectedCategory);

      const res = await fetch(`/api/expenses?${query.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setExpenses(data.expenses || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!title.trim() || !amount || !expenseDate) {
      setFormError("Please fill in all mandatory fields.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError("Amount must be greater than zero.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title,
          amount,
          expenseDate,
          paymentMode,
          vendorName,
          reference,
          notes,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || "Failed to record expense");
        return;
      }

      // Reset form & close
      setTitle("");
      setAmount("");
      setVendorName("");
      setReference("");
      setNotes("");
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this expense record? This action will be audited.")) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      } else {
        alert("Failed to delete expense record");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting record");
    } finally {
      setDeletingId(null);
    }
  }

  function exportCSV() {
    if (!expenses.length) return;
    const headers = ["ID", "Date", "Category", "Title", "Amount (INR)", "Payment Mode", "Vendor/Payee", "Reference", "Notes"];
    const rows = expenses.map((e) => [
      e.id,
      e.expenseDate,
      CATEGORIES[e.category]?.label || e.category,
      `"${e.title.replace(/"/g, '""')}"`,
      e.amount,
      e.paymentMode,
      `"${(e.vendorName || "").replace(/"/g, '""')}"`,
      `"${(e.reference || "").replace(/"/g, '""')}"`,
      `"${(e.notes || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pg_expenses_${selectedMonth || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Generate Month Options (last 12 months)
  const monthOptions = useMemo(() => {
    const list = [{ value: "all", label: "All Months (Lifetime)" }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const lbl = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      list.push({ value: val, label: lbl });
    }
    return list;
  }, []);

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* TOP HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <TrendingUp className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                  PG Operational Expenses & Net Profit
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 uppercase tracking-wider">
                    P&L Tracker
                  </span>
                </h1>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">
                  Track BESCOM electricity bills, WiFi, groceries, cook wages, maintenance, and inspect live net profitability.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={exportCSV}
              disabled={expenses.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-muted-foreground" />
              Export CSV
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Record New Expense
            </button>
          </div>
        </div>

        {/* MONTH & CATEGORY FILTER BAR */}
        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-foreground shrink-0">Accounting Period:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-foreground"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs font-medium">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              All Categories
            </button>
            {Object.entries(CATEGORIES).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedCategory === key
                    ? "bg-foreground text-background font-bold shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <cfg.icon className="w-3.5 h-3.5" />
                {cfg.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* FINANCIAL P&L METRIC DECK */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Inflow / Collections */}
            <div className="p-4 rounded-xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Revenue Collected
                </span>
                <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatINR(summary.totalRevenue)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                Actual resident cash/UPI payments in this period
              </p>
            </div>

            {/* 2. Total Outflow / Operational Expenses */}
            <div className="p-4 rounded-xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Operating Expenses
                </span>
                <span className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <TrendingDown className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
                  {formatINR(summary.totalExpenses)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                Across {summary.count} recorded expense vouchers
              </p>
            </div>

            {/* 3. Net Operating Profit */}
            <div className={`p-4 rounded-xl border shadow-sm relative overflow-hidden ${
              summary.isProfitable 
                ? "bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/30" 
                : "bg-gradient-to-br from-rose-500/10 via-card to-card border-rose-500/30"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Net Operating Profit
                </span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  summary.isProfitable 
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" 
                    : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                }`}>
                  {summary.profitMargin} Margin
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl font-black tracking-tight ${
                  summary.isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}>
                  {formatINR(summary.netProfit)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                {summary.isProfitable ? "Net surplus retained after all PG bills" : "Operating deficit for this selected duration"}
              </p>
            </div>

            {/* 4. Top Expense Category */}
            <div className="p-4 rounded-xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Largest Outflow
                </span>
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                  <PieChart className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-base font-extrabold text-foreground truncate">
                  {summary.categoryBreakdown[0] 
                    ? CATEGORIES[summary.categoryBreakdown[0].category]?.label.split("(")[0] 
                    : "None Yet"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground font-medium">
                {summary.categoryBreakdown[0] 
                  ? `${formatINR(summary.categoryBreakdown[0].total)} (${summary.categoryBreakdown[0].percentage}% of total)` 
                  : "No expenses logged"}
              </p>
            </div>
          </div>
        )}

        {/* EXPENSE CATEGORY BREAKDOWN CARDS */}
        {summary && summary.categoryBreakdown.length > 0 && (
          <div className="p-5 rounded-xl bg-card border border-border/80 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                Expense Distribution By Category
              </h3>
              <span className="text-xs font-semibold text-muted-foreground">
                Total ₹{summary.totalExpenses}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {summary.categoryBreakdown.map((item) => {
                const conf = CATEGORIES[item.category] || CATEGORIES.other;
                const Icon = conf.icon;
                return (
                  <div
                    key={item.category}
                    className="p-3.5 rounded-lg border border-border/70 bg-background/50 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-md ${conf.badgeClass}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
                          {conf.label.split("(")[0]}
                        </span>
                      </div>
                      <span className="text-xs font-black font-mono text-foreground">
                        {formatINR(item.total)}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 font-semibold">
                        <span>{item.count} voucher{item.count !== 1 ? "s" : ""}</span>
                        <span className="font-mono">{item.percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(2, parseFloat(item.percentage)))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DETAILED EXPENSE LEDGER TABLE */}
        <div className="rounded-xl border border-border/80 bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border/80 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                Expense Voucher Ledger
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {expenses.length} Records
              </span>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground font-medium">
              Loading expense records...
            </div>
          ) : expenses.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">No Expenses Logged For This Period</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Keep your accounting up to date by recording PG electricity bills, internet costs, grocery bills, and staff wages.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Record First Expense
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Expense Title</th>
                    <th className="py-3 px-4">Vendor / Payee</th>
                    <th className="py-3 px-4">Mode / Ref</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {expenses.map((exp) => {
                    const conf = CATEGORIES[exp.category] || CATEGORIES.other;
                    const Icon = conf.icon;
                    return (
                      <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-muted-foreground whitespace-nowrap">
                          {formatDate(exp.expenseDate)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border ${conf.badgeClass}`}>
                            <Icon className="w-3 h-3" />
                            {conf.label.split("(")[0]}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground">{exp.title}</div>
                          {exp.notes && (
                            <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {exp.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground font-medium whitespace-nowrap">
                          {exp.vendorName || "—"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-semibold uppercase tracking-wider text-[10px] text-foreground">
                            {exp.paymentMode}
                          </div>
                          {exp.reference && (
                            <div className="text-[10px] font-mono text-muted-foreground">
                              {exp.reference}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black font-mono text-rose-600 dark:text-rose-400 text-sm whitespace-nowrap">
                          {formatINR(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleDelete(exp.id)}
                            disabled={deletingId === exp.id}
                            title="Delete voucher (Audited)"
                            className="p-1.5 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RECORD EXPENSE MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-primary/10 text-primary">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-foreground">Record PG Expense</h3>
                    <p className="text-xs text-muted-foreground">Log an operational cost to calculate net monthly profit</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateExpense} className="p-5 space-y-4 text-xs">
                {formError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-foreground font-bold mb-1.5">Category *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {Object.entries(CATEGORIES).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Expense Date */}
                  <div>
                    <label className="block text-foreground font-bold mb-1.5">Date Paid *</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-foreground font-bold mb-1.5">Expense Title / Description *</label>
                  <input
                    type="text"
                    placeholder="e.g. BESCOM Main Meter Bill - Mar 2026 or ACT Fibernet WiFi"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-foreground font-bold mb-1.5">Amount (₹) *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-bold text-muted-foreground">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <label className="block text-foreground font-bold mb-1.5">Payment Mode *</label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer / NEFT</option>
                      <option value="cheque">Cheque</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Vendor / Payee */}
                  <div>
                    <label className="block text-foreground font-bold mb-1.5">Vendor / Payee</label>
                    <input
                      type="text"
                      placeholder="e.g. BESCOM, ACT, Ramu Cook"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Reference No */}
                  <div>
                    <label className="block text-foreground font-bold mb-1.5">Bill / UTR / Receipt Ref</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-9382109482"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-foreground font-bold mb-1.5">Internal Notes (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Paid online, geyser replaced in Portion B bathroom"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-border text-foreground font-semibold hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-md shadow-primary/25 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {submitting ? "Saving..." : "Save Expense Voucher"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
