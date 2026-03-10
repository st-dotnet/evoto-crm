
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
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
import { MoreVertical, Edit, Trash2, Eye, X, Check, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { SpinnerDotted } from 'spinners-react';
import axios from "axios";
import CreateItemModal from "./CreateItemModal";
import { getItems, deleteItem, getItemById } from "../../pages/items/services/items.service";


interface InventoryItem {
  item_id: string; // UUID from backend
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ item_id: string; item_name: string }[]>([]);

  useEffect(() => {
    setSearchInput(defaultSearch);
  }, [defaultSearch]);

  useEffect(() => {
    const fetchAllItems = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/items/?dropdown=true`);
        // Remove duplicates by item_name, keeping only unique items with safety checks
        const responseData = response?.data ?? [];
        const uniqueItems = responseData.reduce((acc: any[], item: any) => {
          if (!item?.item_name) return acc; // Skip items without names
          const existingItem = acc.find(existing => existing?.item_name === item?.item_name);
          if (!existingItem) {
            acc.push(item);
          }
          return acc;
        }, []);

        // Sort items alphabetically by item_name
        const sortedItems = uniqueItems.sort((a: any, b: any) => {
          const nameA = a?.item_name?.toLowerCase() ?? '';
          const nameB = b?.item_name?.toLowerCase() ?? '';
          return nameA.localeCompare(nameB);
        });

        setItems(sortedItems);
      } catch (error) {
        console.error("Failed to fetch all items dropdown", error);
        setItems([]); // Set empty array on error
      }
    };
    fetchAllItems();
  }, []);

  // Handle input change and trigger debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    setOpen(true); // Keep dropdown open while typing
  };

  const filteredItems = useMemo(() => {
    if (!searchInput) return items;
    return items.filter((item) =>
      item?.item_name?.toLowerCase()?.includes(searchInput?.toLowerCase())
    );
  }, [items, searchInput]);

  return (
    <div className="card-header flex flex-col lg:flex-row lg:justify-between gap-5 border-b-0 px-5 py-4">
      <div className="flex flex-col md:flex-row md:items-center gap-5 w-full lg:w-auto">
        <div className="flex grow w-full md:w-64 lg:w-72">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <KeenIcon
                  icon="magnifier"
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-500"
                />
                <Input
                  placeholder="Search items..."
                  value={searchInput}
                  onChange={handleInputChange}
                  onClick={() => setOpen(true)} // Added to ensure popover opens on click
                  className="pl-9 pr-9 h-9 text-xs"
                />
                {searchInput && (
                  <X
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 cursor-pointer hover:text-gray-600"
                    onClick={() => {
                      setSearchInput("");
                      setSearch("");
                    }}
                  />
                )}
              </div>
            </PopoverTrigger>

            <PopoverContent
              className="p-0 w-[var(--radix-popover-trigger-width)]"
              align="start"
              onOpenAutoFocus={(e) => e?.preventDefault()} // Prevents focus jump
            >
              <Command>
                <CommandList>
                  {(filteredItems || [])?.length === 0 && (
                    <CommandEmpty>No item found.</CommandEmpty>
                  )}
                  <CommandGroup>
                    {(filteredItems || [])?.map((item) => (
                      <CommandItem
                        key={item?.item_id}
                        value={item?.item_name}
                        onSelect={() => {
                          setSearchInput(item?.item_name);
                          setSearch(item?.item_name); // Hit the API with exact selection
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            searchInput === item?.item_name ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {item?.item_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="flex items-center gap-2 w-full lg:w-auto lg:justify-end">
        {/* <select 
          value={defaultProductType === "all" ? "" : defaultProductType} 
          onChange={(e) => setDefaultProductType(e.target.value || "all")}
          className="item-type-filter px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Items</option>
          <option value="Product">Products</option>
          <option value="Service">Services</option>
        </select> */}
        <button
          className={`btn btn-sm ${defaultLowStock ? "btn-primary" : "btn-light"}`}
          onClick={() => setDefaultLowStock(!defaultLowStock)}
        >
          {defaultLowStock ? "Showing Low Stock" : "Show Low Stock"}
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={onCreateItem}
        >
          Create Item
        </button>
      </div>
    </div>
  );
};

const MobileView = ({
  onEdit,
  onDetails,
  onDelete
}: {
  onEdit: (item: InventoryItem) => void;
  onDetails: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const { table, loading } = useDataGrid();
  const rows = table.getRowModel().rows;

  if (loading && rows.length === 0) return null;

  return (
    <div className="flex flex-col lg:hidden border-t border-gray-100">
      {rows.map((row) => {
        const item = row.original as InventoryItem;
        return (
          <div
            key={item.item_id}
            className="flex justify-between items-center py-4 px-5 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50 transition-all active:bg-gray-50"
          >
            <div
              className="flex flex-col cursor-pointer grow pr-4"
              onClick={() => onDetails(item.item_id)}
            >
              <span className="font-semibold text-gray-900 text-sm mb-0.5">{item.item_name}</span>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-500 font-medium">{item.item_code}</span>
                <span className="text-xs text-gray-400 font-normal">
                  Stock: {item.opening_stock} | Price: ₹{item.sales_price?.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {item.image && (
              <div className="size-12 rounded-lg overflow-hidden border border-gray-100 mr-3 shrink-0">
                <img src={item.image} alt={item.item_name} className="w-full h-full object-cover" />
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center size-9 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all shrink-0">
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-30 p-1 shadow-lg border-gray-200">
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => onEdit(item)}
                >
                  <Edit className="mr-2 h-4 w-4 text-gray-500" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm rounded-md cursor-pointer"
                  onClick={() => onDetails(item.item_id)}
                >
                  <Eye className="mr-2 h-4 w-4 text-gray-500" />
                  Details
                </DropdownMenuItem>
                <div className="my-1 border-t border-gray-100"></div>
                <DropdownMenuItem
                  className="flex items-center px-3 py-2 text-sm text-red-500 rounded-md cursor-pointer focus:bg-red-50"
                  onClick={() => onDelete(item.item_id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
      {rows.length === 0 && !loading && (
        <div className="p-16 text-center">
          <div className="flex flex-col items-center gap-2">
            <KeenIcon icon="folder-search" className="text-3xl text-gray-200" />
            <span className="text-gray-400 text-sm font-medium">No items found matching your criteria.</span>
          </div>
        </div>
      )}
    </div>
  );
};

const InventoryPage = ({ refreshStatus = 0 }: IInventoryItemsProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [lowStock, setLowStock] = useState(false);
  const [productType, setProductType] = useState<string>("all"); // "all", "Product", "Service"
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isEditing, setIsEditing] = useState(false);
  const [itemsData, setItemsData] = useState<InventoryItem[]>([]);
  const [allItemsForCount, setAllItemsForCount] = useState<InventoryItem[]>([]);

  const navigate = useNavigate();

  // Helper function to safely convert to number with fallback
  const toNumber = (value: any, fallback = 0): number => {
    if (value === null || value === undefined || value === 'None') return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  };

  // Fetch all items for accurate low stock count
  const fetchAllItemsForCount = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/items/?items_per_page=10000`);
      const payload: any = response?.data as any;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);

      const mappedItems: InventoryItem[] = rows.map((item: any) => ({
        item_id: item.id || "",
        item_name: item.item_name || "Unnamed Item",
        item_code: item.item_code || `ITEM-${Date.now()}`,
        opening_stock: toNumber(item.opening_stock, 0),
        sales_price: toNumber(item.sales_price, 0),
        purchase_price:
          item.purchase_price !== null && item.purchase_price !== "None"
            ? toNumber(item.purchase_price, 0)
            : null,
        type: item.item_type || item.type || "Product",
        item_type_id: item.item_type_id || (item.item_type === "Service" ? 2 : 1),
        category: item.category || "Uncategorized",
        business_id: item.business_id || null,
        description: item.description,
        hsn_code: item.hsn_code,
        category_id: item.category_id,
        measuring_unit_id: item.measuring_unit_id,
        gst_tax_rate: item.gst_tax_rate,
        image: item.image,
      }));

      setAllItemsForCount(mappedItems);
    } catch (error) {
      console.error("Failed to fetch all items for count", error);
    }
  };

  // Fetch items from API with pagination, sorting, and search
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

      if (searchQuery) {
        queryParams.set("query", searchQuery);
      } else {
        queryParams.delete("query");
      }

      if (lowStock) {
        queryParams.set("low_stock", "true");
      }

      if (productType && productType !== "all") {
        queryParams.set("item_type_id", productType === "Product" ? "1" : "2");
      }

      if (params.columnFilters) {
        params.columnFilters.forEach(({ id, value }) => {
          if (value !== undefined && value !== null) {
            queryParams.set(`filter[${id}]`, String(value));
          }
        });
      }

      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/items/?${queryParams.toString()}`,
      );
      const payload: any = response?.data as any;
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      const total = payload?.pagination?.total ?? (Array.isArray(payload) ? rows.length : 0);

      // Map response data to our interface
      const mappedItems: InventoryItem[] = rows.map((item: any) => ({
        item_id: item.id || "",
        item_name: item.item_name || "Unnamed Item",
        item_code: item.item_code || `ITEM-${Date.now()}`,
        opening_stock: toNumber(item.opening_stock, 0),
        sales_price: toNumber(item.sales_price, 0),
        purchase_price:
          item.purchase_price !== null && item.purchase_price !== "None"
            ? toNumber(item.purchase_price, 0)
            : null,
        type: item.item_type || item.type || "Product",
        item_type_id: item.item_type_id || (item.item_type === "Service" ? 2 : 1),
        category: item.category || "Uncategorized",
        business_id: item.business_id || null,
        description: item.description,
        hsn_code: item.hsn_code,
        category_id: item.category_id,
        measuring_unit_id: item.measuring_unit_id,
        gst_tax_rate: item.gst_tax_rate,
        image: item.image,
      }));

      // Backend handles filtering when low_stock=true, no need for client-side filtering
      setItems(mappedItems);
      return {
        data: mappedItems,
        totalCount: total,
      };
    } catch (error) {
      console.log(error);
      toast(`Connection Error`, {
        description: `An error occurred while fetching data. Please try again later`,
        action: {
          label: "Ok",
          onClick: () => console.log("Ok"),
        },
      });

      return {
        data: [],
        totalCount: 0,
      };
    } finally {
      setLoading(false);
    }
  };

  // Fetch items on component mount or when dependencies change
  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
    fetchAllItemsForCount(); // Fetch all items for accurate low stock count
  }, [refreshStatus, searchQuery, lowStock]);

  // Calculate stock value and low stock count (Products only)
  const stockValue = items
    .filter(item => item.item_type_id === 1)
    .reduce((sum, item) => sum + (item.sales_price || 0) * (item.opening_stock || 0), 0);

  const lowStockCount = allItemsForCount.filter((item) => (item.opening_stock || 0) <= 5).length;

  // Delete an item with confirmation
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
      setRefreshKey((prev) => prev + 1); // Trigger refresh instead of calling fetchItems directly
    } catch (err) {
      toast.error("Failed to delete item. Please try again.");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Edit an item
  const handleEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowModal(true);
  };


  // Column filter component
  const ColumnInputFilter = <TData, TValue>({ column }: IColumnFilterProps<TData, TValue>) => {
    const [inputValue, setInputValue] = useState((column.getFilterValue() as string) ?? "");

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        column.setFilterValue(inputValue);
      }
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value);
    };

    return (
      <Input
        placeholder="Filter..."
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="h-9 w-full max-w-40"
      />
    );
  };

  // Define columns for DataGrid
  const columns = useMemo<ColumnDef<InventoryItem>[]>(() => [
    {
      accessorKey: "item_id",
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
      accessorKey: "image",
      header: ({ column }) => (
        <DataGridColumnHeader title="Image" column={column} />
      ),
      enableSorting: false,
      cell: (info) => {
        const image = info.row.original.image;
        if (!image) return <div className="size-10 rounded bg-gray-50 border border-gray-100 flex items-center justify-center"><KeenIcon icon="picture" className="text-gray-300 size-5" /></div>;
        return (
          <div className="size-10 rounded overflow-hidden border border-gray-100">
            <img src={image} alt="Product" className="w-full h-full object-cover" />
          </div>
        );
      },
      meta: {
        headerClassName: "w-20",
        cellClassName: "text-center",
      },
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
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col">
            <a
              className="font-medium text-sm text-gray-900 hover:text-primary-active mb-px cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                navigate(`/items/inventory/${info.row.original.item_id}`);
              }}
            >
              {info.row.original.item_name}
            </a>
            <span className="text-2sm text-gray-700 font-normal">
              {info.row.original.item_code}
            </span>

          </div>
        </div>
      ),
      meta: {
        headerClassName: "min-w-[250px]",
      },
    },
    {
      accessorFn: (row) => row.opening_stock,
      id: "opening_stock",
      header: ({ column }) => (
        <DataGridColumnHeader title="Stock Quantity" column={column} />
      ),
      enableSorting: true,
      cell: (info) => info.row.original.opening_stock,
      meta: {
        headerClassName: "min-w-[137px]",
        cellClassName: "text-gray-800 font-medium",
      },
    },
    {
      accessorFn: (row) => row.sales_price,
      id: "sales_price",
      header: ({ column }) => (
        <DataGridColumnHeader title="Selling Price" column={column} />
      ),
      enableSorting: true,
      cell: (info) => {
        const value = info.row.original.sales_price;
        return `₹${value?.toLocaleString('en-IN') || '0'}`;
      },
      meta: {
        headerClassName: "min-w-[137px]",
        cellClassName: "text-gray-800 font-medium",
      },
    },
    {
      accessorFn: (row) => row.purchase_price,
      id: "purchase_price",
      header: ({ column }) => (
        <DataGridColumnHeader title="Purchase Price" column={column} />
      ),
      enableSorting: true,
      cell: (info) => {
        const value = info.row.original.purchase_price;
        return value ? `₹${value.toLocaleString('en-IN')}` : '₹0';

      },
      meta: {
        headerClassName: "min-w-[137px]",
        cellClassName: "text-gray-800 font-medium",
      },
    },
    {
      id: "actions",
      header: ({ column }) => (
        <DataGridColumnHeader title="Actions" column={column} className="justify-center" />
      ),
      enableSorting: false,
      meta: {
        headerClassName: "w-28",
        cellClassName: "text-gray-800 font-medium pointer-events-auto",
        disableRowClick: true,
      },
      cell: ({ row }) => {
        // const [isOpen, setIsOpen] = useState(false);
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
                    e.stopPropagation();
                    handleEdit(row.original);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/items/inventory/${row.original.item_id}`);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Details
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteClick(row.original.item_id, () => setIsOpen(false));
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
    []
  );

  // Handle row selection changes
  const handleRowSelection = (state: RowSelectionState) => {
    setRowSelection(state);
    const selectedRowIds = Object.keys(state);
    if (selectedRowIds.length > 0) {
      toast(`Total ${selectedRowIds.length} are selected.`);
    }
  };
  // Render the component
  return (
    <div className="grid gap-5 lg:gap-7.5 relative">
      {(loading || isDeleting || isEditing) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 dark:bg-black/80">
          <div className="text-primary">
            <SpinnerDotted size={50} thickness={100} speed={100} color="#3b82f6" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6 mx-4 lg:mx-6">
        <h1 className="text-2xl font-bold">Items</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5 mx-4 lg:mx-6">
        {/* Stock Value */}
        <div className="card border rounded-3 grow">
          <div className="card-body py-4 px-5 flex justify-between items-center">
            <div>
              <div className="flex items-center mb-1">
                <i className="bi bi-graph-up text-primary fs-5"></i>
                <span className=" text-primary">Stock Value</span>
              </div>
              <div className="text-xl">₹{stockValue.toLocaleString('en-IN')}</div>
            </div>
            <i className="bi bi-box-arrow-up-right text-muted fs-4"></i>
          </div>
        </div>

        {/* Low Stock */}
        <div className="card border rounded-3 grow">
          <div className="card-body py-4 px-5 flex justify-between items-center">
            <div>
              <div className="flex items-center mb-1">
                <i className="bi bi-box-seam text-warning fs-5"></i>
                <span className="text-warning">Low Stock</span>
              </div>
              <div className="text-xl ml-3"> {lowStockCount}</div>
            </div>
            <i className="bi bi-box-arrow-up-right text-muted fs-4"></i>
          </div>
        </div>
      </div>

      <div className="mx-4 lg:mx-6">
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
              onCreateItem={() => {
                setSelectedItem(null);
                setShowModal(true);
              }}
            />
          }
          layout={{
            card: true,
            classes: {
              container: 'hidden lg:block'
            }
          }}
        >
          <MobileView
            onEdit={handleEdit}
            onDetails={(id) => navigate(`/items/inventory/${id}`)}
            onDelete={(id) => handleDeleteClick(id)}
          />
        </DataGrid>
      </div>


      {/* Modal */}
      <div className="mx-4 lg:mx-6">
        <CreateItemModal
          open={showModal}
          onOpenChange={(open: boolean) => {
            setShowModal(open);

            if (!open) {
              setSelectedItem(null);
              setRefreshKey((prev) => prev + 1); // Increment key to trigger grid refresh
            }
          }}
          onSuccess={() => {
            setShowModal(false);
            setRefreshKey((prev) => prev + 1);
          }}
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
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[420px] p-4 sm:p-6 rounded-lg">
          <DialogHeader className="flex flex-col items-center text-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>

            <DialogTitle className="text-lg font-semibold">
              Delete Item
            </DialogTitle>

            <DialogDescription className="text-sm text-muted-foreground leading-relaxed text-center">
              Are you sure you want to delete this item?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-row gap-3 mt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="flex-1"
              disabled={isDeleting}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryPage;