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
import { Alert } from "@/components";
import axios from "axios";
import { DialogClose } from "@radix-ui/react-dialog";
import { Country, State, City } from "country-state-city";
import { toast } from "sonner";

interface IModalCustomerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    customer: Person | null;
    defaultStatus?: string;
    title?: string; // Optional custom title for the dialog
    hideStatusField?: boolean;
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
            'mobile-or-email',
            'Either Mobile or Email is required',
            function (value) {
                const { email } = this.parent;
                if (!value && !email) {
                    return this.createError({
                        path: "email",
                        message: "Either Mobile or Email is required",
                    });
                }
                return true;
            }
        )
        .test(
            'mobile-format',
            'Mobile number must be a valid 10-digit number',
            function (value) {
                if (!value) return true;

                const digitsOnly = value.replace(/-/g, '');
                return digitsOnly.length === 10 && /^\d{10}$/.test(digitsOnly);
            }
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
            }
        )
        .trim().matches(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,"Invalid email format"),

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
        then: (schema) =>
            schema.required("Reason is required when status is Lose"),
        otherwise: (schema) => schema.nullable(),
    }),
});



const ModalCustomer = ({ open, onOpenChange, onSuccess, customer, title, defaultStatus, hideStatusField = false }: IModalCustomerProps) => {
    const [loading, setLoading] = useState(false);
    const [personTypes, setPersonTypes] = useState<PersonType[]>([]);
    const [statusList, setStatusList] = useState<Status[]>([]);
    const [sameAsBilling, setSameAsBilling] = useState<boolean>(true);

    useEffect(() => {
        // axios.get(`${import.meta.env.VITE_APP_API_URL}/person-types/`).then((res) => setPersonTypes(res.data));
        axios.get(`${import.meta.env.VITE_APP_API_URL}/status-list/`).then((res) => setStatusList(res.data));
    }, []);

    const formik = useFormik({
        initialValues: {
            ...initialValues,
            status: defaultStatus || initialValues.status,
        },
        validationSchema: saveCustomerSchema,
        onSubmit: async (values, { setStatus, setSubmitting, setTouched, resetForm }) => {
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
                
                // Prepare shipping addresses array
                const shippingAddress = {} as Record<string, any>;
                let hasShippingAddress = false;
                
                // Extract shipping address fields and remove them from the main payload
                const shippingFields = [
                    'shipping_address1', 'shipping_address2', 'shipping_city',
                    'shipping_state', 'shipping_country', 'shipping_pin'
                ];
                
                // Check if any shipping field has a value
                shippingFields.forEach(field => {
                    if (values[field as keyof typeof values]) {
                        hasShippingAddress = true;
                    }
                });
                
                // If we have shipping data, format it correctly
                if (hasShippingAddress) {
                    shippingAddress.address1 = values.shipping_address1 || null;
                    shippingAddress.address2 = values.shipping_address2 || null;
                    shippingAddress.city = values.shipping_city || null;
                    shippingAddress.state = values.shipping_state || null;
                    shippingAddress.country = values.shipping_country || null;
                    shippingAddress.pin = values.shipping_pin || null;
                    shippingAddress.is_default = true;
                    
                    // Add to payload as an array
                    payload.shipping_addresses = [shippingAddress];
                }
                
                // Remove the old shipping fields from payload
                shippingFields.forEach(field => {
                    delete payload[field];
                });
                
                // Clean up remaining empty strings
                Object.keys(payload).forEach((key) => {
                    if (payload[key] === "") {
                        payload[key] = null;
                    }
                });

                if (customer?.uuid) {
                    // Editing existing customer
                    await axios.put(`${apiBase}/${customer.uuid}`, payload);
                    toast.success('Customer updated successfully');
                } else {
                    // Creating new customer
                    await axios.post(`${apiBase}/`, payload);
                    toast.success('Customer created successfully');
                }

                onSuccess?.();
                onOpenChange(false);
                resetForm({ values: initialValues });

            } catch (err: any) {

                if (err.response?.status === 400 && err.response.data?.error) {
                    const errorCode = err.response.data.error;
                    let errorMessage = "An error occurred";

                    switch (errorCode) {
                        case 'mobile_exists':
                            errorMessage = "A customer with this mobile number already exists";
                            break;
                        case 'gst_exists':
                            errorMessage = "A customer with this GST number already exists";
                            break;
                        case 'database_error':
                            errorMessage = "A database error occurred while saving the customer";
                            break;
                        default:
                            errorMessage = err.response.data.error || "An unexpected error occurred";
                    }

                    toast.error(errorMessage);
                    setStatus(errorMessage);
                } else {
                    const errorMessage = err.message?.includes('Network Error')
                        ? "Network error. Please check your connection and try again."
                        : "Failed to save customer. Please try again.";

                    toast.error(errorMessage);
                    setStatus(errorMessage);
                }
            } finally {
                setSubmitting(false);
                setLoading(false);
            }
        }
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
            if (customer.shipping_addresses && customer.shipping_addresses.length > 0) {
                // Sort by created_at to get the most recent address
                const latestAddress = [...customer.shipping_addresses]
                    .sort((a, b) => 
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )[0];
                
                // Map to form fields
                customerData.shipping_address1 = latestAddress.address1;
                customerData.shipping_address2 = latestAddress.address2 || '';
                customerData.shipping_city = latestAddress.city;
                customerData.shipping_state = latestAddress.state;
                customerData.shipping_country = latestAddress.country;
                customerData.shipping_pin = latestAddress.pin;
            }

            // Check if shipping is different from billing
            const hasDifferentShipping =
                (customerData.shipping_address1 && customerData.shipping_address1 !== customerData.address1) ||
                (customerData.shipping_city && customerData.shipping_city !== customerData.city) ||
                (customerData.shipping_state && customerData.shipping_state !== customerData.state) ||
                (customerData.shipping_country && customerData.shipping_country !== customerData.country) ||
                (customerData.shipping_pin && customerData.shipping_pin !== customerData.pin);

            setSameAsBilling(!hasDifferentShipping);

            // Reset form with the transformed data
            formik.resetForm({
                values: {
                    ...initialValues,
                    ...customerData,
                }
            });
        } else if (open && personTypes.length > 0 && statusList.length > 0) {
            // For new customer
            setSameAsBilling(true);
            const customerType = personTypes.find((t) => t.name.toLowerCase() === "customer");
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
    useEffect(() => {
        if (sameAsBilling) {
            // Use setValues with a function to ensure we have the latest state
            formik.setValues(prev => ({
                ...prev,
                shipping_address1: prev.address1,
                shipping_address2: prev.address2 || '',
                shipping_city: prev.city,
                shipping_state: prev.state,
                shipping_country: prev.country,
                shipping_pin: prev.pin || '',
            }));
        }
        // Only include the specific values we care about in the dependency array
    }, [sameAsBilling, formik.values.address1, formik.values.city, formik.values.state, formik.values.country, formik.values.pin]);

    return (
        <Fragment>
            <Dialog open={open} onOpenChange={(isOpen) => {
                if (!isOpen) {
                    formik.resetForm();
                }
                onOpenChange(isOpen);
            }}>
                <DialogContent className="container-fixed max-w-[900px] p-0 rounded-lg shadow-lg">
                    <DialogHeader className="bg-gray-50 p-6 border-b">
                        <DialogTitle className="text-lg font-semibold text-gray-800">
                            {title || (customer ? "Edit Customer" : "Add Customer")}
                        </DialogTitle>
                        <DialogClose onClick={() => onOpenChange(false)} className="right-2 top-1 rounded-sm opacity-70" />
                    </DialogHeader>
                    <DialogBody className="p-6">
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
                                <input {...formik.getFieldProps("first_name")} className="input" />
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
                                <input {...formik.getFieldProps("last_name")} className="input" />
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
                                            formik.touched.mobile && formik.errors.mobile
                                    })}
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
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input {...formik.getFieldProps("email")} className="input" />
                                {formik.touched.email && formik.errors.email && (
                                    <span role="alert" className="text-xs text-red-500">
                                        {formik.errors.email}
                                    </span>
                                )}
                            </div>
                            {/* GST */}
                            <div className="flex flex-col gap-1.5">
                                <label className="block text-sm font-medium text-gray-700">GST</label>
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
                                    <label className="block text-sm font-medium text-gray-700">Status</label>
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
                                                    Billing Address 1 <span style={{ color: "red" }}>*</span>
                                                </label>
                                                <input {...formik.getFieldProps("address1")} className="input" />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    Billing Address 2
                                                </label>
                                                <input {...formik.getFieldProps("address2")} className="input" />
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
                                                            formik.values.state
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
                                                <input {...formik.getFieldProps("pin")} className="input" />
                                                {formik.touched.pin && formik.errors.pin && (
                                                    <span role="alert" className="text-xs text-red-500">
                                                        {formik.errors.pin}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Same as Billing Checkbox */}
                                            <div className="flex items-center gap-2 col-span-full">
                                                <input
                                                    type="checkbox"
                                                    id="sameAsBilling"
                                                    checked={sameAsBilling}
                                                    onChange={(e) => setSameAsBilling(e.target.checked)}
                                                />
                                                <label htmlFor="sameAsBilling" className="text-sm font-medium text-gray-700">
                                                    Shipping Address is same as Billing Address
                                                </label>
                                            </div>
                                            {/* Shipping Address Fields (Conditional) */}
                                            {!sameAsBilling && (
                                                <>
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Shipping Address 1 <span style={{ color: "red" }}>*</span>
                                                        </label>
                                                        <input 
                                                            {...formik.getFieldProps("shipping_address1")} 
                                                            className="input" 
                                                            readOnly={!!customer}
                                                            style={{ backgroundColor: customer ? '#f3f4f6' : 'white' }}
                                                        />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Shipping Address 2
                                                        </label>
                                                        <input 
                                                            {...formik.getFieldProps("shipping_address2")} 
                                                            className="input" 
                                                            readOnly={!!customer}
                                                            style={{ backgroundColor: customer ? '#f3f4f6' : 'white' }}
                                                        />
                                                    </div>
                                                    {/* Shipping Country */}
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Shipping Country<span style={{ color: "red" }}>*</span>
                                                        </label>
                                                        <select
                                                            {...formik.getFieldProps("shipping_country")}
                                                            onChange={(e) => {
                                                                if (!customer) {
                                                                    formik.setFieldValue("shipping_country", e.target.value);
                                                                    formik.setFieldValue("shipping_state", "");
                                                                    formik.setFieldValue("shipping_city", "");
                                                                }
                                                            }}
                                                            className="input"
                                                            disabled={!!customer}
                                                            style={{ 
                                                                backgroundColor: customer ? '#f3f4f6' : 'white',
                                                                color: customer ? '#6b7280' : 'inherit',
                                                                cursor: customer ? 'not-allowed' : 'default'
                                                            }}
                                                        >
                                                            <option value="">--Select Country--</option>
                                                            {Country.getAllCountries().map((c) => (
                                                                <option key={c.isoCode} value={c.isoCode}>
                                                                    {c.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {/* Shipping State */}
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Shipping State<span style={{ color: "red" }}>*</span>
                                                        </label>
                                                        <select
                                                            {...formik.getFieldProps("shipping_state")}
                                                            onChange={(e) => {
                                                                if (!customer) {
                                                                    formik.setFieldValue("shipping_state", e.target.value);
                                                                    formik.setFieldValue("shipping_city", "");
                                                                }
                                                            }}
                                                            disabled={!formik.values.shipping_country || !!customer}
                                                            className="input"
                                                            style={{ 
                                                                backgroundColor: customer ? '#f3f4f6' : 'white',
                                                                color: customer ? '#6b7280' : 'inherit',
                                                                cursor: customer ? 'not-allowed' : 'default'
                                                            }}
                                                        >
                                                            <option value="">--Select State--</option>
                                                            {formik.values.shipping_country &&
                                                                State.getStatesOfCountry(formik.values.shipping_country).map((s) => (
                                                                    <option key={s.isoCode} value={s.isoCode}>
                                                                        {s.name}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                    {/* Shipping City */}
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Shipping City<span style={{ color: "red" }}>*</span>
                                                        </label>
                                                        <select
                                                            {...formik.getFieldProps("shipping_city")}
                                                            disabled={!formik.values.shipping_state || !!customer}
                                                            className="input"
                                                            style={{ 
                                                                backgroundColor: customer ? '#f3f4f6' : 'white',
                                                                color: customer ? '#6b7280' : 'inherit',
                                                                cursor: customer ? 'not-allowed' : 'default'
                                                            }}
                                                        >
                                                            <option value="">--Select City--</option>
                                                            {formik.values.shipping_country &&
                                                                formik.values.shipping_state &&
                                                                City.getCitiesOfState(
                                                                    formik.values.shipping_country,
                                                                    formik.values.shipping_state
                                                                ).map((city) => (
                                                                    <option key={city.name} value={city.name}>
                                                                        {city.name}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                    {/* Shipping Pin Code */}
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Shipping Pin Code <span style={{ color: "red" }}>*</span>
                                                        </label>
                                                        <input 
                                                            {...formik.getFieldProps("shipping_pin")} 
                                                            className="input" 
                                                            readOnly={!!customer}
                                                            style={{ backgroundColor: customer ? '#f3f4f6' : 'white' }}
                                                        />
                                                        {formik.touched.shipping_pin && formik.errors.shipping_pin && (
                                                            <span role="alert" className="text-xs text-red-500">
                                                                {formik.errors.shipping_pin}
                                                            </span>
                                                        )}
                                                    </div>
                                                </>
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
                                    onClick={() => onOpenChange(false)}
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
        </Fragment>
    );
};

export { ModalCustomer };


