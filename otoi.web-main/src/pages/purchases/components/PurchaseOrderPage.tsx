import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  DataGrid,
  DataGridColumnHeader,
  DataGridRowSelect,
  DataGridRowSelectAll,
} from "@/components";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Filter,
  ChevronDown,
  Check,
  Circle,
  CircleCheck,
  MoreVertical,
  Edit,
  Eye,
  Copy,
  Trash2,
  AlertCircle,
  FileText,
  CreditCard,
  Calendar,
  Info,
  User,
  Search,
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
import {
  getPurchaseOrders,
  deletePurchaseOrder,
  getPurchaseOrderById,
  getAllVendorsDropdown,
  getPurchaseOrderNumbersDropdown,
} from "../services/purchaseOrder.services";
import {
  createPurchaseInvoiceFromPO,
  recordPurchaseInvoicePayment,
} from "../services/purchaseInvoice.services";
import { toast } from "sonner";
import { TDataGridRequestParams } from "@/components";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PurchaseOrder {
  id: string;
  date: string;
  po_number: number;
  vendor_name: string;
  delivery_date: string;
  amount: number;
  status: string;
  invoice?: {
    uuid: string;
    invoice_number: string;
    payment_status: string;
    balance_due: number;
  } | null;
}

interface PaginationData {
  total: number;
  items_per_page: number;
  current_page: number;
  last_page: number;
  from: number;
  to: number;
  prev_page_url: string | null;
  next_page_url: string | null;
  first_page_url: string | null;
}

const PurchaseOrderPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [poToDelete, setPoToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "open" | "closed" | "received"
  >("open");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchType, setSearchType] = useState<"vendor_name" | "po_number">(
    "vendor_name",
  );
  const [allVendorNames, setAllVendorNames] = useState<string[]>([]);
  const [allPoNumbers, setAllPoNumbers] = useState<string[]>([]);
  const [isDropdownLoading, setIsDropdownLoading] = useState(false);
  // Initialize showSuggestions state to ensure it's available
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    items_per_page: 5,
    current_page: 1,
    last_page: 1,
    from: 0,
    to: 0,
    prev_page_url: null,
    next_page_url: null,
    first_page_url: null,
  });

  // ── Purchase Invoice state ──
  const [isConvertingId, setIsConvertingId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    invoiceId: string;
    invoiceNumber: string;
    balanceDue: number;
  } | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    discount: 0,
    date: new Date(),
    mode: "Cash",
    notes: ""
  });
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  // Map poId -> { invoiceId, invoiceNumber, payment_status, balance_due }
  const [invoiceStatusMap, setInvoiceStatusMap] = useState<
    Record<string, { invoiceId: string; invoiceNumber: string; payment_status: string; balance_due: number }>
  >({});
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('last_365');

  const navigate = useNavigate();

  // Fetch vendor names and PO numbers for autocomplete
  const fetchAutocompleteData = useCallback(async () => {
    try {
      setIsDropdownLoading(true);

      const vendorResponse = await getAllVendorsDropdown();
      if (vendorResponse.success && vendorResponse.data) {
        const vendorNames = vendorResponse.data
          .map((v: any) => v.name)
          .filter((name: string) => name && name !== "N/A");
        setAllVendorNames(vendorNames);
      }

      const poResponse = await getPurchaseOrderNumbersDropdown();
      if (poResponse.success && poResponse.data) {
        const poData = poResponse.data.data || poResponse.data;
        const poNumbers = poData
          .map((p: any) => p.po_number)
          .filter((num: any) => num);
        setAllPoNumbers(poNumbers);
      }
    } catch {
      // silently fail
    } finally {
      setIsDropdownLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutocompleteData();
  }, [fetchAutocompleteData]);

  useEffect(() => {
    fetchAutocompleteData();
  }, [searchType]);

  useEffect(() => {
    fetchAutocompleteData();
  }, [refreshKey]);

  const handleSearchTypeChange = (type: "vendor_name" | "po_number") => {
    setSearchType(type);
    setSearchTerm("");
    // Don't immediately refresh when changing search type
    // Only refresh when user actually searches
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Refresh data when search term or date filter changes (not search type)
  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [debouncedSearchTerm, selectedDateFilter]);

  // Fetch purchase orders
  const fetchPurchaseOrders = useCallback(
    async (params: TDataGridRequestParams) => {
      try {
        setIsLoading(true);

        const response = await getPurchaseOrders({
          search: searchTerm,
          vendor_name: searchType === "vendor_name" ? searchTerm : "",
          po_number: searchType === "po_number" ? searchTerm : "",
          status: selectedStatus === "all" ? "" : selectedStatus,
          date_filter: selectedDateFilter,
          page: params.pageIndex + 1,
          per_page: params.pageSize,
          sort: "delivery_date",
          order: "asc",
        });

        if (response.success && response.data) {
          const poData = response.data.data || [];
          const paginationData = response.data.pagination || {};

          const transformed = poData.map((item: any) => ({
            id: item.uuid,
            date: item.po_date || item.created_at,
            po_number: item.po_number,
            vendor_name: item.vendor_name || "N/A",
            delivery_date: item.delivery_date || "N/A",
            amount: item.total_amount || 0,
            status: item.status || "open",
            invoice: item.invoice,
          }));

          setPurchaseOrders(transformed);
          setPagination(paginationData);

          // Populate the status map for action menu lookups
          const newMap: Record<string, any> = {};
          poData.forEach((item: any) => {
            if (item.invoice) {
              newMap[item.uuid] = {
                invoiceId: item.invoice.uuid,
                invoiceNumber: item.invoice.invoice_number,
                payment_status: item.invoice.payment_status,
                balance_due: item.invoice.balance_due,
              };
            }
          });
          setInvoiceStatusMap((prev) => ({ ...prev, ...newMap }));

          return { data: transformed, totalCount: paginationData.total || 0 };
        } else {
          toast.error(response.error || "Failed to fetch purchase orders");
          return { data: [], totalCount: 0 };
        }
      } catch {
        toast.error("Failed to fetch purchase orders");
        return { data: [], totalCount: 0 };
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, searchType, selectedStatus],
  );

  const handleDeleteConfirm = async () => {
    if (!poToDelete || isDeleting) return;
    setIsDeleting(true);
    const response = await deletePurchaseOrder(poToDelete);
    if (response.success) {
      toast.success("Purchase order deleted successfully");
      setPurchaseOrders((prev) => prev.filter((p) => p.id !== poToDelete));
      fetchPurchaseOrders({ pageIndex: 0, pageSize: 5 });
      setRefreshKey((prev) => prev + 1);
      setShowDeleteDialog(false);
    } else {
      toast.error(response.error || "Failed to delete purchase order");
    }
    setPoToDelete(null);
    setIsDeleting(false);
  };

  // ── Record Payment ─────────────────────────────────────────────────────────
  const handleRecordPaymentSubmit = async () => {
    if (!paymentModal) return;
    const amountNum = paymentForm.amount;
    if (amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (amountNum > (paymentModal?.balanceDue || 0) + 0.01) {
      toast.error("Amount cannot exceed balance due");
      return;
    }

    setIsRecordingPayment(true);
    const res = await recordPurchaseInvoicePayment(paymentModal.invoiceId, {
      amount: amountNum,
      payment_mode: paymentForm.mode,
      notes: paymentForm.notes,
    });
    setIsRecordingPayment(false);
    if (res.success) {
      const d = res.data;
      if (d.inventory_just_updated) {
        toast.success(`Payment recorded! Inventory stock has been updated automatically.`);
      } else {
        toast.success(`Payment of ₹${amountNum.toFixed(2)} recorded. Balance due: ₹${d.balance_due.toFixed(2)}`);
      }
      // Update local invoice status
      setInvoiceStatusMap((prev) => {
        if (!prev) return prev;
        const poId = Object.keys(prev).find(
          (k) => prev[k].invoiceId === paymentModal.invoiceId
        );
        if (poId) {
          return {
            ...prev,
            [poId]: {
              ...prev[poId],
              payment_status: d.payment_status,
              balance_due: d.balance_due,
            },
          };
        }
        return prev;
      });
      setPaymentModal(null);
    } else {
      toast.error(res.error || "Failed to record payment");
    }
  };

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <div className="w-full flex items-center justify-center h-full p-0 m-0">
            <DataGridRowSelectAll />
          </div>
        ),
        cell: ({ row }) => (
          <div className="w-full flex items-center justify-center h-full p-0 m-0">
            <DataGridRowSelect row={row} />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerClassName: "w-12 text-center align-middle p-0 m-0",
          cellClassName: "text-center align-middle pointer-events-auto p-0 m-0",
          disableRowClick: true,
        },
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
          <div className="text-sm text-gray-900 dark:text-zinc-100 text-center">
            {new Date(info.getValue() as string).toLocaleDateString()}
          </div>
        ),
        meta: { headerClassName: "min-w-[120px]" },
      },
      {
        accessorKey: "po_number",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="PO Number"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => (
          <div className="text-sm font-medium text-primary hover:underline text-center">
            {info.getValue() as string}
          </div>
        ),
        meta: { headerClassName: "min-w-[120px]" },
      },
      {
        accessorKey: "vendor_name",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Vendor Name"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => (
          <div className="text-sm text-gray-900 dark:text-zinc-100 text-center">
            {info.getValue() as string}
          </div>
        ),
        meta: { headerClassName: "min-w-[200px]" },
      },
      {
        accessorKey: "delivery_date",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Due In"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          if (!value || value === "N/A") return <div className="text-sm text-gray-400 text-center">N/A</div>;

          const deliveryDate = new Date(value);
          const daysRemaining = Math.ceil(
            (deliveryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          return (
            <div className="text-sm text-gray-900 dark:text-zinc-100 text-center">
              {daysRemaining < 0 ? (
                <span className="text-red-600 dark:text-red-500 font-medium">
                  Overdue by {Math.abs(daysRemaining)} days
                </span>
              ) : daysRemaining === 0 ? (
                <span className="text-red-600 dark:text-red-500 font-medium">Due Today</span>
              ) : (
                `${daysRemaining} days`
              )}
            </div>
          );
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const getDaysValue = (value: string): number => {
            if (!value || value === "N/A") return 999999;
            const deliveryDate = new Date(value);
            return deliveryDate.getTime();
          };
          const aVal = getDaysValue(rowA.getValue("delivery_date") as string);
          const bVal = getDaysValue(rowB.getValue("delivery_date") as string);
          return aVal - bVal;
        },
        meta: { headerClassName: "min-w-[100px]" },
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Amount"
            column={column}
            className="justify-center"
          />
        ),
        cell: (info) => (
          <div className="text-sm font-medium text-gray-900 dark:text-zinc-100 text-center">
            ₹{(info.getValue() as number)?.toLocaleString("en-IN") || "0"}
          </div>
        ),
        meta: {
          headerClassName: "min-w-[120px]",
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
                className={`px-2 py-1 text-xs rounded-full border ${status === "open"
                  ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-500 border-green-200 dark:border-green-800"
                  : status === "closed"
                    ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-500 border-red-200 dark:border-red-800"
                    : status === "received"
                      ? "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-500 border-purple-200 dark:border-purple-800"
                      : "bg-gray-50 dark:bg-gray-200/50 text-gray-700 dark:text-gray-800 border-gray-200 dark:border-gray-100"
                  }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          );
        },
        meta: { headerClassName: "min-w-[120px]" },
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Actions"
            column={column}
            className="justify-center"
          />
        ),
        enableSorting: false,
        meta: {
          headerClassName: "w-28",
          cellClassName: "text-gray-800 font-medium pointer-events-auto",
          disableRowClick: true,
        },
        cell: ({ row }) => {
          const [isOpen, setIsOpen] = useState(false);

          const handleEdit = (id: string) => {
            if (row.original.status === "received") {
              toast.error(
                "This purchase order cannot be edited because it has been received.",
              );
              setIsOpen(false);
              return;
            }
            navigate(`/purchases/purchase-orders/${id}/edit`);
            setIsOpen(false);
          };

          const handleDeleteClick = (id: string) => {
            setPoToDelete(id);
            setShowDeleteDialog(true);
            setIsOpen(false);
          };

          const handleDuplicate = async (id: string) => {
            try {
              const response = await getPurchaseOrderById(id);
              if (response.success && response.data) {
                const original = response.data;
                navigate("/purchases/purchase-orders/new", {
                  state: {
                    poData: {
                      poNo: "",
                      poDate: new Date().toISOString().split("T")[0],
                      deliveryDate: new Date(
                        Date.now() + 30 * 24 * 60 * 60 * 1000,
                      )
                        .toISOString()
                        .split("T")[0],
                      status: "open",
                      selectedVendor: original.vendor,
                      poItems: (original.items || []).map((item: any) => ({
                        id: "",
                        item_id: item.item_id,
                        item_name:
                          item.product_name || item.description || "Item",
                        description: item.description,
                        quantity: item.quantity,
                        price_per_item: item.unit_price,
                        discount: item.discount_percentage || 0,
                        tax: item.tax_percentage || 0,
                        amount: item.total_price,
                        measuring_unit_id: 1,
                      })),
                      notes: original.notes,
                      terms: original.terms_and_conditions,
                      isDuplicate: true,
                    },
                    isDuplicate: true,
                  },
                });
                toast.success("Purchase order opened for editing!");
              } else {
                toast.error("Failed to fetch original purchase order");
              }
            } catch {
              toast.error("Failed to duplicate purchase order");
            }
            setIsOpen(false);
          };

          return (
            <div
              className="flex justify-center"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex items-center justify-center text-sm text-primary hover:text-primary-active"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="bg-white dark:bg-gray-100 border-gray-200 dark:border-gray-100">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEdit(row.original.id);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-600" />
                    Edit
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/purchases/purchase-orders/${row.original.id}`);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-600" />
                    View Details
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDuplicate(row.original.id);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-600" />
                    Duplicate
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteClick(row.original.id);
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

  const MobileView = ({
    onEdit,
    onDetails,
    onDuplicate,
    onDelete,
  }: {
    onEdit: (id: string, status: string) => void;
    onDetails: (id: string) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
  }) => {
    return (
      <div className="flex flex-col md:hidden border-t border-gray-100 dark:border-gray-100/10">
        {purchaseOrders.map((po) => (
          <div
            key={po.id}
            className="flex justify-between items-center py-4 px-5 border-b border-gray-100 dark:border-gray-100/10 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-200/50 transition-all active:bg-gray-50 dark:active:bg-gray-200/50"
          >
            <div
              className="flex flex-col cursor-pointer grow pr-4"
              onClick={() => onDetails(po.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  PO #{po.po_number}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] rounded-full font-medium border ${po.status === "open"
                    ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-500 border-green-200 dark:border-green-800"
                    : po.status === "closed"
                      ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-500 border-red-200 dark:border-red-800"
                      : "bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-500 border-purple-200 dark:border-purple-800"
                    }`}
                >
                  {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                </span>
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-0.5">
                {po.vendor_name}
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 dark:text-zinc-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(po.date).toLocaleDateString("en-IN")}
                </span>
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Delivery:{" "}
                  {po.delivery_date === "N/A" ? "N/A" : (() => {
                    const days = Math.ceil((new Date(po.delivery_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return days < 0 ? <span className="text-red-500">Overdue ({Math.abs(days)}d)</span> : days === 0 ? <span className="text-red-500">Today</span> : `${days} days`;
                  })()}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="font-bold text-primary text-sm dark:text-zinc-100">
                  ₹{po.amount?.toLocaleString("en-IN", { minimumFractionDigits: 2 }) || "0.00"}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center size-9 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-all shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 p-1 shadow-lg bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800"
              >
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(po.id, po.status);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-600" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetails(po.id);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-600" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(po.id);
                  }}
                >
                  <Copy className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-600" />
                  Duplicate
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100 dark:border-gray-100/10"></div>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(po.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {purchaseOrders.length === 0 && !isLoading && !isDropdownLoading && (
          <div className="p-16 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                <FileText className="h-6 w-6 text-gray-200" />
              </div>
              <span className="text-gray-400 text-sm font-medium">
                No purchase orders found.
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="w-full px-4 py-6 sm:p-6 relative overflow-x-hidden">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Purchase Orders</h1>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 rounded-md text-[10px] font-bold uppercase tracking-wider border border-gray-200 dark:border-zinc-700">
              Procurement
            </span>
            <span className="text-xs text-gray-400 dark:text-zinc-500 font-medium italic">
              Manage and track your vendor purchase orders
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Floating Glass Status Filter */}
          <div className="relative bg-gray-50/50 dark:bg-gray-200/5 backdrop-blur-md p-1 rounded-xl border border-gray-200/80 dark:border-gray-100 shadow-sm flex items-center min-w-fit">
            {/* Integrated Label */}
            <div className="flex items-center gap-2 px-3 border-r border-gray-200/50 dark:border-gray-100/50 mr-1">
              <Filter className="h-3.5 w-3.5 text-gray-900 dark:text-gray-900" />
              <span className="text-[11px] font-bold text-gray-900 dark:text-white uppercase tracking-wider">Filters</span>
            </div>

            <div className="relative flex items-center">
              {/* Animated Slider Background with Glow */}
              <div
                className={`absolute inset-y-0 rounded-lg border shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] transition-all duration-500 cubic-bezier(0.34,1.56,0.64,1) ${selectedStatus === 'all' ? 'bg-white dark:bg-blue-500/20 border-gray-200 dark:border-blue-500/50 shadow-gray-200/50' :
                  selectedStatus === 'open' ? 'bg-green-50 dark:bg-green-500/20 border-green-200 dark:border-green-500/50 shadow-green-200/50' :
                    selectedStatus === 'closed' ? 'bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/50 shadow-red-200/50' :
                      'bg-purple-50 dark:bg-purple-500/20 border-purple-200 dark:border-purple-500/50 shadow-purple-200/50'
                  }`}
                style={{
                  width: '90px',
                  transform: `translateX(${selectedStatus === 'all' ? '0px' :
                    selectedStatus === 'open' ? '90px' :
                      selectedStatus === 'closed' ? '180px' : '270px'
                    })`
                }}
              />

              {/* Status Buttons */}
              <button
                onClick={() => { setSelectedStatus('all'); setRefreshKey((prev) => prev + 1); }}
                className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'all' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                All
              </button>
              <button
                onClick={() => { setSelectedStatus('open'); setRefreshKey((prev) => prev + 1); }}
                className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'open' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                Open
              </button>
              <button
                onClick={() => { setSelectedStatus('closed'); setRefreshKey((prev) => prev + 1); }}
                className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'closed' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                Closed
              </button>
              <button
                onClick={() => { setSelectedStatus('received'); setRefreshKey((prev) => prev + 1); }}
                className={`relative z-10 w-[90px] h-8 text-[13px] font-medium transition-colors duration-300 ${selectedStatus === 'received' ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                Received
              </button>
            </div>
          </div>

          <div className="flex-grow md:block hidden" />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) setPoToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 shadow-2xl">
          <div className="p-6">
            <DialogHeader className="flex flex-col items-center text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
                <Trash2 className="h-6 w-6 text-red-600 dark:text-red-500" />
              </div>
              <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Purchase Order
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
                Are you sure you want to delete this purchase order? This action will permanently remove all data and cannot be undone.
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="flex items-center justify-end gap-3 p-6 bg-gray-50/50 dark:bg-zinc-900/50 border-t border-gray-100 dark:border-zinc-800">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="h-11 px-6 bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              className="h-11 px-6 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
              disabled={isDeleting || !poToDelete}
            >
              {isDeleting ? (
                <span className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment Modal ─────────────────────────────── */}
      <Dialog
        open={!!paymentModal?.open}
        onOpenChange={(open) => {
          if (!open) { setPaymentModal(null); }
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
          <DialogHeader className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
            <DialogTitle className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2 text-left w-full">
              <CreditCard className="h-5 w-5 text-gray-600 dark:text-zinc-400" />
              Record Payment For Invoice #{paymentModal?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Form Section */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Amount Paid <span className="text-red-500">*</span></label>
                    <Input
                      type="number"
                      value={paymentForm.amount || ""}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                      className="h-10"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Payment Discount</label>
                      <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                    </div>
                    <Input
                      type="number"
                      value={paymentForm.discount || ""}
                      onChange={(e) => setPaymentForm({ ...paymentForm, discount: parseFloat(e.target.value) || 0 })}
                      className="h-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Payment Date</label>
                    <Input
                      type="date"
                      value={paymentForm.date.toISOString().split('T')[0]}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: new Date(e.target.value) })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Payment Mode</label>
                    <Select value={paymentForm.mode} onValueChange={(val) => setPaymentForm({ ...paymentForm, mode: val })}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Cash", "Bank Transfer", "UPI", "Cheque", "NEFT/RTGS", "Other"].map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">Notes</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="Add any remarks or payment notes..."
                    className="w-full min-h-[80px] p-2 border rounded-md text-sm border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none outline-none"
                  />
                </div>
              </div>

              {/* Info & Calculation Section */}
              <div className="md:col-span-2 space-y-4">
                <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-lg p-4 border border-gray-200 dark:border-zinc-800">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-3">
                    Invoice #{paymentModal?.invoiceNumber}
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-zinc-400">
                    <div className="flex justify-between">
                      <span>Vendor Name</span>
                      <span className="text-gray-900 dark:text-zinc-100 font-medium">{searchTerm && searchType === 'vendor_name' ? searchTerm : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900/30 rounded-lg p-4 border border-gray-200 dark:border-zinc-800">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-zinc-100 mb-3">
                    Record Payment Calculation
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-red-600 font-medium">Invoice Pending Amt.</span>
                      <span className="text-red-600 font-semibold">₹{(paymentModal?.balanceDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-zinc-400">Amount Paid</span>
                      <span className="text-gray-900 dark:text-zinc-100 font-medium">₹{paymentForm.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-zinc-400">Payment Out Discount</span>
                      <span className="text-gray-900 dark:text-zinc-100 font-medium">₹{paymentForm.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-zinc-800">
                      <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Balance Amount</span>
                      <span className="text-base font-bold text-blue-600">
                        ₹{Math.max(0, (paymentModal?.balanceDue || 0) - paymentForm.amount - paymentForm.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-gray-50 dark:bg-zinc-900/50 border-t border-gray-100 dark:border-zinc-800 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaymentModal(null)} className="h-10 bg-white dark:bg-zinc-900 border-gray-300 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 font-medium">Close</Button>
            <Button onClick={handleRecordPaymentSubmit} disabled={isRecordingPayment || paymentForm.amount <= 0} className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95">
              {isRecordingPayment ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Table + Search */}
      <div className="bg-white/80 dark:bg-zinc-950 border border-gray-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-gray-100/50 dark:border-zinc-800 bg-gray-50/30 dark:bg-zinc-900/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
                    <Search className="h-4 w-4 mr-2 text-gray-400" />
                    {isDropdownLoading ? (
                      <span className="flex items-center">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>{" "}
                        Loading...
                      </span>
                    ) : (
                      <span className="truncate text-left">
                        {searchTerm ||
                          (searchType === "vendor_name"
                            ? "Search by vendor..."
                            : "Search by PO #...")}
                      </span>
                    )}
                    {!isDropdownLoading && (
                      <ChevronDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto rounded-xl shadow-xl bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                  <DropdownMenuItem
                    onClick={() => {
                      setSearchTerm("");
                      setRefreshKey((prev) => prev + 1);
                    }}
                    className="text-gray-500 italic"
                  >
                    Clear search
                  </DropdownMenuItem>
                  {isDropdownLoading ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      Loading suggestions...
                    </div>
                  ) : (
                    (searchType === "vendor_name"
                      ? allVendorNames
                      : allPoNumbers
                    ).map((item, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => {
                          setSearchTerm(item);
                          setRefreshKey((prev) => prev + 1);
                        }}
                        className={`py-2 px-3 rounded-lg mx-1 my-0.5 transition-colors ${searchTerm === item
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                          : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900"
                          }`}
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
                className={`absolute inset-y-1 rounded-md border shadow-sm transition-all duration-300 ease-out ${searchType === "vendor_name" ? 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700' : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/50'
                  }`}
                style={{
                  width: '100px',
                  transform: `translateX(${searchType === "vendor_name" ? '0px' : '100px'})`
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSearchTypeChange("vendor_name");
                }}
                className={`relative w-[100px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === "vendor_name" ? 'text-blue-700 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                Vendor Name
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSearchTypeChange("po_number");
                }}
                className={`relative w-[100px] py-1.5 text-sm font-medium rounded-md transition-colors duration-200 z-10 ${searchType === "po_number" ? 'text-blue-700 dark:text-blue-400 font-bold' : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'}`}
              >
                PO No.
              </button>
            </div>

            {/* Mobile Dropdown Fallback */}
            <div className="sm:hidden">
              <DropdownMenu
                open={showFilterDropdown}
                onOpenChange={setShowFilterDropdown}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 rounded-xl px-4 text-sm font-bold text-gray-900 dark:text-white bg-white dark:bg-zinc-900 shadow-sm border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 gap-2"
                  >
                    <Filter className="h-4 w-4 text-blue-500" />
                    {searchType === "vendor_name" ? "Vendor Name" : "PO Number"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48 rounded-xl shadow-xl bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800">
                  <DropdownMenuItem
                    onClick={() => handleSearchTypeChange("vendor_name")}
                  >
                    <User className="h-4 w-4 mr-2 text-gray-400" /> Vendor Name
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleSearchTypeChange("po_number")}
                  >
                    <FileText className="h-4 w-4 mr-2 text-gray-400" /> PO Number
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="w-full sm:w-auto sm:ml-auto">
              <button
                className="group flex items-center gap-2 px-5 h-10 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50 rounded-xl shadow-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-800 transition-all active:scale-95 w-full sm:w-auto"
                onClick={() => navigate("/purchases/purchase-orders/new")}
              >
                <Plus className="size-4 text-blue-500 dark:text-blue-400 group-hover:rotate-90 transition-transform" />
                <span className="whitespace-nowrap captialize tracking-wider">Create Order</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-auto relative">
          <DataGrid
            key={refreshKey}
            columns={columns}
            serverSide={true}
            onFetchData={fetchPurchaseOrders}
            rowSelection
            getRowId={(row: any) => row.id}
            pagination={{ size: 10 }}
            onRowClick={(row: any) => {
              if (showDeleteDialog) return;
              navigate(`/purchases/purchase-orders/${row.original.id}`);
            }}
            layout={{
              card: true,
              classes: {
                table: "cursor-pointer [&_tr:hover]:bg-gray-50 dark:[&_tr:hover]:bg-zinc-900/80 [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-gray-500 dark:[&_th]:text-zinc-500",
                container: "hidden md:block"
              }
            }}
          >
            <MobileView
              onEdit={(id, status) => {
                if (status === "received") {
                  toast.error("This purchase order cannot be edited because it has been received.");
                  return;
                }
                navigate(`/purchases/purchase-orders/${id}/edit`);
              }}
              onDetails={(id) => navigate(`/purchases/purchase-orders/${id}`)}
              onDuplicate={async (id) => {
                try {
                  const response = await getPurchaseOrderById(id);
                  if (response.success && response.data) {
                    const original = response.data;
                    navigate("/purchases/purchase-orders/new", {
                      state: {
                        poData: {
                          poNo: "",
                          poDate: new Date().toISOString().split("T")[0],
                          deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                          status: "open",
                          selectedVendor: original.vendor,
                          poItems: (original.items || []).map((item: any) => ({
                            id: "",
                            item_id: item.item_id,
                            item_name: item.product_name || item.description || "Item",
                            description: item.description,
                            quantity: item.quantity,
                            price_per_item: item.unit_price,
                            discount: item.discount_percentage || 0,
                            tax: item.tax_percentage || 0,
                            amount: item.total_price,
                            measuring_unit_id: 1,
                          })),
                          notes: original.notes,
                          terms: original.terms_and_conditions,
                          isDuplicate: true,
                        },
                        isDuplicate: true,
                      },
                    });
                    toast.success("Purchase order opened for duplication!");
                  }
                } catch {
                  toast.error("Failed to duplicate purchase order");
                }
              }}
              onDelete={(id) => {
                setPoToDelete(id);
                setShowDeleteDialog(true);
              }}
            />
          </DataGrid>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderPage;

