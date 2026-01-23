import { useState, useRef, useEffect } from "react";
import { useFormik } from "formik";

interface IStockDetailsProps {
  formik: any;
  isEditing?: boolean;
}

export default function StockDetails({ formik, isEditing = false }: IStockDetailsProps) {
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

    const baseUrl = import.meta.env.VITE_APP_API_URL;
    const url = !formik.values.id
      ? `${baseUrl}/barcode/preview?item_code=${encodeURIComponent(itemCode)}&item_name=${encodeURIComponent(itemName || "")}${download ? "&download=true" : ""}`
      : `${baseUrl}/items/${formik.values.id}/barcode${download ? "?download=true" : ""}`;


    setIsLoadingBarcode(true);
    setBarcodeError(null);
    setImgError(false);

    try {
      if (download) {
        // Directly trigger download
        window.open(url, "_blank");
      } else {
        // Fetch and display in modal
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch barcode");
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setBarcodeUrl(blobUrl);
        setIsBarcodeModalOpen(true);
      }
    } catch (error) {
      console.error("Failed to fetch barcode:", error);
      setBarcodeError("Failed to load barcode. Please try again.");
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
        if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
          setIsBarcodeModalOpen(false);
          setBarcodeError(null);
        }
      };



      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
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
              <h4 className="font-medium text-lg">{formik.values.item_name || 'Item Name'}</h4>
              <p className="text-gray-600">{formik.values.item_code || 'Item Code'}</p>
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
                    console.error('Failed to load barcode image');
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
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
              >
                {isLoadingBarcode ? 'Generating...' : 'Download Barcode'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="border rounded-lg p-4">
      {isBarcodeModalOpen && <BarcodeModal />}
      <div className="grid grid-cols-1 gap-4">

        {/* Item Code */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Item Code <span className="text-red-500">*</span></label>
          {barcodeError && <div className="text-red-500 text-sm">{barcodeError}</div>}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ex: DECOX50P"
              className={`flex-1 min-w-0 p-2 border rounded ${formik.touched.item_code && formik.errors.item_code ? "border-red-500" : ""}`}
              {...formik.getFieldProps("item_code")}
            />

            <button
              type="button"
              onClick={() => handleGetBarcode()}
              className="px-3 text-sm border rounded bg-blue-50 text-blue-600 hover:bg-blue-100 whitespace-nowrap"
            >
              Get Barcode
            </button>
          </div>
          {formik.touched.item_code && formik.errors.item_code && (
            <div className="text-red-500 text-xs">{formik.errors.item_code}</div>
          )}
        </div>

        {/* HSN Code */}
        <div className="space-y-1">
          <label className="text-sm font-medium">HSN Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ex: 4010"
              className="flex-1 min-w-0 p-2 border rounded"
              {...formik.getFieldProps("hsn_code")}
            />
            <button
              type="button"
              className="px-3 text-sm border rounded bg-blue-50 text-blue-600 hover:bg-blue-100 whitespace-nowrap"
            >
              Find HSN code
            </button>
          </div>
        </div>

        {/* Measuring Unit */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Measuring Unit</label>
          <div className="flex gap-2">
            <select
              className="flex-1 p-2 border rounded"
              {...formik.getFieldProps("measuring_unit")}
            >
              <option value="PCS">Pieces (PCS)</option>
              <option value="KG">Kilogram (KG)</option>
              <option value="L">Liter (LTR)</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAlternativeUnit(!showAlternativeUnit)}
              className="px-3 border rounded text-blue-600 hover:bg-gray-50 whitespace-nowrap"
            >
              {showAlternativeUnit ? "- Remove Alternative Unit" : "+ Add Alternative Unit"}
            </button>
          </div>
        </div>

        {/* Alternative Unit */}
        {showAlternativeUnit && (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">Secondary Unit</label>
              <select
                className="w-full p-2 border rounded"
                {...formik.getFieldProps("secondary_unit")}
              >
                <option value="PCS">PCS</option>
                <option value="BOX">Box</option>
                <option value="PACK">Pack</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Conversion Rate</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="1 PCS ="
                  className="flex-1 min-w-0 p-2 border rounded"
                  {...formik.getFieldProps("conversion_rate")}
                />
                <select
                  className="w-24 p-2 border rounded bg-gray-100 cursor-not-allowed appearance-none"
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
        <div className="space-y-1">
          <label className="text-sm font-medium">Opening Stock</label>
          <div className="flex">
            <input
              type="number"
              placeholder="ex: 100"
              className="flex-1 min-w-0 p-2 border rounded-l"
              {...formik.getFieldProps("opening_stock")}
            />
            <span className="px-3 flex items-center border border-l-0 rounded-r bg-gray-50 text-sm">
              {formik.values.measuring_unit || "PCS"}
            </span>
          </div>
        </div>

        {/* As of Date - Auto-set to current date */}
        <div className="space-y-1">
          <label className="text-sm font-medium">As of Date</label>
          {isEditing ? (
            <div className="w-full p-2 border rounded bg-gray-50">
              {new Date(formik.values.as_of_date || new Date()).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </div>
          ) : (
            <input
              type="date"
              className="w-full p-2 border rounded"
              value={formik.values.as_of_date || new Date().toISOString().split('T')[0]}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              name="as_of_date"
            />
          )}
        </div>

        {/* Low Stock Warning */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="low_stock_warning"
              checked={formik.values.low_stock_warning}
              onChange={(e) =>
                formik.setFieldValue("low_stock_warning", e.target.checked)
              }
              className="h-4 w-4"
            />

            <label htmlFor="low_stock_warning" className="text-sm">
              Enable low stock quantity warning
            </label>
          </div>

          {formik.values.low_stock_warning && (
            <div className="ml-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Low Stock Quantity</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Enter Low Stock Quantity"
                    className="flex-1 p-2 border rounded-l text-sm"
                    {...formik.getFieldProps("low_stock_quantity")}
                  />
                  <select
                    className="p-2 border rounded-r bg-white text-sm"
                    {...formik.getFieldProps("low_stock_measuring_unit")}
                  >
                    <option value="PCS">Pieces (PCS)</option>
                    <option value="KG">Kilogram</option>
                    <option value="L">Liter</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Description Box */}
        <div className="space-y-1">
          <label className="text-sm block">
            Description
          </label>
          <textarea
            placeholder="Enter Description"
            className="w-full p-2 border rounded text-sm"
            rows={3}
            {...formik.getFieldProps("description")}
          />
        </div>

      </div>
    </div>
  );
}
