// src/pages/items/ItemDetails.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiBox, FiDollarSign, FiInfo, FiTag, FiX } from "react-icons/fi";
import { getItemById } from "./services/items.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { resolveImageUrl } from "@/utils/imageUtils";

// Types
export interface IItem {
  item_id?: string;
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
  category?: { category_id?: string; category_name?: string };
  item_type?: { item_type_id?: number; item_type_name?: string };
  images?: { id: number; url: string; name: string }[];
}

interface ItemDetailsProps {
  item?: IItem;
}

// Reusable row inside a card
const CardRow = ({ label, value, valueClass = "" }: { label: string; value?: string | number; valueClass?: string }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-zinc-700/50 last:border-b-0 overflow-hidden">
    <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium shrink-0">{label}</span>
    <span className={`text-xs font-semibold text-right truncate ml-2 ${valueClass || "text-gray-900 dark:text-zinc-100"}`}>
      {value !== undefined && value !== "" ? String(value) : "—"}
    </span>
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
          setItem({
            ...data,
            category: { category_id: data.category_id, category_name: data.category },
            item_type: { item_type_id: data.item_type_id, item_type_name: data.item_type },
            images: data.images || [],
          });
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
      <div className="flex justify-center items-center p-10 bg-gray-50 dark:bg-zinc-950 min-h-screen">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-400" />
      </div>
    );
  }

  if (!item || error) {
    return (
      <div className="p-4 sm:p-6 bg-white dark:bg-zinc-950 min-h-screen">
        <div className="border border-red-500/30 bg-red-500/10 text-red-400 rounded-xl p-4">
          {error || "Item not found"}
          <Button variant="outline" className="mt-3 border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800" onClick={() => navigate(-1)}>
            <FiArrowLeft className="mr-2" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const isProduct = item.item_type?.item_type_name !== "Service";

  return (
    <>
      <style>{`html, body { overflow-x: hidden !important; max-width: 100vw !important; }`}</style>

      <div className="w-full max-w-[100vw] p-0 sm:p-6 min-h-screen bg-white dark:bg-zinc-950 overflow-x-hidden">

        {/* Mobile Header */}
        <div className="sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-zinc-800 sm:hidden z-10 py-3 overflow-x-hidden">
          <div className="flex items-center gap-3 px-4">
            <Button
              variant="ghost" size="sm"
              onClick={() => navigate(-1)}
              className="p-2 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
            >
              <FiArrowLeft />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold truncate text-gray-900 dark:text-zinc-100">{item.item_name || "Unnamed Item"}</h2>
              <div className="text-xs text-gray-500 dark:text-zinc-500 truncate">{item.item_code || "—"}</div>
            </div>
            {item.low_stock_warning && isProduct && (
              <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded-full shrink-0">
                Low Stock
              </span>
            )}
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:block mb-6">
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate(-1)}
            className="mb-3 text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full"
          >
            <FiArrowLeft className="mr-1" /> Back
          </Button>
          <h2 className="text-2xl font-semibold flex items-center gap-2 mb-2 text-gray-900 dark:text-zinc-100">
            <FiTag className="text-violet-400" />
            {item.item_name || "Unnamed Item"}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-zinc-500">{item.item_code || "—"}</span>
            {item.item_type && (
              <span className="px-2 py-0.5 text-xs bg-blue-500/15 text-blue-400 border border-blue-500/25 rounded-md">
                {item.item_type.item_type_name}
              </span>
            )}
            {item.low_stock_warning && isProduct && (
              <span className="px-3 py-1 text-xs bg-red-500/15 text-red-400 border border-red-500/30 rounded-full">
                Low Stock
              </span>
            )}
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 sm:px-0 py-4 sm:py-0 w-full max-w-full overflow-x-hidden">

          {/* General Details */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 hover:border-gray-300 dark:hover:border-zinc-700 transition-all duration-300 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                <FiInfo className="text-violet-400" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">General Details</h4>
            </div>
            <div className="space-y-0">
              <CardRow label="Category" value={item.category?.category_name} />
              <CardRow label="Measuring Unit" value={item.measuring_unit} />
              {isProduct && <CardRow label="HSN Code" value={item.hsn_code} />}
              {item.item_type && <CardRow label="Type" value={item.item_type.item_type_name} />}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 hover:border-gray-300 dark:hover:border-zinc-700 transition-all duration-300 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <FiDollarSign className="text-emerald-400" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">Pricing</h4>
            </div>
            <div className="space-y-0">
              <CardRow label="Sales Price" value={item.sales_price !== undefined ? `₹ ${item.sales_price}` : undefined} valueClass="text-emerald-400 font-bold" />
              {isProduct && <CardRow label="Purchase Price" value={item.purchase_price !== undefined ? `₹ ${item.purchase_price}` : undefined} />}
              <CardRow label="GST Rate" value={item.gst_tax_rate ? `${item.gst_tax_rate}%` : undefined} />
            </div>
          </div>

          {/* Stock (products only) */}
          {isProduct && (
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 hover:border-gray-300 dark:hover:border-zinc-700 transition-all duration-300 min-w-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                  <FiBox className="text-blue-400" />
                </div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">Stock</h4>
              </div>
              <div className="space-y-0">
                <CardRow
                  label="Opening Stock"
                  value={item.opening_stock !== undefined ? `${item.opening_stock} ${item.measuring_unit || ""}`.trim() : undefined}
                />
                <CardRow
                  label="Low Stock Warning"
                  value={item.low_stock_warning ? "Enabled" : "Disabled"}
                  valueClass={item.low_stock_warning ? "text-red-500 dark:text-red-400" : "text-gray-900 dark:text-zinc-100"}
                />
                {item.low_stock_warning && (
                  <CardRow
                    label="Low Stock Qty"
                    value={item.low_stock_quantity !== undefined ? `${item.low_stock_quantity} ${item.measuring_unit || ""}`.trim() : undefined}
                  />
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 hover:border-gray-300 dark:hover:border-zinc-700 transition-all duration-300 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <FiInfo className="text-amber-400" />
              </div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-zinc-100 truncate">Notes</h4>
            </div>
            <div className="space-y-0">
              <div className="py-2 border-b border-gray-200 dark:border-zinc-700/50">
                <span className="text-xs text-gray-500 dark:text-zinc-400 font-medium block mb-1">Description</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-zinc-100 break-words">{item.description || "—"}</span>
              </div>
              {isProduct && (
                <CardRow label="Alternative Unit" value={item.alternative_unit} />
              )}
            </div>
          </div>
        </div>

        {/* Image Gallery */}
        {item.images && item.images.length > 0 && (
          <div className="mt-6 mx-4 sm:mx-0 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <FiBox className="text-blue-400 text-lg" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Product Gallery</h4>
                  <p className="text-sm text-gray-500 dark:text-zinc-500">High-quality product images</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-400">{item.images.length}</div>
                <div className="text-xs text-gray-500 dark:text-zinc-500 uppercase tracking-wide">Images</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {item.images.map((img, index) => (
                <div
                  key={img.id}
                  onClick={() => setPreviewImage(img.url)}
                  className="group relative w-20 h-20 sm:w-24 sm:h-24 overflow-hidden rounded-xl bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 cursor-pointer hover:border-blue-500/50 transition-all duration-300 transform hover:scale-105"
                >
                  <img
                    src={resolveImageUrl(img.url)}
                    alt={img.name}
                    className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
                  />
                  <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-blue-500/80 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {index + 1}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end p-2">
                    <div className="w-full">
                      <p className="text-white text-xs font-medium truncate mb-0.5">{img.name}</p>
                      <p className="text-blue-300 text-[10px]">Click to view</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {item.images.length > 4 && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setPreviewImage(item.images?.[0]?.url || "")}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 text-sm font-medium rounded-xl hover:bg-blue-500/25 transition-all duration-300"
                >
                  <FiBox className="text-base" />
                  View Gallery
                </button>
              </div>
            )}
          </div>
        )}

        {/* Image Preview Modal */}
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-4xl p-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 overflow-hidden flex items-center justify-center [&>button:last-child]:hidden">
            <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-200">
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute top-2 right-2 p-2 bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 rounded-xl hover:bg-gray-200 dark:hover:bg-zinc-700 hover:text-gray-900 dark:hover:text-zinc-100 transition-colors flex items-center justify-center z-10"
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