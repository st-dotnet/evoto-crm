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

// Custom animation styles
const bounceAnimation = `
  @keyframes modalBounceIn {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.85);
    }
    15% {
      opacity: 0.3;
      transform: translate(-50%, -50%) scale(0.92);
    }
    30% {
      opacity: 0.7;
      transform: translate(-50%, -50%) scale(0.98);
    }
    45% {
      opacity: 0.9;
      transform: translate(-50%, -50%) scale(1.03);
    }
    60% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.06);
    }
    70% {
      transform: translate(-50%, -50%) scale(1.02);
    }
    80% {
      transform: translate(-50%, -50%) scale(0.99);
    }
    88% {
      transform: translate(-50%, -50%) scale(1.005);
    }
    94% {
      transform: translate(-50%, -50%) scale(0.998);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
  }
  
  @keyframes modalSlideFadeIn {
    0% {
      opacity: 0;
      transform: translateY(-12px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .modal-bounce-in {
    animation: modalBounceIn 1s cubic-bezier(0.23, 1, 0.32, 1);
  }
  
  .modal-slide-fade-in {
    animation: modalSlideFadeIn 0.8s ease-out;
  }
`;

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
  images?: string[];
}

interface ICategory {
  uuid: string;
  name: string;
}

interface ICreateItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  item: IItem | null;
}

// Initial values for the form
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

