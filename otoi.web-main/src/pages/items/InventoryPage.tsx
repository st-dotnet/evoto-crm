import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import { cn } from "@/lib/utils";
import {
  DataGrid,
  DataGridColumnHeader,
  TDataGridRequestParams,
  KeenIcon,
  DataGridRowSelectAll,
  DataGridRowSelect,
  useDataGrid,
} from "@/components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  X,
  Check,
  AlertCircle,
  Package,
  TrendingDown,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ColumnDef, Column, RowSelectionState } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { SpinnerDotted } from "spinners-react";
import axios from "axios";
import CreateItemModal from "./CreateItemModal";
import {
  getItems,
  deleteItem,
  getItemById,
} from "../../pages/items/services/items.service";
import { resolveImageUrl } from "@/utils/imageUtils";

interface InventoryItem {
  item_id: string;
  item_name: string;
  item_code: string;
  opening_stock: number;
  sales_price: number;
  purchase_price: number | null;
  type: string;
  category: string;
  business_id: number | null;
  description?: string | null;
  hsn_code?: string | null;
  item_type_id?: number;
  category_id?: number;
  measuring_unit_id?: number;
  gst_tax_rate?: number;
  image?: string | null;
}

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
  table?: any;
}

interface IInventoryItemsProps {
  refreshStatus?: number;
}

