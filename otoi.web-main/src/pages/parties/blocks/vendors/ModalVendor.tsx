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
import { toast } from "sonner";

interface IModalVendorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: VendorForm | null;
}

interface Status {
  id: number;
  name: string;
}

interface VendorForm {
  uuid?: string;
  vendor_name: string;
  company_name: string;
  mobile: string;
  email: string;
  gst: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
}

const initialValues: VendorForm = {
  vendor_name: "",
  company_name: "",
  mobile: "",
  email: "",
  gst: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  country: "",
  pin: "",
};

const saveVendorSchema = Yup.object().shape({
  vendor_name: Yup.string()
    .min(2, "Minimum 2 symbols")
    .max(100, "Maximum 100 symbols"),
  // .required("Vendor Name is required"),
  company_name: Yup.string()
    .min(2, "Minimum 2 symbols")
    .max(200, "Maximum 200 symbols")
    .required("Company Name is required"),
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
  gst: Yup.string()
    .min(15, "Minimum 15 symbols")
    .max(15, "Maximum 15 symbols")
    .required("GST is required"),
  country: Yup.string().required("Country is required"),
  state: Yup.string().required("State is required"),
  city: Yup.string().required("City is required"),
  pin: Yup.string()
    .matches(/^[0-9]+$/, "Pin must be a number")
    .min(6, "Minimum 6 numbers")
    .max(6, "Minimum 6 numbers")
    .required("Pin Code is required"),
  address1: Yup.string().required("Address1 is required"), 
  address2: Yup.string()
});

