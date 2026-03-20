import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer, CreditCard, FileText, Clock, Info, Edit, Share, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeenIcon } from "@/components";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getPurchaseInvoiceById, recordPurchaseInvoicePayment } from "../services/purchaseInvoice.services";
import { getShareData, sendShareEmail, ShareData } from "@/services/share.service";
import { SpinnerDotted } from "spinners-react";
import { useAuthContext } from "@/auth";
import { toAbsoluteUrl } from "@/utils/Assets";
import { resolveImageUrl } from "@/utils/imageUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getGlobalAssets } from "@/pages/global-config/services/businessConfig.service";

interface PurchaseInvoiceItem {
  uuid: string;
  item_id: string | null;
  product_name?: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount: { discount_percentage?: number; discount_amount?: number };
  tax: { tax_percentage?: number; tax_amount?: number };
  total_price: number;
  hsn_sac_code?: string;
  measuring_unit_id?: number;
}

interface Vendor {
  uuid: string;
  vendor_name: string;
  company_name?: string;
  mobile: string;
  email?: string;
  gst?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
}

interface PurchaseInvoiceData {
  uuid: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  payment_status: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  vendor: Vendor | null;
  items: PurchaseInvoiceItem[];
  additional_notes?: { notes?: string; terms_and_conditions?: string };
  business?: any;
}

const PurchaseInvoiceDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentUser } = useAuthContext();
  const [invoiceData, setInvoiceData] = useState<PurchaseInvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isFetchingShareData, setIsFetchingShareData] = useState(false);
  const [brandingAssets, setBrandingAssets] = useState<{ logo_path?: string; esign_path?: string } | null>(null);

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: 0,
    discount: 0,
    date: new Date(),
    mode: "cash",
    notes: ""
  });

  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchInvoiceData();
      fetchBrandingAssets();
    }
  }, [id]);

  const fetchBrandingAssets = async () => {
    try {
      const response = await getGlobalAssets();
      if (response.success && response.data) {
        setBrandingAssets(response.data);
      }
    } catch (error) {
      console.error("Error fetching branding assets:", error);
    }
  };

  const fetchInvoiceData = async () => {
    setIsLoading(true);
    try {
      const response = await getPurchaseInvoiceById(id!);
      if (response.success && response.data) {
        setInvoiceData(response.data as unknown as PurchaseInvoiceData);
      } else {
        toast.error(response.error || "Failed to load purchase invoice");
        navigate("/purchases/purchase-invoices");
      }
    } catch (error) {
      console.error("Error fetching invoice:", error);
      toast.error("Failed to load invoice");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareWhatsApp = async () => {
    if (!invoiceData) return;
    setIsFetchingShareData(true);
    const fetchToast = toast.loading("Preparing share options...");
    try {
      const response = await getShareData(invoiceData.uuid, 'purchase_invoice');
      if (response.success && response.data) {
        const { message, contact } = response.data;
        const whatsappUrl = `https://wa.me/${contact?.mobile || ""}?text=${encodeURIComponent(message || "")}`;
        window.open(whatsappUrl, "_blank");
        toast.success("Opening WhatsApp...", { id: fetchToast });
      } else {
        throw new Error(response.error || "Failed to fetch share data");
      }
    } catch (error: any) {
      console.error("Share error:", error);
      toast.error(error.message || "Failed to prepare share link", { id: fetchToast });
    } finally {
      setIsFetchingShareData(false);
    }
  };

  const handleShareEmail = async () => {
    if (!invoiceData) return;
    setIsFetchingShareData(true);
    const fetchToast = toast.loading("Sending email...");
    try {
      const response = await sendShareEmail(invoiceData.uuid, 'purchase_invoice');
      if (response.success) {
        toast.success("Email sent successfully!", { id: fetchToast });
      } else {
        throw new Error(response.error || "Failed to send email");
      }
    } catch (error: any) {
      console.error("Email error:", error);
      toast.error(error.message || "Failed to send email", { id: fetchToast });
    } finally {
      setIsFetchingShareData(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoiceData) return;
    const downloadToast = toast.loading("Generating PDF...");
    try {
      const token = (() => {
        try {
          const authData = localStorage.getItem('OTOI-auth-v1.0.0.1');
          if (!authData) return null;
          const parsedAuth = JSON.parse(authData);
          return parsedAuth.token || parsedAuth.access_token || parsedAuth.accessToken || null;
        } catch (error) {
          return null;
        }
      })();

      const response = await fetch(`${import.meta.env.VITE_APP_API_URL}/purchase-invoices/${invoiceData.uuid}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PurchaseInvoice-${invoiceData.invoice_number || "Draft"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully", { id: downloadToast });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF", { id: downloadToast });
    }
  };

  const handlePrintPDF = () => {
    const originalTitle = document.title;
    document.title = " ";
    window.print();
    document.title = originalTitle;
  };

  const handleRecordPayment = () => {
    if (!invoiceData) return;
    setPaymentForm({
      amount: invoiceData.balance_due,
      discount: 0,
      date: new Date(),
      mode: "cash",
      notes: ""
    });
    setIsRecordPaymentOpen(true);
  };

  const handleSavePayment = async () => {
    if (!id || !invoiceData || isSavingPayment) return;
    if (paymentForm.amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (paymentForm.amount > invoiceData.balance_due + 0.01) {
      toast.error("Amount cannot exceed balance due");
      return;
    }

    setIsSavingPayment(true);
    try {
      const response = await recordPurchaseInvoicePayment(id, {
        amount: paymentForm.amount,
        payment_mode: paymentForm.mode,
        notes: paymentForm.notes,
        discount: paymentForm.discount,
      });

      if (response.success) {
        toast.success("Payment recorded successfully");
        setIsRecordPaymentOpen(false);
        fetchInvoiceData();
      } else {
        toast.error(response.error || "Failed to record payment");
      }
    } catch (error) {
      toast.error("An error occurred while recording payment");
    } finally {
      setIsSavingPayment(false);
    }
  };

  const calculateTotals = () => {
    if (!invoiceData) return { subtotal: 0, totalDiscount: 0, totalTax: 0, taxableAmount: 0, totalCGST: 0, totalSGST: 0, effectiveTaxRate: 0 };
    const items = invoiceData.items || [];
    const subtotal = items.reduce((sum, item) => sum + (item.unit_price || 0) * (item.quantity || 0), 0);

    const totalDiscount = items.reduce((sum, item) => {
      const discPerc = typeof item.discount === 'object' ? item.discount?.discount_percentage || 0 : (item as any).discount_percentage || 0;
      return sum + ((item.unit_price || 0) * (item.quantity || 0) * discPerc) / 100;
    }, 0);

    const totalTax = items.reduce((sum, item) => {
      const discPerc = typeof item.discount === 'object' ? item.discount?.discount_percentage || 0 : (item as any).discount_percentage || 0;
      const taxPerc = typeof item.tax === 'object' ? item.tax?.tax_percentage || 0 : (item as any).tax_percentage || 0;
      const lineTaxable = (item.unit_price || 0) * (item.quantity || 0) * (1 - discPerc / 100);
      return sum + (lineTaxable * taxPerc) / 100;
    }, 0);

    const taxableAmount = subtotal - totalDiscount;
    const effectiveTaxRate = taxableAmount > 0 ? (totalTax / taxableAmount) * 100 : 0;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      taxableAmount,
      totalCGST: totalTax / 2,
      totalSGST: totalTax / 2,
      effectiveTaxRate
    };
  };

  const totals = calculateTotals();

  const formatCurrency = (amount: number) => {
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatNumberInWords = (num: number) => {
    if (!Number.isFinite(num)) return "Zero Rupees";
    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const twoDigits = (value: number) => {
      if (value === 0) return "";
      if (value < 10) return units[value];
      if (value < 20) return teens[value - 10];
      const ten = Math.floor(value / 10);
      const unit = value % 10;
      return unit ? `${tens[ten]} ${units[unit]}` : tens[ten];
    };

    const threeDigits = (value: number) => {
      if (value === 0) return "";
      const hundred = Math.floor(value / 100);
      const rest = value % 100;
      if (hundred === 0) return twoDigits(rest);
      if (rest === 0) return `${units[hundred]} Hundred`;
      return `${units[hundred]} Hundred ${twoDigits(rest)}`;
    };

    const toIndianWords = (value: number) => {
      if (value === 0) return "Zero";
      let remainder = value;
      const parts: string[] = [];

      const crore = Math.floor(remainder / 10000000);
      if (crore) { parts.push(`${threeDigits(crore)} Crore`); remainder %= 10000000; }
      const lakh = Math.floor(remainder / 100000);
      if (lakh) { parts.push(`${threeDigits(lakh)} Lakh`); remainder %= 100000; }
      const thousand = Math.floor(remainder / 1000);
      if (thousand) { parts.push(`${threeDigits(thousand)} Thousand`); remainder %= 1000; }
      const rest = remainder;
      if (rest) parts.push(threeDigits(rest));
      return parts.join(" ");
    };

    const totalPaise = Math.round(Math.abs(num) * 100);
    if (totalPaise === 0) return "Zero Rupees";
    const rupees = Math.floor(totalPaise / 100);
    const paise = totalPaise % 100;
    let result = `${toIndianWords(rupees)} Rupees`;
    if (paise) result += ` and ${toIndianWords(paise)} Paise`;
    return result + " Only";
  };

  const getMeasuringUnit = (unitId?: number) => {
    const units: { [key: number]: string } = {
      1: "PCS", 2: "KG", 3: "LTR", 4: "MTR",
    };
    return units[unitId || 1] || "PCS";
  };

  const getPaymentStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-green-100 text-green-800",
      partial: "bg-yellow-100 text-yellow-800",
      unpaid: "bg-red-100 text-red-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-[4px]">
        <div className="flex flex-col items-center gap-4">
          <SpinnerDotted size={50} color="#1B84FF" />
          <p className="text-sm font-semibold text-gray-700 tracking-wide uppercase">Fetching Detail...</p>
        </div>
      </div>
    );
  }

  if (!invoiceData) return null;

  const getAuthBusinessInfo = () => {
    const fetchedBusiness = invoiceData?.business;
    if (fetchedBusiness) {
      return {
        name: fetchedBusiness.company_name || fetchedBusiness.name || fetchedBusiness.company || "Evoto Technologies",
        email: fetchedBusiness.email || currentUser?.email,
        phone: fetchedBusiness.phone_number || fetchedBusiness.phone || fetchedBusiness.mobile || currentUser?.phone,
        address: fetchedBusiness.address || fetchedBusiness.billing_address || null,
        gst: fetchedBusiness.gst_number || fetchedBusiness.gst || null,
      };
    }
    try {
      const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
      if (authData) {
        const parsedAuth = JSON.parse(authData);
        const business = parsedAuth.business || parsedAuth.business_profile || (parsedAuth.user?.businesses && parsedAuth.user.businesses[0]);
        if (business) {
          return {
            name: business.company_name || business.name || business.company || "Evoto Technologies",
            email: business.email || currentUser?.email,
            address: business.address || null,
            phone: business.phone_number || business.phone || business.mobile || currentUser?.phone || "",
            gst: business.gst_number || business.gst || null,
          };
        }
      }
    } catch (e) { /* silent */ }
    return {
      name: "Evoto Technologies",
      email: currentUser?.email || "",
      address: null,
      phone: currentUser?.phone || "",
    };
  };

  const businessInfo = getAuthBusinessInfo();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      <style>
        {`
          @media print {
            .sidebar, .header, .footer, .topbar, .no-print, [data-kt-app-sidebar-enabled="true"] .app-sidebar, [data-kt-app-header-enabled="true"] .app-header {
              display: none !important;
            }
            body { background-color: white !important; margin: 0 !important; padding: 0 !important; }
            .min-h-screen { min-height: auto !important; background: none !important; padding: 0 !important; }
            #invoice-print-area {
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              max-width: 100% !important;
              width: 100% !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}
      </style>

      {/* Sticky Header */}
      <div className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 no-print">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/purchases/purchase-invoices")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-black">Purchase Invoice #{invoiceData.invoice_number}</h1>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${getPaymentStatusBadge(invoiceData.payment_status)}`}>
                {invoiceData.payment_status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2"><Download className="h-4 w-4" />Download PDF</Button>
            <Button variant="outline" size="sm" onClick={handlePrintPDF} className="gap-2"><Printer className="h-4 w-4" />Print PDF</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" disabled={isFetchingShareData}>
                  <Share className="h-4 w-4" /> Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2 cursor-pointer">
                  <KeenIcon icon="whatsapp" className="text-black-800" /> WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareEmail} className="gap-2 cursor-pointer">
                  <Mail className="h-4 w-4" /> Email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {invoiceData.balance_due > 0 && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" onClick={handleRecordPayment}>
                <CreditCard className="h-4 w-4" />Record Payment
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Content */}
      <div id="invoice-print-area" ref={invoiceRef} className="max-w-4xl mx-auto p-12 bg-white mt-8 shadow-sm border border-gray-100">
        <div className="mb-12 flex justify-between items-start">
          <div className="mt-12">
            <h1 className="text-2xl font-semibold text-black">{businessInfo?.name || "Evoto Technologies"}</h1>
            {businessInfo?.email && <p className="text-xs text-gray-600 mt-1 font-medium">{businessInfo.email}</p>}
            {businessInfo?.phone && <p className="text-xs text-gray-600 mt-1 font-medium">{businessInfo.phone}</p>}
            {businessInfo?.address && <p className="text-xs text-gray-600 mt-1 font-medium">{businessInfo.address}</p>}
            {businessInfo?.gst && <p className="text-xs text-gray-600 font-semibold mt-1">GSTIN: {businessInfo.gst}</p>}
          </div>
          <div className="flex flex-col items-end -mt-8">
            {brandingAssets?.logo_path ? (
              <img
                src={resolveImageUrl(`/static/uploads/business/${brandingAssets.logo_path}`)}
                className="h-40 w-auto object-contain"
                alt={businessInfo?.name || "Logo"}
              />
            ) : (
              <img
                src={toAbsoluteUrl("/media/app/Evoto-Logo.png")}
                className="h-40 w-auto object-contain"
                alt="Evoto Technologies"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-0 mb-12 border border-black overflow-hidden">
          <div className="border-r border-black">
            <div className="px-4 py-1 border-b border-black bg-gray-100 font-bold uppercase text-[11px]">Invoice Number</div>
            <div className="px-4 py-2 font-normal text-sm">{invoiceData.invoice_number}</div>
          </div>
          <div className="border-r border-black">
            <div className="px-4 py-1 border-b border-black bg-gray-100 font-bold uppercase text-[11px] text-center">Invoice Date</div>
            <div className="px-4 py-2 text-center font-normal text-sm">{new Date(invoiceData.invoice_date).toLocaleDateString("en-IN")}</div>
          </div>
          <div>
            <div className="px-4 py-1 border-b border-black bg-gray-100 font-bold uppercase text-[11px] text-right">Due Date</div>
            <div className="px-4 py-2 text-right font-normal text-sm">
              {invoiceData.due_date ? new Date(invoiceData.due_date).toLocaleDateString("en-IN") : "N/A"}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 border-b border-black pb-1 w-32">
            <h3 className="text-[10px] font-bold uppercase">Vendor Details</h3>
          </div>
          <p className="font-bold text-base text-black uppercase">{invoiceData.vendor?.vendor_name}</p>
          <div className="text-xs text-gray-700 mt-1 space-y-0.5">
            {invoiceData.vendor?.company_name && <p className="font-medium">{invoiceData.vendor.company_name}</p>}
            {invoiceData.vendor?.gst && <p><span className="font-bold text-black uppercase text-[9px]">GSTIN:</span> {invoiceData.vendor.gst}</p>}
            {invoiceData.vendor?.mobile && <p><span className="font-bold text-black uppercase text-[9px]">Mobile:</span> {invoiceData.vendor.mobile}</p>}
            <p>{invoiceData.vendor?.address1}</p>
            <div className="flex gap-4 pt-1">
              {invoiceData.vendor?.city && <p><span className="font-bold text-black uppercase text-[9px]">City:</span> {invoiceData.vendor.city}</p>}
              <p><span className="font-bold text-black uppercase text-[9px]">State:</span> {invoiceData.vendor?.state}</p>
              <p><span className="font-bold text-black uppercase text-[9px]">Pin:</span> {invoiceData.vendor?.pin}</p>
            </div>
          </div>
        </div>

        <table className="w-full border border-black mb-8 text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-black">
              <th className="p-2 text-left font-bold border-r border-black uppercase text-[10px] w-1/2">Item Description</th>
              <th className="p-2 text-center font-bold border-r border-black uppercase text-[10px]">QTY</th>
              <th className="p-2 text-right font-bold border-r border-black uppercase text-[10px]">Price/Item</th>
              <th className="p-2 text-right font-bold border-r border-black uppercase text-[10px]">Disc.</th>
              <th className="p-2 text-right font-bold border-r border-black uppercase text-[10px]">Tax</th>
              <th className="p-2 text-right font-bold uppercase text-[10px]">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {invoiceData.items.map((item, idx) => {
              const discPerc = typeof item.discount === 'object' ? item.discount?.discount_percentage || 0 : (item as any).discount_percentage || 0;
              const discAmt = (item.unit_price * item.quantity * discPerc) / 100;
              const taxPerc = typeof item.tax === 'object' ? item.tax?.tax_percentage || 0 : (item as any).tax_percentage || 0;
              const taxAmt = ((item.unit_price * item.quantity) - discAmt) * taxPerc / 100;

              return (
                <tr key={idx}>
                  <td className="p-2 border-r border-black align-top">
                    <div className="flex items-start gap-1">
                      <span className="font-medium text-sm text-black min-w-[20px]">{idx + 1}.</span>
                      <div className="flex-1">
                        <p className="font-semibold text-black leading-snug">{item.product_name}</p>
                        {item.description && <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>}
                        {item.hsn_sac_code && <p className="text-[9px] text-gray-400 mt-1">HSN/SAC: {item.hsn_sac_code}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-center border-r border-black align-top whitespace-nowrap">
                    {item.quantity} <span className="text-[10px] ml-0.5">{getMeasuringUnit(item.measuring_unit_id)}</span>
                  </td>
                  <td className="p-2 text-right border-r border-black align-top whitespace-nowrap">{formatCurrency(item.unit_price)}</td>
                  <td className="p-2 text-right border-r border-black align-top whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span>-{formatCurrency(discAmt)}</span>
                      {discPerc > 0 && <span className="text-[9px]">({discPerc}%)</span>}
                    </div>
                  </td>
                  <td className="p-2 text-right border-r border-black align-top whitespace-nowrap">
                    <div className="flex flex-col items-end">
                      <span>{formatCurrency(taxAmt)}</span>
                      <span className="text-[9px] block text-gray-500">({taxPerc}%)</span>
                    </div>
                  </td>
                  <td className="p-2 text-right font-medium align-top whitespace-nowrap">{formatCurrency(item.total_price)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-black bg-gray-50 font-bold">
              <td colSpan={2} className="p-2 text-right text-[10px] uppercase tracking-widest text-black border-r border-black">Subtotal</td>
              <td className="p-2 text-right text-sm text-black border-r border-black whitespace-nowrap">{formatCurrency(totals.subtotal)}</td>
              <td className="p-2 text-right text-sm text-black border-r border-black whitespace-nowrap">-{formatCurrency(totals.totalDiscount)}</td>
              <td className="p-2 text-right text-sm text-black border-r border-black whitespace-nowrap">{formatCurrency(totals.totalTax)}</td>
              <td className="p-2 text-right text-sm text-black whitespace-nowrap">{formatCurrency(invoiceData.total_amount)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="flex justify-between items-start gap-12">
          <div className="flex-1">
            {invoiceData.additional_notes?.notes && (
              <div className="mb-4">
                <h4 className="text-[10px] font-bold uppercase border-b border-black w-12 mb-1">Notes</h4>
                <p className="text-[10px] text-gray-700 leading-relaxed italic">{invoiceData.additional_notes.notes}</p>
              </div>
            )}
            {invoiceData.additional_notes?.terms_and_conditions && (
              <div className="mb-4">
                <h4 className="text-[10px] font-bold uppercase border-b border-black w-32 mb-1">Terms & Conditions</h4>
                <p className="text-[10px] text-gray-700 leading-relaxed">{invoiceData.additional_notes.terms_and_conditions}</p>
              </div>
            )}
          </div>

          <div className="w-72 space-y-0 text-black">
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-normal uppercase">Taxable Amount</span>
              <span className="text-sm font-bold">{formatCurrency(totals.taxableAmount)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-normal uppercase">CGST ({Math.round(totals.effectiveTaxRate / 2 * 100) / 100}%)</span>
              <span className="text-sm font-bold">{formatCurrency(totals.totalCGST)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-black">
              <span className="text-xs font-normal uppercase">SGST ({Math.round(totals.effectiveTaxRate / 2 * 100) / 100}%)</span>
              <span className="text-sm font-bold">{formatCurrency(totals.totalSGST)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b-2 border-black">
              <span className="text-sm font-bold">GRAND TOTAL</span>
              <span className="text-xl font-bold">{formatCurrency(invoiceData.total_amount)}</span>
            </div>

            <div className="pt-2 text-right">
              <p className="text-xs leading-tight">
                <span className="font-bold uppercase text-[12px]">In words:</span> {formatNumberInWords(invoiceData.total_amount)}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-dashed border-gray-300 space-y-2 no-print">
              <div className="flex justify-between text-xs text-green-700">
                <span className="font-medium uppercase">Amount Paid</span>
                <span className="font-bold">{formatCurrency(invoiceData.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-base text-red-700 font-bold">
                <span className="uppercase">Balance Due</span>
                <span>{formatCurrency(invoiceData.balance_due)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 md:mt-20 flex justify-end">
          <div className="text-center">
            {brandingAssets?.esign_path && (
              <div className="mb-0 flex justify-center">
                <img
                  src={resolveImageUrl(`/static/uploads/business/${brandingAssets.esign_path}`)}
                  className="h-12 md:h-16 w-auto object-contain"
                  alt="Signature"
                />
              </div>
            )}
            <div className="w-48 border-b border-black mb-1"></div>
            <p className="text-[10px] font-bold text-black uppercase tracking-wider">
              Authorized Signatory
            </p>
          </div>
        </div>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={isRecordPaymentOpen} onOpenChange={setIsRecordPaymentOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-white">
          <DialogHeader className="px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-gray-600" />
              Record Payment For Invoice #{invoiceData.invoice_number}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Form Section */}
              <div className="md:col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Amount Paid <span className="text-red-500">*</span></label>
                    <Input
                      type="number"
                      value={paymentForm.amount || ""}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                      className="h-10"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <label className="text-sm font-medium text-gray-700">Payment Out Discount</label>
                      <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                    </div>
                    <Input
                      type="number"
                      value={paymentForm.discount || ""}
                      onChange={(e) => setPaymentForm({ ...paymentForm, discount: parseFloat(e.target.value) || 0 })}
                      className="h-10"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Payment Date</label>
                    <Input
                      type="date"
                      value={paymentForm.date.toISOString().split('T')[0]}
                      onChange={(e) => setPaymentForm({ ...paymentForm, date: new Date(e.target.value) })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Payment Mode</label>
                    <Select value={paymentForm.mode} onValueChange={(val) => setPaymentForm({ ...paymentForm, mode: val })}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    placeholder="Reference number or note"
                    className="w-full min-h-[100px] p-2 border rounded-md text-sm border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none outline-none"
                  />
                </div>
              </div>

              {/* Info & Calculation Section */}
              <div className="md:col-span-2 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-xs sm:text-sm">
                  <h4 className="font-semibold text-gray-800 mb-2 sm:mb-3">
                    Invoice #{invoiceData.invoice_number}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Invoice Amount</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(invoiceData.total_amount)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 truncate mr-2">{invoiceData.vendor?.vendor_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Due Date: {invoiceData.due_date ? new Date(invoiceData.due_date).toLocaleDateString("en-IN") : "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">
                    Record Payment Calculation
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-red-600 font-medium">Invoice Pending Amt.</span>
                      <span className="text-red-600 font-semibold">{formatCurrency(invoiceData.balance_due)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Amount Paid</span>
                      <span className="text-gray-900 font-medium">{formatCurrency(paymentForm.amount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Payment Out Discount</span>
                      <span className="text-gray-900 font-medium">₹{paymentForm.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-800">Balance Amount</span>
                      <span className="text-base font-bold text-blue-600">
                        {formatCurrency(Math.max(0, invoiceData.balance_due - paymentForm.amount - paymentForm.discount))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsRecordPaymentOpen(false)} className="h-10 bg-white border-gray-300 font-medium">Close</Button>
            <Button onClick={handleSavePayment} disabled={isSavingPayment || paymentForm.amount <= 0} className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6">
              {isSavingPayment ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PurchaseInvoiceDetailsPage;
