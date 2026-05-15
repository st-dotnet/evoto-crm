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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import axios from "axios";
import { DialogClose } from "@radix-ui/react-dialog";
import { Country, State, City } from "country-state-city";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IModalLeadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const initialValues: Lead = {
  first_name: "",
  last_name: "",
  mobile: "",
  email: "",
  gst: "",
  status: "1",
  address1: "",
  address2: "",
  city: "",
  state: "",
  country: "",
  pin: "",
  reason: "",
};

const STATUS_LABEL_TO_VALUE: Record<string, string> = {
  "New": "1",
  "In-Progress": "2",
  "Quote Given": "3",
  "Win": "4",
  "Lose": "5",
};

// ─── Validation ───────────────────────────────────────────────────────────────

const saveLeadSchema = Yup.object().shape({
  first_name: Yup.string()
    .trim()
    .min(3, "Minimum 3 symbols")
    .max(20, "Maximum 20 symbols")
    .required("First Name is required"),
  last_name: Yup.string()
    .trim()
    .min(3, "Minimum 3 symbols")
    .max(20, "Maximum 20 symbols")
    .required("Last Name is required"),
  mobile: Yup.string()
    .nullable()
    .test("mobile-or-email", "Either Mobile or Email is required", function (value) {
      const { email } = this.parent;
      return !!(value || email);
    })
    .test("mobile-length", "Mobile must be 10 digits", (value) =>
      !value || value.length === 10
    ),
  gst: Yup.string()
    .trim()
    .min(15, "Minimum 15 symbols")
    .max(15, "Maximum 15 symbols")
    .when("status", {
      is: (val: string) => val === "4",
      then: (schema) => schema.required("GST is required"),
      otherwise: (schema) => schema.nullable(),
    }),
  pin: Yup.string()
    .matches(/^[0-9]+$/, "Pin must be a number")
    .when("status", {
      is: (val: string) => val === "4",
      then: (schema) => schema.required("Pin is required"),
      otherwise: (schema) => schema.nullable(),
    }),
  email: Yup.string()
    .nullable()
    .email("Invalid email format")
    .test("mobile-or-email", "Either Mobile or Email is required", function (value) {
      const { mobile } = this.parent;
      return !!(value || mobile);
    })
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Invalid email format"),
  status: Yup.string().required("Status is required"),
  reason: Yup.string().when("status", {
    is: (val: string) => val === "5",
    then: (schema) => schema.required("Reason is required"),
    otherwise: (schema) => schema.nullable(),
  }),
  country: Yup.string().when("status", {
    is: (val: string) => val === "4",
    then: (schema) => schema.required("Country is required"),
    otherwise: (schema) => schema.nullable(),
  }),
  state: Yup.string().when("status", {
    is: (val: string) => val === "4",
    then: (schema) => schema.required("State is required"),
    otherwise: (schema) => schema.nullable(),
  }),
  city: Yup.string().when("status", {
    is: (val: string) => val === "4",
    then: (schema) => schema.required("City is required"),
    otherwise: (schema) => schema.nullable(),
  }),
  address1: Yup.string().when("status", {
    is: (val: string) => val === "4",
    then: (schema) => schema.required("Address 1 is required"),
    otherwise: (schema) => schema.nullable(),
  }),
}, [["status", "status"]]);

// ─── Shared input/select class builder ────────────────────────────────────────

const fieldClass = (hasError: boolean) =>
  clsx(
    // Base
    "flex h-9 w-full rounded-md px-3 py-2 text-sm transition-colors duration-150",
    // Light mode
    "border border-gray-200 bg-white text-gray-900 placeholder-gray-400",
    // Dark mode
    "dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500",
    // Focus
    "focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500",
    "dark:focus:ring-blue-400/30 dark:focus:border-blue-400",
    // Disabled
    "disabled:opacity-50 disabled:cursor-not-allowed",
    // Error
    hasError && "border-red-400 dark:border-red-500 focus:ring-red-400/30 focus:border-red-400",
  );

