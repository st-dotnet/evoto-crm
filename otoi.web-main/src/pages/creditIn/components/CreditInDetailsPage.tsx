import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Printer,
  Share,
  Edit,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getCreditNoteById } from '../service/creditIn.service';
import { getCustomerById } from "@/pages/parties/services/customer.service";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { SpinnerDotted } from "spinners-react";
import { useAuthContext } from "@/auth";
import { toAbsoluteUrl } from "@/utils/Assets";

interface CreditNoteItem {
  uuid: string;
  item_id: string;
  item_name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  discount_amount?: number;
  tax_percentage?: number;
  tax_amount?: number;
  total_price: number;
  measuring_unit_id?: number;
  hsn_sac?: string;
  discount?: { 
    discount_amount: number;
    discount_percentage: number;
  };
  tax?: { 
    tax_amount: number;
    tax_percentage: number;
  };
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
}

interface CreditNoteData {
  uuid: string;
  credit_note_number: string;
  credit_note_date: string;
  status: string;
  customer: Customer;
  items: CreditNoteItem[];
  subtotal: number;
  tax_total: number;
  discount_total: number;
  additional_charges_total: number;
  round_off: number;
  total_amount: number;
  notes?: string;
  terms_and_conditions?: string;
  linked_invoice_id?: string;
  invoice_number?: string;
  business?: any;
  selectedCustomer?: any;
  creditNoteNo?: string;
  creditNoteDate?: string;
  creditNoteItems?: CreditNoteItem[];
  total_tax?: number;
  total_discount?: number;
  additional_charges?: number;
  round_off_amount?: number;
  terms?: string;
  linkToInvoiceId?: string;
  linkToInvoice?: string;
}

const CreditInDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentUser } = useAuthContext();
  const [creditNoteData, setCreditNoteData] = useState<CreditNoteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const creditNoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      fetchCreditNoteData();
    }
  }, [id]);

  const fetchCreditNoteData = async () => {
    setIsLoading(true);
    try {
      const response = await getCreditNoteById(id!);
      if (response.success && response.data) {
        
        // Handle nested data structure - check for different possible structures
        let creditNoteData = response.data;
        
        // If still nested, try to extract the actual credit note data
        if (creditNoteData.data) {
          creditNoteData = creditNoteData.data;
        } else if (creditNoteData.credit_notes) {
          creditNoteData = creditNoteData.credit_notes;
        }
        
        // Set initial credit note data
        const mappedData = {
          uuid: creditNoteData.uuid || creditNoteData.id,
          credit_note_number: creditNoteData.credit_note_number || creditNoteData.creditNoteNo,
          credit_note_date: creditNoteData.credit_note_date || creditNoteData.creditNoteDate,
          status: creditNoteData.status,
          customer: creditNoteData.selectedCustomer || creditNoteData.customer,
          items: creditNoteData.creditNoteItems || creditNoteData.items || [],
          subtotal: creditNoteData.subtotal || creditNoteData.charges?.taxable_amount || 0,
          tax_total: creditNoteData.total_tax || creditNoteData.tax_total || creditNoteData.charges?.total_tax || 0,
          discount_total: creditNoteData.total_discount || creditNoteData.discount_total || creditNoteData.charges?.total_discount || 0,
          additional_charges_total: creditNoteData.additional_charges || creditNoteData.additional_charges_total || 0,
          round_off: creditNoteData.round_off_amount || creditNoteData.round_off || creditNoteData.charges?.round_off_amount || 0,
          total_amount: creditNoteData.total_amount || 0,
          notes: creditNoteData.additional_notes?.notes || creditNoteData.notes || creditNoteData.terms,
          terms_and_conditions: creditNoteData.additional_notes?.terms_and_conditions || creditNoteData.terms_and_conditions || creditNoteData.terms,
          linked_invoice_id: creditNoteData.linkToInvoiceId || creditNoteData.linked_invoice_id || creditNoteData.invoice_id,
          invoice_number: creditNoteData.linkToInvoice || creditNoteData.invoice_number,
          business: creditNoteData.business,
        };
        
        setCreditNoteData(mappedData as CreditNoteData);

        // Fetch customer details separately to get address information
        if (creditNoteData.customer_id || creditNoteData.customer?.uuid) {
          const custId = creditNoteData.customer_id || creditNoteData.customer?.uuid;
          try {
            const customerRes = await getCustomerById(custId);
            if (customerRes.success && customerRes.data) {
              setCreditNoteData(prev => prev ? ({
                ...prev,
                customer: {
                  ...prev.customer,
                  ...customerRes.data,
                  billing_address: customerRes.data.billing_address || prev.customer?.billing_address,
                  shipping_address: customerRes.data.shipping_address || prev.customer?.shipping_address,
                }
              }) : null);
            }
          } catch (custError) {
            console.error("Error fetching customer details for credit note:", custError);
          }
        }
      } else {
        toast.error(response.error || "Failed to load credit note");
        navigate("/sales/credit-note");
      }
    } catch (error) {
      console.error("Error fetching credit note:", error);
      toast.error("Failed to load credit note");
      navigate("/sales/credit-note");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!creditNoteRef.current) return;
    const downloadToast = toast.loading("Generating PDF...");
    try {
      const element = creditNoteRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
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

      pdf.save(`Credit-Note-${creditNoteData?.credit_note_number || "Draft"}.pdf`);
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
    if (!creditNoteRef.current) return;
    const shareToast = toast.loading("Preparing for share...");
    try {
      const canvas = await html2canvas(creditNoteRef.current, { scale: 2 });
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to generate blob"));
        }, "image/png"),
      );
      const file = new File(
        [blob],
        `Credit-Note-${creditNoteData?.credit_note_number}.png`,
        { type: "image/png" },
      );

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: `Credit Note ${creditNoteData?.credit_note_number}`,
          text: `Check out our credit note: ${creditNoteData?.credit_note_number}`,
        });
        toast.success("Shared successfully", { id: shareToast });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Credit-Note-${creditNoteData?.credit_note_number}.png`;
        a.click();
        toast.success("Image saved (Direct sharing not supported)", {
          id: shareToast,
        });
      }
    } catch (error) {
      toast.error("Failed to share", { id: shareToast });
    }
  };

  const handleEdit = () => {
    navigate(`/sales/credit-note/${id}/edit`);
  };

  const formatCurrency = (amount: number) => {
    if (typeof amount !== 'number' || amount === null || amount === undefined) {
      return '₹0.00';
    }
    return `₹${amount.toFixed(2)}`;
  };

  const formatNumberInWords = (num: number) => {
    if (!Number.isFinite(num)) return "Zero Rupees";
    const units = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
    ];
    const teens = [
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const tens = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];

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
      if (crore) {
        parts.push(`${threeDigits(crore)} Crore`);
        remainder %= 10000000;
      }
      const lakh = Math.floor(remainder / 100000);
      if (lakh) {
        parts.push(`${threeDigits(lakh)} Lakh`);
        remainder %= 100000;
      }
      const thousand = Math.floor(remainder / 1000);
      if (thousand) {
        parts.push(`${threeDigits(thousand)} Thousand`);
        remainder %= 1000;
      }
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
    const fetchedBusiness = creditNoteData?.business;
    if (fetchedBusiness) {
      return {
        name:
          fetchedBusiness.company_name ||
          fetchedBusiness.name ||
          fetchedBusiness.company ||
          "Evoto Technologies",
        email: fetchedBusiness.email || currentUser?.email,
        phone:
          fetchedBusiness.phone_number ||
          fetchedBusiness.phone ||
          fetchedBusiness.mobile ||
          currentUser?.phone,
        address:
          fetchedBusiness.address || fetchedBusiness.billing_address || null,
      };
    }

    try {
      const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
      if (authData) {
        const parsedAuth = JSON.parse(authData);
        const business =
          parsedAuth.business ||
          parsedAuth.business_profile ||
          (parsedAuth.user?.businesses && parsedAuth.user.businesses[0]);
        if (business) {
          return {
            name:
              business.company_name ||
              business.name ||
              business.company ||
              "Evoto Technologies",
            email: business.email || currentUser?.email,
            address: business.address || null,
            phone:
              business.phone_number ||
              business.phone ||
              business.mobile ||
              currentUser?.phone ||
              "",
          };
        }
      }
    } catch (e) {
      /* silent catch */
    }

    if (currentUser) {
      const userBusiness = (currentUser as any).businesses?.[0];
      if (userBusiness) {
        return {
          name:
            userBusiness.name ||
            userBusiness.company_name ||
            "Evoto Technologies",
          email: currentUser.email,
          address: (currentUser as any).address || null,
          phone:
            userBusiness.phone_number ||
            userBusiness.phone ||
            userBusiness.mobile ||
            (currentUser as any).phone ||
            (currentUser as any).mobile,
        };
      }
    }

    return {
      name: "Evoto Technologies",
      email: currentUser?.email || "",
      address: null,
      phone: currentUser?.phone || "",
    };
  };

  const getCustomerAddress = (customer: any, type: "billing" | "shipping") => {
    if (!customer) return null;
    let address =
      type === "shipping"
        ? customer.shipping_address ||
          customer.shippingAddress ||
          customer.shipping_addresses
        : customer.billing_address || customer.billingAddress;

    if (Array.isArray(address)) {
      address = address.find((addr: any) => addr?.is_default) || address[0];
    }

    // If no nested address object, use direct address fields from customer
    if (!address || (typeof address !== "object")) {
      const prefix = type === "shipping" ? "shipping_" : "";
      address = {
        address1:
          customer[`${prefix}address1`] ||
          customer[`${prefix}address_line1`] ||
          customer.address1 ||
          customer.address_line1,
        address2:
          customer[`${prefix}address2`] ||
          customer[`${prefix}address_line2`] ||
          customer.address2 ||
          customer.address_line2,
        city: customer[`${prefix}city`] || customer.city,
        state: customer[`${prefix}state`] || customer.state,
        pin: customer[`${prefix}pin`] || customer.pin,
        country: customer[`${prefix}country`] || customer.country,
      };
    }

    return address;
  };

  const formatAddressLines = (address: any, type: "billing" | "shipping") => {
    if (!address) return [];
    if (typeof address === "string") return [address];
    const elements: React.ReactNode[] = [];
    const line1 =
      address.address1 ||
      address.address_line1 ||
      address.line1 ||
      address.street1;
    const line2 =
      address.address2 ||
      address.address_line2 ||
      address.line2 ||
      address.street2;

    const prefix = type === "billing" ? "Billing Address" : "Shipping Address";

    if (line1)
      elements.push(
        <>
          <span className="font-semibold">{prefix}:</span> {line1}
        </>,
      );
    if (line2)
      elements.push(
        <>
          <span className="font-semibold">Line 2:</span> {line2}
        </>,
      );

    const parts = [];
    if (address.city)
      parts.push(
        <span key="city">
          <span className="font-semibold">City:</span> {address.city}
        </span>,
      );
    if (address.state)
      parts.push(
        <span key="state">
          <span className="font-semibold">State:</span> {address.state}
        </span>,
      );
    if (address.pin)
      parts.push(
        <span key="pin">
          <span className="font-semibold">Pin:</span> {address.pin}
        </span>,
      );
    if (address.country)
      parts.push(
        <span key="country">
          <span className="font-semibold">Country:</span> {address.country}
        </span>,
      );

    if (parts.length > 0) {
      const joinedParts = parts.reduce((acc: React.ReactNode[], curr, idx) => {
        if (idx === 0) return [curr];
        return [...acc, ", ", curr];
      }, []);
      elements.push(<>{joinedParts}</>);
    }
    return elements;
  };

  const getMeasuringUnit = (unitId?: number) => {
    const units: { [key: number]: string } = {
      1: "PCS",
      2: "KG",
      3: "LTR",
      4: "MTR",
    };
    return units[unitId || 1] || "PCS";
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      draft: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
      refunded: "bg-blue-100 text-blue-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-[4px]">
        <div className="flex flex-col items-center gap-4">
          <SpinnerDotted
            size={50}
            thickness={100}
            speed={100}
            color="#1B84FF"
          />
          <p className="text-sm font-semibold text-gray-700 tracking-wide uppercase">
            Fetching Credit Note Details...
          </p>
        </div>
      </div>
    );
  }

  if (!creditNoteData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Credit note not found</p>
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
            body {
              background-color: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .min-h-screen {
              min-height: auto !important;
              background: none !important;
              padding: 0 !important;
            }
            #credit-note-print-area {
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              max-width: 100% !important;
              width: 100% !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }
            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
      </style>
      {/* Sticky Header Actions */}
      <div className="bg-white px-6 py-4 border-t border-b border-gray-200 sticky top-0 z-10 no-print">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/sales/credit-note")}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-black">
                Credit Note #{creditNoteData.credit_note_number}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded capitalize ${getStatusBadge(creditNoteData.status)}`}
                >
                  {creditNoteData.status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintPDF}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="gap-2"
            >
              <Share className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Main Credit Note Preview Area */}
      <div
        id="credit-note-print-area"
        ref={creditNoteRef}
        className="max-w-4xl mx-auto p-12 bg-white mt-8 shadow-sm"
      >
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
              Credit Note No.
            </p>
          </div>
          <div className="px-4 py-1 border-x border-b border-black text-center bg-gray-100">
            <p className="text-[11px] font-semibold text-black uppercase">
              Credit Note Date
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
              {creditNoteData.credit_note_number}
            </p>
          </div>
          <div className="px-4 py-1 border-x border-black text-center">
            <p className="text-[14px] font-normal text-black">
              {new Date(creditNoteData.credit_note_date).toLocaleDateString("en-IN")}
            </p>
          </div>
          <div className="px-4 py-1 text-right">
            <p className="text-[14px] font-normal text-black">
              {creditNoteData.invoice_number || "N/A"}
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
                {creditNoteData.customer
                  ? `${creditNoteData.customer.first_name || ""} ${creditNoteData.customer.last_name || ""}`.trim()
                  : "Customer Details Not Available"}
              </p>
              <div className="space-y-1">
                {creditNoteData.customer?.company_name && (
                  <p className="text-gray-600">
                    {creditNoteData.customer.company_name}
                  </p>
                )}
                {creditNoteData.customer?.email && (
                  <p className="text-black">
                    <span className="font-semibold">Email:</span>{" "}
                    {creditNoteData.customer.email}
                  </p>
                )}
                {creditNoteData.customer?.mobile && (
                  <p className="text-black">
                    <span className="font-semibold">Mobile:</span>{" "}
                    {creditNoteData.customer.mobile}
                  </p>
                )}
                {creditNoteData.customer &&
                  formatAddressLines(
                    getCustomerAddress(creditNoteData.customer, "billing"),
                    "billing",
                  ).map((element, i) => (
                    <p key={i} className="text-black">
                      {element}
                    </p>
                  ))}
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-black uppercase mb-3 pb-1 border-b border-black w-56">
              SHIP TO
            </h3>
            <div className="text-black text-sm">
              <p className="font-semibold text-lg mb-2">
                {creditNoteData.customer
                  ? `${creditNoteData.customer.first_name || ""} ${creditNoteData.customer.last_name || ""}`.trim()
                  : "Customer Details Not Available"}
              </p>
              <div className="space-y-1">
                {creditNoteData.customer?.company_name && (
                  <p className="text-gray-600">
                    {creditNoteData.customer.company_name}
                  </p>
                )}
                {creditNoteData.customer?.email && (
                  <p className="text-black">
                    <span className="font-semibold">Email:</span>{" "}
                    {creditNoteData.customer.email}
                  </p>
                )}
                {creditNoteData.customer?.mobile && (
                  <p className="text-black">
                    <span className="font-semibold">Mobile:</span>{" "}
                    {creditNoteData.customer.mobile}
                  </p>
                )}
                {creditNoteData.customer &&
                  formatAddressLines(
                    getCustomerAddress(creditNoteData.customer, "shipping"),
                    "shipping",
                  ).map((element, i) => (
                    <p key={i} className="text-black">
                      {element}
                    </p>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full border-collapse border border-black">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-4 py-2 text-left text-[12px] font-semibold text-black uppercase">
                  #
                </th>
                <th className="border border-black px-4 py-2 text-left text-[12px] font-semibold text-black uppercase">
                  Item Description
                </th>
                <th className="border border-black px-4 py-2 text-center text-[12px] font-semibold text-black uppercase">
                  Image
                </th>
                <th className="border border-black px-4 py-2 text-center text-[12px] font-semibold text-black uppercase">
                  Qty
                </th>
                <th className="border border-black px-4 py-2 text-right text-[12px] font-semibold text-black uppercase">
                  Price/Item
                </th>
                <th className="border border-black px-4 py-2 text-right text-[12px] font-semibold text-black uppercase">
                  Disc.
                </th>
                <th className="border border-black px-4 py-2 text-right text-[12px] font-semibold text-black uppercase">
                  Tax
                </th>
                <th className="border border-black px-4 py-2 text-right text-[12px] font-semibold text-black uppercase">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {(creditNoteData.items || []).map((item, index) => {
                return (
                  <tr key={item.uuid} className="hover:bg-gray-50">
                    <td className="border border-black px-4 py-2 text-sm text-black">
                      {index + 1}
                    </td>
                    <td className="border border-black px-4 py-2 text-sm text-black">
                      <div className="font-medium">{item.item_name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-600 mt-1">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="border border-black px-4 py-2 text-center text-sm text-black">
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center mx-auto">
                        <span className="text-xs text-gray-500">No Img</span>
                      </div>
                    </td>
                    <td className="border border-black px-4 py-2 text-center text-sm text-black">
                      {item.quantity}
                    </td>
                    <td className="border border-black px-4 py-2 text-right text-sm text-black">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="border border-black px-4 py-2 text-right text-sm text-black">
                      {item.discount?.discount_percentage && item.discount.discount_percentage > 0
                        ? `${item.discount.discount_percentage}%`
                        : typeof item.discount === 'number' && item.discount > 0
                        ? `${item.discount}%`
                        : item.discount_percentage !== undefined && item.discount_percentage > 0
                        ? `${item.discount_percentage}%`
                        : "-"}
                    </td>
                    <td className="border border-black px-4 py-2 text-right text-sm text-black">
                      {item.tax?.tax_percentage && item.tax.tax_percentage > 0
                        ? `${item.tax.tax_percentage}%`
                        : typeof item.tax === 'number' && item.tax > 0
                        ? `${item.tax}%`
                        : item.tax_percentage !== null && item.tax_percentage !== undefined && item.tax_percentage > 0
                        ? `${item.tax_percentage}%`
                        : "-"}
                    </td>
                    <td className="border border-black px-4 py-2 text-right text-sm font-medium text-black">
                      {formatCurrency(item.total_price)}
                    </td>
                  </tr>
                );
              })}
              {/* Footer Rows */}
              <tr className="bg-gray-50">
                <td colSpan={5} className="border border-black px-4 py-2 text-right text-sm font-semibold text-black">
                  Subtotal:
                </td>
                <td className="border border-black px-4 py-2 text-right text-sm text-black">
                  {formatCurrency(creditNoteData.discount_total || 0)}
                </td>
                <td className="border border-black px-4 py-2 text-right text-sm text-black">
                  {formatCurrency(creditNoteData.tax_total || 0)}
                </td>
                <td className="border border-black px-4 py-2 text-right text-sm font-semibold text-black">
                  {formatCurrency(creditNoteData.subtotal || 0)}
                </td>
              </tr>
              <tr>
                <td colSpan={7} className="border border-black px-4 py-2 text-right text-sm font-bold text-black">
                  Grand Total:
                </td>
                <td className="border border-black px-4 py-2 text-right text-sm font-bold text-black">
                  {formatCurrency(creditNoteData.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary Section */}
        <div className="flex justify-between mb-8">
          <div className="flex-1">
            <div className="space-y-4">
              {creditNoteData.notes && (
                <div>
                  <h4 className="text-sm font-semibold text-black mb-2">Notes:</h4>
                  <p className="text-sm text-gray-700">{creditNoteData.notes}</p>
                </div>
              )}
              {creditNoteData.terms_and_conditions && (
                <div>
                  <h4 className="text-sm font-semibold text-black mb-2">
                    Terms & Conditions:
                  </h4>
                  <p className="text-sm text-gray-700">
                    {creditNoteData.terms_and_conditions}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="w-80">
            {/* ===== Tax Summary ===== */}
            <div className="space-y-0">
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-normal text-black uppercase">
                  Taxable Amount
                </span>
                <span className="text-sm font-bold text-black">
                  {formatCurrency(creditNoteData.subtotal - (creditNoteData.discount_total || 0))}
                </span>
              </div>

              {creditNoteData.tax_total > 0 && (
                <>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs font-normal text-black uppercase">
                      CGST ({creditNoteData.subtotal - (creditNoteData.discount_total || 0) > 0
                        ? Math.round(((creditNoteData.tax_total / (creditNoteData.subtotal - (creditNoteData.discount_total || 0))) * 100 / 2) * 100) / 100
                        : 0}%)
                    </span>
                    <span className="text-sm font-bold text-black">
                      {formatCurrency(creditNoteData.tax_total / 2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-black">
                    <span className="text-xs font-normal text-black uppercase">
                      {currentUser?.isUT ? 'UTGST' : 'SGST'}
                      ({creditNoteData.subtotal - (creditNoteData.discount_total || 0) > 0
                        ? Math.round(((creditNoteData.tax_total / (creditNoteData.subtotal - (creditNoteData.discount_total || 0))) * 100 / 2) * 100) / 100
                        : 0}%)
                    </span>
                    <span className="text-sm font-bold text-black">
                      {formatCurrency(creditNoteData.tax_total / 2)}
                    </span>
                  </div>
                </>
              )}

              {creditNoteData.additional_charges_total > 0 && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-normal text-black uppercase">
                    Additional Charges
                  </span>
                  <span className="text-sm font-bold text-black">
                    {formatCurrency(creditNoteData.additional_charges_total)}
                  </span>
                </div>
              )}

              {creditNoteData.round_off !== 0 && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs font-normal text-black uppercase">
                    Round Off
                  </span>
                  <span className="text-sm font-bold text-black">
                    {formatCurrency(creditNoteData.round_off)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-3 border-b-2 border-black">
                <span className="text-sm font-bold text-black uppercase tracking-wider">
                  Grand Total
                </span>
                <span className="text-xl font-bold text-black">
                  {formatCurrency(creditNoteData.total_amount)}
                </span>
              </div>

              <div className="pt-2 text-right">
                <p className="text-[10px] text-gray-500 uppercase font-medium">
                  Amount in Words
                </p>
                <p className="text-xs font-bold text-black">
                  {formatNumberInWords(creditNoteData.total_amount)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-black">
          <div className="flex justify-between">
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-8">Authorized Signature</p>
              <div className="border-b border-black w-48"></div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 mb-8">Customer Signature</p>
              <div className="border-b border-black w-48"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditInDetailsPage;