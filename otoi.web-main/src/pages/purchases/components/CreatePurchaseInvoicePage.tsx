import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

  // Financial States
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [showNotesField, setShowNotesField] = useState(false);
  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [showTermsField, setShowTermsField] = useState(false);
  const [isFullyPaid, setIsFullyPaid] = useState(false);

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

  const calculateTotal = () => {
    const total =
      calculateSubtotal() -
      calculateItemDiscount() +
      calculateTax() +
      additionalCharges.reduce((s, c) => s + c.amount, 0) -
      calculateOverallDiscount();
    return Math.round(total * 100) / 100;
  };

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
        invoice_date: formData.invoiceDate,
        due_date: formData.dueDate,
        total_amount: totalAmount,
        amount_paid: isFullyPaid ? totalAmount : amountPaid,
        balance_due: isFullyPaid ? 0 : totalAmount - amountPaid,
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
        }
      };

      const response = await createPurchaseInvoice(payload);
      if (response.success) {
        toast.success("Purchase Invoice created successfully!");
        navigate(`/purchases/purchase-invoices/${response.data.invoice_uuid}`);
      } else {
        toast.error(response.error || "Failed to create invoice");
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-gray-50/50 min-h-screen pb-20">
      {/* Sticky Header */}
      <div className="sticky top-[70px] z-20 flex items-center justify-between bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-none">
              {isEditMode ? "Edit Purchase Invoice" : "Create Purchase Invoice"}
            </h1>
            <p className="text-xs text-gray-500 mt-1">Drafting new entry</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="hidden sm:inline-flex text-gray-600 border-gray-300"
          >
            Cancel
          </Button>
          <Button
            className="bg-[#1B84FF] hover:bg-[#1B84FF]/90 text-white gap-2 px-6 shadow-sm"
            disabled={isSaving}
            onClick={handleSaveInvoice}
          >
            {isSaving ? (
              <SpinnerDotted size={16} color="white" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save Invoice"}
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Top Section */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Parties Section */}
          <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bill From (Vendor) */}
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col">
              <div className="px-5 py-3 border-b bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-700">Bill From (Vendor)</h3>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center min-h-[160px]">
                {selectedVendor ? (
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h4 className="font-bold text-gray-900 text-lg leading-tight">{selectedVendor.name}</h4>
                      {selectedVendor.company_name && (
                        <p className="text-sm font-medium text-gray-600">{selectedVendor.company_name}</p>
                      )}
                      <div className="text-sm text-gray-500 space-y-1 mt-3">
                        {selectedVendor.mobile && <p className="flex items-center gap-2">📞 {selectedVendor.mobile}</p>}
                        {selectedVendor.gst && (
                            <p className="flex items-center gap-2">
                                <span className="bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded font-bold border border-blue-100 uppercase tracking-tighter">GSTIN</span> {selectedVendor.gst}
                            </p>
                        )}
                        <p className="flex items-start gap-2 max-w-[300px]">📍 {selectedVendor.address1}{selectedVendor.city ? `, ${selectedVendor.city}` : ""}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsVendorDialogOpen(true)}
                      className="border-gray-200 text-gray-600 hover:text-primary hover:border-primary px-3 transition-all"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center cursor-pointer group py-4"
                    onClick={() => setIsVendorDialogOpen(true)}
                  >
                    <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-inner">
                      <Plus className="h-7 w-7" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-600 group-hover:text-primary">Select Vendor</p>
                    <p className="text-[10px] text-gray-400 mt-1">Required to create invoice</p>
                  </div>
                )}
              </div>
            </div>

            {/* Deliver To (Business) */}
            <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 border-b bg-gray-50/50 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-700">Deliver To</h3>
              </div>
              <div className="p-5 min-h-[160px]">
                {businessProfile ? (
                  <div className="space-y-2">
                    <h4 className="font-bold text-gray-900 text-lg leading-tight">{businessProfile.name}</h4>
                    <div className="text-sm text-gray-500 space-y-1 mt-3">
                      {businessProfile.phone && <p>📞 {businessProfile.phone}</p>}
                      {businessProfile.gst && (
                        <p className="flex items-center gap-2">
                            <span className="bg-gray-50 text-gray-500 text-[10px] px-2 py-0.5 rounded font-bold border border-gray-200 uppercase tracking-tighter">GSTIN</span> {businessProfile.gst}
                        </p>
                      )}
                      <p className="flex items-start gap-2">📍 {businessProfile.address}</p>
                    </div>
                  </div>
                ) : (
                    <div className="flex justify-center items-center h-full text-gray-400 italic text-sm">Loading business profile...</div>
                )}
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="lg:col-span-1 bg-white border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b bg-gray-50/50">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Invoice Details</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Purchase Invoice #</label>
                <div className="relative">
                    <Input
                        name="invoiceNo"
                        value={formData.invoiceNo}
                        onChange={handleChange}
                        className="bg-gray-50/50 border-gray-200 focus:bg-white text-sm"
                        placeholder="Optional"
                    />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Invoice Date</label>
                <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors z-10" />
                    <Input
                        type="date"
                        name="invoiceDate"
                        value={formData.invoiceDate}
                        onChange={handleChange}
                        className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white text-sm"
                    />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase">Due Date</label>
                <div className="relative group">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors z-10" />
                    <Input
                        type="date"
                        name="dueDate"
                        value={formData.dueDate}
                        onChange={handleChange}
                        className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white text-sm"
                        min={formData.invoiceDate}
                    />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table Section */}
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50/50 flex justify-between items-center">
            <div>
                <h3 className="text-base font-bold text-gray-800">Item List</h3>
                <p className="text-[11px] text-gray-500 font-medium uppercase tracking-tight">Add items from inventory or create one</p>
            </div>
            <Button
                size="sm"
                onClick={() => setShowAddItemModal(true)}
                className="bg-primary hover:bg-primary-active text-white shadow-sm flex gap-2"
            >
                <Plus className="h-4 w-4 text-white" />
                Add Item
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[#f8fafc] border-b-2 border-gray-100">
                <tr>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 w-12">#</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 min-w-[300px]">Item Details</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 w-28 text-center">HSN/SAC</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 w-36 text-center">Quantity</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 w-40 text-center">Price / Item</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 w-32 text-center">Disc. %</th>
                  <th className="px-4 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 w-32 text-center">Tax %</th>
                  <th className="px-4 py-4 text-right text-xs font-bold text-gray-600 uppercase tracking-wider border-r border-gray-100 w-44">Amount</th>
                  <th className="px-4 py-4 text-center text-xs font-bold text-gray-600 uppercase tracking-wider w-12"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {invoiceItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-20">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                            <Plus className="h-8 w-8 text-blue-300" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-800">No items selected</h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-[240px]">Search and add items from your inventory to populate this table</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddItemModal(true)}
                          className="mt-5 border-blue-200 text-primary hover:bg-blue-50"
                        >
                            Select Your First Item
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoiceItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group group-hover:bg-gray-50">
                      <td className="px-4 py-4 text-xs font-bold text-gray-400 border-r border-gray-100 align-top">{index + 1}</td>
                      <td className="px-4 py-4 border-r border-gray-100 align-top">
                        <div className="space-y-1.5">
                          <p className="text-sm font-bold text-gray-900 leading-none">{item.item_name}</p>
                          <textarea
                            className="w-full text-[11px] text-gray-500 bg-transparent border-0 focus:ring-1 focus:ring-blue-100 rounded-lg p-1 resize-none placeholder-gray-300 italic min-h-[40px]"
                            placeholder="Add a detailed description for this purchase..."
                            value={item.description || ""}
                            onChange={(e) => {
                                const val = e.target.value;
                                setInvoiceItems(prev => prev.map(i => i.id === item.id ? {...i, description: val} : i));
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-100 align-top text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-50 text-[10px] font-bold text-gray-500 border border-gray-200 font-mono tracking-widest leading-none">
                          {item.hsn_sac || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-100 align-top">
                        <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center bg-gray-50 border border-gray-300 rounded-lg overflow-hidden h-9 w-full shadow-inner focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
                                <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                    className="w-full h-full text-center bg-transparent text-sm font-bold text-gray-800 focus:outline-none"
                                />
                                <div className="px-2 h-full bg-gray-100 flex items-center justify-center border-l text-[10px] font-black text-gray-400 uppercase tracking-tighter">Nos</div>
                            </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-100 align-top">
                        <div className="relative group">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 z-10 transition-colors group-focus-within:text-blue-500">₹</span>
                            <input
                                type="number"
                                value={item.price_per_item}
                                onChange={(e) => handleUpdatePrice(item.id, parseFloat(e.target.value) || 0)}
                                className="w-full h-9 pl-6 pr-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-inner transition-all"
                            />
                        </div>
                      </td>
                      <td className="px-4 py-4 border-r border-gray-100 align-top">
                        <div className="relative group">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 z-10 transition-colors group-focus-within:text-red-500">%</span>
                            <input
                                type="number"
                                value={item.discount}
                                onChange={(e) => handleUpdateDiscount(item.id, parseFloat(e.target.value) || 0)}
                                className="w-full h-9 pl-6 pr-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-inner transition-all text-right"
                            />
                        </div>
                        {item.discount > 0 && (
                            <p className="text-[9px] font-bold text-red-500 text-right mt-1">-₹{((item.quantity * item.price_per_item * item.discount) / 100).toFixed(2)}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 border-r border-gray-100 align-top">
                        <div className="relative group">
                            <select
                                value={item.tax}
                                onChange={(e) => handleUpdateTax(item.id, parseFloat(e.target.value) || 0)}
                                className="w-full h-9 px-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-inner transition-all appearance-none text-center"
                            >
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        {item.tax > 0 && (
                            <p className="text-[9px] font-bold text-green-500 text-right mt-1">+₹{((item.quantity * item.price_per_item * (1 - item.discount / 100) * item.tax) / 100).toFixed(2)}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right border-r border-gray-100 align-top pt-5">
                        <p className="text-sm font-black text-gray-900">
                          ₹{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center align-top pt-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.id)}
                          className="h-8 w-8 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-full opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {invoiceItems.length > 0 && (
                <tfoot className="bg-gray-50 border-t-2 border-gray-100">
                    <tr className="font-bold">
                        <td colSpan={6} className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase border-r border-gray-100">Subtotal & Tax Calculations</td>
                        <td className="px-4 py-3 text-center border-r border-gray-100">
                             <div className="flex flex-col items-center">
                                <span className="text-[9px] text-gray-400 uppercase tracking-tighter">Tax Total</span>
                                <span className="text-xs text-green-600">+ ₹{calculateTax().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                             </div>
                        </td>
                        <td className="px-4 py-3 text-right bg-blue-50/50 border-r border-gray-100">
                            <span className="text-sm font-black text-primary">₹{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </td>
                        <td></td>
                    </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Bottom Section: Notes & Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Notes & Terms */}
            <div className="lg:col-span-3 space-y-6">
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                    <div className="p-5 space-y-5">
                        {/* Notes */}
                        <div className="space-y-3">
                            {!showNotesField ? (
                                <button
                                    onClick={() => setShowNotesField(true)}
                                    className="text-primary hover:text-primary-active text-sm font-bold flex items-center gap-2 group"
                                >
                                    <div className="h-6 w-6 rounded-full bg-blue-50 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                    Add Internal Notes
                                </button>
                            ) : (
                                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Internal Notes</label>
                                        <button onClick={() => {setShowNotesField(false); setNotes("");}} className="text-gray-400 hover:text-red-500">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Add notes for internal tracking (won't appear on print)..."
                                        className="w-full h-24 p-3 text-sm bg-gray-50 border-gray-200 rounded-xl focus:bg-white transition-all focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Terms */}
                        <div className="space-y-3 pt-2 border-t border-dashed border-gray-100">
                            {!showTermsField ? (
                                <button
                                    onClick={() => setShowTermsField(true)}
                                    className="text-primary hover:text-primary-active text-sm font-bold flex items-center gap-2 group"
                                >
                                    <div className="h-6 w-6 rounded-full bg-blue-50 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                    Add Terms and Conditions
                                </button>
                            ) : (
                                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Terms & Conditions</label>
                                        <button onClick={() => {setShowTermsField(false); setTermsAndConditions("");}} className="text-gray-400 hover:text-red-500">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <textarea
                                        value={termsAndConditions}
                                        onChange={(e) => setTermsAndConditions(e.target.value)}
                                        placeholder="Add payment terms, delivery schedules, etc..."
                                        className="w-full h-24 p-3 text-sm bg-gray-50 border-gray-200 rounded-xl focus:bg-white transition-all focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Additional Option: Signature Placeholder */}
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center opacity-60">
                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                        <Info className="h-5 w-5" />
                    </div>
                    <p className="mt-2 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">E-Signature Module<br/><span className="text-[9px] font-normal lowercase tracking-normal">Signature will be applied based on business settings</span></p>
                </div>
            </div>

            {/* Financial Summary card */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div className="px-6 py-4 border-b bg-gray-50/50">
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Total Summary</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Subtotal</span>
                                <span className="text-gray-900 font-bold">₹{calculateSubtotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Item Discount</span>
                                <span className="text-red-500 font-bold">- ₹{calculateItemDiscount().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium">Taxable Amount</span>
                                <span className="text-gray-900 font-bold">₹{(calculateSubtotal() - calculateItemDiscount()).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-dashed border-gray-100 pt-3">
                                <span className="text-gray-500 font-medium italic">SGST (9%)</span>
                                <span className="text-gray-900 font-medium">₹{(calculateTax() / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500 font-medium italic">CGST (9%)</span>
                                <span className="text-gray-900 font-medium">₹{(calculateTax() / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* Overall Discount Section */}
                        <div className="pt-3 border-t border-gray-100">
                            {!showDiscountField ? (
                                <button
                                    onClick={() => setShowDiscountField(true)}
                                    className="text-primary hover:text-primary-active text-xs font-bold flex items-center gap-1.5"
                                >
                                    <Plus className="h-3 w-3" />
                                    Add Overall Discount
                                </button>
                            ) : (
                                <div className="space-y-3 animate-in fade-in duration-300">
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-500 font-medium">Overall Discount</span>
                                            <button onClick={() => {setShowDiscountField(false); setDiscount({type: "percentage", value: 0});}} className="text-gray-400 hover:text-red-500"><X className="h-3 w-3"/></button>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <select
                                                value={discount.type}
                                                onChange={(e) => setDiscount(prev => ({...prev, type: e.target.value as any}))}
                                                className="h-7 text-[10px] font-bold border-gray-200 rounded-lg bg-gray-50"
                                            >
                                                <option value="percentage">%</option>
                                                <option value="amount">₹</option>
                                            </select>
                                            <input
                                                type="number"
                                                value={discount.value}
                                                onChange={(e) => setDiscount(prev => ({...prev, value: parseFloat(e.target.value) || 0}))}
                                                className="w-16 h-7 text-xs font-bold border-gray-200 rounded-lg bg-gray-50 text-right px-1.5 focus:bg-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end pr-1">
                                        <p className="text-xs font-bold text-red-500">- ₹{calculateOverallDiscount().toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Total Amount */}
                        <div className="pt-6 border-t-2 border-gray-100 flex justify-between items-center">
                            <span className="text-lg font-black text-gray-800 uppercase tracking-tighter">Grand Total</span>
                            <div className="text-right">
                                <span className="text-2xl font-black text-primary leading-none">₹{calculateTotal().toLocaleString()}</span>
                                <p className="text-[10px] font-bold text-green-600 uppercase italic tracking-widest mt-1">all taxes included</p>
                            </div>
                        </div>

                        {/* Payment Section - Premium Card */}
                        <div className="mt-8 bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-200/50 space-y-5 animate-in slide-in-from-bottom-5 duration-500">
                            <div className="flex justify-between items-center bg-blue-500/30 rounded-full px-4 py-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="fullPay"
                                        checked={isFullyPaid}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setIsFullyPaid(checked);
                                            if (checked) setAmountPaid(calculateTotal());
                                        }}
                                        className="h-4 w-4 rounded border-blue-400 bg-transparent text-blue-500 focus:ring-offset-blue-600"
                                    />
                                    <label htmlFor="fullPay" className="text-xs font-bold uppercase tracking-tight cursor-pointer">Mark Fully Paid</label>
                                </div>
                                <div className="h-5 w-[1px] bg-blue-400/50"></div>
                                <span className="text-[10px] font-medium opacity-80 italic">Recording direct payment</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase opacity-70">Amount Received (₹)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold opacity-60">₹</span>
                                        <input
                                            type="number"
                                            value={isFullyPaid ? calculateTotal() : amountPaid}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                setAmountPaid(val);
                                                if (val !== calculateTotal()) setIsFullyPaid(false);
                                            }}
                                            disabled={isFullyPaid}
                                            className="w-full h-11 bg-white/20 border-white/30 rounded-xl pl-6 pr-3 text-lg font-black text-white focus:outline-none focus:bg-white/30 transition-all placeholder:text-white/40 disabled:opacity-50"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase opacity-70">Payment Mode</label>
                                    <select
                                        value={paymentMode}
                                        onChange={(e) => setPaymentMode(e.target.value)}
                                        className="w-full h-11 bg-white/20 border-white/30 rounded-xl px-3 text-sm font-bold text-white focus:outline-none focus:bg-white/30 transition-all appearance-none"
                                    >
                                        <option value="Cash" className="text-gray-900">Cash</option>
                                        <option value="UPI" className="text-gray-900">UPI</option>
                                        <option value="Bank Transfer" className="text-gray-900">Bank Transfer</option>
                                        <option value="Card" className="text-gray-900">Credit/Debit Card</option>
                                        <option value="Cheque" className="text-gray-900">Cheque</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/20 flex justify-between items-center group">
                                <span className="text-xs font-bold uppercase opacity-80">Remaining Balance</span>
                                <div className="text-right">
                                    <span className="text-xl font-black text-white drop-shadow-sm group-hover:scale-110 transition-transform block">
                                        ₹{(calculateTotal() - (isFullyPaid ? calculateTotal() : amountPaid)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
        <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <div className="bg-[#1B84FF] px-6 py-6 text-white flex justify-between items-center">
            <div>
                <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Choose Vendor</DialogTitle>
                <p className="text-xs font-medium opacity-80 mt-1 uppercase tracking-widest">Searching in vendor directory</p>
            </div>
            <button
                onClick={() => setIsVendorDialogOpen(false)}
                className="hover:scale-110 transition-transform opacity-60 hover:opacity-100"
            >
                <X className="h-6 w-6" />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                <Input
                    placeholder="Type name, company or mobile number..."
                    className="pl-12 h-14 bg-gray-50 border-gray-100 text-base font-medium focus:ring-4 focus:ring-blue-50 transition-all rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                />
            </div>

            <div className="max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
              {isVendorsLoading ? (
                <div className="py-24 flex flex-col items-center justify-center gap-4">
                  <SpinnerDotted size={40} color="#1B84FF" thickness={150} />
                  <p className="text-sm font-bold text-gray-400 animate-pulse">Syncing vendors...</p>
                </div>
              ) : filteredVendors.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {filteredVendors.map((v) => (
                    <div
                      key={v.uuid}
                      className="group relative p-5 bg-white border border-gray-100 rounded-2xl hover:border-primary hover:bg-blue-50/20 cursor-pointer transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
                      onClick={() => handleSelectVendor(v)}
                    >
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <h5 className="font-black text-gray-900 leading-none group-hover:text-primary transition-colors">{v.name}</h5>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-tight">{v.company_name || "Personal Portfolio"}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 font-mono">
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded leading-none">{v.mobile}</span>
                                {v.gst && <span className="text-[9px] font-bold text-primary bg-blue-50 px-2 py-0.5 rounded leading-none border border-blue-100">{v.gst}</span>}
                            </div>
                        </div>
                        <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between opacity-60 group-hover:opacity-100">
                            <p className="text-[10px] text-gray-500 leading-none">📍 {v.city || "Area Not Defined"}</p>
                            <ArrowLeft className="h-3 w-3 text-primary rotate-180 transition-transform group-hover:translate-x-1" />
                        </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-24 text-center space-y-4">
                  <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                    <Search className="h-10 w-10 text-gray-200" />
                  </div>
                  <div>
                    <p className="font-black text-gray-300 uppercase italic tracking-widest text-lg">No Results Found</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto leading-relaxed italic font-medium">Try checking your search terms or add a new vendor to your directory</p>
                  </div>
                </div>
              )}
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
        onSuccess={() => setShowCreateItemModal(false)}
        item={null}
      />
    </div>
  );
};

export default CreatePurchaseInvoicePage;
