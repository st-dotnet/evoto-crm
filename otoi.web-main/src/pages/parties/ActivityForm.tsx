import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import clsx from "clsx";
import { Input } from "@/components/ui/input";

interface ActivityLead {
  id: string;
  status?: string;
  address?: string;
  created_at?: string;
  activity_type?: string;
}

interface ActivityFormProps {
  open: boolean;
  onOpenChange: () => void;
  lead: ActivityLead | null;
}

const validationSchema = Yup.object({
  // status: Yup.string().required("Status is required"),
});

export function ActivityForm({ open, onOpenChange, lead }: ActivityFormProps) {
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: {
      status: lead?.status || "",  // Ensure the initial value for the dropdown
    },
    validationSchema,
    onSubmit: async (values) => {
      // Handle the form submission logic
      setLoading(true);
      // Add your form submission logic here
      console.log("Form submitted with:", values);
      setLoading(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="container-fixed max-w-[600px] p-0 [&>button]:hidden">
        <DialogHeader className="modal-header">
          <DialogTitle className="modal-title">Create Activity</DialogTitle>
        </DialogHeader>
        <div className="modal-body">
          <div className="max-w-[auto] w-full">
            <form className="flex flex-col gap-5 p-10" noValidate onSubmit={formik.handleSubmit}>

              <div className="flex flex-col gap-1">
                <label className="form-label text-gray-900">Lead Status</label>
                <label>
                  <select
                    {...formik.getFieldProps("status")}
                    className={clsx(
                      "select",
                      { "is-invalid": formik.touched.status && formik.errors.status },
                      { "is-valid": formik.touched.status && !formik.errors.status }
                    )}
                  >
                    <option value="">--Select--</option>
                    <option value="New">New</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Quote Given">Quote Given</option>
                    <option value="Win">Win</option>
                    <option value="Lose">Lose</option>
                  </select>
                </label>
                {formik.touched.status && formik.errors.status && (
                  <span role="alert" className="text-danger text-xs mt-1">
                    {formik.errors.status}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="form-label text-gray-900">Address</label>
                <label className="input">
                  <input
                    id="address"
                    // value={lead?.address || ""}
                    className="form-control bg-transparent p-2 border rounded"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-1">
                <label className="form-label text-gray-900">Activity Type</label>
                
                <label>
                  <select
                    {...formik.getFieldProps("activity_type")}
                    className={clsx(
                      "select",
                      { "is-invalid": formik.touched.status && formik.errors.status },
                      { "is-valid": formik.touched.status && !formik.errors.status }
                    )}
                  >
                    <option value="">--Select--</option>
                    <option value="Call">Call</option>
                    <option value="Email">Email</option>
                    <option value="In-Person">In-Person</option>
                  </select>
                </label>
                {formik.touched.status && formik.errors.status && (
                  <span role="alert" className="text-danger text-xs mt-1">
                    {formik.errors.status}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <hr />
                <button type="submit" className="btn btn-primary right" disabled={loading}>
                  {loading ? "Please wait..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
