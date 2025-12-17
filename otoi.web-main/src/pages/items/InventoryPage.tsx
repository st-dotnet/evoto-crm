import { useEffect, useState } from "react";
import { getItems, createItem, deleteItem } from "../../pages/items/services/items.service";
import { Item } from "../../pages/items/types/items";
import CreateItemModal from "./CreateItemModal";

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [lowStock, setLowStock] = useState(false);
  const [total, setTotal] = useState(0);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await getItems(search, page, 10);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(typeof data?.total === "number" ? data.total : 0);
    } catch (err) {
      console.error(err);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [page, search, lowStock]);

  const stockValue = items.reduce((sum, i) => sum + (i.sales_price || 0) * (i.stock || 0), 0);
  const lowStockCount = items.filter((i) => (i.stock || 0) <= 5).length;

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete item?")) return;
    try {
      await deleteItem(id);
      fetchItems();
    } catch (err) {
      console.error("Failed to delete item:", err);
      alert("Failed to delete item");
    }
  };

  const handleEdit = (item: Item) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  return (
    <div className="container-fluid">
      {/* Header */}
      <div className="d-flex justify-content-between mb-6">
        <h1 className="fw-bold">Items</h1>
      </div>

      {/* SUMMARY CARDS */}
      <div className="row g-4 mb-5" style={{display:"flex",gap:"20em"}}>
        {/* Stock Value */}
        <div className="col-md-4"style={{width:"30em"}}>
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
        <div className="col-md-4"style={{width:"30em"}}>
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

      {/* Search */}
      <div className="d-flex gap-3 mb-5">
        <input
          className="form-control w-250px"
          placeholder="Search Item"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      {/* Modal */}
      <CreateItemModal
        open={showModal}
        onOpenChange={() => {
          setShowModal(false);
          setSelectedItem(null);
        }}
        onSuccess={fetchItems}
        item={selectedItem}
      />

      {/* Table */}
      {loading ? (
        <div className="text-center py-10">Loading...</div>
      ) : Array.isArray(items) && items.length > 0 ? (
        <table className="table table-row-dashed">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Category</th>
              <th>Price</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.type}</td>
                <td>{item.category}</td>
                <td>₹{item.sales_price}</td>
                <td className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-light-primary"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-light-danger"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !loading && (
          <div className="text-center mt-20">
            <h3>Add all your Items at once!</h3>
            <p>For quicker and easier experience of creating sales invoices</p>
            <div className="d-flex justify-center gap-3">
              <button className="btn btn-light-primary">Add Items with Excel</button>
              <button className="btn btn-light">Import Items</button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
