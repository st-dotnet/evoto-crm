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
    onOpenChange: (open: boolean) => void; // Update this line
    onSuccess?: () => void;
    customer: Person | null;
}

interface PersonType {
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
    person_type_id: string;
    status: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    country?: string;
    pin?: string;
    reason?: string;
    // Shipping address fields
    shipping_address1?: string;
    shipping_address2?: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_country?: string;
    shipping_pin?: string;
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
    mobile: Yup.string().when("email", {
        is: (email: string) => !email,
        then: (schema) =>
            schema
                .required("Mobile or Email is required")
                .test(
                    "mobile-length",
                    "Mobile number must be exactly 10 digits",
                    (value) => !!value && value.length === 10
                ),
        otherwise: (schema) =>
            schema.test(
                "mobile-length",
                "Mobile number must be exactly 10 digits",
                (value) => !value || value.length === 10
            ),
    }),

    email: Yup.string().email("Invalid email"),
    gst: Yup.string().min(15).max(15),
    pin: Yup.string().matches(/^[0-9]+$/, "Pin must be a number"),
    shipping_pin: Yup.string().matches(/^[0-9]+$/, "Pin must be a number"),
    reason: Yup.string().when("status", {
        is: (status: string) => status === "5",
        then: (schema) => schema.required("Reason is required when status is Lose"),
        otherwise: (schema) => schema,
    })
}).test(
    "mobile-or-email",
    "Either Mobile or Email is required",
    function (values) {
        const { mobile, email } = values;
        return !!mobile || !!email;
    }
);


const ModalCustomer = ({ open, onOpenChange, onSuccess, customer }: IModalCustomerProps) => {
    const [loading, setLoading] = useState(false);
    const [personTypes, setPersonTypes] = useState<PersonType[]>([]);
    const [statusList, setStatusList] = useState<Status[]>([]);
    const [sameAsBilling, setSameAsBilling] = useState<boolean>(true);

    useEffect(() => {
        // axios.get(`${import.meta.env.VITE_APP_API_URL}/person-types/`).then((res) => setPersonTypes(res.data));
        axios.get(`${import.meta.env.VITE_APP_API_URL}/status-list/`).then((res) => setStatusList(res.data));
    }, []);

const formik = useFormik({
    initialValues,
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
            const apiBase = baseUrl.endsWith("/") ? `${baseUrl}customers` : `${baseUrl}/customers`;

            if (customer?.uuid) {
                await axios.put(`${apiBase}/${customer.uuid}`, values);
            } else {
                await axios.post(`${apiBase}/`, values);
            }

            if (onSuccess) {
                onSuccess(); // Call the onSuccess callback if provided
            }
            onOpenChange(false); // Close the modal
            resetForm({ values: initialValues }); // Reset to initial values
        } catch (err) {
            console.error(err);
            setStatus("Unable to save customer");
            toast.error("Failed to save customer. Please try again.");
            setSubmitting(false);
        } finally {
            setLoading(false);
        }
    },
});



    useEffect(() => {
        if (open && customer) {
            formik.resetForm({ values: { ...customer } });
            setSameAsBilling(!!customer?.shipping_address1);
        } else if (open && personTypes.length > 0 && statusList.length > 0) {
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

    useEffect(() => {
        if (sameAsBilling) {
            formik.setFieldValue("shipping_address1", formik.values.address1);
            formik.setFieldValue("shipping_address2", formik.values.address2);
            formik.setFieldValue("shipping_country", formik.values.country);
            formik.setFieldValue("shipping_state", formik.values.state);
            formik.setFieldValue("shipping_city", formik.values.city);
            formik.setFieldValue("shipping_pin", formik.values.pin);
        }
    }, [sameAsBilling, formik.values]);

    return (
        <Fragment>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="container-fixed max-w-[900px] p-0 rounded-lg shadow-lg">
                    <DialogHeader className="bg-gray-50 p-6 border-b">
                        <DialogTitle className="text-lg font-semibold text-gray-800">
                            {customer ? "Edit Customer" : "Add Customer"}
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
                                    className="input"
                                    type="text"
                                    onChange={(e) => {
                                        // Limit input to 10 digits
                                        const value = e.target.value.slice(0, 10);
                                        // Manually update Formik's state
                                        formik.setFieldValue("mobile", value);
                                    }}
                                />
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
                            {(() => {
                                const selectedStatus = formik.values.status;
                                if (selectedStatus === "4") {
                                    return (
                                        <>
                                            {/* Billing Address Fields */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    Billing Address 1
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
                                                    Pin Code
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
                                                            Shipping Address 1
                                                        </label>
                                                        <input {...formik.getFieldProps("shipping_address1")} className="input" />
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Shipping Address 2
                                                        </label>
                                                        <input {...formik.getFieldProps("shipping_address2")} className="input" />
                                                    </div>
                                                    {/* Shipping Country */}
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Shipping Country<span style={{ color: "red" }}>*</span>
                                                        </label>
                                                        <select
                                                            {...formik.getFieldProps("shipping_country")}
                                                            onChange={(e) => {
                                                                formik.setFieldValue("shipping_country", e.target.value);
                                                                formik.setFieldValue("shipping_state", "");
                                                                formik.setFieldValue("shipping_city", "");
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
                                                    {/* Shipping State */}
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Shipping State<span style={{ color: "red" }}>*</span>
                                                        </label>
                                                        <select
                                                            {...formik.getFieldProps("shipping_state")}
                                                            onChange={(e) => {
                                                                formik.setFieldValue("shipping_state", e.target.value);
                                                                formik.setFieldValue("shipping_city", "");
                                                            }}
                                                            disabled={!formik.values.shipping_country}
                                                            className="input"
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
                                                            disabled={!formik.values.shipping_state}
                                                            className="input"
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
                                                            Shipping Pin Code
                                                        </label>
                                                        <input {...formik.getFieldProps("shipping_pin")} className="input" />
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


