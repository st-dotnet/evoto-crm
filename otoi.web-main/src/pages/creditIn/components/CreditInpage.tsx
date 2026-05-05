import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  DataGrid,
  DataGridColumnHeader,
  DataGridRowSelect,
  DataGridRowSelectAll,
} from "@/components";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Calendar,
  Filter,
  Check,
  Circle,
  ChevronDown,
  Search,
  MoreVertical,
  Edit,
  Eye,
  Trash2,
  CreditCard,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { TDataGridRequestParams } from "@/components";
import { SpinnerDotted } from "spinners-react";
import {
  getCreditNotes,
  deleteCreditNote,
  getCustomerNamesDropdown,
  getCreditNoteNumbersDropdown,
  getCreditNoteById,
  updateInvoiceStatus,
  checkCreditNoteExistsForInvoice,
} from "../service/creditIn.service";
import axios from "axios";

interface CreditNote {
  id: string;
  date: string;
  credit_note_number: string;
  party_name: string;
  invoice_no: string;
  amount: number;
  status: string;
}

interface CreditNoteNumberItem {
  uuid: string;
  credit_note_number: string;
  customer_id?: string;
}

const CreditInpage = () => {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoicesWithCreditNotes, setInvoicesWithCreditNotes] = useState<
    Set<string>
  >(new Set());
  const [isCheckingCreditNote, setIsCheckingCreditNote] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "unpaid" | "refunded"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<
    "party_name" | "credit_note_number"
  >("party_name");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allCustomerNames, setAllCustomerNames] = useState<string[]>([]);
  const [allCreditNoteNumbers, setAllCreditNoteNumbers] = useState<
    string[] | CreditNoteNumberItem[]
  >([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<
    string[] | CreditNoteNumberItem[]
  >([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isDropdownLoading, setIsDropdownLoading] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [creditNoteToDelete, setCreditNoteToDelete] = useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('last_365');
  const navigate = useNavigate();

  // Fetch autocomplete data for search suggestions
  const fetchAutocompleteData = useCallback(async () => {
    setIsDropdownLoading(true);
    try {
      const [customerResponse, creditNoteNumberResponse] = await Promise.all([
        getCustomerNamesDropdown(),
        getCreditNoteNumbersDropdown(),
      ]);

      if (customerResponse.success && customerResponse.data) {
        const customerNames = Array.isArray(customerResponse.data)
          ? customerResponse.data
            .filter((item: any) => item && item.name && typeof item.name === 'string')
            .sort((a: any, b: any) => a.name.localeCompare(b.name))
          : [];
        setAllCustomerNames(customerNames);
      } else {
        setAllCustomerNames([]);
      }

      if (creditNoteNumberResponse.success && creditNoteNumberResponse.data) {
        const creditNoteNumbers = Array.isArray(creditNoteNumberResponse.data)
          ? creditNoteNumberResponse.data.filter((item: any) => item).map((item: any) => typeof item === 'string' ? item : (item.credit_note_number || item.uuid))
          : [];
        setAllCreditNoteNumbers(creditNoteNumbers);
      } else {
        setAllCreditNoteNumbers([]);
      }
    } catch (error) {
      setAllCustomerNames([]);
      setAllCreditNoteNumbers([]);
    } finally {
      setIsDropdownLoading(false);
    }
  }, [refreshKey]);

  useEffect(() => {
    fetchAutocompleteData();
  }, [fetchAutocompleteData]);

  const handleSearchTypeChange = (
    type: "party_name" | "credit_note_number",
  ) => {
    setSearchType(type);
    setShowSuggestions(false);
    setSearchTerm("");
    setFilteredSuggestions(
      type === "party_name" ? allCustomerNames.map((item: any) => item.name) : allCreditNoteNumbers,
    );
  };

  useEffect(() => {
    if (searchTerm) {
      const suggestions =
        searchType === "party_name"
          ? allCustomerNames.filter((item: any) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()),
          ).map((item: any) => item.name)
          : (allCreditNoteNumbers.filter((item: any) =>
            item.toLowerCase().includes(searchTerm.toLowerCase()),
          ));
      setFilteredSuggestions(suggestions as string[]);
    } else {
      const suggestions =
        searchType === "party_name" ? allCustomerNames.map((item: any) => item.name) : allCreditNoteNumbers;
      setFilteredSuggestions(suggestions as string[]);
    }
  }, [searchTerm, searchType, allCustomerNames, allCreditNoteNumbers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCreditNoteUpdate = (event: CustomEvent) => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [selectedStatus, selectedDateFilter]);

  useEffect(() => {
    window.addEventListener(
      "creditNoteUpdated",
      handleCreditNoteUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        "creditNoteUpdated",
        handleCreditNoteUpdate as EventListener,
      );
    };
  }, [creditNotes]);

  const filteredCreditNotes = useMemo(() => {
    return creditNotes;
  }, [creditNotes]);

  const fetchCreditNotes = useCallback(
    async (params: TDataGridRequestParams) => {
      setIsLoading(true);
      try {
        const apiParams = {
          page: params.pageIndex + 1,
          per_page: params.pageSize,
          sort: params.sorting?.[0]?.id,
          order: params.sorting?.[0]?.desc ? "desc" : "asc",
          ...(searchTerm && {
            search: searchTerm,
          }),
          status: selectedStatus === "all" ? "" : selectedStatus,
          date_filter: selectedDateFilter,
        };

        const response = await getCreditNotes(apiParams);

        if (response.success && response.data) {
          const creditNotesData =
            response.data.credit_notes || response.data.data || response.data;

          const notesArray = creditNotesData.credit_notes || creditNotesData;

          const formattedData = Array.isArray(notesArray)
            ? notesArray.map((note: any) => {
              return {
                id: note.uuid?.toString() || note.id?.toString() || "",
                date: note.credit_note_date || note.date || "",
                credit_note_number: note.credit_note_number || "",
                party_name:
                  note.customer_name ||
                  (() => {
                    const customer = note.customer;
                    if (customer) {
                      const name =
                        `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
                      return name || note.party_name || "";
                    }
                    return note.party_name || "";
                  })(),
                invoice_no: note.invoice_number || note.invoice_no || "",
                amount: note.total_amount || note.amount || 0,
                status: note.status || "draft",
              };
            })
            : [];

          setCreditNotes(formattedData);

          let totalCount =
            response.data.data?.pagination?.total ||
            response.data.pagination?.total ||
            response.data.total;

          if (!totalCount) {
            try {
              const allItemsResponse = await getCreditNotes({
                per_page: 1000,
                sort: apiParams.sort,
                order: apiParams.order,
                ...(searchTerm && {
                  [searchType === "party_name"
                    ? "party_name"
                    : "credit_note_number"]: searchTerm,
                }),
                status: selectedStatus === "all" ? "" : selectedStatus,
              });

              if (allItemsResponse.success && allItemsResponse.data) {
                const allCreditNotesData =
                  allItemsResponse.data.credit_notes ||
                  allItemsResponse.data.data ||
                  allItemsResponse.data;
                const allNotesArray =
                  allCreditNotesData.credit_notes || allCreditNotesData;
                totalCount = Array.isArray(allNotesArray)
                  ? allNotesArray.length
                  : formattedData.length;
              } else {
                totalCount = formattedData.length;
              }
            } catch (error) {
              totalCount = formattedData.length;
            }
          }

          return {
            data: formattedData,
            totalCount: totalCount,
          };
        } else {
          throw new Error(response.error || "Failed to fetch credit notes");
        }
      } catch (error: any) {
        toast.error(error.message || "Failed to fetch credit notes");
        setCreditNotes([]);
        return {
          data: [],
          totalCount: 0,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedSearchTerm, searchType, selectedStatus, refreshKey, selectedDateFilter],
  );

  const handleDelete = async (id: string) => {
    window.event?.stopPropagation();
    window.event?.preventDefault();
    setCreditNoteToDelete(id);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!creditNoteToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const creditNoteResponse = await getCreditNoteById(creditNoteToDelete);
      let linkedInvoiceId = null;

      if (creditNoteResponse.success && creditNoteResponse.data?.data) {
        const creditNoteData = creditNoteResponse.data.data;
        linkedInvoiceId =
          creditNoteData.linked_invoice_id || creditNoteData.linkToInvoice;
      }

      const response = await deleteCreditNote(creditNoteToDelete);
      if (response.success) {
        toast.success("Credit note deleted successfully");
        setRefreshKey((prev) => prev + 1);

        if (linkedInvoiceId) {
        }

        window.dispatchEvent(
          new CustomEvent("creditNoteDeleted", {
            detail: { creditNoteId: creditNoteToDelete },
          }),
        );
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete credit note");
    }
    setShowDeleteDialog(false);
    setCreditNoteToDelete(null);
    setIsDeleting(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setCreditNoteToDelete(null);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      draft: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
      refunded: "bg-blue-100 text-blue-800",
      unpaid: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  const MobileView = ({
    onEdit,
    onDetails,
    onDelete,
  }: {
    onEdit: (id: string) => void;
    onDetails: (id: string) => void;
    onDelete: (id: string) => void;
  }) => {
    return (
      <div className="flex flex-col lg:hidden border-t border-gray-100">
        {creditNotes.map((creditNote) => (
          <div
            key={creditNote.id}
            className="flex justify-between items-center py-4 px-5 border-b border-gray-100 hover:bg-gray-50/50 transition-all active:bg-gray-50"
          >
            <div
              className="flex flex-col cursor-pointer grow pr-4"
              onClick={() => onDetails(creditNote.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 text-sm">
                  {creditNote.credit_note_number}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${getStatusBadge(
                    creditNote.status,
                  )}`}
                >
                  {creditNote.status.charAt(0).toUpperCase() +
                    creditNote.status.slice(1)}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 mb-0.5">
                {creditNote.party_name}
              </span>
              <div className="flex items-center gap-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(creditNote.date).toLocaleDateString()}
                </span>
                {creditNote.invoice_no && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Inv: {creditNote.invoice_no}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="font-bold text-primary text-sm">
                  ₹{creditNote.amount?.toLocaleString("en-IN") || "0"}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center size-9 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all shrink-0">
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 p-1 shadow-lg border-gray-200"
              >
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => onEdit(creditNote.id)}
                >
                  <Edit className="mr-2 h-4 w-4 text-gray-500" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => onDetails(creditNote.id)}
                >
                  <Eye className="mr-2 h-4 w-4 text-gray-500" />
                  View Details
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100"></div>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                  onClick={() => onDelete(creditNote.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {creditNotes.length === 0 && !isLoading && (
          <div className="p-16 text-center">
            <div className="flex flex-col items-center gap-2">
              <Search className="text-3xl text-gray-200" />
              <span className="text-gray-400 text-sm font-medium">
                No credit notes found.
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const columns = useMemo<ColumnDef<CreditNote>[]>(
    () => [
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
      },
      {
        accessorKey: "date",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Date"
            column={column}
            className="justify-start"
          />
        ),
        cell: (info) => (
          <div className="text-sm text-gray-900">
            {new Date(info.getValue() as string).toLocaleDateString()}
          </div>
        ),
        meta: {
          headerClassName: "min-w-[100px]",
        },
      },
      {
        accessorKey: "credit_note_number",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Credit Note Number"
            column={column}
            className="justify-start"
          />
        ),
        cell: (info) => (
          <div className="text-sm font-medium text-primary">
            {info.getValue() as string}
          </div>
        ),
        meta: {
          headerClassName: "min-w-[150px]",
        },
      },
      {
        accessorKey: "party_name",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Party Name"
            column={column}
            className="justify-start"
          />
        ),
        cell: (info) => (
          <div className="text-sm text-gray-900">
            {info.getValue() as string}
          </div>
        ),
        meta: {
          headerClassName: "min-w-[180px]",
        },
      },
      {
        accessorKey: "invoice_no",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Invoice No"
            column={column}
            className="justify-start"
          />
        ),
        cell: (info) => (
          <div className="text-sm text-gray-900">
            {info.getValue() as string}
          </div>
        ),
        meta: {
          headerClassName: "min-w-[120px]",
        },
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Amount"
            column={column}
            className="justify-end"
          />
        ),
        cell: (info) => (
          <div className="text-sm font-medium text-right">
            ₹{(info.getValue() as number)?.toLocaleString("en-IN") || "0"}
          </div>
        ),
        meta: {
          headerClassName: "min-w-[100px] justify-end",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Status"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => {
          const status = info.getValue() as string;
          return (
            <div className="flex items-center justify-center">
              <span
                className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(status)}`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          );
        },
        meta: {
          headerClassName: "min-w-[100px]",
        },
      },
      {
        accessorKey: "actions",
        header: "Actions",
        enableSorting: false,
        meta: {
          headerClassName: "w-28",
          cellClassName: "text-gray-800 font-medium pointer-events-auto",
          disableRowClick: true,
        },
        cell: ({ row }) => {
          const [isOpen, setIsOpen] = useState(false);

          useEffect(() => {
            setIsDropdownOpen(isOpen);
          }, [isOpen]);

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
                      navigate(`/sales/credit-note/${row.original.id}`);
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
                      navigate(`/sales/credit-note/${row.original.id}/edit`);
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
                      e.nativeEvent.stopImmediatePropagation();
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
    ],
    [],
  );

  return (
    <div className="container-fluid p-4 sm:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Credit Notes</h1>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Desktop Status Segmented Filter */}
          <div className="hidden sm:flex items-center px-1.5 py-1 bg-gray-50/50 backdrop-blur-sm rounded-xl border border-gray-200/80 shadow-sm w-fit">
            <div className="flex items-center pl-2 pr-3 border-r border-gray-200/80 mr-1">
              <Filter className="h-3.5 w-3.5 text-gray-900 mr-2" />
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-900">Filters</span>
            </div>
            <div className="relative flex items-center">
              {/* Animated Slider Background with Glow */}
              <div
                className={`absolute inset-y-0 rounded-lg border shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${selectedStatus === 'all' ? 'bg-white border-gray-200 shadow-gray-200/50' :
                    selectedStatus === 'unpaid' ? 'bg-orange-50 border-orange-200 shadow-orange-200/50' :
                      'bg-blue-50 border-blue-200 shadow-blue-200/50'
                  }`}
                style={{
                  width: '90px',
                  transform: `translateX(${selectedStatus === 'all' ? '0px' :
                    selectedStatus === 'unpaid' ? '90px' : '180px'
                    })`
                }}
              />
              <button
                onClick={() => setSelectedStatus('all')}
                className={`relative w-[90px] py-1.5 text-sm font-bold rounded-md transition-all duration-300 z-10 ${selectedStatus === 'all' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedStatus('unpaid')}
                className={`relative w-[90px] py-1.5 text-sm font-bold rounded-md transition-all duration-300 z-10 ${selectedStatus === 'unpaid' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Unpaid
              </button>
              <button
                onClick={() => setSelectedStatus('refunded')}
                className={`relative w-[90px] py-1.5 text-sm font-bold rounded-md transition-all duration-300 z-10 ${selectedStatus === 'refunded' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Refunded
              </button>
            </div>
          </div>

          {/* Mobile Fallback Status Filter */}
          <div className="w-full sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full justify-between">
                  <div className="flex items-center overflow-hidden">
                    <Filter className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate ml-1">
                      {selectedStatus === 'all' && 'All Credit Notes'}
                      {selectedStatus === 'unpaid' && 'Unpaid'}
                      {selectedStatus === 'refunded' && 'Refunded'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem onClick={() => setSelectedStatus('all')} className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-gray-500" />
                  <span>All Credit Notes</span>
                  {selectedStatus === 'all' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatus('unpaid')} className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-orange-500" />
                  <span>Unpaid</span>
                  {selectedStatus === 'unpaid' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatus('refunded')} className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-blue-500" />
                  <span>Refunded</span>
                  {selectedStatus === 'refunded' && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="w-full sm:w-[calc(50%-0.25rem)] md:w-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-full md:w-fit px-4 gap-2 bg-gray-50/50 backdrop-blur-sm rounded-xl border border-gray-200/80 shadow-sm text-gray-900 font-bold hover:bg-gray-100/50 transition-all"
                >
                  <Calendar className="h-4 w-4 text-gray-900" />
                  <span className="truncate">
                    {selectedDateFilter === "today" && "Today"}
                    {selectedDateFilter === "this_week" && "This Week"}
                    {selectedDateFilter === "last_week" && "Last Week"}
                    {selectedDateFilter === "this_month" && "This Month"}
                    {selectedDateFilter === "last_month" && "Last Month"}
                    {selectedDateFilter === "last_365" && "Last 365 Days"}
                    {selectedDateFilter === "all" && "All Time"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuItem onClick={() => setSelectedDateFilter("today")}>
                  Today
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("this_week")}
                >
                  This Week
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("last_week")}
                >
                  Last Week
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("this_month")}
                >
                  This Month
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("last_month")}
                >
                  Last Month
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("last_365")}
                >
                  Last 365 Days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter("all")}>
                  All Time
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Create Button moved to table header */}
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b w-full">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
            <div className="relative w-full sm:w-80">
              <DropdownMenu
                open={showSuggestions}
                onOpenChange={setShowSuggestions}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 w-80 justify-start px-3"
                    disabled={isDropdownLoading}
                  >
                    {isDropdownLoading ? (
                      <span className="flex items-center">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading...
                      </span>
                    ) : (
                      searchTerm ||
                      (searchType === "party_name"
                        ? "Select by party name..."
                        : "Select by credit note number...")
                    )}
                    {!isDropdownLoading && (
                      <ChevronDown className="ml-auto h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto">
                  <DropdownMenuItem
                    onClick={() => {
                      setSearchTerm("");
                      setRefreshKey((prev) => prev + 1);
                    }}
                    className={!searchTerm ? "bg-blue-50 text-blue-600" : ""}
                  >
                    <span className="text-gray-500">
                      Show All{" "}
                      {searchType === "party_name"
                        ? "Parties"
                        : "Credit Notes"}
                    </span>
                  </DropdownMenuItem>
                  {isDropdownLoading ? (
                    <DropdownMenuItem disabled>
                      <div className="flex items-center justify-center w-full py-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading options...
                      </div>
                    </DropdownMenuItem>
                  ) : (
                    <>
                      {searchType === "party_name" ? (
                        allCustomerNames.map((item: any) => {
                          const displayValue = item.name;
                          const keyValue = item.uuid;
                          return (
                            <DropdownMenuItem
                              key={keyValue}
                              onClick={() => {
                                setSearchTerm(displayValue);
                                setRefreshKey((prev) => prev + 1);
                              }}
                              className={
                                searchTerm === displayValue
                                  ? "bg-blue-50 text-blue-600"
                                  : ""
                              }
                            >
                              {displayValue}
                            </DropdownMenuItem>
                          );
                        })
                      ) : (
                        allCreditNoteNumbers.map((item: any, index: number) => {
                          const displayValue = item;
                          const keyValue = index;
                          return (
                            <DropdownMenuItem
                              key={keyValue}
                              onClick={() => {
                                setSearchTerm(displayValue);
                                setRefreshKey((prev) => prev + 1);
                              }}
                              className={
                                searchTerm === displayValue
                                  ? "bg-blue-50 text-blue-600"
                                  : ""
                              }
                            >
                              {displayValue}
                            </DropdownMenuItem>
                          );
                        })
                      )}
                      {(searchType === "party_name" ? allCustomerNames : allCreditNoteNumbers).length === 0 && (
                        <DropdownMenuItem disabled>
                          <span className="text-gray-500">No {searchType === "party_name" ? "parties" : "credit notes"} found</span>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Desktop Segmented Filter Type */}
            <div className="hidden sm:flex relative p-1 bg-gray-100 rounded-lg border border-gray-200/60 shadow-inner w-fit h-10 items-center">
              <div
                className={`absolute inset-y-1 rounded-md border shadow-sm transition-all duration-300 ease-out ${searchType === 'party_name' ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'
                  }`}
                style={{
                  width: '120px',
                  transform: `translateX(${searchType === 'party_name' ? '0px' : '120px'})`
                }}
              />
              <button
                onClick={() => handleSearchTypeChange('party_name')}
                className={`relative w-[120px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === 'party_name' ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Party Name
              </button>
              <button
                onClick={() => handleSearchTypeChange('credit_note_number')}
                className={`relative w-[120px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === 'credit_note_number' ? 'text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Credit Note No.
              </button>
            </div>

            {/* Mobile Dropdown Fallback */}
            <div className="sm:hidden w-full sm:w-auto">
              <DropdownMenu
                open={showFilterDropdown}
                onOpenChange={setShowFilterDropdown}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-md px-3 text-sm text-gray-600 w-full flex items-center justify-between"
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
                    onClick={() => {
                      handleSearchTypeChange('party_name');
                      setShowFilterDropdown(false);
                    }}
                    className={searchType === 'party_name' ? "bg-blue-50 text-blue-600" : ""}
                  >
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Party Name
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      handleSearchTypeChange('credit_note_number');
                      setShowFilterDropdown(false);
                    }}
                    className={searchType === 'credit_note_number' ? "bg-blue-50 text-blue-600" : ""}
                  >
                    <Filter className="h-3.5 w-3.5 mr-2" />
                    Credit Note No.
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="w-full sm:w-auto sm:ml-auto">
              <Button
                size="sm"
                className="h-10 gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 rounded-lg shadow-md shadow-blue-100 transition-all active:scale-95"
                onClick={() => navigate("/sales/credit-note/create")}
              >
                <Plus className="h-4 w-4" />
                <span className="whitespace-nowrap">Create Credit Note</span>
              </Button>
            </div>
          </div>
        </div>
        <div className="overflow-auto relative w-full">
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80">
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
            serverSide={true}
            onFetchData={fetchCreditNotes}
            rowSelection
            getRowId={(row: any) => row.id?.toString()}
            pagination={{ size: 5 }}
            onRowClick={(row: any) => {
              if (showDeleteDialog || isDropdownOpen) {
                return;
              }
              const clickedElement = document.activeElement;
              if (
                clickedElement &&
                clickedElement.getAttribute("data-dropdown-trigger") === "true"
              ) {
                return;
              }
              navigate(`/sales/credit-note/${row.original.id}`);
            }}
            layout={{
              card: true,
              classes: {
                container: 'hidden lg:block',
                table: "cursor-pointer [&_tr:hover]:bg-gray-50",
              },
            }}
          >
            <MobileView
              onEdit={(id) => navigate(`/sales/credit-note/${id}/edit`)}
              onDetails={(id) => navigate(`/sales/credit-note/${id}`)}
              onDelete={(id) => handleDelete(id)}
            />
          </DataGrid>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden">
          <div className="p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900 mb-4">
              Delete Credit Note
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Are you sure you want to delete this credit note? This action will
              permanently remove all of its data from our servers.
            </DialogDescription>
          </div>
          <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleDeleteCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Deleting...
                </div>
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { CreditInpage };
