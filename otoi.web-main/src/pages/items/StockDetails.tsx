import { useState } from "react";
import { useFormik } from "formik";

interface IStockDetailsProps {
  formik: ReturnType<typeof useFormik>;
}

export default function StockDetails({ formik }: IStockDetailsProps) {
  const [showAlternativeUnit, setShowAlternativeUnit] = useState(false);

  return (
    <div className="border rounded-lg p-4">
      <div className="grid grid-cols-1 gap-4">

        {/* Item Code */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Item Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ex: ITM12549"
              className="flex-1 min-w-0 p-2 border rounded"
              {...formik.getFieldProps("item_code")}
            />
            <button
              type="button"
              className="px-3 text-sm border rounded bg-blue-50 text-blue-600 hover:bg-blue-100 whitespace-nowrap"
            >
              Get Barcode
            </button>
          </div>
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
              Find
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
              <option value="KG">Kilogram</option>
              <option value="L">Liter</option>
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
                <option value="">Select Unit</option>
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
                  className="w-24 p-2 border rounded"
                  {...formik.getFieldProps("conversion_unit")}
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

        {/* As of Date */}
        <div className="space-y-1">
          <label className="text-sm font-medium">As of Date</label>
          <input
            type="date"
            className="w-full p-2 border rounded"
            {...formik.getFieldProps("as_of_date")}
          />
        </div>

        {/* Low Stock Warning */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="low_stock_warning"
              checked={formik.values.low_stock_warning}
              onChange={formik.handleChange}
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
        <div className="ml-6 space-y-1">
          <label htmlFor="description" className="text-sm block">
            Description
          </label>
          <textarea
            id="description"
            placeholder="Enter Description"
            className="w-full p-2 border rounded text-sm"
            {...formik.getFieldProps("description")}
          />
        </div>


      </div>
    </div>
  );
}
