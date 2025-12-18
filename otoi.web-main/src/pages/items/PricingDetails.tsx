import React from "react";
import { useFormik } from "formik";

interface IPricingDetailsProps {
    formik: ReturnType<typeof useFormik>;
}

export default function PricingDetails({ formik }: IPricingDetailsProps) {
    return (
        <div className="border rounded-lg p-4 space-y-4">
            {/* Sales Price */}
            <div className="space-y-1">
                <label className="text-sm font-medium">Sales Price</label>

                <div className="flex items-center max-w-sm border rounded-md overflow-hidden">
                    {/* Amount input */}
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                            ₹
                        </span>
                        <input
                            type="number"
                            placeholder="ex: 200"
                            className="w-full pl-7 pr-2 py-2 text-sm focus:outline-none"
                            {...formik.getFieldProps("sales_price")}
                        />
                    </div>

                    {/* Divider */}
                    <div className="h-6 w-px bg-gray-300" />

                    {/* Tax type */}
                    <select
                        className="px-3 py-2 text-sm bg-gray-100 focus:outline-none"
                        {...formik.getFieldProps("sales_tax_type")}
                    >
                        <option value="with_tax">With Tax</option>
                        <option value="without_tax">Without Tax</option>
                    </select>

                </div>
            </div>

            {/* Purchase Price */}
            <div className="space-y-1">
                <label className="text-sm font-medium">Purchase Price</label>

                <div className="flex items-center max-w-sm border rounded-md overflow-hidden">
                    {/* Amount input */}
                    <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                            ₹
                        </span>
                        <input
                            type="number"
                            placeholder="ex: 200"
                            className="w-full pl-7 pr-2 py-2 text-sm focus:outline-none"
                            {...formik.getFieldProps("purchase_price")}
                        />
                    </div>

                    {/* Divider */}
                    <div className="h-6 w-px bg-gray-300" />

                    {/* Tax type */}
                    <select
                        className="px-3 py-2 text-sm bg-gray-50 focus:outline-none rounded"
                        {...formik.getFieldProps("purchase_tax_type")}
                    >
                        <option value="with_tax">With Tax</option>
                        <option value="without_tax">Without Tax</option>
                    </select>

                </div>
            </div>

            {/* GST Tax Rate */}
            <div className="space-y-1" style={{display:'inline-block'}} >
                <label className="text-sm font-medium">GST Tax Rate (%)</label>
                <select
                    className="w-full max-w-sm px-3 py-2 text-sm border rounded-md focus:outline-none"
                    {...formik.getFieldProps("gst_tax_rate")}
                >
                    <option value="">None</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                </select>
            </div>
        </div>
    );
}

