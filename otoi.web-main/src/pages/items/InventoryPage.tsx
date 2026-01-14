
import React, { useMemo, useState, useEffect, useRef } from "react";
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
import { ChevronDown, MoreVertical, Edit, Trash2, Eye } from "lucide-react";
import { ColumnDef, Column } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import CreateItemModal from "./CreateItemModal";
import { getItems, deleteItem, getItemById } from "../../pages/items/services/items.service";


interface InventoryItem {
  item_id: number;
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
  table?: any; // Add this line to fix the missing property error
}

interface IInventoryItemsProps {
  refreshStatus?: number;
}

const InventoryPage = ({ refreshStatus = 0 }: IInventoryItemsProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [lowStock, setLowStock] = useState(false);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);


  const navigate = useNavigate();

  // Fetch items from API
  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await getItems("", 1, 1000); // Fetch all items at once

      const itemsData = Array.isArray(response)
        ? response
        : (response && 'items' in response)
          ? response.items
          : [];

      const mappedItems = itemsData
        .map((item: any) => ({
          item_id: item.id || 0,
          item_name: item.item_name || "Unnamed Item",
          item_code: item.item_code || `ITEM-${Date.now()}`,
          opening_stock: toNumber(item.opening_stock, 0),
          sales_price: toNumber(item.sales_price, 0),
          purchase_price:
            item.purchase_price !== null && item.purchase_price !== "None"
              ? toNumber(item.purchase_price, 0)
              : null,
          type: item.item_type || item.type || "Product",
          category: item.category || "Uncategorized",
          business_id: item.business_id || null,
        }))
        .sort((a, b) => b.item_id - a.item_id);

      setItems(mappedItems);
    } catch (err) {
      console.error("Error fetching items:", err);
      setItems([]);
      toast.error("Failed to fetch items. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  // Fetch items on component mount or when dependencies change
  // useEffect(() => {
  //   fetchItems();
  // }, [refreshStatus, searchQuery, lowStock]);
  useEffect(() => {
    fetchItems();
  }, [refreshStatus]); // Remove searchQuery from dependencies


  useEffect(() => {
    let result = [...items];

    // Apply search filter
    if (searchQuery.trim() !== "") {
      result = result.filter(
        (item) =>
          item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply low stock filter
    if (lowStock) {
      result = result.filter((item) => (item.opening_stock || 0) <= 5);
    }

    setFilteredItems(result);
  }, [searchQuery, lowStock, items]);

  // Update refresh key when refreshStatus changes
  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [refreshStatus]);

  // Calculate stock value and low stock count
  const stockValue = items.reduce((sum, item) => sum + (item.sales_price || 0) * (item.opening_stock || 0), 0);
  const lowStockCount = items.filter((item) => (item.opening_stock || 0) <= 5).length;

  // Delete an item with confirmation
  const handleDeleteClick = (id: number, onClose?: () => void) => {
    if (onClose) onClose();
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Helper function to safely convert to number with fallback
  const toNumber = (value: any, fallback = 0): number => {
    if (value === null || value === undefined || value === 'None') return fallback;
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  };


  const handleConfirmDelete = async () => {
    if (itemToDelete === null) return;

    setIsDeleting(true);
    try {
      await deleteItem(itemToDelete);
      toast.success("Item deleted successfully");
      fetchItems();
    } catch (err) {
      console.error("Failed to delete item:", err);
      toast.error("Failed to delete item. Please try again.");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Edit an item
  const handleEdit = async (item: InventoryItem) => {
    // console.log("Edit clicked for item:", item.item_id); // Debug log

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

  // Render the component
  return (
    <div className="container-fluid p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Items</h1>
      </div>


      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
        {/* Stock Value */}
        <div className="card border rounded-3 grow">
          <div className="card-body py-4 px-5 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <i className="bi bi-graph-up text-primary fs-5"></i>
                <span className="font-semibold text-primary">Stock Value</span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold">₹ {stockValue.toLocaleString('en-IN')}</div>
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
                <span className="font-semibold text-warning">Low Stock</span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold">{lowStockCount}</div>
            </div>
            <i className="bi bi-box-arrow-up-right text-muted fs-4"></i>
          </div>
        </div>
      </div>

      {/* Search and Buttons */}
      <div className="flex flex-wrap gap-2.5 mb-5">
        <button
          className={`btn btn-sm ${lowStock ? "btn-primary" : "btn-light"}`}
          onClick={() => setLowStock(!lowStock)}
        >
          {lowStock ? "Showing Low Stock" : "Show Low Stock"}
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={() => {
            setSelectedItem(null);
            setShowModal(true);
          }}
        >
          Create Item
        </button>
      </div>



      {/* Search Bar */}
      <div className="bg-white border rounded-lg overflow-hidden flex flex-col mt-4 h-full">
        <div className="p-4 border-b">
          <label className="input input-sm w-full md:w-64">
            <KeenIcon icon="magnifier" />
            <input
              type="text"
              placeholder="Search items"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>

        {/* DataGrid Container */}
        <div className="flex-grow overflow-hidden">
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : (
            <div className="h-full">
              <DataGrid
                key={refreshKey}
                columns={columns}
                data={filteredItems}
                rowSelection
                getRowId={(row) => row.item_id.toString()}
                pagination={{ size: 5 }}
              />
            </div>
          )}
        </div>
      </div>


      {/* Modal */}
      <CreateItemModal
        open={showModal}
        onOpenChange={() => {
          setShowModal(false);
          setSelectedItem(null);
          fetchItems();
        }}
        onSuccess={fetchItems}
        item={
          selectedItem
            ? {
              ...selectedItem,
              purchase_price: selectedItem.purchase_price ?? undefined,
              item_type_id: (selectedItem as any).item_type_id ?? 0,
              category_id: (selectedItem as any).category_id ?? 0,
              measuring_unit_id: (selectedItem as any).measuring_unit_id ?? 0,
              gst_tax_rate: (selectedItem as any).gst_tax_rate ?? 0,
            }
            : null
        }

      />

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