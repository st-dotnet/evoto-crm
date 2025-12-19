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
}

interface IColumnFilterProps<TData, TValue> {
  column: Column<TData, TValue>;
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
  const navigate = useNavigate();

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await getItems(searchQuery, 1, 10);

      // Handle the backend response format
      const itemsData = response?.items || [];

      const mappedItems = itemsData.map((item: any) => ({
        item_id: item.id || 0,
        item_name: item.name || "",
        item_code: item.code || "N/A",
        opening_stock: item.stock || 0,
        sales_price: item.sales_price || 0,
        purchase_price: null,
        type: item.type,
        category: item.category,
        business_id: item.business_id
      }));

      setItems(mappedItems);
    } catch (err) {
      console.error(err);
      setItems([]);
      toast("Failed to fetch items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [refreshStatus, searchQuery, lowStock]);

  useEffect(() => {
    setRefreshKey((prev) => prev + 1);
  }, [refreshStatus]);

  const stockValue = items.reduce((sum, i) => sum + (i.sales_price || 0) * (i.opening_stock || 0), 0);
  const lowStockCount = items.filter((i) => (i.opening_stock || 0) <= 5).length;

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete item?")) return;
    try {
      await deleteItem(id);
      fetchItems();
    } catch (err) {
      console.error("Failed to delete item:", err);
      toast("Failed to delete item");
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const ColumnInputFilter = <TData, TValue>({
    column,
  }: IColumnFilterProps<TData, TValue>) => {
    const [inputValue, setInputValue] = useState(
      (column.getFilterValue() as string) ?? ""
    );

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
                  navigate(`/inventory/${info.row.original.item_id}`);
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
              <button className="flex items-center gap-1 text-sm text-primary hover:text-primary-active">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  handleEdit(row.original);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/inventory/${row.original.item_id}`);
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                <span>Details</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(row.original.item_id);
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

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="d-flex justify-content-between mb-6">
        <h1 className="fw-bold">Items</h1>
      </div>

      {/* SUMMARY CARDS */}
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
      <div className="d-flex gap-3 mb-5">
        <input
          className="form-control w-250px"
          placeholder="Search Item"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
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
        item={selectedItem}
      />
    </div>
  );
};

export default InventoryPage;



// import { useEffect, useState } from "react";
// import { getItems, createItem, deleteItem } from "../../pages/items/services/items.service";
// import { Item } from "../../pages/items/types/items";
// import CreateItemModal from "./CreateItemModal";

// export default function InventoryPage() {
//   const [items, setItems] = useState<Item[]>([]);
//   const [showModal, setShowModal] = useState(false);
//   const [search, setSearch] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [page, setPage] = useState(1);
//   const [lowStock, setLowStock] = useState(false);
//   const [total, setTotal] = useState(0);
//   const [selectedItem, setSelectedItem] = useState<Item | null>(null);

//   const fetchItems = async () => {
//     try {
//       setLoading(true);
//       const data = await getItems(search, page, 10);
//       console.log("ITEMS API RESPONSE", data);
//       setItems(Array.isArray(data?.items) ? data.items : []);
//       setTotal(typeof data?.total === "number" ? data.total : 0);
//     } catch (err) {
//       console.error(err);
//       setItems([]);
//       setTotal(0);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchItems();
//   }, [page, search, lowStock]);

//   const stockValue = items.reduce((sum, i) => sum + (i.sales_price || 0) * (i.opening_stock || 0), 0);
//   const lowStockCount = items.filter((i) => (i.opening_stock || 0) <= 5).length;

//   const handleDelete = async (id: number) => {
//     if (!window.confirm("Delete item?")) return;
//     try {
//       await deleteItem(id);
//       fetchItems();
//     } catch (err) {
//       console.error("Failed to delete item:", err);
//       alert("Failed to delete item");
//     }
//   };

//   const handleEdit = (item: Item) => {
//     setSelectedItem(item);
//     setShowModal(true);
//   };

//   return (
//     <div className="container-fluid">
//       {/* Header */}
//       <div className="d-flex justify-content-between mb-6">
//         <h1 className="fw-bold">Items</h1>
//       </div>

//       {/* SUMMARY CARDS */}
//       <div className="row g-4 mb-5" style={{ display: "flex", gap: "20em" }}>
//         {/* Stock Value */}
//         <div className="col-md-4" style={{ width: "30em" }}>
//           <div className="card border rounded-3">
//             <div className="card-body py-4 px-5 d-flex justify-content-between align-items-center">
//               <div>
//                 <div className="d-flex align-items-center gap-2 mb-1">
//                   <i className="bi bi-graph-up text-primary fs-5"></i>
//                   <span className="fw-semibold text-primary">Stock Value</span>
//                 </div>
//                 <div className="fs-3 fw-bold">₹ {stockValue}</div>
//               </div>
//               <i className="bi bi-box-arrow-up-right text-muted fs-4"></i>
//             </div>
//           </div>
//         </div>

//         {/* Low Stock */}
//         <div className="col-md-4" style={{ width: "30em" }}>
//           <div className="card border rounded-3">
//             <div className="card-body py-4 px-5 d-flex justify-content-between align-items-center">
//               <div>
//                 <div className="d-flex align-items-center gap-2 mb-1">
//                   <i className="bi bi-box-seam text-warning fs-5"></i>
//                   <span className="fw-semibold text-warning">Low Stock</span>
//                 </div>
//                 <div className="fs-3 fw-bold">{lowStockCount}</div>
//               </div>
//               <i className="bi bi-box-arrow-up-right text-muted fs-4"></i>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Search */}
//       <div className="d-flex gap-3 mb-5">
//         <input
//           className="form-control w-250px"
//           placeholder="Search Item"
//           value={search}
//           onChange={(e) => setSearch(e.target.value)}
//         />
//         <button
//           className={`btn ${lowStock ? "btn-primary" : "btn-light"}`}
//           onClick={() => setLowStock(!lowStock)}
//         >
//           Show Low Stock
//         </button>
//         <button
//           className="btn btn-primary"
//           onClick={() => {
//             setSelectedItem(null);
//             setShowModal(true);
//           }}
//         >
//           Create Item
//         </button>
//       </div>

//       {/* Modal */}
//       <CreateItemModal
//         open={showModal}
//         onOpenChange={() => {
//           setShowModal(false);
//           setSelectedItem(null);
//         }}
//         onSuccess={fetchItems}
//         item={selectedItem}
//       />

//       Table
//       {loading ? (
//         <div className="text-center py-10">Loading...</div>
//       ) : Array.isArray(items) && items.length > 0 ? (
//         <table className="table table-row-dashed">
//           <thead>
//             <tr>
//               <th>Name</th>
//               <th>Type</th>
//               <th>Category</th>
//               <th>Price</th>
//               <th>Actions</th>
//             </tr>
//           </thead>
//           <tbody>
//             {items.map((item) => (
//               <tr key={item.id}>
//                 <td>{item.item_name}</td>
//                 <td>{item.id}</td>
//                 <td>{item.opening_stock}</td>
//                 <td>₹{item.sales_price}</td>
//                 <td className="d-flex gap-2">
//                   <button
//                     className="btn btn-sm btn-light-primary"
//                     onClick={() => handleEdit(item)}
//                   >
//                     Edit
//                   </button>
//                   <button
//                     className="btn btn-sm btn-light-danger"
//                     onClick={() => handleDelete(item.id)}
//                   >
//                     Delete
//                   </button>
//                 </td>
//               </tr>
//             ))}
//           </tbody>

//         </table>
//       ) : (
//         !loading && (
//           <div className="text-center mt-20">
//             <h3>Add all your Items at once!</h3>
//             <p>For quicker and easier experience of creating sales invoices</p>
//             <div className="d-flex justify-center gap-3">
//               <button className="btn btn-light-primary">Add Items with Excel</button>
//               <button className="btn btn-light">Import Items</button>
//             </div>
//           </div>
//         )
//       )}
//     </div>
//   );
// }

