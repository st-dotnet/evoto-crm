import React from "react";
import { useFormik } from "formik";

interface IPricingDetailsProps {
    formik: any;
}

export default function PricingDetails({ formik }: IPricingDetailsProps) {
    return (
        <div className="border border-gray-100 rounded-xl p-3 sm:p-5 bg-white shadow-sm space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Sales Price */}
                <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-gray-700">Sales Price</label>

                    <div className="flex items-center w-full border border-gray-200 rounded-md overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                        {/* Amount input */}
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] sm:text-sm text-gray-500">
                                ₹
                            </span>
                            <input
                                type="number"
                                placeholder="ex: 200"
                                className="w-full pl-7 pr-2 py-2 text-[13px] sm:text-sm text-gray-700 outline-none"
                                {...formik.getFieldProps("sales_price")}
                            />
                        </div>

                        {/* Divider */}
                        <div className="h-6 w-px bg-gray-200" />

                        {/* Tax type */}
                        <select
                            className="px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-medium bg-gray-50 text-gray-600 outline-none cursor-pointer hover:bg-gray-100"
                            {...formik.getFieldProps("sales_tax_type")}
                        >
                            <option value="with_tax">With Tax</option>
                            <option value="without_tax">Without Tax</option>
                        </select>
                    </div>
                </div>

                {/* Purchase Price */}
                <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-gray-700">Purchase Price</label>

                    <div className="flex items-center w-full border border-gray-200 rounded-md overflow-hidden focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                        {/* Amount input */}
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] sm:text-sm text-gray-500">
                                ₹
                            </span>
                            <input
                                type="number"
                                placeholder="ex: 200"
                                className="w-full pl-7 pr-2 py-2 text-[13px] sm:text-sm text-gray-700 outline-none"
                                {...formik.getFieldProps("purchase_price")}
                            />
                        </div>

                        {/* Divider */}
                        <div className="h-6 w-px bg-gray-200" />

                        {/* Tax type */}
                        <select
                            className="px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-medium bg-gray-50 text-gray-600 outline-none cursor-pointer hover:bg-gray-100"
                            {...formik.getFieldProps("purchase_tax_type")}
                        >
                            <option value="with_tax">With Tax</option>
                            <option value="without_tax">Without Tax</option>
                        </select>
                    </div>
                </div>

                {/* GST Tax Rate */}
                <div className="space-y-1.5">
                    <label className="text-xs sm:text-sm font-semibold text-gray-700">GST Tax Rate (%)</label>
                    <select
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] sm:text-sm text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
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
        </div>
    );
}

