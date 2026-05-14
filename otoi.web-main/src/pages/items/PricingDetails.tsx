import React from "react";

interface IPricingDetailsProps {
  formik: any;
}

// ─── shared input classes ────────────────────────────────────
const inputBase =
  "w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-500 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden";

const selectBase =
  "w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 appearance-none";

export default function PricingDetails({ formik }: IPricingDetailsProps) {
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Price Configuration */}
      <div className="bg-white dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700/60 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-300 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-blue-500 dark:bg-blue-400 rounded-full" />
          Price Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Sales Price */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
              Sales Price
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-400 text-sm font-medium">₹</span>
              <input
                type="number"
                min="0"
                placeholder="0.00"
                className={`pl-10 ${inputBase}`}
                {...formik.getFieldProps("sales_price")}
              />
            </div>
          </div>

          {/* Purchase Price */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
              Purchase Price
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-400 text-sm font-medium">₹</span>
              <input
                type="number"
                min="0"
                placeholder="0.00"
                className={`pl-10 ${inputBase}`}
                {...formik.getFieldProps("purchase_price")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tax Configuration */}
      <div className="bg-white dark:bg-zinc-800/60 border border-gray-300 dark:border-zinc-700/60 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-300 mb-4 flex items-center gap-2">
          <span className="w-1 h-4 bg-green-500 dark:bg-emerald-400 rounded-full" />
          Tax Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* GST Tax Rate */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
              GST Tax Rate
            </label>
            <select className={selectBase} {...formik.getFieldProps("gst_tax_rate")}>
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