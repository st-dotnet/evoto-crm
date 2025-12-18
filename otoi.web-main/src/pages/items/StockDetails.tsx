import { useFormik } from "formik";
import clsx from "clsx";

interface IStockDetailsProps {
    formik: ReturnType<typeof useFormik>;
}

export default function StockDetails({ formik }: IStockDetailsProps) {
    return (
        <div className="border p-4 rounded-lg mb-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Item Code</label>
                    <div className="input-outer-container mbb-padding-0">
                        <input
                            type="text"
                            placeholder="ex: ITM12549"
                            className="flex-1 p-2 border rounded"
                            {...formik.getFieldProps("item_code")}
                        />
                        <button
                            type="button"
                            className="mbb-flex bg-blue-50 generate-barcode-view text-blue-600"
                        >
                            Generate Barcode
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 ">HSN Code</label>
                    <div className="input form-child ng-touched ng-pristine ng-valid">
                        <input
                            type="text"
                            placeholder="ex: 4010"
                            className="w-full p-2 border rounded"
                            {...formik.getFieldProps("hsn_code")}
                        />
                    </div>
                        <button
                            type="button"
                            className="px-2 py-1 text-sm bg-blue-50 text-blue-600 rounded border"
                        >
                            Find HSN Code
                        </button>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Measuring Unit</label>
                    <select
                        className="w-full p-2 border rounded"
                        {...formik.getFieldProps("measuring_unit")}
                    >
                        <option value="PCS">Pieces (PCS)</option>
                        <option value="KG">Kilogram</option>
                        <option value="L">Liter</option>
                    </select>
                </div>
                <div>
                    <button
                        type="button"
                        className="form-child mbb-flex input mbb-gap-4"
                    >
                        + Alternative Unit
                    </button>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Opening Stock</label>
                    <div className="input form-child ng-touched ng-pristine ng-valid">
                        <input
                            type="number"
                            placeholder="ex: 150 PCS"
                            className="flex-1 p-2 border rounded-l"
                            {...formik.getFieldProps("opening_stock")}
                        />
                        <span className="p-2 border rounded-r bg-gray-100">
                            {formik.values.measuring_unit}
                        </span>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">As of Date</label>
                    <input
                        type="date"
                        className="w-full p-2 border rounded"
                        {...formik.getFieldProps("as_of_date")}
                    />
                </div>
                <div className="flex items-center gap-2 col-span-2">
                    <input
                        type="checkbox"
                        {...formik.getFieldProps("low_stock_warning")}
                    />
                    <label className="text-sm font-medium">
                        Enable Low stock quantity warning
                    </label>
                </div>
                {formik.values.low_stock_warning && (
                    <div>
                        <label className="block text-sm font-medium mb-1">
                            Low Stock Quantity
                        </label>
                        <input
                            type="number"
                            placeholder="ex: 10"
                            className="w-full p-2 border rounded"
                            {...formik.getFieldProps("low_stock_quantity")}
                        />
                    </div>
                )}
                <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                        placeholder="Enter Description"
                        className="w-full p-2 border rounded"
                        {...formik.getFieldProps("description")}
                    />
                </div>
            </div>
        </div>
    );
}
