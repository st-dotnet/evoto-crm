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
  Plus,
  FileX,
  ArrowDown,
  Calendar,
  Search,
  MoreVertical,
  X,
  FileText,
  User,
  Wallet,
  CreditCard,
  DollarSign,
  CheckCircle,
  Eye,
  Edit,
  Trash2,
  Filter,
  ChevronDown,
  Circle,
  Check,
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
  getPaymentInList,
  getPartyInvoices,
  deletePaymentIn,
  createPaymentIn,
  getPaymentNumbersDropdown,
  getPartyNamesDropdown,
} from "../services/payment-in.service";
import { toast } from "sonner";
import { SpinnerDotted } from "spinners-react";

const API_URL = import.meta.env.VITE_APP_API_URL;

const getAuthToken = (): string | null => {
  return localStorage.getItem("OTOI-auth-v1.0.0.1");
};

export const PaymentInPage = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'paid' | 'partially paid'>('all');
  const [searchType, setSearchType] = useState<'party_name' | 'payment_number'>('party_name');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allPartyNames, setAllPartyNames] = useState<string[]>([]);
  const [allPaymentNumbers, setAllPaymentNumbers] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [isDropdownLoading, setIsDropdownLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLast365Days, setShowLast365Days] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [paymentInvoices, setPaymentInvoices] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);

  // Fetch autocomplete data for search suggestions
  const fetchAutocompleteData = useCallback(async () => {
    setIsDropdownLoading(true);
    try {
      const [partyResponse, paymentNumberResponse] = await Promise.all([
        getPartyNamesDropdown(),
        getPaymentNumbersDropdown()
      ]);

      if (partyResponse.success && partyResponse.data) {
        const partyNames = Array.isArray(partyResponse.data)
          ? partyResponse.data.filter(Boolean)
          : [];
        setAllPartyNames(partyNames);
      }

      if (paymentNumberResponse.success && paymentNumberResponse.data) {
        const paymentNumbers = Array.isArray(paymentNumberResponse.data)
          ? paymentNumberResponse.data.filter(Boolean)
          : [];
        setAllPaymentNumbers(paymentNumbers);
      }
    } catch (error) {
      console.error('Error fetching autocomplete data:', error);
    } finally {
      setIsDropdownLoading(false);
    }
  }, []);

  // Fetch autocomplete data on mount and when search type changes
  useEffect(() => {
    fetchAutocompleteData();
  }, [fetchAutocompleteData]);

  // Handle search type change
  const handleSearchTypeChange = (type: 'party_name' | 'payment_number') => {
    setSearchType(type);
    setShowSuggestions(false);
    setSearchTerm('');
    setFilteredSuggestions(type === 'party_name' ? allPartyNames : allPaymentNumbers);
  };

  // Filter suggestions based on search term and type
  useEffect(() => {
    if (searchTerm) {
      const suggestions = searchType === 'party_name'
        ? allPartyNames.filter(name =>
          name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : allPaymentNumbers.filter(number =>
          number.toLowerCase().includes(searchTerm.toLowerCase())
        );
      setFilteredSuggestions(suggestions);
    } else {
      const suggestions = searchType === 'party_name' ? allPartyNames : allPaymentNumbers;
      setFilteredSuggestions(suggestions);
    }
  }, [searchTerm, searchType, allPartyNames, allPaymentNumbers]);

  // Fetch payment records with server-side pagination
  const fetchPayments = useCallback(async (params: TDataGridRequestParams) => {
    setIsLoading(true);
    try {
      const response = await getPaymentInList(
        params.pageIndex + 1,
        params.pageSize,
        selectedStatus === 'all' ? '' : selectedStatus,
        searchType === 'party_name' ? searchTerm : '',
        searchType === 'payment_number' ? searchTerm : '',
        selectedDateFilter
      );

      if (response.success && response.data) {
        const paymentsData = response.data.data || [];
        const paginationData = response.data.pagination || {};

        setPayments(paymentsData);

        const totalCount = paginationData.total || paymentsData.length;

        return {
          data: paymentsData,
          totalCount: totalCount,
        };
      } else {
        setPayments([]);
        toast.error(response.error || 'Failed to fetch payments');
        return {
          data: [],
          totalCount: 0,
        };
      }
    } catch (error) {
      setPayments([]);
      toast.error('Failed to fetch payments');
      return {
        data: [],
        totalCount: 0,
      };
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatus, searchTerm, searchType, selectedDateFilter]);

  // Fetch data on mount and when filters change
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const response = await getPaymentInList(
          1,
          1000,
          selectedStatus === 'all' ? '' : selectedStatus,
          searchType === 'party_name' ? searchTerm : '',
          searchType === 'payment_number' ? searchTerm : ''
        );
        if (response.success && response.data) {
          setPayments(response.data.data || []);
        }
      } catch (error) {
        toast.error('Failed to fetch payments');
        setPayments([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [selectedStatus, searchTerm, searchType, selectedDateFilter, refreshKey]);

  const handleDelete = (id: string) => {
    setPaymentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!paymentToDelete) return;

    try {
      const response = await deletePaymentIn(paymentToDelete);
      if (response.success) {
        toast.success("Payment deleted successfully");
        // Remove the entry from the UI without page reload
        setPayments(prev => prev.filter(p => p.id !== paymentToDelete && p.payment_number !== paymentToDelete));
        // Refresh dashboard to update bank balance
        window.dispatchEvent(new Event('dashboard-refresh'));
      } else {
        toast.error(response.error || "Failed to delete payment");
      }
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      toast.error("Failed to delete payment");
    } finally {
      setPaymentToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  const cancelDelete = () => {
    setPaymentToDelete(null);
    setDeleteDialogOpen(false);
  };

  const MobileView = ({
    onEdit,
    onDelete,
    onRowClick
  }: {
    onEdit: (id: string, e: React.MouseEvent) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRowClick: (payment: any) => void;
  }) => {
    return (
      <div className="flex flex-col lg:hidden border-t border-gray-100 dark:border-gray-100/10">
        {payments.map((payment) => (
          <div
            key={payment.id || payment.payment_number}
            className="flex justify-between items-center py-4 px-5 border-b border-gray-100 dark:border-gray-100/10 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-200/50 transition-all active:bg-gray-50 dark:active:bg-gray-200/50"
            onClick={() => onRowClick(payment)}
          >
            <div className="flex flex-col grow pr-4 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-blue-600 dark:text-blue-500 text-sm">#{payment.payment_number}</span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                  {new Date(payment.date).toLocaleDateString()}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-900 mb-1">{payment.party_name}</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-500">
                <span className="flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-gray-400 dark:text-gray-500" />
                  {payment.payment_mode}
                </span>
                {payment.payment_discount > 0 && (
                  <span className="text-red-500 dark:text-red-400 font-medium">
                    Disc: ₹{payment.payment_discount.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-medium">Received</span>
                  <span className="font-bold text-blue-600 dark:text-blue-500 text-sm">
                    ₹{payment.amount_received?.toLocaleString('en-IN') || '0.00'}
                  </span>
                </div>
                {(payment.total_amount_settled ?? 0) > 0 && (
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-medium">Settled</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-900 text-sm">
                      ₹{payment.total_amount_settled?.toLocaleString('en-IN') || '0.00'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <button className="flex items-center justify-center size-9 text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-200 rounded-full transition-all shrink-0">
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 p-1 shadow-lg bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100">
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={(e) => onEdit(payment.id, e)}
                >
                  <Edit className="mr-2 h-4 w-4 text-gray-500" />
                  Edit
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100"></div>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                  onClick={(e) => onDelete(payment.id, e)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {payments.length === 0 && !isLoading && (
          <div className="p-16 text-center">
            <div className="flex flex-col items-center gap-2">
              <Search className="text-3xl text-gray-200" />
              <span className="text-gray-400 text-sm font-medium">No payments found.</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Table columns definition
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
        <DataGridColumnHeader
          title="Date"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => (
        <div className="text-sm text-gray-900 dark:text-gray-900 text-center">
          {new Date(info.getValue() as string).toLocaleDateString()}
        </div>
      ),
    },
    {
      accessorKey: "payment_number",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Payment Number"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-center text-blue-500 dark:text-blue-400">
          #{info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: "party_name",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Party Name"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => (
        <div className="text-sm text-gray-900 dark:text-gray-900 text-center">
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: "total_amount_settled",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Total Amount Settled"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => (
        <div className="text-sm font-medium text-center text-gray-900 dark:text-gray-900">
          ₹{(info.getValue() as number)?.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }) || "0.00"}
        </div>
      ),
    },
    {
      accessorKey: "amount_received",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Amount Received"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => {
        const amountReceived = info.getValue() as number;
        const row = info.row.original;
        const discount = row.payment_discount || 0;

        return (
          <div className="text-sm font-medium text-center text-gray-900 dark:text-gray-900">
            ₹{amountReceived.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
            {discount > 0 && (
              <div className="text-xs text-red-500 dark:text-red-400">
                - ₹{discount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
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
        <DataGridColumnHeader
          title="Payment Mode"
          column={column}
          className="justify-center"
        />
      ),
      cell: (info) => {
        const row = info.row.original;
        const paymentMode = info.getValue() as string;
        const discount = row.payment_discount || 0;

        return (
          <div className="text-sm text-gray-900 dark:text-gray-900 text-center">
            {discount > 0 ? `${paymentMode} + discount` : paymentMode}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      meta: {
        headerClassName: "w-28 text-center",
        cellClassName: "text-gray-800 font-medium pointer-events-auto",
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

              <DropdownMenuContent align="end" className="bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/payment-in/${row.original.id}`);
                    setIsOpen(false);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(row.original.id);
                    setIsOpen(false);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(row.original.id);
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

  // Fetch payment details for modal
  const fetchPaymentDetails = async (paymentData: any) => {
    setSelectedPayment(paymentData);
    setIsModalOpen(true);
    setModalLoading(true);

    try {
      // Get party invoices to show related invoices for this payment
      if (paymentData.party_name) {
        const invoicesResponse = await getPartyInvoices(paymentData.party_name);
        if (invoicesResponse.success) {
          // Filter out the current invoice from the list
          const filteredInvoices = (invoicesResponse.data || []).filter(
            (invoice: any) =>
              invoice.id !== paymentData.invoice_id &&
              invoice.invoice_number !== paymentData.invoice_number,
          );
          setPaymentInvoices(filteredInvoices);
        }
      }
    } catch (error) {
      // Error fetching payment details
    } finally {
      setModalLoading(false);
    }
  };

  // Handle row click to show payment details modal
  const handleRowClick = (paymentData: any) => {
    fetchPaymentDetails(paymentData);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPayment(null);
    setPaymentInvoices([]);
  };

  return (
    <div className="w-full px-4 py-6 sm:p-6 relative overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <ArrowDown className="h-5 w-5 text-blue-600" />
          </div>
          <h1 className="text-2xl font-semibold">Payment In</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Desktop Status Segmented Filter */}
          <div className="hidden sm:flex items-center px-1.5 py-1 bg-gray-50/50 dark:bg-gray-200/5 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-gray-100 shadow-sm w-fit">
            <div className="flex items-center pl-2 pr-3 border-r border-gray-200/80 dark:border-gray-100/50 mr-1">
              <Filter className="h-3.5 w-3.5 text-gray-900 dark:text-gray-900 mr-2" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-900 dark:text-gray-900">Filters</span>
            </div>
            <div className="relative flex items-center">
              {/* Animated Slider Background with Glow */}
              <div
                className={`absolute inset-y-0 rounded-lg border shadow-[0_2px_12px_-2px_rgba(59,130,246,0.15)] dark:shadow-[0_2px_15px_-3px_rgba(59,130,246,0.3)] transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${selectedStatus === 'all' ? 'bg-white dark:bg-blue-500/20 border-gray-200 dark:border-blue-500/50 shadow-gray-200/50' :
                  selectedStatus === 'paid' ? 'bg-green-50 dark:bg-green-500/20 border-green-200 dark:border-green-500/50 shadow-green-200/50' :
                    'bg-blue-50 dark:bg-blue-500/20 border-blue-200 dark:border-blue-500/50 shadow-blue-200/50'
                  }`}
                style={{
                  width: '90px',
                  transform: `translateX(${selectedStatus === 'all' ? '0px' :
                    selectedStatus === 'paid' ? '90px' : '180px'
                    })`
                }}
              />

              <button
                onClick={() => setSelectedStatus('all')}
                className={`relative w-[90px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'all' ? 'text-gray-900 dark:text-gray-900 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedStatus('paid')}
                className={`relative w-[90px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'paid' ? 'text-gray-900 dark:text-gray-900 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Done
              </button>
              <button
                onClick={() => setSelectedStatus('partially paid')}
                className={`relative w-[90px] py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'partially paid' ? 'text-gray-900 dark:text-gray-900 font-bold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Pending
              </button>
            </div>
          </div>

          {/* Mobile Fallback Status Filter */}
          <div className="w-full sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full justify-between bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100">
                  <div className="flex items-center overflow-hidden">
                    <Filter className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
                    <span className="truncate ml-1 text-gray-700 dark:text-gray-900 font-medium">
                      {selectedStatus === 'all' && 'All Payments'}
                      {selectedStatus === 'paid' && 'Done'}
                      {selectedStatus === 'partially paid' && 'Pending'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem onClick={() => setSelectedStatus('all')} className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-gray-500" />
                  <span>All Payments</span>
                  {selectedStatus === 'all' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatus('paid')} className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-green-500" />
                  <span>Done</span>
                  {selectedStatus === 'paid' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatus('partially paid')} className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-yellow-500" />
                  <span>Pending</span>
                  {selectedStatus === 'partially paid' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Date Filter Dropdown */}
          <div className="w-full sm:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-full md:w-fit px-4 gap-2 bg-gray-50/50 dark:bg-gray-200/5 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-gray-100 shadow-sm text-gray-900 dark:text-gray-900 font-bold hover:bg-gray-100/50 dark:hover:bg-gray-100 transition-all"
                >
                  <Calendar className="h-4 w-4 text-gray-900 dark:text-gray-900" />
                  <span className="truncate">
                    {selectedDateFilter === 'all' && 'All Dates'}
                    {selectedDateFilter === 'today' && 'Today'}
                    {selectedDateFilter === 'tomorrow' && 'Tomorrow'}
                    {selectedDateFilter === 'day_after_tomorrow' && 'Day After Tomorrow'}
                    {selectedDateFilter === 'this_week' && 'This Week'}
                    {selectedDateFilter === 'last_week' && 'Last Week'}
                    {selectedDateFilter === 'this_month' && 'This Month'}
                    {selectedDateFilter === 'last_month' && 'Last Month'}
                    {selectedDateFilter === 'last_365_days' && 'Last 365 Days'}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem onClick={() => setSelectedDateFilter('all')} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>All Dates</span>
                  {selectedDateFilter === 'all' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter('today')} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <span>Today</span>
                  {selectedDateFilter === 'today' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter('tomorrow')} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-green-500" />
                  <span>Tomorrow</span>
                  {selectedDateFilter === 'tomorrow' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter('day_after_tomorrow')} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span>Day After Tomorrow</span>
                  {selectedDateFilter === 'day_after_tomorrow' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter('this_week')} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <span>This Week</span>
                  {selectedDateFilter === 'this_week' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter('last_week')} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-yellow-500" />
                  <span>Last Week</span>
                  {selectedDateFilter === 'last_week' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter('this_month')} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-indigo-500" />
                  <span>This Month</span>
                  {selectedDateFilter === 'this_month' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter('last_month')} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-pink-500" />
                  <span>Last Month</span>
                  {selectedDateFilter === 'last_month' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter('last_365_days')} className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-red-500" />
                  <span>Last 365 Days</span>
                  {selectedDateFilter === 'last_365_days' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {/* Create Payment In Button moved to table header */}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-100 border border-gray-200 dark:border-gray-100 rounded-xl shadow-sm overflow-hidden transition-all">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-100/10 w-full bg-white dark:bg-transparent">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
            <div className="relative w-full sm:w-80">
              <DropdownMenu open={showSuggestions} onOpenChange={setShowSuggestions}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 w-full justify-start px-3 bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-200 hover:border-gray-300 dark:hover:border-gray-100 shadow-sm transition-all rounded-xl" disabled={isDropdownLoading}>
                    {isDropdownLoading ? (
                      <span className="flex items-center text-xs">
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading...
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-900">
                        {searchTerm || (searchType === 'party_name' ? 'Select by party name...' : 'Select by payment number...')}
                      </span>
                    )}
                    {!isDropdownLoading && <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => {
                      setSearchTerm('');
                      setRefreshKey(prev => prev + 1);
                    }}
                    className={!searchTerm ? "bg-blue-50 text-blue-600" : ""}
                  >
                    <span className="text-gray-500">Show All {searchType === 'party_name' ? 'Parties' : 'Payments'}</span>
                  </DropdownMenuItem>
                  {isDropdownLoading ? (
                    <DropdownMenuItem disabled>
                      <div className="flex items-center justify-center w-full py-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading options...
                      </div>
                    </DropdownMenuItem>
                  ) : (
                    (searchType === 'party_name' ? allPartyNames : allPaymentNumbers).map((item, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => {
                          setSearchTerm(item);
                          setRefreshKey(prev => prev + 1);
                        }}
                        className={searchTerm === item ? "bg-blue-50 text-blue-600" : ""}
                      >
                        {item}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Desktop Segmented Filter Type */}
            <div className="hidden sm:flex relative p-0.5 bg-gray-100 dark:bg-gray-200 rounded-lg border border-gray-200/60 dark:border-gray-100 shadow-inner w-fit items-center">
              <button
                onClick={() => handleSearchTypeChange('party_name')}
                className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all z-10 uppercase tracking-wider ${searchType === 'party_name' ? 'bg-white dark:bg-gray-100 text-blue-600 shadow-sm' : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-800'}`}
              >
                Party Name
              </button>
              <button
                onClick={() => handleSearchTypeChange('payment_number')}
                className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all z-10 uppercase tracking-wider ${searchType === 'payment_number' ? 'bg-white dark:bg-gray-100 text-blue-600 shadow-sm' : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-800'}`}
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
                    size="sm"
                    className="h-10 rounded-md px-3 text-sm text-gray-600 w-full sm:w-auto flex items-center justify-between sm:justify-center"
                  >
                    <div className="flex items-center truncate min-w-0">
                      <Filter className="h-3.5 w-3.5 mr-1 text-blue-500 shrink-0" />
                      <span className="truncate">
                        {searchTerm ? (searchType === 'party_name' ? 'Party' : 'No.') : 'Search by'}
                      </span>
                    </div>
                    <ChevronDown className="h-3 w-3 ml-1 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48" align="end">
                  <DropdownMenuItem
                    onClick={() => handleSearchTypeChange('party_name')}
                    className={searchType === 'party_name' ? "bg-blue-50 text-blue-600" : ""}
                  >
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Party Name
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSearchTypeChange('payment_number')}
                    className={searchType === 'payment_number' ? "bg-blue-50 text-blue-600" : ""}
                  >
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Payment Number
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="w-full sm:w-auto sm:ml-auto">
              <button
                className="group flex items-center gap-2 px-5 h-10 text-xs font-bold text-blue-600 dark:text-blue-500 bg-white dark:bg-gray-100 border border-blue-100 dark:border-blue-900/30 rounded-xl shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800 transition-all active:scale-95 w-full sm:w-auto"
                onClick={() => navigate("/payment-in/create")}
              >
                <Plus className="size-4 text-blue-600 dark:text-blue-500 group-hover:rotate-90 transition-transform" />
                <span className="whitespace-nowrap tracking-wider">Create Payment In</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-auto relative">
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-100/80 backdrop-blur-sm">
              <SpinnerDotted
                size={50}
                thickness={100}
                speed={100}
                color="#2563eb"
              />
            </div>
          )}
          <DataGrid
            refreshKey={refreshKey}
            columns={columns}
            data={payments}
            serverSide={false}
            loading={isLoading}
            getRowId={(row: any) => row.id?.toString() || row.payment_number}
            pagination={{ size: 5 }}
            rowSelection={true}
            onRowClick={(row) => handleRowClick(row.original)}
            layout={{
              card: true,
              classes: {
                container: 'hidden lg:block'
              }
            }}
          >
            <MobileView
              onEdit={(id, e) => {
                e.stopPropagation();
                navigate(`/payment-in/${id}`);
              }}
              onDelete={(id, e) => {
                e.stopPropagation();
                handleDelete(id);
              }}
              onRowClick={(payment) => handleRowClick(payment)}
            />
          </DataGrid>
        </div>
      </div>

      {/* Payment Details Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
        >
          {/* Loading Overlay */}
          {modalLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-100/80 backdrop-blur-sm flex items-center justify-center z-[10000]">
              <div className="flex flex-col items-center">
                <SpinnerDotted
                  size={40}
                  thickness={100}
                  speed={100}
                  color="#1B84FF"
                />
                <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-900">
                  Loading payment details...
                </p>
              </div>
            </div>
          )}
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 truncate">
                  Payment Details
                </h3>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                onClick={closeModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {modalLoading ? (
                <div className="flex items-center justify-center py-10">
                  <SpinnerDotted
                    size={30}
                    thickness={100}
                    speed={100}
                    color="#1B84FF"
                  />
                  <span className="ml-3 text-sm text-gray-600">
                    Loading payment details...
                  </span>
                </div>
              ) : selectedPayment ? (
                <div className="space-y-6">
                  {/* Payment Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-start sm:items-center gap-2">
                        <User className="h-4 w-4 text-gray-600 mt-0.5 sm:mt-0" />
                        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                          Party Name:
                        </span>
                        <span className="text-sm text-gray-900 break-words">
                          {selectedPayment.party_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Payment Mode:
                        </span>
                        <span className="text-sm text-gray-900">
                          {selectedPayment.payment_mode}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">
                          Total Amount:
                        </span>
                        <span className="text-sm font-medium text-green-600">
                          ₹
                          {selectedPayment.total_amount_settled?.toLocaleString(
                            "en-IN",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }
                          ) || "0.00"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-500">
                          Balance Due:
                        </span>
                        <span className="text-sm font-medium text-red-600 dark:text-red-500">
                          ₹
                          {selectedPayment.balance_due?.toLocaleString(
                            "en-IN",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }
                          ) || "0.00"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-500">
                          Payment Date:
                        </span>
                        <span className="text-sm text-gray-900 dark:text-gray-900">
                          {new Date(selectedPayment.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-500">
                          Payment Number:
                        </span>
                        <span className="text-sm text-blue-600 dark:text-blue-500 font-medium">
                          #{selectedPayment.payment_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-500">
                          Amount Received:
                        </span>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-500">
                          ₹
                          {selectedPayment.amount_received?.toLocaleString(
                            "en-IN",
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }
                          ) || "0.00"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-500">
                          Payment Status:
                        </span>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${selectedPayment.payment_status === "paid"
                            ? "bg-green-100 dark:bg-green-950/20 text-green-800 dark:text-green-500 border-green-200 dark:border-green-800"
                            : selectedPayment.payment_status ===
                              "partially paid" ||
                              selectedPayment.payment_status === "partial"
                              ? "bg-yellow-100 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-500 border-yellow-200 dark:border-yellow-800"
                              : "bg-gray-100 dark:bg-gray-200/20 text-gray-800 dark:text-gray-500 border-gray-200 dark:border-gray-800"
                            }`}
                        >
                          {selectedPayment.payment_status === "partial"
                            ? "partially paid"
                            : selectedPayment.payment_status || "unknown"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Discount Information */}
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-400">
                        Discount Applied:
                      </span>
                      <span className="text-sm text-blue-600 dark:text-blue-500 font-medium">
                        ₹
                        {selectedPayment.payment_discount?.toLocaleString(
                          "en-IN",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          }
                        ) || "0.00"}
                      </span>
                    </div>
                  </div>

                  {/* Related Invoices */}
                  {paymentInvoices.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-md font-semibold text-gray-800 dark:text-gray-900">
                        Other Related Invoices with {selectedPayment.party_name}
                      </h4>

                      {/* Desktop Table View */}
                      <div className="hidden sm:block bg-white dark:bg-gray-100 rounded-lg border border-gray-200 dark:border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                          <table className="w-full text-sm min-w-[600px]">
                            <thead className="bg-gray-50/50 dark:bg-gray-200/5 border-b border-gray-200 dark:border-gray-100">
                              <tr>
                                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-900 whitespace-nowrap">
                                  Date
                                </th>
                                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-900 whitespace-nowrap">
                                  Invoice Number
                                </th>
                                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-900 whitespace-nowrap">
                                  Amount
                                </th>
                                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-900 whitespace-nowrap">
                                  Paid
                                </th>
                                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-900 whitespace-nowrap">
                                  Balance
                                </th>
                                <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-900 whitespace-nowrap">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-100/10">
                              {paymentInvoices.map((invoice) => (
                                <tr
                                  key={invoice.id}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-200/10 transition-colors cursor-pointer"
                                  onClick={() => {
                                    /* Invoice click logic */
                                  }}
                                >
                                  <td className="px-3 py-4 text-center text-gray-900 dark:text-gray-900 whitespace-nowrap">
                                    {new Date(
                                      invoice.date,
                                    ).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-4 text-center font-medium text-blue-600 dark:text-blue-500 whitespace-nowrap">
                                    {invoice.invoice_number}
                                  </td>
                                  <td className="px-3 py-4 text-center font-medium text-gray-900 dark:text-gray-900 whitespace-nowrap">
                                    ₹{invoice.invoice_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-3 py-4 text-center font-medium text-green-600 whitespace-nowrap">
                                    ₹{invoice.amount_received?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-3 py-4 text-center font-medium whitespace-nowrap">
                                    ₹{invoice.balance_amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-3 py-4 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${invoice.status === "paid"
                                        ? "bg-green-100 text-green-800"
                                        : invoice.status === "partially paid"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : "bg-gray-100 text-gray-800"
                                        }`}
                                    >
                                      {invoice.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Mobile Card View */}
                      <div className="sm:hidden space-y-3">
                        {paymentInvoices.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-2 active:bg-gray-100 transition-colors"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-blue-600 font-semibold text-sm">{invoice.invoice_number}</span>
                              <span className="text-[11px] text-gray-500">{new Date(invoice.date).toLocaleDateString()}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-gray-400 font-medium uppercase text-[10px]">Amount</p>
                                <p className="font-semibold text-gray-700">₹{invoice.invoice_amount?.toLocaleString("en-IN")}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-gray-400 font-medium uppercase text-[10px]">Paid</p>
                                <p className="font-semibold text-green-600">₹{invoice.amount_received?.toLocaleString("en-IN")}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 font-medium uppercase text-[10px]">Balance</p>
                                <p className="font-semibold text-red-600">₹{invoice.balance_amount?.toLocaleString("en-IN")}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-gray-400 font-medium uppercase text-[10px]">Status</p>
                                <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                                  invoice.status === 'partially paid' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-gray-200 text-gray-800'
                                  }`}>
                                  {invoice.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Invoices Message */}
                  {paymentInvoices.length === 0 && (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm text-gray-600">
                        No other related invoices found for this payment
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-600">
                    No payment details available
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <div className="z-[10000]">
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Payment"
          message="Are you sure you want to delete this payment? This action will mark the payment as deleted in the system."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          variant="danger"
        />
      </div>
    </div>
  );
};