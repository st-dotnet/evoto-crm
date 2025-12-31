import { useFormik } from "formik";

interface IOtherDetailsProps {
  formik: any;
}

export default function OtherDetails({ formik }: IOtherDetailsProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">SAC Code</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ex: 4010"
              className="flex-1 min-w-0 p-2 border rounded"
              {...formik.getFieldProps("sac_code")}
            />
            <button
              type="button"
              className="px-3 text-sm border rounded bg-blue-50 text-blue-600 hover:bg-blue-100 whitespace-nowrap"
            >
              Find SAC Code
            </button>
          </div>
        </div>
       
        {/* Description */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Description</label>
          <textarea
            placeholder="Enter item description"
            className="w-full p-2 border rounded-md"
            rows={3}
            {...formik.getFieldProps("description")}
          />
        </div>
      </div>
    </div>
  );
}