import { Fragment, useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components";
import axios from "axios";
import { DialogClose } from "@radix-ui/react-dialog";
import { Country, State, City } from "country-state-city";

// Props for the modal
interface IModalLeadProps {
  open: boolean;
  onOpenChange: () => void;
  lead: Lead | null;
}

interface Status {
  id: number;
  name: string;
}

interface Lead {
  uuid?: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gst: string;
  status?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
  reason?: string;
  addresses?: Array<{
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    country?: string;
    pin?: string;
  }>;
}

// Initial values for form
const initialValues: Lead = {
  first_name: "",
  last_name: "",
  mobile: "",
  email: "",
  gst: "",
  status: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  country: "",
  pin: "",
  reason: "",
};

// Validation Schema
const saveLeadSchema = Yup.object().shape({
  first_name: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("First Name is required"),
  last_name: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Last Name is required"),
  mobile: Yup.string()
    .test(
      "mobile-or-email",
      "Either Mobile or Email is required",
      function (value) {
        const { email } = this.parent;
        if (!value && !email) {
          return false;
        }
        return true;
      }
    )
    .test(
      "mobile-length",
      "Mobile number must be exactly 10 digits",
      (value) => !value || value.length === 10
    ),
  email: Yup.string()
    .email("Invalid email")
    .test(
      "mobile-or-email",
      "Either Mobile or Email is required",
      function (value) {
        const { mobile } = this.parent;
        if (!value && !mobile) {
          return false;
        }
        return true;
      }
    ),
  gst: Yup.string().min(15, "Minimum 15 symbols").max(15, "Maximum 15 symbols"),
  pin: Yup.string().matches(/^[0-9]+$/, "Pin must be a number"),
});

const ModalLead = ({ open, onOpenChange, lead }: IModalLeadProps) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status[]>([]);

  // Fetch status list
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/status-list/`
        );
        setStatus(response.data);
      } catch (error) {
        console.error("Error fetching status types:", error);
      }
    };
    fetchStatus();
  }, []);

  // Formik setup
  const formik = useFormik({
    initialValues,
    validationSchema: saveLeadSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      try {
        const postData = {
          first_name: values.first_name,
          last_name: values.last_name,
          mobile: values.mobile,
          email: values.email,
          gst: values.gst,
          status: values.status,
          city: values.city,
          state: values.state,
          country: values.country,
          address1: values.address1,
          address2: values.address2,
          pin: values.pin,
          reason: values.reason,
        };

        const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
        const apiBaseLeads = baseUrl.endsWith("/") ? `${baseUrl}leads` : `${baseUrl}/leads`;

        if (lead?.uuid) {
          await axios.put(`${apiBaseLeads}/${lead.uuid}`, postData);
        } else {
          await axios.post(`${apiBaseLeads}/`, postData);
        }

        onOpenChange();
        navigate("/leads", { replace: true });
      } catch (error) {
        console.error(error);
        setStatus("The lead details are incorrect");
      } finally {
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  // Reset form when editing a lead
  useEffect(() => {
    if (open && lead) {
      const address = lead.addresses?.[0] || {};
      formik.resetForm({
        values: {
          first_name: lead.first_name || "",
          last_name: lead.last_name || "",
          mobile: lead.mobile || "",
          email: lead.email || "",
          gst: lead.gst || "",
          status: lead.status || "",
          city: address.city || "",
          state: address.state || "",
          country: address.country || "",
          pin: address.pin || "",
          address1: address.address1 || "",
          address2: address.address2 || "",
          reason: lead.reason || "",
        },
      });
    }
  }, [open, lead]);

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="container-fixed max-w-[900px] p-0 rounded-lg shadow-lg">
          <DialogHeader className="bg-gray-50 p-6 border-b">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              {lead ? "Edit Lead" : "Add Lead"}
            </DialogTitle>
            <DialogClose onClick={onOpenChange} className="right-2 top-1 rounded-sm opacity-70" />
          </DialogHeader>
          <DialogBody className="p-6">
            <div className="max-w-[auto] w-full">
              <form
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
                noValidate
                onSubmit={formik.handleSubmit}
              >
                {formik.status && (
                  <Alert variant="danger" className="col-span-full mb-4">
                    {formik.status}
                  </Alert>
                )}

                {/* First Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    First Name<span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    placeholder="First name"
                    type="text"
                    autoComplete="off"
                    {...formik.getFieldProps("first_name")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.first_name && formik.errors.first_name,
                      }
                    )}
                  />
                  {formik.touched.first_name && formik.errors.first_name && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.first_name}
                    </span>
                  )}
                </div>

                {/* Last Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Last Name<span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    placeholder="Last name"
                    type="text"
                    autoComplete="off"
                    {...formik.getFieldProps("last_name")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.last_name && formik.errors.last_name,
                      }
                    )}
                  />
                  {formik.touched.last_name && formik.errors.last_name && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.last_name}
                    </span>
                  )}
                </div>

                {/* Mobile */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Mobile
                  </label>
                  <input
                    {...formik.getFieldProps("mobile")}
                    className="input"
                    type="text"
                    onInput={(e) => {
                      const input = e.target as HTMLInputElement;
                      if (input.value.length > 10) {
                        input.value = input.value.slice(0, 10);
                      }
                    }}
                  />
                  {formik.touched.mobile && formik.errors.mobile && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.mobile}
                    </span>
                  )}
                </div>
                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input {...formik.getFieldProps("email")} className="input" />
                  {formik.touched.email && formik.errors.email && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.email}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1.5 col-span">
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    {...formik.getFieldProps("status")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.status && formik.errors.status,
                      }
                    )}
                  >
                    <option value="">--Select Status--</option>
                    {status.map((s: Status) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {formik.touched.status && formik.errors.status && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.status}
                    </span>
                  )}
                </div>

                {/* Extra fields for Win/Lose status */}
                {formik.values.status === "4" && (
                  <div className="col-span-full pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                      {/* GST */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">GST</label>
                        <input
                          placeholder="GST"
                          type="text"
                          autoComplete="off"
                          {...formik.getFieldProps("gst")}
                          className={clsx(
                            "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                            { "border-red-500": formik.touched.gst && formik.errors.gst }
                          )}
                        />
                        {formik.touched.gst && formik.errors.gst && (
                          <span role="alert" className="text-xs text-red-500">
                            {formik.errors.gst}
                          </span>
                        )}
                      </div>

                      {/* Address 1 */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">Address 1</label>
                        <input
                          placeholder="Address 1"
                          type="text"
                          autoComplete="off"
                          {...formik.getFieldProps("address1")}
                          className={clsx(
                            "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                            { "border-red-500": formik.touched.address1 && formik.errors.address1 }
                          )}
                        />
                        {formik.touched.address1 && formik.errors.address1 && (
                          <span role="alert" className="text-xs text-red-500">
                            {formik.errors.address1}
                          </span>
                        )}
                      </div>

                      {/* Address 2 */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">Address 2</label>
                        <input
                          placeholder="Address 2"
                          type="text"
                          autoComplete="off"
                          {...formik.getFieldProps("address2")}
                          className={clsx(
                            "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                            { "border-red-500": formik.touched.address2 && formik.errors.address2 }
                          )}
                        />
                        {formik.touched.address2 && formik.errors.address2 && (
                          <span role="alert" className="text-xs text-red-500">
                            {formik.errors.address2}
                          </span>
                        )}
                      </div>

                      {/* Country */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">
                          Country <span className="text-red-500">*</span>
                        </label>
                        <select
                          {...formik.getFieldProps("country")}
                          onChange={(e) => {
                            formik.setFieldValue("country", e.target.value);
                            formik.setFieldValue("state", "");
                            formik.setFieldValue("city", "");
                          }}
                          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">--Select Country--</option>
                          {Country.getAllCountries().map((c) => (
                            <option key={c.isoCode} value={c.isoCode}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* State */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">
                          State <span className="text-red-500">*</span>
                        </label>
                        <select
                          {...formik.getFieldProps("state")}
                          onChange={(e) => {
                            formik.setFieldValue("state", e.target.value);
                            formik.setFieldValue("city", "");
                          }}
                          disabled={!formik.values.country}
                          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">--Select State--</option>
                          {formik.values.country &&
                            State.getStatesOfCountry(formik.values.country).map((s) => (
                              <option key={s.isoCode} value={s.isoCode}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* City */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">
                          City <span className="text-red-500">*</span>
                        </label>
                        <select
                          {...formik.getFieldProps("city")}
                          disabled={!formik.values.state}
                          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">--Select City--</option>
                          {formik.values.country &&
                            formik.values.state &&
                            City.getCitiesOfState(formik.values.country, formik.values.state).map((city) => (
                              <option key={city.name} value={city.name}>
                                {city.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Pin Code */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">Pin Code</label>
                        <input
                          placeholder="Pin Code"
                          type="text"
                          autoComplete="off"
                          {...formik.getFieldProps("pin")}
                          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                        />
                        {formik.touched.pin && formik.errors.pin && (
                          <span role="alert" className="text-xs text-red-500">
                            {formik.errors.pin}
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                )}


                {formik.values.status === "5" && (
                  <div className="flex flex-col gap-1.5 col-span-full">
                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                    <textarea
                      placeholder="Reason"
                      autoComplete="off"
                      {...formik.getFieldProps("reason")}
                      className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm min-h-[100px]"
                    />
                    {formik.touched.reason && formik.errors.reason && (
                      <span role="alert" className="text-xs text-red-500">
                        {formik.errors.reason}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer buttons */}
                <div className="flex justify-end col-span-full pt-4 gap-2">
                  <button
                    type="button"
                    onClick={onOpenChange}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-gray-100 text-gray-800 border hover:bg-gray-200 h-10 px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white btn-primary hover:bg-blue-500 h-10 px-4 py-2"
                    disabled={loading || formik.isSubmitting}
                  >
                    {loading ? "Please wait..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
};

export { ModalLead };
