import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  X,
  Search,
  MapPin,
  Calendar,
  MoreVertical,
  Info,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpinnerDotted } from "spinners-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import axios from "axios";
import { toast } from "sonner";
import {
  createPurchaseInvoice,
  getPurchaseInvoiceById,
  updatePurchaseInvoice,
} from "../services/purchaseInvoice.services";
import AddItemPage from "../../quotation/components/AdditemPage";
import CreateItemModal from "../../items/CreateItemModal";
import { useAuthContext } from "@/auth/useAuthContext";

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
  first_name?: string;
  last_name?: string;
  contact_person?: string;
  [key: string]: any;
}

interface InvoiceFormData {
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
}

interface InvoiceItem {
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
}

interface InventoryItem {
  item_id: string;
  item_name: string;
  image?: string | null;
  opening_stock: number;
  sales_price: number;
  purchase_price: number | null;
  type: string;
  category: string;
  hsn_code?: string | null;
  gst_tax_rate?: number;
  measuring_unit_id?: number;
  quantity?: number;
}

const addDays = (date: string | number | Date, days: number) => {
  if (!date) return "";
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const CreatePurchaseInvoicePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { currentUser } = useAuthContext();
  const isEditMode = !!id;
  const isFromPurchaseOrder = location.state?.fromPurchaseOrder;
  const today = new Date().toISOString().split("T")[0];

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isVendorsLoading, setIsVendorsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPartyDialogOpen, setIsPartyDialogOpen] = useState(false);

  // Business Profile
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState<InvoiceFormData>({
    invoiceNo: "",
    invoiceDate: today,
    dueDate: addDays(today, 30),
    status: "unpaid",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Financial States
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [showNotesField, setShowNotesField] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [showTermsField, setShowTermsField] = useState(false);
  const [isFullyPaid, setIsFullyPaid] = useState(false);
  const [autoRoundOff, setAutoRoundOff] = useState(false);
  const [roundOffAmount, setRoundOffAmount] = useState(0);
  const [tax, setTax] = useState(18);

  const [additionalCharges, setAdditionalCharges] = useState<{ name: string; amount: number }[]>([]);
  const [showAdditionalChargesField, setShowAdditionalChargesField] = useState(false);
  const [newChargeName, setNewChargeName] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState(0);

  const [discount, setDiscount] = useState<{ type: "percentage" | "amount"; value: number }>({
    type: "percentage",
    value: 0,
  });
  const [showDiscountField, setShowDiscountField] = useState(false);

  // ── Fetch business profile ───────────────────────────────────────────────────
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
          address1: business?.address || user?.address,
          city: user?.city,
          state: user?.state,
          country: user?.country,
          pin: user?.pin,
          gst: business?.gst || business?.gstin || user?.gst || user?.gstin,
        });
      } catch (error) {
        console.error("Failed to fetch full business profile via API", error);
      }
    };
    fetchBusinessProfile();
  }, []);

  // ── Fetch vendors ───────────────────────────────────────────────────────────
  const fetchVendors = useCallback(async () => {
    setIsVendorsLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_APP_API_URL}/vendors/?items_per_page=1000`,
      );
      const vendorList = (response.data.data || []).map((v: any) => ({
        id: v.uuid,
        uuid: v.uuid,
        name: v.vendor_name || v.company_name || `${v.first_name || ""} ${v.last_name || ""}`.trim(),
        first_name: v.first_name || v.vendor_name || "",
        last_name: v.last_name || "",
        company_name: v.company_name || "",
        contact_person: v.contact_person || v.first_name || "",
        mobile: v.mobile || "",
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
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const fetchPurchaseInvoice = async (invoiceId: string) => {
    setIsLoading(true);
    try {
      const response = await getPurchaseInvoiceById(invoiceId);
      if (response.success && response.data) {
        const data = response.data;
        const invoiceDate = data.invoice_date ? data.invoice_date.split('T')[0] : today;
        const dueDate = data.due_date ? data.due_date.split('T')[0] : "";

        setFormData({
          invoiceNo: data.invoice_number || "",
          invoiceDate,
          dueDate,
          status: data.payment_status || "unpaid",
        });

        setAmountPaid(Number(data.amount_paid) || 0);
        setIsFullyPaid(Number(data.balance_due) === 0);

        if (data.vendor_id) {
          const vendorRes = await axios.get(`${import.meta.env.VITE_APP_API_URL}/vendors/${data.vendor_id}`);
          if (vendorRes.data) {
            const v = vendorRes.data;
            setSelectedVendor({
              id: v.uuid,
              uuid: v.uuid,
              name: v.vendor_name || v.company_name || `${v.first_name || ""} ${v.last_name || ""}`.trim(),
              first_name: v.first_name || v.vendor_name || "",
              last_name: v.last_name || "",
              company_name: v.company_name || "",
              contact_person: v.contact_person || v.first_name || "",
              mobile: v.mobile || "",
              email: v.email || null,
              gst: v.gst || "",
              address1: v.address1 || "",
              address2: v.address2 || "",
              city: v.city || "",
              state: v.state || "",
              country: v.country || "",
              pin: v.pin || "",
            });
          }
        }

        if (data.items) {
          const mappedItems = data.items.map((item: any) => ({
            id: item.uuid || item.id,
            item_id: item.item_id,
            item_name: item.item_name || item.product_name || "Item",
            image: item.image,
            hsn_sac: item.hsn_sac || "",
            quantity: Number(item.quantity) || 1,
            price_per_item: Number(item.unit_price) || 0,
            discount: Number(item.discount_percentage) || 0,
            tax: Number(item.tax_percentage) || 18,
            amount: Number(item.total_price) || 0,
            measuring_unit_id: Number(item.measuring_unit_id) || 1,
            description: item.description || "",
          }));
          setInvoiceItems(mappedItems);
          if (mappedItems.length > 0) setTax(mappedItems[0].tax);
        }

        setNotes(data.additional_notes?.notes || "");
        setTermsAndConditions(data.additional_notes?.terms_and_conditions || "");
        setShowNotesField(!!data.additional_notes?.notes);
        setShowTermsField(!!data.additional_notes?.terms_and_conditions);
      }
    } catch (error) {
      toast.error("Failed to load invoice details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isEditMode && id) {
      fetchPurchaseInvoice(id);
    }
  }, [id, isEditMode]);

  // Handle incoming data from Purchase Order
  useEffect(() => {
    if (isFromPurchaseOrder && location.state?.purchaseOrderData && !isEditMode) {
      const poData = location.state.purchaseOrderData;

      if (poData.selectedVendor) {
        const v = poData.selectedVendor;
        setSelectedVendor({
          ...v,
          id: v.uuid || v.id,
          name: v.vendor_name || v.company_name || v.name || "",
        });
      }

      if (poData.poItems) {
        const mappedItems = poData.poItems.map((item: any) => ({
          ...item,
          id: item.id || `po-item-${Date.now()}-${Math.random()}`,
          item_name: item.item_name || item.product_name || "Item",
        }));
        setInvoiceItems(mappedItems);
        if (mappedItems.length > 0) setTax(mappedItems[0].tax);
      }

      if (poData.notes) {
        setNotes(poData.notes);
        setShowNotesField(true);
      }

      if (poData.terms) {
        setTermsAndConditions(poData.terms);
        setShowTermsField(true);
      }
    }
  }, [isFromPurchaseOrder, location.state, isEditMode]);

  const filteredVendors = vendors.filter((v) => {
    const q = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.mobile && v.mobile.includes(searchQuery)) ||
      (v.company_name && v.company_name.toLowerCase().includes(q))
    );
  });

  // ── Calculations ────────────────────────────────────────────────────────────
  const calculateSubtotal = () => {
    return invoiceItems.reduce((sum, item) => {
      const amount = Math.round(item.quantity * item.price_per_item * 100) / 100;
      return sum + amount;
    }, 0);
  };

  const calculateDiscount = () => {
    const total = invoiceItems.reduce(
      (sum, item) => sum + (item.quantity * item.price_per_item * item.discount) / 100,
      0,
    );
    return Math.round(total * 100) / 100;
  };

  const calculateOverallDiscount = () => {
    const subtotal = calculateSubtotal();
    if (discount.type === "percentage") {
      return (subtotal * discount.value) / 100;
    } else {
      return discount.value;
    }
  };

  const calculateTax = () => {
    const totalTax = invoiceItems.reduce((sum, item) => {
      const taxableAmount = item.quantity * item.price_per_item * (1 - item.discount / 100);
      return sum + (taxableAmount * item.tax) / 100;
    }, 0);
    return Math.round(totalTax * 100) / 100;
  };

  const calculateTotalBeforeRoundOff = () => {
    const subtotal = calculateSubtotal();
    const itemDiscount = calculateDiscount();
    const taxAmount = calculateTax();
    const additionalChargesTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const overallDiscountAmount = calculateOverallDiscount();

    return (
      subtotal -
      itemDiscount -
      overallDiscountAmount +
      taxAmount +
      additionalChargesTotal
    );
  };

  const calculateFinalTotal = () => {
    const totalBeforeRound = calculateTotalBeforeRoundOff();
    if (autoRoundOff) {
      const rounded = Math.round(totalBeforeRound);
      // We don't set state in render
      return rounded;
    }
    return totalBeforeRound + roundOffAmount;
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsPartyDialogOpen(false);
  };

  const handleAddItems = (items: InventoryItem[]) => {
    const newItems: InvoiceItem[] = items.map((item, index) => {
      const quantity = 1;
      const price = item.purchase_price || 0;
      const disc = 0;
      const taxRate = item.gst_tax_rate || 18;
      const totalAmount = quantity * price * (1 - disc / 100) * (1 + taxRate / 100);

      return {
        id: `item-${Date.now()}-${index}`,
        item_id: item.item_id,
        item_name: item.item_name,
        image: item.image,
        hsn_sac: item.hsn_code || "",
        quantity,
        price_per_item: price,
        discount: disc,
        tax: taxRate,
        amount: Math.round(totalAmount * 100) / 100,
        measuring_unit_id: item.measuring_unit_id || 1,
        description: "",
      };
    });
    setInvoiceItems((prev) => [...prev, ...newItems]);
    if (newItems.length > 0) setTax(newItems[0].tax);
    toast.success(`${items.length} item(s) added`);
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const amount = Math.round((qty * item.price_per_item * (1 - item.discount / 100) * (1 + item.tax / 100)) * 100) / 100;
        return { ...item, quantity: qty, amount };
      }
      return item;
    }));
  };

  const handleUpdatePrice = (id: string, price: number) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const amount = Math.round((item.quantity * price * (1 - item.discount / 100) * (1 + item.tax / 100)) * 100) / 100;
        return { ...item, price_per_item: price, amount };
      }
      return item;
    }));
  };

  const handleUpdateDiscount = (id: string, disc: number) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const amount = Math.round((item.quantity * item.price_per_item * (1 - disc / 100) * (1 + item.tax / 100)) * 100) / 100;
        return { ...item, discount: disc, amount };
      }
      return item;
    }));
  };

  const handleUpdateTax = (id: string, taxRate: number) => {
    setTax(taxRate);
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const amount = Math.round((item.quantity * item.price_per_item * (1 - item.discount / 100) * (1 + taxRate / 100)) * 100) / 100;
        return { ...item, tax: taxRate, amount };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: string) => {
    setInvoiceItems(prev => prev.filter(item => item.id !== id));
  };

  const handleAddAdditionalCharge = () => {
    if (newChargeName.trim() && newChargeAmount > 0) {
      setAdditionalCharges(prev => [...prev, { name: newChargeName, amount: newChargeAmount }]);
      setNewChargeName("");
      setNewChargeAmount(0);
    }
  };

  const handleRemoveAdditionalCharge = (index: number) => {
    setAdditionalCharges(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveInvoice = async () => {
    if (!selectedVendor) {
      toast.error("Please select a Vendor");
      return;
    }
    if (invoiceItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setIsSaving(true);
    try {
      const finalTotal = calculateFinalTotal();
      const payload = {
        vendor_id: selectedVendor.uuid,
        purchase_invoice_number: formData.invoiceNo || undefined,
        invoice_date: formData.invoiceDate,
        due_date: formData.dueDate,
        total_amount: finalTotal,
        amount_paid: isFullyPaid ? finalTotal : amountPaid,
        balance_due: isFullyPaid ? 0 : Math.max(0, finalTotal - amountPaid),
        items: invoiceItems.map(item => ({
          item_id: item.item_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.price_per_item,
          discount_percentage: item.discount,
          tax_percentage: item.tax,
          total_price: item.amount,
          measuring_unit_id: item.measuring_unit_id
        })),
        notes: notes,
        terms_and_conditions: termsAndConditions,
        additional_charges: additionalCharges.reduce((s, c) => s + c.amount, 0),
        overall_discount: calculateOverallDiscount(),
        round_off: roundOffAmount,
        payment_status: isFullyPaid ? "paid" : (amountPaid > 0 ? "partial" : "unpaid"),
      };

      let response;
      if (isEditMode && id) {
        response = await updatePurchaseInvoice(id, payload);
      } else {
        response = await createPurchaseInvoice(payload);
      }

      if (response.success) {
        toast.success(`Purchase Invoice ${isEditMode ? "updated" : "created"} successfully!`);

        // Mark purchase order as converted if this invoice was created from a PO
        const poState = location.state as any;
        if (poState?.fromPurchaseOrder && poState?.purchaseOrderId && !isEditMode) {
          try {
            // Import purchase order service to update PO status
            const { updatePurchaseOrder } = await import("../services/purchaseOrder.services");
            await updatePurchaseOrder(poState.purchaseOrderId, {
              status: 'converted'
            });
            console.log("Purchase order marked as converted");
          } catch (error) {
            console.error("Failed to mark purchase order as converted:", error);
            // Don't show error to user as invoice was created successfully
          }
        }

        navigate(`/purchases/purchase-invoices/${response.data.invoice_uuid}`);
      } else {
        toast.error(response.error || "Failed to save invoice");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmLeave = () => {
    setShowConfirmModal(false);
    navigate(-1);
  };

  const handleCancelLeave = () => {
    setShowConfirmModal(false);
  };

  useEffect(() => {
    if (isFullyPaid) {
      setAmountPaid(Math.round(calculateFinalTotal()));
    }
  }, [isFullyPaid, invoiceItems, tax, additionalCharges, discount, roundOffAmount]);

  // Address Formatting
  const formatAddress = (vendor: any) => {
    if (!vendor) return [];
    const elements: React.ReactNode[] = [];
    if (vendor.address1) elements.push(<span key="a1"><span className="font-medium">Address:</span> {vendor.address1}</span>);
    if (vendor.address2) elements.push(<span key="a2"><span className="font-medium">Line 2:</span> {vendor.address2}</span>);

    const parts = [];
    if (vendor.city) parts.push(<span key="c"><span className="font-medium">City:</span> {vendor.city}</span>);
    if (vendor.state) parts.push(<span key="s"><span className="font-medium">State:</span> {vendor.state}</span>);
    if (vendor.pin) parts.push(<span key="p"><span className="font-medium">PIN:</span> {vendor.pin}</span>);
    if (vendor.country) parts.push(<span key="co"><span className="font-medium">Country:</span> {vendor.country}</span>);

    if (parts.length > 0) {
      const joined = parts.reduce((acc: any[], curr, idx) => idx === 0 ? [curr] : [...acc, ", ", curr], []);
      elements.push(<div key="bottom">{joined}</div>);
    }
    return elements;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6 relative">
      {(isLoading || isSaving) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <SpinnerDotted size={50} color="#1B84FF" />
        </div>
      )}

      {/* Header */}
      <div className="sticky top-[70px] z-10 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBackClick}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditMode ? "Edit Purchase Invoice" : "Create Purchase Invoice"}
          </h1>
        </div>
        <Button
          className="bg-[#1B84FF] hover:bg-[#0F6FE0] text-white gap-2 px-4 shadow-sm"
          disabled={isSaving}
          onClick={handleSaveInvoice}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Invoice"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Parties Card */}
        <div className="lg:col-span-4 bg-white border rounded-xl p-5 shadow-sm space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Bill From (Vendor) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Bill From</h3>
              {selectedVendor ? (
                <div className="border rounded-xl min-h-[180px] p-4 bg-white relative">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-gray-900">{selectedVendor.name}</h4>
                      <div className="mt-2 text-sm text-gray-700 space-y-1">
                        {selectedVendor.company_name && <p className="font-medium">{selectedVendor.company_name}</p>}
                        <div className="mt-2 space-y-1">
                          {selectedVendor.mobile && (
                            <p className="text-gray-600">
                              <span className="font-medium">Phone:</span> {selectedVendor.mobile}
                            </p>
                          )}
                          {selectedVendor.gst && (
                            <p className="text-gray-600">
                              <span className="font-medium">GST:</span> {selectedVendor.gst}
                            </p>
                          )}
                          {formatAddress(selectedVendor).map((line, i) => (
                            <p key={i} className="text-gray-600">{line}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsPartyDialogOpen(true)} className="h-8">
                      Change Vendor
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl min-h-[180px] flex flex-col items-center justify-center bg-gray-50 p-4">
                  <Button variant="outline" onClick={() => setIsPartyDialogOpen(true)} className="gap-2 border-dashed text-blue-600 hover:bg-blue-50">
                    <Plus className="h-4 w-4" />
                    Add Vendor
                  </Button>
                </div>
              )}
            </div>

            {/* Ship To (Business) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Ship To</h3>
              {businessProfile ? (
                <div className="border rounded-xl h-[180px] p-4 bg-white overflow-hidden">
                  <h4 className="font-medium text-gray-900">{businessProfile.name}</h4>
                  <div className="mt-2 text-sm text-gray-700 space-y-1">
                    {businessProfile.phone && (
                      <p className="text-gray-600"><span className="font-medium">Phone:</span> {businessProfile.phone}</p>
                    )}
                    {businessProfile.gst && (
                      <p className="text-gray-600"><span className="font-medium">GST:</span> {businessProfile.gst}</p>
                    )}
                    <p className="text-gray-600 line-clamp-3"><span className="font-medium">Address:</span> {businessProfile.address}</p>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl h-[180px] bg-gray-50 flex items-center justify-center">
                  <SpinnerDotted size={20} color="#1B84FF" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Details Card */}
        <div className="lg:col-span-1 bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Invoice Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-600">Purchase Inv #</label>
              <Input
                name="invoiceNo"
                value={formData.invoiceNo}
                onChange={handleChange}
                placeholder="Optional"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-600">Date</label>
              <Input
                type="date"
                name="invoiceDate"
                value={formData.invoiceDate}
                onChange={handleChange}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs text-gray-600">Due Date</label>
              <Input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                min={formData.invoiceDate}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/50 flex justify-between">
          <h3 className="text-base font-semibold text-gray-800">Items</h3>
          <Button size="sm" onClick={() => setShowAddItemModal(true)}>
            + Add Item
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-16 border-r">No.</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase w-20 border-r">Image</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border-r min-w-[250px]">Item Details</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-28 border-r">HSN/SAC</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-32 border-r">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-36 border-r">PRICE/ITEM</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-28 border-r">Disc %</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase w-28 border-r">Tax %</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase w-36 border-r">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase w-16">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoiceItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                        <Plus className="h-6 w-6" />
                      </div>
                      <p className="text-sm text-gray-500">No items added. Click below to add items.</p>
                      <Button size="sm" variant="outline" onClick={() => setShowAddItemModal(true)}>Add items from Inventory</Button>
                    </div>
                  </td>
                </tr>
              ) : (
                invoiceItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50/70 group transition-colors">
                    <td className="px-4 py-4 text-sm text-gray-500 border-r">{index + 1}</td>
                    <td className="px-4 py-4 text-center border-r">
                      <div className="w-10 h-10 border rounded mx-auto overflow-hidden bg-gray-50 flex items-center justify-center">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Plus className="h-4 w-4 text-gray-200" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 border-r">
                      <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                      <textarea
                        value={item.description || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInvoiceItems(prev => prev.map(i => i.id === item.id ? { ...i, description: val } : i));
                        }}
                        placeholder="Add description..."
                        className="mt-1 w-full text-xs text-gray-500 bg-transparent border-0 focus:ring-0 p-0 resize-none hover:bg-gray-100 focus:bg-white rounded transition-colors"
                      />
                    </td>
                    <td className="px-4 py-4 border-r text-xs">{item.hsn_sac || "-"}</td>
                    <td className="px-4 py-4 border-r">
                      <div className="flex items-center border rounded-lg bg-white h-9 shadow-inner focus-within:ring-1 focus-within:ring-blue-200">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => handleUpdateQuantity(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full text-center text-sm border-0 focus:ring-0 bg-transparent"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 border-r">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                        <input
                          type="number"
                          value={item.price_per_item}
                          onChange={e => handleUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full h-9 pl-5 pr-2 text-sm border rounded-lg focus:ring-1 focus:ring-blue-200"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 border-r">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                        <input
                          type="number"
                          value={item.discount}
                          onChange={e => handleUpdateDiscount(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full h-9 pl-5 pr-2 text-sm border rounded-lg focus:ring-1 focus:ring-blue-200"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 border-r">
                      <select
                        value={item.tax}
                        onChange={e => handleUpdateTax(item.id, parseFloat(e.target.value) || 0)}
                        className="w-full h-9 text-sm border rounded-lg focus:ring-1 focus:ring-blue-200"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-gray-900 border-r">
                      ₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button onClick={() => handleRemoveItem(item.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {invoiceItems.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2">
                <tr className="font-semibold text-gray-700">
                  <td colSpan={8} className="px-4 py-3 text-right text-xs uppercase border-r">Subtotal</td>
                  <td className="px-4 py-3 text-right border-r">₹{calculateSubtotal().toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notes/Terms */}
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
            <div>
              {!showNotesField ? (
                <button onClick={() => setShowNotesField(true)} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                  <Plus className="h-4 w-4" /> Add Notes
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><label className="text-sm font-medium">Notes</label><button onClick={() => setShowNotesField(false)}><X className="h-4 w-4 text-gray-400" /></button></div>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full border rounded-lg p-2 text-sm" placeholder="Internal remarks..." />
                </div>
              )}
            </div>
            <div>
              {!showTermsField ? (
                <button onClick={() => setShowTermsField(true)} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
                  <Plus className="h-4 w-4" /> Add Terms & Conditions
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><label className="text-sm font-medium">Terms & Conditions</label><button onClick={() => setShowTermsField(false)}><X className="h-4 w-4 text-gray-400" /></button></div>
                  <textarea value={termsAndConditions} onChange={e => setTermsAndConditions(e.target.value)} rows={3} className="w-full border rounded-lg p-2 text-sm" placeholder="Payment terms..." />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Taxable Amount</span>
              <span className="font-semibold">₹{(calculateSubtotal() - calculateDiscount()).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">SGST ({(tax / 2)}%)</span>
              <span className="font-medium text-gray-500">₹{(calculateTax() / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">CGST ({(tax / 2)}%)</span>
              <span className="font-medium text-gray-500">₹{(calculateTax() / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>

            {/* Additional Charges */}
            {!showAdditionalChargesField ? (
              <button onClick={() => setShowAdditionalChargesField(true)} className="text-blue-600 text-sm flex items-center gap-1"><Plus className="h-3 w-3" /> Additional Charges</button>
            ) : (
              <div className="flex gap-2 p-2 bg-gray-50 rounded-lg">
                <Input value={newChargeName} onChange={e => setNewChargeName(e.target.value)} className="h-8 text-xs" placeholder="Charge Name" />
                <Input type="number" value={newChargeAmount || ""} onChange={e => setNewChargeAmount(parseFloat(e.target.value) || 0)} className="h-8 text-xs w-24 text-right" placeholder="Amount" />
                <Button size="sm" onClick={handleAddAdditionalCharge} className="h-8">Add</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAdditionalChargesField(false)}><X className="h-3 w-3" /></Button>
              </div>
            )}
            {additionalCharges.map((c, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600 flex items-center gap-1">{c.name} <button onClick={() => handleRemoveAdditionalCharge(i)} className="text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button></span>
                <span className="font-medium">₹{c.amount.toLocaleString("en-IN")}</span>
              </div>
            ))}

            {/* Overall Discount */}
            {!showDiscountField ? (
              <button onClick={() => setShowDiscountField(true)} className="text-blue-600 text-sm flex items-center gap-1"><Plus className="h-3 w-3" /> Overall Discount</button>
            ) : (
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-sm">Discount</span>
                <select value={discount.type} onChange={e => setDiscount(prev => ({ ...prev, type: e.target.value as any }))} className="h-8 text-xs border rounded px-1">
                  <option value="percentage">%</option>
                  <option value="amount">₹</option>
                </select>
                <Input type="number" value={discount.value || ""} onChange={e => setDiscount(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))} className="h-8 text-xs w-20 text-right" />
                <span className="text-sm font-medium text-red-500 ml-auto">- ₹{calculateOverallDiscount().toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                <button onClick={() => { setShowDiscountField(false); setDiscount({ type: "percentage", value: 0 }); }}><X className="h-4 w-4 text-gray-400" /></button>
              </div>
            )}

            {/* Round Off */}
            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ar" checked={autoRoundOff} onChange={e => setAutoRoundOff(e.target.checked)} className="h-3.5 w-3.5" />
                <label htmlFor="ar" className="text-sm text-gray-600">Round Off</label>
              </div>
              {!autoRoundOff && (
                <Input type="number" value={roundOffAmount || ""} onChange={e => setRoundOffAmount(parseFloat(e.target.value) || 0)} className="h-8 text-xs w-20 text-right" />
              )}
            </div>

            {/* Final Total */}
            <div className="flex justify-between pt-5 border-t-2 border-gray-300 items-baseline">
              <span className="text-lg font-bold text-gray-800">Grand Total</span>
              <span className="text-2xl font-bold text-blue-600">₹{calculateFinalTotal()?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>

            {/* Payment */}
            <div className="pt-4 space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">Amount Paid</label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={isFullyPaid} onChange={e => setIsFullyPaid(e.target.checked)} id="full" className="h-4 w-4" />
                  <label htmlFor="full" className="text-xs text-gray-500">Paid full</label>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <Input type="number" value={amountPaid} onChange={e => { setAmountPaid(parseFloat(e.target.value) || 0); setIsFullyPaid(false); }} className="h-10 pl-7 text-base font-medium" disabled={isFullyPaid} />
                </div>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="h-10 text-sm border rounded-lg px-2 bg-white min-w-[100px]">
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                  <option>Card</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div className="flex justify-between text-blue-700 pt-2 border-t border-blue-200">
                <span className="text-xs font-bold uppercase tracking-wider">Balance Due</span>
                <span className="text-lg font-bold">₹{Math.max(0, (calculateFinalTotal() - amountPaid)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Part Selection Dialog */}
      <Dialog open={isPartyDialogOpen} onOpenChange={setIsPartyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Choose Vendor</DialogTitle></DialogHeader>
          <div className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search vendors..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" autoFocus />
            </div>
            <div className="max-h-[300px] overflow-y-auto border rounded-xl divide-y">
              {isVendorsLoading ? (
                <div className="py-10 text-center"><SpinnerDotted size={30} color="#1B84FF" /></div>
              ) : filteredVendors.length > 0 ? (
                filteredVendors.map(v => (
                  <div key={v.uuid} onClick={() => handleSelectVendor(v)} className="p-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center group">
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{v.name}</p>
                      <p className="text-xs text-gray-500">{v.company_name}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{v.mobile || "No Mobile"}</p>
                    </div>
                    <div className="text-right">
                      {v.gst && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">GST</span>}
                      <p className="text-[10px] text-gray-400 mt-1 uppercase">{v.city || "-"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-gray-400 text-sm italic">No vendors found</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddItemPage open={showAddItemModal} onOpenChange={setShowAddItemModal} onAddItems={handleAddItems} onCreateNewItem={() => { setShowAddItemModal(false); setShowCreateItemModal(true); }} />
      <CreateItemModal open={showCreateItemModal} onOpenChange={setShowCreateItemModal} onSuccess={() => setShowCreateItemModal(false)} item={null} />

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-[400px] p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
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
          <DialogDescription className="text-sm text-gray-500 mt-2">
            You have unsaved changes. Are you sure you want to leave this page?
          </DialogDescription>
          <DialogFooter className="mt-6 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelLeave}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmLeave}
              className="flex-1"
            >
              Leave Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatePurchaseInvoicePage;
