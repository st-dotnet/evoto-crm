import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import clsx from "clsx";
import axios from "axios";

interface ActivityLead {
  id: number;
  status?: string;
  address?: string;
  created_at?: string;
  active_type_id?: string;
}

interface ActivityType {
  id: number;
  name: string;
}

interface ActivityFormProps {
  open: boolean;
  onOpenChange: () => void;
  lead: ActivityLead | null;
}

const validationSchema = Yup.object({
  status: Yup.string().required("Status is required"),
  active_type_id: Yup.string().required("Activity Type is required"),
});

export function ActivityForm({ open, onOpenChange, lead }: ActivityFormProps) {
  const [loading, setLoading] = useState(false);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);

  // Fetch activity types from backend
  useEffect(() => {
    const fetchActivityTypes = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/active-types/`);
        setActivityTypes(response.data);
      } catch (error) {
        console.error("Error fetching activity types:", error);
      }
    };
    fetchActivityTypes();
  }, []);

  const formik = useFormik({
    initialValues: {
      status: lead?.status || "",
      active_type_id: lead?.active_type_id || "",
      address: lead?.address || "",
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoading(true);
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
          <form className="flex flex-col gap-5 p-10" noValidate onSubmit={formik.handleSubmit}>
            
            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="form-label text-gray-900">Lead Status</label>
              <select
                {...formik.getFieldProps("status")}
                className={clsx("select", {
                  "is-invalid": formik.touched.status && formik.errors.status,
                  "is-valid": formik.touched.status && !formik.errors.status,
                })}
              >
                <option value="">--Select--</option>
                <option value="New">New</option>
                <option value="In Progress">In Progress</option>
                <option value="Quote Given">Quote Given</option>
                <option value="Win">Win</option>
                <option value="Lose">Lose</option>
              </select>
              {formik.touched.status && formik.errors.status && (
                <span role="alert" className="text-danger text-xs mt-1">
                  {formik.errors.status}
                </span>
              )}
            </div>

            {/* Address */}
            <div className="flex flex-col gap-1">
              <label className="form-label text-gray-900">Address</label>
              <input
                {...formik.getFieldProps("address")}
                className="form-control bg-transparent p-2 border rounded"
              />
            </div>

            {/* Activity Type */}
            <div className="flex flex-col gap-1">
              <label className="form-label text-gray-900">Activity Type</label>
              <select
                {...formik.getFieldProps("active_type_id")}
                className={clsx("select", {
                  "is-invalid": formik.touched.active_type_id && formik.errors.active_type_id,
                  "is-valid": formik.touched.active_type_id && !formik.errors.active_type_id,
                })}
              >
                <option value="">--Select--</option>
                {activityTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {formik.touched.active_type_id && formik.errors.active_type_id && (
                <span role="alert" className="text-danger text-xs mt-1">
                  {formik.errors.active_type_id}
                </span>
              )}
            </div>

            {/* Submit */}
            <div className="flex flex-col gap-1">
              <hr />
              <button type="submit" className="btn btn-primary right" disabled={loading}>
                {loading ? "Please wait..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
