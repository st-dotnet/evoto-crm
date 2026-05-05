import { useFormik } from "formik";

interface IOtherDetailsProps {
  formik: any;
}

export default function OtherDetails({ formik }: IOtherDetailsProps) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-1.5">
          <label className="text-xs sm:text-sm font-semibold text-gray-700">SAC Code</label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="ex: 4010"
              className="flex-1 min-w-0 px-4 py-2.5 bg-[#f8fafc] border border-gray-200 rounded-xl text-[14px] outline-none focus:border-gray-400 transition-all"
              {...formik.getFieldProps("sac_code")}
            />
            <button
              type="button"
              className="px-4 py-2.5 text-[13px] font-semibold border border-gray-200 rounded-xl bg-white text-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap"
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
            className="w-full px-4 py-2.5 bg-[#f8fafc] border border-gray-200 rounded-xl text-[14px] outline-none focus:border-gray-400 transition-all text-gray-700"
            rows={3}
            {...formik.getFieldProps("description")}
          />
        </div>
      </div>
    </div>
  );
}