import { useState, useEffect, useRef } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import clsx from "clsx";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, KeenIcon } from "@/components";
import { toast } from "sonner";
import {
  createItem,
  createItemCategory,
  getItemById,
  getItemCategories,
  updateItem,
} from "./services/items.service";
import StockDetails from "./StockDetails";
import PricingDetails from "./PricingDetails";
import ProductImages from "./ProductImages";
import OtherDetails from "./OtherDetails";

const bounceAnimation = `
  @keyframes modalBounceIn {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
    15%  { opacity: 0.3; transform: translate(-50%, -50%) scale(0.92); }
    30%  { opacity: 0.7; transform: translate(-50%, -50%) scale(0.98); }
    45%  { opacity: 0.9; transform: translate(-50%, -50%) scale(1.03); }
    60%  { opacity: 1;   transform: translate(-50%, -50%) scale(1.06); }
    70%  { transform: translate(-50%, -50%) scale(1.02); }
    80%  { transform: translate(-50%, -50%) scale(0.99); }
    88%  { transform: translate(-50%, -50%) scale(1.005); }
    94%  { transform: translate(-50%, -50%) scale(0.998); }
    100% { transform: translate(-50%, -50%) scale(1); }
  }
  @keyframes modalSlideFadeIn {
    0%   { opacity: 0; transform: translateY(-12px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .modal-bounce-in    { animation: modalBounceIn 1s cubic-bezier(0.23, 1, 0.32, 1); }
  .modal-slide-fade-in { animation: modalSlideFadeIn 0.8s ease-out; }
`;

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
  images?: string[];
}

interface ICategory { uuid: string; name: string; }

interface ICreateItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newItem?: any) => void;
  item: IItem | null;
}

const initialValues: IItem = {
  item_type_id: 1,
  category_id: null,
  as_of_date: new Date().toISOString().split("T")[0],
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
  images: [],
};

const saveItemSchema = Yup.object().shape({
  item_type_id: Yup.number().required(),
  item_name: Yup.string().trim().min(3, "Minimum 3 symbols").max(50, "Maximum 50 symbols").required("Item name is required"),
  category_id: Yup.string().required("Category is required"),
  item_code: Yup.string().trim().required("Item code is required"),
  sales_price: Yup.number().typeError("Sales price must be a number").required("Sales price is required"),
  gst_tax_rate: Yup.number().nullable().typeError("GST tax rate must be a number"),
  opening_stock: Yup.number().when("item_type_id", {
    is: 1,
    then: (s) => s.typeError("Opening stock must be a number").required("Opening stock is required"),
    otherwise: (s) => s.nullable().notRequired(),
  }),
  purchase_price: Yup.number().when("item_type_id", {
    is: 1,
    then: (s) => s.typeError("Purchase price must be a number").required("Purchase price is required"),
    otherwise: (s) => s.nullable().notRequired(),
  }),
});

// ─── shared input classes ────────────────────────────────────────────────────
const inputBase =
  "w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-500 border";
const inputNormal = `${inputBase} border-gray-300 dark:border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20`;
const inputError  = `${inputBase} border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-500/60`;
const selectBase  =
  "w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 border border-gray-300 dark:border-zinc-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 appearance-none";

