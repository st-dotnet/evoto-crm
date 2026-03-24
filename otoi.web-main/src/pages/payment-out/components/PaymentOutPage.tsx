import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  DataGrid,
  DataGridColumnHeader,
  DataGridRowSelect,
  DataGridRowSelectAll,
  TDataGridRequestParams,
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
} from "../services/payment-out.service";
import { toast } from "sonner";
import { SpinnerDotted } from "spinners-react";

export const PaymentOutPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "paid" | "partially paid">("all");
  const [searchType, setSearchType] = useState<"party_name" | "payment_number">("party_name");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allPartyNames, setAllPartyNames] = useState<string[]>([]);
  const [allPaymentNumbers, setAllPaymentNumbers] = useState<string[]>([]);
  const [isDropdownLoading, setIsDropdownLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [vendorInvoices, setVendorInvoices] = useState<any[]>([]);

  // ── Autocomplete ─────────────────────────────────────────────────────────────

  const fetchAutocompleteData = useCallback(async () => {
    setIsDropdownLoading(true);
    try {
      const [partyRes, numRes] = await Promise.all([
        getVendorNamesDropdown(),
        getPaymentOutNumbersDropdown(),
      ]);
      if (partyRes.success && partyRes.data) setAllPartyNames(partyRes.data.filter(Boolean));
      if (numRes.success && numRes.data) setAllPaymentNumbers(numRes.data.filter(Boolean));
    } catch {
      /* silent */
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
          selectedStatus === "all" ? "" : (selectedStatus === "partially paid" ? "partial" : selectedStatus),
          searchType === "party_name" ? searchTerm : "",
          searchType === "payment_number" ? searchTerm : "",
          selectedDateFilter,
        );

        if (response.success && response.data) {
          const items = response.data.data ?? [];
          return { data: items, totalCount: response.data.pagination?.total ?? items.length };
        }
        return { data: [], totalCount: 0 };
      } catch {
        return { data: [], totalCount: 0 };
      }
    },
    [selectedStatus, searchTerm, searchType, selectedDateFilter],
  );

  // ── Delete ────────────────────────────────────────────────────────────────────

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
      console.error("Delete error:", err);
      toast.error("An error occurred while deleting the payment");
    } finally {
      setPaymentToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  // ── View Details ─────────────────────────────────────────────────────────────

  const fetchPaymentDetails = async (payment: any) => {
    setSelectedPayment(payment);
    setIsModalOpen(true);
    setModalLoading(true);

    try {
      if (payment.party_name) {
        const res = await getVendorInvoices(payment.party_name);
        if (res.success && res.data) {
          setVendorInvoices((res.data as any[]).filter((inv: any) => inv.invoice_number !== payment.invoice_number));
        }
      }
    } catch (err) {
      console.error("Error fetching vendor invoices:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPayment(null);
    setVendorInvoices([]);
  };

  // ── Columns ───────────────────────────────────────────────────────────────────

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
        <div className="text-sm font-medium text-center text-blue-600">
          #{info.getValue() as string}
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
      accessorKey: "total_amount_settled",
      header: ({ column }) => (
        <DataGridColumnHeader title="Total Amount" column={column} className="justify-center" />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-center">
          ₹
          {(info.getValue() as number)?.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }) ?? "0.00"}
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
            ₹{amount?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {discount > 0 && (
              <div className="text-xs text-red-500">
                - ₹
                {discount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                discount
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
        const status = info.getValue() as string;
        const color =
          status === "paid"
            ? "text-green-700 bg-green-100"
            : status === "partial" || status === "partially paid"
            ? "text-yellow-700 bg-yellow-100"
            : "text-red-700 bg-red-100";
        return (
          <div className="flex justify-center">
            <span className={`px-2 py-0.5 text-xs font-medium rounded capitalize ${color}`}>
              {status === "partial" ? "partially paid" : status}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: {
        headerClassName: "w-28",
        cellClassName: "text-gray-800 font-medium pointer-events-auto",
        disableRowClick: true,
      },
      cell: ({ row }) => {
        const [isOpen, setIsOpen] = useState(false);
        return (
          <div className="flex justify-center">
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center text-sm text-primary hover:text-primary-active"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    navigate(`/payment-out/${row.original.id}`);
                    setIsOpen(false);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    handleDelete(row.original.id);
                    setIsOpen(false);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                  <span className="text-red-500">Delete</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    fetchPaymentDetails(row.original);
                    setIsOpen(false);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4 text-blue-500" />
                  <span>View Details</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-4 py-6 sm:p-6 relative overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <ArrowUpFromLine className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payment Out</h1>
            <p className="text-sm text-gray-500 mt-0.5">Outgoing payments to vendors</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="w-full sm:w-44">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full justify-between">
                  <div className="flex items-center overflow-hidden">
                    <Filter className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate ml-1">
                      {selectedStatus === "all" && "All Payments"}
                      {selectedStatus === "paid" && "Done Payments"}
                      {selectedStatus === "partially paid" && "Pending Payments"}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {(["all", "paid", "partially paid"] as const).map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => setSelectedStatus(s)}
                    className="flex items-center gap-2"
                  >
                    <Circle
                      className={`h-4 w-4 ${
                        s === "all" ? "text-gray-400" : s === "paid" ? "text-emerald-500" : "text-amber-500"
                      }`}
                    />
                    <span className="capitalize">
                      {s === "all" ? "All Payments" : s === "paid" ? "Done Payments" : "Pending Payments"}
                    </span>
                    {selectedStatus === s && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Date Filter */}
          <div className="w-full sm:w-44">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full justify-between">
                  <div className="flex items-center overflow-hidden">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate ml-1">
                      {selectedDateFilter === "all" && "All Dates"}
                      {selectedDateFilter === "today" && "Today"}
                      {selectedDateFilter === "this_week" && "This Week"}
                      {selectedDateFilter === "last_week" && "Last Week"}
                      {selectedDateFilter === "this_month" && "This Month"}
                      {selectedDateFilter === "last_month" && "Last Month"}
                      {selectedDateFilter === "last_365_days" && "Last 365 Days"}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {[
                  { val: "all", label: "All Dates" },
                  { val: "today", label: "Today" },
                  { val: "this_week", label: "This Week" },
                  { val: "last_week", label: "Last Week" },
                  { val: "this_month", label: "This Month" },
                  { val: "last_month", label: "Last Month" },
                  { val: "last_365_days", label: "Last 365 Days" },
                ].map(({ val, label }) => (
                  <DropdownMenuItem
                    key={val}
                    onClick={() => setSelectedDateFilter(val)}
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span>{label}</span>
                    {selectedDateFilter === val && <Check className="h-4 w-4 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            size="sm"
            className="h-9 gap-1 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => navigate("/payment-out/create")}
          >
            <Plus className="h-4 w-4" />
            <span className="whitespace-nowrap">Create Payment Out</span>
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-80">
              <DropdownMenu open={showSuggestions} onOpenChange={setShowSuggestions}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 w-full justify-start px-3" disabled={isDropdownLoading}>
                    {isDropdownLoading ? (
                      <span className="flex items-center">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                        Loading...
                      </span>
                    ) : (
                      searchTerm ||
                      (searchType === "party_name"
                        ? "Select by vendor name..."
                        : "Select by payment number...")
                    )}
                    {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4 shrink-0" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => {
                      setSearchTerm("");
                      setRefreshKey((k) => k + 1);
                    }}
                    className={!searchTerm ? "bg-blue-50 text-blue-600" : ""}
                  >
                    <span className="text-gray-500">
                      Show All {searchType === "party_name" ? "Vendors" : "Payments"}
                    </span>
                  </DropdownMenuItem>
                  {(searchType === "party_name" ? allPartyNames : allPaymentNumbers).map((item, idx) => (
                    <DropdownMenuItem
                      key={idx}
                      onClick={() => {
                        setSearchTerm(item);
                        setRefreshKey((k) => k + 1);
                      }}
                      className={searchTerm === item ? "bg-blue-50 text-blue-600" : ""}
                    >
                      {item}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 rounded-md px-3 text-sm text-gray-600 w-full sm:w-auto">
                  <Filter className="h-3.5 w-3.5 mr-1 text-blue-500 shrink-0" />
                  <span className="truncate max-w-[150px]">
                    {searchTerm
                      ? `${searchType === "party_name" ? "Vendor" : "Payment"}: ${searchTerm}`
                      : "Filter by"}
                  </span>
                  <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuItem
                  onClick={() => handleSearchTypeChange("party_name")}
                  className={searchType === "party_name" ? "bg-blue-50 text-blue-600" : ""}
                >
                  <Filter className="h-3.5 w-3.5 mr-2" />
                  Vendor Name
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSearchTypeChange("payment_number")}
                  className={searchType === "payment_number" ? "bg-blue-50 text-blue-600" : ""}
                >
                  <Filter className="h-3.5 w-3.5 mr-2" />
                  Payment Number
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto relative">
          <DataGrid
            key={`${refreshKey}-${selectedStatus}-${searchTerm}-${selectedDateFilter}`}
            columns={columns}
            serverSide={true}
            onFetchData={fetchPayments}
            getRowId={(row: any) => row.id?.toString() ?? row.payment_number}
            pagination={{ size: 10 }}
            rowSelection={true}
            onRowClick={(row) => fetchPaymentDetails(row.original)}
            layout={{ card: true }}
          />
        </div>
      </div>

      {/* Payment Details Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Payment Out Details</h3>
                  <p className="text-xs text-gray-500">Transaction summary and related records</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={closeModal} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Body */}
            <div className="p-8 overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <SpinnerDotted size={50} thickness={100} speed={100} color="#7c3aed" />
                  <p className="mt-4 text-sm text-gray-500 animate-pulse">Fetching details...</p>
                </div>
              ) : selectedPayment ? (
                <div className="space-y-8">
                  {/* Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-600">Vendor</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{selectedPayment.party_name}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <Wallet className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-600">Mode</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{selectedPayment.payment_mode}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-700">Total Amount</span>
                        </div>
                        <span className="text-sm font-bold text-blue-900">
                          ₹{selectedPayment.total_amount_settled?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-600">Date</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {new Date(selectedPayment.date).toLocaleDateString("en-IN", { dateStyle: "long" })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-600">Ref No.</span>
                        </div>
                        <span className="text-sm font-semibold text-blue-600">#{selectedPayment.payment_number}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm font-medium text-emerald-700">Status</span>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {selectedPayment.payment_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Financial Summary</p>
                    </div>
                    <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">Amount Paid</p>
                        <p className="text-lg font-bold text-gray-900">
                          ₹{selectedPayment.amount_paid?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">Discount</p>
                        <p className="text-lg font-bold text-rose-600">
                          ₹{selectedPayment.payment_discount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">Balance Due</p>
                        <p className="text-lg font-bold text-amber-600">
                          ₹{selectedPayment.balance_due?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-1">Settled Against</p>
                        <p className="text-sm font-medium text-gray-700 mt-1">
                          {selectedPayment.invoice_number ? `Inv #${selectedPayment.invoice_number}` : "Manual Entry"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedPayment.notes && (
                    <div className="p-4 rounded-lg bg-yellow-50/50 border border-yellow-100">
                      <p className="text-xs font-semibold text-yellow-800 uppercase mb-2">Internal Notes</p>
                      <p className="text-sm text-yellow-900 leading-relaxed italic">"{selectedPayment.notes}"</p>
                    </div>
                  )}

                  {/* Related Invoices */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-tight">
                        Vendor's Other Pending Invoices
                      </h4>
                      <span className="text-[10px] font-medium text-gray-400">Showing up to 5 records</span>
                    </div>
                    
                    {vendorInvoices.length > 0 ? (
                      <div className="rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-4 py-3 font-medium text-gray-500">Date</th>
                              <th className="px-4 py-3 font-medium text-gray-500">Invoice #</th>
                              <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                              <th className="px-4 py-3 text-right font-medium text-gray-500">Balance</th>
                              <th className="px-4 py-3 text-center font-medium text-gray-500">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {vendorInvoices.slice(0, 5).map((inv) => (
                              <tr key={inv.id} className="hover:bg-gray-50/80 transition-colors">
                                <td className="px-4 py-3 text-gray-600">
                                  {new Date(inv.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 font-medium text-blue-600">#{inv.invoice_number}</td>
                                <td className="px-4 py-3 text-right text-gray-900">
                                  ₹{inv.total_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-amber-700">
                                  ₹{inv.balance_due?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600">
                                    {inv.payment_status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-10 border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                        <Search className="h-8 w-8 mb-2 opacity-20" />
                        <p className="text-xs">No other pending invoices for this vendor</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50/50 flex justify-end gap-3">
              <Button variant="outline" onClick={closeModal}>Close</Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  if (selectedPayment) {
                    navigate(`/payment-out/${selectedPayment.id}`);
                    closeModal();
                  }
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Transaction
              </Button>
            </div>
          </div>
        </div>
      )}

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
