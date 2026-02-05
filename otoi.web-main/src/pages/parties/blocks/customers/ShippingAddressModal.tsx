import { Fragment, useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import clsx from "clsx";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogClose } from "@radix-ui/react-dialog";
import { Country, State, City } from "country-state-city";
import { toast } from "sonner";
import { uniqueID } from "@/lib/helpers";
import { ShippingAddress } from "./customer-models";

interface IShippingAddressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  address?: ShippingAddress | null;
  onSave: (address: ShippingAddress) => void;
  existingAddresses?: ShippingAddress[];
  title?: string;
}

// validation function to check for duplicate address types
const validateAddressType = (
  address: ShippingAddress,
  existingAddresses: ShippingAddress[],
  editingAddress?: ShippingAddress | null,
) => {
  const duplicateAddress = existingAddresses.find(
    (addr) =>
      addr.address_type === address.address_type &&
      addr.uuid !== editingAddress?.uuid,
  );

  if (duplicateAddress) {
    return (
      <span
        style={{ color: "black" }}
      >{`The ${address.address_type} address already exists. Please choose a different address type.`}</span>
    );
  }

  return null;
};

const shippingAddressSchema = Yup.object().shape({
  address1: Yup.string().required("Address is required"),
  address2: Yup.string().nullable(),
  city: Yup.string().required("City is required"),
  state: Yup.string().required("State is required"),
  country: Yup.string().required("Country is required"),
  pin: Yup.string()
    .required("Pin code is required")
    .matches(/^[0-9]+$/, "Pin must be a number"),
  address_type: Yup.string().required("Address type is required"),
  is_default: Yup.boolean(),
});

const getDefaultAddressType = (existingAddresses: ShippingAddress[]): "home" | "work" | "other" => {
  const existingTypes = existingAddresses.map(addr => addr.address_type);
  
  // If both home and work exist, default to other
  if (existingTypes.includes("home") && existingTypes.includes("work")) {
    return "other";
  }
  
  // If home exists but work doesn't, default to work
  if (existingTypes.includes("home") && !existingTypes.includes("work")) {
    return "work";
  }
  
  // If work exists but home doesn't, default to home
  if (existingTypes.includes("work") && !existingTypes.includes("home")) {
    return "home";
  }
  
  // If neither exists, default to home
  return "home";
};

