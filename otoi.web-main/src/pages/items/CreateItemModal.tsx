// src/components/CreateItemModal.tsx
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
import StockDetails from "./StockDetails";

// Define types for the item and form values
interface IItem {
    item_type_id?: number;
    category_id?: number;
    item_name?: string;
    sales_price?: string | number;
    gst_tax_rate?: string | number;
    measuring_unit?: string;
    opening_stock?: string | number;
    show_in_online_store?: boolean;
    tax_type?: string;
    item_code?: string;
    hsn_code?: string;
    alternative_unit?: string;
    low_stock_warning?: boolean;
    low_stock_quantity?: number;
    description?: string;
    as_of_date?: string;
}

interface ICategory {
    id: number;
    name: string;
}

interface ICreateItemModalProps {
    open: boolean;
    onOpenChange: () => void;
    onSuccess: () => void;
    item: IItem | null;
}

// Initial values for the form
const initialValues: IItem = {
    item_type_id: 1,
    category_id: 1,
    item_name: "",
    sales_price: "",
    gst_tax_rate: "",
    measuring_unit: "PCS",
    opening_stock: "",
    show_in_online_store: false,
    tax_type: "with_tax",
    item_code: "",
    hsn_code: "",
    alternative_unit: "",
    low_stock_warning: false,
    low_stock_quantity: 0,
    description: "",
    as_of_date: new Date().toISOString().split("T")[0],
};

// Validation schema
const saveItemSchema = Yup.object().shape({
    item_name: Yup.string()
        .min(3, "Minimum 3 symbols")
        .max(50, "Maximum 50 symbols")
        .required("Item name is required"),
    sales_price: Yup.number()
        .typeError("Sales price must be a number")
        .required("Sales price is required"),
    gst_tax_rate: Yup.number().typeError("GST tax rate must be a number"),
    opening_stock: Yup.number().typeError("Opening stock must be a number"),
    low_stock_quantity: Yup.number().typeError("Low stock quantity must be a number"),
});