/* ─────────────────────────────────────────────
   TOOLBAR
───────────────────────────────────────────── */
const Toolbar = ({
  defaultSearch,
  setSearch,
  defaultLowStock,
  setDefaultLowStock,
  defaultProductType,
  setDefaultProductType,
  onCreateItem,
}: {
  defaultSearch: string;
  setSearch: (query: string) => void;
  defaultLowStock: boolean;
  setDefaultLowStock: (query: boolean) => void;
  defaultProductType: string;
  setDefaultProductType: (type: string) => void;
  onCreateItem: () => void;
}) => {
  const [searchInput, setSearchInput] = useState(defaultSearch);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ item_id: string; item_name: string }[]>([]);

  useEffect(() => { setSearchInput(defaultSearch); }, [defaultSearch]);

  useEffect(() => {
    const fetchAllItems = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/items/?dropdown=true`,
        );
        const responseData = response?.data ?? [];
        const uniqueItems = responseData.reduce((acc: any[], item: any) => {
          if (!item?.item_name) return acc;
          if (!acc.find((e) => e?.item_name === item?.item_name)) acc.push(item);
          return acc;
        }, []);
        setItems(uniqueItems.sort((a: any, b: any) =>
          (a?.item_name?.toLowerCase() ?? "").localeCompare(b?.item_name?.toLowerCase() ?? "")
        ));
      } catch { setItems([]); }
    };
    fetchAllItems();
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchInput) return items;
    return items.filter((item) =>
      item?.item_name?.toLowerCase()?.includes(searchInput?.toLowerCase())
    );
  }, [items, searchInput]);

  return (
    <div className="inv-toolbar">
      {/* Search */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="inv-search-wrap">
            <Search className="inv-search-icon" />
            <Input
              placeholder="Search by name or item code…"
              value={searchInput}
              onChange={(e) => { setSearchInput(e.target.value); setOpen(true); }}
              onClick={() => setOpen(true)}
              className="inv-search-input"
            />
            {searchInput && (
              <X
                className="inv-search-clear"
                onClick={() => { setSearchInput(""); setSearch(""); }}
              />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start" onOpenAutoFocus={(e) => e?.preventDefault()}>
          <Command>
            <CommandList>
              {filteredItems.length === 0 && <CommandEmpty>No item found.</CommandEmpty>}
              <CommandGroup>
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item?.item_id}
                    value={item?.item_name}
                    onSelect={() => { setSearchInput(item?.item_name); setSearch(item?.item_name); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", searchInput === item?.item_name ? "opacity-100" : "opacity-0")} />
                    {item?.item_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Right actions */}
      <div className="inv-toolbar-actions">
        <button
          className={`inv-filter-btn ${defaultLowStock ? "inv-filter-btn--active" : ""}`}
          onClick={() => setDefaultLowStock(!defaultLowStock)}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          {defaultLowStock ? "Low Stock" : "Low Stock"}
        </button>

        <button className="inv-create-btn group" onClick={onCreateItem}>
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-all duration-400 ease-in-out" />
          New Item
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   MOBILE VIEW
───────────────────────────────────────────── */
const MobileView = ({
  onEdit, onDetails, onDelete,
}: {
  onEdit: (item: InventoryItem) => void;
  onDetails: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const { table, loading } = useDataGrid();
  const rows = table.getRowModel().rows;
  if (loading && rows.length === 0) return null;

  return (
    <div className="flex flex-col lg:hidden border-t border-gray-100 overflow-x-hidden">
      {rows.map((row) => {
        const item = row.original as InventoryItem;
        return (
          <div key={item.item_id} className="inv-mobile-row">
            <div className="flex flex-col grow min-w-0 cursor-pointer gap-0.5" onClick={() => onDetails(item.item_id)}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[11px] text-gray-900 truncate leading-tight">{item.item_name}</span>
                {item.sales_price > 0 && (
                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1 py-0 rounded shrink-0 ml-2">
                    ₹{item.sales_price.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="inv-code-chip text-[9px] leading-none">{item.item_code}</span>
                <span className="text-[9px] px-1 py-0 rounded-md text-gray-600 bg-gray-100 truncate leading-none">
                  {item.category}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] px-1.5 py-0 rounded font-bold leading-none ${item.opening_stock <= 5 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                  Qty: {item.opening_stock}
                </span>
                {item.purchase_price !== null && (
                  <span className="text-[9px] text-gray-400 truncate leading-none">
                    Purchase: ₹{item.purchase_price.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center shrink-0 ml-3">
              {item.image ? (
                <div className="w-6 h-6 rounded overflow-hidden border border-gray-100 shadow-sm mb-0">
                  <img src={resolveImageUrl(item.image)} alt={item.item_name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded bg-gray-50 border border-gray-100 flex items-center justify-center mb-0">
                  <Package className="w-3 h-3 text-gray-300" />
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inv-action-trigger shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32 p-1">
                  <DropdownMenuItem onClick={() => onEdit(item)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDetails(item.item_id)}><Eye className="mr-2 h-4 w-4" />Details</DropdownMenuItem>
                  <div className="my-1 border-t border-gray-100" />
                  <DropdownMenuItem className="text-red-500 focus:bg-red-50" onClick={() => onDelete(item.item_id)}>
                    <Trash2 className="mr-2 h-4 w-4" />Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && !loading && (
        <div className="p-16 text-center flex flex-col items-center gap-2">
          <Package className="w-10 h-10 text-gray-200" />
          <span className="text-gray-400 text-sm">No items found.</span>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
const InventoryPage = ({ refreshStatus = 0 }: IInventoryItemsProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [lowStock, setLowStock] = useState(false);
  const [productType, setProductType] = useState<string>("all");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isEditing, setIsEditing] = useState(false);
  const [allItemsForCount, setAllItemsForCount] = useState<InventoryItem[]>([]);

  const navigate = useNavigate();

  const toNumber = (value: any, fallback = 0): number => {
    if (value === null || value === undefined || value === "None") return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  };

  const mapItem = (item: any): InventoryItem => ({
    item_id: item.id || "",
    item_name: item.item_name || "Unnamed Item",
    item_code: item.item_code || `ITEM-${Date.now()}`,
    opening_stock: toNumber(item.opening_stock, 0),
    sales_price: toNumber(item.sales_price, 0),
    purchase_price: item.purchase_price !== null && item.purchase_price !== "None"
      ? toNumber(item.purchase_price, 0) : null,
    type: item.item_type || item.type || "Product",
    item_type_id: item.item_type_id || (item.item_type === "Service" ? 2 : 1),
    category: ((typeof item.category === "object" ? item.category?.name : item.category) || item.category_name || "Uncategorized").trim(),
    business_id: item.business_id || null,
    description: item.description,
    hsn_code: item.hsn_code,
    category_id: item.category_id,
    measuring_unit_id: item.measuring_unit_id,
    gst_tax_rate: item.gst_tax_rate,
    image: item.image,
  });

  const fetchAllItemsForCount = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/items/?items_per_page=10000`);
      const payload: any = response?.data;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      setAllItemsForCount(rows.map(mapItem));
    } catch { console.error("Failed to fetch all items for count"); }
  };

  const fetchItems = async (params: TDataGridRequestParams) => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.set("page", String(params.pageIndex + 1));
      queryParams.set("items_per_page", String(params.pageSize));
      if (params.sorting?.[0]?.id) {
        queryParams.set("sort", params.sorting[0].id);
        queryParams.set("order", params.sorting[0].desc ? "desc" : "asc");
      }
      if (searchQuery) queryParams.set("query", searchQuery);
      if (lowStock) queryParams.set("low_stock", "true");
      if (productType && productType !== "all") queryParams.set("item_type_id", productType === "Product" ? "1" : "2");
      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) queryParams.set(`filter[${id}]`, String(value));
        });
      }
      const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/items/?${queryParams.toString()}`);
      const payload: any = response?.data;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const total = payload?.pagination?.total ?? (Array.isArray(payload) ? rows.length : 0);
      const mappedItems = rows.map(mapItem);
      setItems(mappedItems);
      return { data: mappedItems, totalCount: total };
    } catch {
      toast("Connection Error", { description: "Failed to fetch items." });
      return { data: [], totalCount: 0 };
    } finally { setLoading(false); }
  };

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
    fetchAllItemsForCount();
  }, [refreshStatus, searchQuery, lowStock]);

  const stockValue = items
    .filter((item) => item.item_type_id === 1)
    .reduce((sum, item) => sum + (item.sales_price || 0) * (item.opening_stock || 0), 0);

  const lowStockCount = allItemsForCount.filter(
    (item) => item.item_type_id === 1 && (item.opening_stock || 0) <= 5
  ).length;

  const totalProducts = allItemsForCount.filter((item) => item.item_type_id === 1).length;

  const handleDeleteClick = (id: string, onClose?: () => void) => {
    if (onClose) onClose();
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete === null) return;
    setIsDeleting(true);
    try {
      await deleteItem(itemToDelete);
      toast.success("Item deleted successfully");
      setRefreshKey((prev) => prev + 1);
    } catch { toast.error("Failed to delete item."); }
    finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const ColumnInputFilter = <TData, TValue>({ column }: IColumnFilterProps<TData, TValue>) => {
    const [inputValue, setInputValue] = useState((column.getFilterValue() as string) ?? "");
    return (
      <Input
        placeholder="Filter…"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && column.setFilterValue(inputValue)}
        className="h-8 w-full max-w-40 text-xs"
      />
    );
  };

  const columns = useMemo<ColumnDef<InventoryItem>[]>(() => [
    {
      accessorKey: "item_id",
      header: () => <div className="flex items-center justify-center"><DataGridRowSelectAll /></div>,
      cell: ({ row }) => <div className="flex items-center justify-center"><DataGridRowSelect row={row} /></div>,
      enableSorting: false,
      enableHiding: false,
      meta: { headerClassName: "w-10 text-center p-0", cellClassName: "text-center p-0", disableRowClick: true },
    },
    {
      accessorKey: "image",
      header: () => <span className="inv-col-header">Image</span>,
      enableSorting: false,
      cell: (info) => {
        const image = info.row.original.image;
        return image ? (
          <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-100 shadow-sm">
            <img src={resolveImageUrl(image)} alt="Product" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
            <Package className="w-8 h-8 text-slate-300" />
          </div>
        );
      },
      meta: { headerClassName: "w-24", cellClassName: "" },
    },
    {
      accessorFn: (row) => row.item_name,
      id: "item_name",
      header: ({ column }) => (
        <DataGridColumnHeader
          title="Item Name"
          filter={<ColumnInputFilter column={column} />}
          column={column}
        />
      ),
      enableSorting: true,
      cell: (info) => (
        <div className="flex flex-col gap-0.5">
          <a
            className="inv-item-name"
            onClick={(e) => { e.preventDefault(); navigate(`/items/inventory/${info.row.original.item_id}`); }}
          >
            {info.row.original.item_name}
          </a>
          <span className="inv-code-chip">{info.row.original.item_code}</span>
        </div>
      ),
      meta: { headerClassName: "min-w-[240px]" },
    },
    {
      accessorFn: (row) => row.category,
      id: "category",
      header: ({ column }) => <DataGridColumnHeader title="Category" column={column} />,
      enableSorting: true,
      cell: (info) => (
        <span className="inv-category-tag">{info.row.original.category}</span>
      ),
      meta: { headerClassName: "min-w-[120px]" },
    },
    {
      accessorFn: (row) => row.opening_stock,
      id: "opening_stock",
      header: ({ column }) => <DataGridColumnHeader title="Stock Qty" column={column} />,
      enableSorting: true,
      cell: (info) => {
        const qty = info.row.original.opening_stock;
        return (
          <span className={`inv-qty-badge ${qty <= 5 ? "inv-qty-badge--low" : "inv-qty-badge--ok"}`}>
            {qty}
          </span>
        );
      },
      meta: { headerClassName: "min-w-[110px]", cellClassName: "" },
    },
    {
      accessorFn: (row) => row.sales_price,
      id: "sales_price",
      header: ({ column }) => <DataGridColumnHeader title="Selling Price" column={column} />,
      enableSorting: true,
      cell: (info) => (
        <span className="inv-price-badge">
          ₹{info.row.original.sales_price?.toLocaleString("en-IN") || "0"}
        </span>
      ),
      meta: { headerClassName: "min-w-[130px]" },
    },
    {
      accessorFn: (row) => row.purchase_price,
      id: "purchase_price",
      header: ({ column }) => <DataGridColumnHeader title="Purchase Price" column={column} />,
      enableSorting: true,
      cell: (info) => {
        const value = info.row.original.purchase_price;
        return (
          <span className="text-sm text-gray-500 font-medium">
            {value ? `₹${value.toLocaleString("en-IN")}` : <span className="text-gray-300">—</span>}
          </span>
        );
      },
      meta: { headerClassName: "min-w-[130px]" },
    },
    {
      id: "actions",
      header: () => <span className="inv-col-header text-center block">Actions</span>,
      enableSorting: false,
      meta: {
        headerClassName: "w-20",
        cellClassName: "pointer-events-auto",
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
                  className="inv-action-trigger"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32 p-1 shadow-lg">
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleEdit(row.original); }}>
                  <Edit className="mr-2 h-4 w-4" />Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); navigate(`/items/inventory/${row.original.item_id}`); }}>
                  <Eye className="mr-2 h-4 w-4" />Details
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100" />
                <DropdownMenuItem
                  className="text-red-500 focus:bg-red-50"
                  onSelect={(e) => { e.preventDefault(); handleDeleteClick(row.original.item_id, () => setIsOpen(false)); }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], []);

  const handleRowSelection = (state: RowSelectionState) => {
    setRowSelection(state);
    const selectedRowIds = Object.keys(state);
    if (selectedRowIds.length > 0) toast(`${selectedRowIds.length} item(s) selected.`);
  };

  return (
    <>
      {/* ── Scoped styles ── */}
      <style>{`
        /* Page layout */
        .inv-page { display: grid; gap: 1.5rem; padding: 0; }

        /* ── Hero banner ── */
        .inv-hero {
          padding: 2rem 2.25rem 1.75rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          flex-wrap: wrap;
          position: relative;
          overflow: hidden;
          margin: 0 1rem;
        }
        .inv-hero-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #111318;
          letter-spacing: -0.02em;
          margin: 0 0 0.25rem;
          font-family: 'DM Sans', sans-serif;
        }
        .inv-hero-sub {
          font-size: 0.8125rem;
          color: #6b7280;
          font-weight: 400;
          margin: 0;
        }

        /* ── Stat cards inside hero ── */
        .inv-stats {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .inv-stat {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          padding: 0.6rem 1rem;
          min-width: 120px;
          transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .inv-stat:hover { background: #f9fafb; border-color: #d1d5db; }
        .inv-stat-label {
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 0.375rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }
        .inv-stat-value {
          font-size: 1.2rem;
          font-weight: 700;
          color: #111318;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .inv-stat--warn .inv-stat-value { color: #fbbf24; }
        .inv-stat--warn .inv-stat-label { color: rgba(251,191,36,0.65); }
        .inv-stat--warn { border-color: rgba(251,191,36,0.2); background: rgba(251,191,36,0.07); }

        /* ── Toolbar ── */
        .inv-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.875rem 1.25rem;
          flex-wrap: wrap;
          border-bottom: 1px solid #f1f5f9;
        }
        .inv-search-wrap {
          position: relative;
          width: 280px;
          max-width: 100%;
        }
        .inv-search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          width: 14px;
          height: 14px;
          color: #94a3b8;
          pointer-events: none;
        }
        .inv-search-input {
          padding-left: 2.25rem !important;
          padding-right: 2.25rem !important;
          height: 2.25rem;
          font-size: 0.8125rem;
          border-radius: 0.625rem;
          border-color: #e2e8f0;
          background: #f8fafc;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .inv-search-input:focus {
          border-color: #3b82f6;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
        }
        .inv-search-clear {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          width: 14px;
          height: 14px;
          color: #94a3b8;
          cursor: pointer;
        }
        .inv-search-clear:hover { color: #475569; }

        .inv-toolbar-actions { display: flex; align-items: center; gap: 0.625rem; }

        .inv-filter-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0 0.875rem;
          height: 2.25rem;
          font-size: 0.8rem;
          font-weight: 500;
          border-radius: 0.625rem;
          border: 1.5px solid #e2e8f0;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }
        .inv-filter-btn:hover { border-color: #cbd5e1; background: #f8fafc; }
        .inv-filter-btn--active {
          border-color: #f59e0b;
          background: #fffbeb;
          color: #d97706;
        }
        .inv-filter-btn--active:hover { background: #fef3c7; }

        .inv-create-btn {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0 1rem;
          height: 2.25rem;
          font-size: 0.8125rem;
          font-weight: 600;
          border-radius: 0.625rem;
          border: none;
          background: #0f172a;
          color: #fff;
          cursor: pointer;
          transition: background 0.15s, transform 0.1s;
        }
        .inv-create-btn:hover { background: #1e293b; }
        .inv-create-btn:active { transform: scale(0.97); }
        .inv-create-btn:hover .w-4.h-4 { transform: rotate(90deg); transition: transform 0.2s ease-in-out; }

        /* ── Table cells ── */
        .inv-item-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
          transition: color 0.15s;
          text-decoration: none;
          display: block;
          line-height: 1.4; 
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }
        /* Dark mode styles for item names */
        .dark .inv-item-name {
          color: #f3f4f6;
        }
        .inv-item-name:hover { color: #3b82f6; }

        .inv-code-chip {
          display: inline-flex;
          align-items: center;
          padding: 0;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #64748b;
          font-family: 'JetBrains Mono', 'Fira Mono', monospace;
          white-space: nowrap;
        }

        .inv-category-tag {
          display: inline-flex;
          align-items: center;
          padding: 0.2rem 0.625rem;
          font-size: 0.75rem;
          font-weight: 500;
          border-radius: 9999px;
          background: #eff6ff;
          color: #3b82f6;
          border: 1px solid #dbeafe;
          white-space: nowrap;
        }

        .inv-qty-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2.25rem;
          padding: 0.2rem 0.625rem;
          font-size: 0.8125rem;
          font-weight: 700;
          border-radius: 0.5rem;
          line-height: 1;
        }
        .inv-qty-badge--ok { background: #f0fdf4; color: #16a34a; }
        .inv-qty-badge--low { background: #fff7ed; color: #ea580c; }

        .inv-price-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.75rem;
          font-size: 0.8125rem;
          font-weight: 700;
          border-radius: 0.5rem;
          background: #f0fdf4;
          color: #15803d;
          border: 1px solid #bbf7d0;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }

        .inv-action-trigger {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 0.5rem;
          border: none;
          background: transparent;
          color: #94a3b8;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .inv-action-trigger:hover { background: #f1f5f9; color: #334155; }

        .inv-col-header {
          font-size: 0.75rem;
          font-weight: 600;
          color: #64748b;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* Table alignment fixes */
        table {
          border-collapse: collapse;
        }

/* Mobile row */
.inv-mobile-row {
  display: flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-bottom: 1px solid #f1f5f9;
  transition: background 0.15s;
  overflow-x: hidden;
}
.inv-mobile-row:hover { background: #f8fafc; }
.inv-mobile-row:last-child { border-bottom: none; }

/* ── Responsive Styles ── */
@media (max-width: 996px) {
  .inv-page {
    padding: 0;
  }
  .inv-hero {
    padding: 1.25rem 1rem 1rem;
    margin: 0 0.5rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  .inv-hero-title {
    font-size: 1.25rem;
  }
  .inv-hero-sub {
    font-size: 0.75rem;
  }
  .inv-stats {
    width: 100%;
    gap: 0.5rem;
  }
  .inv-stat {
    min-width: calc(33.333% - 0.35rem);
    flex: 1;
    padding: 0.5rem 0.75rem;
  }
  .inv-stat-label {
    font-size: 0.65rem;
  }
  .inv-stat-value {
    font-size: 1rem;
  }
  .inv-toolbar {
    padding: 0.75rem 1rem;
  }
  .inv-search-wrap {
    width: 200px;
  }
  .inv-filter-btn {
    padding: 0 0.75rem;
    font-size: 0.75rem;
  }
  .inv-create-btn {
    padding: 0 0.75rem;
    font-size: 0.75rem;
  }
  .inv-item-name {
    font-size: 0.75rem;
  }
  .inv-code-chip {
    font-size: 0.65rem;
  }
  .inv-category-tag {
    font-size: 0.7rem;
    padding: 0.18rem 0.55rem;
  }
  .inv-qty-badge {
    font-size: 0.75rem;
    padding: 0.18rem 0.55rem;
    min-width: 2rem;
  }
  .inv-price-badge {
    font-size: 0.75rem;
    padding: 0.22rem 0.65rem;
  }
  .inv-col-header {
    font-size: 0.7rem;
  }
}
        @media (max-width: 996px) {
          .inv-page {
            padding: 0;
          }
          .inv-hero {
            padding: 1.25rem 1rem 1rem;
            margin: 0 0.5rem;
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          .inv-hero-title {
            font-size: 1.25rem;
          }
          .inv-hero-sub {
            font-size: 0.75rem;
          }
          .inv-stats {
            width: 100%;
            gap: 0.5rem;
          }
          .inv-stat {
            min-width: calc(33.333% - 0.35rem);
            flex: 1;
            padding: 0.5rem 0.75rem;
          }
          .inv-stat-label {
            font-size: 0.65rem;
          }
          .inv-stat-value {
            font-size: 1rem;
          }
          .inv-toolbar {
            padding: 0.75rem 1rem;
          }
          .inv-search-wrap {
            width: 200px;
          }
          .inv-filter-btn {
            padding: 0 0.75rem;
            font-size: 0.75rem;
          }
          .inv-create-btn {
            padding: 0 0.75rem;
            font-size: 0.75rem;
          }
          .inv-item-name {
            font-size: 0.75rem;
          }
          .inv-code-chip {
            font-size: 0.65rem;
          }
          .inv-category-tag {
            font-size: 0.7rem;
            padding: 0.18rem 0.55rem;
          }
          .inv-qty-badge {
            font-size: 0.75rem;
            padding: 0.18rem 0.55rem;
            min-width: 2rem;
          }
          .inv-price-badge {
            font-size: 0.75rem;
            padding: 0.22rem 0.65rem;
          }
          .inv-col-header {
            font-size: 0.7rem;
          }
        }

        @media (max-width: 768px) {
          .inv-hero {
            padding: 1rem 0.75rem 0.875rem;
            margin: 0;
          }
          .inv-hero-title {
            font-size: 1.125rem;
          }
          .inv-stats {
            flex-direction: column;
            gap: 0.5rem;
          }
          .inv-stat {
            min-width: 100%;
            width: 100%;
          }
          .inv-toolbar {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
            padding: 0.75rem;
          }
          .inv-search-wrap {
            width: 100%;
          }
          .inv-toolbar-actions {
            flex-direction: column;
            width: 100%;
          }
          .inv-filter-btn,
          .inv-create-btn {
            width: 100%;
            justify-content: center;
          }
          .inv-item-name {
            font-size: 0.72rem;
          }
          .inv-code-chip {
            font-size: 0.62rem;
          }
          .inv-category-tag {
            font-size: 0.68rem;
            padding: 0.16rem 0.52rem;
          }
          .inv-qty-badge {
            font-size: 0.72rem;
            padding: 0.16rem 0.52rem;
            min-width: 1.85rem;
          }
          .inv-price-badge {
            font-size: 0.72rem;
            padding: 0.21rem 0.6rem;
          }
          .inv-col-header {
            font-size: 0.68rem;
          }
        }

        @media (max-width: 640px) {
          .inv-hero {
            padding: 0.875rem 0.5rem 0.75rem;
          }
          .inv-hero-title {
            font-size: 1rem;
          }
          .inv-hero-sub {
            font-size: 0.7rem;
          }
          .inv-stat {
            padding: 0.5rem;
          }
          .inv-stat-label {
            font-size: 0.6rem;
          }
          .inv-stat-value {
            font-size: 0.9rem;
          }
          .inv-item-name {
            font-size: 0.7rem;
            max-width: 100px;
          }
          .inv-code-chip {
            font-size: 0.6rem;
          }
          .inv-category-tag {
            font-size: 0.65rem;
            padding: 0.15rem 0.5rem;
          }
          .inv-qty-badge {
            font-size: 0.7rem;
            padding: 0.15rem 0.5rem;
            min-width: 1.75rem;
          }
          .inv-price-badge {
            font-size: 0.7rem;
            padding: 0.2rem 0.5rem;
          }
          .inv-col-header {
            font-size: 0.65rem;
          }
        }

        /* DataGrid container responsive */
        @media (max-width: 996px) {
          .mx-4 {
            margin-left: 0.5rem;
            margin-right: 0.5rem;
            overflow-x: hidden;
          }
        }

        @media (max-width: 768px) {
          .mx-4 {
            margin-left: 0.75rem;
            margin-right: 0.75rem;
            overflow-x: hidden;
          }
        }

        @media (max-width: 640px) {
          .mx-4 {
            margin-left: 0.5rem;
            margin-right: 0.5rem;
            overflow-x: hidden;
          }
        }
        
        /* Dark mode styles */
        .dark .inv-hero-title {
          color: #f3f4f6 !important;
        }
        .dark .inv-hero-sub {
          color: #9ca3af !important;
        }
        .dark .inv-stat {
          background: #1f2937 !important;
          border-color: #374151 !important;
        }
        .dark .inv-stat:hover {
          background: #374151 !important;
          border-color: #4b5563 !important;
        }
        .dark .inv-stat-label {
          color: #9ca3af !important;
        }
        .dark .inv-stat-value {
          color: #f3f4f6 !important;
        }
        
        /* Search bar dark mode */
        .dark .inv-search-input {
          background: #1f2937 !important;
          border-color: #374151 !important;
          color: #f3f4f6 !important;
        }
        .dark .inv-search-input:focus {
          background: #374151 !important;
          border-color: #3b82f6 !important;
        }
        .dark .inv-search-icon {
          color: #9ca3af !important;
        }
        .dark .inv-search-clear {
          color: #9ca3af !important;
        }
        .dark .inv-search-clear:hover {
          color: #d1d5db !important;
        }
      `}</style>

      <div className="inv-page">
        {(loading || isDeleting || isEditing) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-zinc-900/80">
            <SpinnerDotted size={48} thickness={100} speed={100} color="#3b82f6" />
          </div>
        )}

        {/* ── Hero Banner ── */}
        <div className="inv-hero">
          <div>
            <h1 className="inv-hero-title">Inventory</h1>
            <p className="inv-hero-sub">Manage your products, stock levels & pricing</p>
          </div>

          <div className="inv-stats">
            <div className="inv-stat">
              <div className="inv-stat-label">
                <Package className="w-3 h-3" /> Stock Value
              </div>
              <div className="inv-stat-value">₹{stockValue.toLocaleString("en-IN")}</div>
            </div>

            <div className={`inv-stat ${lowStockCount > 0 ? "inv-stat--warn" : ""}`}>
              <div className="inv-stat-label">
                <TrendingDown className="w-3 h-3" /> Low Stock
              </div>
              <div className="inv-stat-value">{lowStockCount}</div>
            </div>

            <div className="inv-stat">
              <div className="inv-stat-label">
                <Package className="w-3 h-3" /> Total Items
              </div>
              <div className="inv-stat-value">{allItemsForCount.length}</div>
            </div>
          </div>
        </div>

        {/* ── Data Grid ── */}
        <div className="mx-4">
          <DataGrid
            key={refreshKey}
            columns={columns}
            serverSide={true}
            onFetchData={fetchItems}
            loading={false}
            rowSelection={true}
            rowSelectionState={rowSelection}
            getRowId={(row: any) => row.item_id}
            onRowSelectionChange={handleRowSelection}
            pagination={{ size: 5 }}
            toolbar={
              <Toolbar
                defaultSearch={searchQuery}
                setSearch={setSearchQuery}
                defaultLowStock={lowStock}
                setDefaultLowStock={setLowStock}
                defaultProductType={productType}
                setDefaultProductType={setProductType}
                onCreateItem={() => { setSelectedItem(null); setShowModal(true); }}
              />
            }
            layout={{
              card: true,
              classes: { container: "hidden lg:block" },
            }}
          >
            <MobileView
              onEdit={handleEdit}
              onDetails={(id) => navigate(`/items/inventory/${id}`)}
              onDelete={(id) => handleDeleteClick(id)}
            />
          </DataGrid>
        </div>

        {/* ── Create/Edit Modal ── */}
        <CreateItemModal
          open={showModal}
          onOpenChange={(open: boolean) => {
            setShowModal(open);
            if (!open) { setSelectedItem(null); setRefreshKey((prev) => prev + 1); }
          }}
          onSuccess={() => { setShowModal(false); setRefreshKey((prev) => prev + 1); }}
          item={
            selectedItem
              ? {
                ...selectedItem,
                purchase_price: selectedItem.purchase_price ? Number(selectedItem.purchase_price) : null,
                item_type_id: (selectedItem as any).item_type_id ?? 0,
                category_id: (selectedItem as any).category_id ?? 0,
                measuring_unit_id: (selectedItem as any).measuring_unit_id ?? 0,
                gst_tax_rate: (selectedItem as any).gst_tax_rate ?? 0,
              }
              : null
          }
        />

        {/* ── Delete Dialog ── */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-[400px] p-6 rounded-2xl">
            <DialogHeader className="flex flex-col items-center text-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-100">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <DialogTitle className="text-base font-semibold text-gray-900">Delete Item?</DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                This action cannot be undone. The item will be permanently removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-row gap-3 mt-1">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="flex-1 rounded-xl" disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white border-0"
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default InventoryPage;