const ModalVendor = ({ open, onOpenChange, vendor }: IModalVendorProps) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [status] = useState<Status[]>([]);

  const formik = useFormik({
    initialValues,
    validationSchema: saveVendorSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      try {
        const postData = { ...values };
        const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
        const apiBaseVendors = baseUrl.endsWith("/")
          ? `${baseUrl}vendors`
          : `${baseUrl}/vendors`;

        if (vendor?.uuid) {
          await axios.put(`${apiBaseVendors}/${vendor.uuid}`, postData);
          toast.success("Vendor updated successfully");
        } else {
          await axios.post(`${apiBaseVendors}/`, postData);
          toast.success("Vendor created successfully");
        }

        onOpenChange(false);
        navigate("/parties/vendors", { replace: true });
        setLoading(false);
      } catch (error: any) {
        const errorMessage = error?.response?.data?.message || error?.response?.data?.error || "Something went wrong. Please try again.";
        setStatus(errorMessage);
        toast.error(errorMessage);
      } finally {
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  // Populate form on edit
  useEffect(() => {
    if (open && vendor) {
      setLoading(false);
      formik.resetForm({
        values: {
          vendor_name: vendor.vendor_name || "",
          company_name: vendor.company_name || "",
          mobile: vendor.mobile || "",
          email: vendor.email || "",
          gst: vendor.gst || "",
          city: vendor.city || "",
          state: vendor.state || "",
          country: vendor.country || "",
          pin: vendor.pin || "",
          address1: vendor.address1 || "",
          address2: vendor.address2 || "",
        },
      });
    } else if (open) {
      setLoading(false);
      formik.resetForm({ values: { ...initialValues } });
    }
  }, [open, vendor]);

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="container-fixed max-w-[900px] p-0 rounded-lg shadow-lg">
          <DialogHeader className="bg-gray-50 p-6 border-b">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              {vendor ? "Edit Vendor" : "Add Vendor"}
            </DialogTitle>
            <DialogClose
              onClick={() => onOpenChange(false)}
              className=" right-2 top-1 rounded-sm opacity-70"
            />
          </DialogHeader>
          <DialogBody className="p-6">
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

              {/* Vendor Name */}
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Vendor Name
                </label>
                <input
                  placeholder="Vendor name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("vendor_name")}
                  className={clsx(
                    "flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
                    {
                      "border-red-500":
                        formik.touched.vendor_name && formik.errors.vendor_name,
                    }
                  )}
                />
                {formik.touched.vendor_name && formik.errors.vendor_name && (
                  <span role="alert" className="text-xs text-red-500">
                    {formik.errors.vendor_name}
                  </span>
                )}
              </div>
              {/* Company Name */}
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  Company Name<span className="text-red-500">*</span>
                </label>
                <input
                  placeholder="Company name"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("company_name")}
                  className={clsx(
                    "flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
                    {
                      "border-red-500":
                        formik.touched.company_name && formik.errors.company_name,
                    }
                  )}
                />
                {formik.touched.company_name && formik.errors.company_name && (
                  <span role="alert" className="text-xs text-red-500">
                    {formik.errors.company_name}
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
                  inputMode="tel"
                  onChange={(e) => {
                    // Allow numbers and hyphens, but not more than one hyphen in a row
                    let value = e.target.value.replace(/[^0-9-]/g, '');
                    value = value.replace(/--+/g, '-');
                    // Limit total length to 15 characters (including hyphens)
                    value = value.slice(0, 10);
                    formik.setFieldValue("mobile", value);
                    // Mark as touched to show errors
                    if (!formik.touched.mobile) {
                      formik.setFieldTouched("mobile", true);
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent typing a hyphen at the start or after another hyphen
                    if (e.key === '-' &&
                      (formik.values.mobile.length === 0 ||
                        formik.values.mobile.endsWith('-'))) {
                      e.preventDefault();
                    }
                  }}
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
                {/* {formik.touched.email && formik.errors.email && (
                  <span role="alert" className="text-xs text-red-500">
                    {formik.errors.email}
                  </span>
                )} */}
              </div>

              {/* Win → Address/GST fields */}
              <div className="col-span-full pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* GST */}
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      GST<span className="text-red-500">*</span>
                    </label>
                    <input
                      placeholder="GST"
                      type="text"
                      {...formik.getFieldProps("gst")}
                        className={clsx(
                          "flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
                          {
                            "border-red-500":
                              formik.touched.gst && formik.errors.gst,
                          }
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
                    <label className="block text-sm font-medium text-gray-700">
                      Address 1<span className="text-red-500">*</span>
                    </label>
                    <input
                      placeholder="Address 1"
                      type="text"
                      {...formik.getFieldProps("address1")}
                      className={clsx(
                          "flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
                          {
                            "border-red-500":
                              formik.touched.address1 && formik.errors.address1,
                          }
                        )}
                    />
                    {formik.touched.address1 && formik.errors.address1 && (
                      <span role="alert" className="text-xs text-red-500">
                        {formik.errors.address1}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Address 2
                    </label>
                    <input
                      placeholder="Address 2"
                      type="text"
                      {...formik.getFieldProps("address2")}
                      className="flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
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
                      Country<span className="text-red-500">*</span>
                    </label>
                    <select
                      {...formik.getFieldProps("country")}
                      onChange={(e) => {
                        formik.setFieldValue("country", e.target.value);
                        formik.setFieldValue("state", "");
                        formik.setFieldValue("city", "");
                      }}
                      className={clsx(
                        "flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
                        {
                          "border-red-500":
                            formik.touched.country && formik.errors.country,
                        }
                      )}
                    >
                      <option value="">--Select Country--</option>
                      {Country.getAllCountries().map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {formik.touched.country && formik.errors.country && (
                      <span role="alert" className="text-xs text-red-500">
                        {formik.errors.country}
                      </span>
                    )}
                  </div>

                  {/* State */}
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      State<span className="text-red-500">*</span>
                    </label>
                    <select
                      {...formik.getFieldProps("state")}
                      disabled={!formik.values.country}
                      onChange={(e) => {
                        formik.setFieldValue("state", e.target.value);
                        formik.setFieldValue("city", "");
                      }}
                      className={clsx(
                        "flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
                        {
                          "border-red-500":
                            formik.touched.state && formik.errors.state,
                        }
                      )}
                    >
                      <option value="">--Select State--</option>
                      {formik.values.country &&
                        State.getStatesOfCountry(formik.values.country).map(
                          (s) => (
                            <option key={s.isoCode} value={s.isoCode}>
                              {s.name}
                            </option>
                          )
                        )}
                    </select>
                    {formik.touched.state && formik.errors.state && (
                      <span role="alert" className="text-xs text-red-500">
                        {formik.errors.state}
                      </span>
                    )}
                  </div>

                  {/* City */}
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      City<span className="text-red-500">*</span>
                    </label>
                    <select
                      {...formik.getFieldProps("city")}
                      disabled={!formik.values.state}
                      className={clsx(
                        "flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
                        {
                          "border-red-500":
                            formik.touched.city && formik.errors.city,
                        }
                      )}
                    >
                      <option value="">--Select City--</option>
                      {formik.values.country &&
                        formik.values.state &&
                        City.getCitiesOfState(
                          formik.values.country,
                          formik.values.state
                        ).map((city) => (
                          <option key={city.name} value={city.name}>
                            {city.name}
                          </option>
                        ))}
                    </select>
                    {formik.touched.city && formik.errors.city && (
                      <span role="alert" className="text-xs text-red-500">
                        {formik.errors.city}
                      </span>
                    )}
                  </div>

                  {/* Pin */}
                  <div className="flex flex-col gap-1.5">
                    <label className="block text-sm font-medium text-gray-700">
                      Pin Code<span className="text-red-500">*</span>
                    </label>
                    <input
                      placeholder="Pin Code"
                      type="text"
                      {...formik.getFieldProps("pin")}
                        className={clsx(
                          "flex h-10 w-full rounded-md border border-gray-300 px-3 py-2 text-sm",
                          {
                            "border-red-500":
                              formik.touched.pin && formik.errors.pin,
                          }
                        )}
                    />
                    {formik.touched.pin && formik.errors.pin && (
                      <span role="alert" className="text-xs text-red-500">
                        {formik.errors.pin}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end col-span-full pt-4 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium border bg-gray-100 hover:bg-gray-200 h-10 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || formik.isSubmitting}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-500 h-10 px-4"
                >
                  {loading ? "Please wait..." : "Save"}
                </button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
};

export { ModalVendor };
