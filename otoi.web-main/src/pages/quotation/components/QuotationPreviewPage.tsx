import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer, Share, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createQuotation, getQuotationById, updateQuotation } from "../services/quotation.services";
import { useAuthContext } from "@/auth/useAuthContext";
import { createInvoiceFromQuotation, getInvoiceByQuotationId } from "@/pages/invoice/services/invoice.services";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { SpinnerDotted } from "spinners-react";
// import { useAuthContext } from "@/auth";
import { toAbsoluteUrl } from "@/utils/Assets";

interface QuotationItem {
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
}

interface Customer {
  uuid: string;
  customer_id?: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  contact_person?: string;
  mobile: string;
  email?: string | null;
  gst?: string;
  pin?: string;
  billing_address?: any;
  shipping_address?: any;
  status?: string;
}

interface QuotationData {
  quotationNo: string;
  quotationDate: string;
  validFor: number;
  validityDate: string;
  status: string;
  selectedCustomer: Customer | null;
  quotationItems: QuotationItem[];
  notes?: string;
  terms?: string;
  business?: any;
}

const QuotationPreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { currentUser } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [showBusinessAddressBanner, setShowBusinessAddressBanner] = useState(true);
  const [fetchedData, setFetchedData] = useState<QuotationData | null>(null);
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string | null>(null);
  const quotationRef = useRef<HTMLDivElement>(null);

  const quotationData: QuotationData = fetchedData || location.state?.quotationData || {
    quotationNo: "", quotationDate: "", validFor: 0, validityDate: "", status: "", selectedCustomer: null, quotationItems: []
  };

  useEffect(() => {
    if (id && !location.state?.quotationData) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          console.log("=== Fetching quotation with ID:", id);
          const response = await getQuotationById(id);
          console.log("=== API Response:", response);
          if (response.success && response.data) {
            const data = response.data;

            // Fetch customer details separately to get address information
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

            const customerResponse = await fetch(`${import.meta.env.VITE_APP_API_URL}/customers/${data.customer_id}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });

            const customerDetails = await customerResponse.json();

            // Transform API data to QuotationData format
            const transformedData: QuotationData = {
              quotationNo: data.quotation_number,
              quotationDate: data.quotation_date,
              validFor: 0,
              validityDate: data.valid_till,
              status: data.status,
              selectedCustomer: {
                ...data.customer,
                ...customerDetails,
                billing_address: customerDetails.billing_address || data.customer?.billing_address,
                shipping_address: customerDetails.shipping_address || data.customer?.shipping_address,
              },
              quotationItems: data.items.map((item: any) => {
                // Handle nested discount object
                const discount = typeof item.discount?.discount_percentage === 'object'
                  ? item.discount.discount_percentage.discount_percentage
                  : item.discount?.discount_percentage || 0;

                // Handle nested tax object
                const tax = typeof item.tax?.tax_percentage === 'object'
                  ? item.tax.tax_percentage.tax_percentage
                  : item.tax?.tax_percentage || 0;

                return {
                  id: item.uuid,
                  item_id: item.item_id || item.uuid,
                  item_name: item.product_name || item.description || "Item",
                  description: item.description,
                  quantity: item.quantity || 0,
                  price_per_item: item.unit_price || 0,
                  discount: discount,
                  tax: tax,
                  amount: item.total_price || 0,
                  measuring_unit_id: item.measuring_unit_id || 1
                };
              }),
              notes: data.notes,
              terms: data.terms_and_conditions,
              business: data.business // Include business info from DB
            };
            console.log("=== Final transformed data with business:", transformedData);
            setFetchedData(transformedData);
          }
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    }

    // Check if a linked invoice already exists for this quotation
    if (id) {
      const checkLinkedInvoice = async () => {
        try {
          const invoiceRes = await getInvoiceByQuotationId(id);
          if (invoiceRes.success && invoiceRes.data?.uuid) {
            setLinkedInvoiceId(invoiceRes.data.uuid);
          }
        } catch {
          // ignore — no linked invoice
        }
      };
      checkLinkedInvoice();
    }
  }, [id, location.state]);

  const calculateTotals = () => {
    const items = quotationData.quotationItems || [];
    const subtotal = items.reduce((sum, item) => sum + (item.price_per_item * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.price_per_item * item.quantity * item.discount) / 100, 0);
    const totalTax = items.reduce((sum, item) => sum + ((item.price_per_item * item.quantity * (1 - item.discount / 100)) * item.tax) / 100, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    const taxableAmount = subtotal - totalDiscount;
    const effectiveTaxRate = taxableAmount > 0 ? (totalTax / taxableAmount) * 100 : 0;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      totalAmount,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      totalCGST: totalTax / 2,
      totalSGST: totalTax / 2,
      primaryTax: effectiveTaxRate
    };
  };

  const totals = calculateTotals();
  const locationState = location.state as { quotationData?: any; quotationId?: string };
  const isAlreadySaved = !!locationState?.quotationId || !!id;

  // const totals = calculateTotals();

  const handleSaveQuotation = async () => {
    if (isAlreadySaved) {
      navigate("/quotes/list");
      return;
    }
    setIsSaving(true);
    try {
      const submissionData = {
        ...quotationData,
        total_amount: totals.totalAmount,
        subtotal: totals.subtotal,
        total_discount: totals.totalDiscount,
        total_tax: totals.totalTax,
        created_at: new Date().toISOString(),
      };
      const response = await createQuotation(submissionData);
      if (response.success) {
        toast.success("Quotation saved successfully!");
        navigate("/quotes/list");
      } else {
        toast.error(response.error || "Failed to save quotation");
      }
    } catch (error) {
      toast.error("Failed to save quotation");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConvertToInvoice = async () => {
    const quotationId = id || location.state?.quotationId;
    if (!quotationId) {
      toast.error("Please save the quotation first before converting to invoice.");
      return;
    }
    // Navigate to CreateInvoicePage with quotation data
    navigate('/invoices/new-invoice', {
      state: {
        quotationId: quotationId,
        quotationData: quotationData,
        fromQuotation: true
      }
    });
  };

  const handleDownloadPDF = async () => {
    if (!quotationRef.current) return;
    const downloadToast = toast.loading("Generating PDF...");
    try {
      const element = quotationRef.current;

      // Scroll to top so element renders from the start
      window.scrollTo(0, 0);
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        removeContainer: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`Quotation-${quotationData.quotationNo || "Draft"}.pdf`);
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

  const handleShare = async () => {
    if (!quotationRef.current) return;
    const shareToast = toast.loading("Preparing for share...");
    try {
      const canvas = await html2canvas(quotationRef.current, { scale: 2 });
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to generate blob"));
      }, "image/png"));
      const file = new File([blob], `Quotation-${quotationData.quotationNo}.png`, { type: "image/png" });

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: `Quotation ${quotationData.quotationNo}`,
          text: `Check out our quotation: ${quotationData.quotationNo}`
        });
        toast.success("Shared successfully", { id: shareToast });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Quotation-${quotationData.quotationNo}.png`;
        a.click();
        toast.success("Image saved (Direct sharing not supported)", { id: shareToast });
      }
    } catch (error) {
      toast.error("Failed to share", { id: shareToast });
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹ ${amount.toFixed(2)}`;
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
    return result;
  };

  const getAuthBusinessInfo = () => {
    // 1. Try to get business info from the fetched quotation itself if it exists (Data from DB)
    const fetchedBusiness = fetchedData?.business || (fetchedData as any)?.business;
    if (fetchedBusiness) {
      return {
        name: fetchedBusiness.company_name || fetchedBusiness.name || fetchedBusiness.company || "Evoto Technologies",
        email: fetchedBusiness.email || currentUser?.email,
        phone: fetchedBusiness.phone_number || fetchedBusiness.phone || fetchedBusiness.mobile || currentUser?.phone,
        address: fetchedBusiness.address || fetchedBusiness.billing_address || null
      };
    }

    // 2. Try to get from localStorage directly
    try {
      const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
      if (authData) {
        const parsedAuth = JSON.parse(authData);
        const user = parsedAuth.user;
        const business = parsedAuth.business || parsedAuth.business_profile || (user?.businesses && user.businesses[0]);

        if (business) {
          return {
            name: business.company_name || business.name || business.company || "Evoto Technologies",
            email: business.email || currentUser?.email,
            address: business.address || null,
            phone: business.phone_number || business.phone || business.mobile || currentUser?.phone || "N/A",
          };
        }
      }
    } catch (e) { /* silent catch */ }

    // 3. Fallback to currentUser from context (User Profile)
    if (!currentUser) return null;

    // Check if currentUser has business info in businesses array
    const userBusiness = (currentUser as any).businesses?.[0];
    if (userBusiness) {
      return {
        name: userBusiness.name || userBusiness.company_name || "Evoto Technologies",
        email: currentUser.email,
        address: (currentUser as any).address || null,
        phone: userBusiness.phone_number || userBusiness.phone || userBusiness.mobile || (currentUser as any).phone || (currentUser as any).mobile
      };
    }

    // Final fallback to company fields on user object or hardcoded default
    return {
      name: (currentUser as any).company_name || currentUser.companyName || (currentUser as any).business_name || "Evoto Technologies",
      email: currentUser.email,
      address: (currentUser as any).address || null,
      phone: (currentUser as any).phone || (currentUser as any).mobile || "N/A",
    };
  };

  const formatAddressLines = (address: any, type: "billing" | "shipping") => {
    if (!address) return [];
    if (typeof address === "string") return [address];
    const elements: React.ReactNode[] = [];
    const line1 = address.address1 || address.address_line1 || address.line1 || address.street1;
    // const line2 = address.address2 || address.address_line2 || address.line2 || address.street2;

    const prefix = type === "billing" ? "Billing Address" : "Shipping Address";

    if (line1) elements.push(<>
      <span className="font-semibold">{prefix}:</span> {line1}
    </>);
    // if (line2) elements.push(<>
    //   <span className="font-semibold">Line 2:</span> {line2}
    // </>);

    const parts = [];
    if (address.city) parts.push(<span key="city"><span className="font-semibold">City:</span> {address.city}</span>);
    if (address.state) parts.push(<span key="state"><span className="font-semibold">State:</span> {address.state}</span>);
    if (address.country) parts.push(<span key="country"><span className="font-semibold">Country:</span> {address.country}</span>);
    const pin = address.pin || address.postal_code || address.zip;
    if (pin) parts.push(<span key="pin"><span className="font-semibold">PIN:</span> {pin}</span>);


    if (parts.length > 0) {
      const joinedParts = parts.reduce((acc: React.ReactNode[], curr, idx) => {
        if (idx === 0) return [curr];
        return [...acc, ", ", curr];
      }, []);
      elements.push(<>{joinedParts}</>);
    }
    return elements;
  };

  const getCustomerAddress = (customer: any, type: "billing" | "shipping") => {
    if (!customer) return null;
    let address =
      type === "shipping"
        ? customer.shipping_address || customer.shippingAddress || customer.shipping_addresses
        : customer.billing_address || customer.billingAddress;

    if (Array.isArray(address)) {
      address = address.find((addr) => addr?.is_default) || address[0];
    }

    // Fallback if no specific address object exists
    if (!address) {
      const prefix = type === "shipping" ? "shipping_" : "";
      const addressData = {
        address1: customer[`${prefix}address1`] || customer[`${prefix}address_line1`] || customer.address1 || customer.address_line1,
        address2: customer[`${prefix}address2`] || customer[`${prefix}address_line2`] || customer.address2 || customer.address_line2,
        city: customer[`${prefix}city`] || customer.city,
        state: customer[`${prefix}state`] || customer.state,
        country: customer[`${prefix}country`] || customer.country,
        pin: customer[`${prefix}pin`] || customer.pin,
      };

      // Check if we actually found any address data
      if (Object.values(addressData).some(val => !!val)) {
        address = addressData;
      }
    }

    return address;
  };

  const getMeasuringUnit = (unitId?: number) => {
    const units: { [key: number]: string } = { 1: "PCS", 2: "KG", 3: "LTR", 4: "MTR" };
    return units[unitId || 1] || "PCS";
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      {isLoading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-[4px]">
          <div className="flex flex-col items-center gap-4">
            <SpinnerDotted size={50} thickness={100} speed={100} color="#1B84FF" />
            <p className="text-sm font-semibold text-gray-700 tracking-wide uppercase">Fetching Quotation Details...</p>
          </div>
        </div>
      )}
      <style>
        {`
          @media print {
            /* Hide all layout elements */
            .sidebar, .header, .footer, .topbar, .no-print, [data-kt-app-sidebar-enabled="true"] .app-sidebar, [data-kt-app-header-enabled="true"] .app-header {
              display: none !important;
            }
            
            /* Reset body background and margins */
            body {
              background-color: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Container adjustments */
            .min-h-screen {
              min-height: auto !important;
              background: none !important;
              padding: 0 !important;
            }

            /* Main content width and positioning */
            #quotation-print-area {
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              max-width: 100% !important;
              width: 100% !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }

            /* Ensure text colors are black */
            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
      </style>
      <div className="bg-white px-6 py-4 border-t border-b border-gray-200 sticky top-0 z-10 no-print">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/quotes/list")}><ArrowLeft className="h-4 w-4" /></Button>
            <div>
              <h1 className="text-xl font-semibold text-black">Quotation #{quotationData.quotationNo || "1"}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-2"><Download className="h-4 w-4" />Download PDF</Button>
            <Button variant="outline" size="sm" onClick={handlePrintPDF} className="gap-2"><Printer className="h-4 w-4" />Print PDF</Button>
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2"><Share className="h-4 w-4" />Share</Button>

            {/* Show Convert to Invoice - temporarily always visible for debugging */}
            {(!linkedInvoiceId || quotationData.status === 'open') && (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                onClick={handleConvertToInvoice}
                disabled={isConverting}
              >
                <Receipt className="h-4 w-4" />
                {isConverting ? "Converting..." : "Convert to Invoice"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Quotation Print Area ── */}
      <div
        id="quotation-print-area"
        ref={quotationRef}
        style={{ width: '794px', boxSizing: 'border-box' }}
        className="mx-auto mt-8 bg-white font-sans"
      >
        {/* ── Company Header ── */}
        <div className="flex justify-between items-start px-12 pt-10 pb-6">
          {(() => {
            const businessInfo = getAuthBusinessInfo();
            return (
              <div>
                <p className="text-xl font-bold text-black">{businessInfo?.name || 'Evoto Technologies'}</p>
                {businessInfo?.email && <p className="text-[11px] text-gray-500 mt-0.5">{businessInfo.email}</p>}
                {businessInfo?.phone && <p className="text-[11px] text-gray-500 mt-0.5">{businessInfo.phone}</p>}
                {businessInfo?.address && <p className="text-[11px] text-gray-500 mt-0.5">{businessInfo.address}</p>}
              </div>
            );
          })()}
          <img
            src={toAbsoluteUrl('/media/app/Evoto-Logo.png')}
            className="h-16 w-auto object-contain"
            alt="Logo"
          />
        </div>

        <div className="px-12 pb-12">

          {/* ── Quotation Meta: No / Date / Expiry ── */}
          <div className="grid grid-cols-3 border border-black mb-7">
            <div className="px-3 py-1 border-r border-b border-black bg-gray-100">
              <span className="text-[9px] font-bold uppercase tracking-widest text-black">Quotation No.</span>
            </div>
            <div className="px-3 py-1 border-r border-b border-black bg-gray-100 text-center">
              <span className="text-[9px] font-bold uppercase tracking-widest text-black">Quotation Date</span>
            </div>
            <div className="px-3 py-1 border-b border-black bg-gray-100 text-right">
              <span className="text-[9px] font-bold uppercase tracking-widest text-black">Expiry Date</span>
            </div>
            <div className="px-3 py-2 border-r border-black">
              <span className="text-[13px] text-black">{quotationData.quotationNo}</span>
            </div>
            <div className="px-3 py-2 border-r border-black text-center">
              <span className="text-[13px] text-black">{new Date(quotationData.quotationDate).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="px-3 py-2 text-right">
              <span className="text-[13px] text-black">{new Date(quotationData.validityDate).toLocaleDateString('en-IN')}</span>
            </div>
          </div>

          {/* ── Bill To / Ship To ── */}
          <div className="grid grid-cols-2 gap-6 mb-7">
            {/* Bill To */}
            <div>
              <p className="text-[11px] font-bold uppercase text-black mb-0.5">BILL TO</p>
              <div className="w-12 border-b border-black mb-2"></div>
              <p className="text-sm font-bold text-black mb-1">
                {quotationData.selectedCustomer
                  ? `${quotationData.selectedCustomer.first_name} ${quotationData.selectedCustomer.last_name}`
                  : 'N/A'}
              </p>
              {quotationData.selectedCustomer?.company_name && <p className="text-[11px] text-gray-500 mb-0.5">{quotationData.selectedCustomer.company_name}</p>}
              {quotationData.selectedCustomer?.email && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">Email:</span> {quotationData.selectedCustomer.email}</p>}
              {quotationData.selectedCustomer?.mobile && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">Mobile:</span> {quotationData.selectedCustomer.mobile}</p>}
              {quotationData.selectedCustomer?.gst && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">GST:</span> {quotationData.selectedCustomer.gst}</p>}
              {quotationData.selectedCustomer && formatAddressLines(getCustomerAddress(quotationData.selectedCustomer, 'billing'), 'billing').map((el, i) => (
                <p key={i} className="text-[11px] text-black mb-0.5">{el}</p>
              ))}
            </div>
            {/* Ship To */}
            <div className="border-l border-gray-200 pl-6">
              <p className="text-[11px] font-bold uppercase text-black mb-0.5">SHIP TO</p>
              <div className="w-12 border-b border-black mb-2"></div>
              <p className="text-sm font-bold text-black mb-1">
                {quotationData.selectedCustomer
                  ? `${quotationData.selectedCustomer.first_name} ${quotationData.selectedCustomer.last_name}`
                  : 'N/A'}
              </p>
              {quotationData.selectedCustomer?.company_name && <p className="text-[11px] text-gray-500 mb-0.5">{quotationData.selectedCustomer.company_name}</p>}
              {quotationData.selectedCustomer?.email && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">Email:</span> {quotationData.selectedCustomer.email}</p>}
              {quotationData.selectedCustomer?.mobile && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">Mobile:</span> {quotationData.selectedCustomer.mobile}</p>}
              {quotationData.selectedCustomer?.gst && <p className="text-[11px] text-black mb-0.5"><span className="font-semibold">GST:</span> {quotationData.selectedCustomer.gst}</p>}
              {quotationData.selectedCustomer && formatAddressLines(getCustomerAddress(quotationData.selectedCustomer, 'shipping'), 'shipping').map((el, i) => (
                <p key={i} className="text-[11px] text-black mb-0.5">{el}</p>
              ))}
            </div>
          </div>

          {/* ── Items Table ── */}
          <table className="w-full border-collapse border border-black mb-8">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-black">
                <th className="px-2.5 py-1.5 text-left text-[9px] font-bold uppercase tracking-wider text-black border-r border-black w-[38%]">Item Description</th>
                <th className="px-2.5 py-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-black border-r border-black">Qty</th>
                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-black border-r border-black whitespace-nowrap">Price / Item</th>
                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-black border-r border-black">Disc.</th>
                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-black border-r border-black">Tax</th>
                <th className="px-2.5 py-1.5 text-right text-[9px] font-bold uppercase tracking-wider text-black">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotationData.quotationItems?.map((item, index) => (
                <tr key={item.id} className="border-b border-gray-300">
                  <td className="px-2.5 py-2 text-xs text-black border-r border-gray-300 align-top">
                    <div className="flex items-start gap-1">
                      <span className="font-medium text-xs text-black min-w-[18px]">{index + 1}.</span>
                      <div>
                        <p className="font-medium text-xs text-black leading-snug">{item.item_name}</p>
                        {item.description && <p className="text-[10px] text-gray-500 mt-0.5">{item.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-2.5 py-2 text-center text-xs text-black border-r border-gray-300 align-top whitespace-nowrap">
                    {item.quantity} <span className="text-[9px]">{getMeasuringUnit(item.measuring_unit_id)}</span>
                  </td>
                  <td className="px-2.5 py-2 text-right text-xs text-black border-r border-gray-300 align-top whitespace-nowrap">{formatCurrency(item.price_per_item)}</td>
                  <td className="px-2.5 py-2 text-right text-xs text-black border-r border-gray-300 align-top whitespace-nowrap">
                    <p className="m-0">-{formatCurrency((item.price_per_item * item.quantity * item.discount) / 100)}</p>
                    {item.discount > 0 && <p className="text-[9px] m-0">({item.discount}%)</p>}
                  </td>
                  <td className="px-2.5 py-2 text-right text-xs text-black border-r border-gray-300 align-top whitespace-nowrap">
                    <p className="m-0">{formatCurrency((item.price_per_item * item.quantity * (1 - item.discount / 100) * item.tax) / 100)}</p>
                    {item.tax > 0 && <p className="text-[9px] m-0">({item.tax}%)</p>}
                  </td>
                  <td className="px-2.5 py-2 text-right text-xs text-black align-top whitespace-nowrap">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black bg-gray-50 font-bold">
                <td colSpan={2} className="px-2.5 py-2 text-right text-[9px] uppercase tracking-widest text-black border-r border-black">Subtotal</td>
                <td className="px-2.5 py-2 text-right text-xs font-bold text-black border-r border-black whitespace-nowrap">{formatCurrency(totals.subtotal)}</td>
                <td className="px-2.5 py-2 text-right text-xs font-bold text-black border-r border-black whitespace-nowrap">-{formatCurrency(totals.totalDiscount)}</td>
                <td className="px-2.5 py-2 text-right text-xs font-bold text-black border-r border-black whitespace-nowrap">{formatCurrency(totals.totalTax)}</td>
                <td className="px-2.5 py-2 text-right text-xs font-bold text-black whitespace-nowrap">{formatCurrency(totals.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>

          {/* ── Bottom: Notes/Terms + Totals ── */}
          <div className="grid grid-cols-2 gap-8">

            {/* LEFT – Notes & Terms */}
            <div className="space-y-4">
              {quotationData.notes && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-black mb-0.5">NOTES</p>
                  <div className="w-10 border-b border-black mb-1.5"></div>
                  <p className="text-[11px] text-black leading-relaxed whitespace-pre-wrap">{quotationData.notes}</p>
                </div>
              )}
              {quotationData.terms && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-black mb-0.5">TERMS &amp; CONDITIONS</p>
                  <div className="w-32 border-b border-black mb-1.5"></div>
                  <div className="text-[10px] text-black space-y-0.5 leading-relaxed">
                    {quotationData.terms.split('\n').filter(t => t.trim()).map((term, i) => (
                      <p key={i}>• {term}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT – Tax Summary + Grand Total + Signatory */}
            <div>
              <div className="space-y-0">
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-[10px] uppercase text-black">Taxable Amount</span>
                  <span className="text-xs font-bold text-black">{formatCurrency(totals.subtotal - totals.totalDiscount)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-[10px] uppercase text-black">CGST ({Math.round((totals.primaryTax / 2) * 100) / 100}%)</span>
                  <span className="text-xs font-bold text-black">{formatCurrency(totals.totalCGST)}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-black">
                  <span className="text-[10px] uppercase text-black">
                    {currentUser?.isUT ? 'UTGST' : 'SGST'} ({Math.round((totals.primaryTax / 2) * 100) / 100}%)
                  </span>
                  <span className="text-xs font-bold text-black">{formatCurrency(totals.totalTax / 2)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b-2 border-black">
                  <span className="text-sm font-bold uppercase tracking-wider text-black">Grand Total</span>
                  <span className="text-xl font-bold text-black">{formatCurrency(totals.totalAmount)}</span>
                </div>
                <div className="pt-1.5 text-right">
                  <p className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Amount in Words</p>
                  <p className="text-[11px] font-bold text-black leading-snug">{formatNumberInWords(totals.totalAmount)}</p>
                </div>
              </div>

              {/* Authorized Signatory */}
              <div className="mt-16 flex justify-end">
                <div className="text-center">
                  <div className="w-36 border-b border-black mb-1.5"></div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-black">Authorized Signatory</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
export default QuotationPreviewPage;