// Validation schema
const saveItemSchema = Yup.object().shape({
  item_type_id: Yup.number().required(),

  item_name: Yup.string()
    .trim()
    .min(3, "Minimum 3 symbols")
    .max(50, "Maximum 50 symbols")
    .required("Item name is required"),

  category_id: Yup.string().required("Category is required"),

  item_code: Yup.string().trim().required("Item code is required"),

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

  // Inject custom styles
  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = bounceAnimation;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Trigger bounce animation when modal opens
  useEffect(() => {
    if (open) {
      setModalBounce(false);
      setTimeout(() => setModalBounce(true), 50);
    }
  }, [open]);

  // Trigger bounce animation for category modal
  useEffect(() => {
    if (showCategoryModal) {
      setCategoryModalBounce(false);
      setTimeout(() => setCategoryModalBounce(true), 50);
    }
  }, [showCategoryModal]);

  // Keep refs in sync with state/props
  useEffect(() => {
    originalImagesRef.current = originalImages;
  }, [originalImages]);

  useEffect(() => {
    itemRef.current = item;
  }, [item]);

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
      // Prevent duplicate submissions using ref for synchronous check
      if (loading || isSubmittingRef.current) {
        return;
      }
      isSubmittingRef.current = true;
      setLoading(true);
      const isService = values.item_type_id === 2;

      try {
        console.log('🔍 Item Creation Debug - Form values:', values);
        console.log('🔍 Item Creation Debug - Current item being edited:', item);
        console.log('🔍 Item Creation Debug - isService:', isService);
        
        const postData: Partial<IItem> = {
          item_name: values.item_name?.trim(),
          item_type_id: values.item_type_id,
          category_id: values.category_id || null, // Ensure we send null instead of empty string
          sales_price: Number(values.sales_price),
          gst_tax_rate: Number(values.gst_tax_rate),
          measuring_unit_id: values.measuring_unit_id,
          // Only include item_code if it has changed from the original value
          ...(values.item_code?.trim() !== item?.item_code?.trim() && {
            item_code: values.item_code?.trim() || null,
          }),
          hsn_code: isService ? null : values.hsn_code?.trim() || null,
          description: values.description?.trim() || null,
          show_in_online_store: Boolean(values.show_in_online_store),
          tax_type: values.tax_type || "with_tax",
        };

        console.log('🔍 Item Creation Debug - postData prepared:', postData);

        // Only add these fields for Products (item_type_id = 1), omit entirely for Services
        if (!isService) {
          postData.purchase_price = Number(values.purchase_price || 0);
          postData.opening_stock = Number(values.opening_stock || 0);
        }

        const currentItem = itemRef.current;
        const currentItemId =
          currentItem?.id || currentItem?.item_id || (currentItem as any)?.uuid;

        if (currentItemId) {
          // UNIFIED MULTIPART UPDATE
          const formData = new FormData();

          // Identify images to delete (those in original but not in current)
          const currentImages = values.images || [];
          const imagesToDelete = originalImagesRef.current
            .filter(
              (orig) => !currentImages.some((cur: any) => cur.id === orig.id),
            )
            .map((img) => img.id);

          // Prepare item data JSON
          const itemData = {
            ...postData,
            images_to_delete: imagesToDelete,
            // Include metadata updates for existing images (e.g., is_main change)
            images: currentImages
              .filter((img: any) => img.id && !img.file)
              .map((img: any) => ({
                id: img.id,
                is_main: img.is_main,
              })),
          };

          formData.append("item_data", JSON.stringify(itemData));

          // Append new files
          let filesAdded = 0;
          const existingInDBCount = currentImages.filter(
            (img: any) => img.id && !img.file,
          ).length;

          currentImages.forEach((img: any) => {
            if (img.file && existingInDBCount + filesAdded < 4) {
              formData.append("images", img.file);
              filesAdded++;
            }
          });

          const response = await updateItem(currentItemId.toString(), formData);

          if (response?.success) {
            toast.success(
              response.data?.message || "Item updated successfully",
            );
            fetchItemDetails(currentItemId.toString()); // Re-sync state
            onSuccess();
            onOpenChange(false);
          } else {
            throw new Error(response?.error || "Failed to update item");
          }
        } else {
          // UNIFIED MULTIPART CREATION
          const formData = new FormData();

          const itemData = {
            ...postData,
            images: (values.images || []).map((img: any) => ({
              name: img.name,
              is_main: img.is_main,
            })),
          };

          console.log('🔍 Item Creation Debug - Final itemData being sent:', itemData);

          formData.append("item_data", JSON.stringify(itemData));

          // Append images
          const currentImages = values.images || [];
          currentImages.slice(0, 4).forEach((img: any) => {
            if (img.file) {
              formData.append("images", img.file);
            }
          });

          console.log('🔍 Item Creation Debug - About to call createItem API');
          const response = await createItem(formData);
          console.log('🔍 Item Creation Debug - API response received:', response);

          // Handle the case where backend returns success: false but actually creates the item
          // This happens with item code duplicates - backend creates item but returns warning
          const isItemCreated = response?.success || (response?.error?.includes('already exists') && response?.status === 400);
          
          if (isItemCreated) {
            // Show appropriate message based on response type
            if (response?.success) {
              toast.success(
                response.data?.message || "Item created successfully",
              );
            } else {
              // Handle case where item was created but with warning
              toast.success(
                response.data?.message || "Item created successfully (item code was auto-generated)",
              );
              console.log('⚠️ Item Creation Warning - Item created with warning:', response?.error);
            }
            
            
            // Update formik with the new item data for barcode generation
            if (response.data?.item) {
              console.log('Create Item Debug - Item data found:', response.data.item);
              const newItemData = {
                ...formik.values,
                id: response.data.item.id || response.data.item.uuid,
                ...response.data.item
              };
              console.log('Create Item Debug - New item data to store:', newItemData);
              formik.setValues(newItemData);
              
              // Store the item data for barcode generation after modal closes
              sessionStorage.setItem('lastCreatedItem', JSON.stringify(newItemData));
              console.log('Create Item Debug - Item data stored in sessionStorage');
            } else if (!response?.success) {
              // Handle case where item was created but no data returned (duplicate item code case)
              console.log('Create Item Debug - Item created but no data returned (likely duplicate item code case)');
              // Store the form values as the created item data
              const newItemData = {
                ...formik.values,
                id: Date.now().toString(), // Temporary ID for barcode generation
              };
              sessionStorage.setItem('lastCreatedItem', JSON.stringify(newItemData));
              console.log('Create Item Debug - Form data stored in sessionStorage for barcode generation');
            } else {
              console.log('Create Item Debug - No item data found in response');
            }
            onSuccess();
            onOpenChange(false);
          } else {
            console.log('🔍 Item Creation Debug - API response indicates failure:', response);
            throw new Error(response?.error || "Failed to create item");
          }
        }
      } catch (error: any) {
        console.error("🔍 Item Creation Debug - Full error object:", error);
        console.error("🔍 Item Creation Debug - Error response data:", error?.response?.data);
        console.error("🔍 Item Creation Debug - Error status:", error?.response?.status);
        console.error("🔍 Item Creation Debug - Error message:", error?.message);
        
        // Enhanced error handling with better user feedback
        let errorMessage = "Failed to save item. Please try again.";
        
        if (error?.response?.data) {
          const errorData = error.response.data;
          console.log('🔍 Item Creation Debug - Processing error data:', errorData);
          
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.errors) {
            if (Array.isArray(errorData.errors)) {
              errorMessage = errorData.errors.join(', ');
            } else if (typeof errorData.errors === 'object') {
              const errorMessages = Object.values(errorData.errors).flat();
              errorMessage = errorMessages.join(', ');
            } else {
              errorMessage = String(errorData.errors);
            }
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        console.log('🔍 Item Creation Debug - Final error message to display:', errorMessage);
        setStatus(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
        isSubmittingRef.current = false;
      }
    },
  });

  useEffect(() => {
    // Only reset the form for new items, not when editing
    if (!isEditing) {
      if (formik.values.item_type_id === 2) {
        // Service
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
            images: [],
          },
        });
      } else {
        // Product
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
            images: [],
          },
        });
      }
    }
  }, [formik.values.item_type_id, isEditing]);

  const fetchItemDetails = async (itemId: string) => {
    if (!itemId) return;
    setLoading(true);
    try {
      const response = await getItemById(itemId);
      if (response?.success && response.data) {
        const fullItem = response.data;
        formik.resetForm({
          values: {
            item_type_id: fullItem.item_type_id ?? 1,
            category_id: fullItem.category_id || null,
            measuring_unit_id: fullItem.measuring_unit_id ?? 1,
            item_name: fullItem.item_name ?? "",
            item_code:
              fullItem.item_code ?? (fullItem.item_type_id === 2 ? "" : null),
            sales_price: fullItem.sales_price ?? 0,
            gst_tax_rate: fullItem.gst_tax_rate ?? 0,
            purchase_price:
              fullItem.item_type_id === 1
                ? (fullItem.purchase_price ?? 0)
                : null,
            opening_stock:
              fullItem.item_type_id === 1
                ? (fullItem.opening_stock ?? 0)
                : null,
            hsn_code:
              fullItem.item_type_id === 1 ? (fullItem.hsn_code ?? null) : null,
            description: fullItem.description ?? null,
            show_in_online_store: fullItem.show_in_online_store ?? false,
            tax_type: fullItem.tax_type ?? "with_tax",
            images: fullItem.images ?? [],
          },
        });
        setOriginalImages(fullItem.images ?? []);
      }
    } catch (error) {
      console.error("Failed to fetch item details:", error);
      toast.error("Failed to load full item details");
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Update the useEffect hook to reset the active section and form values
  useEffect(() => {
    if (open) {
      if (item) {
        // 1. Immediately populate with what we have from the list view (no info missing)
        setIsEditing(true);
        formik.resetForm({
          values: {
            item_type_id: item.item_type_id ?? 1,
            category_id: item.category_id || null,
            measuring_unit_id: (item.measuring_unit_id as any) ?? 1,
            item_name: item.item_name ?? "",
            item_code: item.item_code ?? (item.item_type_id === 2 ? "" : null),
            sales_price: item.sales_price ?? 0,
            gst_tax_rate: item.gst_tax_rate ?? 0,
            purchase_price:
              item.item_type_id === 1 ? (item.purchase_price ?? 0) : null,
            opening_stock:
              item.item_type_id === 1 ? (item.opening_stock ?? 0) : null,
            hsn_code: item.item_type_id === 1 ? (item.hsn_code ?? null) : null,
            description: item.description ?? null,
            show_in_online_store: item.show_in_online_store ?? false,
            tax_type: item.tax_type ?? "with_tax",
            images: item.images ?? [],
          },
        });
        setOriginalImages(item.images ?? []);

        // 2. Fetch full details (images etc.) in the background
        const currentItemId = item.id || item.item_id;
        if (currentItemId) {
          fetchItemDetails(currentItemId.toString());
        }
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
            images: [],
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
      const stockFields = [
        "item_code",
        "opening_stock",
        "purchase_price",
        "hsn_code",
      ];
      const hasStockError =
        isProduct && errorKeys.some((key) => stockFields.includes(key));

      // Basic Details fields
      const basicFields = [
        "item_name",
        "category_id",
        "sales_price",
        "item_code",
      ];
      // Note: item_code is in Basic for Services (type 2), but Stock for Products (type 1)
      const hasBasicError = errorKeys.some((key) => {
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
    if (section === "product" && formik.values.item_type_id === 2) return;
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
        <DialogContent
          className={clsx(
            "max-w-[900px] w-[95vw] p-0 rounded-lg shadow-2xl h-[90vh] md:h-[80vh] flex flex-col overflow-hidden",
            modalBounce ? "modal-bounce-in" : "",
          )}
        >
          <DialogHeader className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 sm:p-6 border-b modal-slide-fade-in">
            <DialogTitle className="text-base sm:text-lg font-semibold text-gray-800 text-center sm:text-left transition-all duration-300">
              {item ? "Edit Item" : "Create New Item"}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="overflow-y-auto flex-1 p-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
            <div className="flex flex-col md:flex-row h-full">
              {/* Mobile Section Tabs */}
              <div className="w-full px-2 py-1.5 bg-gradient-to-b from-gray-50 to-gray-100 border-b md:hidden">
                <div className="flex gap-1">
                  <button
                    className={clsx(
                      "px-2 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap shrink-0 transition-all",
                      activeSection === "basic"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-white text-gray-600 border border-gray-200"
                    )}
                    onClick={() => setActiveSection("basic")}
                  >
                    Basic Details <span className="text-red-500">*</span>
                  </button>
                  {formik.values.item_type_id === 2 ? (
                    <button
                      className={clsx(
                        "px-2 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap shrink-0 transition-all",
                        activeSection === "other"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-white text-gray-600 border border-gray-200"
                      )}
                      onClick={() => setActiveSection("other")}
                    >
                      Other
                    </button>
                  ) : (
                    <>
                      <button
                        className={clsx(
                          "px-2 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap shrink-0 transition-all",
                          activeSection === "stock"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-white text-gray-600 border border-gray-200"
                        )}
                        onClick={() => setActiveSection("stock")}
                      >
                        Stock Details
                      </button>
                      <button
                        className={clsx(
                          "px-2 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap shrink-0 transition-all",
                          activeSection === "price"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-white text-gray-600 border border-gray-200"
                        )}
                        onClick={() => setActiveSection("price")}
                      >
                        Price Details
                      </button>
                      <button
                        className={clsx(
                          "px-2 py-1.5 rounded-md text-[10px] font-medium whitespace-nowrap shrink-0 transition-all",
                          activeSection === "product"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-white text-gray-600 border border-gray-200"
                        )}
                        onClick={() => setActiveSection("product")}
                      >
                        Product Images
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Desktop Sidebar */}
              <div className="hidden md:block w-64 p-4 bg-gradient-to-b from-gray-50 to-gray-100 border-r overflow-y-auto flex flex-col gap-0 sticky top-0 z-10 no-scrollbar transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
                <div
                  className={clsx(
                    "p-1.5 md:p-2 rounded mb-0 md:mb-4 cursor-pointer text-[11px] sm:text-xs md:text-sm font-medium transition-all col-span-2 md:col-span-1",
                    activeSection === "basic"
                      ? "bg-purple-100 text-purple-800"
                      : "text-gray-500 hover:bg-gray-100",
                  )}
                  onClick={() => setActiveSection("basic")}
                >
                  <button className="flex items-center gap-1.5">
                    <KeenIcon icon="setting-2" className="size-3 md:size-4" />
                    Basic Details{" "}
                    <span className="text-red-500 text-[10px]">*</span>
                  </button>
                </div>
                <h2 className="text-sm font-bold text-black-500 mb-2 ml-2 col-span-2 md:hidden">
                  Advance Details
                </h2>
                {formik.values.item_type_id === 2 ? (
                  <div
                    className={clsx(
                      "p-1.5 md:p-2 rounded mb-0 md:mb-2 cursor-pointer text-[11px] sm:text-xs md:text-sm font-medium transition-all col-span-2 md:col-span-1",
                      activeSection === "other"
                        ? "bg-purple-100 text-purple-800"
                        : "text-gray-500 hover:bg-gray-100",
                    )}
                    onClick={() => setActiveSection("other")}
                  >
                    <div className="flex items-center gap-1.5">
                      <KeenIcon
                        icon="element-plus"
                        className="size-3 md:size-4"
                      />
                      Other Details
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={clsx(
                        "p-1.5 md:p-2 rounded mb-0 md:mb-2 cursor-pointer text-[11px] sm:text-xs md:text-sm font-medium transition-all",
                        activeSection === "stock"
                          ? "bg-purple-100 text-purple-800"
                          : "text-gray-500 hover:bg-gray-100",
                      )}
                      onClick={() => setActiveSection("stock")}
                    >
                      <div className="flex items-center gap-1.5">
                        <KeenIcon icon="package" className="size-3 md:size-4" />
                        Stock Details
                      </div>
                    </div>
                    <div
                      className={clsx(
                        "p-1.5 md:p-2 mb-0 md:mb-2 rounded cursor-pointer text-[11px] sm:text-xs md:text-sm font-medium transition-all",
                        activeSection === "price"
                          ? "bg-purple-100 text-purple-800"
                          : "text-gray-500 hover:bg-gray-100",
                      )}
                      onClick={() => setActiveSection("price")}
                    >
                      <div className="flex items-center gap-1.5">
                        <KeenIcon
                          icon="price-tag"
                          className="size-3 md:size-4"
                        />
                        Price Details
                      </div>
                    </div>
                    <div
                      className={clsx(
                        "p-1.5 md:p-2 mb-0 md:mb-2 rounded cursor-pointer text-[11px] sm:text-xs md:text-sm font-medium transition-all col-span-2 md:col-span-1",
                        activeSection === "product"
                          ? "bg-purple-100 text-purple-800"
                          : "text-gray-500 hover:bg-gray-100",
                      )}
                      onClick={() => setActiveSection("product")}
                    >
                      <div className="flex items-center gap-1.5">
                        <KeenIcon icon="picture" className="size-3 md:size-4" />
                        Product images
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Form Section */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                <form
                  id="item-form"
                  onSubmit={formik.handleSubmit}
                  className="space-y-6"
                >
                  {formik.status && (
                    <Alert variant="danger" className="mb-4">
                      {formik.status}
                    </Alert>
                  )}

                  {/* Basic Details Section */}
                  {activeSection === "basic" && (
                    <div className="space-y-8">
                      {/* Primary Information */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                          Primary Information
                        </h3>
                        <div className="space-y-6">
                          {/* Item Type */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                            <label className="font-semibold text-sm text-gray-700 min-w-[80px]">
                              Item Type
                              <span className="text-red-500 ml-1">*</span>
                            </label>
                            <div className="flex items-center px-1.5 py-1 bg-gray-50 rounded-lg border border-gray-200 w-fit">
                              <div className="relative flex items-center">
                                <div
                                  className={`absolute inset-y-0 rounded-md border shadow-sm transition-all duration-300 ${
                                    formik.values.item_type_id === 1
                                      ? "bg-white border-gray-300"
                                      : "bg-blue-500 border-blue-600"
                                  }`}
                                  style={{
                                    width: "96px",
                                    transform: `translateX(${
                                      formik.values.item_type_id === 1 ? "0px" : "96px"
                                    })`,
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => !isEditing && formik.setFieldValue("item_type_id", 1)}
                                  disabled={isEditing}
                                  className={`relative w-24 py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${
                                    formik.values.item_type_id === 1 ? 'text-gray-900' : 'text-gray-500'
                                  } ${isEditing ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                  Product
                                </button>
                                <button
                                  type="button"
                                  onClick={() => !isEditing && formik.setFieldValue("item_type_id", 2)}
                                  disabled={isEditing}
                                  className={`relative w-24 py-1.5 text-sm font-medium rounded-md transition-all duration-300 z-10 ${
                                    formik.values.item_type_id === 2 ? 'text-white' : 'text-gray-500'
                                  } ${isEditing ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                  Service
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Item Name and Category */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                {formik.values.item_type_id === 2 ? "Service Name" : "Item Name"}
                                <span className="text-red-500 ml-1">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder={formik.values.item_type_id === 2 ? "e.g., Mobile Service" : "e.g., Smart Lock Door"}
                                className={clsx(
                                  "w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition-all",
                                  formik.touched.item_name && formik.errors.item_name
                                    ? "border-red-500 bg-red-50"
                                    : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                                )}
                                {...formik.getFieldProps("item_name")}
                              />
                              {formik.touched.item_name && formik.errors.item_name && (
                                <div className="text-red-500 text-xs mt-1.5 font-medium">
                                  {formik.errors.item_name}
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Category
                                <span className="text-red-500 ml-1">*</span>
                              </label>
                              <select
                                className={clsx(
                                  "w-full px-4 py-2.5 border rounded-lg text-sm outline-none appearance-none transition-all",
                                  formik.touched.category_id && formik.errors.category_id
                                    ? "border-red-500 bg-red-50"
                                    : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                                )}
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
                                  <option key={cat.uuid} value={cat.uuid}>{cat.name}</option>
                                ))}
                                <option value="add_new" className="text-blue-600 font-medium">+ Add Category</option>
                              </select>
                              {formik.touched.category_id && formik.errors.category_id && (
                                <p className="text-red-500 text-xs mt-1.5 font-medium">
                                  {formik.errors.category_id}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Pricing Information */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="w-1 h-4 bg-green-500 rounded-full"></span>
                          Pricing Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Sales Price
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">₹</span>
                              <input
                                type="text"
                                placeholder="0.00"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className={clsx(
                                  "w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm outline-none transition-all",
                                  formik.touched.sales_price && formik.errors.sales_price
                                    ? "border-red-500 bg-red-50"
                                    : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
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
                              <div className="text-red-500 text-xs mt-1.5 font-medium">
                                {formik.errors.sales_price}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              GST Tax Rate
                            </label>
                            <select
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                      </div>

                      {/* Inventory Details */}
                      <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <span className="w-1 h-4 bg-purple-500 rounded-full"></span>
                          Inventory Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Measuring Unit
                            </label>
                            <select
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              value={formik.values.measuring_unit_id}
                              onChange={(e) => formik.setFieldValue("measuring_unit_id", Number(e.target.value))}
                            >
                              <option value={1}>Pieces (PCS)</option>
                              <option value={2}>Kilogram (KG)</option>
                              <option value={3}>Liter (LTR)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {formik.values.item_type_id === 2 ? "Service Code" : "Opening Stock"}
                              {formik.values.item_type_id === 2 && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {formik.values.item_type_id === 2 ? (
                              <>
                                <input
                                  type="text"
                                  placeholder="Enter Service Code"
                                  className={clsx(
                                    "w-full px-4 py-2.5 border rounded-lg text-sm outline-none transition-all",
                                    formik.touched.item_code && formik.errors.item_code
                                      ? "border-red-500 bg-red-50"
                                      : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                                  )}
                                  {...formik.getFieldProps("item_code")}
                                />
                                {formik.touched.item_code && formik.errors.item_code && (
                                  <div className="text-red-500 text-xs mt-1.5 font-medium">
                                    {formik.errors.item_code}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="0"
                                  className={clsx(
                                    "w-full px-4 py-2.5 pr-16 border rounded-lg text-sm outline-none transition-all",
                                    formik.touched.opening_stock && formik.errors.opening_stock
                                      ? "border-red-500 bg-red-50"
                                      : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                                  )}
                                  {...formik.getFieldProps("opening_stock")}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (/^\d*$/.test(value)) {
                                      formik.setFieldValue("opening_stock", value);
                                    }
                                  }}
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium bg-gray-50 px-2 py-1 rounded border border-gray-200">
                                  {formik.values.measuring_unit_id === 1 ? "PCS" : formik.values.measuring_unit_id === 2 ? "KG" : "LTR"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Stock Details Section */}
                  {activeSection === "stock" && (
                    <StockDetails formik={formik} isEditing={isEditing} isSubmitting={loading || isSubmittingRef.current} />
                  )}
                  {activeSection === "price" &&
                    formik.values.item_type_id === 1 && (
                      <PricingDetails formik={formik} />
                    )}
                  {activeSection === "product" &&
                    formik.values.item_type_id === 1 && (
                      <ProductImages formik={formik} />
                    )}
                  {activeSection === "other" &&
                    formik.values.item_type_id === 2 && (
                      <OtherDetails formik={formik} />
                    )}
                </form>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t">
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="flex-1 sm:flex-none text-[13px] sm:text-sm h-9 sm:h-10 px-4 sm:px-6 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="item-form"
                disabled={loading || formik.isSubmitting || isSubmittingRef.current}
                onClick={(e) => {
                  if (isSubmittingRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                className="flex-1 sm:flex-none min-w-[100px] sm:min-w-[120px] text-[13px] sm:text-sm h-9 sm:h-10 px-4 sm:px-6 bg-primary hover:bg-primary-hover transition-colors shadow-sm"
              >
                {loading || formik.isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-3 w-3 sm:h-4 sm:w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {isEditing ? "Updating..." : "Saving..."}
                  </span>
                ) : isEditing ? (
                  "Update Item"
                ) : (
                  "Save Item"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE CATEGORY MODAL */}
      <Dialog
        open={showCategoryModal}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setNewCategory("");
          }
          setShowCategoryModal(isOpen);
        }}
      >
        <DialogContent
          className={clsx(
            "max-w-md rounded-2xl p-6 shadow-2xl",
            categoryModalBounce ? "modal-bounce-in" : "",
          )}
        >
          {/* Remove DialogHeader spacing issue */}
          <DialogTitle className="mb-4 text-lg font-semibold text-gray-800 modal-slide-fade-in">
            Create New Category
          </DialogTitle>

          <div className="space-y-5 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-all duration-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:ring-offset-2"
              placeholder="Ex: Snacks"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-2 transition-all duration-500">
              <Button
                variant="outline"
                className="rounded-lg px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm h-9 md:h-10 transition-all duration-300 hover:scale-105 active:scale-95"
                onClick={() => {
                  setNewCategory("");
                  setShowCategoryModal(false);
                }}
                style={{ background: "white" }}
              >
                Cancel
              </Button>

              <Button
                className="rounded-lg bg-blue-600 px-4 md:px-5 py-1.5 md:py-2 text-xs md:text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 h-9 md:h-10 transition-all duration-300 hover:scale-105 active:scale-95 disabled:hover:scale-100"
                disabled={!newCategory}
                onClick={async () => {
                  try {
                    await createItemCategory(newCategory);
                    const updatedCategories = await getItemCategories();
                    setCategories(updatedCategories);

                    const newCategoryId = updatedCategories.find(
                      (c: ICategory) => c.name === newCategory,
                    )?.uuid;

                    if (newCategoryId) {
                      formik.setFieldValue("category_id", newCategoryId);
                    }

                    setNewCategory("");
                    setShowCategoryModal(false);
                  } catch (error: any) {
                    // console.error("Failed to create category", error);
                    const errorMessage =
                      error.response?.data?.message ||
                      error.response?.data?.errors ||
                      "Category with this name already exists.";
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
