// src/components/CreateItemModal.tsx
import { useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import clsx from "clsx";
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components";
import { toast } from "sonner";
import { createItem, createItemCategory, getItemById, getItemCategories, updateItem } from "../../pages/items/services/items.service";
import StockDetails from "./StockDetails";
import PricingDetails from "./PricingDetails";
import OtherDetails from "./OtherDetails";

// Define types for the item and form values
interface IItem {
    id?: number;

    item_type_id: number;
    category_id?: string | null;
    measuring_unit_id: 1 | 2 | 3 | 4;

    item_name: string;
    item_code?: string | null;

    sales_price: number;
    gst_tax_rate: number;

    purchase_price?: number | null;
    opening_stock?: number | null;

    hsn_code?: string | null;
    description?: string | null;
    as_of_date?: string;

    show_in_online_store?: boolean;
    tax_type?: "with_tax" | "without_tax";
    item_id?: number;

}

interface ICategory {
    uuid: string;
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
    category_id: null,
    as_of_date: new Date().toISOString().split('T')[0],
    measuring_unit_id: 1,

    item_name: "",
    item_code: null,

    sales_price: 0,
    gst_tax_rate: 0,

    purchase_price: 0,
    opening_stock: 0,

    hsn_code: null,
    description: null,

    show_in_online_store: false,
    tax_type: "with_tax",
};

// Validation schema
const saveItemSchema = Yup.object().shape({
    item_type_id: Yup.number().required(),

    item_name: Yup.string()
        .min(3, "Minimum 3 symbols")
        .max(50, "Maximum 50 symbols")
        .required("Item name is required"),

    category_id: Yup.string().required("Category is required"),

    sales_price: Yup.number()
        .typeError("Sales price must be a number")
        .required("Sales price is required"),

    gst_tax_rate: Yup.number()
        .nullable()
        .typeError("GST tax rate must be a number"),

    opening_stock: Yup.number().when("item_type_id", {
        is: 1,
        then: (schema) =>
            schema
                .typeError("Opening stock must be a number")
                .required("Opening stock is required"),
        otherwise: (schema) => schema.nullable().notRequired(),
    }),

    purchase_price: Yup.number().when("item_type_id", {
        is: 1,
        then: (schema) =>
            schema
                .typeError("Purchase price must be a number")
                .required("Purchase price is required"),
        otherwise: (schema) => schema.nullable().notRequired(),
    }),
});


export default function CreateItemModal({
    open,
    onOpenChange,
    onSuccess,
    item,
}: ICreateItemModalProps) {
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<ICategory[]>([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategory, setNewCategory] = useState("");
    const [activeSection, setActiveSection] = useState("basic");
    const [isEditing, setIsEditing] = useState(false);

    // Update isEditing when item prop changes
    useEffect(() => {
        setIsEditing(!!item?.id);
    }, [item]);

    // Formik setup
    const formik = useFormik({
        initialValues,
        validationSchema: saveItemSchema,
        enableReinitialize: true,
        onSubmit: async (values, { setStatus, setSubmitting, resetForm }) => {
            setLoading(true);
            const isService = values.item_type_id === 2;

            try {
                const postData: Partial<IItem> = {
                    item_name: values.item_name,
                    item_type_id: values.item_type_id,
                    category_id: values.category_id || null,  // Ensure we send null instead of empty string
                    sales_price: Number(values.sales_price),
                    gst_tax_rate: Number(values.gst_tax_rate),
                    measuring_unit_id: values.measuring_unit_id,
                    purchase_price: isService ? null : Number(values.purchase_price || 0),
                    opening_stock: isService ? null : Number(values.opening_stock || 0),
                    // Only include item_code if it has changed from the original value
                    // ...(values.item_code !== item?.item_code && { item_code: values.item_code || null }),
                    item_code: isService ? values.item_code || null : (values.item_code !== item?.item_code ? values.item_code || null : undefined),
                    hsn_code: isService ? null : values.hsn_code || null,
                    description: values.description || null,
                    show_in_online_store: Boolean(values.show_in_online_store),
                    tax_type: values.tax_type || "with_tax",
                };

                if (item?.item_id) {
                    // EDITING an existing item
                    const response = await updateItem(item?.item_id, postData);
                    if (response?.success) {
                        toast.success("Item updated successfully");
                        onSuccess();
                        onOpenChange();
                    } else {
                        throw new Error(response?.error || "Failed to update item");
                    }
                } else {
                    // Creating a new item
                    const response = await createItem(postData);
                    if (response) {
                        toast.success("Item created successfully");
                        onSuccess();
                        resetForm();
                        onOpenChange();
                    } else {
                        throw new Error("Failed to create item");
                    }
                }
            } catch (error: any) {
                console.error('Error:', error);
                const errorMessage = error?.response?.data?.message || error.message || "An error occurred. Please try again.";
                setStatus(errorMessage);
                toast.error(errorMessage);
            } finally {
                setLoading(false);
                setSubmitting(false);
            }
        }
    });

    useEffect(() => {
        // Only reset the form for new items, not when editing
        if (!isEditing) {
            if (formik.values.item_type_id === 2) { // Service
                formik.resetForm({
                    values: {
                        item_type_id: 2,
                        item_name: "",
                        category_id: null,
                        sales_price: 0,
                        gst_tax_rate: 0,
                        measuring_unit_id: 1,
                        item_code: "",
                        description: null,
                        show_in_online_store: false,
                        tax_type: "with_tax",
                        purchase_price: null,
                        opening_stock: null,
                        hsn_code: null,
                    },
                });
            } else { // Product
                formik.resetForm({
                    values: {
                        item_type_id: 1,
                        item_name: "",
                        category_id: null,
                        sales_price: 0,
                        gst_tax_rate: 0,
                        measuring_unit_id: 1,
                        item_code: null,
                        purchase_price: 0,
                        opening_stock: 0,
                        hsn_code: null,
                        description: null,
                        show_in_online_store: false,
                        tax_type: "with_tax",
                    },
                });
            }
        }
    }, [formik.values.item_type_id, isEditing]);

    // Update the useEffect hook to reset the active section and form values
    useEffect(() => {
        if (open) {
            if (item) {
                // Editing an item
                setIsEditing(true);
                formik.resetForm({
                    values: {
                        item_type_id: item.item_type_id ?? 1,
                        category_id: item.category_id || null,
                        measuring_unit_id: item.measuring_unit_id ?? 1,
                        item_name: item.item_name ?? "",
                        item_code: item.item_code ?? (item.item_type_id === 2 ? "" : null),
                        sales_price: item.sales_price ?? 0,
                        gst_tax_rate: item.gst_tax_rate ?? 0,
                        purchase_price: item.item_type_id === 1 ? item.purchase_price ?? 0 : null,
                        opening_stock: item.item_type_id === 1 ? item.opening_stock ?? 0 : null,
                        hsn_code: item.item_type_id === 1 ? item.hsn_code ?? null : null,
                        description: item.description ?? null,
                        show_in_online_store: item.show_in_online_store ?? false,
                        tax_type: item.tax_type ?? "with_tax",
                    },
                });
            } else {
                // Creating a new item
                setIsEditing(false);
                setActiveSection("basic");
                formik.resetForm({
                    values: {
                        item_type_id: 1, // Default to Product
                        category_id: null,
                        measuring_unit_id: 1,
                        item_name: "",
                        item_code: null, // Reset for products
                        sales_price: 0,
                        gst_tax_rate: 0,
                        purchase_price: 0, // Only for products
                        opening_stock: 0, // Only for products
                        hsn_code: null, // Only for products
                        description: null,
                        show_in_online_store: false,
                        tax_type: "with_tax",
                    },
                });
            }
        } else {
            setActiveSection("basic");
        }
    }, [open, item]);


    // Handle section change
    const handleSectionChange = (section: string) => {
        if (section === "stock" && formik.values.item_type_id === 2) return;
        if (section === "price" && formik.values.item_type_id === 2) return;
        setActiveSection(section);
    };


    // Load categories
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const data = await getItemCategories();
                setCategories(data);
            } catch (error) {
                console.error("Failed to load categories", error);
            }
        };
        if (open) loadCategories();
    }, [open]);

    // // Handle section change
    // const handleSectionChange = (section: string) => {
    //     if (section === "stock" && formik.values.item_type_id === 2) return;
    //     if (section === "price" && formik.values.item_type_id === 2) return;
    //     setActiveSection(section);
    // };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-[900px] p-0 rounded-lg shadow-lg h-[80vh] flex flex-col">
                    <DialogHeader className="bg-gray-50 p-6 border-b">
                        <DialogTitle className="text-lg font-semibold text-gray-800">
                            {item ? "Edit Item" : "Create New Item"}
                        </DialogTitle>
                    </DialogHeader>

                    <DialogBody className="overflow-y-auto max-h-[70vh] flex-1">
                        <div className="flex h-full">
                            {/* Left Sidebar */}
                            <div className="w-64 p-4 bg-gray-50 border-r overflow-y-auto">
                                <div
                                    className={clsx(
                                        "p-2 rounded mb-4 cursor-pointer",
                                        activeSection === "basic" ? "bg-purple-100 text-purple-800" : "text-gray-500 hover:bg-gray-100"
                                    )}
                                    onClick={() => setActiveSection("basic")}
                                >
                                    <button>Basic Details <span className="text-red-500">*</span></button>
                                </div>
                                <h2 className="text-sm font-bold text-black-500 mb-2">Advance Details</h2>
                                {formik.values.item_type_id === 2 ? (
                                    <div
                                        className={clsx(
                                            "p-2 rounded mb-2 cursor-pointer",
                                            activeSection === "other" ? "bg-purple-100 text-purple-800" : "text-gray-500"
                                        )}
                                        onClick={() => setActiveSection("other")}
                                    >
                                        Other Details
                                    </div>
                                ) : (
                                    <>
                                        <div
                                            className={clsx(
                                                "p-2 rounded mb-2 cursor-pointer",
                                                activeSection === "stock" ? "bg-purple-100 text-purple-800" : "text-gray-500"
                                            )}
                                            onClick={() => setActiveSection("stock")}
                                        >
                                            Stock Details
                                        </div>
                                        <div
                                            className={clsx(
                                                "p-2 mb-2 rounded cursor-pointer",
                                                activeSection === "price" ? "bg-purple-100 text-purple-800" : "text-gray-500 hover:bg-gray-100"
                                            )}
                                            onClick={() => setActiveSection("price")}
                                        >
                                            Price Details
                                        </div>
                                    </>
                                )}
                            </div>


                            {/* Right Form Section */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                <form id="item-form" onSubmit={formik.handleSubmit} className="space-y-4">
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
                                                <label className="font-medium">Item Type<span className="text-red-500">*</span></label>
                                                <div className="flex gap-4">
                                                    <label className="flex items-center gap-1">
                                                        <input
                                                            type="radio"
                                                            checked={formik.values.item_type_id === 1}
                                                            onChange={() => formik.setFieldValue("item_type_id", 1)}
                                                            disabled={isEditing} // Disable during edit mode
                                                        />
                                                        Product
                                                    </label>
                                                    <label className="flex items-center gap-1">
                                                        <input
                                                            type="radio"
                                                            checked={formik.values.item_type_id === 2}
                                                            onChange={() => formik.setFieldValue("item_type_id", 2)}
                                                            disabled={isEditing} // Disable during edit mode
                                                        />
                                                        Service
                                                    </label>
                                                </div>
                                            </div>


                                            {/* Item Name or Service Name and Category */}
                                            <div className="flex gap-4 mb-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-1">
                                                        {formik.values.item_type_id === 2 ? (
                                                            <>Service Name <span style={{ color: 'red' }}>*</span></>
                                                        ) : (
                                                            <>Item Name <span style={{ color: 'red' }}>*</span></>
                                                        )}

                                                    </label>
                                                    <input
                                                        type="text"
                                                        placeholder={formik.values.item_type_id === 2 ? "ex: Mobile service" : "ex: Maggie 20gm"}
                                                        className={clsx(
                                                            "w-full p-2 border rounded",
                                                            { "border-red-500": formik.touched.item_name && formik.errors.item_name }
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
                                                        Category <span className="text-red-500">*</span>
                                                    </label>

                                                    <select
                                                        className={`w-full p-2 border rounded ${formik.touched.category_id && formik.errors.category_id
                                                            ? "border-red-500"
                                                            : "border-gray-300"
                                                            }`}
                                                        value={formik.values.category_id || ""}
                                                        onChange={(e) => {
                                                            if (e.target.value === "add_new") {
                                                                setShowCategoryModal(true);
                                                                return;
                                                            }

                                                            formik.setFieldValue("category_id", e.target.value || "");
                                                        }}
                                                        onBlur={formik.handleBlur}
                                                        name="category_id"
                                                    >
                                                        <option value="">Select Category</option>

                                                        {categories.map((cat) => (
                                                            <option key={cat.uuid} value={cat.uuid}>
                                                                {cat.name}
                                                            </option>
                                                        ))}

                                                        <option value="add_new">+ Add Category</option>
                                                    </select>

                                                    {formik.touched.category_id && formik.errors.category_id && (
                                                        <p className="text-red-500 text-xs mt-1">
                                                            {formik.errors.category_id}
                                                        </p>
                                                    )}
                                                </div>

                                            </div>

                                            {/* Show Item in Online Store */}
                                            {/* <div className="flex items-center gap-2 mb-4">
                                                <label className="font-medium">Show Item in Online Store</label>
                                                <input
                                                    type="checkbox"
                                                    {...formik.getFieldProps("show_in_online_store")}
                                                />
                                            </div> */}

                                            {/* Sales Price and GST Tax Rate */}
                                            <div className="flex gap-4 mb-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-1">Sales Price</label>
                                                    <div className="flex">
                                                        <span className="p-2 border rounded-l bg-gray-100">₹</span>
                                                        <input
                                                            type="number"
                                                            placeholder="ex: ₹200"
                                                            className={clsx("flex-1 p-2 border rounded-r", {
                                                                "border-red-500": formik.touched.sales_price && formik.errors.sales_price,
                                                            })}
                                                            {...formik.getFieldProps("sales_price")}
                                                        />
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

                                            {/* Measuring Unit and Opening Stock or Service Code */}
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-1">Measuring Unit</label>
                                                    <select
                                                        className="w-full p-2 border rounded"
                                                        value={formik.values.measuring_unit_id}
                                                        onChange={(e) => formik.setFieldValue("measuring_unit_id", Number(e.target.value) as 1 | 2 | 3 | 4)}
                                                    >
                                                        <option value={1}>Pieces (PCS)</option>
                                                        <option value={2}>Kilogram (KG)</option>
                                                        <option value={3}>Liter (LTR)</option>
                                                        <option value={4}>Meter (MTR)</option>
                                                    </select>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-1">
                                                        {formik.values.item_type_id === 2 ? "Service Code" : "Opening Stock"}
                                                    </label>
                                                    {formik.values.item_type_id === 2 ? (
                                                        <input
                                                            type="text"
                                                            placeholder="Enter Service Code"
                                                            className="w-full p-2 border rounded"
                                                            {...formik.getFieldProps("item_code")}
                                                        />
                                                    ) : (
                                                        <div className="flex">
                                                            <input
                                                                type="number"
                                                                placeholder="ex: 150 PCS"
                                                                className="flex-1 p-2 border rounded-l"
                                                                {...formik.getFieldProps("opening_stock")}
                                                            />
                                                            <span className="p-2 border rounded-r bg-gray-100">
                                                                {formik.values.measuring_unit_id === 1 ? "PCS" : "KG"}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    {/* Stock Details Section */}
                                    {activeSection === 'stock' && (
                                        <StockDetails formik={formik} isEditing={isEditing} />
                                    )}
                                    {activeSection === "price" && formik.values.item_type_id === 1 && <PricingDetails formik={formik} />}
                                    {activeSection === "other" && formik.values.item_type_id === 2 && <OtherDetails formik={formik} />}

                                </form>
                            </div>
                        </div>
                    </DialogBody>
                    <DialogFooter className="bg-gray-50 px-6 py-4 border-t">
                        <div className="flex justify-end space-x-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange()}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                form="item-form"
                                disabled={loading || formik.isSubmitting}
                                className="min-w-[120px]"
                            >
                                {loading || formik.isSubmitting ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        {isEditing ? 'Updating...' : 'Saving...'}
                                    </span>
                                ) : isEditing ? 'Update Item' : 'Save Item'}
                            </Button>
                        </div>
                    </DialogFooter>
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
                            <Button
                                className="px-4 py-2 bg-gray-200 rounded"
                                onClick={() => setShowCategoryModal(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="px-4 py-2 bg-blue-600 text-white rounded"
                                disabled={!newCategory}
                                onClick={async () => {
                                    try {
                                        await createItemCategory(newCategory);
                                        const updatedCategories = await getItemCategories();
                                        setCategories(updatedCategories);
                                        const newCategoryId = updatedCategories.find((c: ICategory) => c.name === newCategory)?.uuid;
                                        if (newCategoryId) {
                                            formik.setFieldValue("category_id", newCategoryId);
                                        }
                                        setNewCategory("");
                                        setShowCategoryModal(false);
                                    } catch (error) {
                                        console.error("Failed to create category", error);
                                    }
                                }}
                            >
                                Add
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}


// When I am entering the item or editing the item from the action buttons the (Edit button) for products and services then the item data is getting fetched in both input fields.  ergerfg