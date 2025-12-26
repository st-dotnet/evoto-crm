import React, { useMemo, useState, useEffect } from "react";
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
import { getItems, deleteItem } from "../../pages/items/services/items.service";

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
  const navigate = useNavigate();

  // Fetch items from API
  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await getItems(searchQuery, 1, 10);

      // Handle both array and object responses
      const itemsData = Array.isArray(response)
        ? response
        : (response && 'items' in response)
          ? response.items
          : [];

      // Helper function to safely convert to number with fallback
      const toNumber = (value: any, fallback = 0) => {
        if (value === null || value === undefined || value === 'None') return fallback;
        const num = Number(value);
        return isNaN(num) ? fallback : num;
      };

      const mappedItems = itemsData.map((item: any) => {
        // Ensure all required fields have proper fallbacks
        const mappedItem = {
          item_id: item.id || 0,
          item_name: item.item_name || "Unnamed Item",
          item_code: item.item_code || `ITEM-${Date.now()}`,
          opening_stock: toNumber(item.opening_stock, 0),
          sales_price: toNumber(item.sales_price, 0),
          purchase_price: item.purchase_price !== null && item.purchase_price !== 'None'
            ? toNumber(item.purchase_price, 0)
            : null,
          type: item.item_type || item.type || "Product",
          category: item.category || "Uncategorized",
          business_id: item.business_id || null,
        };

        console.log("Mapped item:", mappedItem); // Debug log
        return mappedItem;
      });

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
  useEffect(() => {
    fetchItems();
  }, [refreshStatus, searchQuery, lowStock]);

  // Update refresh key when refreshStatus changes
  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [refreshStatus]);

  // Calculate stock value and low stock count
  const stockValue = items.reduce((sum, item) => sum + (item.sales_price || 0) * (item.opening_stock || 0), 0);
  const lowStockCount = items.filter((item) => (item.opening_stock || 0) <= 5).length;

  // Delete an item with confirmation
  const handleDeleteClick = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
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
  const columns = useMemo<ColumnDef<InventoryItem>[]>(
    () => [
      {
        accessorKey: "item_id",
        header: () => <DataGridRowSelectAll />,
        cell: ({ row }) => <DataGridRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerClassName: "w-0",
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
        cell: (info) => info.row.original.sales_price,
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
        cell: (info) => info.row.original.purchase_price ?? "N/A",
        meta: {
          headerClassName: "min-w-[137px]",
          cellClassName: "text-gray-800 font-medium",
        },
      },
      {
        id: "actions",
        header: ({ column }) => (
          <DataGridColumnHeader title="Actions" column={column} />
        ),
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="flex items-center gap-1 text-sm text-primary hover:text-primary-active"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEdit(row.original);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate(`/items/inventory/${row.original.item_id}`);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                <span>Details</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteClick(row.original.item_id);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4 text-red-500" />
                <span className="text-red-500">Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        meta: {
          headerClassName: "w-28",
          cellClassName: "text-gray-800 font-medium",
        },
      },
    ],
    []
  );

  // Toolbar component for search
  const Toolbar = ({
    defaultSearch,
    setSearch,
  }: {
    defaultSearch: string;
    setSearch: (query: string) => void;
  }) => {
    const [searchInput, setSearchInput] = useState(defaultSearch);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        setSearch(searchInput);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(e.target.value);
    };

    return (
      <div className="card-header flex justify-between flex-wrap gap-2 border-b-0 px-5">
        <div className="flex flex-wrap gap-2 lg:gap-5">
          <div className="flex">
            <label className="input input-sm">
              <KeenIcon icon="magnifier" />
              <input
                type="text"
                placeholder="Search items"
                value={searchInput}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
              />
            </label>
          </div>
        </div>
      </div>
    );
  };

  // Render the component
  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="d-flex justify-content-between mb-6">
        <h1 className="fw-bold">Items</h1>
      </div>

      {/* Summary Cards */}
      <div className="row g-4 mb-5" style={{ display: "flex", gap: "20em" }}>
        {/* Stock Value */}
        <div className="col-md-4" style={{ width: "30em" }}>
          <div className="card border rounded-3">
            <div className="card-body py-4 px-5 d-flex justify-content-between align-items-center">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-graph-up text-primary fs-5"></i>
                  <span className="fw-semibold text-primary">Stock Value</span>
                </div>
                <div className="fs-3 fw-bold">₹ {stockValue}</div>
              </div>
              <i className="bi bi-box-arrow-up-right text-muted fs-4"></i>
            </div>
          </div>
        </div>

        {/* Low Stock */}
        <div className="col-md-4" style={{ width: "30em" }}>
          <div className="card border rounded-3">
            <div className="card-body py-4 px-5 d-flex justify-content-between align-items-center">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-box-seam text-warning fs-5"></i>
                  <span className="fw-semibold text-warning">Low Stock</span>
                </div>
                <div className="fs-3 fw-bold">{lowStockCount}</div>
              </div>
              <i className="bi bi-box-arrow-up-right text-muted fs-4"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Buttons */}
      <div className="d-flex gap-3 mb-5" style={{ display: 'flex' }} >
        {/* <input
          className="form-control w-250px"
          placeholder="Search Item"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        /> */}
        <button
          className={`btn ${lowStock ? "btn-primary" : "btn-light"}`}
          onClick={() => setLowStock(!lowStock)}
        >
          Show Low Stock
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSelectedItem(null);
            setShowModal(true);
          }}
        >
          Create Item
        </button>
      </div>

      {/* DataGrid */}
      <div className="grid gap-5 lg:gap-7.5">
        {loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : (
          <DataGrid
            key={refreshKey}
            columns={columns}
            data={items}
            rowSelection={true}
            getRowId={(row) => row.item_id.toString()}
            pagination={{ size: 5 }}
            toolbar={
              <Toolbar
                defaultSearch={searchQuery}
                setSearch={setSearchQuery}
              />
            }
          />
        )}
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
        item={selectedItem ? { ...selectedItem, purchase_price: selectedItem.purchase_price ?? undefined } : null}
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