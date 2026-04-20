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
  const { currentUser } = useAuthContext();
  const isEditMode = !!id;
  const today = new Date().toISOString().split("T")[0];

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(isEditMode);
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
      }
    };
    fetchBusinessProfile();
  }, []);

  const fetchInvoiceData = useCallback(async () => {
    if (!id) return;
    setIsInitialLoading(true);
    try {
      const response = await getPurchaseInvoiceById(id);
      if (response.success && response.data) {
        const data = response.data;

        // Map vendor
        if (data.vendor) {
          setSelectedVendor(data.vendor as any);
        }

        // Map items
        const mappedItems = data.items.map((item, index) => ({
          id: item.uuid || `item-${Date.now()}-${index}`,
          item_id: item.item_id || "",
          item_name: item.product_name || item.description || "Item",
          hsn_sac: item.hsn_sac_code || "",
          quantity: item.quantity,
          price_per_item: item.unit_price,
          discount: item.discount?.discount_percentage || 0,
          tax: item.tax?.tax_percentage || 0,
          amount: item.total_price,
          measuring_unit_id: item.measuring_unit_id || 1,
          description: item.description || null,
        }));
        setInvoiceItems(mappedItems);

        // Map financials/meta
        setFormData({
          invoiceNo: data.invoice_number || "",
          invoiceDate: data.invoice_date || today,
          dueDate: data.due_date || today,
          status: data.payment_status || "unpaid",
        });

        if (data.additional_notes?.notes) {
          setNotes(data.additional_notes.notes);
          setShowNotesField(true);
        }
        if (data.additional_notes?.terms_and_conditions) {
          setTermsAndConditions(data.additional_notes.terms_and_conditions);
          setShowTermsField(true);
        }

        setAmountReceived(data.amount_paid || 0);
        setIsFullyPaid(data.payment_status === "paid");
        setRoundOffAmount(data.charges?.round_off || 0);
        setAutoRoundOff(!!data.charges?.round_off); // Assuming if it has roundoff, it might be auto or manual

        if (data.charges?.overall_discount) {
          setDiscount({ type: "amount", value: data.charges.overall_discount });
          setShowDiscountField(true);
        }

        if (data.charges?.additional_charges) {
          setAdditionalCharges([{ name: "Additional Charges", amount: data.charges.additional_charges }]);
          setShowAdditionalChargesField(true);
        }

        setPaymentMode(data.payment_mode || "Cash");
      } else {
        toast.error("Failed to load invoice data");
      }
    } catch (err) {
      console.error("Error fetching invoice:", err);
      toast.error("Failed to fetch invoice details");
    } finally {
      setIsInitialLoading(false);
    }
  }, [id, today]);

  useEffect(() => {
    if (isEditMode) {
      fetchInvoiceData();
    }
  }, [isEditMode, fetchInvoiceData]);

  const [formData, setFormData] = useState<InvoiceFormData>({
    invoiceNo: "",
    invoiceDate: today,
    dueDate: addDays(today, 30),
    status: "unpaid",
  });

  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);

  const location = useLocation();

  // Handle PO data from navigation state
  useEffect(() => {
    const poState = location.state as any;

    if (poState?.fromPO && poState?.poData) {
      const pData = poState.poData;

      if (pData.selectedVendor) {
        setSelectedVendor(pData.selectedVendor);
      }

      if (pData.poItems && pData.poItems.length > 0) {
        const transformedItems = pData.poItems.map((item: any, index: number) => ({
          id: item.id || `item-${Date.now()}-${index}`,
          item_id: item.item_id,
          item_name: item.item_name,
          hsn_sac: item.hsn_sac || '',
          quantity: item.quantity,
          price_per_item: item.price_per_item,
          discount: item.discount,
          tax: item.tax,
          amount: item.amount,
          measuring_unit_id: item.measuring_unit_id || 1,
          description: item.description || null,
        }));
        setInvoiceItems(transformedItems);
      }

      setFormData(prev => ({
        ...prev,
        invoiceDate: today,
        dueDate: pData.deliveryDate || today,
        invoiceNo: '',
        status: 'unpaid'
      }));

      if (pData.notes) {
        setNotes(pData.notes);
        setShowNotesField(true);
      }
      if (pData.terms) {
        setTermsAndConditions(pData.terms);
        setShowTermsField(true);
      }

      toast.success('Purchase Invoice pre-filled from Purchase Order data');
    }
  }, [location.state, today]);

  // Financial States
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [showNotesField, setShowNotesField] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [showTermsField, setShowTermsField] = useState(false);
  const [isFullyPaid, setIsFullyPaid] = useState(false);
  const [autoRoundOff, setAutoRoundOff] = useState(false);
  const [roundOffAmount, setRoundOffAmount] = useState(0);
  const [amountReceived, setAmountReceived] = useState<number | string>(0);
  const [transactionReference, setTransactionReference] = useState("");
  const [tax, setTax] = useState(18); // Default tax rate for display

  const [additionalCharges, setAdditionalCharges] = useState<{ name: string; amount: number }[]>([]);
  const [showAdditionalChargesField, setShowAdditionalChargesField] = useState(false);
  const [newChargeName, setNewChargeName] = useState("");
  const [newChargeAmount, setNewChargeAmount] = useState(0);

  const [discount, setDiscount] = useState<{ type: "percentage" | "amount"; value: number }>({
    type: "percentage",
    value: 0,
  });
  const [showDiscountField, setShowDiscountField] = useState(false);

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
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const filteredVendors = vendors.filter((v) => {
    const q = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.mobile && v.mobile.includes(searchQuery)) ||
      (v.company_name && v.company_name.toLowerCase().includes(q))
    );
  });

  // ── Calculations ────────────────────────────────────────────────────────────
  const calculateSubtotal = () =>
    invoiceItems.reduce(
      (sum, item) => sum + (item.quantity * item.price_per_item),
      0,
    );

  const calculateItemDiscount = () =>
    invoiceItems.reduce(
      (sum, item) => sum + (item.quantity * item.price_per_item * item.discount) / 100,
      0,
    );

  const calculateTax = () =>
    invoiceItems.reduce((sum, item) => {
      const taxable = item.quantity * item.price_per_item * (1 - item.discount / 100);
      return sum + (taxable * item.tax) / 100;
    }, 0);

  const calculateOverallDiscount = () => {
    const subtotal = calculateSubtotal() - calculateItemDiscount();
    return discount.type === "percentage"
      ? (subtotal * discount.value) / 100
      : discount.value;
  };

  const calculateDiscount = () => calculateItemDiscount();

  const calculateTotalBeforeRoundOff = () => {
    const total =
      calculateSubtotal() -
      calculateItemDiscount() +
      calculateTax() +
      additionalCharges.reduce((s, c) => s + c.amount, 0) -
      calculateOverallDiscount();
    return total;
  };

  const calculateTotal = () => {
    const totalBeforeRound = calculateTotalBeforeRoundOff();
    if (autoRoundOff) {
      const rounded = Math.round(totalBeforeRound);
      // We'll update the roundoff amount in an effect to avoid render-time side effects
      return rounded;
    }
    return totalBeforeRound + roundOffAmount;
  };

  const calculateFinalTotal = () => calculateTotal();

  // Sync round-off amount when autoRoundOff is enabled
  useEffect(() => {
    if (autoRoundOff) {
      const totalBeforeRound = calculateTotalBeforeRoundOff();
      const rounded = Math.round(totalBeforeRound);
      setRoundOffAmount(rounded - totalBeforeRound);
    }
  }, [autoRoundOff, invoiceItems, additionalCharges, discount]);

  // Handle auto-filling amount received when fully paid is checked
  useEffect(() => {
    if (isFullyPaid) {
      setAmountReceived(Number(calculateFinalTotal().toFixed(2)));
    }
  }, [isFullyPaid, invoiceItems, additionalCharges, discount, autoRoundOff, roundOffAmount]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setIsVendorDialogOpen(false);
  };

  const handleAddItems = (items: InventoryItem[]) => {
    const newItems: InvoiceItem[] = items.map((item, index) => {
      const quantity = item.quantity || 1;
      const price = item.purchase_price || 0;
      const disc = 0;
      const taxRate = item.gst_tax_rate || 18;
      const amount = (quantity * price * (1 - disc / 100)) * (1 + taxRate / 100);
      return {
        id: `item-${Date.now()}-${index}`,
        item_id: item.item_id,
        item_name: item.item_name,
        hsn_sac: item.hsn_code || "",
        quantity,
        price_per_item: price,
        discount: disc,
        tax: taxRate,
        amount,
        measuring_unit_id: item.measuring_unit_id,
      };
    });
    setInvoiceItems((prev) => [...prev, ...newItems]);
    toast.success(`${items.length} item(s) added`);
  };

  const handleUpdateQuantity = (id: string, qty: number) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const amount = (qty * item.price_per_item * (1 - item.discount / 100)) * (1 + item.tax / 100);
        return { ...item, quantity: qty, amount };
      }
      return item;
    }));
  };

  const handleUpdatePrice = (id: string, price: number) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const amount = (item.quantity * price * (1 - item.discount / 100)) * (1 + item.tax / 100);
        return { ...item, price_per_item: price, amount };
      }
      return item;
    }));
  };

  const handleUpdateDiscount = (id: string, disc: number) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const amount = (item.quantity * item.price_per_item * (1 - disc / 100)) * (1 + item.tax / 100);
        return { ...item, discount: disc, amount };
      }
      return item;
    }));
  };

  const handleUpdateTax = (id: string, tax: number) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.id === id) {
        const amount = (item.quantity * item.price_per_item * (1 - item.discount / 100)) * (1 + tax / 100);
        return { ...item, tax, amount };
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
      const totalAmount = calculateTotal();
      const payload = {
        vendor_id: selectedVendor.uuid,
        purchase_invoice_number: formData.invoiceNo || undefined,
        invoice_number: formData.invoiceNo || undefined, // Add both variations for backend compatibility
        invoice_date: formData.invoiceDate,
        due_date: formData.dueDate,
        total_amount: totalAmount,
        amount_paid: isFullyPaid ? totalAmount : Number(amountReceived),
        balance_due: isFullyPaid ? 0 : totalAmount - Number(amountReceived),
        payment_mode: paymentMode,
        items: invoiceItems.map(item => ({
          item_id: item.item_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.price_per_item,
          discount: { discount_percentage: item.discount },
          tax: { tax_percentage: item.tax },
          total_price: item.amount,
        })),
        notes: notes,
        terms_and_conditions: termsAndConditions,
        charges: {
          subtotal: calculateSubtotal(),
          item_discount: calculateItemDiscount(),
          overall_discount: calculateOverallDiscount(),
          tax_total: calculateTax(),
          additional_charges: additionalCharges.reduce((s, c) => s + c.amount, 0),
          round_off: roundOffAmount,
        }
      };

      const response = isEditMode
        ? await updatePurchaseInvoice(id!, payload)
        : await createPurchaseInvoice(payload);

      if (response.success) {
        toast.success(isEditMode ? "Purchase Invoice updated successfully!" : "Purchase Invoice created successfully!");
        navigate(`/purchases/purchase-invoices/${response.data.invoice_uuid || id}`);
      } else {
        toast.error(response.error || `Failed to ${isEditMode ? 'update' : 'create'} invoice`);
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="p-3 sm:p-6 bg-gray-50 min-h-screen space-y-4 sm:space-y-6 relative w-full max-w-[100vw] overflow-x-hidden">
      {(isLoading || isInitialLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
          <SpinnerDotted size={50} thickness={100} speed={100} color="#1B84FF" />
        </div>
      )}

      {/* Header */}
      <div className="sticky rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shadow-sm gap-3 md:gap-0 flex-wrap">
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-hidden">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">
            {isEditMode ? "Edit Purchase Invoice" : "Create Purchase Invoice"}
          </h1>
        </div>
        <Button
          type="button"
          className="bg-[#1B84FF] hover:bg-[#0F6FE0] text-white gap-2 px-4 py-2 rounded-lg w-full sm:w-auto"
          disabled={isSaving}
          onClick={handleSaveInvoice}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save Invoice"}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 pb-4">
        <div className="xl:col-span-4 bg-white border rounded-xl p-4 sm:p-5 shadow-sm space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
            {/* Bill From (Vendor) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Bill From</h3>
              {selectedVendor ? (
                <div className="border rounded-xl min-h-[180px] p-3 sm:p-4 bg-white">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                    <div>
                      <h4 className="font-medium text-gray-900">{selectedVendor.name}</h4>
                      <div className="mt-2 text-sm text-gray-700 space-y-1">
                        {selectedVendor.company_name && <p className="font-medium">{selectedVendor.company_name}</p>}
                        <div className="mt-2 space-y-1">
                          {selectedVendor.mobile && <p className="text-gray-600"><span className="font-medium">Phone:</span> {selectedVendor.mobile}</p>}
                          {selectedVendor.email && <p className="text-gray-600"><span className="font-medium">Email:</span> {selectedVendor.email}</p>}
                          {selectedVendor.gst && <p className="text-gray-600"><span className="font-medium">GST:</span> {selectedVendor.gst}</p>}
                          {selectedVendor.address1 && <p className="text-gray-600">{selectedVendor.address1}</p>}
                          {(selectedVendor.city || selectedVendor.state || selectedVendor.country) && (
                            <p className="text-gray-600">
                              {[selectedVendor.city, selectedVendor.state, selectedVendor.country].filter(Boolean).join(", ")} {selectedVendor.pin && `- ${selectedVendor.pin}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsVendorDialogOpen(true)} className="h-8 w-full sm:w-auto">
                      Change Party
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl min-h-[180px] flex flex-col items-center justify-center bg-gray-50 p-4">
                  <Button type="button" onClick={() => setIsVendorDialogOpen(true)} variant="outline" className="gap-2 border-dashed text-indigo-600 hover:bg-indigo-50">
                    <Plus className="h-4 w-4" />
                    Add Party
                  </Button>
                </div>
              )}
            </div>

            {/* Deliver To (Business) */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Ship To</h3>
              {businessProfile ? (
                <div className="border rounded-xl min-h-[180px] p-3 sm:p-4 bg-white overflow-hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                    <div>
                      <h4 className="font-medium text-gray-900">{businessProfile.name}</h4>
                      <div className="mt-2 text-sm text-gray-700 space-y-1">
                        <div className="mt-2 space-y-1">
                          {businessProfile.phone && <p className="text-gray-600"><span className="font-medium">Phone:</span> {businessProfile.phone}</p>}
                          {businessProfile.email && <p className="text-gray-600"><span className="font-medium">Email:</span> {businessProfile.email}</p>}
                          {businessProfile.gst && <p className="text-gray-600"><span className="font-medium">GST:</span> {businessProfile.gst}</p>}
                          <p className="text-gray-600">{businessProfile.address}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-xl min-h-[180px] bg-gray-50 flex items-center justify-center p-4">
                  <p className="text-sm text-gray-400">Loading business profile...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="lg:col-span-1 bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Invoice Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-600">Invoice No.</label>
              <Input name="invoiceNo" value={formData.invoiceNo} onChange={handleChange} placeholder="Auto" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-600">Invoice Date</label>
              <Input type="date" name="invoiceDate" value={formData.invoiceDate} onChange={handleChange} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs text-gray-600">Due Date</label>
              <Input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} min={formData.invoiceDate} className="h-8 text-sm w-full" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4 w-full max-w-full">
        {/* Items Table Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <h3 className="text-sm sm:text-base font-semibold text-gray-800">Items</h3>
            <Button size="sm" onClick={() => setShowAddItemModal(true)} className="gap-2 h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>
        </div>

        {/* Desktop Table Container */}
        <div className="hidden md:block overflow-x-auto w-full">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-12">No.</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-[200px] min-w-[150px]">Item/Service Details</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-24">HSN/SAC</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-24">Quantity</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-28">PRICE/ITEM (₹)</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-28">Discount</th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-24">Tax</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-32">AMOUNT (₹)</th>
                <th className="px-4 py-3.5 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoiceItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-20">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <h4 className="text-sm font-medium text-gray-900 mb-1">No items added yet</h4>
                        <p className="text-xs text-gray-500 mb-4">Get started by adding your first item</p>
                        <button onClick={() => setShowAddItemModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
                          <Plus className="h-4 w-4" /> Add Your First Item
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                invoiceItems.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="px-4 py-4 text-sm text-gray-500 border-r border-gray-200 align-top">{index + 1}</td>
                    <td className="px-4 py-4 border-r border-gray-200 align-top">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.item_name}</p>
                        <textarea
                          placeholder="Add description..."
                          value={item.description || ""}
                          onChange={(e) => setInvoiceItems(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                          className="w-full text-xs text-gray-500 bg-transparent border-0 focus:ring-1 focus:ring-blue-200 rounded p-1 resize-none placeholder-gray-400 min-h-[40px]"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 border-r border-gray-200 align-top">
                      <Input value={item.hsn_sac || ""} disabled className="h-8 text-xs bg-gray-50 border-gray-200" title="Manage items from inventory to update HSN code" />
                    </td>
                    <td className="px-4 py-4 border-r border-gray-200 align-top">
                      <Input type="number" min="1" value={item.quantity || ""} onChange={(e) => handleUpdateQuantity(item.id, parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                    </td>
                    <td className="px-4 py-4 border-r border-gray-200 align-top">
                      <Input type="number" min="0" value={item.price_per_item || ""} onChange={(e) => handleUpdatePrice(item.id, parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                    </td>
                    <td className="px-4 py-4 border-r border-gray-200 align-top">
                      <div className="relative">
                        <Input type="number" min="0" max="100" value={item.discount || ""} onChange={(e) => handleUpdateDiscount(item.id, parseFloat(e.target.value) || 0)} className="h-8 text-sm pr-6" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 border-r border-gray-200 align-top">
                      <div className="relative">
                        <select value={item.tax || 0} onChange={(e) => handleUpdateTax(item.id, parseFloat(e.target.value) || 0)} className="w-full h-8 px-2 bg-white border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none">
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right border-r border-gray-200 align-top">
                      <p className="text-sm font-semibold text-gray-900">₹{(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-4 py-4 text-center align-top">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full mx-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-4 border-r border-gray-200"
                ></td>
                <td className="px-4 py-4 text-sm font-semibold text-gray-900 text-right border-r border-gray-200">
                  Subtotal
                </td>
                <td className="px-4 py-4 text-right text-sm font-medium text-red-600 border-r border-gray-200">
                  {calculateItemDiscount() > 0 &&
                    `-₹${calculateItemDiscount().toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
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

        {/* Mobile View Omitted here, just generic fallback */}
        {/* Mobile View for Items */}
        <div className="md:hidden space-y-4 p-4 bg-gray-50/30">
          {invoiceItems.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border-2 border-dashed border-gray-100">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Plus className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 font-medium">No items added yet</p>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="mt-4 text-sm font-bold text-blue-600 hover:text-blue-700"
              >
                + Add First Item
              </button>
            </div>
          ) : (
            invoiceItems.map((item, index) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="p-4 space-y-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold shrink-0">{index + 1}</span>
                        <h4 className="font-bold text-gray-900 text-sm truncate uppercase tracking-tight">{item.item_name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">HSN: {item.hsn_sac || "N/A"}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-bold uppercase">₹{item.price_per_item.toLocaleString()} / Unit</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full shrink-0"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-0.5">Quantity</label>
                      <div className="flex items-center h-10 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent px-3 text-sm font-bold text-gray-900 border-none focus:outline-none text-center"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-0.5">Price (₹)</label>
                      <div className="relative h-10">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">₹</span>
                        <input
                          type="number"
                          value={item.price_per_item}
                          onChange={(e) => handleUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full h-full bg-gray-50 border border-gray-200 rounded-lg pl-7 pr-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-0.5">Discount (%)</label>
                      <div className="relative h-10">
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) => handleUpdateDiscount(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full h-full bg-gray-50 border border-gray-200 rounded-lg px-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all text-right pr-7"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-0.5">Tax Rate</label>
                      <select
                        value={item.tax}
                        onChange={(e) => handleUpdateTax(item.id, parseFloat(e.target.value) || 0)}
                        className="w-full h-10 px-3 text-sm font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none cursor-pointer"
                      >
                        {[0, 5, 12, 18, 28].map(t => (
                          <option key={t} value={t}>{t}% Tax</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-0.5">Item Description</label>
                    <textarea
                      value={item.description || ""}
                      onChange={(e) => setInvoiceItems(prev => prev.map(i => i.id === item.id ? { ...i, description: e.target.value } : i))}
                      className="w-full min-h-[60px] p-3 text-xs text-gray-600 bg-gray-50/50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                      placeholder="Add specific details about this item..."
                    />
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between bg-blue-50/30 -mx-4 px-4 py-2 mt-2">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Item Total</span>
                    <span className="text-sm font-black text-blue-600">₹{(item.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mt-6 pb-20">
        <div className="w-full lg:w-7/12 flex flex-col gap-4">
          <div className="space-y-4">
            {/* Notes Section */}
            <div className="relative">
              {!showNotesField ? (
                <button type="button" onClick={() => setShowNotesField(true)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                  <Plus className="h-4 w-4" /> Add Notes
                </button>
              ) : (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-gray-700">Notes</label>
                    <button type="button" onClick={() => { setShowNotesField(false); setNotes(""); }} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter details..." className="w-full min-h-[100px] p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all resize-y" />
                </div>
              )}
            </div>

            {/* Terms Section */}
            <div className="relative">
              {!showTermsField ? (
                <button type="button" onClick={() => setShowTermsField(true)} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                  <Plus className="h-4 w-4" /> Add Terms and Conditions
                </button>
              ) : (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-gray-700">Terms and Conditions</label>
                    <button type="button" onClick={() => { setShowTermsField(false); setTermsAndConditions(""); }} className="text-gray-400 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea value={termsAndConditions} onChange={(e) => setTermsAndConditions(e.target.value)} placeholder="Terms and conditions..." className="w-full min-h-[100px] p-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all resize-y" />
                </div>
              )}
            </div>

            {/* Add New Account Section */}
            <div className="relative">
              <button type="button" className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                <Plus className="h-4 w-4" /> Add New Account
              </button>
            </div>
          </div>
        </div>

        {/* Totals Section */}
        <div className="w-full lg:w-5/12 ml-auto">
          {invoiceItems.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 space-y-5">

                {/* 1. Header Actions */}
                <div className="space-y-4">
                  {!showAdditionalChargesField ? (
                    <button onClick={() => setShowAdditionalChargesField(true)} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
                      <Plus className="h-4 w-4" /> Add Additional Charges
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100 animate-in fade-in duration-200">
                      <div className="flex gap-2">
                        <Input placeholder="Charge name" value={newChargeName} onChange={(e) => setNewChargeName(e.target.value)} className="h-9 text-sm flex-1 bg-white" />
                        <div className="relative w-28">
                          <span className="absolute left-3 top-2.5 text-sm text-gray-400">₹</span>
                          <Input type="number" value={newChargeAmount || ""} onChange={(e) => setNewChargeAmount(parseFloat(e.target.value) || 0)} className="h-9 text-sm text-right pl-7 bg-white" />
                        </div>
                        <Button size="sm" onClick={handleAddAdditionalCharge} disabled={!newChargeName.trim() || newChargeAmount <= 0} className="h-9 px-4">Add</Button>
                        <Button variant="ghost" onClick={() => setShowAdditionalChargesField(false)} className="h-9 w-9 p-0 text-gray-400"><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm group">
                    <span className="text-gray-600 font-medium">Taxable Amount</span>
                    <span className="font-semibold text-gray-900 flex items-center gap-1">
                      <span className="text-gray-400 font-normal">₹</span>
                      {(calculateSubtotal() - calculateDiscount()).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">SGST@{(tax / 2)}</span>
                    <span className="text-gray-800 font-medium flex items-center gap-1">
                      <span className="text-gray-400 font-normal">₹</span>
                      {(((calculateSubtotal() - calculateDiscount()) * (tax / 2)) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">CGST@{(tax / 2)}</span>
                    <span className="text-gray-800 font-medium flex items-center gap-1">
                      <span className="text-gray-400 font-normal">₹</span>
                      {(((calculateSubtotal() - calculateDiscount()) * (tax / 2)) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {!showDiscountField ? (
                    <button onClick={() => setShowDiscountField(true)} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
                      <Plus className="h-4 w-4" /> Add Discount
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2 p-3 bg-red-50/30 border border-red-100 rounded-lg animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <select value={discount.type} onChange={(e) => setDiscount({ ...discount, type: e.target.value as "percentage" | "amount" })} className="h-9 px-2 text-sm border-gray-200 rounded-lg bg-white outline-none">
                          <option value="percentage">%</option>
                          <option value="amount">₹</option>
                        </select>
                        <Input type="number" value={discount.value || ""} onChange={(e) => setDiscount({ ...discount, value: parseFloat(e.target.value) || 0 })} className="h-9 text-sm text-right flex-1 bg-white" />
                        <span className="text-sm font-bold text-red-600 min-w-[70px] text-right">- ₹{calculateOverallDiscount().toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        <Button variant="ghost" size="icon" onClick={() => setShowDiscountField(false)} className="h-9 w-9 p-0 text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-100 w-full" />

                {/* 2. Adjustment Controls (Exact match to screenshot) */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="autoRoundOff" checked={autoRoundOff} onChange={(e) => setAutoRoundOff(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500" />
                    <label htmlFor="autoRoundOff" className="text-sm text-gray-600 cursor-pointer">Auto Round Off</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Add
                    </button>
                    <div className="flex items-center">
                      <select className="h-9 px-2 text-xs border border-gray-200 border-r-0 rounded-l-lg bg-gray-50 outline-none w-14 appearance-none text-center">
                        <option>₹</option>
                      </select>
                      <Input type="number" value={roundOffAmount === 0 ? "0" : roundOffAmount.toFixed(2)} onChange={(e) => setRoundOffAmount(parseFloat(e.target.value) || 0)} disabled={autoRoundOff} className="h-9 w-20 text-sm text-right px-3 border border-gray-200 rounded-r-lg rounded-l-none focus-visible:ring-0 disabled:bg-gray-50 disabled:text-gray-400" />
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-100 w-full" />

                {/* 3. Final Total */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-base font-bold text-gray-800">Total Amount</span>
                  <span className="text-2xl font-black text-gray-900 tracking-tight">
                    ₹ {calculateFinalTotal().toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 4. Payment Controls */}
                <div className="space-y-4 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">Amount Received</span>
                    <input type="checkbox" checked={isFullyPaid} onChange={(e) => setIsFullyPaid(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300" id="paidFull" />
                    <label htmlFor="paidFull" className="text-[11px] font-medium text-gray-400 hover:text-gray-600 cursor-pointer transition-colors uppercase">Mark as fully paid</label>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-end">
                    <div className="relative w-full sm:w-48">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm italic">₹</span>
                      <Input
                        type="number"
                        min="0"
                        value={amountReceived}
                        placeholder="0"
                        onChange={e => {
                          const val = e.target.value;
                          setAmountReceived(val === '' ? '' : parseFloat(val) || 0);
                          if (parseFloat(val) !== Number(calculateFinalTotal().toFixed(2))) setIsFullyPaid(false);
                        }}
                        className="pl-7 h-10 border-gray-200 rounded-lg focus:border-blue-300 focus:ring-4 focus:ring-blue-50/50 transition-all text-sm font-medium text-right"
                      />
                    </div>
                    <select
                      value={paymentMode}
                      onChange={e => setPaymentMode(e.target.value)}
                      className="h-10 px-4 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-gray-600 w-full sm:w-32"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Netbanking">Netbanking</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                {/* 5. Balance Summary */}
                <div className="pt-3 flex justify-between items-center border-t border-dashed border-gray-200">
                  <span className="text-sm font-semibold text-green-600">Balance Amount</span>
                  <span className="text-xl font-bold text-green-600 tracking-tight">
                    ₹ {(calculateFinalTotal() - (Number(amountReceived) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Select Party</DialogTitle>
          </DialogHeader>
          <div className="p-4 space-y-4">
            <Input placeholder="Search vendors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <div className="h-64 overflow-y-auto">
              {filteredVendors.map((vendor) => (
                <div key={vendor.uuid} onClick={() => { setSelectedVendor(vendor); setIsVendorDialogOpen(false); }} className="p-3 border-b hover:bg-gray-50 cursor-pointer">
                  <p className="font-medium text-gray-900">{vendor.name}</p>
                  {vendor.mobile && <p className="text-sm text-gray-500">{vendor.mobile}</p>}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddItemPage
        open={showAddItemModal}
        onOpenChange={setShowAddItemModal}
        onAddItems={handleAddItems}
        onCreateNewItem={() => {
          setShowAddItemModal(false);
          setShowCreateItemModal(true);
        }}
      />
      <CreateItemModal
        open={showCreateItemModal}
        onOpenChange={setShowCreateItemModal}
        onSuccess={() => {
          setShowAddItemModal(true);
        }}
        item={null}
      />

    </div>
  );

};

export default CreatePurchaseInvoicePage;
