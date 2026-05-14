import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  DataGrid,
  DataGridColumnHeader,
  DataGridRowSelect,
  DataGridRowSelectAll,
  TDataGridRequestParams,
  useDataGrid,
} from "@/components";
import { Button } from "@/components/ui/button";
import {
  Search,
  ArrowUpFromLine,
  Eye,
  X,
  FileText,
  User,
  CreditCard,
  DollarSign,
  CheckCircle,
  ChevronDown,
  Wallet,
  MoreVertical,
  Edit,
  Trash2,
  Filter,
  Circle,
  Check,
  Calendar,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ColumnDef } from "@tanstack/react-table";
import {
  getPaymentOutList,
  deletePaymentOut,
  getVendorNamesDropdown,
  getPaymentOutNumbersDropdown,
  getVendorInvoices,
  getPaymentOutById,
} from "../services/payment-out.service";
import { toast } from "sonner";
import { SpinnerDotted } from "spinners-react";

export const PaymentOutPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "paid" | "partial">("all");
  const [searchType, setSearchType] = useState<"party_name" | "payment_number">("party_name");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allPartyNames, setAllPartyNames] = useState<string[]>([]);
  const [allPaymentNumbers, setAllPaymentNumbers] = useState<string[]>([]);
  const [isDropdownLoading, setIsDropdownLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(1); // Start with 1 instead of 0
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [vendorInvoices, setVendorInvoices] = useState<any[]>([]);
  const [mobilePayments, setMobilePayments] = useState<any[]>([]);
  const [mobileLoading, setMobileLoading] = useState(false);


  const fetchAutocompleteData = useCallback(async () => {
    setIsDropdownLoading(true);
    try {
      const [partyRes, numRes] = await Promise.all([
        getVendorNamesDropdown(),
        getPaymentOutNumbersDropdown(),
      ]);

      if (partyRes.success && partyRes.data) {
        // Handle party names from payment-out API
        // Response can be data[0] for party names dropdown
        let partyData = partyRes.data;
        if (Array.isArray(partyData) && partyData.length > 0 && Array.isArray(partyData[0])) {
          partyData = partyData[0];
        }
        const partyNames = Array.isArray(partyData)
          ? partyData.filter((name: any) => typeof name === 'string' && name.trim() !== '')
          : [];
        setAllPartyNames(partyNames);
      } else {
        setAllPartyNames([]);
      }
      if (numRes.success && numRes.data) {
        const paymentData = Array.isArray(numRes.data) ? numRes.data : [];
        setAllPaymentNumbers(paymentData.filter(Boolean));
      }
    } catch (error) {
      setAllPartyNames([]);
      setAllPaymentNumbers([]);
    } finally {
      setIsDropdownLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutocompleteData();
  }, [fetchAutocompleteData]);

  const handleSearchTypeChange = (type: "party_name" | "payment_number") => {
    setSearchType(type);
    setShowSuggestions(false);
    setSearchTerm("");
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────────

  const fetchPayments = useCallback(
    async (params: TDataGridRequestParams) => {
      try {
        const response = await getPaymentOutList(
          params.pageIndex + 1,
          params.pageSize,
          selectedStatus === "all" ? "" : selectedStatus,
          searchType === "party_name" ? searchTerm : "",
          searchType === "payment_number" ? searchTerm : "",
          selectedDateFilter,
        );

        if (response.success && response.data) {
          const items = response.data.data ?? [];
          return { data: items, totalCount: response.data.pagination?.total ?? items.length };
        }
        return { data: [], totalCount: 0 };
      } catch (error) {
        return { data: [], totalCount: 0 };
      }
    },
    [selectedStatus, searchTerm, searchType, selectedDateFilter],
  );

  const fetchMobilePayments = useCallback(async () => {
    setMobileLoading(true);
    try {
      const response = await getPaymentOutList(
        1,
        50, // Get more items for mobile scroll
        selectedStatus === "all" ? "" : selectedStatus,
        searchType === "party_name" ? searchTerm : "",
        searchType === "payment_number" ? searchTerm : "",
        selectedDateFilter,
      );

      if (response.success && response.data) {
        const items = response.data.data ?? [];
        // Filter out unpaid entries
        const filteredItems = items.filter((item: any) => item.payment_status !== 'unpaid');
        setMobilePayments(filteredItems);
      } else {
        setMobilePayments([]);
      }
    } catch {
      setMobilePayments([]);
    } finally {
      setMobileLoading(false);
    }
  }, [selectedStatus, searchTerm, searchType, selectedDateFilter]);

  useEffect(() => {
    fetchMobilePayments();
  }, [fetchMobilePayments]);

  // Refresh mobile payments when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      fetchMobilePayments();
    }
  }, [refreshKey]);

  // ── Delete ────────

  const handleDelete = (id: string) => {
    setPaymentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    const idToDelete = paymentToDelete;
    if (!idToDelete) return;

    try {
      const res = await deletePaymentOut(idToDelete);
      if (res.success) {
        toast.success("Payment deleted successfully");
        setRefreshKey((k) => k + 1);
        fetchAutocompleteData();
      } else {
        toast.error(res.error || "Failed to delete payment");
      }
    } catch (err: any) {
      toast.error("An error occurred while deleting the payment");
    } finally {
      setPaymentToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  // ── View Details ────────────────────────────

  const fetchPaymentDetails = async (payment: any) => {
    setModalLoading(true);
    // Use the same payment data from table initially
    setSelectedPayment(payment);
    setVendorInvoices([]);

    try {
      // Only fetch additional details (vendor invoices), not the payment data again
      if (payment.party_name) {
        const res = await getVendorInvoices(payment.party_name);
        if (res.success && res.data) {
          setVendorInvoices((res.data as any[]).filter((inv: any) => inv.invoice_number !== payment.invoice_number));
        }
      }
    } catch (err) {
      // Error handling without console logging
    } finally {
      setModalLoading(false);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    // Delay clearing the data to allow smooth transition
    setTimeout(() => {
      setSelectedPayment(null);
      setVendorInvoices([]);
    }, 300);
  };

  // ── Columns (desktop table only) ─────────

  const columns: ColumnDef<any>[] = [
    {
      id: "select",
      header: () => (
        <div className="flex items-center justify-center w-full h-full">
          <DataGridRowSelectAll />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center w-full h-full">
          <DataGridRowSelect row={row} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { headerClassName: "w-[60px] p-0", cellClassName: "text-center p-0" },
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <DataGridColumnHeader title="Date" column={column} className="justify-center" />
      ),
      cell: (info) => (
        <div className="text-sm text-gray-900 dark:text-zinc-100 text-center">
          {new Date(info.getValue() as string).toLocaleDateString()}
        </div>
      ),
    },
    {
      accessorKey: "payment_number",
      header: ({ column }) => (
        <DataGridColumnHeader title="Payment Number" column={column} className="justify-center" />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-primary text-center text-blue-600 hover:underline ">
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: "party_name",
      header: ({ column }) => (
        <DataGridColumnHeader title="Vendor Name" column={column} className="justify-center" />
      ),
      cell: (info) => (
        <div className="text-sm text-gray-900 dark:text-zinc-100 text-center">{info.getValue() as string}</div>
      ),
    },
    {
      accessorKey: "invoice_number",
      header: ({ column }) => (
        <DataGridColumnHeader title="Invoice No." column={column} className="justify-center" />
      ),
      cell: (info) => (
        <div className="text-sm text-gray-500 dark:text-zinc-400 text-center">{info.getValue() as string}</div>
      ),
    },
    {
      accessorKey: "total_amount",
      header: ({ column }) => (
        <DataGridColumnHeader title="Total Amount" column={column} className="justify-center" />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-center dark:text-zinc-100">
          ₹{(info.getValue() as number)?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "0.00"}
        </div>
      ),
    },
    {
      accessorKey: "amount_paid",
      header: ({ column }) => (
        <DataGridColumnHeader title="Amount Paid" column={column} className="justify-center" />
      ),
      cell: (info) => {
        const amount = info.getValue() as number;
        const row = info.row.original;
        const discount = row.payment_discount ?? 0;

        return (
          <div className="text-sm font-medium text-center dark:text-zinc-100">
            <div>₹{amount?.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}</div>
            {discount > 0 && (
              <div className="text-xs text-red-500 dark:text-red-400">
                - ₹{discount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} discount
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "payment_mode",
      header: ({ column }) => (
        <DataGridColumnHeader title="Payment Mode" column={column} className="justify-center" />
      ),
      cell: (info) => {
        const row = info.row.original;
        const mode = info.getValue() as string;
        const discount = row.payment_discount ?? 0;
        return (
          <div className="text-sm text-gray-900 dark:text-zinc-100 text-center flex items-center justify-center gap-1">
            <Wallet className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
            {discount > 0 ? `${mode} + discount` : mode}
          </div>
        );
      },
    },
    {
      accessorKey: "payment_status",
      header: ({ column }) => (
        <DataGridColumnHeader title="Status" column={column} className="justify-center" />
      ),
      cell: (info) => {
        const [isOpen, setIsOpen] = useState(false);
        const row = info.row.original;
        const status = row.payment_status;
        const color =
          status === "paid"
            ? "text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-500 dark:border-green-800"
            : status === "partial"
              ? "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 dark:text-yellow-500 dark:border-yellow-800"
              : status === "unpaid"
                ? "text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-500 dark:border-red-800"
                : "text-gray-600 bg-gray-50 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
        const isUnpaid = status === "unpaid";
        return (
          <div className="flex justify-center">
            <div className="relative">
              {isUnpaid && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse z-10" />
              )}
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${color}`}>
                {status}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: () => (
        <div className="flex items-center justify-center w-full h-full">
          <span className="text-xs font-semibold text-gray-500 dark:text-zinc-500 uppercase tracking-wide">Actions</span>
        </div>
      ),
      cell: ({ row }) => {
        const [isOpen, setIsOpen] = useState(false);
        return (
          <div className="flex justify-center">
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  data-dropdown-trigger="true"
                  className="flex items-center justify-center text-sm text-primary hover:text-primary-active"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/payment-out/${row.original.id?.toString() ?? row.original.payment_number}`);
                    setIsOpen(false);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/payment-out/${row.original.id?.toString() ?? row.original.payment_number}`);
                    setIsOpen(false);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(row.original.id?.toString() ?? row.original.payment_number);
                    setIsOpen(false);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-red-500">Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // ── Mobile Card Row ───────────

  const MobilePaymentCard = ({ row }: { row: any }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Handle both direct data and wrapped row data
    const rowData = row.original || row;
    const status = rowData.payment_status;
    const statusColor =
      status === "paid"
        ? "text-green-700 bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800"
        : status === "partial"
          ? "text-yellow-700 bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800"
          : status === "unpaid"
            ? "text-red-700 bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
            : "text-gray-700 bg-gray-100 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
    const discount = rowData.payment_discount ?? 0;

    return (
      <div
        className="px-3 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-900/80 active:bg-gray-100 dark:active:bg-zinc-900/40 transition-colors border-b border-gray-100 dark:border-gray-100/10 last:border-b-0"
        onClick={() => !isOpen && fetchPaymentDetails(rowData)}
      >
        {/* Headers */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Date & Ref</div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">Vendor</div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide text-center">Amount</div>
        </div>

        {/* Content row */}
        <div className="grid grid-cols-3 gap-2 items-start">
          {/* Left: date + number + invoice */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-gray-400 shrink-0">
                {new Date(rowData.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
              </span>
              <span className="text-xs font-semibold text-blue-600 truncate">{rowData.payment_number}</span>
            </div>
            {rowData.invoice_number && (
              <span className="text-[10px] text-gray-400 block">{rowData.invoice_number}</span>
            )}
          </div>

          {/* Center: vendor name */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <User className="h-3 w-3 text-gray-300 shrink-0" />
              <span className="text-xs font-medium text-gray-700 truncate">{rowData.party_name}</span>
            </div>
          </div>

          {/* Right: amounts + status */}
          <div className="text-right space-y-1">
            <div>
              <p className="text-xs font-semibold text-gray-900">
                ₹{rowData.amount_paid?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              {discount > 0 ? (
                <p className="text-[10px] text-red-400">-₹{discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              ) : (
                <p className="text-[10px] text-gray-400">
                  of ₹{rowData.total_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center justify-start gap-1 text-left">
                <div className="relative">
                  {status === "unpaid" && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse z-10" />
                  )}
                  <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded leading-tight ${statusColor}`}>
                    {status}
                  </span>
                </div>
              </div>
              <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    data-dropdown-trigger="true"
                    className="flex items-center justify-center text-sm text-primary hover:text-primary-active"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      fetchPaymentDetails(row.original);
                      setIsOpen(false);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/payment-out/${row.original.id?.toString() ?? row.original.payment_number}`);
                      setIsOpen(false);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(row.original.id?.toString() ?? row.original.payment_number);
                      setIsOpen(false);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                    <span className="text-red-500">Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Mobile Payment List ───────────

  const MobilePaymentList = () => {
    if (mobileLoading) {
      return (
        <div className="flex justify-center items-center py-8">
          <SpinnerDotted size={30} color="#3B82F6" />
        </div>
      );
    }

    if (mobilePayments.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <div className="text-sm">
            {searchTerm && searchType === 'party_name'
              ? `No payment records found for party "${searchTerm}"`
              : searchTerm && searchType === 'payment_number'
                ? `No payment records found for number "${searchTerm}"`
                : "No payment records found"}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3 px-1">
        {mobilePayments.map((payment) => (
          <MobilePaymentCard key={payment.id || payment.payment_number} row={payment} />
        ))}
      </div>
    );
  };

  // ── Render ──────────────

  return (
    <div className="w-full px-3 py-4 sm:px-4 sm:py-6 relative min-w-0 overflow-x-hidden">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 mb-4">
        {/* Title and Filters row - same line for desktop */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 shadow-sm border border-blue-200/50 dark:border-blue-500/20">
              <ArrowUpFromLine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Payment Out</h1>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400 hidden sm:block font-medium">Outgoing payments to vendors</p>
            </div>
          </div>

          {/* Filters and Create button - same line for desktop */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Floating Glass Status Filter */}
            <div className="relative bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-md p-1 rounded-xl border border-gray-200/80 dark:border-zinc-800 shadow-sm flex items-center min-w-fit">
              {/* Integrated Label */}
              <div className="flex items-center gap-2 px-3 border-r border-gray-200/50 dark:border-gray-100/10 mr-1">
                <Filter className="h-3.5 w-3.5 text-gray-900 dark:text-zinc-400" />
                <span className="text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">Filters</span>
              </div>

              <div className="relative flex items-center">
                {/* Animated Slider Background with Glow */}
                <div
                  className={`absolute inset-y-0 rounded-lg border shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${selectedStatus === 'all' ? 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 shadow-gray-200/50 dark:shadow-none' :
                    selectedStatus === 'paid' ? 'bg-green-50 dark:bg-green-500/20 border-green-200 dark:border-green-500/50 shadow-green-200/50 dark:shadow-none' :
                      'bg-yellow-50 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/50 shadow-yellow-200/50 dark:shadow-none'
                    }`}
                  style={{
                    width: '90px',
                    transform: `translateX(${selectedStatus === 'all' ? '0px' :
                      selectedStatus === 'paid' ? '90px' : '180px'
                      })`
                  }}
                />

                {/* Status Buttons */}
                <button
                  onClick={() => {
                    setSelectedStatus('all');
                    setRefreshKey(prev => prev + 1);
                  }}
                  className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'all' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setSelectedStatus('paid');
                    setRefreshKey(prev => prev + 1);
                  }}
                  className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'paid' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
                >
                  Done
                </button>
                <button
                  onClick={() => {
                    setSelectedStatus('partial');
                    setRefreshKey(prev => prev + 1);
                  }}
                  className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'partial' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
                >
                  Partial
                </button>
              </div>
            </div>

            {/* Date Filter Dropdown */}
            <div className="w-full sm:w-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-full md:w-fit px-4 gap-2 bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-zinc-800 shadow-sm text-gray-900 dark:text-white font-bold hover:bg-gray-100/50 dark:hover:bg-zinc-800 transition-all"
                  >
                    <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="truncate">
                      {selectedDateFilter === "all" ? "All Dates"
                        : selectedDateFilter === "today" ? "Today"
                          : selectedDateFilter === "this_week" ? "This Week"
                            : selectedDateFilter === "last_week" ? "Last Week"
                              : selectedDateFilter === "this_month" ? "This Month"
                                : selectedDateFilter === "last_month" ? "Last Month"
                                  : "Last 365 Days"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px] bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                  {[
                    { val: "all", label: "All Dates" },
                    { val: "today", label: "Today" },
                    { val: "this_week", label: "This Week" },
                    { val: "last_week", label: "Last Week" },
                    { val: "this_month", label: "This Month" },
                    { val: "last_month", label: "Last Month" },
                    { val: "last_365_days", label: "Last 365 Days" },
                  ].map(({ val, label }) => (
                    <DropdownMenuItem key={val} onClick={() => setSelectedDateFilter(val)} className="flex items-center gap-2 text-sm text-gray-700 dark:text-zinc-300">
                      <Calendar className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
                      <span>{label}</span>
                      {selectedDateFilter === val && <Check className="h-3.5 w-3.5 ml-auto text-blue-600 dark:text-blue-400" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex-grow md:block hidden" />

          </div>
        </div>
      </div>

      {/* ── Main Card ── */}
      <div className="bg-white/80 dark:bg-zinc-950 backdrop-blur-md border border-gray-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-100/50 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/20">
          <div className="flex items-center gap-3">
            {/* Vendor / Payment selector */}
            <div className="relative flex-1 max-w-xs">
              <DropdownMenu open={showSuggestions} onOpenChange={setShowSuggestions}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-start px-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-xl border-gray-200 dark:border-zinc-800 shadow-sm text-gray-900 dark:text-zinc-100 font-medium hover:bg-white dark:hover:bg-zinc-900 transition-all"
                    disabled={isDropdownLoading}
                  >
                    <Search className="h-4 w-4 mr-2 text-gray-400 dark:text-zinc-500" />
                    {isDropdownLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      <span className="truncate">
                        {searchTerm || (searchType === "party_name" ? "Select Vendor..." : "Select Payment #...")}
                      </span>
                    )}
                    {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-48 overflow-y-auto rounded-xl shadow-xl bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                  <DropdownMenuItem
                    onClick={() => { setSearchTerm(""); setRefreshKey((k) => k + 1); }}
                    className="text-gray-500 dark:text-zinc-500 italic"
                  >
                    Clear search
                  </DropdownMenuItem>
                  {(searchType === "party_name" ? allPartyNames : allPaymentNumbers).length === 0 ? (
                    <DropdownMenuItem disabled>
                      <span className="text-[11px] text-gray-400 dark:text-zinc-500">No {searchType === "party_name" ? "vendors" : "payments"} found</span>
                    </DropdownMenuItem>
                  ) : (
                    (searchType === "party_name" ? allPartyNames : allPaymentNumbers).map((item, idx) => (
                      <DropdownMenuItem
                        key={idx}
                        onClick={() => { setSearchTerm(item); setRefreshKey((k) => k + 1); }}
                        className={`text-[11px] py-2 px-3 rounded-lg mx-1 my-0.5 transition-colors ${searchTerm === item ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900"}`}
                      >
                        {item}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop Segmented Filter Type */}
            <div className="hidden sm:flex relative p-1 bg-gray-100 dark:bg-zinc-900 rounded-lg border border-gray-200/60 dark:border-zinc-800 shadow-inner w-fit h-10 items-center">
              <div
                className={`absolute inset-y-1 rounded-md border shadow-sm transition-all duration-300 ease-out ${searchType === "party_name" ? 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50'
                  }`}
                style={{
                  width: '120px',
                  transform: `translateX(${searchType === "party_name" ? '0px' : '120px'})`
                }}
              />
              <button
                onClick={() => handleSearchTypeChange("party_name")}
                className={`relative w-[120px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === "party_name" ? 'text-blue-700 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                Vendor Name
              </button>
              <button
                onClick={() => handleSearchTypeChange("payment_number")}
                className={`relative w-[120px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === "payment_number" ? 'text-blue-700 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                Payment No.
              </button>
            </div>

            {/* Mobile Dropdown Fallback */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl px-4 text-sm font-bold text-gray-900 dark:text-white bg-white dark:bg-zinc-900 shadow-sm border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 gap-2"
                  >
                    <Filter className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    {searchType === "party_name" ? "Vendor Name" : "Payment Number"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 rounded-xl shadow-xl bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                  <DropdownMenuItem
                    onClick={() => handleSearchTypeChange("party_name")}
                    className="text-gray-700 dark:text-zinc-300"
                  >
                    <User className="h-4 w-4 mr-2 text-gray-400 dark:text-zinc-500" /> Vendor Name
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSearchTypeChange("payment_number")}
                    className="text-gray-700 dark:text-zinc-300"
                  >
                    <FileText className="h-4 w-4 mr-2 text-gray-400 dark:text-zinc-500" /> Payment Number
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Create button */}
            <div className="w-full sm:w-auto sm:ml-auto">
              <button
                className="group flex items-center gap-2 px-5 h-10 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-800 transition-all active:scale-95 w-full sm:w-auto"
                onClick={() => navigate("/payment-out/create")}
              >
                <Plus className="size-4 text-blue-500 dark:text-blue-400 group-hover:rotate-90 transition-transform" />
                <span className="whitespace-nowrap captialize tracking-wider">Create Payment Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Responsive Table / Card List ── */}
        {/*
          On screens ≤991px  → card list (no horizontal scroll)
          On screens >991px  → full DataGrid table
          We use inline style media query via a wrapper + Tailwind.
          Since Tailwind's lg breakpoint is 1024px, we use a custom wrapper.
        */}
        <div className="block">
          {/* Mobile card list: visible below 992px */}
          <div className="lg:hidden">
            <MobilePaymentList />
          </div>

          {/* Desktop table: visible ≥992px */}
          <div className="hidden lg:block overflow-hidden">
            <DataGrid
              key={`${refreshKey}-${selectedStatus}-${searchTerm}-${searchType}-${selectedDateFilter}`}
              columns={columns}
              onFetchData={fetchPayments}
              serverSide={true}
              getRowId={(row: any) => row?.original?.id?.toString() ?? row?.original?.payment_number ?? Math.random().toString()}
              pagination={{
                size: 10
              }}
              rowSelection={true}
              messages={{
                empty: searchTerm && searchType === 'party_name'
                  ? `No payment records found for party "${searchTerm}"`
                  : searchTerm && searchType === 'payment_number'
                    ? `No payment records found for number "${searchTerm}"`
                    : "No payment records found"
              }}
              onRowClick={(row) => {
                fetchPaymentDetails(row.original);
              }}
              layout={{
                card: true,
                classes: {
                  table: "cursor-pointer [&_tr:hover]:bg-gray-50 dark:[&_tr:hover]:bg-zinc-900/80 [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-gray-500 dark:[&_th]:text-zinc-500",
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Payment Details Modal ── */}
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 md:p-8 transition-all duration-500 ease-out ${isModalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={closeModal}
      >
        <div
          className={`bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full sm:max-w-4xl max-h-[70vh] sm:max-h-[65vh] overflow-hidden flex flex-col transform transition-all duration-500 ease-out border border-gray-200 dark:border-zinc-800 ${isModalOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
            }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 sm:px-8 sm:p-6 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-500/20">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">Payment Out Details</h3>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-zinc-400">Transaction summary</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={closeModal} className="rounded-full h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="px-6 py-3 pb-6 sm:px-8 sm:py-6 sm:pb-8 overflow-y-auto flex-1">
            {selectedPayment && (
              <div className="space-y-4 sm:space-y-6">
                {/* Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                  {/* Row 1 - Vendor, Mode, Status */}
                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-800">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500 dark:text-orange-400" />
                      <span className="text-xs sm:text-sm font-medium text-orange-700 dark:text-orange-300">Vendor</span>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-right max-w-[50%] sm:max-w-[55%] truncate text-orange-900 dark:text-orange-100">{selectedPayment.party_name}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500 dark:text-indigo-400" />
                      <span className="text-xs sm:text-sm font-medium text-indigo-700 dark:text-indigo-300">Mode</span>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-right max-w-[50%] sm:max-w-[55%] truncate text-indigo-900 dark:text-indigo-100">{selectedPayment.payment_mode}</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 dark:text-emerald-400" />
                      <span className="text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300">Status</span>
                    </div>
                    <span className={`text-xs sm:text-sm font-semibold ${selectedPayment?.payment_status === 'paid' ? 'text-green-900 dark:text-green-400' :
                      selectedPayment?.payment_status === 'partial' ? 'text-yellow-900 dark:text-yellow-400' :
                        selectedPayment?.payment_status === 'unpaid' ? 'text-red-900 dark:text-red-400' :
                          'text-gray-900 dark:text-zinc-100'
                      }`}>
                      {selectedPayment?.payment_status || 'No Status'}
                    </span>
                  </div>

                  {/* Row 2 - Date, Ref No, Total Amount */}
                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 dark:text-blue-400" />
                      <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">Date</span>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-blue-900 dark:text-blue-100">
                      {new Date(selectedPayment.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500 dark:text-purple-400" />
                      <span className="text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-300">Ref No.</span>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-purple-900 dark:text-purple-100">
                      #{selectedPayment.payment_number}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                      <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 dark:text-blue-400" />
                      <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">Total Amount</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-blue-900 dark:text-blue-100">
                      ₹{selectedPayment.total_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
                  <div className="bg-gray-50 dark:bg-zinc-900/50 px-3 py-2 sm:px-4 border-b border-gray-100 dark:border-zinc-800">
                    <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-widest">Financial Summary</p>
                  </div>
                  <div className="p-3 sm:p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    <div className="flex flex-col items-center justify-between min-h-[70px] sm:min-h-[80px]">
                      <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-zinc-500">Amount Paid</p>
                      <p className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-tight">
                        ₹{selectedPayment.amount_paid?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-between min-h-[70px] sm:min-h-[80px]">
                      <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-zinc-500">Discount</p>
                      <p className="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400 leading-tight">
                        ₹{(selectedPayment.discount || selectedPayment.payment_discount || 0)?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-between min-h-[70px] sm:min-h-[80px]">
                      <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-zinc-500">Balance Due</p>
                      <p className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-500 leading-tight">
                        ₹{(selectedPayment.balance_due || (selectedPayment.total_amount || 0) - (selectedPayment.amount_paid || 0) - (selectedPayment.discount || selectedPayment.payment_discount || 0))?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="flex flex-col items-center justify-between min-h-[70px] sm:min-h-[80px]">
                      <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-zinc-500">Settled Against</p>
                      <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-zinc-300 leading-tight text-center">
                        {selectedPayment.invoice_number ? `Inv #${selectedPayment.invoice_number}` : "Manual Entry"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedPayment.notes && (
                  <div className="p-3 sm:p-4 rounded-lg bg-yellow-50/50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-800">
                    <p className="text-[10px] sm:text-xs font-semibold text-yellow-800 dark:text-yellow-400 uppercase mb-2">Internal Notes</p>
                    <p className="text-xs sm:text-sm text-yellow-900 dark:text-yellow-100 leading-relaxed italic">"{selectedPayment.notes}"</p>
                  </div>
                )}

                {/* Related Invoices */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] sm:text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-tight">
                      Vendor's Other Pending Invoices
                    </h4>
                    <span className="text-[10px] sm:text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-full animate-pulse">Pending records</span>
                  </div>

                  {vendorInvoices.length > 0 ? (
                    <div className="rounded-lg border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                      {/* Scrollable only inside modal on mobile */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm min-w-[350px] sm:min-w-[400px]">
                          <thead className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-800">
                            <tr>
                              <th className="px-2 sm:px-3 py-2 font-medium text-gray-500 dark:text-zinc-500 text-[10px] sm:text-xs align-middle">Date</th>
                              <th className="px-2 sm:px-3 py-2 font-medium text-gray-500 dark:text-zinc-500 text-[10px] sm:text-xs align-middle">Status</th>
                              <th className="px-2 sm:px-3 py-2 font-medium text-gray-500 dark:text-zinc-500 text-[10px] sm:text-xs align-middle">Invoice #</th>
                              <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 dark:text-zinc-500 text-[10px] sm:text-xs align-middle">Total</th>
                              <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 dark:text-zinc-500 text-[10px] sm:text-xs align-middle">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                            {vendorInvoices.slice(0, 5).map((inv) => (
                              <tr key={inv.id} className="hover:bg-gray-50/80 dark:hover:bg-zinc-900/50 transition-colors">
                                <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs text-gray-600 dark:text-zinc-400 align-middle">
                                  {new Date(inv.date).toLocaleDateString()}
                                </td>
                                <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-center align-middle">
                                  <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">
                                    {inv.payment_status}
                                  </span>
                                </td>
                                <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs font-medium text-blue-600 dark:text-blue-400 align-middle">#{inv.invoice_number}</td>
                                <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-[10px] sm:text-xs text-gray-900 dark:text-zinc-100 align-middle">
                                  ₹{inv.invoice_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-[10px] sm:text-xs font-semibold text-amber-700 dark:text-amber-500 align-middle">
                                  ₹{inv.balance_due?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 sm:py-8 border-2 border-dashed border-gray-100 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center text-gray-400 dark:text-zinc-600 bg-gray-50/30 dark:bg-zinc-900/20">
                      <Search className="h-6 w-6 sm:h-7 sm:w-7 mb-2 opacity-20" />
                      <p className="text-[10px] sm:text-xs">No other pending invoices for this vendor</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-12 py-3 sm:px-16 sm:py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 flex justify-end gap-3 sm:gap-4">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800" onClick={closeModal}>Close</Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95"
              onClick={() => {
                if (selectedPayment) {
                  navigate(`/payment-out/${selectedPayment.id}`);
                  closeModal();
                }
              }}
            >
              <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
              <span className="hidden sm:inline">Edit Transaction</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentToDelete(null);
            setDeleteDialogOpen(false);
          }
        }}
        title="Delete Payment"
        message="Are you sure you want to delete this payment record? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setPaymentToDelete(null);
          setDeleteDialogOpen(false);
        }}
        variant="danger"
      />
    </div>
  );
};

export default PaymentOutPage;
