// src/pages/items/ItemDetails.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiBox, FiDollarSign, FiInfo, FiTag } from "react-icons/fi";
import { getItemById } from "./services/items.service";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    if (initialItem || !itemId) return;

    const fetchItem = async () => {
      setLoading(true);
      const res = await getItemById(itemId);

      if (res) {
        // Map API response to IItem
        const mappedItem: IItem = {
          ...res,
          category: {
            category_id: res.category_id,
            category_name: res.category,
          },
          item_type: {
            item_type_id: res.item_type_id,
            item_type_name: res.item_type,
          },
        };
        setItem(mappedItem);
      } else {
        setError(res.error || "Failed to load item");
        toast.error(res.error || "Failed to load item");
      }
      setLoading(false);
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
    </div>
  );

}
