import { useState, useEffect } from "react";
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
import { createItem } from "../../pages/items/services/items.service";

// Define the props for the modal
interface ICreateItemModalProps {
    open: boolean;
    onOpenChange: () => void;
    onSuccess: () => void;
    item: any | null;
}

// Initial values for the form
const initialValues = {
    item_type_id: 1,
    category_id: 1,
    item_name: "",
    sales_price: "",
    gst_tax_rate: "",
    measuring_unit: "PCS",
    opening_stock: "",
    show_in_online_store: false,
};

// Validation schema
const saveItemSchema = Yup.object().shape({
    item_name: Yup.string()
        .min(3, "Minimum 3 symbols")
        .max(50, "Maximum 50 symbols")
        .required("Item name is required"),
    sales_price: Yup.number().required("Sales price is required"),
    gst_tax_rate: Yup.number(),
    opening_stock: Yup.number(),
});

export default function CreateItemModal({
    open,
    onOpenChange,
    onSuccess,
    item,
}: ICreateItemModalProps) {
    const [loading, setLoading] = useState(false);

    // Formik setup
    const formik = useFormik({
        initialValues,
        validationSchema: saveItemSchema,
        onSubmit: async (values, { setStatus, setSubmitting }) => {
            setLoading(true);
            try {
                const postData = {
                    item_name: values.item_name,
                    item_type_id: values.item_type_id,
                    category_id: values.category_id,
                    sales_price: Number(values.sales_price),
                    gst_tax_rate: Number(values.gst_tax_rate),
                    measuring_unit: values.measuring_unit,
                    opening_stock: Number(values.opening_stock),
                    show_in_online_store: values.show_in_online_store,
                };

                await createItem(postData);
                onSuccess();
                onOpenChange();
            } catch (error) {
                console.error(error);
                setStatus("Failed to create item");
            } finally {
                setSubmitting(false);
                setLoading(false);
            }
        },
    });

    // Reset form when editing an item
    useEffect(() => {
        if (open && item) {
            formik.resetForm({
                values: {
                    item_type_id: item.item_type_id || 1,
                    category_id: item.category_id || 1,
                    item_name: item.item_name || "",
                    sales_price: item.sales_price || "",
                    gst_tax_rate: item.gst_tax_rate || "",
                    measuring_unit: item.measuring_unit || "PCS",
                    opening_stock: item.opening_stock || "",
                    show_in_online_store: item.show_in_online_store || false,
                },
            });
        } else if (open && !item) {
            formik.resetForm();
        }
    }, [open, item]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[900px] p-0 rounded-lg shadow-lg">
                <DialogHeader className="bg-gray-50 p-6 border-b">
                    <DialogTitle className="text-lg font-semibold text-gray-800">
                        {item ? "Edit Item" : "Create New Item"}
                    </DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <div className="flex">
                        {/* Left Sidebar */}
                        <div className="w-64 p-4 bg-gray-50 border-r">
                            <div className="bg-purple-100 text-purple-800 p-2 rounded mb-4">
                                <button>
                                    Basic Details *
                                </button>      
                            </div>
                            <h2>Advance Details</h2>
                            <div className="text-gray-500 p-2 mb-2">
                                <button>Stock Details</button> 
                                </div>
                            <div className="text-gray-500 p-2 mb-2">Pricing Details</div>
                            <div className="text-gray-500 p-2">Custom Fields</div>
                        </div>

                        {/* Right Form Section */}
                        <div className="flex-1 p-6">
                            <form onSubmit={formik.handleSubmit} className="space-y-4">
                                {formik.status && (
                                    <Alert variant="danger" className="mb-4">
                                        {formik.status}
                                    </Alert>
                                )}

                                {/* Item Type */}
                                <div className="flex items-center gap-6 mb-4">
                                    <label className="font-medium">Item Type *</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="radio"
                                                checked={formik.values.item_type_id === 1}
                                                onChange={() => formik.setFieldValue("item_type_id", 1)}
                                            />
                                            Product
                                        </label>
                                        <label className="flex items-center gap-1">
                                            <input
                                                type="radio"
                                                checked={formik.values.item_type_id === 2}
                                                onChange={() => formik.setFieldValue("item_type_id", 2)}
                                            />
                                            Service
                                        </label>
                                    </div>
                                </div>

                                {/* Item Name and Category */}
                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium mb-1">
                                            Item Name *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="ex: Maggie 20gm"
                                            className={clsx(
                                                "w-full p-2 border rounded",
                                                {
                                                    "border-red-500":
                                                        formik.touched.item_name && formik.errors.item_name,
                                                }
                                            )}
                                            {...formik.getFieldProps("item_name")}
                                        />
                                        {formik.touched.item_name && formik.errors.item_name && (
                                            <div className="text-red-500 text-xs mt-1">
                                                {formik.errors.item_name}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium mb-1">
                                            Category
                                        </label>
                                        <select
                                            className="w-full p-2 border rounded"
                                            {...formik.getFieldProps("category_id")}
                                        >
                                            <option value="">Select Category</option>
                                            <option value="1">Category 1</option>
                                            <option value="2">Category 2</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Show Item in Online Store */}
                                <div className="flex items-center gap-2 mb-4">
                                    <label className="font-medium">Show Item in Online Store</label>
                                    <input
                                        type="checkbox"
                                        {...formik.getFieldProps("show_in_online_store")}
                                    />
                                </div>

                                {/* Sales Price and GST Tax Rate */}
                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium mb-1">
                                            Sales Price
                                        </label>
                                        <div className="flex">
                                            
                                            <input 
                                                type="number"
                                                placeholder="ex: ₹200"
                                                className={clsx(
                                                    "flex-1 p-2 border rounded-r",
                                                    {
                                                        "border-red-500":
                                                            formik.touched.sales_price && formik.errors.sales_price,
                                                    }
                                                )}
                                                {...formik.getFieldProps("sales_price")}
                                            />
                                            <select
                                                className="border-0 px-3 bg-white focus:outline-none"
                                                {...formik.getFieldProps("tax_type")}
                                            >
                                                <option value="with_tax">With Tax</option>
                                                <option value="without_tax">Without Tax</option>
                                            </select>

                                        </div>
                                        {formik.touched.sales_price && formik.errors.sales_price && (
                                            <div className="text-red-500 text-xs mt-1">
                                                {formik.errors.sales_price}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium mb-1">
                                            GST Tax Rate(%)
                                        </label>
                                        <select
                                            className="w-full p-2 border rounded"
                                            {...formik.getFieldProps("gst_tax_rate")}
                                        >
                                            <option value="">None</option>
                                            <option value="5">5%</option>
                                            <option value="12">12%</option>
                                            <option value="18">18%</option>
                                            <option value="28">28%</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Measuring Unit and Opening Stock */}
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium mb-1">
                                            Measuring Unit
                                        </label>
                                        <select
                                            className="w-full p-2 border rounded"
                                            {...formik.getFieldProps("measuring_unit")}
                                        >
                                            <option value="PCS">Pieces (PCS)</option>
                                            <option value="KG">Kilogram</option>
                                            <option value="L">Liter</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium mb-1">
                                            Opening Stock
                                        </label>
                                        <div className="flex">
                                            <input
                                                type="number"
                                                placeholder="ex: 150 PCS"
                                                className="flex-1 p-2 border rounded"
                                                {...formik.getFieldProps("opening_stock")}
                                            />
                                            <span className="p-2 border rounded-r bg-gray-100">
                                                {formik.values.measuring_unit}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Buttons */}
                                <div className="flex justify-end gap-4 mt-6">
                                    <button
                                        type="button"
                                        onClick={onOpenChange}
                                        className="px-4 py-2 bg-gray-200 rounded"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded"
                                        disabled={loading || formik.isSubmitting}
                                    >
                                        {loading ? "Saving..." : "Save"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}
