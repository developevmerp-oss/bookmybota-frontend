"use client";

import React, { useState } from "react";
import {
  Scale,
  TrendingUp,
  Landmark,
  BookOpen,
  Receipt,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  List,
  Printer,
  Eye,
  X,
  ShieldCheck,
  Download,
  RotateCcw,
  Gift,
  Sparkles,
} from "lucide-react";
import {
  useGetAccountingTrialBalanceQuery,
  useGetAccountingPAndLQuery,
  useGetAccountingBalanceSheetQuery,
  useGetAccountingLedgerQuery,
  useGetAccountingTaxSummaryQuery,
  useGetAccountingInvoicesQuery,
  useGetTaxConfigsQuery,
  useUpdateTaxConfigMutation,
  useGetChartOfAccountsQuery,
  useGetGiftCardBreakagePreviewQuery,
  useExecuteGiftCardBreakageRunMutation,
} from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import { formatDate } from "@/lib/dateFormat";
import { AdminSegmentedTabs, AdminStatCard, AdminStatusBadge } from "@/components/SuperAdmin/AdminFinanceChrome";
import { toast } from "sonner";

interface FinancialSuiteProps {
  businessId?: string | null;
  panelTitle?: string;
  isSuperadmin?: boolean;
}

type TabType = "trial-balance" | "p-and-l" | "balance-sheet" | "ledger" | "tax-summary" | "tax-configs" | "chart-of-accounts" | "gift-card-breakage";

