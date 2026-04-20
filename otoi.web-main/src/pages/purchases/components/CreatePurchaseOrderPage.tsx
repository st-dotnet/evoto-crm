import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Save,
  X,
  UserPlus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpinnerDotted } from "spinners-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import axios from "axios";
import { toast } from "sonner";
import {
  createPurchaseOrder,
  getPurchaseOrderById,
  updatePurchaseOrder,
  getRecentPurchasePrices,
} from "../services/purchaseOrder.services";
import AddItemPage from "../../quotation/components/AdditemPage";
import CreateItemModal from "../../items/CreateItemModal";
import { updateItem } from "../../items/services/items.service";
import { useAuthContext } from "@/auth/useAuthContext";
import { resolveImageUrl } from "@/utils/imageUtils";

interface Vendor {
  id: string;
  name: string;
  uuid: string;
  mobile: string;
  company_name?: string;
  email?: string | null;
  gst?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
  [key: string]: any;
}

interface POFormData {
  poNo: string;
  poDate: string;
  deliveryDate: string;
  status: string;
}

interface POItem {
  id: string;
  item_id: string;
  item_name: string;
  image?: string | null;
  hsn_sac?: string;
  quantity: number;
  price_per_item: number;
  discount: number;
  tax: number;
  amount: number;
  measuring_unit_id?: number;
  description?: string | null;
  descriptionError?: string;
  purchasePriceMissing?: boolean;
}

interface InventoryItem {
  item_id: string;
  item_name: string;
  opening_stock: number;
  sales_price: number;
  purchase_price: number | null;
  type: string;
  category: string;
  hsn_code?: string | null;
  gst_tax_rate?: number;
  measuring_unit_id?: number;
  quantity?: number;
  image?: string | null;
}

const addDays = (date: string | number | Date, days: number) => {
  if (!date) return "";
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const diffDays = (
  start: string | number | Date,
  end: string | number | Date,
) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(
    Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)),
    0,
  );
};

const CreatePurchaseOrderPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { currentUser } = useAuthContext();
  const isEditMode = !!id;
  const isDuplicateMode = location.state?.isDuplicate;
  const today = new Date().toISOString().split("T")[0];

  const getAuthBusinessInfo = () => {
    try {
      const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
      if (authData) {
        const parsedAuth = JSON.parse(authData);
        if (parsedAuth && parsedAuth.user) {
          const user = parsedAuth.user;
          const business =
            parsedAuth.business ||
            parsedAuth.business_profile ||
            (user?.businesses && user.businesses[0]);

          if (business) {
            return {
              name: business.company_name || business.name || business.company || "Evoto Technologies",
              email: business.email || user.email,
              address: business.address || null,
              phone: business.phone_number || business.phone || business.mobile || user.phone || user.mobile,
            };
          }
        }
      }
    } catch (e) { }

    if (!currentUser) return null;

    const userBusiness = (currentUser as any).businesses?.[0];
    if (userBusiness) {
      return {
        name: userBusiness.name || userBusiness.company_name || "Evoto Technologies",
        email: currentUser.email,
        address: (currentUser as any).address || null,
        phone: userBusiness.phone_number || userBusiness.phone || userBusiness.mobile || (currentUser as any).phone || (currentUser as any).mobile,
      };
    }

    return {
      name: (currentUser as any).company_name || (currentUser as any).business_name || "Evoto Technologies",
      email: currentUser.email,
      address: (currentUser as any).address || null,
      phone: (currentUser as any).phone || (currentUser as any).mobile || "N/A",
    };
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isVendorsLoading, setIsVendorsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  useEffect(() => {
    const fetchBusinessProfile = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/user/profile`);
        const user = response.data.data || response.data;
        const business = user?.businesses?.[0] || user?.business_profile || user;

        setBusinessProfile({
          name: business?.company_name || business?.name || business?.business_name || user?.company_name || "Evoto Technologies",
          email: business?.email || user?.email,
          phone: business?.phone_number || business?.phone || business?.mobile || user?.phone || user?.mobile,
          address: [business?.address || user?.address, user?.city, user?.state, user?.country].filter(Boolean).join(", "),
          gst: business?.gst || business?.gstin || user?.gst || user?.gstin,
        });
      } catch (error) {
        console.error("Failed to fetch full business profile via API", error);
        // Fallback to the context data
        setBusinessProfile(getAuthBusinessInfo());
      }
    };
    fetchBusinessProfile();
  }, []);

  const [formData, setFormData] = useState<POFormData>({
    poNo: "",
    poDate: today,
    deliveryDate: addDays(today, 30),
    status: "open",
    ...location.state?.poData,
  });

  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [poItems, setPoItems] = useState<POItem[]>([]);

  const [notes, setNotes] = useState("");
  const [showNotesField, setShowNotesField] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [showTermsField, setShowTermsField] = useState(false);
  const [additionalCharges, setAdditionalCharges] = useState<
    { name: string; amount: number }[]
  >([]);
  const [showAdditionalChargesField, setShowAdditionalChargesField] =
    useState(false);
  const [newChargeName, setNewChargeName] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState(0);
  const [discount, setDiscount] = useState<{
    type: "percentage" | "amount";
    value: number;
  }>({
    type: "percentage",
    value: 0,
  });
  const [showDiscountField, setShowDiscountField] = useState(false);
  const [autoRoundOff] = useState(false);
  const [roundOffAmount] = useState(0);
  const [tax, setTax] = useState(18);

  // ── Purchase History ────────────────────────────────────────────────────────
  const [purchaseHistoryItem, setPurchaseHistoryItem] = useState<{
    itemId: string;
    itemName: string;
    vendorId: string;
  } | null>(null);
  const [purchaseHistoryData, setPurchaseHistoryData] = useState<
    { date: string; price: number }[]
  >([]);
  const [isLoadingPurchaseHistory, setIsLoadingPurchaseHistory] = useState(false);
  const [infoTooltipItemId, setInfoTooltipItemId] = useState<string | null>(null);

  const handleOpenPurchaseHistory = async (item: POItem) => {
    if (!selectedVendor?.uuid && !selectedVendor?.id) {
      toast.error("Please select a vendor first to see purchase history.");
      return;
    }
    if (!item.item_id) {
      toast.error("Please select a valid inventory item.");
      return;
    }
    const vId = selectedVendor.uuid || selectedVendor.id;
    setPurchaseHistoryItem({
      itemId: item.id,
      itemName: item.item_name,
      vendorId: vId,
    });
    setIsLoadingPurchaseHistory(true);
    try {
      const response = await getRecentPurchasePrices(
        String(item.item_id),
        String(vId)
      );
      if (response.success) {
        setPurchaseHistoryData(response.data || []);
      } else {
        toast.error("Failed to load purchase history");
      }
    } catch {
      toast.error("Failed to load purchase history");
    } finally {
      setIsLoadingPurchaseHistory(false);
    }
  };

  const PurchaseHistoryTooltip = ({ itemId: itemUuid, vendorId }: { itemId: string, vendorId?: string | null }) => {
    const item = poItems.find(i => i.id === itemUuid);
    if (!item) return null;

    return (
      <div className="relative">
        <TooltipProvider delayDuration={100}>
          <Tooltip
            open={purchaseHistoryItem?.itemId === item.id}
            onOpenChange={(isOpen) => {
              if (isOpen) {
                if (purchaseHistoryItem?.itemId !== item.id) {
                  handleOpenPurchaseHistory(item);
                }
              } else if (purchaseHistoryItem?.itemId === item.id) {
                setPurchaseHistoryItem(null);
              }
            }}
          >
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 hover:text-blue-700 bg-blue-50/50 px-2 py-1 rounded-md transition-all active:scale-95"
              >
                <Info className="h-3 w-3" />
                History
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="end"
              sideOffset={10}
              className="w-[320px] p-0 bg-[#1e2330] border border-gray-700 shadow-2xl rounded-xl text-left font-sans flex flex-col z-[100] overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 bg-[#252a38] border-b border-gray-700 flex justify-between items-center bg-gradient-to-r from-[#252a38] to-[#1e2330]">
                <h4 className="text-[11px] font-black text-white leading-snug uppercase tracking-widest opacity-90">
                  Last Purchase Prices
                </h4>
                <div className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded uppercase">{item.item_name}</div>
              </div>

              {/* Body */}
              <div className="p-0 z-10 relative bg-[#1e2330]">
                {isLoadingPurchaseHistory ? (
                  <div className="flex justify-center items-center py-8">
                    <SpinnerDotted size={24} color="#60a5fa" thickness={100} />
                  </div>
                ) : purchaseHistoryData.length === 0 ? (
                  <div className="py-8 px-4 text-center text-[12px] font-bold text-gray-500 italic">
                    No recent purchases found.
                  </div>
                ) : (
                  <>
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="border-b border-gray-700 bg-[#252a38]/50 text-gray-400">
                          <th className="px-4 py-2 text-left font-black uppercase tracking-widest">Date</th>
                          <th className="px-4 py-2 text-right font-black uppercase tracking-widest">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {purchaseHistoryData.map((ph, idx) => {
                          const d = ph.date ? new Date(ph.date) : null;
                          const dateStr = d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "N/A";
                          return (
                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-2.5 text-gray-300 font-medium">{dateStr}</td>
                              <td className="px-4 py-2.5 text-right text-white font-black">₹{ph.price?.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Footer */}
                    <div className="px-4 py-2 bg-[#252a38] text-center border-t border-gray-800">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">
                        Price excludes tax and discount
                      </p>
                    </div>
                  </>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  // ── Fetch vendors ───────────────────────────────────────────────────────────
  const fetchVendors = async () => {
    setIsVendorsLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/vendors/?items_per_page=1000`,
      );
      const vendorList = (response.data.data || []).map((v: any) => ({
        id: v.uuid,
        uuid: v.uuid,
        name:
          v.vendor_name ||
          v.company_name ||
          `${v.first_name || ""} ${v.last_name || ""}`.trim(),
        mobile: v.mobile || "",
        company_name: v.company_name || "",
        email: v.email || null,
        gst: v.gst || "",
        address1: v.address1 || "",
        address2: v.address2 || "",
        city: v.city || "",
        state: v.state || "",
        country: v.country || "",
        pin: v.pin || "",
      }));
      setVendors(vendorList);
    } catch {
      toast.error("Failed to fetch vendors");
    } finally {
      setIsVendorsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  // ── Load PO in edit mode ────────────────────────────────────────────────────
  const handleFetchPO = async (poId: string) => {
    setIsLoading(true);
    try {
      const response = await getPurchaseOrderById(poId);
      if (response.success && response.data) {
        const data = response.data;
        const poDate = data.po_date ? data.po_date.split("T")[0] : today;
        const deliveryDate = data.delivery_date
          ? data.delivery_date.split("T")[0]
          : addDays(poDate, 30);

        setFormData({
          poNo: data.po_number,
          poDate,
          deliveryDate,
          status: data.status || "open",
        });

        if (data.vendor) {
          setSelectedVendor({
            id: data.vendor.uuid,
            uuid: data.vendor.uuid,
            name: data.vendor.vendor_name || data.vendor.company_name || "",
            mobile: data.vendor.mobile || "",
            company_name: data.vendor.company_name || "",
            email: data.vendor.email || null,
            gst: data.vendor.gst || "",
            address1: data.vendor.address1 || "",
            city: data.vendor.city || "",
            state: data.vendor.state || "",
            country: data.vendor.country || "",
            pin: data.vendor.pin || "",
          });
        }

        if (data.items) {
          const mappedItems = data.items.map((item: any) => {
            let discountValue = 0;
            if (item.discount?.discount_percentage !== undefined) {
              discountValue = item.discount.discount_percentage;
            } else if (item.discount_percentage !== undefined) {
              discountValue = item.discount_percentage;
            }
            let taxValue = 0;
            if (item.tax?.tax_percentage !== undefined) {
              taxValue = item.tax.tax_percentage;
            } else if (item.tax_percentage !== undefined) {
              taxValue = item.tax_percentage;
            }
            return {
              id: item.uuid || item.id,
              item_id: item.item_id,
              item_name:
                item.product_name ||
                item.item_name ||
                item.description ||
                "Item",
              image: item.image,
              description: item.description || "",
              quantity: Number(item.quantity) || 1,
              price_per_item: Number(item.unit_price) || 0,
              discount: Number(discountValue) || 0,
              tax: Number(taxValue) || 0,
              amount: Number(item.total_price) || 0,
              measuring_unit_id: Number(item.measuring_unit_id) || 1,
            };
          });
          setPoItems(mappedItems);
          if (mappedItems.length > 0) setTax(mappedItems[0].tax);
        }

        const resolvedNotes = data.notes || data.additional_notes?.notes || "";
        const resolvedTerms =
          data.terms_and_conditions ||
          data.additional_notes?.terms_and_conditions ||
          "";
        setNotes(resolvedNotes);
        setTermsAndConditions(resolvedTerms);
        setShowNotesField(!!resolvedNotes);
        setShowTermsField(!!resolvedTerms);
      } else {
        toast.error("Failed to load purchase order details");
        navigate("/purchases/purchase-orders");
      }
    } catch {
      toast.error("Failed to load purchase order details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isEditMode && id) {
      handleFetchPO(id);
    }
  }, [id, isEditMode]);

  // ── Duplicate mode ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDuplicateMode && location.state?.poData) {
      const dupData = location.state.poData;
      setFormData({
        poNo: "",
        poDate: today,
        deliveryDate: addDays(today, 30),
        status: "open",
      });
      if (dupData.selectedVendor) {
        setSelectedVendor(dupData.selectedVendor);
      }
      if (dupData.poItems) {
        setPoItems(
          dupData.poItems.map((item: any) => ({
            id: `dup-${Date.now()}-${Math.random()}`,
            item_id: item.item_id || item.uuid,
            item_name: item.item_name || item.product_name || "Item",
            image: item.image,
            description: item.description || "",
            quantity: Number(item.quantity) || 1,
            price_per_item: Number(item.unit_price || item.price_per_item) || 0,
            discount: Number(item.discount) || 0,
            tax: Number(item.tax) || 0,
            amount: Number(item.total_price || item.amount) || 0,
            measuring_unit_id: Number(item.measuring_unit_id) || 1,
          })),
        );
        if (dupData.poItems.length > 0) setTax(dupData.poItems[0].tax || 18);
      }
      if (dupData.notes) {
        setNotes(dupData.notes);
        setShowNotesField(true);
      }
      if (dupData.terms) {
        setTermsAndConditions(dupData.terms);
        setShowTermsField(true);
      }
    }
  }, [isDuplicateMode, location.state]);

  // ── Calculations ────────────────────────────────────────────────────────────
  const calculateSubtotal = () =>
    poItems.reduce(
      (sum, item) =>
        sum + Math.round(item.quantity * item.price_per_item * 100) / 100,
      0,
    );

  const calculateDiscount = () =>
    Math.round(
      poItems.reduce(
        (sum, item) =>
          sum + (item.quantity * item.price_per_item * item.discount) / 100,
        0,
      ) * 100,
    ) / 100;

  const calculateTax = () =>
    Math.round(
      poItems.reduce((sum, item) => {
        const taxable =
          item.quantity * item.price_per_item * (1 - item.discount / 100);
        return sum + (taxable * item.tax) / 100;
      }, 0) * 100,
    ) / 100;

  const calculateOverallDiscount = () => {
    const subtotal = calculateSubtotal();
    return discount.type === "percentage"
      ? (subtotal * discount.value) / 100
      : discount.value;
  };

  const calculateTotal = () =>
    calculateSubtotal() - calculateDiscount() + calculateTax();

  const calculateFinalTotal = () => {
    const base =
      calculateSubtotal() -
      calculateDiscount() +
      calculateTax() +
      additionalCharges.reduce((s, c) => s + c.amount, 0) -
      calculateOverallDiscount();
    if (autoRoundOff) return Math.round(base);
    return base + roundOffAmount;
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsVendorDialogOpen(false);
  };

  // Update any existing items to reflect whether they have a purchase price for the selected vendor
  useEffect(() => {
    if (!selectedVendor) return;
    setPoItems((prev) =>
      prev.map((item) => ({
        ...item,
        purchasePriceMissing: !item.price_per_item,
      })),
    );
  }, [selectedVendor]);

  const filteredVendors = vendors.filter((v) => {
    const q = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.mobile && v.mobile.includes(searchQuery))
    );
  });

  const getMeasuringUnit = (unitId?: number) => {
    switch (unitId) {
      case 1:
        return "PCS";
      case 2:
        return "KG";
      case 3:
        return "LTR";
      case 4:
        return "MTR";
      default:
        return "PCS";
    }
  };

  const handleAddItems = (items: InventoryItem[]) => {
    const shouldShowMissingPriceMessage = Boolean(selectedVendor?.uuid || selectedVendor?.id);

    const newItems: POItem[] = items.map((item, index) => {
      const quantity = item.quantity || 1;
      const price = item.purchase_price || 0;
      const discount = 0;
      const taxRate = item.gst_tax_rate || 18;
      const amount =
        Math.round(
          quantity * price * (1 - discount / 100) * (1 + taxRate / 100) * 100,
        ) / 100;

      return {
        id: `item-${Date.now()}-${index}`,
        item_id: item.item_id,
        item_name: item.item_name,
        image: item.image,
        hsn_sac: item.hsn_code || "",
        quantity,
        price_per_item: price,
        discount,
        tax: taxRate,
        amount,
        measuring_unit_id: item.measuring_unit_id,
        purchasePriceMissing: shouldShowMissingPriceMessage && !item.purchase_price,
      };
    });

    setPoItems((prev) => [...prev, ...newItems]);
    setInfoTooltipItemId(null);
    toast.success(`${items.length} item(s) added`);
  };

  const handleCreateNewItem = () => {
    setShowAddItemModal(false);
    setShowCreateItemModal(true);
  };
  const handleItemCreated = () => {
    setShowCreateItemModal(false);
    setShowAddItemModal(true);
  };
  const handleRemoveItem = (itemId: string) =>
    setPoItems((prev) => prev.filter((i) => i.id !== itemId));

  const handleUpdateQuantity = (itemId: string, qty: number) =>
    setPoItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
            ...item,
            quantity: qty,
            amount:
              Math.round(
                qty *
                item.price_per_item *
                (1 - item.discount / 100) *
                (1 + item.tax / 100) *
                100,
              ) / 100,
          }
          : item,
      ),
    );

  const handleUpdatePrice = (itemId: string, price: number) =>
    setPoItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
            ...item,
            price_per_item: price,
            amount:
              Math.round(
                item.quantity *
                price *
                (1 - item.discount / 100) *
                (1 + item.tax / 100) *
                100,
              ) / 100,
          }
          : item,
      ),
    );

  const handleUpdateDiscount = (itemId: string, disc: number) =>
    setPoItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
            ...item,
            discount: disc,
            amount:
              Math.round(
                item.quantity *
                item.price_per_item *
                (1 - disc / 100) *
                (1 + item.tax / 100) *
                100,
              ) / 100,
          }
          : item,
      ),
    );

  const handleUpdateTax = (itemId: string, taxRate: number) => {
    setTax(taxRate);
    setPoItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
            ...item,
            tax: taxRate,
            amount:
              Math.round(
                item.quantity *
                item.price_per_item *
                (1 - item.discount / 100) *
                (1 + taxRate / 100) *
                100,
              ) / 100,
          }
          : item,
      ),
    );
  };

  const handleUpdateDescription = (itemId: string, desc: string) => {
    setPoItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, description: desc } : item
      )
    );
  };

  const handleAddAdditionalCharge = () => {
    if (newChargeName.trim() && newChargeAmount > 0) {
      setAdditionalCharges((prev) => [
        ...prev,
        { name: newChargeName, amount: newChargeAmount },
      ]);
      setNewChargeName("");
      setNewChargeAmount(0);
    }
  };

  const handleRemoveAdditionalCharge = (index: number) =>
    setAdditionalCharges((prev) => prev.filter((_, i) => i !== index));

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSavePO = async (navigateAfterSave = false): Promise<any> => {
    setIsSaving(true);
    try {
      const subtotal = calculateSubtotal();
      const totalDiscount = calculateDiscount();
      const totalTax = calculateTax();
      const totalAmount = calculateTotal();

      const submissionData = {
        ...formData,
        selectedVendor,
        poItems,
        notes,
        terms: termsAndConditions,
        subtotal,
        total_discount: totalDiscount,
        total_tax: totalTax,
        total_amount: totalAmount,
        additional_charges: additionalCharges.reduce((s, c) => s + c.amount, 0),
      };

      let response;
      if (isEditMode && id) {
        response = await updatePurchaseOrder(id, submissionData);
      } else {
        response = await createPurchaseOrder(submissionData);
      }

      if (response.success) {
        toast.success(
          isEditMode
            ? "Purchase order updated successfully!"
            : "Purchase order saved successfully!",
        );
        if (response.data?.po_number) {
          setFormData((prev) => ({ ...prev, poNo: response.data.po_number }));
        }

        // Update inventory items with the purchase prices from the PO
        if (selectedVendor) {
          const itemsToUpdate = Array.from(
            new Map(
              poItems.map((item) => [
                item.item_id,
                { item_id: item.item_id, price: item.price_per_item },
              ])
            ).values()
          );

          for (const item of itemsToUpdate) {
            try {
              await updateItem(item.item_id, {
                purchase_price: item.price,
              });
            } catch (error) {
              console.error(
                `Failed to update purchase price for item ${item.item_id}:`,
                error
              );
            }
          }
        }

        if (navigateAfterSave && id) {
          navigate(`/purchases/purchase-orders/${id}`);
        }
        return response.data;
      } else {
        toast.error(response.error || "Failed to save purchase order");
        return null;
      }
    } catch {
      toast.error("Failed to save purchase order");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6 relative">
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <SpinnerDotted
            size={50}
            thickness={100}
            speed={100}
            color="#1B84FF"
          />
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-[70px] z-[20] flex flex-col md:flex-row items-start md:items-center justify-between bg-white border-b border-gray-200 px-4 py-3 gap-3 shadow-md md:shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowConfirmModal(true)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg md:text-2xl font-black text-gray-800 tracking-tight truncate">
            {isEditMode ? "Edit PO" : "Create Purchase Order"}
          </h1>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            type="button"
            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-black text-sm gap-2 px-6 py-2.5 rounded-xl shadow-lg shadow-blue-100 active:scale-95 transition-all"
            disabled={isSaving}
            onClick={async () => {
              if (!selectedVendor) {
                toast.error("Please select a Party");
                return;
              }
              if (poItems.length === 0) {
                toast.error("Add at least one item");
                return;
              }
              if (isEditMode) {
                await handleSavePO(true);
                return;
              }
              const saved = await handleSavePO(false);
              if (!saved) return;
              navigate(`/purchases/purchase-orders/${saved.uuid || saved.id}`);
            }}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Purchase Order"}
          </Button>
        </div>
      </div>

      {/* ── Top grid: Bill To + PO Details ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 pb-4">
        {/* Bill To */}
        <div className="lg:col-span-4 bg-white border rounded-xl p-5 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Vendor</h3>
              {selectedVendor ? (
                <div className="border rounded-xl min-h-[180px] p-4 bg-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {selectedVendor.name}
                      </h4>
                      <div className="mt-2 text-sm text-gray-700 space-y-1">
                        {selectedVendor.company_name && (
                          <p className="font-medium">
                            {selectedVendor.company_name}
                          </p>
                        )}
                        {selectedVendor.mobile && (
                          <p className="text-gray-600">
                            <span className="font-medium">Phone:</span>{" "}
                            {selectedVendor.mobile}
                          </p>
                        )}
                        {selectedVendor.email && (
                          <p className="text-gray-600">
                            <span className="font-medium">Email:</span>{" "}
                            {selectedVendor.email}
                          </p>
                        )}
                        {selectedVendor.gst && (
                          <p className="text-gray-600">
                            <span className="font-medium">GST:</span>{" "}
                            {selectedVendor.gst}
                          </p>
                        )}
                        {selectedVendor.address1 && (
                          <p className="text-gray-600">
                            <span className="font-medium">Address:</span>{" "}
                            {selectedVendor.address1}
                          </p>
                        )}
                        {(selectedVendor.city ||
                          selectedVendor.state ||
                          selectedVendor.country) && (
                            <p className="text-gray-600">
                              {[
                                selectedVendor.city,
                                selectedVendor.state,
                                selectedVendor.country,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                              {selectedVendor.pin
                                ? ` - ${selectedVendor.pin}`
                                : ""}
                            </p>
                          )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsVendorDialogOpen(true)}
                      className="h-8"
                    >
                      Change Vendor
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl min-h-[180px] flex flex-col items-center justify-center bg-gray-50 p-4">
                  <Button
                    type="button"
                    onClick={() => setIsVendorDialogOpen(true)}
                    variant="outline"
                    className="gap-2 border-dashed text-indigo-600 hover:bg-indigo-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Vendor
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    Search and select a vendor
                  </p>
                </div>
              )}
            </div>

            {/* Delivery address placeholder */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Deliver To
              </h3>
              {selectedVendor ? (
                (() => {
                  const businessInfo = businessProfile || getAuthBusinessInfo();
                  return (
                    <div className="border rounded-xl min-h-[180px] p-4 bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {businessInfo?.name || "N/A"}
                          </h4>
                          <div className="mt-2 text-sm text-gray-700 space-y-1">
                            {businessInfo?.phone && (
                              <p className="text-gray-600">
                                <span className="font-medium">Phone:</span>{" "}
                                {businessInfo.phone}
                              </p>
                            )}
                            {businessInfo?.email && (
                              <p className="text-gray-600">
                                <span className="font-medium">Email:</span>{" "}
                                {businessInfo.email}
                              </p>
                            )}
                            {businessInfo?.gst && (
                              <p className="text-gray-600">
                                <span className="font-medium">GST:</span>{" "}
                                {businessInfo.gst}
                              </p>
                            )}
                            {businessInfo?.address && (
                              <p className="text-gray-600">
                                <span className="font-medium">Address:</span>{" "}
                                {businessInfo.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="border-2 border-dashed rounded-xl min-h-[180px] bg-gray-50 flex items-center justify-center p-4">
                  <p className="text-sm text-gray-400">
                    Delivery address will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PO Details sidebar */}
        <div className="lg:col-span-1 bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            PO Details
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {isEditMode && (
              <div className="space-y-1.5 col-span-2">
                <label className="text-xs text-gray-600">PO No.</label>
                <Input
                  name="poNo"
                  value={formData.poNo}
                  onChange={handleChange}
                  className="h-8 text-sm"
                  readOnly
                  disabled
                />
              </div>
            )}
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs text-gray-600">PO Date</label>
              <Input
                type="date"
                name="poDate"
                value={formData.poDate}
                onChange={handleChange}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs text-gray-600">
                Expected Delivery Date
              </label>
              <Input
                type="date"
                name="deliveryDate"
                value={formData.deliveryDate}
                onChange={handleChange}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs text-gray-600">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full h-8 text-sm px-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Vendor Selection Dialog ──────────────────────────────────────── */}
        <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-lg border border-gray-200 shadow-lg">
            <DialogHeader className="bg-white px-6 py-4 border-b">
              <DialogTitle className="text-lg font-semibold text-gray-800">
                Select Vendor
              </DialogTitle>
            </DialogHeader>
            <div className="p-6 space-y-5">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                  placeholder="Search vendors by name or mobile..."
                  className="pl-10 h-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="max-h-[300px] overflow-y-auto">
                  {isVendorsLoading ? (
                    <div className="p-8 text-center">
                      <SpinnerDotted size={20} />
                      <p className="mt-3 text-sm text-gray-500">
                        Loading vendors...
                      </p>
                    </div>
                  ) : filteredVendors.length === 0 ? (
                    <div className="p-8 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                        <UserPlus className="h-5 w-5 text-gray-600" />
                      </div>
                      <h3 className="mt-3 text-sm font-medium text-gray-900">
                        No vendor found
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Add vendors from the Parties section.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {filteredVendors.map((vendor) => (
                        <li
                          key={vendor.id}
                          className={`group relative p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedVendor?.id === vendor.id ? "bg-gray-100" : ""}`}
                          onClick={() => handleSelectVendor(vendor)}
                        >
                          <div className="flex items-center">
                            <div
                              className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center ${selectedVendor?.id === vendor.id ? "bg-green-100" : "bg-gray-100"}`}
                            >
                              <span
                                className={`font-medium text-sm ${selectedVendor?.id === vendor.id ? "text-green-700" : "text-gray-600"}`}
                              >
                                {vendor.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="font-medium text-gray-900">
                                {vendor.name}
                              </div>
                              {vendor.company_name && (
                                <div className="text-xs text-gray-500">
                                  {vendor.company_name}
                                </div>
                              )}
                              {vendor.mobile && (
                                <div className="text-sm text-gray-500">
                                  {vendor.mobile}
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Confirm Leave Dialog ─────────────────────────────────────────── */}
        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
          <DialogContent className="sm:max-w-[400px] p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <DialogTitle className="text-lg font-semibold text-gray-900">
                Unsaved Changes
              </DialogTitle>
              <p className="text-sm text-gray-500">
                You have unsaved changes. Are you sure you want to leave?
              </p>
            </div>
            <DialogFooter className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowConfirmModal(false);
                  navigate(-1);
                }}
              >
                Discard Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Items Table ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">
              Items / Services
            </h3>
            <Button
              size="sm"
              className="gap-2 h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              onClick={() => setShowAddItemModal(true)}
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 w-16">
                  No.
                </th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 w-20">
                  Image
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 w-[250px]">
                  Item / Service Details
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 w-28">
                  HSN/SAC
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 w-32">
                  Quantity
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 w-36">
                  Price/Item (₹)
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 w-32">
                  Discount
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 w-28">
                  Tax
                </th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-700 uppercase border-r border-gray-200 w-36">
                  Amount (₹)
                </th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-700 uppercase w-16">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {poItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-20">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="text-center">
                        <h4 className="text-sm font-medium text-gray-900 mb-1">
                          No items added yet
                        </h4>
                        <p className="text-xs text-gray-500 mb-4">
                          Get started by adding your first item to the purchase
                          order
                        </p>
                        <button
                          onClick={() => setShowAddItemModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                        >
                          <Plus className="h-4 w-4" />
                          Add Your First Item
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                poItems.map((item, index) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50/70 transition-colors group"
                  >
                    <td className="px-3 py-2 text-sm font-medium text-gray-600 border-r border-gray-200">
                      {index + 1}
                    </td>

                    {/* Image Column */}
                    <td className="px-3 py-2 text-center border-r border-gray-200">
                      {item.image ? (
                        <div className="w-10 h-10 mx-auto rounded-md overflow-hidden border border-gray-100 shadow-sm">
                          <img
                            src={resolveImageUrl(item.image)}
                            alt={item.item_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://placehold.co/40x40?text=No+Img';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 mx-auto bg-gray-50 rounded-md flex items-center justify-center border border-gray-100">
                          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 border-r border-gray-200">
                      <div
                        className="space-y-1"
                        style={{ marginTop: "0.7rem" }}
                      >
                        <div
                          className="text-sm text-gray-900 truncate max-w-[250px]"
                          title={item.item_name}
                        >
                          {item.item_name}
                        </div>
                        <div className="relative">
                          <textarea
                            value={item.description || ""}
                            onChange={(e) => {
                              const text = e.target.value;
                              if (text.length <= 50) {
                                setPoItems((prev) =>
                                  prev.map((pi) =>
                                    pi.id === item.id
                                      ? {
                                        ...pi,
                                        description: text,
                                        descriptionError: "",
                                      }
                                      : pi,
                                  ),
                                );
                              } else {
                                setPoItems((prev) =>
                                  prev.map((pi) =>
                                    pi.id === item.id
                                      ? {
                                        ...pi,
                                        descriptionError:
                                          "Maximum limit 50 characters reached",
                                      }
                                      : pi,
                                  ),
                                );
                              }
                            }}
                            placeholder="Add item description..."
                            className="w-full px-2 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-blue-200 focus:bg-white transition-colors"
                            rows={1}
                          />
                          {item.descriptionError && (
                            <div className="absolute -bottom-3 left-0 text-xs text-red-600 bg-white z-10">
                              {item.descriptionError}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700 border-r border-gray-200 text-center">
                      <span
                        className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-mono text-xs"
                        style={{ marginTop: "-0.2rem" }}
                      >
                        {item.hsn_sac || "N/A"}
                      </span>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 align-top">
                      <div
                        className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-blue-200"
                        style={{ marginTop: "0.7rem" }}
                      >
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onKeyDown={(e) =>
                            ["-", "+", "e", "E"].includes(e.key) &&
                            e.preventDefault()
                          }
                          onChange={(e) =>
                            handleUpdateQuantity(
                              item.id,
                              parseInt(e.target.value) || 1,
                            )
                          }
                          className="w-full px-2 py-1.5 text-sm text-center text-gray-900 border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="px-2 py-1.5 bg-gray-100 text-xs font-semibold text-gray-600 border-l border-gray-300">
                          {getMeasuringUnit(item.measuring_unit_id)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <PurchaseHistoryTooltip itemId={item.id} vendorId={selectedVendor?.id} />
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 align-top">
                      <div className="flex items-center" style={{ marginTop: "0.7rem" }}>
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                            ₹
                          </span>
                          {(item.purchasePriceMissing || !selectedVendor) ? (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip
                                open={infoTooltipItemId === item.id}
                                onOpenChange={(isOpen) =>
                                  setInfoTooltipItemId(isOpen ? item.id : null)
                                }
                              >
                                <TooltipTrigger asChild>
                                  {/* SAME INPUT wrapped */}
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.price_per_item}
                                    onFocus={() => setInfoTooltipItemId(item.id)}
                                    onKeyDown={(e) =>
                                      ["-", "+", "e", "E"].includes(e.key) &&
                                      e.preventDefault()
                                    }
                                    onChange={(e) =>
                                      handleUpdatePrice(
                                        item.id,
                                        parseFloat(e.target.value),
                                      )
                                    }
                                    className="w-full pl-5 pr-2 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200"
                                  />
                                </TooltipTrigger>

                                <TooltipContent
                                  side="top"
                                  align="center"
                                  sideOffset={8}
                                  className="bg-gray-900 text-white text-xs px-3 py-2 rounded-md shadow-lg min-w-[240px]"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span>
                                      {selectedVendor
                                        ? "No purchase price found for this party in the last one year."
                                        : "Select party to check pricing history."}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => setInfoTooltipItemId(null)}
                                      className="text-white/70 hover:text-white"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            // Normal input when no tooltip needed
                            <input
                              type="number"
                              min="0"
                              value={item.price_per_item}
                              onKeyDown={(e) =>
                                ["-", "+", "e", "E"].includes(e.key) &&
                                e.preventDefault()
                              }
                              onChange={(e) =>
                                handleUpdatePrice(
                                  item.id,
                                  parseFloat(e.target.value),
                                )
                              }
                              className="w-full pl-5 pr-2 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200"
                            />
                          )}
                        </div>
                        <div className="relative ml-2">
                          <PurchaseHistoryTooltip itemId={item.id} vendorId={selectedVendor?.id} />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 align-top">
                      <div
                        className="flex flex-col items-start"
                        style={{ marginTop: "0.7rem" }}
                      >
                        <div className="relative w-full">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount ?? 0}
                            onKeyDown={(e) =>
                              ["-", "+", "e", "E"].includes(e.key) &&
                              e.preventDefault()
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              handleUpdateDiscount(
                                item.id,
                                v === "" ? 0 : Math.min(100, parseFloat(v)),
                              );
                            }}
                            className="w-full pl-6 pr-2 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                            %
                          </span>
                        </div>
                        <div className="min-h-3 text-[10px] font-medium text-red-600 text-right leading-tight mt-0.5 w-full">
                          {item.discount > 0
                            ? `-₹${((item.quantity * item.price_per_item * item.discount) / 100).toFixed(2)}`
                            : ""}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 align-top">
                      <div
                        className="flex flex-col items-start"
                        style={{ marginTop: "0.7rem" }}
                      >
                        <select
                          value={item.tax}
                          onChange={(e) =>
                            handleUpdateTax(
                              item.id,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full px-2 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-200"
                        >
                          <option value="">None</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                        <div className="min-h-3 text-[10px] font-medium text-green-600 text-right leading-tight mt-0.5 w-full">
                          {item.tax > 0
                            ? `+₹${((item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100).toFixed(2)}`
                            : ""}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center border-r border-gray-200">
                      <div
                        className="text-sm text-gray-900"
                        style={{ marginTop: "-0.2rem" }}
                      >
                        ₹
                        {item.amount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="inline-flex items-center justify-center w-7 h-7 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-4 border-r border-gray-200"
                ></td>
                <td className="px-4 py-4 text-sm font-semibold text-gray-900 text-right border-r border-gray-200">
                  Subtotal
                </td>
                <td className="px-4 py-4 text-right text-sm font-medium text-red-600 border-r border-gray-200">
                  {calculateDiscount() > 0 &&
                    `-₹${calculateDiscount().toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                </td>
                <td className="px-4 py-4 text-right text-sm font-medium text-green-600 border-r border-gray-200">
                  {calculateTax() > 0 &&
                    `+₹${calculateTax().toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                </td>
                <td className="px-4 py-4 text-sm text-gray-900 text-right border-r border-gray-200">
                  ₹
                  {calculateTotal().toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-4 py-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Item Cards */}
        <div className="md:hidden space-y-4 p-4 bg-gray-50/50">
          {poItems.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center gap-3 bg-white rounded-xl border-2 border-dashed border-gray-200">
              <Plus className="h-10 w-10 text-gray-200" />
              <div>
                <p className="text-sm font-black text-gray-900 tracking-tight uppercase">No items added</p>
                <p className="text-xs text-gray-400 font-bold">Add an item to get started</p>
              </div>
            </div>
          ) : (
            poItems.map((item, index) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm shadow-blue-500/5">
                <div className="p-4 border-b border-gray-100 flex justify-between items-start gap-4 bg-gradient-to-br from-white to-gray-50/30">
                  <div className="flex gap-3 overflow-hidden">
                    <div className="shrink-0 w-12 h-12 rounded-lg border border-gray-100 bg-white flex items-center justify-center text-gray-300 shadow-sm">
                      {item.image ? (
                        <img src={resolveImageUrl(item.image)} alt="" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Plus className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-black text-gray-900 text-[13px] truncate leading-tight uppercase tracking-tight">{item.item_name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">HSN: {item.hsn_sac || "—"}</span>
                        <span className="text-[11px] font-black text-blue-600">₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 -mr-1 rounded-full"
                    onClick={() => handleRemoveItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="p-4 bg-white space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest ml-1">Quantity</label>
                      <div className="flex items-center bg-gray-50/50 border border-gray-200 rounded-lg overflow-hidden h-9">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 0)}
                          className="w-full px-2 text-sm font-black bg-transparent text-center focus:outline-none"
                        />
                        <span className="px-3 h-full flex items-center text-[10px] font-black text-gray-400 bg-white border-l border-gray-200 uppercase whitespace-nowrap">
                          {getMeasuringUnit(item.measuring_unit_id)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest ml-1">Price/Item</label>
                      <div className="relative h-9">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">₹</span>
                        <input
                          type="number"
                          value={item.price_per_item}
                          onChange={(e) => handleUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full pl-6 pr-2 h-full text-sm font-black bg-gray-50/50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 text-right"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest ml-1">Discount (%)</label>
                      <div className="relative h-9 group">
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) => handleUpdateDiscount(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full pr-7 h-full text-sm font-black bg-gray-50/50 border border-gray-200 rounded-lg text-right focus:ring-2 focus:ring-blue-100"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 group-focus-within:text-blue-500">%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest ml-1">Tax Rate</label>
                      <select
                        value={item.tax}
                        onChange={(e) => handleUpdateTax(item.id, parseFloat(e.target.value) || 0)}
                        className="w-full h-9 px-2 text-sm font-black bg-gray-50/50 border border-gray-200 rounded-lg focus:outline-none appearance-none cursor-pointer"
                      >
                        {[0, 5, 12, 18, 28].map(t => (
                          <option key={t} value={t}>{t}% Tax</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-black text-gray-400 tracking-widest ml-1">Description</label>
                    <textarea
                      placeholder="Add specific details..."
                      value={item.description || ""}
                      onChange={(e) => handleUpdateDescription(item.id, e.target.value)}
                      className="w-full text-xs font-bold text-gray-600 bg-gray-50/50 border border-gray-200 rounded-lg p-3 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all resize-none min-h-[50px]"
                      rows={1}
                    />
                  </div>

                  <div className="pt-2 border-t border-gray-50 flex items-center justify-between">
                    <PurchaseHistoryTooltip itemId={item.item_id} vendorId={selectedVendor?.id} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Notes / Terms / Totals ─────────────────────────────────────── */}
        <div className="lg:col-span-4 grid grid-cols-1 lg:grid-cols-2 gap-5 p-5">
          <div className="p-4 space-y-4">
            {!showNotesField ? (
              <button
                onClick={() => setShowNotesField(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> Add Notes
              </button>
            ) : (
              <div className="space-y-2 bg-white border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Notes
                  </label>
                  <button
                    onClick={() => {
                      setShowNotesField(false);
                      setNotes("");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes here..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            )}

            {!showTermsField ? (
              <button
                onClick={() => setShowTermsField(true)}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> Add Terms and Conditions
              </button>
            ) : (
              <div className="space-y-2 bg-white border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-gray-700">
                    Terms and Conditions
                  </label>
                  <button
                    onClick={() => {
                      setShowTermsField(false);
                      setTermsAndConditions("");
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  placeholder="Enter terms and conditions..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            )}
          </div>

          {poItems.length > 0 && (
            <div className="space-y-5">
              <div className="bg-white border rounded-lg p-5 space-y-3">
                {/* Additional Charges */}
                {!showAdditionalChargesField ? (
                  <button
                    onClick={() => setShowAdditionalChargesField(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Additional Charges
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Charge name"
                      value={newChargeName}
                      onChange={(e) => setNewChargeName(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="relative w-28">
                      <span className="absolute left-3 top-2.5 text-sm text-gray-500">
                        ₹
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={newChargeAmount || ""}
                        onChange={(e) =>
                          setNewChargeAmount(parseFloat(e.target.value) || 0)
                        }
                        className="w-full pl-6 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleAddAdditionalCharge}
                      disabled={!newChargeName.trim() || newChargeAmount <= 0}
                      className="h-9"
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowAdditionalChargesField(false);
                        setNewChargeName("");
                        setNewChargeAmount(0);
                      }}
                      className="h-9 w-9 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {additionalCharges.map((charge, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-sm py-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{charge.name}</span>
                      <button
                        onClick={() => handleRemoveAdditionalCharge(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="font-medium">
                      ₹ {charge.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}

                <div className="flex justify-between items-center text-sm py-2 border-t border-gray-200">
                  <span className="text-gray-700 font-medium">
                    Taxable Amount
                  </span>
                  <span className="font-semibold">
                    ₹{" "}
                    {(calculateSubtotal() - calculateDiscount()).toLocaleString(
                      "en-IN",
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm py-2">
                  <span className="text-gray-700">{(currentUser as any)?.isUT ? 'UTGST' : 'SGST'}@{tax / 2}</span>
                  <span className="font-medium">
                    ₹ {((calculateSubtotal() - calculateDiscount()) * (tax / 2) / 100).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm py-2">
                  <span className="text-gray-700">CGST@{tax / 2}</span>
                  <span className="font-medium">
                    ₹ {((calculateSubtotal() - calculateDiscount()) * (tax / 2) / 100).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                {/* Overall discount */}
                {!showDiscountField ? (
                  <button
                    onClick={() => setShowDiscountField(true)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                  >
                    <Plus className="h-4 w-4" /> Add Discount
                  </button>
                ) : (
                  <div className="flex justify-between items-center py-2 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-700">Discount:</span>
                      <select
                        value={discount.type}
                        onChange={(e) =>
                          setDiscount({
                            ...discount,
                            type: e.target.value as "percentage" | "amount",
                          })
                        }
                        className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="percentage">%</option>
                        <option value="amount">₹</option>
                      </select>
                      <input
                        type="number"
                        value={discount.value || ""}
                        onChange={(e) =>
                          setDiscount({
                            ...discount,
                            value: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                      />
                      <button
                        onClick={() => {
                          setShowDiscountField(false);
                          setDiscount({ type: "percentage", value: 0 });
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-sm font-medium text-red-600">
                      - ₹{" "}
                      {calculateOverallDiscount().toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-300">
                  <span className="text-base font-bold text-gray-800">
                    Total Amount
                  </span>
                  <span className="text-xl font-bold text-gray-900">
                    ₹{" "}
                    {calculateFinalTotal().toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AddItemPage
        open={showAddItemModal}
        onOpenChange={setShowAddItemModal}
        onAddItems={handleAddItems}
        onCreateNewItem={handleCreateNewItem}
      />
      <CreateItemModal
        open={showCreateItemModal}
        onOpenChange={setShowCreateItemModal}
        onSuccess={handleItemCreated}
        item={null}
      />
    </div>
  );
};

export default CreatePurchaseOrderPage;
