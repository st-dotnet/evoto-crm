import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DataGrid,
  DataGridColumnHeader,
} from "@/components";
import { ArrowDown, Search, ArrowRightLeft } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { getLatestTransactions, type Transaction } from "@/services/dashboard.service";
import { SpinnerDotted } from "spinners-react";

const TYPE_BADGE_MAP: Record<string, string> = {
  'Sales Invoices': 'badge-success',
  'Payment In': 'badge-success',
  'Add Money': 'badge-info',
  'Purchase Invoices': 'badge-warning',
  'Purchase Orders': 'badge-primary',
  'Payment Out': 'badge-danger',
  'Quotation / Estimate': 'badge-info',
  'Credit Note': 'badge-danger',
  'Debit Note': 'badge-success',
};

const formatINR = (value: number): string => {
  return `₹ ${value.toLocaleString("en-IN")}`;
};

export const TransactionsPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      // Fetch a larger limit for the full page
      const res = await getLatestTransactions(1000);
      if (res.success && res.data) {
        setTransactions(res.data);
      }
      setIsLoading(false);
    };

    fetchInitialData();
  }, []);

  const columns: ColumnDef<Transaction>[] = [
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataGridColumnHeader title="Date" column={column} className="justify-start" />
      ),
      cell: (info) => {
        const dateStr = info.getValue() as string;
        return (
          <div className="text-sm text-gray-900">
            {dateStr ? new Date(dateStr).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataGridColumnHeader title="Type" column={column} className="justify-start" />
      ),
      cell: (info) => {
        const type = info.getValue() as string;
        const badgeClass = TYPE_BADGE_MAP[type] || 'badge-light';
        return (
          <div className="flex justify-start">
            <span className={`badge badge-sm ${badgeClass} badge-outline`}>
              {type}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "txn_no",
      header: ({ column }) => (
        <DataGridColumnHeader title="Txn No" column={column} className="justify-start" />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-gray-800">
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: "party_name",
      header: ({ column }) => (
        <DataGridColumnHeader title="Party Name" column={column} className="justify-start" />
      ),
      cell: (info) => (
        <div className="text-sm text-gray-900 font-medium">
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <DataGridColumnHeader title="Amount" column={column} className="justify-end" />
      ),
      cell: (info) => (
        <div className="text-sm font-semibold text-gray-900 text-end w-full">
          {formatINR(info.getValue() as number)}
        </div>
      ),
    },
  ];

  return (
    <div className="w-full px-4 py-6 sm:p-6 relative overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold">All Transactions</h1>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        {isLoading && transactions.length === 0 ? (
          <div className="flex justify-center items-center py-20">
            <SpinnerDotted size={40} color="#2563EB" />
          </div>
        ) : (
          <>
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

            {/* Mobile View */}
            <div className="flex flex-col lg:hidden border-t border-gray-100">
              {transactions.map((txn: Transaction, index: number) => (
                <div
                  key={index}
                  className={`flex justify-between items-center py-4 px-5 border-b border-gray-100 last:border-b-0 ${txn.route_path ? 'cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors' : ''}`}
                  onClick={() => txn.route_path && navigate(txn.route_path)}
                >
                  <div className="flex flex-col grow pr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-800 text-sm">{txn.txn_no}</span>
                      <span className="text-[11px] text-gray-400 font-medium">
                        {txn.date ? new Date(txn.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-700 mb-1">{txn.party_name}</span>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`badge badge-sm ${TYPE_BADGE_MAP[txn.type] || 'badge-light'} badge-outline`}>
                        {txn.type}
                      </span>
                      <span className="font-bold text-gray-900 text-sm">
                        {formatINR(txn.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && !isLoading && (
                <div className="p-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="text-3xl text-gray-200" />
                    <span className="text-gray-400 text-sm font-medium">No transactions found.</span>
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
