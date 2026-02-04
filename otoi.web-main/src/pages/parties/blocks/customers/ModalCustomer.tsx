import { Fragment, useState, useEffect, useRef } from "react";
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
import { Alert } from "@/components";
import axios from "axios";
import { DialogClose } from "@radix-ui/react-dialog";
import { Country, State, City } from "country-state-city";
import { toast } from "sonner";
import { ShippingAddressList } from "./ShippingAddressList";
import { ShippingAddressModal } from "./ShippingAddressModal";

interface IModalCustomerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newCustomer?: any) => void;
  customer: Person | null;
  defaultStatus?: string;
  title?: string; // Optional custom title for the dialog
  hideStatusField?: boolean;
  hideSameAsBilling?: boolean; // New prop to hide same as billing checkbox
}

interface PersonType {
  id: number;
  name: string;
}

interface Status {
  id: number;
  name: string;
}

interface ShippingAddress {
  uuid?: string;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  country: string;
  pin: string;
  address_type: "home" | "work" | "other";
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface Person {
  uuid?: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  gst: string;
  person_type_id: string;
  status: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
  reason?: string;
  // Shipping address fields (flat structure for form)
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_country?: string;
  shipping_pin?: string;
  // Nested shipping addresses from API
  shipping_addresses?: ShippingAddress[];
}

const initialValues: Person = {
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
  shipping_address1: "",
  shipping_address2: "",
  shipping_city: "",
  shipping_state: "",
  shipping_country: "",
  shipping_pin: "",
};

const saveCustomerSchema = Yup.object().shape({
  first_name: Yup.string().min(3).max(50).required("First Name is required"),
  last_name: Yup.string().min(3).max(50).required("Last Name is required"),

  mobile: Yup.string()
    .nullable()
    .test(
      "mobile-or-email",
      "Either Mobile or Email is required",
      function (value) {
        const { email } = this.parent;
        if (!value && !email) {
          return this.createError({
            path: "email",
            message: "Either Mobile or Email is required",
          });
        }
        return true;
      },
    )
    .test(
      "mobile-format",
      "Mobile number must be a valid 10-digit number",
      function (value) {
        if (!value) return true;

        const digitsOnly = value.replace(/-/g, "");
        return digitsOnly.length === 10 && /^\d{10}$/.test(digitsOnly);
      },
    ),

  email: Yup.string()
    .nullable()
    .email("Invalid email")
    .test(
      "email-or-mobile",
      "Either Mobile or Email is required",
      function (value) {
        const { mobile } = this.parent;
        if (!value && !mobile) {
          return this.createError({
            path: "email",
            message: "Either Mobile or Email is required",
          });
        }
        return true;
      },
    )
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Invalid email format"),

  gst: Yup.string()
    .nullable()
    .min(15, "GST must be 15 characters")
    .max(15, "GST must be 15 characters"),

  pin: Yup.string()
    .nullable()
    .matches(/^[0-9]+$/, "Pin must be a number"),

  shipping_pin: Yup.string()
    .nullable()
    .matches(/^[0-9]+$/, "Pin must be a number"),

  reason: Yup.string().when("status", {
    is: (status: string) => status === "5",
    then: (schema) => schema.required("Reason is required when status is Lose"),
    otherwise: (schema) => schema.nullable(),
  }),
});

// Shipping Address Form Component
const ShippingAddressForm = ({
  address,
  onUpdate,
  onRemove,
  onSetDefault,
  canRemove = true,
  isEditing = false,
  formik,
}: {
  address: ShippingAddress;
  onUpdate: (uuid: string, field: keyof ShippingAddress, value: any) => void;
  onRemove: (uuid: string) => void;
  onSetDefault: (uuid: string) => void;
  canRemove?: boolean;
  isEditing?: boolean;
  formik: any;
}) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-gray-900">
            {address.address_type
              ? `${address.address_type.charAt(0).toUpperCase() + address.address_type.slice(1)} Address`
              : "Shipping Address"}
          </h4>
          {address.is_default && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!address.is_default && (
            <button
              type="button"
              onClick={() => onSetDefault(address.uuid!)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Set as default
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(address.uuid!)}
              className="text-red-600 hover:text-red-800 text-sm font-medium ml-4"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Address Type Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Address Type <span style={{ color: "red" }}>*</span>
        </label>
        <div className="inline-flex rounded-md shadow-sm" role="group">
          {["home", "work", "other"].map((type) => {
            return (
              <label
                key={type}
                className={`relative flex items-center justify-center px-4 py-2 text-sm font-medium border cursor-pointer transition-all duration-200
                                ${address.address_type === type
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
                  name={`address_type_${address.uuid}`}
                  value={type}
                  checked={address.address_type === type}
                  onChange={(e) =>
                    onUpdate(address.uuid!, "address_type", e.target.value)
                  }
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
            );
          })}
        </div>
      </div>

      {/* Address Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Shipping Address <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            value={address.address1 || ""}
            onBlur={(e) => onUpdate(address.uuid!, "address1", e.target.value)}
            onChange={(e) =>
              onUpdate(address.uuid!, "address1", e.target.value)
            }
            className="input"
            placeholder="Street address"
          />
        </div>

        {/* <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Shipping Address 2
                    </label>
                    <input
                        type="text"
                        value={address.address2 || ''}
                        onBlur={(e) => onUpdate(address.uuid!, 'address2', e.target.value)}
                        onChange={(e) => onUpdate(address.uuid!, 'address2', e.target.value)}
                        className="input"
                        placeholder="Apartment, suite, unit, etc."
                    />
                </div> */}

        <div className="flex flex-col gap-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Country <span className="text-red-500">*</span>
          </label>
          <select
            value={address.country || ""}
            onBlur={(e) => {
              onUpdate(address.uuid!, "country", e.target.value);
            }}
            onChange={(e) => {
              onUpdate(address.uuid!, "country", e.target.value);
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
            value={address.state || ""}
            onBlur={(e) => {
              onUpdate(address.uuid!, "state", e.target.value);
            }}
            onChange={(e) => {
              onUpdate(address.uuid!, "state", e.target.value);
            }}
            disabled={!address.country}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">--Select State--</option>
            {address.country &&
              State.getStatesOfCountry(address.country).map((s) => (
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
            value={address.city || ""}
            onBlur={(e) => {
              onUpdate(address.uuid!, "city", e.target.value);
            }}
            onChange={(e) => {
              onUpdate(address.uuid!, "city", e.target.value);
            }}
            disabled={!address.state}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
          >
            <option value="">--Select City--</option>
            {address.country &&
              address.state &&
              City.getCitiesOfState(address.country, address.state).map(
                (city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ),
              )}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Pin Code <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            value={address.pin || ""}
            onBlur={(e) => onUpdate(address.uuid!, "pin", e.target.value)}
            onChange={(e) =>
              onUpdate(
                address.uuid!,
                "pin",
                e.target.value.replace(/[^0-9]/g, ""),
              )
            }
            className="input"
          />
        </div>
      </div>
    </div>
  );
};

const ModalCustomer = ({
  open,
  onOpenChange,
  onSuccess,
  customer,
  title,
  defaultStatus,
  hideStatusField = false,
  hideSameAsBilling = false,
}: IModalCustomerProps) => {
  const [loading, setLoading] = useState(false);
  const [personTypes, setPersonTypes] = useState<PersonType[]>([]);
  const [statusList, setStatusList] = useState<Status[]>([]);
  // Initialize sameAsBilling, default to true
  const [sameAsBilling, setSameAsBilling] = useState<boolean>(true);
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>(
    [],
  );
  const [editingAddressIndex, setEditingAddressIndex] = useState<number | null>(
    null,
  );
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(
    null,
  );
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [originalShippingAddresses, setOriginalShippingAddresses] = useState<
    ShippingAddress[]
  >([]);

  // Initialize shipping addresses when customer data loads
  useEffect(() => {
    if (open && customer) {
      // Always set shipping addresses based on customer data
      // If customer has shipping_addresses, use them; otherwise, set to empty array
      const addresses = (customer.shipping_addresses || []).map((addr) => ({
        ...addr,
        // Ensure each address has a UUID, generate one if missing
        uuid: addr.uuid || `temp-${Math.random().toString(36).substr(2, 9)}`,
        // Ensure timestamps are set
        created_at: addr.created_at || new Date().toISOString(),
        updated_at: addr.updated_at || new Date().toISOString(),
      }));

      setShippingAddresses(addresses);
      setOriginalShippingAddresses(JSON.parse(JSON.stringify(addresses))); // Deep copy for comparison
    } else if (open && !customer) {
      // For new customer, set to empty array
      setShippingAddresses([]);
      setOriginalShippingAddresses([]);
    }
  }, [open, customer]);

  // Add new shipping address
  const addShippingAddress = () => {
    setEditingAddress(null);
    setAddressModalOpen(true);
  };

  // Remove shipping address by UUID
  const removeShippingAddress = (uuid: string) => {
    console.log("Removing address with UUID:", uuid);
    console.log("Before removal:", shippingAddresses);

    const addressToRemove = shippingAddresses.find(
      (addr) => addr.uuid === uuid,
    );
    if (!addressToRemove) {
      console.error("Address not found for UUID:", uuid);
      return;
    }

    const updatedAddresses = shippingAddresses.filter(
      (addr) => addr.uuid !== uuid,
    );
    const wasDefault = addressToRemove.is_default;

    // If we removed the default address and there are remaining addresses, make the first one default
    if (wasDefault && updatedAddresses.length > 0) {
      console.log("Removed default address, setting new default");
      updatedAddresses[0].is_default = true;
    }

    console.log("After removal:", updatedAddresses);
    setShippingAddresses(updatedAddresses);
  };

  // Update shipping address by UUID
  const updateShippingAddress = (
    uuid: string,
    field: keyof ShippingAddress,
    value: any,
  ) => {
    const updatedAddresses = shippingAddresses.map((addr) => {
      if (addr.uuid === uuid) {
        return {
          ...addr,
          [field]: value,
          updated_at: new Date().toISOString(),
        };
      }
      return addr;
    });
    setShippingAddresses(updatedAddresses);
  };

  // Set default shipping address by UUID
  const setDefaultShippingAddress = (uuid: string) => {
    const updatedAddresses = shippingAddresses.map((addr) => ({
      ...addr,
      is_default: addr.uuid === uuid,
    }));
    setShippingAddresses(updatedAddresses);
  };

  // Handle edit address by UUID
  const handleEditAddress = (uuid: string) => {
    const address = shippingAddresses.find((addr) => addr.uuid === uuid);
    if (address) {
      setEditingAddress(address);
      setAddressModalOpen(true);
    } else {
      console.error("Address not found for UUID:", uuid);
    }
  };

  // Handle delete address by UUID
  const handleDeleteAddress = (uuid: string) => {
    console.log("Delete address called for UUID:", uuid);
    console.log("Current addresses:", shippingAddresses);

    // Find the address to delete
    const addressIndex = shippingAddresses.findIndex(
      (addr) => addr.uuid === uuid,
    );

    if (addressIndex === -1) {
      console.error("Address not found for UUID:", uuid);
      toast.error("Address not found");
      return;
    }

    const addressToDelete = shippingAddresses[addressIndex];
    console.log("User confirmed deletion");
    removeShippingAddress(uuid);
    toast.success("Shipping address deleted successfully");
  };

  // Handle save edited address
  const handleSaveEditedAddress = () => {
    setEditingAddressIndex(null);
  };

  // Handle save address from modal
  const handleSaveAddress = (address: ShippingAddress) => {
    if (editingAddress) {
      // Update existing address
      const updatedAddresses = shippingAddresses.map((addr) =>
        addr.uuid === editingAddress.uuid
          ? { ...address, updated_at: new Date().toISOString() }
          : addr,
      );
      setShippingAddresses(updatedAddresses);
    } else {
      // Add new address with a new UUID if it doesn't have one
      const newAddress = {
        ...address,
        uuid: address.uuid || `temp-${Date.now()}`,
        created_at: address.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setShippingAddresses([...shippingAddresses, newAddress]);
    }
    setEditingAddress(null);
  };

  // Check if shipping addresses have unsaved changes
  const hasUnsavedShippingChanges = () => {
    if (shippingAddresses.length !== originalShippingAddresses.length) {
      return true;
    }

    return shippingAddresses.some((addr, index) => {
      const original = originalShippingAddresses[index];
      if (!original) return true;

      // Compare relevant fields (exclude timestamps)
      return (
        addr.address1 !== original.address1 ||
        addr.address2 !== original.address2 ||
        addr.city !== original.city ||
        addr.state !== original.state ||
        addr.country !== original.country ||
        addr.pin !== original.pin ||
        addr.address_type !== original.address_type ||
        addr.is_default !== original.is_default
      );
    });
  };

  // Handle dialog close with confirmation
  const handleDialogClose = (isOpen: boolean) => {
    if (!isOpen && hasUnsavedShippingChanges() && !formik.isSubmitting) {
      setShowUnsavedChangesDialog(true);
      return; // Don't close the dialog yet
    }

    onOpenChange(isOpen);
    if (!isOpen) {
      formik.resetForm();
      setShowUnsavedChangesDialog(false);
    }
  };

  // Cancel dialog close
  const handleCancelClose = () => {
    setShowUnsavedChangesDialog(false);
  };

  // Handle cancel edit
  const handleDiscardChanges = () => {
    setShowUnsavedChangesDialog(false);
    onOpenChange(false);
    formik.resetForm();
    setEditingAddressIndex(null);
  };

  useEffect(() => {
    // axios.get(`${import.meta.env.VITE_APP_API_URL}/person-types/`).then((res) => setPersonTypes(res.data));
    axios
      .get(`${import.meta.env.VITE_APP_API_URL}/status-list/`)
      .then((res) => setStatusList(res.data));
  }, []);

  const formik = useFormik({
    initialValues: {
      ...initialValues,
      status: defaultStatus || initialValues.status,
    },
    validationSchema: saveCustomerSchema,
    onSubmit: async (
      values,
      { setStatus, setSubmitting, setTouched, resetForm },
    ) => {
      setTouched({
        first_name: true,
        last_name: true,
        mobile: true,
        email: true,
        gst: true,
        pin: true,
        reason: true,
      });

      setLoading(true);

      try {
        const baseUrl = import.meta.env.VITE_APP_API_URL || "/api";
        const apiBase = baseUrl.endsWith("/")
          ? `${baseUrl}customers`
          : `${baseUrl}/customers`;

        // Create a clean payload with null values for empty strings
        const payload = { ...values } as Record<string, any>;

        // Handle shipping addresses
        const validShippingAddresses = shippingAddresses
          .filter(
            (addr) =>
              addr.address1 &&
              addr.city &&
              addr.state &&
              addr.country &&
              addr.pin
          )
          .map((addr) => ({
            address1: addr.address1,
            address2: addr.address2 || null,
            city: addr.city,
            state: addr.state,
            country: addr.country,
            pin: addr.pin,
            address_type: addr.address_type || 'home',
            is_default: addr.is_default || false
          }));

        // If no shipping addresses but shipping fields are filled, add them
        if (validShippingAddresses.length === 0 && 
            (values.shipping_address1 || values.shipping_city || values.shipping_state || 
             values.shipping_country || values.shipping_pin)) {
          const newAddress = {
            address1: values.shipping_address1 || '',
            address2: values.shipping_address2 || null,
            city: values.shipping_city || '',
            state: values.shipping_state || '',
            country: values.shipping_country || '',
            pin: values.shipping_pin || '',
            address_type: 'home' as const,
            is_default: true
          };
          validShippingAddresses.push(newAddress);
        }

        // Add shipping addresses to payload if any exist
        if (validShippingAddresses.length > 0) {
          payload.shipping_addresses = validShippingAddresses;
        }

        // Set same_as_billing flag
        payload.same_as_billing = sameAsBilling;

        // Remove old shipping fields from payload
        const oldShippingFields = [
          'shipping_address1',
          'shipping_address2',
          'shipping_city',
          'shipping_state',
          'shipping_country',
          'shipping_pin',
        ];
        oldShippingFields.forEach((field) => {
          delete payload[field];
        });

        // Clean up remaining empty strings
        Object.keys(payload).forEach((key) => {
          if (payload[key] === '') {
            payload[key] = null;
          }
        });

        if (customer?.uuid) {
          // Editing existing customer
          const response = await axios.put(`${apiBase}/${customer.uuid}`, payload);
          toast.success("Customer updated successfully");
          onSuccess?.(response.data);
        } else {
          // Creating new customer
          const response = await axios.post(`${apiBase}/`, payload);
          toast.success("Customer created successfully");
          onSuccess?.(response.data);
        }
        onOpenChange(false);
        resetForm({ values: initialValues });
      } catch (err: any) {
        if (err.response?.status === 400 && err.response.data?.error) {
          const errorCode = err.response.data.error;
          let errorMessage = "An error occurred";

          switch (errorCode) {
            case "mobile_exists":
              errorMessage =
                "A customer with this mobile number already exists";
              break;
            case "gst_exists":
              errorMessage = "A customer with this GST number already exists";
              break;
            case "database_error":
              errorMessage =
                "A database error occurred while saving the customer";
              break;
            case "address_type_exists":
              errorMessage = "An address type already exists";
              break;
            default:
              // Check if it's an address type error that should have been caught by modal validation
              if (
                err.response.data.error &&
                err.response.data.error.includes("address type")
              ) {
                errorMessage = "Address type validation failed";
              } else {
                errorMessage =
                  err.response.data.error || "An unexpected error occurred";
              }
          }

          toast.error(errorMessage);
          setStatus(errorMessage);
        } else {
          const errorMessage = err.message?.includes("Network Error")
            ? "Network error. Please check your connection and try again."
            : "Failed to save customer. Please try again.";

          toast.error(errorMessage);
          setStatus(errorMessage);
        }
      } finally {
        setSubmitting(false);
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    if (!open) {
      formik.resetForm();
    }
  }, [open]);

  // useEffect(() => {
  //     if (open && customer) {
  //         formik.resetForm({ values: { ...customer } });
  //         setSameAsBilling(!!customer?.shipping_address1);
  //     } else if (open && personTypes.length > 0 && statusList.length > 0) {
  //         const customerType = personTypes.find((t) => t.name.toLowerCase() === "customer");
  //         const winStatus = statusList.find((s) => s.name.toLowerCase() === "win");
  //         formik.resetForm({
  //             values: {
  //                 ...initialValues,
  //                 person_type_id: customerType ? customerType.id.toString() : "",
  //                 status: winStatus ? winStatus.id.toString() : "",
  //             },
  //         });
  //     }
  // }, [open, customer, personTypes, statusList]);
  useEffect(() => {
    if (open && customer) {
      // Create a copy of customer data to avoid mutating the original
      const customerData = { ...customer };

      // If there are shipping addresses, use the most recent one
      // if (customer.shipping_addresses && customer.shipping_addresses.length > 0) {
      //     // Sort by created_at to get the most recent address
      //     const latestAddress = [...customer.shipping_addresses]
      //         .sort((a, b) =>
      //             new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      //         )[0];

      //     // Map to form fields
      //     customerData.shipping_address1 = latestAddress.address1;
      //     customerData.shipping_address2 = latestAddress.address2 || '';
      //     customerData.shipping_city = latestAddress.city;
      //     customerData.shipping_state = latestAddress.state;
      //     customerData.shipping_country = latestAddress.country;
      //     customerData.shipping_pin = latestAddress.pin;
      // }

      // Check if shipping is different from billing - only if shipping actually exists
      const hasDifferentShipping =
        (customerData.shipping_address1 &&
          customerData.shipping_address1 !== customerData.address1) ||
        (customerData.shipping_city &&
          customerData.shipping_city !== customerData.city) ||
        (customerData.shipping_state &&
          customerData.shipping_state !== customerData.state) ||
        (customerData.shipping_country &&
          customerData.shipping_country !== customerData.country) ||
        (customerData.shipping_pin &&
          customerData.shipping_pin !== customerData.pin);

      // Only set sameAsBilling to false if there are actual different shipping addresses
      // If no shipping addresses exist, keep sameAsBilling as true (default behavior)
      const hasAnyShippingAddress =
        customerData.shipping_address1 || customerData.shipping_city;
      setSameAsBilling(!hasAnyShippingAddress || !hasDifferentShipping);

      // Reset form with the transformed data
      formik.resetForm({
        values: {
          ...initialValues,
          ...customerData,
        },
      });
    } else if (open && personTypes.length > 0 && statusList.length > 0) {
      // For new customer - use default sameAsBilling (true)
      const customerType = personTypes.find(
        (t) => t.name.toLowerCase() === "customer",
      );
      const winStatus = statusList.find((s) => s.name.toLowerCase() === "win");
      formik.resetForm({
        values: {
          ...initialValues,
          person_type_id: customerType ? customerType.id.toString() : "",
          status: winStatus ? winStatus.id.toString() : "",
        },
      });
    }
  }, [open, customer, personTypes, statusList]);

  // useEffect(() => {
  //     if (sameAsBilling) {
  //         formik.setFieldValue("shipping_address1", formik.values.address1);
  //         formik.setFieldValue("shipping_address2", formik.values.address2);
  //         formik.setFieldValue("shipping_country", formik.values.country);
  //         formik.setFieldValue("shipping_state", formik.values.state);
  //         formik.setFieldValue("shipping_city", formik.values.city);
  //         formik.setFieldValue("shipping_pin", formik.values.pin);
  //     }
  // }, [sameAsBilling, formik.values]);
  // useEffect(() => {
  //     if (sameAsBilling) {
  //         // Use setValues with a function to ensure we have the latest state
  //         formik.setValues(prev => ({
  //             ...prev,
  //             shipping_address1: prev.address1,
  //             shipping_address2: prev.address2 || '',
  //             shipping_city: prev.city,
  //             shipping_state: prev.state,
  //             shipping_country: prev.country,
  //             shipping_pin: prev.pin || '',
  //         }));
  //     }
  //     // Only include the specific values we care about in the dependency array
  // }, [sameAsBilling, formik.values.address1, formik.values.city, formik.values.state, formik.values.country, formik.values.pin]);

  return (
    <Fragment>
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="container-fixed max-w-[900px] p-0 rounded-lg shadow-lg z-50 max-h-[95vh] flex flex-col">
          <DialogHeader className="bg-gray-50 p-6 border-b rounded-t-lg">
            <DialogTitle className="text-lg font-semibold text-gray-800">
              {title || (customer ? "Edit Customer" : "Add Customer")}
            </DialogTitle>
            <DialogClose
              onClick={() => handleDialogClose(false)}
              className="right-2 top-1 rounded-sm opacity-70"
            />
          </DialogHeader>
          <DialogBody className="p-6 flex-1">
            <form
              noValidate
              onSubmit={formik.handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
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
                  {...formik.getFieldProps("first_name")}
                  className="input"
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
                  {...formik.getFieldProps("last_name")}
                  className="input"
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
                  className={clsx("input", {
                    "border-red-500 focus:ring-red-500 focus:border-red-500":
                      formik.touched.mobile && formik.errors.mobile,
                  })}
                  type="text"
                  inputMode="tel"
                  onChange={(e) => {
                    // Allow numbers and hyphens, but not more than one hyphen in a row
                    let value = e.target.value.replace(/[^0-9-]/g, "");
                    value = value.replace(/--+/g, "-");

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
                    if (
                      e.key === "-" &&
                      (formik.values.mobile.length === 0 ||
                        formik.values.mobile.endsWith("-"))
                    ) {
                      e.preventDefault();
                    }
                  }}
                  onBlur={() => {
                    formik.setFieldTouched("mobile", true);
                    // If both mobile and email are empty, validate email as well
                    if (!formik.values.mobile && !formik.values.email) {
                      formik.setFieldTouched("email", true);
                      formik.validateField("email");
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
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input {...formik.getFieldProps("email")} className="input" />
                {formik.touched.email && formik.errors.email && (
                  <span role="alert" className="text-xs text-red-500">
                    {formik.errors.email}
                  </span>
                )}
              </div>
              {/* GST */}
              <div className="flex flex-col gap-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  GST
                </label>
                <input {...formik.getFieldProps("gst")} className="input" />
                {formik.touched.gst && formik.errors.gst && (
                  <span role="alert" className="text-xs text-red-500">
                    {formik.errors.gst}
                  </span>
                )}
              </div>
              {/* Status */}
              {!hideStatusField && (
                <div className="flex flex-col gap-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select {...formik.getFieldProps("status")} className="input">
                    {statusList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(() => {
                const selectedStatus = formik.values.status;
                if (selectedStatus === "4") {
                  return (
                    <>
                      {/* Billing Address Fields */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">
                          Billing Address 1{" "}
                          <span style={{ color: "red" }}>*</span>
                        </label>
                        <input
                          {...formik.getFieldProps("address1")}
                          className="input"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">
                          Billing Address 2
                        </label>
                        <input
                          {...formik.getFieldProps("address2")}
                          className="input"
                        />
                      </div>
                      {/* Country */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">
                          Country<span style={{ color: "red" }}>*</span>
                        </label>
                        <select
                          {...formik.getFieldProps("country")}
                          onChange={(e) => {
                            formik.setFieldValue("country", e.target.value);
                            formik.setFieldValue("state", "");
                            formik.setFieldValue("city", "");
                          }}
                          className="input"
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
                          State<span style={{ color: "red" }}>*</span>
                        </label>
                        <select
                          {...formik.getFieldProps("state")}
                          onChange={(e) => {
                            formik.setFieldValue("state", e.target.value);
                            formik.setFieldValue("city", "");
                          }}
                          disabled={!formik.values.country}
                          className="input"
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
                      </div>
                      {/* City */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">
                          City<span style={{ color: "red" }}>*</span>
                        </label>
                        <select
                          {...formik.getFieldProps("city")}
                          disabled={!formik.values.state}
                          className="input"
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
                      </div>
                      {/* Pin Code */}
                      <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-gray-700">
                          Pin Code <span style={{ color: "red" }}>*</span>
                        </label>
                        <input
                          {...formik.getFieldProps("pin")}
                          className="input"
                        />
                        {formik.touched.pin && formik.errors.pin && (
                          <span role="alert" className="text-xs text-red-500">
                            {formik.errors.pin}
                          </span>
                        )}
                      </div>
                      {/* Same as Billing Checkbox */}
                      {!hideSameAsBilling && (
                        <div className="flex items-center gap-2 col-span-full">
                          <input
                            type="checkbox"
                            id="sameAsBilling"
                            checked={sameAsBilling}
                            onChange={(e) => setSameAsBilling(e.target.checked)}
                          />
                          <label
                            htmlFor="sameAsBilling"
                            className="text-sm font-medium text-gray-700"
                          >
                            Shipping Address is same as Billing Address
                          </label>
                        </div>
                      )}
                      {/* Shipping Address Section */}
                      {(!sameAsBilling || hideSameAsBilling) && (
                        <div className="col-span-full mt-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-md font-semibold text-gray-900">
                              Shipping Addresses
                            </h3>
                            {shippingAddresses.length < 3 && (
                              <button
                                type="button"
                                onClick={addShippingAddress}
                                className="flex items-center text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                <svg
                                  className="w-4 h-4 mr-1"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                  />
                                </svg>
                                Add New Address
                              </button>
                            )}
                            {shippingAddresses.length >= 3 && (
                              <span className="text-sm text-gray-400">
                                Maximum <span>3</span> addresses allowed
                              </span>
                            )}
                          </div>
                          <ShippingAddressList
                            addresses={shippingAddresses}
                            onEdit={(uuid) => handleEditAddress(uuid)}
                            onDelete={(uuid) => handleDeleteAddress(uuid)}
                            onSetDefault={(uuid) =>
                              setDefaultShippingAddress(uuid)
                            }
                          />
                        </div>
                      )}
                    </>
                  );
                }
                if (selectedStatus === "5") {
                  return (
                    <div className="flex flex-col gap-1.5 col-span-full">
                      <label className="block text-sm font-medium text-gray-700">
                        Reason<span style={{ color: "red" }}>*</span>
                      </label>
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
                  );
                }
                return null;
              })()}
              <div className="col-span-full flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => handleDialogClose(false)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-gray-100 text-gray-800 border hover:bg-gray-200 h-10 px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || formik.isSubmitting}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-blue-600 text-white btn-primary hover:bg-blue-500 h-10 px-4 py-2"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Shipping Address Modal */}
      <ShippingAddressModal
        open={addressModalOpen}
        onOpenChange={setAddressModalOpen}
        address={editingAddress}
        onSave={handleSaveAddress}
        existingAddresses={shippingAddresses}
      />

      {/* Unsaved Changes Confirmation Dialog */}
      <Dialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col rounded-2xl p-0 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b sticky top-0 bg-white z-10">
            <DialogTitle className="text-base font-semibold text-gray-900">
              Unsaved Changes
            </DialogTitle>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* <p className="text-sm text-gray-700 leading-relaxed">
                            You have unsaved shipping address changes.  <br />
                            Would you like to save these changes before closing?
                        </p> */}
            <p className="text-sm text-gray-500 mt-1">
              You have unsaved changes in the shipping address.
            </p>

            <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Your changes will be lost if you don't save them. <br /> Click on save before leaving the page.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0 z-10">
            <button
              type="button"
              onClick={handleCancelClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={handleDiscardChanges}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none"
            >
              Leave Changes
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Fragment>
  );
};

export { ModalCustomer };