const initialAddressValues: ShippingAddress = {
  uuid: "", // Will be generated when saving
  address1: "",
  address2: "",
  city: "",
  state: "",
  country: "",
  pin: "",
  address_type: "home",
  is_default: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const ShippingAddressModal = ({
  open,
  onOpenChange,
  address,
  onSave,
  existingAddresses = [],
  title,
}: IShippingAddressModalProps) => {
  const [loading, setLoading] = useState(false);

  const formik = useFormik({
    initialValues: address ? { ...address } : {
      ...initialAddressValues,
      address_type: getDefaultAddressType(existingAddresses)
    },
    validationSchema: shippingAddressSchema,
    onSubmit: async (values, { setSubmitting, resetForm, setStatus }) => {
      setLoading(true);
      setSubmitting(true);

      try {
        const addressToSave: ShippingAddress = {
          ...values,
          uuid: address?.uuid || uniqueID(),
          created_at: address?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Validate for duplicate address types
        const duplicateError = validateAddressType(
          addressToSave,
          existingAddresses,
          address,
        );
        if (duplicateError) {
          setStatus(duplicateError);
          return;
        }

        // Clear any existing status
        setStatus(null);

        // If setting as default, ensure other addresses are not default
        if (addressToSave.is_default) {
          existingAddresses.forEach((addr) => {
            if (addr.uuid !== addressToSave.uuid) {
              addr.is_default = false;
            }
          });
        }

        // If this is the first address and not explicitly set as default, make it default
        if (existingAddresses.length === 0 && !addressToSave.is_default) {
          addressToSave.is_default = true;
        }

        onSave(addressToSave);
        toast.success(
          address
            ? "Address updated successfully"
            : "Address added successfully",
        );

        onOpenChange(false);
        if (!address) {
          resetForm();
        }
      } catch (error: any) {
        setStatus("Failed to save address. Please try again.");
      } finally {
        setLoading(false);
        setSubmitting(false);
      }
    },
  });

  useEffect(() => {
    if (!open) {
      formik.resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (open && address) {
      formik.setValues(address);
    } else if (open && !address) {
      formik.resetForm({ 
        values: {
          ...initialAddressValues,
          address_type: getDefaultAddressType(existingAddresses)
        }
      });
    }
  }, [open, address, existingAddresses]);

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* <DialogContent className="container-fixed max-w-[600px] p-0 rounded-lg shadow-lg z-50"> */}
        <DialogContent className="container-fixed max-w-[600px] p-0 rounded-lg shadow-lg z-50 max-h-[90vh] flex flex-col">
          <DialogHeader className="bg-gray-50 p-6 border-b">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              {title ||
                (address ? "Edit Shipping Address" : "Add Shipping Address")}
            </DialogTitle>
            <DialogClose
              onClick={() => onOpenChange(false)}
              className="right-2 top-1 rounded-sm opacity-70"
            />
          </DialogHeader>
          <DialogBody className="p-6 flex-1 overflow-y-auto">
            <form
              noValidate
              onSubmit={formik.handleSubmit}
              className="space-y-4"
            >
              {formik.status && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{formik.status}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Address Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Type <span className="text-red-500">*</span>
                </label>
                <div className="inline-flex rounded-md shadow-sm" role="group">
                  {["home", "work", "other"].map((type) => (
                    <label
                      key={type}
                      className={`relative flex items-center justify-center px-4 py-2 text-sm font-medium border cursor-pointer transition-all duration-200
                                                ${
                                                  formik.values.address_type ===
                                                  type
                                                    ? "bg-blue-600 text-white border-blue-600 z-10"
                                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                                                }
                                                ${type === "home" ? "rounded-l-md" : ""}
                                                ${type === "other" ? "rounded-r-md" : ""}
                                                ${type !== "home" ? "-ml-px" : ""}
                                            `}
                    >
                      <input
                        type="radio"
                        name="address_type"
                        value={type}
                        checked={formik.values.address_type === type}
                        onChange={formik.handleChange}
                        className="sr-only"
                      />
                      {type === "home" ? (
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                        </svg>
                      ) : type === "work" ? (
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 2l-5.5 9h11z" />
                          <circle cx="17.5" cy="17.5" r="4.5" />
                          <path d="M3 13.5h8v8H3z" />
                        </svg>
                      )}
                      <span className="capitalize">
                        {type === "other" ? "Others" : type}
                      </span>
                    </label>
                  ))}
                </div>
                {formik.touched.address_type && formik.errors.address_type && (
                  <span
                    role="alert"
                    className="text-xs text-red-500 mt-1 block"
                  >
                    {formik.errors.address_type}
                  </span>
                )}
              </div>

              {/* Address Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    {...formik.getFieldProps("address1")}
                    className={clsx("input w-full", {
                      "border-red-500 focus:ring-red-500 focus:border-red-500":
                        formik.touched.address1 && formik.errors.address1,
                    })}
                    placeholder="Street address"
                  />
                  {formik.touched.address1 && formik.errors.address1 && (
                    <span role="alert" className="text-xs text-red-500">
                      {formik.errors.address1}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
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
                      className={clsx("input w-full", {
                        "border-red-500 focus:ring-red-500 focus:border-red-500":
                          formik.touched.country && formik.errors.country,
                      })}
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

                  <div>
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
                      className={clsx("input w-full disabled:bg-gray-100", {
                        "border-red-500 focus:ring-red-500 focus:border-red-500":
                          formik.touched.state && formik.errors.state,
                      })}
                    >
                      <option value="">--Select State--</option>
                      {formik.values.country &&
                        State.getStatesOfCountry(formik.values.country).map(
                          (s) => (
                            <option key={s.isoCode} value={s.isoCode}>
                              {s.name}
                            </option>
                          ),
                        )}
                    </select>
                    {formik.touched.state && formik.errors.state && (
                      <span role="alert" className="text-xs text-red-500">
                        {formik.errors.state}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      City <span className="text-red-500">*</span>
                    </label>
                    <select
                      {...formik.getFieldProps("city")}
                      disabled={!formik.values.state}
                      className={clsx("input w-full disabled:bg-gray-100", {
                        "border-red-500 focus:ring-red-500 focus:border-red-500":
                          formik.touched.city && formik.errors.city,
                      })}
                    >
                      <option value="">--Select City--</option>
                      {formik.values.country &&
                        formik.values.state &&
                        City.getCitiesOfState(
                          formik.values.country,
                          formik.values.state,
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Pin Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...formik.getFieldProps("pin")}
                      className={clsx("input w-full", {
                        "border-red-500 focus:ring-red-500 focus:border-red-500":
                          formik.touched.pin && formik.errors.pin,
                      })}
                    />
                    {formik.touched.pin && formik.errors.pin && (
                      <span role="alert" className="text-xs text-red-500">
                        {formik.errors.pin}
                      </span>
                    )}
                  </div>
                </div>

                {/* Default Address Checkbox */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_default"
                    {...formik.getFieldProps("is_default")}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor="is_default"
                    className="text-sm font-medium text-gray-700"
                  >
                    Set as default shipping address
                  </label>
                </div>
              </div>

              {/* Form Actions */}
              {/* <div className="flex justify-end gap-2 pt-4 border-t"> */}
              <div className="border-t bg-white px-6 py-4 flex justify-end gap-2 sticky bottom-0 z-10">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-gray-100 text-gray-800 border hover:bg-gray-200 h-10 px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || formik.isSubmitting}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
};

export { ShippingAddressModal };
