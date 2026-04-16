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
        let customerData = customerResponse.data;
        if (customerData.data && Array.isArray(customerData.data)) {
          customerData = customerData.data;
        }

        const customerNames = Array.isArray(customerData)
          ? [
              ...new Set(
                customerData
                  .filter(
                    (item: any) => item.party_name && item.party_name.trim(),
                  )
                  .map((item: any) => item.party_name.trim()),
              ),
            ].sort()
          : [];
        setAllCustomerNames(customerNames);
      } else {
        setAllCustomerNames([]);
      }

      if (creditNoteNumberResponse.success && creditNoteNumberResponse.data) {
        // Handle nested structure - data is nested under data.credit_notes
        let creditNoteData = creditNoteNumberResponse.data;
        if (creditNoteData.data && creditNoteData.data.credit_notes) {
          creditNoteData = creditNoteData.data.credit_notes;
        } else if (creditNoteData.credit_notes) {
          creditNoteData = creditNoteData.credit_notes;
        }
        const creditNoteNumbers = Array.isArray(creditNoteData)
          ? creditNoteData
              .map((item: any) => item.credit_note_number || item)
              .filter(Boolean)
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
      type === "party_name" ? allCustomerNames : allCreditNoteNumbers,
    );
  };

  useEffect(() => {
    if (searchTerm) {
      const suggestions =
        searchType === "party_name"
          ? allCustomerNames.filter((name) =>
              name.toLowerCase().includes(searchTerm.toLowerCase()),
            )
          : (allCreditNoteNumbers.filter((item) => {
              const displayValue =
                typeof item === "string" ? item : item.credit_note_number || "";
              return displayValue
                .toLowerCase()
                .includes(searchTerm.toLowerCase());
            }) as string[] | CreditNoteNumberItem[]);
      setFilteredSuggestions(suggestions);
    } else {
      const suggestions =
        searchType === "party_name" ? allCustomerNames : allCreditNoteNumbers;
      setFilteredSuggestions(suggestions);
    }
  }, [searchTerm, searchType, allCustomerNames, allCreditNoteNumbers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Removed the problematic refresh effect

  const handleCreditNoteUpdate = (event: CustomEvent) => {
    console.log('DEBUG - CreditInpage received creditNoteUpdated event:', event.detail);
    // Refresh the credit note data to show updated status
    setRefreshKey((prev) => prev + 1);
  };

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

  // Filter credit notes by status (kept for compatibility but not used with server-side filtering)
  const filteredCreditNotes = useMemo(() => {
    return creditNotes;
  }, [creditNotes]);

  const fetchCreditNotes = useCallback(
    async (params: TDataGridRequestParams) => {
      setIsLoading(true);
      try {
        const apiParams = {
          page: params.pageIndex + 1, // DataGrid uses 0-based indexing
          per_page: params.pageSize,
          sort: params.sorting?.[0]?.id,
          order: params.sorting?.[0]?.desc ? "desc" : "asc",
          ...(searchTerm && {
            [searchType === "party_name" ? "party_name" : "credit_note_number"]:
              searchTerm,
          }),
          status: selectedStatus === "all" ? "" : selectedStatus,
        };

        const response = await getCreditNotes(apiParams);

        if (response.success && response.data) {
          const creditNotesData =
            response.data.credit_notes || response.data.data || response.data;

          // Handle nested structure - credit_notes might be nested under data
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

          // Check if backend returned pagination info
          let totalCount =
            response.data.data?.pagination?.total ||
            response.data.pagination?.total ||
            response.data.total;

          if (!totalCount) {
            // Backend didn't return pagination info, fetch all items to get total count
            try {
              const allItemsResponse = await getCreditNotes({
                per_page: 1000, // Fetch all items
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
    [debouncedSearchTerm, searchType, selectedStatus, refreshKey],
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
      // Get credit note details to find linked invoice before deleting
      const creditNoteResponse = await getCreditNoteById(creditNoteToDelete);
      let linkedInvoiceId = null;

      if (creditNoteResponse.success && creditNoteResponse.data?.data) {
        const creditNoteData = creditNoteResponse.data.data;
        linkedInvoiceId =
          creditNoteData.linked_invoice_id || creditNoteData.linkToInvoice;
      }

      // Delete the credit note
      // Delete the credit note
      const response = await deleteCreditNote(creditNoteToDelete);
      if (response.success) {
        toast.success("Credit note deleted successfully");
        setRefreshKey((prev) => prev + 1); // Refresh autocomplete data

        // Skip invoice status update due to API CORS issues
        // TODO: Re-enable when API endpoints are fixed
        if (linkedInvoiceId) {
          // Invoice status update skipped
        }

        // Trigger a custom event to notify CreateCreditNotePage to refresh invoice dropdown
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
          <div className="w-full sm:w-[calc(50%-0.25rem)] md:w-44">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full gap-1"
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {selectedStatus === "all" && "All Credit Notes"}
                    {selectedStatus === "unpaid" && "Unpaid"}
                    {selectedStatus === "refunded" && "Refunded"}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus("all");
                    setRefreshKey((prev) => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-gray-500" />
                  <span>All Credit Notes</span>
                  {selectedStatus === "all" && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus("unpaid");
                    setRefreshKey((prev) => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-orange-500" />
                  <span>Unpaid</span>
                  {selectedStatus === "unpaid" && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus("refunded");
                    setRefreshKey((prev) => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-blue-500" />
                  <span>Refunded</span>
                  {selectedStatus === "refunded" && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="w-full sm:w-[calc(50%-0.25rem)] md:w-36">
            <Button variant="outline" size="sm" className="h-8 w-full gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Last 365 Days
              </span>
            </Button>
          </div>

          <Button
            size="sm"
            className="h-8 gap-1 w-full sm:w-auto mt-2 sm:mt-0"
            onClick={() => navigate("/sales/credit-note/create")}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Create Credit Note
            </span>
          </Button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 bg-white border-b justify-center ">
          <div className="relative w-fit">
            <div className="flex items-center gap-2">
              <div className="relative">
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
                      (searchType === "party_name"
                        ? allCustomerNames
                        : allCreditNoteNumbers
                      ).map((item, index) => {
                        const displayValue =
                          typeof item === "string"
                            ? item
                            : item.credit_note_number;
                        const keyValue =
                          typeof item === "string" ? index : item.uuid || index;

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
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="relative w-full sm:w-auto">
                <DropdownMenu
                  open={showFilterDropdown}
                  onOpenChange={setShowFilterDropdown}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-md px-3 text-sm text-gray-600 w-full sm:w-auto"
                    >
                      <Filter className="h-3.5 w-3.5 mr-1 text-blue-500" />
                      {searchTerm
                        ? `${searchType === "party_name" ? "Party" : "Credit Note"}: ${searchTerm}`
                        : "Filter by"}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80 max-h-60 overflow-y-auto">
                    <DropdownMenuItem
                      onClick={() => {
                        handleSearchTypeChange("party_name");
                        setShowFilterDropdown(false);
                      }}
                      className={`flex items-center gap-2 ${
                        searchType === "party_name"
                          ? "bg-blue-50 text-blue-600"
                          : ""
                      }`}
                    >
                      <Filter className="h-3.5 w-3.5 mr-2" />
                      <span>Party Name</span>
                      {searchType === "party_name" && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        handleSearchTypeChange("credit_note_number");
                        setShowFilterDropdown(false);
                      }}
                      className={`flex items-center gap-2 ${
                        searchType === "credit_note_number"
                          ? "bg-blue-50 text-blue-600"
                          : ""
                      }`}
                    >
                      <Filter className="h-3.5 w-3.5 mr-2" />
                      <span>Credit Note Number</span>
                      {searchType === "credit_note_number" && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
              </div>
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
            key={refreshKey}
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