export default function CreateItemModal({
    open,
    onOpenChange,
    onSuccess,
    item,
}: ICreateItemModalProps) {
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<ICategory[]>([
        { id: 1, name: "SmartPhone" },
        { id: 2, name: "Snacks" },
    ]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategory, setNewCategory] = useState("");
    const [activeSection, setActiveSection] = useState("basic"); // State to track active section

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
                    item_code: values.item_code,
                    hsn_code: values.hsn_code,
                    alternative_unit: values.alternative_unit,
                    low_stock_warning: values.low_stock_warning,
                    low_stock_quantity: Number(values.low_stock_quantity),
                    description: values.description,
                    as_of_date: values.as_of_date,
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
                    tax_type: item.tax_type || "with_tax",
                    item_code: item.item_code || "",
                    hsn_code: item.hsn_code || "",
                    alternative_unit: item.alternative_unit || "",
                    low_stock_warning: item.low_stock_warning || false,
                    low_stock_quantity: item.low_stock_quantity || 0,
                    description: item.description || "",
                    as_of_date: item.as_of_date || new Date().toISOString().split("T")[0],
                },
            });
        } else if (open && !item) {
            formik.resetForm();
        }
    }, [open, item]);

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-[900px] p-0 rounded-lg shadow-lg h-[80vh]">
                    <DialogHeader className="bg-gray-50 p-6 border-b">
                        <DialogTitle className="text-lg font-semibold text-gray-800">
                            {item ? "Edit Item" : "Create New Item"}
                        </DialogTitle>
                    </DialogHeader>
                    <DialogBody className="overflow-y-auto max-h-[70vh]">
                        <div className="flex h-[70vh]">
                            {/* Left Sidebar */}
                            <div className="w-64 p-4 bg-gray-50 border-r overflow-y-auto">
                                <div
                                    className={clsx(
                                        "p-2 rounded mb-4 cursor-pointer",
                                        activeSection === "basic" ? "bg-purple-100 text-purple-800" : "text-gray-500 hover:bg-gray-100"
                                    )}
                                    onClick={() => setActiveSection("basic")}
                                >
                                    <button>Basic Details *</button>
                                </div>
                                <h2 className="text-sm font-medium text-gray-500 mb-2">Advance Details</h2>
                                <div
                                    className={clsx(
                                        "p-2 mb-2 rounded cursor-pointer",
                                        activeSection === "stock" ? "bg-purple-100 text-purple-800" : "text-gray-500 hover:bg-gray-100"
                                    )}
                                    onClick={() => setActiveSection("stock")}
                                >
                                    <button>Stock Details</button>
                                </div>
                                <div className="text-gray-500 p-2 mb-2">Pricing Details</div>
                                <div className="text-gray-500 p-2">Custom Fields</div>
                            </div>

                            {/* Right Form Section */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                <form onSubmit={formik.handleSubmit} className="space-y-4">
                                    {formik.status && (
                                        <Alert variant="danger" className="mb-4">
                                            {formik.status}
                                        </Alert>
                                    )}

                                    {/* Basic Details Section */}
                                    {activeSection === "basic" && (
                                        <>
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
                                                    <label className="block text-sm font-medium mb-1">Item Name *</label>
                                                    <input
                                                        type="text"
                                                        placeholder="ex: Maggie 20gm"
                                                        className={clsx("w-full p-2 border rounded", {
                                                            "border-red-500": formik.touched.item_name && formik.errors.item_name,
                                                        })}
                                                        {...formik.getFieldProps("item_name")}
                                                    />
                                                    {formik.touched.item_name && formik.errors.item_name && (
                                                        <div className="text-red-500 text-xs mt-1">{formik.errors.item_name}</div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-1">Category</label>
                                                    <select
                                                        className="w-full p-2 border rounded"
                                                        value={formik.values.category_id}
                                                        onChange={(e) => {
                                                            if (e.target.value === "add_new") {
                                                                setShowCategoryModal(true);
                                                                return;
                                                            }
                                                            formik.setFieldValue("category_id", Number(e.target.value));
                                                        }}
                                                    >
                                                        <option value="">Select Category</option>
                                                        {categories.map((cat) => (
                                                            <option key={cat.id} value={cat.id}>
                                                                {cat.name}
                                                            </option>
                                                        ))}
                                                        <option value="add_new">+ Add Category</option>
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
                                                    <label className="block text-sm font-medium mb-1">Sales Price</label>
                                                    <div className="flex">
                                                        <input
                                                            type="number"
                                                            placeholder="ex: ₹200"
                                                            className={clsx("flex-1 p-2 border rounded-l", {
                                                                "border-red-500": formik.touched.sales_price && formik.errors.sales_price,
                                                            })}
                                                            {...formik.getFieldProps("sales_price")}
                                                        />
                                                        <select
                                                            className="border-0 px-3 bg-white focus:outline-none rounded-r"
                                                            {...formik.getFieldProps("tax_type")}
                                                        >
                                                            <option value="with_tax">With Tax</option>
                                                            <option value="without_tax">Without Tax</option>
                                                        </select>
                                                    </div>
                                                    {formik.touched.sales_price && formik.errors.sales_price && (
                                                        <div className="text-red-500 text-xs mt-1">{formik.errors.sales_price}</div>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-1">GST Tax Rate(%)</label>
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
                                                    <label className="block text-sm font-medium mb-1">Measuring Unit</label>
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
                                                    <label className="block text-sm font-medium mb-1">Opening Stock</label>
                                                    <div className="flex">
                                                        <input
                                                            type="number"
                                                            placeholder="ex: 150 PCS"
                                                            className="flex-1 p-2 border rounded-l"
                                                            {...formik.getFieldProps("opening_stock")}
                                                        />
                                                        <span className="p-2 border rounded-r bg-gray-100">
                                                            {formik.values.measuring_unit}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Stock Details Section */}
                                    {activeSection === "stock" && <StockDetails formik={formik} />}

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


            {/* CREATE CATEGORY MODAL */}
            <Dialog open={showCategoryModal} onOpenChange={() => setShowCategoryModal(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create New Category</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <input
                            className="w-full p-2 border rounded"
                            placeholder="Ex: Snacks"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                className="px-4 py-2 bg-gray-200 rounded"
                                onClick={() => setShowCategoryModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-blue-600 text-white rounded"
                                disabled={!newCategory}
                                onClick={() => {
                                    const cat = { id: Date.now(), name: newCategory };
                                    setCategories((prev) => [...prev, cat]);
                                    formik.setFieldValue("category_id", cat.id);
                                    setNewCategory("");
                                    setShowCategoryModal(false);
                                }}
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
