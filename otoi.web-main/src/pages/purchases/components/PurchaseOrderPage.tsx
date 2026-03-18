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
import { SpinnerDotted } from "spinners-react";
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

  // ── Purchase Invoice state ──────────────────────────────────────────────────
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
  >();

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

  const handleSearchTypeChange = (type: "vendor_name" | "po_number") => {
    setSearchType(type);
    setSearchTerm("");
  };

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Refresh data when search changes
  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [debouncedSearchTerm, searchType]);

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
            delivery_date: item.delivery_date
              ? (() => {
                const daysRemaining = Math.ceil(
                  (new Date(item.delivery_date).getTime() -
                    new Date().getTime()) /
                  (1000 * 60 * 60 * 24),
                );
                if (daysRemaining < 0) {
                  return (
                    <span className="text-red-600 font-medium">
                      Overdue by {Math.abs(daysRemaining)} days
                    </span>
                  );
                } else if (daysRemaining === 0) {
                  return (
                    <span className="text-red-600 font-medium">0 days</span>
                  );
                } else {
                  return `${daysRemaining} days`;
                }
              })()
              : "N/A",
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
            className="justify-start"
          />
        ),
        cell: (info) => (
          <div className="text-sm text-gray-900">
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
            className="justify-start"
          />
        ),
        cell: (info) => (
          <div className="text-sm font-medium text-gray-900">
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
            className="justify-start"
          />
        ),
        cell: (info) => (
          <div className="text-sm text-gray-900">
            {info.getValue() as string}
          </div>
        ),
        meta: { headerClassName: "min-w-[200px]" },
      },
      {
        accessorKey: "due_date",
        header: ({ column }) => (
          <DataGridColumnHeader
            title="Due In"
            column={column}
            className="justify-start"
          />
        ),
        cell: (info) => (
          <div className="text-sm text-gray-900">
            {info.getValue() as string}
          </div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const getDaysValue = (value: string): number => {
            if (value === "N/A") return 999999;
            const match = value.match(/(\d+)/);
            return match ? parseInt(match[1]) : 999999;
          };
          const aVal = getDaysValue(rowA.getValue("due_date") as string);
          const bVal = getDaysValue(rowB.getValue("due_date") as string);
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
            className="justify-end"
          />
        ),
        cell: (info) => (
          <div className="text-sm font-medium text-right">
            ₹{(info.getValue() as number)?.toLocaleString("en-IN") || "0"}
          </div>
        ),
        meta: {
          headerClassName: "min-w-[120px] justify-end",
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
                className={`px-2 py-1 text-xs rounded-full ${status === "open"
                  ? "bg-green-100 text-green-800"
                  : status === "closed"
                    ? "bg-red-100 text-red-800"
                    : status === "received"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-gray-100 text-gray-800"
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

                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEdit(row.original.id);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`/purchases/purchase-orders/${row.original.id}`);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDuplicate(row.original.id);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
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

  return (
    <div className="container-fluid p-6 relative">
      {(isLoading || isDeleting || isDropdownLoading) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80">
          <div className="text-primary">
            <SpinnerDotted
              size={50}
              thickness={100}
              speed={100}
              color="#3b82f6"
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <div className="w-48">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-full gap-1"
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {selectedStatus === "all" && "All Orders"}
                    {selectedStatus === "open" && "Open Orders"}
                    {selectedStatus === "closed" && "Closed Orders"}
                    {selectedStatus === "received" && "Received Orders"}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-1 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus("open");
                    setRefreshKey((prev) => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-green-500" />
                  <span>Open Orders</span>
                  {selectedStatus === "open" && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus("all");
                    setRefreshKey((prev) => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-gray-500" />
                  <span>All Orders</span>
                  {selectedStatus === "all" && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus("closed");
                    setRefreshKey((prev) => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <Circle className="h-4 w-4 text-red-500" />
                  <span>Closed Orders</span>
                  {selectedStatus === "closed" && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedStatus("received");
                    setRefreshKey((prev) => prev + 1);
                  }}
                  className="flex items-center gap-2"
                >
                  <CircleCheck className="h-4 w-4 text-purple-500" />
                  <span>Received Orders</span>
                  {selectedStatus === "received" && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            size="sm"
            className="h-8 gap-1"
            onClick={() => navigate("/purchases/purchase-orders/new")}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Create Purchase Order
            </span>
          </Button>
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
        <DialogContent className="sm:max-w-[420px] p-6">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <DialogTitle className="text-lg font-semibold">
              Delete Purchase Order
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Are you sure you want to delete this purchase order?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
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

      {/* ── Record Payment Modal ───────────────────────────────────────────── */}
      <Dialog
        open={!!paymentModal?.open}
        onOpenChange={(open) => {
          if (!open) { setPaymentModal(null); }
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
          <DialogHeader className="px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2 text-left w-full">
              <CreditCard className="h-5 w-5 text-gray-600" />
              Record Payment For Invoice #{paymentModal?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Form Section */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Amount Paid <span className="text-red-500">*</span></label>
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
                      <label className="text-sm font-medium text-gray-700">Payment Discount</label>
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
                    <label className="text-sm font-medium text-gray-700">Payment Date</label>
                    <Input
                      type="date"
                      value={paymentForm.date.toISOString().split('T')[0]}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: new Date(e.target.value) })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Payment Mode</label>
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
                  <label className="text-sm font-medium text-gray-700">Notes</label>
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
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">
                    Invoice #{paymentModal?.invoiceNumber}
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Vendor Name</span>
                      <span className="text-gray-900 font-medium">{searchTerm && searchType === 'vendor_name' ? searchTerm : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">
                    Record Payment Calculation
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-red-600 font-medium">Invoice Pending Amt.</span>
                      <span className="text-red-600 font-semibold">₹{(paymentModal?.balanceDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Amount Paid</span>
                      <span className="text-gray-900 font-medium">₹{paymentForm.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Payment Out Discount</span>
                      <span className="text-gray-900 font-medium">₹{paymentForm.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-800">Balance Amount</span>
                      <span className="text-base font-bold text-blue-600">
                        ₹{Math.max(0, (paymentModal?.balanceDue || 0) - paymentForm.amount - paymentForm.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaymentModal(null)} className="h-10 bg-white border-gray-300 font-medium">Close</Button>
            <Button onClick={handleRecordPaymentSubmit} disabled={isRecordingPayment || paymentForm.amount <= 0} className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6">
              {isRecordingPayment ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Table + Search */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative w-fit">
            <div className="flex">
              {/* Search/filter dropdown */}
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 w-80 justify-start px-3"
                      disabled={isDropdownLoading}
                    >
                      {isDropdownLoading ? (
                        <span className="flex items-center">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                          Loading...
                        </span>
                      ) : (
                        searchTerm ||
                        (searchType === "vendor_name"
                          ? "Select by vendor name..."
                          : "Select by PO number...")
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
                        {searchType === "vendor_name" ? "Vendors" : "Orders"}
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
                          className={
                            searchTerm === item
                              ? "bg-blue-50 text-blue-600"
                              : ""
                          }
                        >
                          {item}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Filter type selector */}
              <div className="flex bg-gray-50 rounded-md ml-2">
                <DropdownMenu
                  open={showFilterDropdown}
                  onOpenChange={setShowFilterDropdown}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-md px-3 text-sm text-gray-600"
                    >
                      <Filter className="h-3.5 w-3.5 mr-1 text-blue-500" />
                      {searchTerm
                        ? `${searchType === "vendor_name" ? "Vendor" : "PO"}: ${searchTerm}`
                        : "Filter by"}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    <DropdownMenuItem
                      onClick={() => {
                        handleSearchTypeChange("vendor_name");
                        setShowFilterDropdown(false);
                      }}
                      className={
                        searchType === "vendor_name"
                          ? "bg-blue-50 text-blue-600"
                          : ""
                      }
                    >
                      <Filter className="h-3.5 w-3.5 mr-2" />
                      Vendor Name
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        handleSearchTypeChange("po_number");
                        setShowFilterDropdown(false);
                      }}
                      className={
                        searchType === "po_number"
                          ? "bg-blue-50 text-blue-600"
                          : ""
                      }
                    >
                      <Filter className="h-3.5 w-3.5 mr-2" />
                      PO Number
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-auto">
          <DataGrid
            key={refreshKey}
            columns={columns}
            serverSide={true}
            onFetchData={fetchPurchaseOrders}
            loading={false}
            rowSelection={true}
            getRowId={(row: any) => row.id.toString()}
            pagination={{ size: 5 }}
            onRowClick={(row: any) =>
              navigate(`/purchases/purchase-orders/${row.original.id}`)
            }
          />
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderPage;
