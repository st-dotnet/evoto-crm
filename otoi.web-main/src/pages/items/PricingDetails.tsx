import React from "react";
import { useFormik } from "formik";

interface IPricingDetailsProps {
    formik: any;
}

export default function PricingDetails({ formik }: IPricingDetailsProps) {
    return (
        <div className="space-y-8">
            {/* Price Configuration */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                    Price Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sales Price */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Sales Price
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
                                ₹
                            </span>
                            <input
                                type="number"
                                placeholder="0.00"
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
                                {...formik.getFieldProps("sales_price")}
                            />
                        </div>
                    </div>

                    {/* Purchase Price */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Purchase Price
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
                                ₹
                            </span>
                            <input
                                type="number"
                                placeholder="0.00"
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
                                {...formik.getFieldProps("purchase_price")}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tax Configuration */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                    Tax Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* GST Tax Rate */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            GST Tax Rate
                        </label>
                        <select
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700 outline-none appearance-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
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
        </div>
    );
}

