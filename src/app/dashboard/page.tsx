import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { db } from "@/db";
import { residents, monthlyBills, payments, rooms, portions, meters } from "@/db/schema";
import { eq, and, isNull, count, desc } from "drizzle-orm";
import { formatCycle, getCurrentCycleStart, formatDate } from "@/lib/billing-cycle";
import { formatINR, calcOutstanding } from "@/lib/decimal";
import { format } from "date-fns";
import { 
  Users, 
  DoorClosed, 
  Receipt, 
  CreditCard, 
  Plus, 
  Gauge, 
  ArrowRight, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown,
  Zap, 
  Sparkles,
  Building,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { ensureCustomRentColumns } from "@/db/ensure-columns";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  await ensureCustomRentColumns();

  // 1. Current cycle
  const currentCycle = getCurrentCycleStart();
  const currentCycleStr = format(currentCycle, "yyyy-MM-dd");
  const cycleLabel = formatCycle(currentCycle);

  // 2. Quick counts
  const [activeResidents] = await db
    .select({ count: count() })
    .from(residents)
    .where(eq(residents.isActive, true));

  const [activeRooms] = await db
    .select({ count: count() })
    .from(rooms)
    .where(eq(rooms.isActive, true));

  // 3. Current cycle bills
  const cycleBills = await db
    .select()
    .from(monthlyBills)
    .where(eq(monthlyBills.cycleStartDate, currentCycleStr));

  const draftBillCount = cycleBills.filter((b) => b.status === "DRAFT").length;
  const finalizedBillCount = cycleBills.filter((b) => b.status === "FINALIZED").length;
  const currentCycleTotal = cycleBills
    .filter((b) => b.status !== "VOID")
    .reduce((acc, b) => acc + Number(b.totalAmount), 0);

  // 4. Live Outstanding across entire property
  const allFinalizedBills = await db
    .select({ totalAmount: monthlyBills.totalAmount })
    .from(monthlyBills)
    .where(eq(monthlyBills.status, "FINALIZED"));
  const allPayments = await db
    .select({ amount: payments.amount, residentId: payments.residentId })
    .from(payments);

  const totalBilled = allFinalizedBills.reduce((acc, b) => acc + Number(b.totalAmount), 0);
  const totalPaid = allPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalOutstanding = Math.max(0, totalBilled - totalPaid);

  // 5. Recent 5 payments
  const recentPayments = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMode: payments.paymentMode,
      reference: payments.reference,
      residentId: payments.residentId,
      residentName: residents.name,
    })
    .from(payments)
    .innerJoin(residents, eq(payments.residentId, residents.id))
    .orderBy(desc(payments.paymentDate), desc(payments.id))
    .limit(5);

  // 6. Portions overview with rooms and occupants
  const allPortions = await db.select().from(portions).orderBy(portions.name);
  const allRooms = await db.select().from(rooms).orderBy(rooms.name);

  return (
    <AppShell>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Maximalist Welcome Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-primary p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 -mb-10 w-60 h-60 rounded-full bg-primary/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-xs font-semibold tracking-wide uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Girls PG Operations Center
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Property Overview & Billing Command
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100/90 max-w-xl">
                Managing 4 portions, 8 rooms, and 12 electricity submeters with automated equal-split calculations and real-time ledger accounting.
              </p>
            </div>

            {/* Banner Quick Badge */}
            <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur border border-white/15 rounded-xl p-3 text-center min-w-[130px]">
                <div className="text-[10px] uppercase font-bold text-indigo-200">Current Cycle</div>
                <div className="text-sm font-extrabold font-mono mt-0.5">{cycleLabel}</div>
              </div>
              <div className="bg-white/10 backdrop-blur border border-white/15 rounded-xl p-3 text-center min-w-[110px]">
                <div className="text-[10px] uppercase font-bold text-indigo-200">Electricity</div>
                <div className="text-sm font-extrabold font-mono text-amber-300 mt-0.5">₹10.00 / unit</div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Maximalist Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="ACTIVE RESIDENTS"
            value={String(activeResidents.count)}
            subtext="Enrolled girls"
            icon={<Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            gradient="from-indigo-500/10 via-indigo-500/5 to-transparent"
            border="border-indigo-500/30"
            href="/residents"
          />

          <MetricCard
            title="ACTIVE ROOMS"
            value={`${activeRooms.count} / 8`}
            subtext="4 portions (2 rooms/portion)"
            icon={<DoorClosed className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            gradient="from-blue-500/10 via-blue-500/5 to-transparent"
            border="border-blue-500/30"
            href="/rooms"
          />

          <MetricCard
            title="CYCLE BILLING STATUS"
            value={cycleBills.length === 0 ? "Not Generated" : formatINR(currentCycleTotal)}
            subtext={
              cycleBills.length === 0
                ? "Click to calculate bills"
                : `${finalizedBillCount} finalized · ${draftBillCount} draft`
            }
            icon={<Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            gradient="from-emerald-500/10 via-emerald-500/5 to-transparent"
            border="border-emerald-500/30"
            href="/billing"
          />

          <MetricCard
            title="TOTAL OUTSTANDING DUES"
            value={formatINR(totalOutstanding)}
            subtext="Live net receivables"
            icon={<TrendingUp className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
            gradient="from-rose-500/10 via-rose-500/5 to-transparent"
            border={totalOutstanding > 0 ? "border-rose-500/50 ring-1 ring-rose-500/20" : "border-border"}
            href="/reports/outstanding"
            valueColor={totalOutstanding > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}
          />
        </div>

        {/* Quick Action Dock */}
        <div className="bg-card border-2 border-border/80 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Quick Action Dock
            </h2>
            <span className="text-[11px] text-muted-foreground font-medium">1-Click Shortcuts</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <ActionButton
              href="/residents/new"
              icon={<Plus className="w-4 h-4 text-primary" />}
              label="Move In Girl"
              color="hover:border-primary hover:bg-primary/5"
            />
            <ActionButton
              href="/meters"
              icon={<Gauge className="w-4 h-4 text-amber-500" />}
              label="Enter Readings"
              color="hover:border-amber-500 hover:bg-amber-500/5"
            />
            <ActionButton
              href="/billing"
              icon={<Receipt className="w-4 h-4 text-emerald-500" />}
              label="Generate Bills"
              color="hover:border-emerald-500 hover:bg-emerald-500/5"
            />
            <ActionButton
              href="/payments/record"
              icon={<CreditCard className="w-4 h-4 text-blue-500" />}
              label="Record Payment"
              color="hover:border-blue-500 hover:bg-blue-500/5"
            />
            <ActionButton
              href="/expenses"
              icon={<TrendingDown className="w-4 h-4 text-rose-500" />}
              label="PG Expenses"
              color="hover:border-rose-500 hover:bg-rose-500/5"
            />
            <ActionButton
              href="/security-deposits"
              icon={<ShieldCheck className="w-4 h-4 text-purple-500" />}
              label="Deposits"
              color="hover:border-purple-500 hover:bg-purple-500/5"
            />
            <ActionButton
              href="/reports/outstanding"
              icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}
              label="Dues Ledger"
              color="hover:border-indigo-500 hover:bg-indigo-500/5"
            />
          </div>
        </div>

        {/* Maximalist Split View: Portions Map & Recent Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Portions Architecture (2 Cols on LG) */}
          <div className="lg:col-span-2 bg-card border-2 border-border/80 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <Building className="w-5 h-5 text-primary" />
                  Property Portions Architecture
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  4 self-contained portions · Each with 2 bedrooms + 1 kitchen
                </p>
              </div>
              <Link
                href="/rooms"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>Full Map</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {allPortions.map((portion) => {
                const portionLetter = portion.name.replace("Portion ", "");
                const portionRooms = allRooms.filter((r) => r.portionId === portion.id);

                return (
                  <div
                    key={portion.id}
                    className="border-2 border-border/80 rounded-xl p-4 bg-muted/20 hover:bg-muted/40 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                          {portionLetter}
                        </span>
                        <span className="font-bold text-sm text-foreground">{portion.name}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        ⚡ Kitchen: {portionLetter}-K
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {portionRooms.map((r) => {
                        const roomNum = r.name.split("Room")[1];
                        return (
                          <div
                            key={r.id}
                            className="flex items-center justify-between bg-card p-2 rounded-lg border border-border/60"
                          >
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              <DoorClosed className="w-3.5 h-3.5 text-primary" />
                              {r.name}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              Meter: {portionLetter}-R{roomNum}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Payments Ledger (1 Col on LG) */}
          <div className="bg-card border-2 border-border/80 rounded-2xl p-6 shadow-sm space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Recent Inflow
                </h3>
                <Link
                  href="/payments"
                  className="text-xs font-bold text-primary hover:underline"
                >
                  All Logs
                </Link>
              </div>

              {recentPayments.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <div className="text-3xl">💳</div>
                  <p className="text-xs text-muted-foreground italic">No payments logged yet.</p>
                  <Link
                    href="/payments/record"
                    className="text-xs text-primary font-bold hover:underline inline-block pt-1"
                  >
                    + Record First Payment
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border text-xs">
                  {recentPayments.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between">
                      <div>
                        <Link
                          href={`/residents/${p.residentId}`}
                          className="font-bold text-foreground hover:text-primary transition-colors block"
                        >
                          {p.residentName}
                        </Link>
                        <span className="text-[11px] text-muted-foreground capitalize font-medium">
                          {p.paymentMode.replace("_", " ")}{" "}
                          {p.reference ? `· ${p.reference}` : ""}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400">
                          +{formatINR(p.amount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {formatDate(p.paymentDate)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Price Summary Box */}
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
              <div className="font-extrabold text-primary flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Confirmed PG Formula</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Rent ₹5,500 + Food ₹2,500 + Room Elec (½ each) + Kitchen Elec (Portion split).
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MetricCard({
  title,
  value,
  subtext,
  icon,
  gradient,
  border,
  href,
  valueColor = "text-foreground",
}: {
  title: string;
  value: string;
  subtext: string;
  icon: React.ReactNode;
  gradient: string;
  border: string;
  href: string;
  valueColor?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border-2 ${border} bg-card p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 block`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} pointer-events-none`} />
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <div className="p-2 rounded-xl bg-card border border-border shadow-xs group-hover:scale-110 transition-transform">
            {icon}
          </div>
        </div>
        <div>
          <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${valueColor}`}>
            {value}
          </div>
          <p className="text-[11px] text-muted-foreground font-medium mt-1 truncate">
            {subtext}
          </p>
        </div>
      </div>
    </Link>
  );
}

function ActionButton({
  href,
  icon,
  label,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 p-3 rounded-xl border-2 border-border/80 bg-background text-xs font-bold text-foreground transition-all shadow-xs ${color}`}
    >
      <div className="p-1 rounded-lg bg-muted shrink-0">{icon}</div>
      <span className="truncate">{label}</span>
    </Link>
  );
}
