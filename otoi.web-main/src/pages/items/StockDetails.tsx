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
}

export default function StockDetails({
  formik,
  isEditing = false,
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
        const response = await downloadBarcode(
          itemCode,
          itemName,
          formik.values.id,
        );

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
          throw new Error(response.error || "Failed to download barcode");
        }
      } else {
        // Use authenticated preview service
        let response;

        if (formik.values.id) {
          response = await getItemBarcode(formik.values.id);
        } else {
          response = await getBarcodePreview(itemCode, itemName);
        }

        if (response.success && response.data) {
          const blob = response.data;
          const blobUrl = URL.createObjectURL(blob);
          setBarcodeUrl(blobUrl);
          setIsBarcodeModalOpen(true);
        } else {
          throw new Error(response.error || "Failed to fetch barcode");
        }
      }
    } catch (error: any) {
      console.error("Failed to fetch barcode:", error);
      setBarcodeError(
        error.message || "Failed to load barcode. Please try again.",
      );
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
    <div className="border border-gray-100 rounded-xl p-3 sm:p-5 bg-white shadow-sm">
      {isBarcodeModalOpen && <BarcodeModal />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">

        {/* Item Code */}
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-semibold text-gray-700">
            Item Code <span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ex: DECOX50P"
              className={clsx(
                "flex-1 min-w-0 px-3 py-2 border rounded-md text-[13px] sm:text-sm outline-none transition-all",
                formik.touched.item_code && formik.errors.item_code ? "border-red-500" : "border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10"
              )}
              {...formik.getFieldProps("item_code")}
            />

            <button
              type="button"
              onClick={() => handleGetBarcode()}
              className="px-3 py-2 text-[11px] sm:text-xs font-semibold border border-primary/20 rounded-md bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all whitespace-nowrap"
            >
              Get Barcode
            </button>
          </div>
          {formik.touched.item_code && formik.errors.item_code && (
            <div className="text-red-500 text-[11px] font-medium">
              {formik.errors.item_code}
            </div>
          )}
        </div>

        {/* HSN Code */}
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-semibold text-gray-700">HSN Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ex: 4010"
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-md text-[13px] sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              {...formik.getFieldProps("hsn_code")}
            />
            <button
              type="button"
              className="px-3 py-2 text-[11px] sm:text-xs font-semibold border border-primary/20 rounded-md bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all whitespace-nowrap"
            >
              Find HSN
            </button>
          </div>
        </div>

        {/* Measuring Unit */}
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-semibold text-gray-700">Measuring Unit</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-[13px] sm:text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
              {...formik.getFieldProps("measuring_unit")}
            >
              <option value="PCS">Pieces (PCS)</option>
              <option value="KG">Kilogram (KG)</option>
              <option value="L">Liter (LTR)</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAlternativeUnit(!showAlternativeUnit)}
              className="px-3 py-2 text-[11px] font-bold text-primary hover:bg-primary/5 rounded-md transition-all whitespace-nowrap"
            >
              {showAlternativeUnit
                ? "Remove Alt Unit"
                : "+ Add Alt Unit"}
            </button>
          </div>
        </div>

        {/* Alternative Unit */}
        {showAlternativeUnit && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-gray-700">Secondary Unit</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] sm:text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                {...formik.getFieldProps("secondary_unit")}
              >
                <option value="PCS">PCS</option>
                <option value="BOX">Box</option>
                <option value="PACK">Pack</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs sm:text-sm font-semibold text-gray-700">Conversion Rate</label>
              <div className="flex group">
                <input
                  type="number"
                  placeholder="1 PCS ="
                  className="flex-1 px-3 py-2 border border-r-0 border-gray-200 rounded-l-md text-[13px] sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  {...formik.getFieldProps("conversion_rate")}
                />
                <select
                  className="w-24 px-2 py-2 border border-gray-200 rounded-r-md bg-gray-50 cursor-not-allowed appearance-none text-[13px] sm:text-sm text-gray-500"
                  {...formik.getFieldProps("conversion_unit")}
                  disabled
                >
                  <option value="PCS">PCS</option>
                  <option value="BOX">BOX</option>
                  <option value="PACK">PACK</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Opening Stock */}
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-semibold text-gray-700">Opening Stock</label>
          <div className="flex group">
            <input
              type="number"
              placeholder="ex: 100"
              className="flex-1 px-3 py-2 border border-r-0 border-gray-200 rounded-l-md text-[13px] sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              {...formik.getFieldProps("opening_stock")}
            />
            <span className="px-4 flex items-center border border-gray-200 rounded-r-md bg-gray-50 text-gray-500 text-[13px] sm:text-sm">
              {formik.values.measuring_unit || "PCS"}
            </span>
          </div>
        </div>

        {/* As of Date */}
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-semibold text-gray-700">As of Date</label>
          {isEditing ? (
            <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-[13px] sm:text-sm text-gray-600">
              {new Date(formik.values.as_of_date || new Date()).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>
          ) : (
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-gray-700"
              value={formik.values.as_of_date || new Date().toISOString().split('T')[0]}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              name="as_of_date"
            />
          )}
        </div>

        {/* Low Stock Warning */}
        <div className="space-y-3 sm:col-span-2 py-1">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="low_stock_warning"
              id="low_stock_warning"
              checked={formik.values.low_stock_warning}
              onChange={(e) =>
                formik.setFieldValue("low_stock_warning", e.target.checked)
              }
              className="h-4.5 w-4.5 rounded text-primary focus:ring-primary/20 cursor-pointer"
            />

            <label htmlFor="low_stock_warning" className="text-[13px] sm:text-sm font-medium text-gray-700 cursor-pointer">
              Enable low stock quantity warning
            </label>
          </div>

          {formik.values.low_stock_warning && (
            <div className="pt-1 space-y-4 w-full animate-in fade-in slide-in-from-left-2 duration-300">
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-semibold text-gray-700">
                  Low Stock Quantity
                </label>
                <div className="flex group items-stretch">
                  <input
                    type="number"
                    placeholder="Enter Low Stock Quantity"
                    className="flex-1 min-w-0 px-3 py-2 border border-r-0 border-gray-200 rounded-l-md text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                    {...formik.getFieldProps("low_stock_quantity")}
                  />
                  <select
                    className="px-3 py-2 border border-gray-200 rounded-r-md bg-white text-sm focus:border-primary outline-none shrink-0"
                    {...formik.getFieldProps("low_stock_measuring_unit")}
                  >
                    <option value="PCS">PCS</option>
                    <option value="KG">KG</option>
                    <option value="L">LTR</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Description - Full width */}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs sm:text-sm font-semibold text-gray-700">
            Description
          </label>
          <textarea
            placeholder="Enter item description..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            rows={3}
            {...formik.getFieldProps("description")}
          />
        </div>
      </div>
    </div>
  );
}
