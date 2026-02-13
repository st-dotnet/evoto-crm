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

interface InventoryItem {
  item_id: string;
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
        category: item.category || "Uncategorized",
        hsn_code: item.hsn_code || null,
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
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-xl font-semibold">Add Items</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search and Filter Section */}
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="flex gap-3 items-center">
              {/* Search Input */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search Items"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>

              {/* Category Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-w-[200px] justify-between">
                    {selectedCategory === "all"
                      ? "Select Category"
                      : selectedCategory}
                    <span className="ml-2">▼</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuItem onClick={() => setSelectedCategory("all")}>
                    All Categories
                  </DropdownMenuItem>
                  {categories.map((category) => (
                    <DropdownMenuItem
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Create New Item Button */}
              <Button
                onClick={handleCreateNewItem}
                className="gap-2 bg-white border border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="h-4 w-4" />
                Create New Item
              </Button>
            </div>
          </div>

          {/* Items Table */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading items...</p>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-gray-600 mb-4">No items found</p>
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
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Item Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Sales Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Purchase Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Current Stock
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredItems.map((item) => (
                      <tr
                        key={item.item_id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {item.item_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.item_code || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          ₹ {item.sales_price?.toLocaleString("en-IN") || "0"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.purchase_price
                            ? `₹ ${item.purchase_price.toLocaleString("en-IN")}`
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.opening_stock === 0
                                ? "bg-red-100 text-red-800"
                                : item.opening_stock <= 5
                                ? "bg-orange-100 text-orange-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {item.opening_stock} {item.type === "Service" ? "" : "PCS"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {selectedItems.has(item.item_id) ? (
                            <div className="flex items-center justify-center gap-1 bg-white border rounded-lg p-1 shadow-sm">
                              <button
                                onClick={() => decrementQuantity(item.item_id)}
                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                              >
                                <span className="text-gray-600 text-sm leading-none">−</span>
                              </button>
                              <span className="w-8 text-center text-sm font-medium">
                                {itemQuantities[item.item_id] || 1}
                              </span>
                              <button
                                onClick={() => incrementQuantity(item.item_id)}
                                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
                              >
                                <span className="text-gray-600 text-sm leading-none">+</span>
                              </button>
                              <button
                                onClick={() => toggleItemSelection(item.item_id)}
                                className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 transition-colors ml-1"
                              >
                                <X className="h-3 w-3 text-red-500" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleItemSelection(item.item_id)}
                              className="min-w-[60px] h-8"
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
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {selectedItems.size > 0 && (
              <span className="font-medium">
                {selectedItems.size} item(s) selected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddItems}
              disabled={selectedItems.size === 0}
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