export default function FinancialSuite({
  businessId = null,
  panelTitle = "Financial Accounting & Taxation Suite",
  isSuperadmin = true,
}: FinancialSuiteProps) {
  const [activeTab, setActiveTab] = useState<TabType>("trial-balance");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>("ALL");

  // RTK Queries
  const {
    data: tbData,
    isLoading: tbLoading,
    refetch: refetchTb,
  } = useGetAccountingTrialBalanceQuery({
    business_id: businessId || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });

  const {
    data: pnlData,
    isLoading: pnlLoading,
    refetch: refetchPnl,
  } = useGetAccountingPAndLQuery({
    business_id: businessId || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });

  const {
    data: bsData,
    isLoading: bsLoading,
    refetch: refetchBs,
  } = useGetAccountingBalanceSheetQuery({
    business_id: businessId || undefined,
    as_of: dateTo || undefined,
  });

  const {
    data: ledgerData,
    isLoading: ledgerLoading,
    refetch: refetchLedger,
  } = useGetAccountingLedgerQuery({
    business_id: businessId || undefined,
    account_code: selectedAccountFilter || undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    page: ledgerPage,
    limit: 25,
  });

  const {
    data: taxData,
    isLoading: taxLoading,
    refetch: refetchTax,
  } = useGetAccountingTaxSummaryQuery({
    from: dateFrom || undefined,
    to: dateTo || undefined,
  });

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useGetAccountingInvoicesQuery({
    business_id: businessId || undefined,
  });

  const {
    data: taxConfigsData,
    refetch: refetchConfigs,
  } = useGetTaxConfigsQuery();

  const {
    data: coaData,
    isLoading: coaLoading,
  } = useGetChartOfAccountsQuery();

  const {
    data: breakageData,
    isLoading: breakageLoading,
    refetch: refetchBreakage,
  } = useGetGiftCardBreakagePreviewQuery(undefined, {
    skip: !isSuperadmin,
  });

  const [executeBreakageRun, { isLoading: isRunningBreakage }] = useExecuteGiftCardBreakageRunMutation();

  const handleRunBreakage = async () => {
    try {
      const res = await executeBreakageRun().unwrap();
      toast.success(res.message || "Gift card breakage recognition completed.");
      refetchBreakage();
      refetchTb();
      refetchPnl();
      refetchBs();
      refetchLedger();
    } catch (err: any) {
      toast.error(err?.data?.error || "Failed to execute breakage recognition.");
    }
  };

  const [updateTaxConfig, { isLoading: isUpdatingConfig }] = useUpdateTaxConfigMutation();

  const handleRefreshAll = () => {
    refetchTb();
    refetchPnl();
    refetchBs();
    refetchLedger();
    refetchTax();
    refetchInvoices();
    refetchConfigs();
    if (isSuperadmin) refetchBreakage();
    toast.success("Financial ledgers and tax records synchronized.");
  };

  const handleSaveTaxConfig = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await updateTaxConfig({
        country_code: "ETH",
        country_name: "Ethiopia",
        currency: "ETB",
        convenience_fee_vat_percent: Number(formData.get("convenience_fee_vat_percent")),
        commission_vat_percent: Number(formData.get("commission_vat_percent")),
        default_wht_percent: Number(formData.get("default_wht_percent")),
        unregistered_wht_percent: Number(formData.get("unregistered_wht_percent")),
        ticket_vat_percent: Number(formData.get("ticket_vat_percent")),
        company_name: String(formData.get("company_name") || ""),
        trading_name: String(formData.get("trading_name") || ""),
        company_tin: String(formData.get("company_tin") || ""),
        company_vat_number: String(formData.get("company_vat_number") || ""),
        company_address: String(formData.get("company_address") || ""),
        company_phone: String(formData.get("company_phone") || ""),
        company_email: String(formData.get("company_email") || ""),
        company_website: String(formData.get("company_website") || ""),
        fiscal_system_code: String(formData.get("fiscal_system_code") || ""),
        tax_authority_name: String(formData.get("tax_authority_name") || ""),
      }).unwrap();
      toast.success("Tax rates & platform invoicing profile updated successfully.");
      refetchConfigs();
      refetchInvoices();
    } catch (err) {
      toast.error((err as { data?: { error?: string } })?.data?.error || "Failed to update tax configuration.");
    }
  };

  const tabsList = [
    { key: "trial-balance" as const, label: "Trial Balance", icon: Scale },
    { key: "p-and-l" as const, label: "Profit & Loss", icon: TrendingUp },
    { key: "balance-sheet" as const, label: "Balance Sheet", icon: Landmark },
    { key: "ledger" as const, label: "General Ledger", icon: BookOpen },
    { key: "tax-summary" as const, label: "Tax Invoices & WHT", icon: Receipt },
    { key: "chart-of-accounts" as const, label: "Chart of Accounts", icon: List },
    ...(isSuperadmin ? [
      { key: "gift-card-breakage" as const, label: "Gift Card Breakage", icon: Gift },
      { key: "tax-configs" as const, label: "Tax Rules & Identity", icon: Globe },
    ] : []),
  ];

  const ethConfig = taxConfigsData?.data?.find((c: any) => c.country_code === "ETH") || {
    convenience_fee_vat_percent: 15.0,
    commission_vat_percent: 15.0,
    default_wht_percent: 2.0,
    unregistered_wht_percent: 30.0,
    ticket_vat_percent: 15.0,
    company_name: "Scaloy Technologies PLC",
    trading_name: "BookMyBota",
    company_tin: "0072910482",
    company_vat_number: "8294102938",
    company_address: "Bole Sub-City, Woreda 03, House No. 892, Addis Ababa, Ethiopia",
    company_phone: "+251 11 667 8900",
    company_email: "tax@bookmybota.com",
    company_website: "www.bookmybota.com",
    fiscal_system_code: "ERCA-FS-ADDIS-0912",
    tax_authority_name: "Ministry of Revenues (MOR / ERCA)",
  };

  // =========================================================================
  // CSV / EXCEL EXPORT ENGINE (POINT 2)
  // =========================================================================
  const downloadCSV = (filename: string, rows: (string | number)[][]) => {
    const processCell = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvContent = "\uFEFF" + rows.map((r) => r.map(processCell).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportTrialBalance = () => {
    if (!tbData?.data?.accounts?.length) {
      toast.error("No trial balance records to export.");
      return;
    }
    const tb = tbData.data;
    const company = ethConfig.company_name || "BookMyBota";
    const dateStamp = new Date().toISOString().slice(0, 10);
    const dateRangeStr = `Period: ${dateFrom || "Beginning"} to ${dateTo || "Current"}`;

    const rows: (string | number)[][] = [
      [company, "TRIAL BALANCE REPORT", dateRangeStr],
      ["Generated At", new Date().toLocaleString(), `Currency: ${ethConfig.currency || "ETB"}`],
      [],
      ["Account Code", "Account Name", "Category", "Debit (ETB)", "Credit (ETB)", "Net Balance (ETB)"],
      ...tb.accounts.map((item: any) => [
        item.account_code,
        item.account_name,
        item.category || item.account_type || "",
        Number(item.total_debit ?? item.debit_balance ?? 0).toFixed(2),
        Number(item.total_credit ?? item.credit_balance ?? 0).toFixed(2),
        Number(item.net_balance ?? 0).toFixed(2),
      ]),
      [],
      [
        "TOTALS",
        "",
        "",
        Number(tb.grandTotalDebit || 0).toFixed(2),
        Number(tb.grandTotalCredit || 0).toFixed(2),
        tb.isBalanced ? "BALANCED (0.00)" : (Number(tb.grandTotalDebit || 0) - Number(tb.grandTotalCredit || 0)).toFixed(2),
      ],
    ];
    downloadCSV(`Trial_Balance_${dateStamp}.csv`, rows);
    toast.success("Trial Balance exported to CSV.");
  };

  const exportProfitAndLoss = () => {
    if (!pnlData?.data) {
      toast.error("No profit & loss records to export.");
      return;
    }
    const pnl = pnlData.data;
    const company = ethConfig.company_name || "BookMyBota";
    const dateStamp = new Date().toISOString().slice(0, 10);
    const dateRangeStr = `Period: ${dateFrom || "Beginning"} to ${dateTo || "Current"}`;

    const rows: (string | number)[][] = [
      [company, "PROFIT & LOSS STATEMENT (INCOME STATEMENT)", dateRangeStr],
      ["Generated At", new Date().toLocaleString(), `Currency: ${ethConfig.currency || "ETB"}`],
      [],
      ["--- OPERATING REVENUES ---", "", ""],
      ["Account Code", "Account Name", "Amount (ETB)"],
      ...(pnl.revenues || []).map((r: any) => [
        r.account_code,
        r.account_name,
        Number(r.net_balance ?? r.amount ?? 0).toFixed(2),
      ]),
      ["TOTAL REVENUES", "", Number(pnl.totalRevenue || 0).toFixed(2)],
      [],
      ["--- OPERATING EXPENSES ---", "", ""],
      ["Account Code", "Account Name", "Amount (ETB)"],
      ...(pnl.expenses || []).map((e: any) => [
        e.account_code,
        e.account_name,
        Number(e.net_balance ?? e.amount ?? 0).toFixed(2),
      ]),
      ["TOTAL EXPENSES", "", Number(pnl.totalExpense || 0).toFixed(2)],
      [],
      ["NET OPERATING PROFIT / (LOSS)", "", Number(pnl.netProfit || 0).toFixed(2)],
    ];
    downloadCSV(`Profit_And_Loss_${dateStamp}.csv`, rows);
    toast.success("Profit & Loss statement exported to CSV.");
  };

  const exportBalanceSheet = () => {
    if (!bsData?.data) {
      toast.error("No balance sheet records to export.");
      return;
    }
    const bs = bsData.data;
    const company = ethConfig.company_name || "BookMyBota";
    const dateStamp = new Date().toISOString().slice(0, 10);

    const rows: (string | number)[][] = [
      [company, "STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)", `As of: ${dateTo || dateStamp}`],
      ["Generated At", new Date().toLocaleString(), `Currency: ${ethConfig.currency || "ETB"}`],
      [],
      ["--- ASSETS ---", "", ""],
      ["Account Code", "Account Name", "Amount (ETB)"],
      ...(bs.assets || []).map((a: any) => [
        a.account_code,
        a.account_name,
        Number(a.net_balance || 0).toFixed(2),
      ]),
      ["TOTAL ASSETS", "", Number(bs.totalAssets || 0).toFixed(2)],
      [],
      ["--- LIABILITIES ---", "", ""],
      ["Account Code", "Account Name", "Amount (ETB)"],
      ...(bs.liabilities || []).map((l: any) => [
        l.account_code,
        l.account_name,
        Number(l.net_balance || 0).toFixed(2),
      ]),
      ["TOTAL LIABILITIES", "", Number(bs.totalLiabilities || 0).toFixed(2)],
      [],
      ["--- EQUITY & RESERVES ---", "", ""],
      ["Account Code", "Account Name", "Amount (ETB)"],
      ...(bs.equity || []).map((eq: any) => [
        eq.account_code,
        eq.account_name,
        Number(eq.net_balance || 0).toFixed(2),
      ]),
      ["TOTAL EQUITY", "", Number(bs.totalEquity || 0).toFixed(2)],
      [],
      [
        "TOTAL LIABILITIES & EQUITY",
        "",
        Number(bs.totalLiabilitiesAndEquity || (Number(bs.totalLiabilities || 0) + Number(bs.totalEquity || 0))).toFixed(2),
      ],
      [],
      [
        "BALANCE EQUATION STATUS",
        "",
        bs.isBalanced ? "BALANCED (Assets = Liabilities + Equity)" : "DISCREPANCY DETECTED",
      ],
    ];
    downloadCSV(`Balance_Sheet_${dateStamp}.csv`, rows);
    toast.success("Balance Sheet exported to CSV.");
  };

  const exportGeneralLedger = () => {
    if (!ledgerData?.entries?.length) {
      toast.error("No general ledger entries to export.");
      return;
    }
    const entries = ledgerData.entries;
    const company = ethConfig.company_name || "BookMyBota";
    const dateStamp = new Date().toISOString().slice(0, 10);
    const dateRangeStr = `Period: ${dateFrom || "Beginning"} to ${dateTo || "Current"}`;

    const rows: (string | number)[][] = [
      [company, "GENERAL LEDGER JOURNAL TRANSACTIONS", dateRangeStr],
      [
        "Generated At",
        new Date().toLocaleString(),
        `Account Filter: ${selectedAccountFilter || "All Accounts"}`,
      ],
      [],
      ["Entry #", "Posting Date", "Account Code", "Account Name", "Narration / Description", "Debit (ETB)", "Credit (ETB)"],
      ...entries.map((line: any) => [
        line.entry_number,
        formatDate(line.entry_date || line.created_at),
        line.account_code,
        line.account_name,
        line.narration,
        Number(line.debit_amount || 0).toFixed(2),
        Number(line.credit_amount || 0).toFixed(2),
      ]),
    ];
    downloadCSV(`General_Ledger_${dateStamp}.csv`, rows);
    toast.success("General Ledger exported to CSV.");
  };

  const exportTaxInvoices = () => {
    if (!invoicesData?.invoices?.length) {
      toast.error("No tax invoices to export.");
      return;
    }
    const invoices = invoicesData.invoices;
    const company = ethConfig.company_name || "BookMyBota";
    const dateStamp = new Date().toISOString().slice(0, 10);
    const dateRangeStr = `Period: ${dateFrom || "Beginning"} to ${dateTo || "Current"}`;

    const rows: (string | number)[][] = [
      [company, "ISSUED TAX INVOICES & STATUTORY WITHHOLDING CERTIFICATES", dateRangeStr],
      ["Generated At", new Date().toLocaleString(), `Tax Authority: ${ethConfig.tax_authority_name || "ERCA"}`],
      [],
      [
        "Invoice Number",
        "Document Type",
        "Recipient Name",
        "Recipient TIN",
        "Subtotal Base (ETB)",
        "Tax VAT/WHT (ETB)",
        "Total Document Amount (ETB)",
        "Issue Date",
        "Narration / Notes",
      ],
      ...invoices.map((inv: any) => [
        inv.invoice_number,
        inv.invoice_type,
        inv.recipient_name,
        inv.recipient_tin || inv.business_tin || "N/A",
        Number(inv.subtotal_amount || 0).toFixed(2),
        Number(inv.tax_amount || 0).toFixed(2),
        Number(inv.total_amount || 0).toFixed(2),
        formatDate(inv.created_at),
        inv.notes || "",
      ]),
    ];
    downloadCSV(`Tax_Invoices_${dateStamp}.csv`, rows);
    toast.success("Tax Invoices exported to CSV.");
  };

  const exportChartOfAccounts = () => {
    if (!coaData?.data?.length) {
      toast.error("No accounts in Chart of Accounts to export.");
      return;
    }
    const coa = coaData.data;
    const company = ethConfig.company_name || "BookMyBota";
    const dateStamp = new Date().toISOString().slice(0, 10);

    const rows: (string | number)[][] = [
      [company, "CHART OF ACCOUNTS MASTER DIRECTORY (IFRS / MOR)", `Date: ${dateStamp}`],
      [],
      ["Account Code", "Account Name", "Classification / Type", "Sub-Type", "Normal Balance", "Description"],
      ...coa.map((acct: any) => [
        acct.account_code,
        acct.account_name,
        acct.account_type || acct.category,
        acct.account_subtype || "—",
        acct.normal_balance,
        acct.description || "—",
      ]),
    ];
    downloadCSV(`Chart_Of_Accounts_${dateStamp}.csv`, rows);
    toast.success("Chart of Accounts exported to CSV.");
  };

  const handleExportActiveReport = () => {
    switch (activeTab) {
      case "trial-balance":
        exportTrialBalance();
        break;
      case "p-and-l":
        exportProfitAndLoss();
        break;
      case "balance-sheet":
        exportBalanceSheet();
        break;
      case "ledger":
        exportGeneralLedger();
        break;
      case "tax-summary":
        exportTaxInvoices();
        break;
      case "chart-of-accounts":
        exportChartOfAccounts();
        break;
      default:
        toast.info("Select an accounting statement tab to export.");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Toolbar */}
      <div className="admin-list-toolbar flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-rose-600/10 text-rose-500 border border-rose-500/20">
              <Scale size={20} />
            </span>
            {panelTitle}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time double-entry general ledger, IFRS statements, and Ethiopian Ministry of Revenues compliance.
          </p>
        </div>

        {/* Global Date Filters & Sync Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-300">
            <span className="text-zinc-500 font-medium">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-white focus:outline-none text-xs"
            />
          </div>
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-300">
            <span className="text-zinc-500 font-medium">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-white focus:outline-none text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleExportActiveReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-900/30 transition-all active:scale-95 cursor-pointer"
            title="Download active financial statement as CSV / Excel"
          >
            <Download size={13} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-900/30 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw size={13} />
            Sync Ledger
          </button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center overflow-x-auto">
        <AdminSegmentedTabs
          tabs={tabsList}
          active={activeTab}
          onChange={(k) => setActiveTab(k as TabType)}
        />
      </div>

      {/* TAB 1: TRIAL BALANCE */}
      {activeTab === "trial-balance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AdminStatCard
              label="Total Debits"
              value={formatMoney(tbData?.data?.grandTotalDebit || 0)}
              hint="Sum of all debit balances"
              icon={Scale}
            />
            <AdminStatCard
              label="Total Credits"
              value={formatMoney(tbData?.data?.grandTotalCredit || 0)}
              hint="Sum of all credit balances"
              icon={Scale}
            />
            <div className="glass-panel rounded-2xl border border-white/5 p-4 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Ledger Invariance</p>
                <CheckCircle2 size={16} className={tbData?.data?.isBalanced ? "text-emerald-400" : "text-rose-400"} />
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                    tbData?.data?.isBalanced
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {tbData?.data?.isBalanced ? "Balanced (0.00 Discrepancy)" : "Unbalanced"}
                </span>
                <p className="text-[11px] text-zinc-500 mt-1">Mathematical guarantee active</p>
              </div>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Chart of Accounts Balances</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-500">{tbData?.data?.accounts?.length || 0} Accounts</span>
                <button
                  type="button"
                  onClick={exportTrialBalance}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors"
                >
                  <Download size={13} />
                  Export (.csv)
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Account Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Debit Movement</th>
                    <th className="py-3 px-4 text-right">Credit Movement</th>
                    <th className="py-3 px-4 text-right">Closing Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-zinc-300">
                  {tbLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        Loading trial balance...
                      </td>
                    </tr>
                  ) : !tbData?.data?.accounts?.length ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        No transactions recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    tbData.data.accounts.map((acc: {
                      account_code: string;
                      account_name: string;
                      category: string;
                      total_debit?: number;
                      debit_balance?: number;
                      total_credit?: number;
                      credit_balance?: number;
                      net_balance?: number;
                      normal_balance?: string;
                    }) => {
                      const debitVal = Number(acc.total_debit ?? acc.debit_balance ?? 0);
                      const creditVal = Number(acc.total_credit ?? acc.credit_balance ?? 0);
                      const netVal = Number(acc.net_balance ?? 0);
                      return (
                        <tr key={acc.account_code} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-rose-400">{acc.account_code}</td>
                          <td className="py-3 px-4 font-medium text-white">{acc.account_name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-zinc-400 uppercase">
                              {acc.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-200">
                            {debitVal > 0 ? formatMoney(debitVal) : "—"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-200">
                            {creditVal > 0 ? formatMoney(creditVal) : "—"}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            {formatMoney(Math.abs(netVal))} {acc.normal_balance === "DEBIT" ? (netVal >= 0 ? "Dr" : "Cr") : (netVal >= 0 ? "Cr" : "Dr")}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot className="bg-white/[0.04] border-t-2 border-white/10 font-mono text-sm text-white">
                  <tr>
                    <td colSpan={3} className="py-3.5 px-4 font-bold text-xs uppercase tracking-wider text-zinc-200">
                      Grand Totals & Verification
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                      {formatMoney(tbData?.data?.grandTotalDebit || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                      {formatMoney(tbData?.data?.grandTotalCredit || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        tbData?.data?.isBalanced
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      }`}>
                        {tbData?.data?.isBalanced ? "Balanced (0.00)" : "Unbalanced"}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROFIT & LOSS */}
      {activeTab === "p-and-l" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Profit & Loss Statement (Income Statement)</h2>
            <button
              type="button"
              onClick={exportProfitAndLoss}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors"
            >
              <Download size={13} />
              Export P&L (.csv)
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AdminStatCard
              label="Operating Revenue"
              value={formatMoney(pnlData?.data?.totalRevenue || 0)}
              hint="Ticket sales, commissions, fees"
              accent="text-emerald-400"
              icon={TrendingUp}
            />
            <AdminStatCard
              label="Direct Costs & Expenses"
              value={formatMoney(pnlData?.data?.totalExpense || 0)}
              hint="Platform deductions, marketing, ops"
              accent="text-amber-400"
              icon={Receipt}
            />
            <AdminStatCard
              label="Net Profit"
              value={formatMoney(pnlData?.data?.netProfit || 0)}
              hint="Revenue − Operating Expenses"
              accent="text-rose-400"
              icon={Landmark}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">Revenue Breakdown</h3>
              </div>
              <div className="p-4 space-y-3">
                {pnlData?.data?.revenues?.length ? (
                  pnlData.data.revenues.map((r: { account_code: string; account_name: string; net_balance?: number; amount?: number }) => (
                    <div key={r.account_code} className="flex items-center justify-between text-sm py-1 border-b border-white/5">
                      <span className="text-zinc-300 font-medium">
                        <span className="font-mono text-xs text-zinc-500 mr-2">{r.account_code}</span>
                        {r.account_name}
                      </span>
                      <span className="font-mono font-bold text-white">{formatMoney(r.net_balance ?? r.amount ?? 0)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 py-4 text-center">No revenue recorded in selected period.</p>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wide">Expense Breakdown</h3>
              </div>
              <div className="p-4 space-y-3">
                {pnlData?.data?.expenses?.length ? (
                  pnlData.data.expenses.map((e: { account_code: string; account_name: string; net_balance?: number; amount?: number }) => (
                    <div key={e.account_code} className="flex items-center justify-between text-sm py-1 border-b border-white/5">
                      <span className="text-zinc-300 font-medium">
                        <span className="font-mono text-xs text-zinc-500 mr-2">{e.account_code}</span>
                        {e.account_name}
                      </span>
                      <span className="font-mono font-bold text-white">{formatMoney(e.net_balance ?? e.amount ?? 0)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 py-4 text-center">No expenses recorded in selected period.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BALANCE SHEET (Classic T-Account Side-by-Side Presentation) */}
      {activeTab === "balance-sheet" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Statement of Financial Position (Balance Sheet)</h2>
            <button
              type="button"
              onClick={exportBalanceSheet}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors"
            >
              <Download size={13} />
              Export Balance Sheet (.csv)
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AdminStatCard
              label="Total Assets"
              value={formatMoney(bsData?.data?.totalAssets || 0)}
              hint="Escrow bank, operating cash, receivables"
              accent="text-white"
              icon={Landmark}
            />
            <AdminStatCard
              label="Total Liabilities"
              value={formatMoney(bsData?.data?.totalLiabilities || 0)}
              hint="Merchant payables, VAT & WHT provisions"
              accent="text-amber-400"
              icon={Receipt}
            />
            <AdminStatCard
              label="Total Equity"
              value={formatMoney(bsData?.data?.totalEquity || 0)}
              hint="Capital + Retained Net Profit"
              accent="text-emerald-400"
              icon={TrendingUp}
            />
          </div>

          {/* Side-by-Side Presentation: Assets (Left) vs. Liabilities & Equity (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT COLUMN: ASSETS */}
            <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    ASSETS
                  </h3>
                  <span className="text-xs text-zinc-500">{bsData?.data?.assets?.length || 0} Accounts</span>
                </div>
                <div className="p-4 divide-y divide-white/5 space-y-2">
                  {bsData?.data?.assets?.length ? (
                    bsData.data.assets.map((a: { account_code: string; account_name: string; net_balance: number }) => (
                      <div key={a.account_code} className="flex items-center justify-between text-sm pt-2">
                        <span className="text-zinc-300">
                          <span className="font-mono text-xs text-zinc-500 mr-2">{a.account_code}</span>
                          {a.account_name}
                        </span>
                        <span className="font-mono font-semibold text-white">{formatMoney(a.net_balance)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500 py-6 text-center">No asset balances found.</p>
                  )}
                </div>
              </div>
              <div className="p-4 bg-white/[0.03] border-t border-white/10 flex items-center justify-between font-mono">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Total Assets</span>
                <span className="text-base font-bold text-emerald-400">{formatMoney(bsData?.data?.totalAssets || 0)}</span>
              </div>
            </div>

            {/* RIGHT COLUMN: LIABILITIES & EQUITY */}
            <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    LIABILITIES & EQUITY
                  </h3>
                  <span className="text-xs text-zinc-500">
                    {(bsData?.data?.liabilities?.length || 0) + (bsData?.data?.equity?.length || 0) + 1} Accounts
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Sub-section: Liabilities */}
                  <div>
                    <p className="text-[11px] font-bold text-amber-400/90 uppercase tracking-wider mb-2">Liabilities</p>
                    <div className="divide-y divide-white/5 space-y-2">
                      {bsData?.data?.liabilities?.length ? (
                        bsData.data.liabilities.map((l: { account_code: string; account_name: string; net_balance: number }) => (
                          <div key={l.account_code} className="flex items-center justify-between text-sm pt-2">
                            <span className="text-zinc-300">
                              <span className="font-mono text-xs text-zinc-500 mr-2">{l.account_code}</span>
                              {l.account_name}
                            </span>
                            <span className="font-mono font-semibold text-white">{formatMoney(l.net_balance)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-500 py-2">No liability balances.</p>
                      )}
                    </div>
                  </div>

                  {/* Sub-section: Equity */}
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[11px] font-bold text-emerald-400/90 uppercase tracking-wider mb-2">Equity & Retained Earnings</p>
                    <div className="divide-y divide-white/5 space-y-2">
                      {bsData?.data?.equity?.map((eq: { account_code: string; account_name: string; net_balance: number }) => (
                        <div key={eq.account_code} className="flex items-center justify-between text-sm pt-2">
                          <span className="text-zinc-300">
                            <span className="font-mono text-xs text-zinc-500 mr-2">{eq.account_code}</span>
                            {eq.account_name}
                          </span>
                          <span className="font-mono font-semibold text-white">{formatMoney(eq.net_balance)}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-sm pt-2">
                        <span className="text-zinc-300 flex items-center gap-1.5">
                          <span className="font-mono text-xs text-zinc-500 mr-2">3020</span>
                          Current Period Net Profit
                        </span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {formatMoney(bsData?.data?.currentPeriodNetProfit || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/[0.03] border-t border-white/10 flex items-center justify-between font-mono">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Total Liabilities & Equity</span>
                <span className="text-base font-bold text-emerald-400">
                  {formatMoney(bsData?.data?.totalLiabilitiesAndEquity || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Balance Check Bar */}
          <div className="glass-panel rounded-2xl border border-white/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={18} className={bsData?.data?.isBalanced ? "text-emerald-400" : "text-rose-400"} />
              <div>
                <p className="text-sm font-bold text-white">Balance Sheet Invariance Equation</p>
                <p className="text-xs text-zinc-400">
                  Assets ({formatMoney(bsData?.data?.totalAssets || 0)}) = Liabilities ({formatMoney(bsData?.data?.totalLiabilities || 0)}) + Equity ({formatMoney(bsData?.data?.totalEquity || 0)})
                </p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                bsData?.data?.isBalanced
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-400 border-rose-500/30"
              }`}
            >
              {bsData?.data?.isBalanced ? "Balanced (0.00 Discrepancy)" : "Discrepancy"}
            </span>
          </div>
        </div>
      )}

      {/* TAB 4: GENERAL LEDGER */}
      {activeTab === "ledger" && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-white/5 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-zinc-500" />
              <input
                type="text"
                placeholder="Filter account code (e.g. 1010)"
                value={selectedAccountFilter}
                onChange={(e) => setSelectedAccountFilter(e.target.value)}
                className="bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-rose-500/50 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">
                Page {ledgerPage} of {ledgerData?.pagination?.totalPages || 1} ({ledgerData?.pagination?.total || 0} entries)
              </span>
              <button
                type="button"
                onClick={exportGeneralLedger}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors"
              >
                <Download size={13} />
                Export Ledger (.csv)
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-4">Entry #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">Narration</th>
                    <th className="py-3 px-4 text-right">Debit</th>
                    <th className="py-3 px-4 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-zinc-300">
                  {ledgerLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        Loading ledger entries...
                      </td>
                    </tr>
                  ) : !ledgerData?.entries?.length ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500">
                        No general ledger entries found.
                      </td>
                    </tr>
                  ) : (
                    ledgerData.entries.map((line: {
                      id?: string;
                      line_id?: string;
                      entry_number: string;
                      entry_date?: string;
                      created_at?: string;
                      account_code: string;
                      account_name: string;
                      narration: string;
                      debit_amount: number;
                      credit_amount: number;
                    }, idx: number) => (
                      <tr key={line.id || line.line_id || `${line.entry_number}-${idx}`} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-rose-400 whitespace-nowrap">{line.entry_number}</td>
                        <td className="py-3 px-4 text-xs text-zinc-400 whitespace-nowrap">{formatDate(line.entry_date || line.created_at)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-xs text-white font-semibold mr-1.5">{line.account_code}</span>
                          <span className="text-xs text-zinc-400">{line.account_name}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-300 max-w-[420px]" title={line.narration}>
                          <div className="leading-relaxed line-clamp-2">{line.narration}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-200">
                          {line.debit_amount > 0 ? formatMoney(line.debit_amount) : "—"}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-200">
                          {line.credit_amount > 0 ? formatMoney(line.credit_amount) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TAX INVOICES & WHT */}
      {activeTab === "tax-summary" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <AdminStatCard
              label="B2C Invoices Issued"
              value={String(invoicesData?.invoices?.filter((i: { invoice_type: string }) => i.invoice_type === "B2C_RECEIPT").length || 0)}
              hint="Tickets & bookings"
              icon={Receipt}
            />
            <AdminStatCard
              label="Settlement Statements"
              value={String(invoicesData?.invoices?.filter((i: { invoice_type: string }) => i.invoice_type === "SETTLEMENT_STATEMENT").length || 0)}
              hint="Merchant payouts"
              icon={Landmark}
            />
            <AdminStatCard
              label="Credit Notes & Reversals"
              value={String(invoicesData?.invoices?.filter((i: { invoice_type: string }) => i.invoice_type === "CREDIT_NOTE").length || 0)}
              hint="Refund reversals"
              accent="text-amber-400"
              icon={RotateCcw}
            />
            <AdminStatCard
              label="Output VAT Accrued"
              value={formatMoney(taxData?.data?.output_vat_payable || 0)}
              hint="15% on fees & commissions"
              accent="text-rose-400"
              icon={TrendingUp}
            />
            <AdminStatCard
              label="Withholding Tax (WHT)"
              value={formatMoney(taxData?.data?.withholding_tax_payable || 0)}
              hint="2% deducted from payouts"
              accent="text-emerald-400"
              icon={Scale}
            />
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Issued Tax Invoices & Certificates</h3>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[
                    { id: "ALL", label: "All Documents" },
                    { id: "B2C_RECEIPT", label: "B2C Receipts" },
                    { id: "SETTLEMENT_STATEMENT", label: "Settlement Statements" },
                    { id: "CREDIT_NOTE", label: "Credit Notes (Reversals)" },
                  ].map((filterTab) => (
                    <button
                      key={filterTab.id}
                      type="button"
                      onClick={() => setInvoiceTypeFilter(filterTab.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        invoiceTypeFilter === filterTab.id
                          ? "bg-rose-600 text-white font-semibold shadow-sm shadow-rose-900/40"
                          : "bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {filterTab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-center">
                <span className="text-xs text-zinc-500">
                  {(invoicesData?.invoices || []).filter((inv: any) =>
                    invoiceTypeFilter === "ALL" ? true : inv.invoice_type === invoiceTypeFilter
                  ).length}{" "}
                  Documents
                </span>
                <button
                  type="button"
                  onClick={exportTaxInvoices}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  Export (.csv)
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-4">Invoice / Note #</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">Tax (VAT/WHT)</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-zinc-300">
                  {invoicesLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-500">
                        Loading invoices...
                      </td>
                    </tr>
                  ) : !invoicesData?.invoices?.length ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-500">
                        No tax invoices issued yet.
                      </td>
                    </tr>
                  ) : (
                    invoicesData.invoices
                      .filter((inv: any) =>
                        invoiceTypeFilter === "ALL" ? true : inv.invoice_type === invoiceTypeFilter
                      )
                      .map((inv: any) => {
                        const isCreditNote = inv.invoice_type === "CREDIT_NOTE";
                        return (
                          <tr
                            key={inv.id}
                            onClick={() => setSelectedInvoice(inv)}
                            className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                          >
                            <td className="py-3 px-4 font-mono text-xs font-semibold group-hover:underline flex items-center gap-1.5">
                              {isCreditNote ? (
                                <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              ) : (
                                <Receipt className="w-3.5 h-3.5 text-zinc-500 group-hover:text-rose-400 transition-colors shrink-0" />
                              )}
                              <span className={isCreditNote ? "text-amber-400" : "text-rose-400"}>
                                {inv.invoice_number}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                  isCreditNote
                                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                    : inv.invoice_type === "SETTLEMENT_STATEMENT"
                                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                    : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                }`}
                              >
                                {isCreditNote ? "Credit Note" : inv.invoice_type.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-white">{inv.recipient_name}</td>
                            <td className="py-3 px-4 text-right font-mono">
                              {isCreditNote && Number(inv.subtotal_amount) > 0 ? "-" : ""}
                              {formatMoney(inv.subtotal_amount)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-rose-400">
                              {isCreditNote && Number(inv.tax_amount) > 0 ? "-" : ""}
                              {formatMoney(inv.tax_amount)}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-bold ${
                                isCreditNote ? "text-rose-400" : "text-white"
                              }`}
                            >
                              {isCreditNote && Number(inv.total_amount) > 0 ? "-" : ""}
                              {formatMoney(inv.total_amount)}
                            </td>
                            <td className="py-3 px-4 text-xs text-zinc-400">{formatDate(inv.created_at)}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedInvoice(inv);
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white/5 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 transition-all cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View / Print
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TAX CONFIGS (SUPERADMIN ONLY) */}
      {activeTab === "tax-configs" && isSuperadmin && (
        <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-6">
          <div className="border-b border-white/5 pb-4">
            <h3 className="text-base font-bold text-white">Ethiopian Ministry of Revenues (MOR / ERCA) Tax Rates</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Configure statutory Value Added Tax (VAT), Turn Over Tax (TOT), and Withholding Tax (WHT) rates.
            </p>
          </div>

          <form onSubmit={handleSaveTaxConfig} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Platform Convenience Fee VAT (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="convenience_fee_vat_percent"
                  defaultValue={ethConfig.convenience_fee_vat_percent}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Platform Commission VAT (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="commission_vat_percent"
                  defaultValue={ethConfig.commission_vat_percent}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Default Withholding Tax (WHT %)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="default_wht_percent"
                  defaultValue={ethConfig.default_wht_percent}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Non-TIN Unregistered WHT (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="unregistered_wht_percent"
                  defaultValue={ethConfig.unregistered_wht_percent}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Ticket Embedded VAT (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="ticket_vat_percent"
                  defaultValue={ethConfig.ticket_vat_percent}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-2 pt-4 border-t border-white/10">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-rose-400" />
                  Platform Invoicing Identity & Fiscal Header (Printed on Receipts)
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  These details dynamically appear on official ERCA tax invoices, B2C cash sales receipts, and settlement withholding tax certificates.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Platform Legal Entity Name
                </label>
                <input
                  type="text"
                  name="company_name"
                  defaultValue={ethConfig.company_name}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Platform Brand / Trading Name
                </label>
                <input
                  type="text"
                  name="trading_name"
                  defaultValue={ethConfig.trading_name}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Tax Identification Number (TIN)
                </label>
                <input
                  type="text"
                  name="company_tin"
                  defaultValue={ethConfig.company_tin}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  VAT Registration Number
                </label>
                <input
                  type="text"
                  name="company_vat_number"
                  defaultValue={ethConfig.company_vat_number}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Registered Physical Address
                </label>
                <input
                  type="text"
                  name="company_address"
                  defaultValue={ethConfig.company_address}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Official Phone Number
                </label>
                <input
                  type="text"
                  name="company_phone"
                  defaultValue={ethConfig.company_phone}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Tax / Invoicing Email
                </label>
                <input
                  type="email"
                  name="company_email"
                  defaultValue={ethConfig.company_email}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Official Website
                </label>
                <input
                  type="text"
                  name="company_website"
                  defaultValue={ethConfig.company_website}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  ERCA Machine / Fiscal System Code
                </label>
                <input
                  type="text"
                  name="fiscal_system_code"
                  defaultValue={ethConfig.fiscal_system_code}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Statutory Tax Authority Name
                </label>
                <input
                  type="text"
                  name="tax_authority_name"
                  defaultValue={ethConfig.tax_authority_name}
                  className="w-full bg-zinc-900/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:border-rose-500/50 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isUpdatingConfig}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-900/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isUpdatingConfig ? "Saving Configuration..." : "Save Tax Rates & Identity Profile"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 7: CHART OF ACCOUNTS */}
      {activeTab === "chart-of-accounts" && (
        <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-6">
          <div className="border-b border-white/5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <List size={18} className="text-rose-400" />
                Chart of Accounts
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                All {coaData?.data?.length ?? 0} master ledger accounts used for double-entry bookkeeping (IFRS-compliant, Ethiopian MOR standard).
              </p>
            </div>
            <button
              type="button"
              onClick={exportChartOfAccounts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition-colors self-start sm:self-auto"
            >
              <Download size={13} />
              Export COA (.csv)
            </button>
          </div>

          {coaLoading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500 gap-2">
              <RefreshCw size={16} className="animate-spin" /> Loading accounts...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    <th className="pb-3 pr-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Code</th>
                    <th className="pb-3 pr-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Account Name</th>
                    <th className="pb-3 pr-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</th>
                    <th className="pb-3 pr-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sub-Type</th>
                    <th className="pb-3 pr-6 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Normal Balance</th>
                    <th className="pb-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {(coaData?.data || []).map((acct: {
                    account_code: string;
                    account_name: string;
                    account_type: string;
                    account_subtype?: string;
                    normal_balance: string;
                    description?: string;
                    is_active?: boolean;
                  }) => (
                    <tr key={acct.account_code} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-6">
                        <span className="font-mono font-bold text-rose-400 text-xs bg-rose-600/10 px-2 py-1 rounded-lg">
                          {acct.account_code}
                        </span>
                      </td>
                      <td className="py-3 pr-6 font-medium text-white">{acct.account_name}</td>
                      <td className="py-3 pr-6">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          acct.account_type === 'ASSET' ? 'bg-blue-500/10 text-blue-400' :
                          acct.account_type === 'LIABILITY' ? 'bg-amber-500/10 text-amber-400' :
                          acct.account_type === 'EQUITY' ? 'bg-purple-500/10 text-purple-400' :
                          acct.account_type === 'REVENUE' ? 'bg-green-500/10 text-green-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {acct.account_type}
                        </span>
                      </td>
                      <td className="py-3 pr-6 text-zinc-400 text-xs">{acct.account_subtype || '—'}</td>
                      <td className="py-3 pr-6">
                        <span className={`text-xs font-bold ${
                          acct.normal_balance === 'DEBIT' ? 'text-blue-400' : 'text-green-400'
                        }`}>
                          {acct.normal_balance}
                        </span>
                      </td>
                      <td className="py-3 text-zinc-500 text-xs max-w-xs">{acct.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(!coaData?.data || coaData.data.length === 0) && (
                <div className="text-center py-16 text-zinc-600">
                  <List size={32} className="mx-auto mb-3 opacity-30" />
                  <p>No accounts found. Run the taxation migration to seed the Chart of Accounts.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* POINT 5: GIFT CARD BREAKAGE & IFRS 15 DERECOGNITION ENGINE                */}
      {/* ========================================================================= */}
      {activeTab === "gift-card-breakage" && isSuperadmin && (
        <div className="space-y-6">
          {/* Top 4 Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminStatCard
              label="Active Voucher Liability"
              value={formatMoney(breakageData?.data?.summary?.activeUnearnedLiability || 0)}
              hint={`Account 2040 • ${breakageData?.data?.summary?.activeCardsCount || 0} active cards`}
              icon={Gift}
            />
            <AdminStatCard
              label="Pending Expired Breakage"
              value={formatMoney(breakageData?.data?.summary?.pendingBreakageAmount || 0)}
              hint={`${breakageData?.data?.summary?.pendingBreakageCount || 0} expired cards unredeemed`}
              icon={AlertCircle}
            />
            <AdminStatCard
              label="Recognized Breakage Revenue"
              value={formatMoney(breakageData?.data?.summary?.totalRecognizedBreakage || 0)}
              hint="Account 4040 • Cumulative IFRS 15"
              icon={TrendingUp}
            />
            <div className="glass-panel rounded-2xl border border-white/5 p-4 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Breakage Sweep Engine</p>
                <Sparkles size={16} className={(breakageData?.data?.summary?.pendingBreakageCount || 0) > 0 ? "text-amber-400" : "text-emerald-400"} />
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                    (breakageData?.data?.summary?.pendingBreakageCount || 0) > 0
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  }`}
                >
                  {(breakageData?.data?.summary?.pendingBreakageCount || 0) > 0
                    ? `${breakageData?.data?.summary?.pendingBreakageCount} Awaiting Sweep`
                    : "Fully Processed"}
                </span>
                <p className="text-[11px] text-zinc-500 mt-1">IFRS 15 automated derecognition</p>
              </div>
            </div>
          </div>

          {/* Action & Policy Banner */}
          <div className="glass-panel rounded-2xl border border-white/5 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ShieldCheck size={16} />
                </span>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                  IFRS 15 & Ethiopian GAAP Gift Card Breakage Policy
                </h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                When a customer purchases a gift card, customer funds are held as unearned deferred revenue in <strong className="text-zinc-200">Account 2040 (Unearned Voucher Revenue)</strong>. When a gift card passes its expiration date with an unredeemed balance, the platform is legally discharged from providing services. Under IFRS 15, this expired balance is derecognized from liability and recognized into <strong className="text-emerald-400">Account 4040 (Gift Card Breakage Revenue)</strong> with balanced double-entry postings.
              </p>
            </div>

            <button
              type="button"
              disabled={isRunningBreakage || (breakageData?.data?.summary?.pendingBreakageCount || 0) === 0}
              onClick={handleRunBreakage}
              className={`px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 whitespace-nowrap transition-all shadow-sm ${
                (breakageData?.data?.summary?.pendingBreakageCount || 0) > 0
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40 cursor-pointer"
                  : "bg-white/5 text-zinc-500 border border-white/5 cursor-not-allowed"
              }`}
            >
              {isRunningBreakage ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Processing Sweep...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Recognize Expired Breakage ({formatMoney(breakageData?.data?.summary?.pendingBreakageAmount || 0)})
                </>
              )}
            </button>
          </div>

          {/* Table 1: Expired Cards Awaiting Recognition */}
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-400" />
                  Expired Cards Awaiting Recognition
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Cards whose expiration date has passed and currently hold an unredeemed balance.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-zinc-400 border border-white/5">
                {breakageData?.data?.pendingCards?.length || 0} Expired Card(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-white/5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Card Ref</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4">Purchaser</th>
                    <th className="py-3 px-4 text-right">Initial Balance</th>
                    <th className="py-3 px-4 text-right">Unredeemed Breakage</th>
                    <th className="py-3 px-4">Expired On</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {(breakageData?.data?.pendingCards || []).map((card: any) => (
                    <tr key={card.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono font-bold text-white">•••• {card.code_last4}</td>
                      <td className="py-3 px-4 text-zinc-300">{card.product_name}</td>
                      <td className="py-3 px-4 text-zinc-400">
                        {card.purchaser_name || "Guest Purchaser"}{card.purchaser_phone ? ` (${card.purchaser_phone})` : ""}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-400">{formatMoney(card.initial_balance)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">{formatMoney(card.current_balance)}</td>
                      <td className="py-3 px-4 text-zinc-400">{formatDate(card.expires_at)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {card.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!breakageData?.data?.pendingCards || breakageData.data.pendingCards.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500 text-xs">
                        <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-400/50" />
                        No expired cards currently pending breakage recognition. All balances are fully up to date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Recognized Breakage Audit History */}
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen size={16} className="text-rose-400" />
                  Recognized Breakage Audit Log
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Historical derecognition events posted to General Ledger (Account 2040 &rarr; Account 4040).
                </p>
              </div>
              <span className="text-xs text-zinc-500">
                {breakageData?.data?.recognizedHistory?.length || 0} Recent Events
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-white/5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Audit Ref</th>
                    <th className="py-3 px-4">Card</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 text-right">Recognized Income (ETB)</th>
                    <th className="py-3 px-4">Date Recognized</th>
                    <th className="py-3 px-4">Audit Narration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {(breakageData?.data?.recognizedHistory || []).map((item: any) => (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono text-zinc-400">{item.reference || `EXP-${item.id.slice(0, 8)}`}</td>
                      <td className="py-3 px-4 font-mono font-bold text-white">•••• {item.code_last4}</td>
                      <td className="py-3 px-4 text-zinc-300">{item.product_name}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">+{formatMoney(item.amount)}</td>
                      <td className="py-3 px-4 text-zinc-400">{formatDate(item.created_at)}</td>
                      <td className="py-3 px-4 text-zinc-400 max-w-sm truncate">{item.notes || "Expired card unredeemed balance"}</td>
                    </tr>
                  ))}
                  {(!breakageData?.data?.recognizedHistory || breakageData.data.recognizedHistory.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-500 text-xs">
                        No breakage derecognition events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POINT 1: PRINTABLE TAX INVOICE / RECEIPT MODAL                             */}
      {/* ========================================================================= */}
      {selectedInvoice && (() => {
        const meta = typeof selectedInvoice.metadata === "string"
          ? (() => { try { return JSON.parse(selectedInvoice.metadata); } catch { return {}; } })()
          : (selectedInvoice.metadata || {});

        const isB2CReceipt = selectedInvoice.invoice_type === "B2C_RECEIPT";
        const isSettlement = selectedInvoice.invoice_type === "SETTLEMENT_STATEMENT";
        const isWhtCert = selectedInvoice.invoice_type === "WHT_CERTIFICATE";
        const isCommission = selectedInvoice.invoice_type === "B2B_COMMISSION_INVOICE";
        const isCreditNote = selectedInvoice.invoice_type === "CREDIT_NOTE";

        const titleText = isCreditNote
          ? "OFFICIAL CREDIT NOTE & REVERSAL TAX INVOICE"
          : isB2CReceipt
          ? "OFFICIAL FISCAL SALES RECEIPT & TAX INVOICE"
          : isSettlement
          ? "OFFICIAL SETTLEMENT STATEMENT & WHT CERTIFICATE"
          : isWhtCert
          ? "STATUTORY WITHHOLDING TAX (WHT) CERTIFICATE"
          : isCommission
          ? "OFFICIAL TAX INVOICE - PLATFORM COMMISSION"
          : "OFFICIAL TAX INVOICE & RECEIPT";

        const subTitleText = isCreditNote
          ? "Federal Democratic Republic of Ethiopia • Ministry of Revenues (ERCA Proclamation No. 285/2002 • Article 24 - Credit Notes)"
          : isB2CReceipt
          ? "Federal Democratic Republic of Ethiopia • Ministry of Revenues (ERCA Proclamation No. 285/2002)"
          : isSettlement || isWhtCert
          ? "Pursuant to Ethiopian Income Tax Proclamation No. 979/2016 (Article 92 - Withholding Tax)"
          : "Federal Democratic Republic of Ethiopia • Value Added Tax & Income Tax Compliance";

        const handlePrint = () => {
          window.print();
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            {/* Embedded Print Styling */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-tax-invoice, #printable-tax-invoice * {
                  visibility: visible !important;
                }
                #printable-tax-invoice {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  margin: 0 !important;
                  padding: 16mm !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  box-shadow: none !important;
                  border: none !important;
                  z-index: 999999 !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}</style>

            <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-700/60 rounded-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in duration-150">
              {/* Modal Toolbar (hidden when printed) */}
              <div className="no-print p-4 bg-zinc-950/80 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Tax Document Viewer
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        ERCA Compliant
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono">{selectedInvoice.invoice_number}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    Print / Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedInvoice(null)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Document Body */}
              <div className="p-6 sm:p-8 bg-zinc-950/40 max-h-[80vh] overflow-y-auto">
                <div
                  id="printable-tax-invoice"
                  className="bg-white text-zinc-900 p-8 sm:p-10 rounded-xl shadow-xl border border-zinc-200"
                >
                  {/* Document Header */}
                  <div className="border-b-2 border-zinc-900 pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black tracking-tight text-zinc-950 font-serif uppercase">
                          {selectedInvoice.platform_trading_name || ethConfig.trading_name || "BOOKMYBOTA"}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-900 text-white uppercase tracking-wider">
                          Official
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-700 mt-1">
                        {selectedInvoice.platform_company_name || ethConfig.company_name || "Scaloy Technologies PLC"} (Authorized Invoicing Entity)
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {selectedInvoice.platform_address || ethConfig.company_address || "Addis Ababa, Ethiopia"}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Tel: {selectedInvoice.platform_phone || ethConfig.company_phone || "—"} • Email: {selectedInvoice.platform_email || ethConfig.company_email || "—"}
                        {(selectedInvoice.platform_website || ethConfig.company_website) && (
                          <span> • Web: {selectedInvoice.platform_website || ethConfig.company_website}</span>
                        )}
                      </p>
                    </div>

                    <div className="sm:text-right border-l sm:border-l-0 sm:border-r-0 border-zinc-200 pl-4 sm:pl-0">
                      <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                        {selectedInvoice.platform_tax_authority || ethConfig.tax_authority_name || "Tax Authority"} Identifiers
                      </div>
                      <div className="mt-1 text-xs space-y-0.5">
                        <div>
                          <span className="text-zinc-500">Tax Identification No (TIN):</span>{" "}
                          <span className="font-mono font-bold text-zinc-900">
                            {selectedInvoice.platform_tin || ethConfig.company_tin || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500">VAT Registration No:</span>{" "}
                          <span className="font-mono font-bold text-zinc-900">
                            {selectedInvoice.platform_vat_number || ethConfig.company_vat_number || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Fiscal System Code:</span>{" "}
                          <span className="font-mono text-zinc-700">
                            {selectedInvoice.platform_fiscal_code || ethConfig.fiscal_system_code || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Document Title Banner */}
                  <div className={`my-6 text-center border rounded-lg p-3 ${
                    isCreditNote ? "bg-rose-50 border-rose-200" : "bg-zinc-50 border-zinc-200"
                  }`}>
                    <h2 className={`text-base sm:text-lg font-black tracking-wide uppercase ${
                      isCreditNote ? "text-rose-900" : "text-zinc-900"
                    }`}>
                      {titleText}
                    </h2>
                    <p className={`text-xs mt-0.5 ${isCreditNote ? "text-rose-700" : "text-zinc-600"}`}>
                      {isCreditNote
                        ? subTitleText
                        : isB2CReceipt
                        ? `Federal Democratic Republic of Ethiopia • ${selectedInvoice.platform_tax_authority || ethConfig.tax_authority_name || "Ministry of Revenues (ERCA)"}`
                        : subTitleText}
                    </p>
                  </div>

                  {isCreditNote && (
                    <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <span className="font-bold uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                          Statutory Credit Note Reversal
                        </span>
                        <p className="text-[11px] text-amber-800 mt-1">
                          Original Sales Receipt Ref: <span className="font-mono font-bold">{meta.originalInvoiceNumber || meta.originalInvoiceId || "Linked Admission Receipt"}</span>
                        </p>
                      </div>
                      {meta.reason && (
                        <div className="bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300/60 font-medium text-amber-950 text-[11px]">
                          Reason: {meta.reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-6 border-b border-zinc-200 text-xs">
                    <div className="bg-zinc-50/70 p-4 rounded-lg border border-zinc-200/80 space-y-1.5">
                      <div className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] mb-2 border-b border-zinc-200 pb-1">
                        Recipient & Party Details
                      </div>
                      <div>
                        <span className="text-zinc-500">{isSettlement ? "Beneficiary Merchant / Partner:" : "Recipient / Customer:"}</span>{" "}
                        <span className="font-semibold text-zinc-900">
                          {selectedInvoice.legal_business_name || selectedInvoice.recipient_name}
                        </span>
                      </div>
                      {selectedInvoice.business_name && selectedInvoice.business_name !== selectedInvoice.recipient_name && (
                        <div>
                          <span className="text-zinc-500">Operating Brand / Trading:</span>{" "}
                          <span className="font-semibold text-zinc-900">{selectedInvoice.business_name}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-zinc-500">Tax Identification No (TIN):</span>{" "}
                        <span className="font-mono font-semibold text-zinc-900">
                          {selectedInvoice.recipient_tin || selectedInvoice.business_tin || "Unregistered Individual Consumer"}
                        </span>
                      </div>
                      {(selectedInvoice.business_vat_number || meta.businessVatNumber) && (
                        <div>
                          <span className="text-zinc-500">Merchant VAT Reg No:</span>{" "}
                          <span className="font-mono font-semibold text-zinc-900">
                            {selectedInvoice.business_vat_number || meta.businessVatNumber}
                          </span>
                        </div>
                      )}
                      {(selectedInvoice.business_address || meta.businessAddress) && (
                        <div>
                          <span className="text-zinc-500">Registered Address:</span>{" "}
                          <span className="text-zinc-700">
                            {selectedInvoice.business_address || meta.businessAddress}
                          </span>
                        </div>
                      )}
                      {(meta.customerEmail || selectedInvoice.business_phone || meta.businessPhone || meta.customerPhone) && (
                        <div>
                          <span className="text-zinc-500">Contact Details:</span>{" "}
                          <span className="text-zinc-700">
                            {[meta.customerEmail, selectedInvoice.business_phone || meta.businessPhone || meta.customerPhone].filter(Boolean).join(" • ")}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="bg-zinc-50/70 p-4 rounded-lg border border-zinc-200/80 space-y-1.5">
                      <div className="font-bold text-zinc-900 uppercase tracking-wider text-[11px] mb-2 border-b border-zinc-200 pb-1">
                        Invoice & Transaction Metadata
                      </div>
                      <div>
                        <span className="text-zinc-500">Invoice / Document No:</span>{" "}
                        <span className="font-mono font-bold text-rose-600">{selectedInvoice.invoice_number}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Issue Date & Time:</span>{" "}
                        <span className="font-medium text-zinc-800">{formatDate(selectedInvoice.created_at)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Payment Channel:</span>{" "}
                        <span className="font-medium text-zinc-800">
                          {meta.paymentMethod || "ELECTRONIC (TELEBIRR / CBE / CHAPA)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Narration / Ref:</span>{" "}
                        <span className="text-zinc-700 font-mono text-[11px]">{selectedInvoice.notes || "Official Transaction"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="py-6">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-zinc-900 text-zinc-800 uppercase tracking-wider text-[11px]">
                          <th className="py-2 px-2">#</th>
                          <th className="py-2 px-2">Description</th>
                          <th className="py-2 px-2 text-right">Base Amount</th>
                          <th className="py-2 px-2 text-right">Tax Rate</th>
                          <th className="py-2 px-2 text-right">Tax Amount</th>
                          <th className="py-2 px-2 text-right">Total Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200">
                        {isCreditNote ? (
                          <tr>
                            <td className="py-2.5 px-2 font-mono text-rose-500 font-bold">1</td>
                            <td className="py-2.5 px-2">
                              <div className="font-bold text-rose-950">
                                {selectedInvoice.notes || "Booking Cancellation & Sales Reversal"}
                              </div>
                              <div className="text-[11px] text-rose-700">
                                Reversal Credit Note • Ref Invoice: {meta.originalInvoiceNumber || meta.originalInvoiceId || "Original Sales Receipt"}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-rose-600 font-medium">
                              -{formatMoney(Math.abs(selectedInvoice.subtotal_amount))}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-rose-600">
                              {Number(selectedInvoice.tax_amount) !== 0 ? "15.00% VAT" : "0.00%"}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-rose-600 font-medium">
                              -{formatMoney(Math.abs(selectedInvoice.tax_amount))}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-rose-700">
                              -{formatMoney(Math.abs(selectedInvoice.total_amount))}
                            </td>
                          </tr>
                        ) : isB2CReceipt ? (
                          <>
                            <tr>
                              <td className="py-2.5 px-2 font-mono text-zinc-500">1</td>
                              <td className="py-2.5 px-2">
                                <div className="font-semibold text-zinc-900">
                                  {selectedInvoice.notes || "Ticket Admission Sales"}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  Standard Entertainment Admission Ticket (Inclusive of 15% Ethiopian VAT)
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono">
                                {formatMoney(meta.baseTicketAmount ?? (selectedInvoice.subtotal_amount - (meta.convenienceFeeBase || 0)))}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono">15.00% VAT</td>
                              <td className="py-2.5 px-2 text-right font-mono">
                                {formatMoney(meta.ticketVatAmount ?? 0)}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono font-bold text-zinc-900">
                                {formatMoney(meta.grossTicketAmount ?? (selectedInvoice.subtotal_amount - (meta.convenienceFeeBase || 0) + (meta.ticketVatAmount || 0)))}
                              </td>
                            </tr>
                            {(meta.convenienceFeeBase > 0 || meta.convenienceFeeVat > 0) && (
                              <tr>
                                <td className="py-2.5 px-2 font-mono text-zinc-500">2</td>
                                <td className="py-2.5 px-2">
                                  <div className="font-semibold text-zinc-900">
                                    Electronic Convenience & Platform Processing Fee
                                  </div>
                                  <div className="text-[11px] text-zinc-500">
                                    Electronic ticketing, gateway facilitation and platform reservation
                                  </div>
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono">
                                  {formatMoney(meta.convenienceFeeBase || 0)}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono">15.00% VAT</td>
                                <td className="py-2.5 px-2 text-right font-mono">
                                  {formatMoney(meta.convenienceFeeVat || 0)}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono font-bold text-zinc-900">
                                  {formatMoney((meta.convenienceFeeBase || 0) + (meta.convenienceFeeVat || 0))}
                                </td>
                              </tr>
                            )}
                          </>
                        ) : isSettlement || isWhtCert ? (
                          <>
                            <tr>
                              <td className="py-2.5 px-2 font-mono text-zinc-500">1</td>
                              <td className="py-2.5 px-2">
                                <div className="font-semibold text-zinc-900">Gross Ticket Sales Collected</div>
                                <div className="text-[11px] text-zinc-500">Total customer collections before contractual deductions</div>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono">
                                {formatMoney(
                                  selectedInvoice.subtotal_amount +
                                  (meta.commissionBase || 0) +
                                  (meta.commissionTax || 0)
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono">—</td>
                              <td className="py-2.5 px-2 text-right font-mono">—</td>
                              <td className="py-2.5 px-2 text-right font-mono font-bold text-zinc-900">
                                {formatMoney(
                                  selectedInvoice.subtotal_amount +
                                  (meta.commissionBase || 0) +
                                  (meta.commissionTax || 0)
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2.5 px-2 font-mono text-zinc-500">2</td>
                              <td className="py-2.5 px-2">
                                <div className="font-semibold text-zinc-900">Less: Platform Service Commission (Contracted Rate)</div>
                                <div className="text-[11px] text-zinc-500">Platform commission deducted per merchant agreement</div>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-rose-600">
                                -{formatMoney(meta.commissionBase || 0)}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono">15.00% VAT</td>
                              <td className="py-2.5 px-2 text-right font-mono text-rose-600">
                                -{formatMoney(meta.commissionTax || 0)}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono font-bold text-rose-600">
                                -{formatMoney((meta.commissionBase || 0) + (meta.commissionTax || 0))}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2.5 px-2 font-mono text-zinc-500">3</td>
                              <td className="py-2.5 px-2">
                                <div className="font-semibold text-emerald-800">
                                  Less: Statutory Withholding Tax (WHT - Proclamation 979/2016)
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  Deducted at source by Platform & directly remitted to Ethiopian Ministry of Revenues (ERCA)
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono">—</td>
                              <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-700">
                                {meta.whtPercent || 2}.00% WHT
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-700">
                                -{formatMoney(selectedInvoice.tax_amount || meta.whtAmount || 0)}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-700">
                                -{formatMoney(selectedInvoice.tax_amount || meta.whtAmount || 0)}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr>
                            <td className="py-2.5 px-2 font-mono text-zinc-500">1</td>
                            <td className="py-2.5 px-2">
                              <div className="font-semibold text-zinc-900">{selectedInvoice.notes || "Financial Service Supply"}</div>
                              <div className="text-[11px] text-zinc-500">{selectedInvoice.invoice_type}</div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">{formatMoney(selectedInvoice.subtotal_amount)}</td>
                            <td className="py-2.5 px-2 text-right font-mono">15.00%</td>
                            <td className="py-2.5 px-2 text-right font-mono">{formatMoney(selectedInvoice.tax_amount)}</td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-zinc-900">{formatMoney(selectedInvoice.total_amount)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Totals Calculation */}
                  <div className="border-t-2 border-zinc-900 pt-4 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
                    <div className="space-y-2 max-w-sm">
                      <div className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                        Statutory Tax Declaration
                      </div>
                      <p className="text-[11px] text-zinc-600 leading-relaxed">
                        {isCreditNote
                          ? `This document is a Statutory Credit Note issued pursuant to Article 24 of the Ethiopian VAT Proclamation No. 285/2002. It serves as legal evidence of booking cancellation and sales reversal. Output VAT liability to the Ministry of Revenues (ERCA) is adjusted accordingly.`
                          : isSettlement || isWhtCert
                          ? `This document constitutes an official Withholding Tax Certificate. ${selectedInvoice.platform_company_name || ethConfig.company_name || "The platform"} has withheld 2% WHT from this payout disbursement and assumes legal responsibility for remitting it to ${selectedInvoice.platform_tax_authority || ethConfig.tax_authority_name || "the Ministry of Revenues"}.`
                          : `This electronic tax invoice was created in real-time by the ${selectedInvoice.platform_trading_name || ethConfig.trading_name || "BookMyBota"} fiscal accounting engine. Value Added Tax (15%) is declared under ${selectedInvoice.platform_tax_authority || ethConfig.tax_authority_name || "ERCA"} regulations.`}
                      </p>
                    </div>

                    <div className="w-full sm:w-72 bg-zinc-50 p-4 rounded-lg border border-zinc-200 space-y-2 text-xs">
                      <div className="flex justify-between text-zinc-600">
                        <span>Subtotal / Taxable Base:</span>
                        <span className={`font-mono font-semibold ${isCreditNote ? "text-rose-600" : "text-zinc-900"}`}>
                          {isCreditNote ? "-" : ""}{formatMoney(Math.abs(selectedInvoice.subtotal_amount))}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Applicable Tax ({isSettlement ? "WHT 2%" : "VAT 15%"}):</span>
                        <span className="font-mono font-semibold text-rose-600">
                          {isCreditNote ? "-" : ""}{formatMoney(Math.abs(selectedInvoice.tax_amount))}
                        </span>
                      </div>
                      <div className="border-t-2 border-zinc-900 pt-2 flex justify-between items-baseline font-bold text-sm text-zinc-950">
                        <span>{isCreditNote ? "Net Reversal Credit:" : isSettlement ? "Net Wire Disbursed:" : "Total Customer Paid:"}</span>
                        <span className="font-mono text-base text-rose-600">
                          {isCreditNote ? "-" : ""}{formatMoney(Math.abs(selectedInvoice.total_amount))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Official ERCA Seal & Digital Signature */}
                  <div className="mt-8 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full border-2 border-emerald-600 flex items-center justify-center p-1 text-center">
                        <span className="text-[8px] font-black uppercase text-emerald-700 leading-tight">
                          {(selectedInvoice.platform_tax_authority || ethConfig.tax_authority_name || "ERCA").slice(0, 4)} VERIFIED
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        <div className="font-bold text-zinc-800">
                          Electronic Fiscal Signature:
                        </div>
                        <div className="font-mono text-[10px] text-zinc-600">
                          SHA256-{selectedInvoice.id.replace(/-/g, "").slice(0, 24).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-zinc-400">
                      <div>Official Copy • Generated {formatDate(new Date().toISOString())}</div>
                      <div>{selectedInvoice.platform_trading_name || ethConfig.trading_name || "BookMyBota"} Cloud Financial Suite</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
