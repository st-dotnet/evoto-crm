import { useFormik } from "formik";

interface IOtherDetailsProps {
  formik: any;
}

export default function OtherDetails({ formik }: IOtherDetailsProps) {
  return (
    <div className="border border-gray-100 rounded-xl p-3 sm:p-5 bg-white shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-semibold text-gray-700">SAC Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ex: 4010"
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-md text-[13px] sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              {...formik.getFieldProps("sac_code")}
            />
            <button
              type="button"
              className="px-3 py-2 text-[11px] sm:text-xs font-semibold border border-primary/20 rounded-md bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all whitespace-nowrap"
            >
              Find SAC
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-xs sm:text-sm font-semibold text-gray-700">Description</label>
          <textarea
            placeholder="Enter item description..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-[13px] sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all text-gray-700"
            rows={3}
            {...formik.getFieldProps("description")}
          />
        </div>
      </div>
    </div>
  );
}