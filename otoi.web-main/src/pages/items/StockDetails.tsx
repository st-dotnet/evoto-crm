import { useState, useRef, useEffect } from "react";
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

// ─── shared input classes ────────────────────────────────────────────
const inputBase =
  "w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-500 border";
const inputNormal = `${inputBase} border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20`;
const inputError  = `${inputBase} border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-500/60`;
const selectBase  =
  "w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 appearance-none";

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleGetBarcode = async (download: boolean = false) => {
    const itemName = formik.values.item_name;
    const itemCode = formik.values.item_code;
    const itemId   = formik.values.id;

    if (!itemCode) {
      setBarcodeError("Please enter an Item Code to generate barcode");
      return;
    }

    setIsLoadingBarcode(true);
    setBarcodeError(null);
    setImgError(false);

    try {
      if (download) {
        const response = itemId
          ? await downloadBarcode(itemId)
          : await getBarcodePreview(itemCode, itemName);

        if (response.success && response.data) {
          const url  = URL.createObjectURL(response.data);
          const link = document.createElement("a");
          link.href     = url;
          link.download = `barcode-${itemCode}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else {
          throw new Error(response.error || "Failed to download barcode");
        }
      } else {
        let response;
        if (itemId) {
          try { response = await getItemBarcode(itemId); }
          catch { response = await getBarcodePreview(itemCode, itemName); }
        } else {
          response = await getBarcodePreview(itemCode, itemName);
        }

        if (response.success && response.data) {
          setBarcodeUrl(URL.createObjectURL(response.data));
          setIsBarcodeModalOpen(true);
        } else {
          setBarcodeError(response.error || "Failed to fetch barcode");
          setIsBarcodeModalOpen(true);
        }
      }
    } catch (error: any) {
      let msg = "Failed to load barcode. Please try again.";
      if (error.message === "Network Error" || error.code === "ERR_NETWORK")
        msg = "Network connection failed. Please check your internet connection.";
      else if (error.response?.status === 500)
        msg = "Server error. The barcode service is temporarily unavailable.";
      else if (error.response?.status === 404)
        msg = "Barcode service not found. Please contact support.";
      setBarcodeError(msg);
      setIsBarcodeModalOpen(true);
    } finally {
      setIsLoadingBarcode(false);
    }
  };

  useEffect(() => {
    if (formik.values.secondary_unit)
      formik.setFieldValue("conversion_unit", formik.values.secondary_unit);
  }, [formik.values.secondary_unit]);

  // ── Barcode Modal ──────────────────────────────────────────────────────────
  const BarcodeModal = () => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          setIsBarcodeModalOpen(false);
          setBarcodeError(null);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div ref={modalRef} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
          {/* Modal header */}
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-semibold text-zinc-100">Barcode Preview</h3>
            <button
              onClick={() => { setIsBarcodeModalOpen(false); setBarcodeError(null); }}
              className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div className="text-center">
            <div className="mb-4">
              <h4 className="font-semibold text-zinc-100 text-base">
                {formik.values.item_name || "Item Name"}
              </h4>
              <p className="text-zinc-400 text-sm mt-0.5">
                {formik.values.item_code || "Item Code"}
              </p>
            </div>

            {/* Barcode display area */}
            <div className="mb-6 min-h-[200px] flex items-center justify-center bg-zinc-800 border border-zinc-700 rounded-xl p-4">
              {barcodeError ? (
                <div className="text-red-400 text-sm">{barcodeError}</div>
              ) : isLoadingBarcode ? (
                <div className="text-zinc-400 text-sm">Generating barcode…</div>
              ) : barcodeUrl ? (
                <img
                  src={barcodeUrl}
                  alt="Item Barcode"
                  className="max-w-full h-auto rounded"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="text-zinc-500 text-sm">No barcode available</div>
              )}
              {imgError && (
                <div className="text-red-400 text-sm mt-2">
                  Failed to load barcode image. Please try downloading it.
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => handleGetBarcode(true)}
                disabled={isLoadingBarcode}
                className={clsx(
                  "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                  isLoadingBarcode
                    ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white",
                )}
              >
                {isLoadingBarcode ? "Generating…" : "Download Barcode"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Section card wrapper ───────────────────────────────────────────────────
  const Card = ({ accent, title, children }: { accent: string; title: string; children: React.ReactNode }) => (
    <div className="bg-white dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700/60 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-300 mb-4 flex items-center gap-2">
        <span className={`w-1 h-4 rounded-full ${accent}`} />
        {title}
      </h3>
      {children}
    </div>
  );

  return (
    <div ref={scrollContainerRef} className="space-y-5 animate-in fade-in duration-500">
      {isBarcodeModalOpen && <BarcodeModal />}

      {/* Item Identification */}
      <Card accent="bg-blue-400" title="Item Identification">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Item Code */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
              Item Code <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., DECOX50P"
                className={clsx(
                  "flex-1 min-w-0 px-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-500 border",
                  formik.touched.item_code && formik.errors.item_code
                    ? "border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-500/60"
                    : "border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20",
                )}
                {...formik.getFieldProps("item_code")}
              />
              <button
                type="button"
                onClick={() => handleGetBarcode()}
                className="px-3 py-2 text-xs font-medium bg-gray-50 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-600 hover:text-gray-700 dark:hover:text-white rounded-lg transition-all whitespace-nowrap"
              >
                Get Barcode
              </button>
            </div>
            {formik.touched.item_code && formik.errors.item_code && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{formik.errors.item_code}</p>
            )}
          </div>

          {/* HSN Code */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">HSN Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., 4010"
                className={selectBase}
                {...formik.getFieldProps("hsn_code")}
              />
              <button
                type="button"
                className="px-3 py-2 text-xs font-medium bg-gray-50 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-600 hover:text-gray-700 dark:hover:text-white rounded-lg transition-all whitespace-nowrap"
              >
                Find HSN
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Stock Management */}
      <Card accent="bg-emerald-400" title="Stock Management">
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Opening Stock */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Opening Stock</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  className={`pr-16 ${inputNormal} [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden`}
                  {...formik.getFieldProps("opening_stock")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-400 text-xs font-medium bg-gray-50 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 px-1.5 py-0.5 rounded">
                  {formik.values.measuring_unit || "PCS"}
                </span>
              </div>
            </div>

            {/* As of Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">As of Date</label>
              {isEditing ? (
                <div className="w-full px-4 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg bg-gray-50 dark:bg-zinc-800/80 text-sm text-gray-500 dark:text-zinc-400">
                  {new Date(formik.values.as_of_date || new Date()).toLocaleDateString("en-US", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </div>
              ) : (
                <input
                  type="date"
                  className={inputNormal + " [color-scheme:dark]"}
                  value={formik.values.as_of_date || new Date().toISOString().split("T")[0]}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  name="as_of_date"
                />
              )}
            </div>
          </div>

          {/* Low Stock Warning */}
          <div className="border-t border-gray-200 dark:border-zinc-700 pt-5">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="low_stock_warning"
                name="low_stock_warning"
                checked={formik.values.low_stock_warning}
                onChange={(e) => formik.setFieldValue("low_stock_warning", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-500 focus:ring-blue-500/30 cursor-pointer accent-blue-600 dark:accent-blue-500"
              />
              <label htmlFor="low_stock_warning" className="text-sm font-medium text-gray-700 dark:text-zinc-300 cursor-pointer">
                Enable low stock quantity warning
              </label>
            </div>

            {formik.values.low_stock_warning && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Low Stock Quantity</label>
                    <div className="relative flex">
                      <input
                        type="number"
                        placeholder="Enter quantity"
                        min="0"
                        className={clsx(
                          "flex-1 min-w-0 px-4 py-2.5 rounded-l-lg text-sm outline-none transition-all bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-500 border border-r-0 border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20",
                          "[appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden",
                        )}
                        {...formik.getFieldProps("low_stock_quantity")}
                      />
                      <select
                        className="px-3 py-2.5 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 rounded-r-lg text-sm text-gray-700 dark:text-zinc-300 appearance-none focus:outline-none"
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
      </Card>

      {/* Unit Configuration */}
      <Card accent="bg-violet-400" title="Unit Configuration">
        <div className="space-y-5">
          {/* Primary Unit */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Primary Measuring Unit</label>
            <select className={selectBase} {...formik.getFieldProps("measuring_unit")}>
              <option value="PCS">Pieces (PCS)</option>
              <option value="KG">Kilogram (KG)</option>
              <option value="L">Liter (LTR)</option>
            </select>
          </div>

          {/* Alternative Unit toggle */}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-zinc-700 pt-4">
            <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">Alternative Unit</span>
            <button
              type="button"
              onClick={() => {
                const container = scrollContainerRef.current?.closest('.overflow-y-auto') as HTMLElement;
                const scrollPosition = container?.scrollTop || window.pageYOffset;
                
                setShowAlternativeUnit(!showAlternativeUnit);
                
                // Restore scroll position after state update
                setTimeout(() => {
                  if (container) {
                    container.scrollTop = scrollPosition;
                  } else {
                    window.scrollTo(0, scrollPosition);
                  }
                }, 0);
              }}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-blue-300 dark:border-blue-500/20 rounded-lg transition-all"
            >
              {showAlternativeUnit ? "Remove" : "Add Alternative Unit"}
            </button>
          </div>

          {/* Alternative Unit fields */}
          {showAlternativeUnit && (
            <div className="animate-in fade-in duration-500 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Secondary Unit</label>
                  <select 
                    className={selectBase} 
                    {...formik.getFieldProps("secondary_unit")}
                    onChange={(e) => {
                      const container = scrollContainerRef.current?.closest('.overflow-y-auto') as HTMLElement;
                      const scrollPosition = container?.scrollTop || window.pageYOffset;
                      
                      formik.setFieldValue("secondary_unit", e.target.value);
                      
                      // Restore scroll position after state update
                      setTimeout(() => {
                        if (container) {
                          container.scrollTop = scrollPosition;
                        } else {
                          window.scrollTo(0, scrollPosition);
                        }
                      }, 0);
                    }}
                  >
                    <option value="PCS">PCS</option>
                    <option value="BOX">Box</option>
                    <option value="PACK">Pack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Conversion Rate</label>
                  <div className="flex w-full">
                    <input
                      type="number"
                      placeholder="1"
                      min="0"
                      className={clsx(
                        "flex-1 min-w-0 px-4 py-2.5 rounded-l-lg text-sm outline-none transition-all",
                        "bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-500 border border-r-0 border-gray-300 dark:border-zinc-700",
                        "focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20",
                        "[appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden",
                      )}
                      {...formik.getFieldProps("conversion_rate")}
                    />
                    <select
                      className="w-20 px-3 py-2.5 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 rounded-r-lg text-sm text-gray-700 dark:text-zinc-400 appearance-none focus:outline-none"
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
      </Card>

      {/* Additional Information */}
      <Card accent="bg-amber-400" title="Additional Information">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Description</label>
          <textarea
            placeholder="Enter item description…"
            className={inputNormal + " resize-none"}
            rows={4}
            {...formik.getFieldProps("description")}
          />
        </div>
      </Card>
    </div>
  );
}