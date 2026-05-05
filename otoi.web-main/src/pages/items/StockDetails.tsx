import { useState, useRef, useEffect } from "react";
import { useFormik } from "formik";
import clsx from "clsx";
import {
  getBarcodePreview,
  getItemBarcode,
  downloadBarcode,
} from "./services/items.service";

interface IStockDetailsProps {
  formik: any;
  isEditing?: boolean;
  isSubmitting?: boolean;
}

export default function StockDetails({
  formik,
  isEditing = false,
  isSubmitting = false,
}: IStockDetailsProps) {
  const [showAlternativeUnit, setShowAlternativeUnit] = useState(false);
  const [barcodeUrl, setBarcodeUrl] = useState<string | null>(null);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isLoadingBarcode, setIsLoadingBarcode] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleGetBarcode = async (download: boolean = false) => {
    const itemName = formik.values.item_name;
    let itemCode = formik.values.item_code;
    
    // Check for recently created item data if formik ID is undefined
    let itemId = formik.values.id;
    if (!itemId) {
      try {
        const lastCreatedItem = sessionStorage.getItem('lastCreatedItem');
        
        if (lastCreatedItem) {
          const parsedItem = JSON.parse(lastCreatedItem);
          itemId = parsedItem.id;
          
          // Update formik with the stored item data
          formik.setValues({
            ...formik.values,
            ...parsedItem
          });
          
          // Clear sessionStorage after use
          sessionStorage.removeItem('lastCreatedItem');
        } else {          
          // If no ID and no sessionStorage data, we need to save the item first
          if (!isEditing && itemCode && itemName && !isSubmitting) {
            setBarcodeError("Saving item to generate barcode...");
            
            try {
              // Import the createItem function
              const { createItem } = await import('./services/items.service');
              
              // Prepare item data for saving
              const itemData = {
                item_name: itemName,
                item_code: itemCode,
                item_type_id: formik.values.item_type_id,
                category_id: formik.values.category_id,
                measuring_unit_id: formik.values.measuring_unit_id,
                sales_price: Number(formik.values.sales_price) || 0,
                purchase_price: Number(formik.values.purchase_price) || 0,
                gst_tax_rate: Number(formik.values.gst_tax_rate) || 0,
                description: formik.values.description || null,
                hsn_code: formik.values.hsn_code || null,
                opening_stock: Number(formik.values.opening_stock) || 0,
                show_in_online_store: Boolean(formik.values.show_in_online_store),
                tax_type: formik.values.tax_type || "with_tax",
              };
              
              // Create FormData for multipart request
              const formData = new FormData();
              formData.append("item_data", JSON.stringify(itemData));
              
              // Save the item
              const response = await createItem(formData);
              
              if (response?.success && response.data?.item) {
                const newItemData = {
                  ...formik.values,
                  id: response.data.item.id || response.data.item.uuid,
                  ...response.data.item
                };
                
                // Update formik with the saved item data
                formik.setValues(newItemData);
                
                // Use the new item ID for barcode generation
                itemId = response.data.item.id || response.data.item.uuid;
                
                setBarcodeError(null);
              } else {
                throw new Error(response?.error || "Failed to save item");
              }
            } catch (error: any) {
              console.error('Auto-save failed:', error);
              setBarcodeError(error.message || "Failed to save item. Please save manually first.");
              setIsLoadingBarcode(false);
              setIsBarcodeModalOpen(true);
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error reading sessionStorage:', error);
      }
    }

    // Use user-defined item_code
    if (!itemCode) {
      setBarcodeError("Please enter an Item Code to generate barcode");
      return;
    }

    if (!itemCode) return;

    setIsLoadingBarcode(true);
    setBarcodeError(null);
    setImgError(false);

    try {
      if (download) {
        // Use authenticated download service
        
        if (!itemId) {
          throw new Error("Item ID is required. Please save the item first.");
        }
        
        const response = await downloadBarcode(itemId);

        if (response.success && response.data) {
          // Create download link
          const blob = response.data;
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `barcode-${itemCode}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          const errorMsg = response.error || "Failed to download barcode";
          console.error('Barcode Debug - Download failed:', errorMsg);
          throw new Error(errorMsg);
        }
      } else {
        // Use authenticated preview service
        let response;

        if (itemId) {
          try {
            response = await getItemBarcode(itemId);
          } catch (apiError) {
            console.error('Barcode Debug - getItemBarcode API error:', apiError);
            // Fallback to preview if getItemBarcode fails
            response = await getBarcodePreview(itemCode, itemName);
          }
        } else {
          // For unsaved items, use the actual item code and name instead of PREVIEW-ONLY
          response = await getBarcodePreview(itemCode, itemName);
        }
        if (response.success && response.data) {
          const blob = response.data;
          const blobUrl = URL.createObjectURL(blob);
          setBarcodeUrl(blobUrl);
          setIsBarcodeModalOpen(true);
        } else {
          setBarcodeError(response.error || "Failed to fetch barcode");
          setIsBarcodeModalOpen(true);
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch barcode:", error);
      
      let errorMessage = "Failed to load barcode. Please try again.";
      
      // Handle specific network errors
      if (error.message === "Network Error" || error.code === "ERR_NETWORK") {
        errorMessage = "Network connection failed. Please check your internet connection and try again.";
      } else if (error.response?.status === 500) {
        errorMessage = "Server error occurred. The barcode service is temporarily unavailable.";
      } else if (error.response?.status === 404) {
        errorMessage = "Barcode service not found. Please contact support.";
      }
      
      setBarcodeError(errorMessage);
      setIsBarcodeModalOpen(true);
    } finally {
      setIsLoadingBarcode(false);
    }
  };

  // For the alternative secondary unit

  useEffect(() => {
    if (formik.values.secondary_unit) {
      formik.setFieldValue("conversion_unit", formik.values.secondary_unit);
    }
  }, [formik.values.secondary_unit]);

  const BarcodeModal = () => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          modalRef.current &&
          !modalRef.current.contains(event.target as Node)
        ) {
          setIsBarcodeModalOpen(false);
          setBarcodeError(null);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, []);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div ref={modalRef} className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Barcode Preview</h3>
            <button
              onClick={() => {
                setIsBarcodeModalOpen(false);
                setBarcodeError(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="text-center">
            <div className="mb-4">
              <h4 className="font-medium text-lg">
                {formik.values.item_name || "Item Name"}
              </h4>
              <p className="text-gray-600">
                {formik.values.item_code || "Item Code"}
              </p>
            </div>

            <div className="mb-6 min-h-[200px] flex items-center justify-center bg-gray-50 rounded border border-gray-200 p-4">
              {barcodeError ? (
                <div className="text-red-500">{barcodeError}</div>
              ) : isLoadingBarcode ? (
                <div className="text-gray-500">Generating barcode...</div>
              ) : barcodeUrl ? (
                <img
                  src={barcodeUrl}
                  alt="Item Barcode"
                  className="max-w-full h-auto"
                  onError={() => {
                    console.error("Failed to load barcode image");
                    setImgError(true);
                  }}
                />
              ) : (
                <div className="text-gray-500">No barcode available</div>
              )}
              {imgError && (
                <div className="text-red-500 mt-2">
                  Failed to load barcode image. Please try downloading it.
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleGetBarcode(true)}
                disabled={isLoadingBarcode}
                className={`px-4 py-2 rounded transition-colors ${isLoadingBarcode
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
              >
                {isLoadingBarcode ? "Generating..." : "Download Barcode"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {isBarcodeModalOpen && <BarcodeModal />}
      
      {/* Item Identification */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
          Item Identification
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Item Code */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Item Code
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="e.g., DECOX50P"
                className={clsx(
                  "flex-1 min-w-0 px-4 py-2.5 border rounded-lg text-sm outline-none transition-all",
                  formik.touched.item_code && formik.errors.item_code
                    ? "border-red-500 bg-red-50"
                    : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                )}
                {...formik.getFieldProps("item_code")}
              />
              <button
                type="button"
                onClick={() => handleGetBarcode()}
                className="px-2 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap"
              >
                Get Barcode
              </button>
            </div>
            {formik.touched.item_code && formik.errors.item_code && (
              <div className="text-red-500 text-xs mt-1.5 font-medium">
                {formik.errors.item_code}
              </div>
            )}
          </div>

          {/* HSN Code */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              HSN Code
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="e.g., 4010"
                className="flex-1 min-w-0 px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                {...formik.getFieldProps("hsn_code")}
              />
              <button
                type="button"
                className="px-2 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap"
              >
                Find HSN
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Management */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-green-500 rounded-full"></span>
          Stock Management
        </h3>
        <div className="space-y-6">
          {/* Opening Stock and As of Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Opening Stock
              </label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-2.5 pr-16 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
                  {...formik.getFieldProps("opening_stock")}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium bg-gray-50 px-2 py-1 rounded border border-gray-300">
                  {formik.values.measuring_unit || "PCS"}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                As of Date
              </label>
              {isEditing ? (
                <div className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-600">
                  {new Date(formik.values.as_of_date || new Date()).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              ) : (
                <input
                  type="date"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  value={formik.values.as_of_date || new Date().toISOString().split('T')[0]}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  name="as_of_date"
                />
              )}
            </div>
          </div>

          {/* Low Stock Warning */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                name="low_stock_warning"
                id="low_stock_warning"
                checked={formik.values.low_stock_warning}
                onChange={(e) =>
                  formik.setFieldValue("low_stock_warning", e.target.checked)
                }
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />

              <label htmlFor="low_stock_warning" className="text-sm font-medium text-gray-700 cursor-pointer">
                Enable low stock quantity warning
              </label>
            </div>

            {formik.values.low_stock_warning && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Low Stock Quantity
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Enter quantity"
                        min="0"
                        className="w-full px-4 py-2.5 pr-16 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
                        {...formik.getFieldProps("low_stock_quantity")}
                      />
                      <select
                        className="absolute right-0 top-0 h-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-r-lg text-sm text-gray-500 appearance-none focus:outline-none"
                        {...formik.getFieldProps("low_stock_measuring_unit")}
                      >
                        <option value="PCS">PCS</option>
                        <option value="KG">KG</option>
                        <option value="L">LTR</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unit Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
          Unit Configuration
        </h3>
        <div className="space-y-6">
          {/* Primary Unit */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Primary Measuring Unit
            </label>
            <select
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none appearance-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              {...formik.getFieldProps("measuring_unit")}
            >
              <option value="PCS">Pieces (PCS)</option>
              <option value="KG">Kilogram (KG)</option>
              <option value="L">Liter (LTR)</option>
            </select>
          </div>

          {/* Alternative Unit Toggle */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <span className="text-sm font-medium text-gray-700">Alternative Unit</span>
            <button
              type="button"
              onClick={() => setShowAlternativeUnit(!showAlternativeUnit)}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            >
              {showAlternativeUnit ? "Remove" : "Add Alternative Unit"}
            </button>
          </div>

          {/* Alternative Unit Fields */}
          {showAlternativeUnit && (
            <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Secondary Unit
                  </label>
                  <select
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none appearance-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    {...formik.getFieldProps("secondary_unit")}
                  >
                    <option value="PCS">PCS</option>
                    <option value="BOX">Box</option>
                    <option value="PACK">Pack</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Conversion Rate
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      placeholder="1"
                      min="0"
                      className="flex-1 px-4 py-2.5 border border-r-0 border-gray-300 rounded-l-lg text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
                      {...formik.getFieldProps("conversion_rate")}
                    />
                    <select
                      className="w-24 px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-r-lg text-sm text-gray-500 appearance-none"
                      {...formik.getFieldProps("conversion_unit")}
                      disabled
                    >
                      <option value="PCS">PCS</option>
                      <option value="BOX">BOX</option>
                      <option value="PACK">PACK</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
          Additional Information
        </h3>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Description
          </label>
          <textarea
            placeholder="Enter item description..."
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
            rows={4}
            {...formik.getFieldProps("description")}
          />
        </div>
      </div>
    </div>
  );
}
