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
import { cn } from "@/lib/utils";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
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
  const [searchInputValue, setSearchInputValue] = useState("");

  // Fetch autocomplete data for search suggestions
  const fetchAutocompleteData = useCallback(async () => {
    setIsDropdownLoading(true);
    try {
      // 1. Fetch Customers
      try {
        const customerResponse = await getCustomerNamesDropdown();
        if (customerResponse.success && customerResponse.data) {
          const rawData = Array.isArray(customerResponse.data)
            ? customerResponse.data
            : (customerResponse.data.data || customerResponse.data.customers || customerResponse.data.parties || []);

          const uniqueCustomers = new Map();
          if (Array.isArray(rawData)) {
            rawData.forEach((item: any) => {
              const name = item.name || item.party_name || item.customer_name || "";
              if (name && !uniqueCustomers.has(name)) {
                uniqueCustomers.set(name, {
                  uuid: item.uuid || item.id || item.customer_id || "",
                  name: name
                });
              }
            });
          }

          const customerNames = Array.from(uniqueCustomers.values())
            .sort((a: any, b: any) => a.name.localeCompare(b.name));
          setAllCustomerNames(customerNames);
        }
      } catch (err) {
        console.error("Failed to fetch customer dropdown data", err);
      }

      // 2. Fetch Credit Note Numbers
      try {
        const creditNoteNumberResponse = await getCreditNoteNumbersDropdown();
        if (creditNoteNumberResponse.success && creditNoteNumberResponse.data) {
          const rawData = Array.isArray(creditNoteNumberResponse.data)
            ? creditNoteNumberResponse.data
            : (creditNoteNumberResponse.data.data || creditNoteNumberResponse.data.credit_notes || creditNoteNumberResponse.data.numbers || []);

          const uniqueNumbers = new Set<string>();
          if (Array.isArray(rawData)) {
            rawData.forEach((item: any) => {
              const num = typeof item === 'string' ? item : (item.credit_note_number || item.creditNoteNo || item.number || item.uuid || item.id);
              if (num) uniqueNumbers.add(String(num));
            });
          }

          const creditNoteNumbers = Array.from(uniqueNumbers).sort((a, b) => a.localeCompare(b));
          setAllCreditNoteNumbers(creditNoteNumbers);
        }
      } catch (err) {
        console.error("Failed to fetch credit note numbers dropdown data", err);
      }
    } catch (error) {
      console.error("Autocomplete fetch error:", error);
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
    const term = searchInputValue.toLowerCase();
    if (term) {
      const suggestions =
        searchType === "party_name"
          ? allCustomerNames
            .filter((item: any) => {
              const name = item.name || item.party_name || "";
              return name.toLowerCase().includes(term);
            })
            .map((item: any) => item.name || item.party_name || "")
          : allCreditNoteNumbers.filter((item: any) =>
            String(item).toLowerCase().includes(term),
          );
      setFilteredSuggestions(suggestions as string[]);
    } else {
      const suggestions =
        searchType === "party_name"
          ? allCustomerNames.map((item: any) => item.name || item.party_name || "")
          : allCreditNoteNumbers.map((item: any) => String(item));
      setFilteredSuggestions(suggestions as string[]);
    }
  }, [searchInputValue, searchType, allCustomerNames, allCreditNoteNumbers]);

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
            [searchType === "party_name" ? "party_name" : "credit_note_number"]: searchTerm,
          }),
          status: selectedStatus === "all" ? "" : selectedStatus,
          date_filter: selectedDateFilter,
        };

        const response = await getCreditNotes(apiParams);

        if (response.success && response.data) {
          // Robust data extraction
          let notesArray: any[] = [];
          const rawData = response.data.data || response.data;

          if (Array.isArray(rawData)) {
            notesArray = rawData;
          } else if (rawData && typeof rawData === 'object') {
            notesArray = rawData.credit_notes || rawData.data || (Array.isArray(rawData) ? rawData : []);

            // If still not an array and rawData is the whole response, check for 'credit_notes' at top level
            if (!Array.isArray(notesArray)) {
              notesArray = response.data.credit_notes || [];
            }
          }

          const formattedData = Array.isArray(notesArray)
            ? notesArray.map((note: any) => {
              return {
                id: note.uuid?.toString() || note.id?.toString() || "",
                date: note.credit_note_date || note.date || "",
                credit_note_number: note.credit_note_number || note.creditNoteNo || note.number || note.uuid || "",
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
      active: "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-500 border-green-200 dark:border-green-800",
      draft: "bg-gray-50 dark:bg-zinc-800 dark:text-zinc-400 border-gray-200 dark:border-zinc-700",
      cancelled: "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-500 border-red-200 dark:border-red-800",
      refunded: "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
      unpaid: "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-500 border-red-200 dark:border-red-800",
    };
    return styles[status] || "bg-gray-50 dark:bg-zinc-800 dark:text-zinc-400 border-gray-200 dark:border-zinc-700";
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
            className="flex justify-between items-center py-4 px-5 border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50/50 dark:hover:bg-zinc-900/80 transition-all active:bg-gray-50 dark:active:bg-zinc-900/40"
          >
            <div
              className="flex flex-col cursor-pointer grow pr-4"
              onClick={() => onDetails(creditNote.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">
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
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-0.5">
                {creditNote.party_name}
              </span>
              <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-zinc-500">
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
                <button className="flex items-center justify-center size-9 text-gray-400 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-all shrink-0">
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 p-1 shadow-lg bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800"
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
                  <Eye className="mr-2 h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  View Details
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100 dark:border-zinc-800"></div>
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
              <Search className="text-3xl text-gray-200 dark:text-zinc-800" />
              <span className="text-gray-400 dark:text-zinc-600 text-sm font-medium">
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
          <div className="text-sm text-gray-900 dark:text-zinc-100">
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
          <div className="text-sm font-medium text-primary dark:text-blue-400">
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
          <div className="text-sm text-gray-900 dark:text-zinc-100">
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
          <div className="text-sm text-gray-900 dark:text-zinc-100">
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
          <div className="text-sm font-medium text-right dark:text-zinc-100">
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
                className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border",
                  getStatusBadge(status)
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse bg-current" />
                {status.toUpperCase()}
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

                <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/sales/credit-note/${row.original.id}`);
                      setIsOpen(false);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4 text-gray-500 dark:text-zinc-400" />
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
    <div className="w-full px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Credit Notes</h1>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Desktop Status Segmented Filter */}
          <div className="hidden sm:flex items-center px-1.5 py-1 bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-zinc-800 shadow-sm w-fit">
            <div className="flex items-center pl-2 pr-3 border-r border-gray-200/80 dark:border-gray-100/10 mr-1">
              <Filter className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-[10px] uppercase tracking-widest font-extrabold text-gray-900 dark:text-white">Filters</span>
            </div>
            <div className="relative flex items-center">
              {/* Animated Slider Background with Glow */}
              <div
                className={`absolute inset-y-0 rounded-lg border shadow-[0_2px_12px_-2px_rgba(59,130,246,0.15)] dark:shadow-[0_2px_15px_-3px_rgba(59,130,246,0.3)] transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${selectedStatus === 'all' ? 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 shadow-gray-200/50 dark:shadow-none' :
                  selectedStatus === 'unpaid' ? 'bg-orange-50 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/50 shadow-orange-200/50 dark:shadow-none' :
                    'bg-purple-50 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/50 shadow-purple-200/50 dark:shadow-none'
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
                className={`relative w-[90px] h-8 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'all' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedStatus('unpaid')}
                className={`relative w-[90px] h-8 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'unpaid' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                Unpaid
              </button>
              <button
                onClick={() => setSelectedStatus('refunded')}
                className={`relative w-[90px] h-8 text-sm font-medium rounded-md transition-all duration-300 z-10 ${selectedStatus === 'refunded' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                Refunded
              </button>
            </div>
          </div>

          <div className="w-full sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 w-full justify-between bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white font-bold">
                  <div className="flex items-center overflow-hidden">
                    <Filter className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="truncate ml-1">
                      {selectedStatus === 'all' && 'All Credit Notes'}
                      {selectedStatus === 'unpaid' && 'Unpaid'}
                      {selectedStatus === 'refunded' && 'Refunded'}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                <DropdownMenuItem onClick={() => setSelectedStatus('all')} className="flex items-center gap-2 text-gray-700 dark:text-zinc-300">
                  <Circle className="h-4 w-4 text-gray-500" />
                  <span>All Credit Notes</span>
                  {selectedStatus === 'all' && <Check className="h-4 w-4 ml-auto text-blue-600 dark:text-blue-400" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatus('unpaid')} className="flex items-center gap-2 text-gray-700 dark:text-zinc-300">
                  <Circle className="h-4 w-4 text-orange-500" />
                  <span>Unpaid</span>
                  {selectedStatus === 'unpaid' && <Check className="h-4 w-4 ml-auto text-blue-600 dark:text-blue-400" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatus('refunded')} className="flex items-center gap-2 text-gray-700 dark:text-zinc-300">
                  <Circle className="h-4 w-4 text-blue-500" />
                  <span>Refunded</span>
                  {selectedStatus === 'refunded' && <Check className="h-4 w-4 ml-auto text-blue-600 dark:text-blue-400" />}
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
                  className="h-10 w-full md:w-fit px-4 gap-2 bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-gray-200/80 dark:border-zinc-800 shadow-sm text-gray-900 dark:text-white font-extrabold hover:bg-gray-100/50 dark:hover:bg-zinc-800 transition-all"
                >
                  <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
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
              <DropdownMenuContent align="end" className="w-[180px] bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                <DropdownMenuItem onClick={() => setSelectedDateFilter("today")} className="text-gray-700 dark:text-zinc-300">
                  Today
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("this_week")}
                  className="text-gray-700 dark:text-zinc-300"
                >
                  This Week
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("last_week")}
                  className="text-gray-700 dark:text-zinc-300"
                >
                  Last Week
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("this_month")}
                  className="text-gray-700 dark:text-zinc-300"
                >
                  This Month
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("last_month")}
                  className="text-gray-700 dark:text-zinc-300"
                >
                  Last Month
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSelectedDateFilter("last_365")}
                  className="text-gray-700 dark:text-zinc-300"
                >
                  Last 365 Days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedDateFilter("all")} className="text-gray-700 dark:text-zinc-300">
                  All Time
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Create Button moved to table header */}
        </div>
      </div>

      <div className="bg-white/80 dark:bg-zinc-950 backdrop-blur-md border border-gray-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Search Bar */}
        <div className="p-4 border-b border-gray-100/50 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/20">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
            <div className="relative w-full sm:w-80">
              <DropdownMenu
                open={showSuggestions}
                onOpenChange={setShowSuggestions}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 w-full justify-start px-3 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-xl border-gray-200 dark:border-zinc-800 shadow-sm text-gray-900 dark:text-zinc-100 font-medium hover:bg-white dark:hover:bg-zinc-900 transition-all"
                    disabled={isDropdownLoading}
                  >
                    {isDropdownLoading ? (
                      <span className="flex items-center text-xs">
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        Loading...
                      </span>
                    ) : (
                      <span className="truncate text-left text-sm font-medium text-gray-700 dark:text-gray-900">
                        {searchTerm ||
                          (searchType === "party_name"
                            ? "Select by party name..."
                            : "Select by credit note number...")}
                      </span>
                    )}
                    {!isDropdownLoading && (
                      <ChevronDown className="ml-auto h-4 w-4 opacity-50 shrink-0" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 p-0 shadow-xl bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 overflow-hidden rounded-xl">
                  <div className="p-2 border-b border-gray-100/50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
                      <Input
                        placeholder={`Search ${searchType === "party_name" ? "parties" : "credit notes"}...`}
                        value={searchInputValue}
                        onChange={(e) => setSearchInputValue(e.target.value)}
                        className="h-8 pl-8 text-xs bg-white dark:bg-gray-200 border-gray-200 dark:border-gray-300 text-gray-900 dark:text-gray-900 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg focus-visible:ring-blue-500/20"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    <DropdownMenuItem
                      onClick={() => {
                        setSearchTerm("");
                        setSearchInputValue("");
                        setRefreshKey((prev) => prev + 1);
                      }}
                      className={cn(
                        "flex items-center px-3 py-2 text-xs rounded-md cursor-pointer mb-1 transition-colors",
                        !searchTerm ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-zinc-500 hover:bg-gray-50 dark:hover:bg-zinc-900"
                      )}
                    >
                      <span className="font-medium">
                        Show All{" "}
                        {searchType === "party_name"
                          ? "Parties"
                          : "Credit Notes"}
                      </span>
                    </DropdownMenuItem>
                    {isDropdownLoading ? (
                      <div className="flex items-center justify-center w-full py-4">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span className="text-xs text-gray-500 dark:text-gray-600">Loading options...</span>
                      </div>
                    ) : (
                      <>
                        {filteredSuggestions.map((displayValue: any, index: number) => {
                          const isSelected = searchTerm === displayValue;
                          return (
                            <DropdownMenuItem
                              key={index}
                              onClick={() => {
                                setSearchTerm(displayValue);
                                setSearchInputValue("");
                                setRefreshKey((prev) => prev + 1);
                              }}
                              className={cn(
                                "flex items-center px-3 py-2 text-xs rounded-md cursor-pointer transition-colors",
                                isSelected ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-900"
                              )}
                            >
                              <span className="truncate">{displayValue}</span>
                              {isSelected && <Check className="ml-auto h-3.5 w-3.5" />}
                            </DropdownMenuItem>
                          );
                        })}
                        {filteredSuggestions.length === 0 && (
                          <div className="py-4 text-center">
                            <span className="text-xs text-gray-500 dark:text-gray-600 italic">
                              No {searchType === "party_name" ? "parties" : "credit notes"} found
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Desktop Segmented Filter Type */}
            <div className="hidden sm:flex relative p-0.5 bg-gray-100 dark:bg-zinc-900 rounded-lg border border-gray-200/60 dark:border-zinc-800 shadow-inner w-fit items-center">
              <div
                className={`absolute inset-y-0.5 rounded-md border shadow-sm transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${searchType === 'party_name' ? 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700' : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700'}`}
                style={{
                  width: '120px',
                  transform: `translateX(${searchType === 'party_name' ? '0px' : '120px'})`
                }}
              />
              <button
                onClick={() => handleSearchTypeChange('party_name')}
                className={`relative w-[120px] py-1.5 text-sm font-bold rounded-lg transition-colors duration-200 z-10 ${searchType === 'party_name' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                Party Name
              </button>
              <button
                onClick={() => handleSearchTypeChange('credit_note_number')}
                className={`relative w-[120px] py-1.5 text-sm font-bold rounded-lg transition-colors duration-200 z-10 ${searchType === 'credit_note_number' ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
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
                    className="h-10 rounded-xl px-3 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-white font-bold w-full flex items-center justify-between"
                  >
                    <div className="flex items-center truncate min-w-0">
                      <Filter className="h-3.5 w-3.5 mr-1 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">
                        {searchTerm ? (searchType === 'party_name' ? 'Party' : 'No.') : 'Search by'}
                      </span>
                    </div>
                    <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800" align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      handleSearchTypeChange('party_name');
                      setShowFilterDropdown(false);
                    }}
                    className={cn("text-gray-700 dark:text-zinc-300", searchType === 'party_name' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "")}
                  >
                    <Filter className="h-3.5 w-3.5 mr-2 text-gray-400 dark:text-zinc-500" />
                    Party Name
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      handleSearchTypeChange('credit_note_number');
                      setShowFilterDropdown(false);
                    }}
                    className={cn("text-gray-700 dark:text-zinc-300", searchType === 'credit_note_number' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "")}
                  >
                    <Filter className="h-3.5 w-3.5 mr-2 text-gray-400 dark:text-zinc-500" />
                    Credit Note No.
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="w-full sm:w-auto sm:ml-auto">
              <button
                className="group flex items-center justify-center gap-2 px-5 h-10 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-800 transition-all active:scale-95 w-full sm:w-auto"
                onClick={() => navigate("/sales/credit-note/create")}
              >
                <Plus className="size-4 text-blue-600 dark:text-blue-400 group-hover:rotate-90 transition-transform" />
                <span className="whitespace-nowrap tracking-wider">Create Credit Note</span>
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-auto relative w-full">
          {isLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
              <SpinnerDotted
                size={50}
                thickness={100}
                speed={100}
                color="#3b82f6"
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
                table: "cursor-pointer [&_tr:hover]:bg-gray-50 dark:[&_tr:hover]:bg-zinc-900/80 [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-gray-500 dark:[&_th]:text-zinc-500",
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

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Credit Note"
        message="Are you sure you want to delete this credit note? This action will permanently remove all of its data and cannot be undone."
        confirmText={isDeleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        variant="danger"
      />
    </div>
  );
};

export { CreditInpage };
