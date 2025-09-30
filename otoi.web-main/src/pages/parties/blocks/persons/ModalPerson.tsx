import { Fragment, useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components";
import axios from "axios";
import { DialogClose } from "@radix-ui/react-dialog";
import { Country, State, City } from "country-state-city";

interface IModalPersonProps {
  open: boolean;
  onOpenChange: () => void;
  person: Person | null;
}

interface IModalPersonType {
  id: number;
  name: string;
}

interface Status {
  id: number;
  name: string;
}

interface Person {
  uuid?: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gst: string;
  person_type: string;
  person_type_id?: string;
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


const initialValues: Omit<Person, "person_type"> = {
  first_name: "",
  last_name: "",
  mobile: "",
  email: "",
  gst: "",
  person_type_id: "",
  status: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  country: "",
  pin: "",
  reason: "",
};

const savePersonSchema = Yup.object().shape({
  first_name: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("First Name is required"),
  last_name: Yup.string()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Last Name is required"),
  mobile: Yup.string()
    .min(10, "Minimum 10 symbols")
    .max(13, "Maximum 13 symbols")
    .required("Mobile is required"),
  email: Yup.string()
    .email("Wrong email format")
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols"),
  gst: Yup.string().min(15, "Minimum 15 symbols").max(15, "Maximum 15 symbols"),
  person_type_id: Yup.string().required("Person Type is required"),
  pin: Yup.string().matches(/^[0-9]+$/, "Pin must be a number"),
});

const ModalPerson = ({ open, onOpenChange, person }: IModalPersonProps) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [personTypes, setPersonTypes] = useState<IModalPersonType[]>([]);
  const [status, setStatus] = useState<Status[]>([]);

  useEffect(() => {
    const fetchPersonTypes = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_APP_API_URL}/person-types/`
        );
        setPersonTypes(response.data);
      } catch (error) {
        console.error("Error fetching person types:", error);
      }
    };
    fetchPersonTypes();
  }, []);

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

  const formik = useFormik({
    initialValues,
    validationSchema: savePersonSchema,
    onSubmit: async (values, { setStatus, setSubmitting }) => {
      setLoading(true);
      try {
        const postData = {
          first_name: values.first_name,
          last_name: values.last_name,
          mobile: values.mobile,
          email: values.email,
          gst: values.gst,
          person_type_id: values.person_type_id,
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
        const apiBasePersons = baseUrl.endsWith("/") ? `${baseUrl}persons` : `${baseUrl}/persons`;

        if (person?.uuid) {
          await axios.put(`${apiBasePersons}/${person.uuid}`, postData);
        } else {
          await axios.post(`${apiBasePersons}/`, postData);
        }
        onOpenChange();
        navigate("/parties/persons", { replace: true });
      } catch (error) {
        console.error(error);
        setStatus("The person details are incorrect");
      } finally {
        // Always clear loading/submitting states to avoid stuck "Please wait..."
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

useEffect(() => {
  if (open && person) {
    const resolvedTypeId =
      person.person_type_id ||
      (person.person_type
        ? personTypes.find(
            (t) => t.name.toLowerCase() === (person.person_type || "").toLowerCase()
          )?.id?.toString()
        : "") ||
      "";
    const address = person.addresses?.[0] || {};
    formik.resetForm({
      values: {
        first_name: person.first_name || "",
        last_name: person.last_name || "",
        mobile: person.mobile || "",
        email: person.email || "",
        gst: person.gst || "",
        person_type_id: resolvedTypeId,
        status: person.status || "",
        city: address.city || "",
        state: address.state || "",
        country: address.country || "",
        pin: address.pin || "",
        address1: address.address1 || "",
        address2: address.address2 || "",
        reason: person.reason || "",
      },
    });
  }
}, [open, person, personTypes]);

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="container-fixed max-w-[900px] p-0 rounded-lg shadow-lg">
          <DialogHeader className="bg-gray-50 p-6 border-b">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              {person ? "Edit Person" : "Add Person"}
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
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Mobile<span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    placeholder="Mobile"
                    type="text"
                    autoComplete="off"
                    {...formik.getFieldProps("mobile")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.mobile && formik.errors.mobile,
                      }
                    )}
                  />
                  {formik.touched.mobile && formik.errors.mobile && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.mobile}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    placeholder="Email"
                    type="email"
                    autoComplete="off"
                    {...formik.getFieldProps("email")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500 ": formik.touched.email && formik.errors.email,
                      }
                    )}
                  />
                  {formik.touched.email && formik.errors.email && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.email}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Person Type<span style={{ color: "red" }}>*</span>
                  </label>
                  <select
                    {...formik.getFieldProps("person_type_id")}
                    className={clsx(
                      "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                      {
                        "border-red-500": formik.touched.person_type_id && formik.errors.person_type_id,
                      }
                    )}
                  >
                    <option value="">--Select--</option>
                    {personTypes
                      .filter((type) => type.id === 4 || type.id === 5) // 4: Lead, 5: Employee
                      .map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                  </select>
                  {formik.touched.person_type_id && formik.errors.person_type_id && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.person_type_id}
                    </span>
                  )}
                </div>
                {/* Conditional rendering for Lead */}
                {formik.values.person_type_id === "4" && (
                  <>
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
                        {status.map((type: Status) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                      {formik.touched.status && formik.errors.status && (
                        <span role="alert" className="text-xs text-red-500">
                          {formik.errors.status}
                        </span>
                      )}
                    </div>
                    {formik.values.status === "4" && (
                      <div className="col-span-full pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-medium text-gray-700">GST</label>
                            <input
                              placeholder="GST"
                              type="text"
                              autoComplete="off"
                              {...formik.getFieldProps("gst")}
                              className={clsx(
                                "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                                {
                                  "border-red-500 ": formik.touched.gst && formik.errors.gst,
                                }
                              )}
                            />
                            {formik.touched.gst && formik.errors.gst && (
                              <span role="alert" className="text-xs text-red-500">
                                {formik.errors.gst}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-medium text-gray-700">Address 1</label>
                            <input
                              placeholder="Address 1"
                              type="text"
                              autoComplete="off"
                              {...formik.getFieldProps("address1")}
                              className={clsx(
                                "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                                {
                                  "border-red-500 ": formik.touched.address1 && formik.errors.address1,
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
                            <label className="block text-sm font-medium text-gray-700">Address 2</label>
                            <input
                              placeholder="Address 2"
                              type="text"
                              autoComplete="off"
                              {...formik.getFieldProps("address2")}
                              className={clsx(
                                "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm",
                                {
                                  "border-red-500 ": formik.touched.address2 && formik.errors.address2,
                                }
                              )}
                            />
                            {formik.touched.address2 && formik.errors.address2 && (
                              <span role="alert" className="text-xs text-red-500">
                                {formik.errors.address2}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                              Country <span style={{ color: "red" }}>*</span>
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
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                              State <span style={{ color: "red" }}>*</span>
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
                          <div className="flex flex-col gap-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                              City <span style={{ color: "red" }}>*</span>
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
                  </>
                )}
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

export { ModalPerson };
