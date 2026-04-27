// src/pages/items/ItemDetails.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiBox, FiDollarSign, FiInfo, FiTag } from "react-icons/fi";
import { getItemById } from "./services/items.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FiX } from "react-icons/fi";
import { resolveImageUrl } from "@/utils/imageUtils";

// Types
export interface IItem {
  item_id?: string; // Changed from number to string (UUID)
  item_name?: string;
  item_code?: string;
  item_type_id?: number;
  category_id?: string;
  sales_price?: number | string;
  purchase_price?: number | string;
  gst_tax_rate?: number | string;
  measuring_unit?: string;
  opening_stock?: number | string;
  low_stock_warning?: boolean;
  low_stock_quantity?: number;
  show_in_online_store?: boolean;
  tax_type?: string;
  hsn_code?: string;
  alternative_unit?: string;
  description?: string;
  as_of_date?: string;
  category?: {
    category_id?: string;
    category_name?: string;
  };
  item_type?: {
    item_type_id?: number;
    item_type_name?: string;
  };
  images?: { id: number; url: string; name: string }[];
}

interface ItemDetailsProps {
  item?: IItem;
}

const Info = ({ label, value }: { label: string; value?: string | number | boolean }) => (
  <div className="text-sm">
    <div className="text-gray-500">{label}</div>
    <div className="font-medium text-gray-800">{value !== undefined && value !== "" ? String(value) : "—"}</div>
  </div>
);

export default function ItemDetails({ item: initialItem }: ItemDetailsProps) {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<IItem | null>(initialItem ?? null);
  const [loading, setLoading] = useState(!initialItem);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (initialItem || !itemId) return;

    const fetchItem = async () => {
      setLoading(true);
      try {
        const res = await getItemById(itemId);

        if (res?.success && res.data) {
          const data = res.data;
          // Map API response to IItem
          const mappedItem: IItem = {
            ...data,
            category: {
              category_id: data.category_id,
              category_name: data.category,
            },
            item_type: {
              item_type_id: data.item_type_id,
              item_type_name: data.item_type,
            },
            images: data.images || []
          };
          setItem(mappedItem);
        } else {
          const msg = res?.error || "Failed to load item";
          setError(msg);
          toast.error(msg);
        }
      } catch (err: any) {
        const msg = err.message || "Failed to fetch item";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [itemId, initialItem]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-10">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!item || error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="border border-red-200 bg-red-50 text-red-700 rounded p-4">
          {error || "Item not found"}
          <Button variant="outline" className="mt-3" onClick={() => navigate(-1)}>
            <FiArrowLeft className="mr-2" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        html, body {
          overflow-x: hidden !important;
          max-width: 100vw !important;
        }
      `}</style>
      <div className="w-full max-w-[100vw] p-0 sm:p-6 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-x-hidden">
      {/* Mobile Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sm:hidden z-10 py-3 overflow-x-hidden">
        <div className="flex items-center gap-3 px-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <FiArrowLeft />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold truncate text-gray-900">{item.item_name || "Unnamed Item"}</h2>
            <div className="text-xs text-gray-500 truncate">{item.item_code || "—"}</div>
          </div>
          {item.low_stock_warning && item.item_type?.item_type_name !== "Service" && (
            <span className="px-2 py-0.5 text-[10px] bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full shrink-0 shadow-sm">Low Stock</span>
          )}
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden sm:block mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 hover:bg-gray-100 rounded-full">
          <FiArrowLeft className="mr-1" /> Back
        </Button>
        <h2 className="text-2xl font-semibold flex items-center gap-2 mb-2 text-gray-900">
          <FiTag className="text-purple-600" />
          {item.item_name || "Unnamed Item"}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{item.item_code || "—"}</span>
          {item.item_type && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
              {item.item_type.item_type_name}
            </span>
          )}
          {item.low_stock_warning && item.item_type?.item_type_name !== "Service" && (
            <span className="px-3 py-1 text-xs bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full shadow-sm">Low Stock</span>
          )}
        </div>
      </div>

      {/* Mobile & Desktop Layout - Modern Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 sm:px-0 py-4 sm:py-0 w-full max-w-full overflow-x-hidden">
        {/* Basic Info Card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-purple-100/30 hover:shadow-xl transition-all duration-300 min-w-0">
          <div className="flex items-center gap-3 mb-4 overflow-x-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
              <FiInfo className="text-white" />
            </div>
            <h4 className="text-sm font-bold text-gray-900 truncate">General Details</h4>
          </div>
          <div className="space-y-4 overflow-x-hidden">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 overflow-x-hidden">
              <span className="text-xs text-gray-500 font-medium shrink-0">Category</span>
              <span className="text-xs font-semibold text-gray-900 text-right truncate ml-2">{item.category?.category_name || "—"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 overflow-x-hidden">
              <span className="text-xs text-gray-500 font-medium shrink-0">Measuring Unit</span>
              <span className="text-xs font-semibold text-gray-900 text-right truncate ml-2">{item.measuring_unit || "—"}</span>
            </div>
            {item.item_type?.item_type_name !== "Service" && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100 overflow-x-hidden">
                <span className="text-xs text-gray-500 font-medium shrink-0">HSN Code</span>
                <span className="text-xs font-semibold text-gray-900 text-right truncate ml-2">{item.hsn_code || "—"}</span>
              </div>
            )}
            {item.item_type && (
              <div className="flex justify-between items-center py-2 overflow-x-hidden">
                <span className="text-xs text-gray-500 font-medium shrink-0">Type</span>
                <span className="text-xs font-semibold text-gray-900 text-right truncate ml-2">{item.item_type.item_type_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-green-100/30 hover:shadow-xl transition-all duration-300 min-w-0">
          <div className="flex items-center gap-3 mb-4 overflow-x-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md shrink-0">
              <FiDollarSign className="text-white" />
            </div>
            <h4 className="text-sm font-bold text-gray-900 truncate">Pricing</h4>
          </div>
          <div className="space-y-4 overflow-x-hidden">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 overflow-x-hidden">
              <span className="text-xs text-gray-500 font-medium shrink-0">Sales Price</span>
              <span className="text-xs font-bold text-green-600 text-right truncate ml-2">₹ {item.sales_price ?? "—"}</span>
            </div>
            {item.item_type?.item_type_name !== "Service" && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100 overflow-x-hidden">
                <span className="text-xs text-gray-500 font-medium shrink-0">Purchase Price</span>
                <span className="text-xs font-semibold text-gray-900 text-right truncate ml-2">₹ {item.purchase_price ?? "—"}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 overflow-x-hidden">
              <span className="text-xs text-gray-500 font-medium shrink-0">GST Rate</span>
              <span className="text-xs font-semibold text-gray-900 text-right truncate ml-2">{item.gst_tax_rate ? `${item.gst_tax_rate}%` : "—"}</span>
            </div>
          </div>
        </div>

        {/* Stock Card (only for products) */}
        {item.item_type?.item_type_name !== "Service" && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-blue-100/30 hover:shadow-xl transition-all duration-300 min-w-0">
            <div className="flex items-center gap-3 mb-4 overflow-x-hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shrink-0">
                <FiBox className="text-white" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 truncate">Stock</h4>
            </div>
            <div className="space-y-4 overflow-x-hidden">
              <div className="flex justify-between items-center py-2 border-b border-gray-100 overflow-x-hidden">
                <span className="text-xs text-gray-500 font-medium shrink-0">Opening Stock</span>
                <span className="text-xs font-semibold text-gray-900 text-right truncate ml-2">{item.opening_stock ?? "—"} {item.measuring_unit || ""}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 overflow-x-hidden">
                <span className="text-xs text-gray-500 font-medium shrink-0">Low Stock Warning</span>
                <span className={`text-xs font-semibold ${item.low_stock_warning ? 'text-red-600' : 'text-gray-900'} text-right truncate ml-2`}>
                  {item.low_stock_warning ? "Enabled" : "Disabled"}
                </span>
              </div>
              {item.low_stock_warning && (
                <div className="flex justify-between items-center py-2 overflow-x-hidden">
                  <span className="text-xs text-gray-500 font-medium shrink-0">Low Stock Qty</span>
                  <span className="text-xs font-semibold text-gray-900 text-right truncate ml-2">{item.low_stock_quantity ?? "—"} {item.measuring_unit || ""}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes Card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-orange-100/30 hover:shadow-xl transition-all duration-300 min-w-0">
          <div className="flex items-center gap-3 mb-4 overflow-x-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md shrink-0">
              <FiInfo className="text-white" />
            </div>
            <h4 className="text-sm font-bold text-gray-900 truncate">Notes</h4>
          </div>
          <div className="space-y-4 overflow-x-hidden">
            <div className="py-2 overflow-x-hidden">
              <span className="text-xs text-gray-500 font-medium block mb-1">Description</span>
              <span className="text-xs font-semibold text-gray-900 break-words">{item.description || "—"}</span>
            </div>
            {item.item_type?.item_type_name !== "Service" && (
              <div className="flex justify-between items-center py-2 border-t border-gray-100 mt-4 overflow-x-hidden">
                <span className="text-xs text-gray-500 font-medium shrink-0">Alternative Unit</span>
                <span className="text-xs font-semibold text-gray-900 text-right truncate ml-2">{item.alternative_unit || "—"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Gallery */}
      {item.images && item.images.length > 0 && (
        <div className="mt-6 bg-white border rounded-lg shadow-sm p-3 sm:p-4 overflow-x-hidden">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <FiBox /> Product Images
          </h4>
          <div className="flex flex-wrap gap-2 sm:gap-3 overflow-x-hidden">
            {item.images.map((img) => (
              <div
                key={img.id}
                onClick={() => setPreviewImage(img.url)}
                className="group relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border bg-gray-50 shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
              >
                <img
                  src={resolveImageUrl(img.url)}
                  alt={img.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                  <span className="text-white text-[10px] truncate w-full">{img.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-1 overflow-hidden flex items-center justify-center [&>button:last-child]:hidden">
          <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-1 right-1 p-2 bg-gray-300 rounded-xl hover:bg-gray-500 hover:text-white transition-colors flex items-center justify-center"
            >
              <FiX className="size-4" />
            </button>
            <img
              src={resolveImageUrl(previewImage)}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
