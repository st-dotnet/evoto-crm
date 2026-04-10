import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Printer,
  Edit,
  Clock,
  Plus,
  CreditCard,
  Share,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KeenIcon } from "@/components/keenicons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { getDebitNoteById, getDebitNotePayments, createDebitNotePayment, getVendorById } from '../service/debitNote.service';
import { getShareData, sendShareEmail } from "@/services/share.service";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { SpinnerDotted } from "spinners-react";
import { useAuthContext } from "@/auth";
import { toAbsoluteUrl } from "@/utils/Assets";
import { resolveImageUrl } from "@/utils/imageUtils";
import { getGlobalAssets } from "@/pages/global-config/services/businessConfig.service";

const DebitNoteDetailsPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuthContext();
  const debitNoteRef = useRef<HTMLDivElement>(null);

  const [debitNoteData, setDebitNoteData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [originalInvoiceData, setOriginalInvoiceData] = useState<any>(null);
  const [newPayment, setNewPayment] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: '',
    payment_reference: '',
    payment_notes: ''
  });
  const [isFetchingShareData, setIsFetchingShareData] = useState(false);
  const [brandingAssets, setBrandingAssets] = useState<{ logo_path?: string; esign_path?: string } | null>(null);

  // Helper functions
  const formatCurrency = (amount: number) => {
    return `₹ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate balance due from original invoice (same as PurchaseInvoiceDetailsPage)
  const calculateBalanceDue = () => {
    // Use backend-provided balance_due from original invoice (same logic as PurchaseInvoiceDetailsPage)
    if (originalInvoiceData) {
      return originalInvoiceData.balance_due || originalInvoiceData.balance_amount || 0;
    }

    // Fallback: use debit note's own balance_due if available
    return debitNoteData.balance_due || 0;
  };

  const formatNumberInWords = (num: number) => {
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

  const getAuthBusinessInfo = () => {
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


  // Validate data structure
  const validateDebitNoteData = (data: any) => {
    if (!data) return false;
    if (typeof data !== 'object') return false;

    // Check for essential fields
    const hasEssentialFields = data.debit_note_number || data.debit_note_date || data.vendor_id;
    const hasItems = Array.isArray(data?.items) && data.items.length > 0;

    return hasEssentialFields || hasItems;
  };

  const isValidData = validateDebitNoteData(debitNoteData);

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

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        return;
      }

      setIsLoading(true);
      try {
        // Check if data was passed from navigation state
        const passedData = location.state?.debitNoteData;

        let response;
        if (passedData && passedData.uuid) {
          // Use passed data to avoid re-fetching
          response = { success: true, data: passedData };
        } else {
          // Fallback to API call if no data passed or data is invalid
          response = await getDebitNoteById(id);
        }

        if (response.success && response.data) {

          // Extract actual debit note data from nested response
          const actualData = response.data.data || response.data;
          const debitNoteInfo = actualData.debit_note || actualData;
          const items = actualData.items || [];

          // Ensure we have valid debit note info
          if (!debitNoteInfo || typeof debitNoteInfo !== 'object') {
            toast.error("Invalid debit note data received");
            navigate("/debit-note");
            return;
          }

          // Combine debit note info with items
          const combinedData = {
            ...debitNoteInfo,
            items: items
          };

          setDebitNoteData(combinedData);

          // Fetch original invoice data to calculate quantity-based balance
          if (combinedData.invoice_id) {
            try {
              const { getPurchaseInvoiceById } = await import("../../purchases/services/purchaseInvoice.services");
              const invoiceResponse = await getPurchaseInvoiceById(combinedData.invoice_id);
              if (invoiceResponse.success && invoiceResponse.data) {
                setOriginalInvoiceData(invoiceResponse.data);
              }
            } catch (error) {
            }
          }

          // Fetch vendor data if vendor_id exists
          if (combinedData.vendor_id) {
            try {
              const vendorResponse = await getVendorById(combinedData.vendor_id);
              if (vendorResponse.success && vendorResponse.data) {
                // Merge vendor data with existing data
                setDebitNoteData((prev: any) => ({
                  ...prev,
                  vendor: { ...prev.vendor, ...vendorResponse.data }
                }));
              }
            } catch (error) {
              console.error("Error fetching vendor:", error);
            }
          }
        } else {
          console.error("Failed to load debit note:", response);
          const errorMessage = response.error || "Failed to load debit note";
          if (errorMessage.includes('not found') || errorMessage.includes('500') || errorMessage.includes('Server error')) {
            toast.error('Debit note not found. It may have been deleted or does not exist.');
          } else {
            toast.error(errorMessage);
          }
          navigate("/debit-note");
        }
      } catch (error: any) {
        console.error("Error fetching debit note:", error);
        const errorMessage = (error as any)?.error || (error as any)?.message || (error as any)?.response?.data?.error || "Failed to load debit note";
        if (errorMessage.includes('not found') || errorMessage.includes('500') || errorMessage.includes('Server error')) {
          toast.error('Debit note not found. It may have been deleted or does not exist.');
        } else {
          toast.error(errorMessage);
        }
        navigate("/debit-note");
      } finally {
        setIsLoading(false);
      }
    };

    const fetchPayments = async () => {
      if (!id) return;
      try {
        const response = await getDebitNotePayments(id);
        if (response.success && response.data) {
          setPayments(response.data || []);
        }
      } catch (error) {
        console.error("Error fetching payments:", error);
      }
    };

    fetchData();
    fetchPayments();
    fetchBrandingAssets();
  }, [id, navigate]);

  const handleDownloadPDF = async () => {
    if (!debitNoteRef.current || !debitNoteData) return;
    const downloadToast = toast.loading("Generating PDF...");
    try {
      const canvas = await html2canvas(debitNoteRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`debit-note-${debitNoteData.debit_note_number}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error("Failed to generate PDF");
    } finally {
      toast.dismiss(downloadToast);
    }
  };

  const handlePrintPDF = () => {
    const originalTitle = document.title;
    document.title = " ";
    window.print();
    document.title = originalTitle;
  };

  const handleShareWhatsApp = async () => {
    if (!debitNoteData) return;
    setIsFetchingShareData(true);
    const fetchToast = toast.loading("Preparing share options...");
    try {
      const response = await getShareData(debitNoteData.uuid, 'debit_note');
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
    if (!debitNoteData) return;
    setIsFetchingShareData(true);
    const fetchToast = toast.loading("Sending email...");
    try {
      const response = await sendShareEmail(debitNoteData.uuid, 'debit_note');
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

  const handleAddPayment = async () => {
    if (!id || !debitNoteData || isAddingPayment) return;

    setIsAddingPayment(true);
    try {
      const response = await createDebitNotePayment(id, {
        payment_amount: parseFloat(newPayment.payment_amount),
        payment_date: newPayment.payment_date,
        payment_method: newPayment.payment_method,
        payment_reference: newPayment.payment_reference,
        payment_notes: newPayment.payment_notes,
      });

      if (response.success) {
        toast.success("Payment added successfully");
        setShowAddPaymentDialog(false);
        setNewPayment({
          payment_amount: '',
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: '',
          payment_reference: '',
          payment_notes: ''
        });

        // Refresh payments
        const paymentsResponse = await getDebitNotePayments(id);
        if (paymentsResponse.success && paymentsResponse.data) {
          setPayments(paymentsResponse.data || []);
        }
      } else {
        toast.error(response.error || "Failed to add payment");
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      toast.error("An error occurred while adding payment");
    } finally {
      setIsAddingPayment(false);
    }
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status || typeof status !== 'string') {
      return 'bg-gray-100 text-gray-800';
    }

    switch (status.toLowerCase()) {
      case 'unpaid':
        return 'bg-red-100 text-red-800';
      case 'credited':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <SpinnerDotted size={50} color="#6366f1" />
      </div>
    );
  }

  if (!debitNoteData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Debit Note not found</h2>
          <Button onClick={() => navigate('/debit-note')}>
            Back to Debit Notes
          </Button>
        </div>
      </div>
    );
  }

  if (!isValidData && !isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Invalid Debit Note Data</h2>
          <p className="text-gray-600 mb-4">The debit note data could not be loaded properly.</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
          <Button variant="outline" className="ml-2" onClick={() => navigate('/debit-note')}>
            Back to Debit Notes
          </Button>
        </div>
      </div>
    );
  }

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
            #debit-note-print-area {
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
      <div className="bg-white px-6 py-4 border-t border-b border-gray-200 sticky top-0 z-10 no-print">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/debit-note")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-black">Debit Note #{debitNoteData?.debit_note_number || 'Loading...'}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded capitalize ${getStatusBadge(debitNoteData?.status)}`}>
                  {debitNoteData?.status && typeof debitNoteData.status === 'string'
                    ? debitNoteData.status.charAt(0).toUpperCase() + debitNoteData.status.slice(1)
                    : 'Loading...'
                  }
                </span>
              </div>
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
                <DropdownMenuItem onClick={handleShareWhatsApp} className="gap-2 cursor-pointer text-sm">
                  <KeenIcon icon="whatsapp" className="text-black-800" /> WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareEmail} className="gap-2 cursor-pointer text-sm">
                  <Mail className="h-4 w-4" /> Email
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Debit Note Content */}
      <div id="debit-note-print-area" ref={debitNoteRef} className="max-w-4xl mx-auto p-12 bg-white mt-8 shadow-sm">
        <div className="mb-8 flex justify-between items-start">
          {(() => {
            const businessInfo = getAuthBusinessInfo();
            return (
              <>
                <div className="mt-12">
                  <h1 className="text-2xl font-semibold text-black leading-tight">
                    {businessInfo?.name || "Evoto Technologies"}
                  </h1>
                  {businessInfo?.email && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                      {businessInfo.email}
                    </p>
                  )}
                  {businessInfo?.phone && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                      {businessInfo.phone}
                    </p>
                  )}
                  {businessInfo?.address && (
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                      {businessInfo.address}
                    </p>
                  )}
                  {businessInfo?.gst && <p className="text-xs text-gray-600 font-semibold mt-1">GSTIN: {businessInfo.gst}</p>}
                </div>
                <div className="flex flex-col items-end -mt-8">
                  <img
                    src={toAbsoluteUrl("/media/app/Evoto-Logo.png")}
                    className="h-40 w-auto object-contain"
                    alt="Evoto Technologies"
                  />
                </div>
              </>
            );
          })()}
        </div>

        <div className="grid grid-cols-3 gap-0 mb-12 border border-black overflow-hidden">
          {/* Labels Row */}
          <div className="px-4 py-1 border-b border-black bg-gray-100">
            <p className="text-[11px] font-semibold text-black uppercase">
              Debit Note No.
            </p>
          </div>
          <div className="px-4 py-1 border-x border-b border-black text-center bg-gray-100">
            <p className="text-[11px] font-semibold text-black uppercase">
              Debit Note Date
            </p>
          </div>
          <div className="px-4 py-1 border-b border-black text-right bg-gray-100">
            <p className="text-[11px] font-semibold text-black uppercase">
              Invoice No.
            </p>
          </div>

          {/* Values Row */}
          <div className="px-4 py-1">
            <p className="text-[14px] font-normal text-black">
              {debitNoteData?.debit_note_number || 'N/A'}
            </p>
          </div>
          <div className="px-4 py-1 border-x border-black text-center">
            <p className="text-[14px] font-normal text-black">
              {debitNoteData?.debit_note_date ? new Date(debitNoteData.debit_note_date).toLocaleDateString("en-IN") : 'N/A'}
            </p>
          </div>
          <div className="px-4 py-1 text-right">
            <p className="text-[14px] font-normal text-black">
              {debitNoteData?.linked_invoice_id || debitNoteData?.invoice_number || "N/A"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-12">
          <div>
            <h3 className="text-[15px] font-semibold text-black uppercase mb-3 pb-1 border-b border-black w-56">
              BILL TO
            </h3>
            <div className="space-y-1 text-black text-sm">
              <p className="font-semibold text-lg mb-2">
                {debitNoteData.vendor?.vendor_name || debitNoteData.vendor?.name || debitNoteData.party_name || 'N/A'}
              </p>
              <div className="space-y-1">
                {debitNoteData.vendor?.company_name && (
                  <p className="text-gray-600">
                    {debitNoteData.vendor.company_name}
                  </p>
                )}
                {debitNoteData.vendor?.email && (
                  <p className="text-black">
                    <span className="font-semibold">Email:</span>{" "}
                    {debitNoteData.vendor.email}
                  </p>
                )}
                {debitNoteData.vendor?.mobile && (
                  <p className="text-black">
                    <span className="font-semibold">Mobile:</span>{" "}
                    {debitNoteData.vendor.mobile}
                  </p>
                )}
                {debitNoteData.vendor?.gst && (
                  <p className="text-black">
                    <span className="font-semibold">GSTIN:</span>{" "}
                    {debitNoteData.vendor.gst}
                  </p>
                )}
                {debitNoteData.vendor?.address1 && (
                  <p className="text-black">
                    <span className="font-semibold">Address:</span>{" "}
                    {debitNoteData.vendor.address1}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <table className="w-full border border-black mb-8 text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-black">
              <th className="p-2 text-left font-bold border-r border-black uppercase text-[10px] w-[40%]">
                Item Description
              </th>
              <th className="p-2 text-center font-bold border-r border-black uppercase text-[10px] w-[10%]">
                Qty
              </th>
              <th className="p-2 text-right font-bold border-r border-black uppercase text-[10px] w-[12%]">
                Price
              </th>
              <th className="p-2 text-right font-bold border-r border-black uppercase text-[10px] w-[12%]">
                Disc.
              </th>
              <th className="p-2 text-right font-bold border-r border-black uppercase text-[10px] w-[12%]">
                Tax
              </th>
              <th className="p-2 text-right font-bold uppercase text-[10px] w-[14%]">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {debitNoteData.items?.map((item: any, idx: number) => {
              return (
                <tr key={idx}>
                  <td className="p-2 border-r border-black align-top">
                    <div className="flex items-start gap-1">
                      <span className="font-medium text-sm text-black min-w-[20px]">{idx + 1}.</span>
                      <div className="flex-1">
                        <p className="font-semibold text-black leading-snug">{item.item_name || item.product_name}</p>
                        {item.description && <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>}
                        {item.hsn_sac && <p className="text-[9px] text-gray-400 mt-1">HSN/SAC: {item.hsn_sac}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-center border-r border-black align-top whitespace-nowrap">
                    <span className="text-red-600 font-medium">{item.quantity}</span> <span className="text-[10px] ml-0.5">{getMeasuringUnit(item.measuring_unit_id)}</span>
                  </td>
                  <td className="p-2 text-right border-r border-black align-top whitespace-nowrap">{formatCurrency(item.unit_price || item.price_per_item)}</td>
                  <td className="p-2 text-right border-r border-black align-top whitespace-nowrap">
                    {item.discount && item.discount.discount_percentage > 0
                      ? `${item.discount.discount_percentage}% (${formatCurrency(item.discount.discount_amount)})`
                      : typeof item.discount === 'number' && item.discount > 0
                        ? `${item.discount}%`
                        : "-"}
                  </td>
                  <td className="p-2 text-right border-r border-black align-top whitespace-nowrap">
                    {item.tax && item.tax.tax_percentage > 0
                      ? `${item.tax.tax_percentage}% (${formatCurrency(item.tax.tax_amount)})`
                      : typeof item.tax === 'number' && item.tax > 0
                        ? `${item.tax}%`
                        : "-"}
                  </td>
                  <td className="p-2 text-right font-medium align-top whitespace-nowrap text-red-600">{formatCurrency(item.total_price || item.amount)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-black bg-gray-50 font-bold">
              <td colSpan={5} className="p-2 text-right text-[10px] uppercase tracking-widest text-black border-r border-black">Subtotal</td>
              <td className="p-2 text-right text-sm text-black whitespace-nowrap">{formatCurrency(debitNoteData.charges?.subtotal || debitNoteData.subtotal || 0)}</td>
            </tr>
            {(debitNoteData.charges?.total_discount || debitNoteData.discount_total || debitNoteData.total_discount || 0) > 0 && (
              <tr className="bg-gray-50 font-bold">
                <td colSpan={5} className="p-2 text-right text-[10px] uppercase tracking-widest text-black border-r border-black">Discount</td>
                <td className="p-2 text-right text-sm text-black whitespace-nowrap">-{formatCurrency(debitNoteData.charges?.total_discount || debitNoteData.discount_total || debitNoteData.total_discount || 0)}</td>
              </tr>
            )}
            {(debitNoteData.charges?.total_tax || debitNoteData.tax_total || debitNoteData.total_tax || 0) > 0 && (
              <tr className="bg-gray-50 font-bold">
                <td colSpan={5} className="p-2 text-right text-[10px] uppercase tracking-widest text-black border-r border-black">Tax</td>
                <td className="p-2 text-right text-sm text-black whitespace-nowrap">{formatCurrency(debitNoteData.charges?.total_tax || debitNoteData.tax_total || debitNoteData.total_tax || 0)}</td>
              </tr>
            )}
            <tr className="border-t border-black bg-gray-100 font-bold">
              <td colSpan={5} className="p-2 text-right text-[12px] uppercase tracking-widest text-black border-r border-black">Total Amount</td>
              <td className="p-2 text-right text-sm font-bold text-black whitespace-nowrap text-red-600">{formatCurrency(debitNoteData.total_amount || 0)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="flex justify-between items-start gap-12">
          <div className="flex-1">
            {debitNoteData.notes && (
              <div className="mb-4">
                <h4 className="text-[10px] font-bold uppercase border-b border-black w-20 mb-1">Return Reason</h4>
                <p className="text-[10px] text-gray-700 leading-relaxed italic">{debitNoteData.notes}</p>
              </div>
            )}
            {debitNoteData.terms && (
              <div className="mb-4">
                <h4 className="text-[10px] font-bold uppercase border-b border-black w-32 mb-1">Terms & Conditions</h4>
                <p className="text-[10px] text-gray-700 leading-relaxed">{debitNoteData.terms}</p>
              </div>
            )}
            {debitNoteData.terms_and_conditions && (
              <div className="mb-4">
                <h4 className="text-[10px] font-bold uppercase border-b border-black w-32 mb-1">Terms & Conditions</h4>
                <p className="text-[10px] text-gray-700 leading-relaxed">{debitNoteData.terms_and_conditions}</p>
              </div>
            )}
          </div>

          <div className="w-80 space-y-0 text-black">
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-normal uppercase">Taxable Amount</span>
              <span className="text-sm font-bold">{formatCurrency(debitNoteData.charges?.taxable_amount || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-xs font-normal uppercase">CGST</span>
              <span className="text-sm font-bold">{formatCurrency(debitNoteData.charges?.cgst_amount || (debitNoteData.charges?.total_tax || 0) / 2)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-black">
              <span className="text-xs font-normal uppercase">SGST</span>
              <span className="text-sm font-bold">{formatCurrency(debitNoteData.charges?.sgst_amount || (debitNoteData.charges?.total_tax || 0) / 2)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b-2 border-black">
              <span className="text-sm font-bold text-red-600">TOTAL RETURN AMOUNT</span>
              <span className="text-xl font-bold text-red-600">{formatCurrency(debitNoteData.total_amount || 0)}</span>
            </div>

            <div className="pt-2 text-right">
              <p className="text-xs leading-tight">
                <span className="font-bold uppercase text-[12px]">In words:</span> {formatNumberInWords(debitNoteData.total_amount || 0)}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-dashed border-gray-300 space-y-2 no-print">
              <div className="flex justify-between text-xs text-green-700">
                <span className="font-medium uppercase">Amount Credited</span>
                <span className="font-bold">{formatCurrency(debitNoteData.amount_received || 0)}</span>
              </div>
              <div className="flex justify-between text-base text-red-700 font-bold">
                <span className="uppercase">Balance Due</span>
                <span>{formatCurrency(calculateBalanceDue())}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24 flex justify-end">
          <div className="text-center">
            <p className="text-[10px] font-bold text-black uppercase mb-1">
              For {businessInfo.name}
            </p>
            {brandingAssets?.esign_path && (
              <div className="mb-0 flex justify-center">
                <img
                  src={resolveImageUrl(`/static/uploads/business/${brandingAssets.esign_path}`)}
                  className="h-12 md:h-16 w-auto object-contain mix-blend-multiply"
                  alt="Signature"
                />
              </div>
            )}
            <div className={`w-48 border-b border-black mb-1 ${brandingAssets?.esign_path ? '-mt-2' : 'mt-8'}`}></div>
            <p className="text-[10px] font-bold text-black uppercase tracking-wider">Authorized Signatory</p>
          </div>
        </div>
      </div>

      {/* Payment History Dialog */}
      <Dialog open={showPaymentHistory} onOpenChange={setShowPaymentHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!Array.isArray(payments) || payments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No payments recorded</p>
            ) : (
              payments.map((payment: any, index: number) => (
                <div key={index} className="border rounded p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{formatCurrency(payment.payment_amount)}</p>
                      <p className="text-sm text-gray-500">{new Date(payment.payment_date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{payment.payment_method}</p>
                      {payment.payment_notes && <p className="text-xs text-gray-500">{payment.payment_notes}</p>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payment Amount</label>
              <Input
                type="number"
                value={newPayment.payment_amount}
                onChange={(e) => setNewPayment(prev => ({ ...prev, payment_amount: e.target.value }))}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Date</label>
              <Input
                type="date"
                value={newPayment.payment_date}
                onChange={(e) => setNewPayment(prev => ({ ...prev, payment_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method</label>
              <Input
                value={newPayment.payment_method}
                onChange={(e) => setNewPayment(prev => ({ ...prev, payment_method: e.target.value }))}
                placeholder="e.g., Cash, Bank Transfer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Payment Reference</label>
              <Input
                value={newPayment.payment_reference}
                onChange={(e) => setNewPayment(prev => ({ ...prev, payment_reference: e.target.value }))}
                placeholder="Reference number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <Textarea
                placeholder="Payment notes"
                value={newPayment.payment_notes}
                onChange={(e) => setNewPayment(prev => ({ ...prev, payment_notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddPaymentDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPayment}
              disabled={isAddingPayment || !newPayment.payment_amount || parseFloat(newPayment.payment_amount) <= 0}
            >
              {isAddingPayment ? (
                <>
                  <SpinnerDotted size={16} className="mr-2" />
                  Adding...
                </>
              ) : (
                'Add Payment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DebitNoteDetailsPage;
