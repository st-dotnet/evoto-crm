import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DataGrid,
  DataGridColumnHeader,
} from "@/components";
import { Search, ArrowRightLeft } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { getLatestTransactions, type Transaction } from "@/services/dashboard.service";
import { SpinnerDotted } from "spinners-react";

const TYPE_BADGE_MAP: Record<string, { bg: string; text: string; border: string }> = {
  'Sales Invoices':      { bg: 'bg-emerald-500/15', text: 'text-emerald-400',  border: 'border-emerald-500/30' },
  'Payment In':          { bg: 'bg-emerald-500/15', text: 'text-emerald-400',  border: 'border-emerald-500/30' },
  'Add Money':           { bg: 'bg-sky-500/15',     text: 'text-sky-400',      border: 'border-sky-500/30'     },
  'Purchase Invoices':   { bg: 'bg-amber-500/15',   text: 'text-amber-400',    border: 'border-amber-500/30'   },
  'Purchase Orders':     { bg: 'bg-blue-500/15',    text: 'text-blue-400',     border: 'border-blue-500/30'    },
  'Payment Out':         { bg: 'bg-rose-500/15',    text: 'text-rose-400',     border: 'border-rose-500/30'    },
  'Quotation / Estimate':{ bg: 'bg-sky-500/15',     text: 'text-sky-400',      border: 'border-sky-500/30'     },
  'Credit Note':         { bg: 'bg-rose-500/15',    text: 'text-rose-400',     border: 'border-rose-500/30'    },
  'Debit Note':          { bg: 'bg-emerald-500/15', text: 'text-emerald-400',  border: 'border-emerald-500/30' },
};

const DEFAULT_BADGE = { bg: 'bg-zinc-700/50', text: 'text-zinc-400', border: 'border-zinc-600/50' };

const formatINR = (value: number): string =>
  `₹ ${value.toLocaleString("en-IN")}`;

export const TransactionsPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      const res = await getLatestTransactions(1000);
      if (res.success && res.data) setTransactions(res.data);
      setIsLoading(false);
    };
    fetchInitialData();
  }, []);

  const columns: ColumnDef<Transaction>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataGridColumnHeader title="Date" column={column} className="justify-start text-zinc-400" />
      ),
      cell: (info) => {
        const dateStr = info.getValue() as string;
        return (
          <div className="text-sm text-zinc-300">
            {dateStr
              ? new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
              : "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataGridColumnHeader title="Type" column={column} className="justify-start text-zinc-400" />
      ),
      cell: (info) => {
        const type = info.getValue() as string;
        const badge = TYPE_BADGE_MAP[type] ?? DEFAULT_BADGE;
        return (
          <div className="flex justify-start">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border
                ${badge.bg} ${badge.text} ${badge.border}`}
            >
              {type}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "txn_no",
      header: ({ column }) => (
        <DataGridColumnHeader title="Txn No" column={column} className="justify-start text-zinc-400" />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-zinc-200">
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: "party_name",
      header: ({ column }) => (
        <DataGridColumnHeader title="Party Name" column={column} className="justify-start text-zinc-400" />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-zinc-200">
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <DataGridColumnHeader title="Amount" column={column} className="justify-end text-zinc-400" />
      ),
      cell: (info) => (
        <div className="text-sm font-semibold text-zinc-100 text-end w-full">
          {formatINR(info.getValue() as number)}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full px-4 py-6 sm:p-6 relative overflow-x-hidden bg-zinc-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <ArrowRightLeft className="h-5 w-5 text-blue-400" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">All Transactions</h1>
        </div>
      </div>

      {/* Table container */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden
                      [&_table]:bg-zinc-900
                      [&_thead_tr]:bg-zinc-800/80
                      [&_thead_th]:text-zinc-400 [&_thead_th]:border-zinc-800
                      [&_tbody_tr]:border-zinc-800 [&_tbody_tr]:bg-zinc-900
                      [&_tbody_tr:hover]:bg-zinc-800/60
                      [&_td]:border-zinc-800 [&_td]:text-zinc-300
                      [&_.pagination-bar]:bg-zinc-900 [&_.pagination-bar]:border-zinc-800
                      [&_.pagination-bar_*]:text-zinc-400
                      [&_[data-slot=select-trigger]]:bg-zinc-800 [&_[data-slot=select-trigger]]:border-zinc-700
                      [&_[data-slot=select-trigger]]:text-zinc-300">

        {isLoading && transactions.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <SpinnerDotted size={40} color="#60a5fa" />
          </div>
        ) : (
          <>
            {/* Desktop DataGrid */}
            <div className="hidden lg:block">
              <DataGrid
                columns={columns}
                data={transactions}
                rowSelection={false}
                pagination={{ size: 10 }}
                layout={{ card: false }}
                onRowClick={(row) => {
                  const r = row.original as Transaction;
                  if (r.route_path) navigate(r.route_path);
                }}
              />
            </div>

            {/* Mobile list */}
            <div className="flex flex-col lg:hidden divide-y divide-zinc-800">
              {transactions.map((txn, index) => {
                const badge = TYPE_BADGE_MAP[txn.type] ?? DEFAULT_BADGE;
                return (
                  <div
                    key={index}
                    className={`flex justify-between items-center py-4 px-5
                      ${txn.route_path ? "cursor-pointer hover:bg-zinc-800/60 active:bg-zinc-800 transition-colors" : ""}`}
                    onClick={() => txn.route_path && navigate(txn.route_path)}
                  >
                    <div className="flex flex-col grow pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-zinc-100 text-sm">{txn.txn_no}</span>
                        <span className="text-[11px] text-zinc-500 font-medium">
                          {txn.date
                            ? new Date(txn.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : "-"}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-zinc-300 mb-2">{txn.party_name}</span>
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border
                            ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {txn.type}
                        </span>
                        <span className="font-bold text-zinc-100 text-sm">
                          {formatINR(txn.amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {transactions.length === 0 && !isLoading && (
                <div className="p-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Search className="h-6 w-6 text-zinc-600" />
                    </div>
                    <span className="text-zinc-500 text-sm font-medium">No transactions found.</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};