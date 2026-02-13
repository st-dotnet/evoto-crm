
import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  DataGrid,
  DataGridColumnHeader,
  TDataGridRequestParams,
  KeenIcon,
  DataGridRowSelectAll,
  DataGridRowSelect,
} from "@/components";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit, Trash2, Eye, X, Check, Loader2 } from "lucide-react";
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
    <div className="card-header flex justify-between flex-wrap gap-3 border-b-0 px-5 py-4">
      <div className="flex grow md:grow-0">
        <Popover open={open} onOpenChange={setOpen}>
          <div className="relative w-full md:w-64 lg:w-72">
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
          </div>

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
      <div className="flex items-center gap-2">
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

  const navigate = useNavigate();

  // Helper function to safely convert to number with fallback
  const toNumber = (value: any, fallback = 0): number => {
    if (value === null || value === undefined || value === 'None') return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
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
      const mappedItems = rows.map((item: any) => ({
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
      }));

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
  }, [refreshStatus, searchQuery, lowStock]);

  // Calculate stock value and low stock count (Products only)
  const stockValue = items
    .filter(item => item.item_type_id === 1)
    .reduce((sum, item) => sum + (item.sales_price || 0) * (item.opening_stock || 0), 0);

  const lowStockCount = items.filter((item) => item.item_type_id === 1 && (item.opening_stock || 0) <= 5).length;

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
  const handleEdit = async (item: InventoryItem) => {
    // console.log("Edit clicked for item:", item.id); // Debug log

    try {
      setLoading(true);

      //  Fetch fresh data from DB
      const fullItem = await getItemById(item.item_id);

      setSelectedItem({
        item_id: fullItem.id,
        item_name: fullItem.item_name,
        item_code: fullItem.item_code,
        opening_stock: fullItem.opening_stock,
        sales_price: fullItem.sales_price,
        purchase_price: fullItem.purchase_price,
        description: fullItem.description,
        hsn_code: fullItem.hsn_code,
        type: fullItem.item_type,
        category: fullItem.category,
        business_id: fullItem.business_id,

        // keep extra fields for edit modal
        item_type_id: fullItem.item_type_id,
        category_id: fullItem.category_id,
        measuring_unit_id: fullItem.measuring_unit_id,
        gst_tax_rate: fullItem.gst_tax_rate,
      });

      setShowModal(true);
    } catch (error) {
      toast.error("Failed to load item details");
    } finally {
      setLoading(false);
    }
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
        headerClassName: "min-w-[300px]",
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
              <div className="flex items-center gap-2 mb-1">
                <i className="bi bi-graph-up text-primary fs-5"></i>
                <span className=" text-primary">Stock Value</span>
              </div>
              <div className="text-xl">₹ {stockValue.toLocaleString('en-IN')}</div>
            </div>
            <i className="bi bi-box-arrow-up-right text-muted fs-4"></i>
          </div>
        </div>

        {/* Low Stock */}
        <div className="card border rounded-3 grow">
          <div className="card-body py-4 px-5 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
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
          layout={{ card: true }}
        />
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
      {deleteDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteDialogOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-medium mb-4">Delete Item</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this item?.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;