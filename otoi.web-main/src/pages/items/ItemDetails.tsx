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
      <div className="p-6">
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
    <div className="p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-1">
            <FiArrowLeft className="mr-1" /> Back
          </Button>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <FiTag className="text-purple-600" />
            {item.item_name || "Unnamed Item"}
          </h2>
          <div className="text-sm text-gray-500">
            {item.item_code || "—"}
            {item.item_type && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                {item.item_type.item_type_name}
              </span>
            )}
          </div>
        </div>

        {item.low_stock_warning && item.item_type?.item_type_name !== "Service" && (
          <span className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full">Low Stock</span>
        )}
      </div>

      <div className={`bg-white border rounded-lg shadow-sm p-6 grid grid-cols-1 ${item.item_type?.item_type_name === "Service" ? "md:grid-cols-3" : "md:grid-cols-4"} gap-6`}>
        {/* Column 1 - Basic */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FiInfo /> General Details
          </h4>
          <Info label="Category" value={item.category?.category_name} />
          <Info label="Measuring Unit" value={item.measuring_unit} />
          {item.item_type?.item_type_name !== "Service" && (
            <Info label="HSN Code" value={item.hsn_code} />
          )}
          {/* {item.item_type?.item_type_name !== "Service" && (
            <Info label="Online Store" value={item.show_in_online_store ? "Yes" : "No"} />
          )} */}
        </div>

        {/* Column 2 - Pricing */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FiDollarSign /> Pricing
          </h4>
          <Info label="Sales Price" value={`₹ ${item.sales_price ?? "—"}`} />
          {/* {item.item_type?.item_type_name === "Service" && (
            <Info label="SAC Code" value={item.hsn_code} />
          )} */}
          {item.item_type?.item_type_name !== "Service" && (
            <Info label="Purchase Price" value={`₹ ${item.purchase_price ?? "—"}`} />
          )}
          <Info label="GST Rate" value={item.gst_tax_rate ? `${item.gst_tax_rate}%` : "—"} />
        </div>

        {/* Column 3 - Stock (only for products) */}
        {item.item_type?.item_type_name !== "Service" && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FiBox /> Stock
            </h4>
            <Info label="Opening Stock" value={`${item.opening_stock ?? "—"} ${item.measuring_unit || ""}`} />
            <Info label="Low Stock Warning" value={item.low_stock_warning ? "Enabled" : "Disabled"} />
            {item.low_stock_warning && (
              <Info label="Low Stock Qty" value={`${item.low_stock_quantity ?? "—"} ${item.measuring_unit || ""}`} />
            )}
            {/* <Info label="As of Date" value={item.as_of_date} /> */}
          </div>
        )}

        {/* Column 4 - Description */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FiInfo /> Notes
          </h4>
          <Info label="Description" value={item.description} />
          {item.item_type?.item_type_name !== "Service" && (
            <Info label="Alternative Unit" value={item.alternative_unit} />
          )}
        </div>
      </div>

      {/* Image Gallery */}
      {item.images && item.images.length > 0 && (
        <div className="mt-6 bg-white border rounded-lg shadow-sm p-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <FiBox /> Product Images
          </h4>
          <div className="flex flex-wrap gap-3">
            {item.images.map((img) => (
              <div
                key={img.id}
                onClick={() => setPreviewImage(img.url)}
                className="group relative w-24 h-24 rounded-lg overflow-hidden border bg-gray-50 shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
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
  );
}