const labelClass =
  "block text-xs font-semibold tracking-wide uppercase text-gray-500 dark:text-gray-400 mb-1";

const RequiredMark = () => (
  <span className="text-red-500 ml-0.5">*</span>
);

const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p role="alert" className="mt-1 text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 3.5h1.5v5h-1.5v-5zm0 6h1.5v1.5h-1.5V10.5z" />
      </svg>
      {message}
    </p>
  ) : null;

// ─── Section divider ──────────────────────────────────────────────────────────

const SectionDivider = ({ label }: { label: string }) => (
  <div className="col-span-full flex items-center gap-3 pt-2">
    <span className="text-xs font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-500 whitespace-nowrap">
      {label}
    </span>
    <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const ModalLead = ({ open, onOpenChange, lead }: IModalLeadProps) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);

  const checkDuplicates = async (values: any) => {
    try {
      const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
      const apiBaseLeads = baseUrl.endsWith("/") ? `${baseUrl}leads/` : `${baseUrl}/leads/`;
      const params: any = {};
      if (values.mobile) params.exact_mobile = values.mobile;
      if (values.gst) params.exact_gst = values.gst;
      if (lead?.uuid) params.exclude_uuid = lead.uuid;
      if (Object.keys(params).length === 0) return { has_duplicates: false, duplicates: [] };

      const response = await axios.get(apiBaseLeads, { params });
      const foundLeads = response.data.data || [];

      if (foundLeads.length > 0) {
        const duplicates: any[] = [];
        foundLeads.forEach((l: any) => {
          if (values.mobile && l.mobile === values.mobile)
            duplicates.push({ type: "mobile", value: l.mobile, existing_lead: l });
          if (values.gst && l.gst?.toUpperCase() === values.gst?.toUpperCase())
            duplicates.push({ type: "gst", value: l.gst, existing_lead: l });
        });
        return { has_duplicates: duplicates.length > 0, duplicates };
      }
      return { has_duplicates: false, duplicates: [] };
    } catch {
      return { has_duplicates: false, duplicates: [] };
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/status-list/`);
        setStatus(response.data);
      } catch (error) {
        console.error("Error fetching status types:", error);
      }
    };
    fetchStatus();
  }, []);

  const formik = useFormik({
    initialValues,
    validationSchema: saveLeadSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      try {
        if (values.status === "4") {
          const duplicateCheck = await checkDuplicates(values);
          if (duplicateCheck.has_duplicates) {
            setPendingSubmit(values);
            setDuplicateInfo(duplicateCheck);
            setShowDuplicateDialog(true);
            setSubmitting(false);
            setLoading(false);
            return;
          }
        }
        await submitLead(values, { setStatus, setSubmitting });
      } catch (error: any) {
        const errorMessage =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Something went wrong. Please try again.";
        setStatus(errorMessage);
        toast.error(errorMessage);
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  const submitLead = async (values: any, { setStatus, setSubmitting }: any) => {
    try {
      const postData = {
        first_name: values.first_name?.trim(),
        last_name: values.last_name?.trim(),
        mobile: values.mobile || null,
        email: values.email?.trim() || null,
        gst: values.gst?.trim(),
        status: values.status,
        city: values.city,
        state: values.state,
        country: values.country,
        address1: values.address1?.trim() || "",
        address2: values.address2?.trim() || "",
        pin: values.pin,
        reason: values.reason?.trim() || null,
        bypass_duplicate: true,
      };

      const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
      const apiBaseLeads = baseUrl.endsWith("/") ? `${baseUrl}leads/` : `${baseUrl}/leads/`;
      let response;

      if (lead?.uuid) {
        response = await axios.put(`${apiBaseLeads}${lead.uuid}`, postData);
        toast.success("Lead updated successfully");
      } else {
        response = await axios.post(`${apiBaseLeads}`, postData);
        toast.success("Lead created successfully");
        if (response.data?.customer_already_exists)
          toast("Customer already exists. Linked this lead to the existing customer.");
        const createdUuid = response.data?.uuid;
        if (createdUuid) navigate(`/lead/${createdUuid}`);
        else onOpenChange(false);
      }
      onOpenChange(false);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Something went wrong. Please try again.";
      setStatus(errorMessage);
      toast.error(errorMessage);
      throw error;
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  };

  const handleConfirmDuplicate = async () => {
    if (pendingSubmit) {
      try {
        await submitLead(pendingSubmit, { setStatus: () => { }, setSubmitting: () => { } });
      } catch { }
    }
    setPendingSubmit(null);
    setDuplicateInfo(null);
  };

  const handleCancelDuplicate = () => {
    setPendingSubmit(null);
    setDuplicateInfo(null);
  };

  const getDuplicateMessage = () => {
    if (!duplicateInfo?.duplicates?.length) return "";
    const duplicateTypes = duplicateInfo.duplicates.map((d: any) => {
      const existingLead = d.existing_lead;
      return `${d.type.toUpperCase()}: ${d.value} (by ${existingLead.first_name} ${existingLead.last_name})`;
    });
    return `The following information already exists:\n${duplicateTypes.join("\n")}\nDo you want to create this lead anyway?`;
  };

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
          city: address.city || "",
          state: address.state || "",
          status: STATUS_LABEL_TO_VALUE[lead.status || ""] || "",
          country: address.country || "",
          pin: address.pin || "",
          address1: address.address1 || "",
          address2: address.address2 || "",
          reason: lead.reason || "",
        },
      });
    }
  }, [open, lead]);

  useEffect(() => {
    if (!open) formik.resetForm();
  }, [open]);

  const isWin = formik.values.status === "4";
  const isLose = formik.values.status === "5";

  return (
    <Fragment>
      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) formik.resetForm();
          onOpenChange(isOpen);
        }}
      >
        <DialogContent className="container-fixed w-[calc(100%-2rem)] max-w-[920px] p-0 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 overflow-hidden">

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <DialogHeader className="flex flex-row items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              {/* Accent dot */}
              <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 shrink-0" />
              <DialogTitle className="text-sm font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
                {lead ? "Edit Lead" : "Add New Lead"}
              </DialogTitle>
            </div>
            <DialogClose
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            />
          </DialogHeader>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <DialogBody className="p-5 sm:p-6 overflow-y-auto max-h-[80vh]">
            <form
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-4"
              noValidate
              onSubmit={formik.handleSubmit}
            >
              {formik.status && (
                <Alert variant="danger" className="col-span-full">
                  {formik.status}
                </Alert>
              )}

              {/* ── Basic Info ─────────────────────────────────────────────── */}
              <SectionDivider label="Basic Info" />

              {/* First Name */}
              <div className="flex flex-col">
                <label className={labelClass}>
                  First Name <RequiredMark />
                </label>
                <input
                  placeholder="e.g. John"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("first_name")}
                  className={fieldClass(!!(formik.touched.first_name && formik.errors.first_name))}
                />
                <FieldError message={formik.touched.first_name ? formik.errors.first_name : undefined} />
              </div>

              {/* Last Name */}
              <div className="flex flex-col">
                <label className={labelClass}>
                  Last Name <RequiredMark />
                </label>
                <input
                  placeholder="e.g. Doe"
                  type="text"
                  autoComplete="off"
                  {...formik.getFieldProps("last_name")}
                  className={fieldClass(!!(formik.touched.last_name && formik.errors.last_name))}
                />
                <FieldError message={formik.touched.last_name ? formik.errors.last_name : undefined} />
              </div>

              {/* Mobile */}
              <div className="flex flex-col">
                <label className={labelClass}>Mobile</label>
                <input
                  {...formik.getFieldProps("mobile")}
                  placeholder="10-digit number"
                  type="text"
                  inputMode="tel"
                  className={fieldClass(!!(formik.touched.mobile && formik.errors.mobile))}
                  onChange={(e) => {
                    let value = e.target.value.replace(/[^0-9-]/g, "");
                    value = value.replace(/--+/g, "-").slice(0, 10);
                    formik.setFieldValue("mobile", value);
                    if (!formik.touched.mobile) formik.setFieldTouched("mobile", true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "-" && (formik.values.mobile.length === 0 || formik.values.mobile.endsWith("-")))
                      e.preventDefault();
                  }}
                  onInput={(e) => {
                    const input = e.target as HTMLInputElement;
                    if (input.value.length > 10) input.value = input.value.slice(0, 10);
                  }}
                />
                <FieldError message={formik.touched.mobile ? formik.errors.mobile : undefined} />
              </div>

              {/* Email */}
              <div className="flex flex-col">
                <label className={labelClass}>Email</label>
                <input
                  {...formik.getFieldProps("email")}
                  placeholder="email@example.com"
                  type="email"
                  className={fieldClass(!!(formik.touched.email && formik.errors.email))}
                />
                <FieldError message={formik.touched.email ? formik.errors.email : undefined} />
              </div>

              {/* ── Lead Status ────────────────────────────────────────────── */}
              <SectionDivider label="Lead Status" />

              {/* Status */}
              <div className="flex flex-col">
                <label className={labelClass}>
                  Status <RequiredMark />
                </label>
                <select
                  {...formik.getFieldProps("status")}
                  className={fieldClass(!!(formik.touched.status && formik.errors.status))}
                >
                  <option value="">Select status</option>
                  {status.map((s: Status) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <FieldError message={formik.touched.status ? formik.errors.status : undefined} />
              </div>

              {/* ── Win Fields ─────────────────────────────────────────────── */}
              {isWin && (
                <>
                  <SectionDivider label="Win Details" />

                  {/* GST */}
                  <div className="flex flex-col">
                    <label className={labelClass}>
                      GST <RequiredMark />
                    </label>
                    <input
                      placeholder="15-character GST number"
                      type="text"
                      autoComplete="off"
                      {...formik.getFieldProps("gst")}
                      className={fieldClass(!!(formik.touched.gst && formik.errors.gst))}
                      onInput={(e) => {
                        const input = e.target as HTMLInputElement;
                        if (input.value.length > 15) input.value = input.value.slice(0, 15);
                      }}
                    />
                    <FieldError message={formik.touched.gst ? formik.errors.gst : undefined} />
                  </div>

                  {/* Address 1 */}
                  <div className="flex flex-col">
                    <label className={labelClass}>
                      Address Line 1 <RequiredMark />
                    </label>
                    <input
                      placeholder="Street / building"
                      type="text"
                      autoComplete="off"
                      {...formik.getFieldProps("address1")}
                      className={fieldClass(!!(formik.touched.address1 && formik.errors.address1))}
                    />
                    <FieldError message={formik.touched.address1 ? formik.errors.address1 : undefined} />
                  </div>

                  {/* Address 2 */}
                  <div className="flex flex-col">
                    <label className={labelClass}>Address Line 2</label>
                    <input
                      placeholder="Landmark / suite (optional)"
                      type="text"
                      autoComplete="off"
                      {...formik.getFieldProps("address2")}
                      className={fieldClass(!!(formik.touched.address2 && formik.errors.address2))}
                    />
                    <FieldError message={formik.touched.address2 ? formik.errors.address2 : undefined} />
                  </div>

                  {/* Country */}
                  <div className="flex flex-col">
                    <label className={labelClass}>
                      Country <RequiredMark />
                    </label>
                    <select
                      {...formik.getFieldProps("country")}
                      onChange={(e) => {
                        formik.setFieldValue("country", e.target.value);
                        formik.setFieldValue("state", "");
                        formik.setFieldValue("city", "");
                      }}
                      className={fieldClass(!!(formik.touched.country && formik.errors.country))}
                    >
                      <option value="">Select country</option>
                      {Country.getAllCountries().map((c) => (
                        <option key={c.isoCode} value={c.isoCode}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <FieldError message={formik.touched.country ? formik.errors.country : undefined} />
                  </div>

                  {/* State */}
                  <div className="flex flex-col">
                    <label className={labelClass}>
                      State <RequiredMark />
                    </label>
                    <select
                      {...formik.getFieldProps("state")}
                      onChange={(e) => {
                        formik.setFieldValue("state", e.target.value);
                        formik.setFieldValue("city", "");
                      }}
                      disabled={!formik.values.country}
                      className={fieldClass(!!(formik.touched.state && formik.errors.state))}
                    >
                      <option value="">Select state</option>
                      {formik.values.country &&
                        State.getStatesOfCountry(formik.values.country).map((s) => (
                          <option key={s.isoCode} value={s.isoCode}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                    <FieldError message={formik.touched.state ? formik.errors.state : undefined} />
                  </div>

                  {/* City */}
                  <div className="flex flex-col">
                    <label className={labelClass}>
                      City <RequiredMark />
                    </label>
                    <select
                      {...formik.getFieldProps("city")}
                      disabled={!formik.values.state}
                      className={fieldClass(!!(formik.touched.city && formik.errors.city))}
                    >
                      <option value="">Select city</option>
                      {formik.values.country &&
                        formik.values.state &&
                        City.getCitiesOfState(formik.values.country, formik.values.state).map((city) => (
                          <option key={city.name} value={city.name}>
                            {city.name}
                          </option>
                        ))}
                    </select>
                    <FieldError message={formik.touched.city ? formik.errors.city : undefined} />
                  </div>

                  {/* Pin Code */}
                  <div className="flex flex-col">
                    <label className={labelClass}>
                      Pin Code <RequiredMark />
                    </label>
                    <input
                      placeholder="e.g. 110001"
                      type="text"
                      autoComplete="off"
                      {...formik.getFieldProps("pin")}
                      className={fieldClass(!!(formik.touched.pin && formik.errors.pin))}
                    />
                    <FieldError message={formik.touched.pin ? formik.errors.pin : undefined} />
                  </div>
                </>
              )}

              {/* ── Lose: Reason ───────────────────────────────────────────── */}
              {isLose && (
                <>
                  <SectionDivider label="Reason for Loss" />
                  <div className="flex flex-col col-span-full">
                    <label className={labelClass}>
                      Reason <RequiredMark />
                    </label>
                    <textarea
                      placeholder="Briefly describe why the lead was lost…"
                      autoComplete="off"
                      rows={3}
                      {...formik.getFieldProps("reason")}
                      className={clsx(
                        fieldClass(!!(formik.touched.reason && formik.errors.reason)),
                        "h-auto resize-none"
                      )}
                    />
                    <FieldError message={formik.touched.reason ? formik.errors.reason : undefined} />
                  </div>
                </>
              )}

              {/* ── Footer ─────────────────────────────────────────────────── */}
              <div className="col-span-full flex items-center justify-end gap-2 pt-4 mt-1 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="h-9 px-4 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || formik.isSubmitting}
                  className="h-9 px-5 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 100 10h-4a8 8 0 01-8-8z" />
                      </svg>
                      Saving…
                    </span>
                  ) : (
                    lead ? "Update Lead" : "Save Lead"
                  )}
                </button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={showDuplicateDialog}
        onOpenChange={setShowDuplicateDialog}
        title="Duplicate Information Detected"
        message={
          <div style={{ whiteSpace: "pre-line" }}>{getDuplicateMessage()}</div>
        }
        confirmText="Yes, Create Lead"
        cancelText="No, Cancel"
        onConfirm={handleConfirmDuplicate}
        onCancel={handleCancelDuplicate}
        variant="warning"
      />
    </Fragment>
  );
};

export { ModalLead };