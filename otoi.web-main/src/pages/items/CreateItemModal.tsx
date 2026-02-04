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
    item_id?: string;


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

    item_code: Yup.string().required("Item code is required"),

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
                    // Only include item_code if it has changed from the original value
                    ...(values.item_code !== item?.item_code && { item_code: values.item_code || null }),
                    hsn_code: isService ? null : values.hsn_code || null,
                    description: values.description || null,
                    show_in_online_store: Boolean(values.show_in_online_store),
                    tax_type: values.tax_type || "with_tax",

                };

                // Only add these fields for Products (item_type_id = 1), omit entirely for Services
                if (!isService) {
                    postData.purchase_price = Number(values.purchase_price || 0);
                    postData.opening_stock = Number(values.opening_stock || 0);
                }


                const currentItemId = item?.item_id || item?.item_id;

                if (currentItemId) {
                    // EDITING an existing item
                    const response = await updateItem(currentItemId.toString(), postData);
                    if (response?.success) {
                        toast.success(response.data?.message || "Item updated successfully");
                        onSuccess();
                        onOpenChange();
                    } else {
                        // Throw an error with the error message from the response
                        const error = new Error(response?.error || "Failed to update item");
                        // @ts-ignore - Add response data to the error object
                        error.response = { data: { message: response?.error } };
                        throw error;
                    }
                } else {
                    // Creating a new item
                    const response = await createItem(postData);
                    if (response?.success) {
                        toast.success(response.data?.message || "Item created successfully");
                        onSuccess();
                        resetForm();
                        onOpenChange();
                    } else {
                        throw new Error(response?.error || "Failed to create item");
                    }
                }
            } catch (error: any) {
                
                // Get the error message from the error object
                let errorMessage = error?.message || 
                                 error?.response?.data?.message || 
                                 "An error occurred while saving the item.";

                // If the error is about duplicate item code, show a specific message
                if (errorMessage.toLowerCase().includes('item code') && errorMessage.toLowerCase().includes('already exists')) {
                    errorMessage = 'Item code already exists. Please use a different code.';
                }

                // Set the status and show error toast
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

    // Switch to section with errors if submit fails
    useEffect(() => {
        if (formik.submitCount > 0 && !formik.isValid) {
            const errorKeys = Object.keys(formik.errors);

            // Identify which section the errors belong to
            const isProduct = formik.values.item_type_id === 1;

            // Stock/Price Details fields (for Products)
            const stockFields = ["item_code", "opening_stock", "purchase_price", "hsn_code"];
            const hasStockError = isProduct && errorKeys.some(key => stockFields.includes(key));

            // Basic Details fields
            const basicFields = ["item_name", "category_id", "sales_price", "item_code"];
            // Note: item_code is in Basic for Services (type 2), but Stock for Products (type 1)
            const hasBasicError = errorKeys.some(key => {
                if (key === "item_code") return !isProduct;
                return basicFields.includes(key);
            });

            if (hasBasicError && activeSection !== "basic") {
                setActiveSection("basic");
                toast.error("Please fill required Basic Details");
            } else if (hasStockError && activeSection !== "stock") {
                setActiveSection("stock");
                toast.error("Please fill required Stock Details");
            }
        }
    }, [formik.submitCount, formik.isValid]);


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
                // console.error("Failed to load categories", error);
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
                                                            <>Service Name <span className="text-red-500">*</span></>
                                                        ) : (
                                                            <>Item Name <span className="text-red-500">*</span></>
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
                                                            type="text"
                                                            placeholder="ex: ₹200"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            className={clsx(
                                                                "flex-1 p-2 border rounded-r",
                                                                {
                                                                    "border-red-500":
                                                                        formik.touched.sales_price && formik.errors.sales_price,
                                                                }
                                                            )}
                                                            {...formik.getFieldProps("sales_price")}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (/^\d*$/.test(value)) {
                                                                    formik.setFieldValue("sales_price", value);
                                                                }
                                                            }}
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
                                                        onChange={(e) => formik.setFieldValue("measuring_unit_id", Number(e.target.value) as 1 | 2 | 3)}
                                                    >
                                                        <option value={1}>Pieces (PCS)</option>
                                                        <option value={2}>Kilogram (KG)</option>
                                                        <option value={3}>Liter (LTR)</option>
                                                        {/* <option value={4}>Meter (MTR)</option> */}
                                                    </select>
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-1">
                                                        {formik.values.item_type_id === 2 ? (
                                                            <>Service Code <span className="text-red-500">*</span></>
                                                        ) : (
                                                            "Opening Stock"
                                                        )}
                                                    </label>
                                                    {formik.values.item_type_id === 2 ? (
                                                        <>
                                                            <input
                                                                type="text"
                                                                placeholder="Enter Service Code"
                                                                className={clsx(
                                                                    "w-full p-2 border rounded",
                                                                    { "border-red-500": formik.touched.item_code && formik.errors.item_code }
                                                                )}
                                                                {...formik.getFieldProps("item_code")}
                                                            />
                                                            {formik.touched.item_code && formik.errors.item_code && (
                                                                <div className="text-red-500 text-xs mt-1">
                                                                    {formik.errors.item_code}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="flex">
                                                            <input
                                                                type="text"
                                                                placeholder="ex: 150 PCS"
                                                                className="flex-1 p-2 border rounded-l"
                                                                {...formik.getFieldProps("opening_stock")}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    if (/^\d*$/.test(value)) {
                                                                        formik.setFieldValue("opening_stock", value);
                                                                    }
                                                                }}
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
            <Dialog open={showCategoryModal} onOpenChange={(isOpen) => {
                if (!isOpen) {
                    setNewCategory("");
                }
                setShowCategoryModal(isOpen);
            }}>
                <DialogContent className="max-w-md rounded-2xl p-6 shadow-lg">

                    {/* Remove DialogHeader spacing issue */}
                    <DialogTitle className="mb-4 text-lg font-semibold text-gray-800">
                        Create New Category
                    </DialogTitle>

                    <div className="space-y-5">
                        <input
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
        focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            placeholder="Ex: Snacks"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                        />

                        <div className="flex justify-end gap-3 pt-2">
                            <Button
                                variant="outline"
                                className="rounded-lg px-4 py-2 text-sm"
                                onClick={() => {setNewCategory(""); setShowCategoryModal(false);}}
                                style={{ background: "white" }}
                            >
                                Cancel
                            </Button>

                            <Button
                                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white
          hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!newCategory}
                                onClick={async () => {
                                    try {
                                        await createItemCategory(newCategory);
                                        const updatedCategories = await getItemCategories();
                                        setCategories(updatedCategories);

                                        const newCategoryId = updatedCategories.find(
                                            (c: ICategory) => c.name === newCategory
                                        )?.uuid;

                                        if (newCategoryId) {
                                            formik.setFieldValue("category_id", newCategoryId);
                                        }

                                        setNewCategory("");
                                        setShowCategoryModal(false);
                                    } catch (error: any) {
                                        // console.error("Failed to create category", error);
                                        const errorMessage = error.response?.data?.message || error.response?.data?.errors || "Category with this name already exists.";
                                        toast.error(errorMessage);
                                    }
                                }}
                                style={{ background: "#1B84FF" }}
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