export default function CreateItemModal({ open, onOpenChange, onSuccess, item }: ICreateItemModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [originalImages, setOriginalImages] = useState<any[]>([]);
  const isSubmittingRef = useRef(false);
  const originalImagesRef = useRef<any[]>([]);
  const itemRef = useRef<any>(null);
  const [modalBounce, setModalBounce] = useState(false);
  const [categoryModalBounce, setCategoryModalBounce] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [activeSection, setActiveSection] = useState("basic");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = bounceAnimation;
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);

  useEffect(() => { if (open) { setModalBounce(false); setTimeout(() => setModalBounce(true), 50); } }, [open]);
  useEffect(() => { if (showCategoryModal) { setCategoryModalBounce(false); setTimeout(() => setCategoryModalBounce(true), 50); } }, [showCategoryModal]);
  useEffect(() => { originalImagesRef.current = originalImages; }, [originalImages]);
  useEffect(() => { itemRef.current = item; }, [item]);
  useEffect(() => { setIsEditing(!!item?.id); }, [item]);

  const formik = useFormik({
    initialValues,
    validationSchema: saveItemSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setStatus, setSubmitting, resetForm }) => {
      if (loading || isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      setLoading(true);
      const isService = values.item_type_id === 2;
      try {
        const postData: Partial<IItem> = {
          item_name: values.item_name?.trim(),
          item_type_id: values.item_type_id,
          category_id: values.category_id || null,
          sales_price: Number(values.sales_price),
          gst_tax_rate: Number(values.gst_tax_rate),
          measuring_unit_id: values.measuring_unit_id,
          ...(values.item_code?.trim() !== item?.item_code?.trim() && { item_code: values.item_code?.trim() || null }),
          hsn_code: isService ? null : values.hsn_code?.trim() || null,
          description: values.description?.trim() || null,
          show_in_online_store: Boolean(values.show_in_online_store),
          tax_type: values.tax_type || "with_tax",
        };
        if (!isService) {
          postData.purchase_price = Number(values.purchase_price || 0);
          postData.opening_stock = Number(values.opening_stock || 0);
        }
        const currentItem = itemRef.current;
        const currentItemId = currentItem?.id || currentItem?.item_id || (currentItem as any)?.uuid;

        if (currentItemId) {
          const formData = new FormData();
          const currentImages = values.images || [];
          const imagesToDelete = originalImagesRef.current.filter((orig) => !currentImages.some((cur: any) => cur.id === orig.id)).map((img) => img.id);
          formData.append("item_data", JSON.stringify({ ...postData, images_to_delete: imagesToDelete, images: currentImages.filter((img: any) => img.id && !img.file).map((img: any) => ({ id: img.id, is_main: img.is_main })) }));
          let filesAdded = 0;
          const existingInDBCount = currentImages.filter((img: any) => img.id && !img.file).length;
          currentImages.forEach((img: any) => { if (img.file && existingInDBCount + filesAdded < 4) { formData.append("images", img.file); filesAdded++; } });
          const response = await updateItem(currentItemId.toString(), formData);
          if (response?.success) {
            toast.success(response.data?.message || "Item updated successfully");
            fetchItemDetails(currentItemId.toString());
            onSuccess(response.data?.item || postData); onOpenChange(false);
          } else { throw new Error(response?.error || "Failed to update item"); }
        } else {
          const formData = new FormData();
          formData.append("item_data", JSON.stringify({ ...postData, images: (values.images || []).map((img: any) => ({ name: img.name, is_main: img.is_main })) }));
          (values.images || []).slice(0, 4).forEach((img: any) => { if (img.file) formData.append("images", img.file); });
          const response = await createItem(formData);
          const isItemCreated = response?.success || (response?.error?.includes("already exists") && response?.status === 400);
          if (isItemCreated) {
            toast.success(response.data?.message || "Item created successfully");
            if (response.data?.item) { formik.setValues({ ...formik.values, id: response.data.item.id || response.data.item.uuid, ...response.data.item }); }
            onSuccess(response.data?.item || postData); onOpenChange(false);
          } else { throw new Error(response?.error || "Failed to create item"); }
        }
      } catch (error: any) {
        let errorMessage = "Failed to save item. Please try again.";
        if (error?.response?.data) {
          const d = error.response.data;
          if (typeof d === "string") errorMessage = d;
          else if (d.message) errorMessage = d.message;
          else if (d.errors) errorMessage = Array.isArray(d.errors) ? d.errors.join(", ") : typeof d.errors === "object" ? Object.values(d.errors).flat().join(", ") : String(d.errors);
          else if (d.error) errorMessage = d.error;
        } else if (error?.message) errorMessage = error.message;
        setStatus(errorMessage); toast.error(errorMessage);
      } finally { setLoading(false); isSubmittingRef.current = false; }
    },
  });

  useEffect(() => {
    if (!isEditing) {
      const isService = formik.values.item_type_id === 2;
      formik.resetForm({ values: { item_type_id: formik.values.item_type_id, item_name: "", category_id: null, sales_price: 0, gst_tax_rate: 0, measuring_unit_id: 1, item_code: isService ? "" : null, description: null, show_in_online_store: false, tax_type: "with_tax", purchase_price: isService ? null : 0, opening_stock: isService ? null : 0, hsn_code: null, images: [] } });
    }
  }, [formik.values.item_type_id, isEditing]);

  const fetchItemDetails = async (itemId: string) => {
    if (!itemId) return;
    setLoading(true);
    try {
      const response = await getItemById(itemId);
      if (response?.success && response.data) {
        const d = response.data;
        formik.resetForm({ values: { item_type_id: d.item_type_id ?? 1, category_id: d.category_id || null, measuring_unit_id: d.measuring_unit_id ?? 1, item_name: d.item_name ?? "", item_code: d.item_code ?? (d.item_type_id === 2 ? "" : null), sales_price: d.sales_price ?? 0, gst_tax_rate: d.gst_tax_rate ?? 0, purchase_price: d.item_type_id === 1 ? (d.purchase_price ?? 0) : null, opening_stock: d.item_type_id === 1 ? (d.opening_stock ?? 0) : null, hsn_code: d.item_type_id === 1 ? (d.hsn_code ?? null) : null, description: d.description ?? null, show_in_online_store: d.show_in_online_store ?? false, tax_type: d.tax_type ?? "with_tax", images: d.images ?? [] } });
        setOriginalImages(d.images ?? []);
      }
    } catch { toast.error("Failed to load full item details"); }
    finally { setLoading(false); isSubmittingRef.current = false; }
  };

  useEffect(() => {
    if (open) {
      if (item) {
        setIsEditing(true);
        formik.resetForm({ values: { item_type_id: item.item_type_id ?? 1, category_id: item.category_id || null, measuring_unit_id: (item.measuring_unit_id as any) ?? 1, item_name: item.item_name ?? "", item_code: item.item_code ?? (item.item_type_id === 2 ? "" : null), sales_price: item.sales_price ?? 0, gst_tax_rate: item.gst_tax_rate ?? 0, purchase_price: item.item_type_id === 1 ? (item.purchase_price ?? 0) : null, opening_stock: item.item_type_id === 1 ? (item.opening_stock ?? 0) : null, hsn_code: item.item_type_id === 1 ? (item.hsn_code ?? null) : null, description: item.description ?? null, show_in_online_store: item.show_in_online_store ?? false, tax_type: item.tax_type ?? "with_tax", images: item.images ?? [] } });
        setOriginalImages(item.images ?? []);
        const currentItemId = item.id || item.item_id;
        if (currentItemId) fetchItemDetails(currentItemId.toString());
      } else {
        setIsEditing(false); setActiveSection("basic");
        formik.resetForm({ values: { item_type_id: 1, category_id: null, measuring_unit_id: 1, item_name: "", item_code: null, sales_price: 0, gst_tax_rate: 0, purchase_price: 0, opening_stock: 0, hsn_code: null, description: null, show_in_online_store: false, tax_type: "with_tax", images: [] } });
      }
    } else { setActiveSection("basic"); }
  }, [open, item]);

  useEffect(() => {
    if (formik.submitCount > 0 && !formik.isValid) {
      const errorKeys = Object.keys(formik.errors);
      const isProduct = formik.values.item_type_id === 1;
      const stockFields = ["item_code", "opening_stock", "purchase_price", "hsn_code"];
      const hasStockError = isProduct && errorKeys.some((k) => stockFields.includes(k));
      const basicFields = ["item_name", "category_id", "sales_price", "item_code"];
      const hasBasicError = errorKeys.some((k) => { if (k === "item_code") return !isProduct; return basicFields.includes(k); });
      if (hasBasicError && activeSection !== "basic") { setActiveSection("basic"); toast.error("Please fill required Basic Details"); }
      else if (hasStockError && activeSection !== "stock") { setActiveSection("stock"); toast.error("Please fill required Stock Details"); }
    }
  }, [formik.submitCount, formik.isValid]);

  useEffect(() => {
    const loadCategories = async () => { try { setCategories(await getItemCategories()); } catch {} };
    if (open) loadCategories();
  }, [open]);

  const isProduct = formik.values.item_type_id === 1;

  // ── nav item helper ────────────────────────────────────────────────────────
  const navItem = (section: string, icon: string, label: string, badge?: string) => (
    <div
      className={clsx(
        "p-2 rounded-lg cursor-pointer text-xs font-medium transition-all flex items-center gap-2",
        activeSection === section
          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30"
          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-200",
      )}
      onClick={() => setActiveSection(section)}
    >
      <KeenIcon icon={icon} className="size-4 shrink-0" />
      {label}
      {badge && <span className="text-red-500 dark:text-red-400 text-[10px]">{badge}</span>}
    </div>
  );

  const mobileTab = (section: string, label: string, badge?: string) => (
    <button
      className={clsx(
        "px-2.5 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap shrink-0 transition-all",
        activeSection === section
          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30"
          : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600",
      )}
      onClick={() => setActiveSection(section)}
    >
      {label} {badge && <span className="text-red-500 dark:text-red-400">{badge}</span>}
    </button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={clsx(
            "max-w-[900px] w-[95vw] p-0 rounded-xl shadow-2xl h-[90vh] md:h-[80vh] flex flex-col overflow-hidden",
            "bg-white dark:bg-black border border-gray-200 dark:border-zinc-800",
            modalBounce ? "modal-bounce-in" : "",
          )}
        >
          {/* Header */}
          <DialogHeader className="bg-gray-50 dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 px-4 sm:px-6 py-4 modal-slide-fade-in shrink-0">
            <DialogTitle className="text-base sm:text-lg font-semibold text-gray-900 dark:text-zinc-100 text-center sm:text-left">
              {item ? "Edit Item" : "Create New Item"}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="overflow-y-auto flex-1 p-0">
            <div className="flex flex-col md:flex-row h-full">

              {/* Mobile tabs */}
              <div className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-800 md:hidden overflow-x-auto no-scrollbar">
                <div className="flex gap-1.5 w-max">
                  {mobileTab("basic", "Basic Details", "*")}
                  {isProduct ? (
                    <>
                      {mobileTab("stock", "Stock Details")}
                      {mobileTab("price", "Price Details")}
                      {mobileTab("product", "Images")}
                    </>
                  ) : (
                    mobileTab("other", "Other")
                  )}
                </div>
              </div>

              {/* Desktop sidebar */}
              <div className="hidden md:flex w-56 flex-col gap-1 p-3 bg-gray-50 dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 overflow-y-auto sticky top-0 z-10">
                {navItem("basic", "setting-2", "Basic Details", "*")}
                {isProduct ? (
                  <>
                    {navItem("stock", "package", "Stock Details")}
                    {navItem("price", "price-tag", "Price Details")}
                    {navItem("product", "picture", "Product Images")}
                  </>
                ) : (
                  navItem("other", "element-plus", "Other Details")
                )}
              </div>

              {/* Form area */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <form id="item-form" onSubmit={formik.handleSubmit} className="space-y-5">
                  {formik.status && (
                    <Alert variant="danger" className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400">
                      {formik.status}
                    </Alert>
                  )}

                  {/* ── BASIC DETAILS ── */}
                  {activeSection === "basic" && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

                      {/* Primary Information */}
                      <div className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-300 mb-4 flex items-center gap-2">
                          <span className="w-1 h-4 bg-blue-500 dark:bg-blue-400 rounded-full" />
                          Primary Information
                        </h3>
                        <div className="space-y-5">
                          {/* Item Type toggle */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <label className="text-sm font-semibold text-gray-700 dark:text-zinc-300 min-w-[80px]">
                              Item Type <span className="text-red-500 dark:text-red-400">*</span>
                            </label>
                            <div className="flex items-center px-1.5 py-1 bg-gray-50 dark:bg-zinc-700/50 border border-gray-200 dark:border-zinc-600 rounded-lg w-fit">
                              <div className="relative flex items-center">
                                <div
                                  className={clsx(
                                    "absolute inset-y-0 rounded-md border transition-all duration-300",
                                    formik.values.item_type_id === 1
                                      ? "bg-white dark:bg-zinc-600 border-gray-300 dark:border-zinc-500"
                                      : "bg-blue-500 border-blue-600",
                                  )}
                                  style={{ width: "96px", transform: `translateX(${formik.values.item_type_id === 1 ? "0px" : "96px"})` }}
                                />
                                {[{ val: 1, label: "Product" }, { val: 2, label: "Service" }].map(({ val, label }) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => !isEditing && formik.setFieldValue("item_type_id", val)}
                                    disabled={isEditing}
                                    className={clsx(
                                      "relative w-24 py-1.5 text-sm font-medium rounded-md transition-all z-10",
                                      formik.values.item_type_id === val ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-zinc-400",
                                      isEditing && "cursor-not-allowed opacity-50",
                                    )}
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Name + Category */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                                {isProduct ? "Item Name" : "Service Name"} <span className="text-red-500 dark:text-red-400">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder={isProduct ? "e.g., Smart Lock Door" : "e.g., Mobile Service"}
                                className={clsx(formik.touched.item_name && formik.errors.item_name ? inputError : inputNormal)}
                                {...formik.getFieldProps("item_name")}
                              />
                              {formik.touched.item_name && formik.errors.item_name && (
                                <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{formik.errors.item_name}</p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                                Category <span className="text-red-500 dark:text-red-400">*</span>
                              </label>
                              <select
                                className={clsx(selectBase, formik.touched.category_id && formik.errors.category_id && "border-red-500 dark:bg-red-900/20 dark:border-red-500/60")}
                                value={formik.values.category_id || ""}
                                onChange={(e) => {
                                  if (e.target.value === "add_new") { setShowCategoryModal(true); return; }
                                  formik.setFieldValue("category_id", e.target.value || "");
                                }}
                                onBlur={formik.handleBlur}
                                name="category_id"
                              >
                                <option value="">Select Category</option>
                                {categories.map((cat) => (
                                  <option key={cat.uuid} value={cat.uuid}>{cat.name}</option>
                                ))}
                                <option value="add_new">+ Add Category</option>
                              </select>
                              {formik.touched.category_id && formik.errors.category_id && (
                                <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{formik.errors.category_id}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pricing Information */}
                      <div className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-300 mb-4 flex items-center gap-2">
                          <span className="w-1 h-4 bg-green-500 dark:bg-emerald-400 rounded-full" />
                          Pricing Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">Sales Price</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-400 text-sm font-medium">₹</span>
                              <input
                                type="text"
                                placeholder="0.00"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className={clsx("pl-10", formik.touched.sales_price && formik.errors.sales_price ? inputError : inputNormal)}
                                {...formik.getFieldProps("sales_price")}
                                onChange={(e) => { if (/^\d*$/.test(e.target.value)) formik.setFieldValue("sales_price", e.target.value); }}
                              />
                            </div>
                            {formik.touched.sales_price && formik.errors.sales_price && (
                              <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">{formik.errors.sales_price}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">GST Tax Rate</label>
                            <select className={selectBase} {...formik.getFieldProps("gst_tax_rate")}>
                              <option value="">None</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Inventory Details */}
                      <div className="bg-white dark:bg-black border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-300 mb-4 flex items-center gap-2">
                          <span className="w-1 h-4 bg-violet-500 dark:bg-violet-400 rounded-full" />
                          Inventory Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-2">Measuring Unit</label>
                            <select
                              className={selectBase}
                              value={formik.values.measuring_unit_id}
                              onChange={(e) => formik.setFieldValue("measuring_unit_id", Number(e.target.value))}
                            >
                              <option value={1}>Pieces (PCS)</option>
                              <option value={2}>Kilogram (KG)</option>
                              <option value={3}>Liter (LTR)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-2">
                              {isProduct ? "Opening Stock" : "Service Code"}
                              {!isProduct && <span className="text-red-400 ml-1">*</span>}
                            </label>
                            {!isProduct ? (
                              <>
                                <input
                                  type="text"
                                  placeholder="Enter Service Code"
                                  className={clsx(formik.touched.item_code && formik.errors.item_code ? inputError : inputNormal)}
                                  {...formik.getFieldProps("item_code")}
                                />
                                {formik.touched.item_code && formik.errors.item_code && (
                                  <p className="text-red-400 text-xs mt-1.5">{formik.errors.item_code}</p>
                                )}
                              </>
                            ) : (
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="0"
                                  className={clsx("pr-16", formik.touched.opening_stock && formik.errors.opening_stock ? inputError : inputNormal)}
                                  {...formik.getFieldProps("opening_stock")}
                                  onChange={(e) => { if (/^\d*$/.test(e.target.value)) formik.setFieldValue("opening_stock", e.target.value); }}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-zinc-400 text-xs font-medium bg-gray-50 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 px-1.5 py-0.5 rounded">
                                  {formik.values.measuring_unit_id === 1 ? "PCS" : formik.values.measuring_unit_id === 2 ? "KG" : "LTR"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSection === "stock"   && <StockDetails formik={formik} isEditing={isEditing} isSubmitting={loading || isSubmittingRef.current} />}
                  {activeSection === "price"   && isProduct  && <PricingDetails formik={formik} />}
                  {activeSection === "product" && isProduct  && <ProductImages formik={formik} />}
                  {activeSection === "other"   && !isProduct && <OtherDetails formik={formik} />}
                </form>
              </div>
            </div>
          </DialogBody>

          {/* Footer */}
          <DialogFooter className="bg-gray-50 dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 px-4 sm:px-6 py-3 sm:py-4 shrink-0">
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <Button
                type="button" variant="outline"
                onClick={() => onOpenChange(false)} disabled={loading}
                className="flex-1 sm:flex-none text-sm h-9 sm:h-10 px-4 sm:px-6 bg-transparent border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-700 dark:hover:text-zinc-100 transition-colors"
              >
                Cancel
              </Button>
              <Button
                type="submit" form="item-form"
                disabled={loading || formik.isSubmitting || isSubmittingRef.current}
                onClick={(e) => { if (isSubmittingRef.current) { e.preventDefault(); e.stopPropagation(); } }}
                className="flex-1 sm:flex-none min-w-[100px] sm:min-w-[120px] text-sm h-9 sm:h-10 px-4 sm:px-6 bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm"
              >
                {loading || formik.isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {isEditing ? "Updating..." : "Saving..."}
                  </span>
                ) : isEditing ? "Update Item" : "Save Item"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE CATEGORY MODAL ── */}
      <Dialog open={showCategoryModal} onOpenChange={(isOpen) => { if (!isOpen) setNewCategory(""); setShowCategoryModal(isOpen); }}>
        <DialogContent className={clsx("max-w-md rounded-2xl p-6 shadow-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700", categoryModalBounce ? "modal-bounce-in" : "")}>
          <DialogTitle className="mb-4 text-base font-semibold text-gray-900 dark:text-zinc-100 modal-slide-fade-in">
            Create New Category
          </DialogTitle>
          <div className="space-y-5">
            <input
              className={inputNormal}
              placeholder="Ex: Snacks"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => { setNewCategory(""); setShowCategoryModal(false); }}
                className="bg-transparent border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-700 dark:hover:text-zinc-100 rounded-lg px-4 py-2 text-sm h-9 transition-all"
              >
                Cancel
              </Button>
              <Button
                disabled={!newCategory}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-5 py-2 text-sm h-9 transition-all"
                onClick={async () => {
                  try {
                    await createItemCategory(newCategory);
                    const updated = await getItemCategories();
                    setCategories(updated);
                    const newCategoryItem = updated.find((c: ICategory) => c.name === newCategory);
                    if (newCategoryItem) {
                      formik.setFieldValue("category_id", newCategoryItem.uuid);
                    }
                    setNewCategory(""); setShowCategoryModal(false);
                  } catch (error: any) {
                    toast.error(error.response?.data?.message || error.response?.data?.errors || "Category with this name already exists.");
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