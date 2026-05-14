import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, X } from "lucide-react";
import { getItems } from "../../items/services/items.service";
import { ItemsApiResponse } from "../../items/types/items";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FiX } from "react-icons/fi";
import { resolveImageUrl } from "@/utils/imageUtils";

interface InventoryItem {
  item_id: string;
  image?: string | null;
  item_name: string;
  item_code: string;
  opening_stock: number;
  sales_price: number;
  purchase_price: number | null;
  type: string;
  category: string;
  hsn_code?: string | null;
  quantity?: number;
  measuring_unit_id?: number;
}

interface AddItemPageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItems: (items: InventoryItem[]) => void;
  onCreateNewItem: () => void;
}

const AdditemPage: React.FC<AddItemPageProps> = ({
  open,
  onOpenChange,
  onAddItems,
  onCreateNewItem,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Fetch items from API
  const fetchItems = async () => {
    try {
      setLoading(true);
      let allItems: any[] = [];
      let currentPage = 1;
      let hasMoreItems = true;
      const pageSize = 100; // Reasonable page size

      // Fetch all pages until we have all items
      while (hasMoreItems) {
        const response: ItemsApiResponse = await getItems("", currentPage, pageSize);

        if (response.data && response.data.length > 0) {
          allItems = [...allItems, ...response.data];

          // Check if there are more pages based on pagination info
          if (response.pagination) {
            hasMoreItems = currentPage < response.pagination.last_page;
          } else {
            // Fallback: if no pagination info, assume no more items if we got less than requested
            hasMoreItems = response.data.length === pageSize;
          }

          currentPage++;
        } else {
          hasMoreItems = false;
        }
      }

      const itemsData = allItems;

      const mappedItems: InventoryItem[] = itemsData.map((item: any) => ({
        item_id: item.id?.toString() || "",
        item_name: item.item_name || "Unnamed Item",
        item_code: item.item_code || `ITEM-${Date.now()}`,
        opening_stock: Number(item.opening_stock) || 0,
        sales_price: Number(item.sales_price) || 0,
        purchase_price:
          item.purchase_price !== null && item.purchase_price !== "None"
            ? Number(item.purchase_price)
            : null,
        type: item.item_type || item.type || "Product",
        category: (
          (item.category && typeof item.category === "object" ? item.category.name : item.category) || 
          item.category_name || 
          "Uncategorized"
        ).trim(),
        hsn_code: item.hsn_code || null,
        image: item.image,
      }));

      setItems(mappedItems);

      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(mappedItems.map((item) => item.category))
      );
      setCategories(uniqueCategories);
    } catch (err) {
      toast.error("Failed to fetch items. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch items when modal opens
  useEffect(() => {
    if (open) {
      fetchItems();
      setSelectedItems(new Set());
      setItemQuantities({});
      setSearchQuery("");
      setSelectedCategory("all");
    }
  }, [open]);

  // Filter items based on search and category
  useEffect(() => {
    let result = [...items];

    // Apply search filter
    if (searchQuery.trim() !== "") {
      result = result.filter(
        (item) =>
          item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.item_code.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory !== "all") {
      result = result.filter((item) => item.category === selectedCategory);
    }

    setFilteredItems(result);
  }, [searchQuery, selectedCategory, items]);

  // Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
      // Remove quantity when item is deselected
      const newQuantities = { ...itemQuantities };
      delete newQuantities[itemId];
      setItemQuantities(newQuantities);
    } else {
      newSelected.add(itemId);
      // Set default quantity to 1 when item is selected
      setItemQuantities(prev => ({ ...prev, [itemId]: 1 }));
    }
    setSelectedItems(newSelected);
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      const newSelected = new Set(selectedItems);
      newSelected.delete(itemId);
      setSelectedItems(newSelected);
      const newQuantities = { ...itemQuantities };
      delete newQuantities[itemId];
      setItemQuantities(newQuantities);
    } else {
      // Update quantity
      setItemQuantities(prev => ({ ...prev, [itemId]: quantity }));
      // Also ensure it's selected if quantity is updated to > 0
      setSelectedItems(prev => new Set(prev).add(itemId));
    }
  };

  // Calculate total selected items (items with quantity > 0)
  const totalSelectedItems = Array.from(selectedItems).filter(itemId =>
    itemQuantities[itemId] && itemQuantities[itemId] > 0
  ).length;

  const incrementQuantity = (itemId: string) => {
    const currentQty = itemQuantities[itemId] || 0;
    updateItemQuantity(itemId, currentQty + 1);
  };

  const decrementQuantity = (itemId: string) => {
    const currentQty = itemQuantities[itemId] || 0;
    updateItemQuantity(itemId, currentQty - 1);
  };

  // Add selected items to quotation
  const handleAddItems = () => {
    const itemsToAdd = filteredItems.filter((item) =>
      selectedItems.has(item.item_id)
    ).map(item => ({
      ...item,
      quantity: itemQuantities[item.item_id] || 1
    }));
    onAddItems(itemsToAdd);
    setSelectedItems(new Set());
    setItemQuantities({});
    onOpenChange(false);
  };

  // Handle creating new item
  const handleCreateNewItem = () => {
    onOpenChange(false);
    onCreateNewItem();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl w-[85vw] max-h-[95vh] flex flex-col p-0 rounded-xl bg-white dark:bg-black border dark:border-zinc-800 shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <DialogTitle className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Add Items</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search and Filter Section */}
          <div className="px-4 sm:px-6 py-4 border-b dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                <Input
                  type="text"
                  placeholder="Search Items"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 w-full dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100 focus-visible:ring-1 focus-visible:ring-zinc-700"
                />
              </div>

              <div className="flex gap-2">
                {/* Category Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1 sm:min-w-[200px] justify-between h-10 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300">
                      <span className="truncate">
                        {selectedCategory === "all"
                          ? "Select Category"
                          : selectedCategory}
                      </span>
                      <span className="ml-2 text-[10px]">▼</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px] bg-white dark:bg-zinc-900 border dark:border-zinc-800">
                    <DropdownMenuItem onClick={() => setSelectedCategory("all")} className="dark:text-zinc-300 dark:hover:bg-zinc-800">
                      All Categories
                    </DropdownMenuItem>
                    {categories.map((category) => (
                      <DropdownMenuItem
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className="dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {category}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Create New Item Button */}
                <Button
                  onClick={handleCreateNewItem}
                  className="sm:hidden gap-2 bg-white dark:bg-zinc-900 border border-blue-600/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-10 px-3"
                  title="Create New Item"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Desktop Create New Item Button */}
              <Button
                onClick={handleCreateNewItem}
                className="hidden sm:flex gap-2 bg-white dark:bg-zinc-900 border border-blue-600/50 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-10"
              >
                <Plus className="h-4 w-4" />
                Create New Item
              </Button>
            </div>
          </div>

          {/* Items Table */}
          <div className="flex-1 overflow-auto px-6 py-4 dark:bg-black">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-zinc-600 dark:text-zinc-400">Loading items...</p>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-zinc-600 dark:text-zinc-400 mb-4">No items found</p>
                  <Button
                    onClick={handleCreateNewItem}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Item
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Desktop view Table */}
                <div className="hidden md:block border dark:border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-zinc-50 dark:bg-zinc-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Item Image
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Item Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Item Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Sales Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Purchase Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Current Stock
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                          Quantity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {filteredItems.map((item) => (
                        <tr
                          key={item.item_id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="w-10 h-10 rounded overflow-hidden border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
                              {item.image ? (
                                <img
                                  src={resolveImageUrl(item.image)}
                                  onClick={() => setPreviewImage(resolveImageUrl(item.image))}
                                  alt={item.item_name}
                                  className="w-full h-full object-cover hover:scale-110 transition-transform cursor-pointer"
                                />
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-600 text-xs">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">
                              {item.item_name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                            {item.item_code || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                            ₹ {item.sales_price?.toLocaleString("en-IN") || "0"}
                          </td>
                          <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                            {item.purchase_price
                              ? `₹ ${item.purchase_price.toLocaleString("en-IN")}`
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${item.opening_stock === 0
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : item.opening_stock <= 5
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                  : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                }`}
                            >
                              {item.opening_stock} {item.type === "Service" ? "" : "PCS"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {selectedItems.has(item.item_id) ? (
                              <div className="flex items-center justify-center gap-1 bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg p-1 shadow-sm">
                                <button
                                  onClick={() => decrementQuantity(item.item_id)}
                                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                  <span className="text-zinc-600 dark:text-zinc-400 text-sm leading-none">−</span>
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={itemQuantities[item.item_id] || 1}
                                  onChange={(e) => updateItemQuantity(item.item_id, parseInt(e.target.value) || 0)}
                                  className="w-12 text-center text-sm border border-blue-300 dark:border-blue-800 rounded font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-transparent dark:text-zinc-100"
                                />
                                <button
                                  onClick={() => incrementQuantity(item.item_id)}
                                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                  <span className="text-zinc-600 dark:text-zinc-400 text-sm leading-none">+</span>
                                </button>
                                <button
                                  onClick={() => toggleItemSelection(item.item_id)}
                                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-1"
                                >
                                  <X className="h-3 w-3 text-red-500 dark:text-red-400" />
                                </button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleItemSelection(item.item_id)}
                                className="min-w-[60px] h-8 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300"
                                disabled={item.opening_stock === 0}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view Cards */}
                <div className="md:hidden space-y-3">
                  {filteredItems.map((item) => (
                    <div
                      key={item.item_id}
                      className={`p-3 rounded-xl border transition-all ${selectedItems.has(item.item_id)
                        ? "border-blue-500 bg-blue-50/30 dark:bg-blue-900/10 ring-1 ring-blue-500"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                        }`}
                    >
                      <div className="flex gap-3">
                        {/* Image */}
                        <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
                          {item.image ? (
                            <img
                              src={resolveImageUrl(item.image)}
                              onClick={() => setPreviewImage(resolveImageUrl(item.image))}
                              alt={item.item_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-zinc-300 text-xs">—</span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                              {item.item_name}
                            </h4>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${item.opening_stock === 0
                                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                : item.opening_stock <= 5
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                  : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                }`}
                            >
                              {item.opening_stock} {item.type === "Service" ? "" : "PCS"}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono mt-0.5">
                            {item.item_code || "No Code"}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <div>
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-tight">Sales Price</p>
                              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">₹{item.sales_price?.toLocaleString("en-IN")}</p>
                            </div>
                            {item.purchase_price && (
                              <div>
                                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-tight">Purchase</p>
                                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">₹{item.purchase_price.toLocaleString("en-IN")}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end items-center">
                        {selectedItems.has(item.item_id) ? (
                          <div className="flex items-center gap-2 bg-white dark:bg-black border border-blue-200 dark:border-blue-900 rounded-lg p-1 shadow-sm">
                            <button
                              onClick={() => decrementQuantity(item.item_id)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
                            >
                              <span className="text-blue-600 dark:text-blue-400 font-bold">−</span>
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={itemQuantities[item.item_id] || 1}
                              onChange={(e) => updateItemQuantity(item.item_id, parseInt(e.target.value) || 0)}
                              className="w-10 text-center text-sm font-bold focus:outline-none bg-transparent dark:text-zinc-100"
                            />
                            <button
                              onClick={() => incrementQuantity(item.item_id)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
                            >
                              <span className="text-blue-600 dark:text-blue-400 font-bold">+</span>
                            </button>
                            <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
                            <button
                              onClick={() => toggleItemSelection(item.item_id)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleItemSelection(item.item_id)}
                            className="w-full bg-blue-600 text-white hover:bg-blue-700 border-none h-10 font-bold rounded-lg"
                            disabled={item.opening_stock === 0}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Item
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Image Preview Modal */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-4xl p-1 overflow-hidden flex items-center justify-center [&>button:last-child]:hidden bg-white dark:bg-black border dark:border-zinc-800">
            <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-1 right-1 p-2 bg-zinc-300 dark:bg-zinc-800 rounded-xl hover:bg-zinc-500 dark:hover:bg-zinc-700 hover:text-white transition-colors duration-200 flex items-center justify-center"
              >
                <FiX className="size-4" />
              </button>
              <img
                src={previewImage || ""}
                alt="Preview"
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
          <div className="text-sm text-zinc-600 dark:text-zinc-400 text-center sm:text-left">
            {selectedItems.size > 0 && (
              <span className="font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50">
                {selectedItems.size} item(s) selected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none dark:bg-black dark:border-zinc-800 dark:text-zinc-300">
              Cancel
            </Button>
            <Button
              onClick={handleAddItems}
              disabled={selectedItems.size === 0}
              className="flex-1 sm:flex-none font-bold shadow-sm"
            >
              Done ({selectedItems.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdditemPage;
