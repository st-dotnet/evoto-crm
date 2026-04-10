import React, { useState, useEffect, useCallback } from "react";
import { ScreenLoader } from "@/components/loaders";
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
        <div className="text-sm text-gray-900 text-center">
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
        <div className="text-sm text-gray-900 text-center">{info.getValue() as string}</div>
      ),
    },
    {
      accessorKey: "invoice_number",
      header: ({ column }) => (
        <DataGridColumnHeader title="Invoice No." column={column} className="justify-center" />
      ),
      cell: (info) => (
        <div className="text-sm text-gray-500 text-center">{info.getValue() as string}</div>
      ),
    },
    {
      accessorKey: "total_amount",
      header: ({ column }) => (
        <DataGridColumnHeader title="Total Amount" column={column} className="justify-center" />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-center">
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
          <div className="text-sm font-medium text-center">
            <div>₹{amount?.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}</div>
            {discount > 0 && (
              <div className="text-xs text-red-500">
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
          <div className="text-sm text-gray-900 text-center flex items-center justify-center gap-1">
            <Wallet className="h-3.5 w-3.5 text-gray-400" />
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
            ? "text-green-600 bg-green-50"
            : status === "partial"
            ? "text-yellow-600 bg-yellow-50"
            : status === "unpaid"
            ? "text-red-600 bg-red-50"
            : "text-gray-600 bg-gray-50";
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
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</span>
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
              <DropdownMenuContent align="end">
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
        ? "text-green-700 bg-green-100"
        : status === "partial"
        ? "text-yellow-700 bg-yellow-100"
        : status === "unpaid"
        ? "text-red-700 bg-red-100"
        : "text-gray-700 bg-gray-100";
    const discount = rowData.payment_discount ?? 0;

    return (
      <div
        className="px-3 py-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0"
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
                <DropdownMenuContent align="end">
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
      return <ScreenLoader />;
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
            <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <ArrowUpFromLine className="h-4 w-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 leading-tight">Payment Out</h1>
              <p className="text-xs text-gray-400 hidden sm:block">Outgoing payments to vendors</p>
            </div>
          </div>
          
          {/* Filters and Create button - same line for desktop */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-2 w-[140px] sm:w-[160px] justify-between">
                  <div className="flex items-center gap-1 overflow-hidden">
                    <Filter className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {selectedStatus === "all" ? "All Payments" : selectedStatus === "paid" ? "Done" : "Partial"}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                {(["all", "paid", "partial"] as const).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => setSelectedStatus(s)} className="flex items-center gap-2 text-sm">
                    <Circle className={`h-3.5 w-3.5 ${s === "all" ? "text-gray-400" : s === "paid" ? "text-emerald-500" : "text-amber-500"}`} />
                    <span className="capitalize">{s === "all" ? "All Payments" : s === "paid" ? "Done Payments" : "Partial"}</span>
                    {selectedStatus === s && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Date Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-2 w-[140px] sm:w-[160px] justify-between">
                  <div className="flex items-center gap-1 overflow-hidden">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {selectedDateFilter === "all" ? "All Dates"
                        : selectedDateFilter === "today" ? "Today"
                        : selectedDateFilter === "this_week" ? "This Week"
                        : selectedDateFilter === "last_week" ? "Last Week"
                        : selectedDateFilter === "this_month" ? "This Month"
                        : selectedDateFilter === "last_month" ? "Last Month"
                        : "Last 365 Days"}
                    </span>
                  </div>
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                {[
                  { val: "all", label: "All Dates" },
                  { val: "today", label: "Today" },
                  { val: "this_week", label: "This Week" },
                  { val: "last_week", label: "Last Week" },
                  { val: "this_month", label: "This Month" },
                  { val: "last_month", label: "Last Month" },
                  { val: "last_365_days", label: "Last 365 Days" },
                ].map(({ val, label }) => (
                  <DropdownMenuItem key={val} onClick={() => setSelectedDateFilter(val)} className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    <span>{label}</span>
                    {selectedDateFilter === val && <Check className="h-3.5 w-3.5 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Create button */}
            <Button
              size="sm"
              className="h-8 gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs shrink-0"
              onClick={() => navigate("/payment-out/create")}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Create</span>
              <span className="hidden lg:inline"> Payment Out</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Card ── */}
      <div className="bg-white rounded-lg border overflow-hidden min-w-0">
        {/* Search Bar */}
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            {/* Vendor / Payment selector */}
            <div className="relative flex-1 max-w-xs">
              <DropdownMenu open={showSuggestions} onOpenChange={setShowSuggestions}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-8 w-full justify-start px-2 text-xs"
                    disabled={isDropdownLoading}
                  >
                    {isDropdownLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      <span className="truncate">
                        {searchTerm || (searchType === "party_name" ? "Select Vendor..." : "Select Payment #...")}
                      </span>
                    )}
                    {!isDropdownLoading && <ChevronDown className="ml-auto h-3 w-3 shrink-0" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-48 overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => { setSearchTerm(""); setRefreshKey((k) => k + 1); }}
                    className={!searchTerm ? "bg-blue-50 text-blue-600" : ""}
                  >
                    <span className="text-[11px] text-gray-500">All {searchType === "party_name" ? "Vendors" : "Payments"}</span>
                  </DropdownMenuItem>
                  {(searchType === "party_name" ? allPartyNames : allPaymentNumbers).length === 0 ? (
                    <DropdownMenuItem disabled>
                      <span className="text-[11px] text-gray-400">No {searchType === "party_name" ? "vendors" : "payments"} found</span>
                    </DropdownMenuItem>
                  ) : (
                    (searchType === "party_name" ? allPartyNames : allPaymentNumbers).map((item, idx) => (
                      <DropdownMenuItem
                        key={idx}
                        onClick={() => { setSearchTerm(item); setRefreshKey((k) => k + 1); }}
                        className={`text-[11px] ${searchTerm === item ? "bg-blue-50 text-blue-600" : ""}`}
                      >
                        {item}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Filter by type */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs gap-1 shrink-0">
                  <Filter className="h-3 w-3 text-blue-500 shrink-0" />
                  <span className="hidden sm:inline truncate max-w-[60px]">
                    {searchTerm
                      ? `${searchType === "party_name" ? "Vendor" : "Payment"}`
                      : "Filter"}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
                <DropdownMenuItem
                  onClick={() => handleSearchTypeChange("party_name")}
                  className={`text-xs ${searchType === "party_name" ? "bg-blue-50 text-blue-600" : ""}`}
                >
                  <Filter className="h-3 w-3 mr-2" />
                  Vendor Name
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSearchTypeChange("payment_number")}
                  className={`text-xs ${searchType === "payment_number" ? "bg-blue-50 text-blue-600" : ""}`}
                >
                  <Filter className="h-3 w-3 mr-2" />
                  Payment Number
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              key={refreshKey}
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
            />
          </div>
        </div>
      </div>

      {/* ── Payment Details Modal ── */}
      <div
        className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 md:p-8 transition-all duration-500 ease-out ${
          isModalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeModal}
      >
        <div
          className={`bg-white rounded-xl shadow-2xl w-full sm:max-w-4xl max-h-[70vh] sm:max-h-[65vh] overflow-hidden flex flex-col transform transition-all duration-500 ease-out ${
            isModalOpen ? "scale-100 opacity-100 translate-y-0" : "scale-95 opacity-0 translate-y-4"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 sm:px-8 sm:p-6 border-b bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900">Payment Out Details</h3>
              <p className="text-[10px] sm:text-xs text-gray-500">Transaction summary</p>
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
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-orange-50/50 border border-orange-100">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
                    <span className="text-xs sm:text-sm font-medium text-orange-700">Vendor</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-right max-w-[50%] sm:max-w-[55%] truncate text-orange-900">{selectedPayment.party_name}</span>
                </div>
                
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-500" />
                    <span className="text-xs sm:text-sm font-medium text-indigo-700">Mode</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-right max-w-[50%] sm:max-w-[55%] truncate text-indigo-900">{selectedPayment.payment_mode}</span>
                </div>
                
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                    <span className="text-xs sm:text-sm font-medium text-emerald-700">Status</span>
                  </div>
                  <span className={`text-xs sm:text-sm font-semibold ${
                    selectedPayment?.payment_status === 'paid' ? 'text-green-900' : 
                    selectedPayment?.payment_status === 'partial' ? 'text-yellow-900' : 
                    selectedPayment?.payment_status === 'unpaid' ? 'text-red-900' :
                    'text-gray-900'
                  }`}>
                    {selectedPayment?.payment_status || 'No Status'}
                  </span>
                </div>

                {/* Row 2 - Date, Ref No, Total Amount */}
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                    <span className="text-xs sm:text-sm font-medium text-blue-700">Date</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-blue-900">
                    {new Date(selectedPayment.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-purple-50/50 border border-purple-100">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-500" />
                    <span className="text-xs sm:text-sm font-medium text-purple-700">Ref No.</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-purple-900">
                    #{selectedPayment.payment_number}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                  <div className="flex items-center gap-2 sm:gap-2.5">
                    <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                    <span className="text-xs sm:text-sm font-medium text-blue-700">Total Amount</span>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-blue-900">
                    ₹{selectedPayment.total_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Financial Breakdown */}
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 sm:px-4 border-b">
                  <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-widest">Financial Summary</p>
                </div>
                <div className="p-3 sm:p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                  <div className="flex flex-col items-center justify-between min-h-[70px] sm:min-h-[80px]">
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Amount Paid</p>
                    <p className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                      ₹{selectedPayment.amount_paid?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-between min-h-[70px] sm:min-h-[80px]">
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Discount</p>
                    <p className="text-sm sm:text-base font-bold text-rose-600 leading-tight">
                      ₹{(selectedPayment.discount || selectedPayment.payment_discount || 0)?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-between min-h-[70px] sm:min-h-[80px]">
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Balance Due</p>
                    <p className="text-sm sm:text-base font-bold text-amber-600 leading-tight">
                      ₹{(selectedPayment.balance_due || (selectedPayment.total_amount || 0) - (selectedPayment.amount_paid || 0) - (selectedPayment.discount || selectedPayment.payment_discount || 0))?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex flex-col items-center justify-between min-h-[70px] sm:min-h-[80px]">
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Settled Against</p>
                    <p className="text-xs sm:text-sm font-medium text-gray-700 leading-tight text-center">
                      {selectedPayment.invoice_number ? `Inv #${selectedPayment.invoice_number}` : "Manual Entry"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedPayment.notes && (
                <div className="p-3 sm:p-4 rounded-lg bg-yellow-50/50 border border-yellow-100">
                  <p className="text-[10px] sm:text-xs font-semibold text-yellow-800 uppercase mb-2">Internal Notes</p>
                  <p className="text-xs sm:text-sm text-yellow-900 leading-relaxed italic">"{selectedPayment.notes}"</p>
                </div>
              )}

              {/* Related Invoices */}
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] sm:text-xs font-semibold text-gray-900 uppercase tracking-tight">
                    Vendor's Other Pending Invoices
                  </h4>
                  <span className="text-[10px] sm:text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full animate-pulse">Pending records</span>
                </div>

                {vendorInvoices.length > 0 ? (
                  <div className="rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                    {/* Scrollable only inside modal on mobile */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm min-w-[350px] sm:min-w-[400px]">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-2 sm:px-3 py-2 font-medium text-gray-500 text-[10px] sm:text-xs align-middle">Date</th>
                            <th className="px-2 sm:px-3 py-2 font-medium text-gray-500 text-[10px] sm:text-xs align-middle">Status</th>
                            <th className="px-2 sm:px-3 py-2 font-medium text-gray-500 text-[10px] sm:text-xs align-middle">Invoice #</th>
                            <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 text-[10px] sm:text-xs align-middle">Total</th>
                            <th className="px-2 sm:px-3 py-2 text-right font-medium text-gray-500 text-[10px] sm:text-xs align-middle">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {vendorInvoices.slice(0, 5).map((inv) => (
                            <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs text-gray-600 align-middle">
                                {new Date(inv.date).toLocaleDateString()}
                              </td>
                              <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-center align-middle">
                                <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] rounded bg-gray-100 text-gray-600">
                                  {inv.payment_status}
                                </span>
                              </td>
                              <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs font-medium text-blue-600 align-middle">#{inv.invoice_number}</td>
                              <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-[10px] sm:text-xs text-gray-900 align-middle">
                                ₹{inv.invoice_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right text-[10px] sm:text-xs font-semibold text-amber-700 align-middle">
                                ₹{inv.balance_due?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 sm:py-8 border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                    <Search className="h-6 w-6 sm:h-7 sm:w-7 mb-2 opacity-20" />
                    <p className="text-[10px] sm:text-xs">No other pending invoices for this vendor</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-12 py-3 sm:px-16 sm:py-4 border-t bg-gray-50/50 flex justify-end gap-3 sm:gap-4">
          <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={closeModal}>Close</Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm"
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
