"use client";

import React from "react";
import FinancialSuite from "@/components/Accounting/FinancialSuite";

export default function CinemaAccountingPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <FinancialSuite
        isSuperadmin={false}
        panelTitle="Cinema Accounting, Ledger & Tax Compliance"
      />
    </div>
  );
}
