import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer, Share, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createQuotation, getQuotationById, updateQuotation } from "../services/quotation.services";
// import { createInvoiceFromQuotation } from "@/pages/invoice/services/invoice.services";

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
}

const QuotationPreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams(); // Get ID from URL
  const [isSaving, setIsSaving] = useState(false);
  const [showBusinessAddressBanner, setShowBusinessAddressBanner] = useState(true);
  const [fetchedData, setFetchedData] = useState<QuotationData | null>(null);

  // Determine source of data: location state or fetched data
  const quotationData: QuotationData = fetchedData || location.state?.quotationData || {
    quotationNo: "", quotationDate: "", validFor: 0, validityDate: "", status: "", selectedCustomer: null, quotationItems: []
  };

  // Fetch data if ID exists and no state
  useEffect(() => {
    if (id && !location.state?.quotationData) {
      const fetchData = async () => {
        try {
          const response = await getQuotationById(id);
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
              validFor: 0, // calc
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
              terms: data.terms_and_conditions
            };
            setFetchedData(transformedData);
          } else {
            toast.error("Failed to load quotation");
          }
        } catch (error) {
          console.error("Error fetching quotation:", error);
          toast.error("Failed to load quotation");
        }
      };
      fetchData();
    }
  }, [id, location.state]);

  const calculateTotals = () => {
    const items = quotationData.quotationItems || [];
    const subtotal = items.reduce((sum, item) => sum + (item.price_per_item * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.price_per_item * item.quantity * item.discount) / 100, 0);
    const totalTax = items.reduce((sum, item) => sum + ((item.price_per_item * item.quantity * (1 - item.discount / 100)) * item.tax) / 100, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    // Calculate CGST and SGST based on actual item tax rates
    const totalCGST = items.reduce((sum, item) => {
      const taxableAmount = (item.price_per_item * item.quantity * (1 - item.discount / 100));
      const itemTaxAmount = taxableAmount * (item.tax / 100);
      // Assuming CGST is half of item tax (common in India)
      return sum + (itemTaxAmount / 2);
    }, 0);

    const totalSGST = items.reduce((sum, item) => {
      const taxableAmount = (item.price_per_item * item.quantity * (1 - item.discount / 100));
      const itemTaxAmount = taxableAmount * (item.tax / 100);
      // Assuming SGST is half of item tax (common in India)
      return sum + (itemTaxAmount / 2);
    }, 0);

    return {
      subtotal,
      totalDiscount,
      totalTax,
      totalAmount,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      totalCGST,
      totalSGST
    };
  };

  // Check if quotation is already saved
  const locationState = location.state as { quotationData?: any; quotationId?: string };
  const isAlreadySaved = !!locationState?.quotationId;

  const totals = calculateTotals();

  const handleSaveQuotation = async () => {
    setIsSaving(true);
    try {
      // Check if quotation is already saved (has quotationId)
      const locationState = location.state as { quotationData?: any; quotationId?: string };
      if (locationState?.quotationId) {
        toast.success("Quotation already saved!");
        navigate("/quotes/list");
        return;
      }

      // Prepare data for API using the service
      const submissionData = {
        ...quotationData,
        total_amount: totals.totalAmount,
        subtotal: totals.subtotal,
        total_discount: totals.totalDiscount,
        total_tax: totals.totalTax,
        created_at: new Date().toISOString(),
      };

      // Save quotation via service
      const response = await createQuotation(submissionData);

      if (response.success) {
        toast.success("Quotation saved successfully!");

        // Navigate to quotation list page
        navigate("/quotes/list");
      } else {
        toast.error(response.error || "Failed to save quotation");
      }
    } catch (error) {
      console.error("Error saving quotation:", error);
      toast.error("Failed to save quotation");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = () => {
    // TODO: Implement PDF download functionality
    toast.info("PDF download feature coming soon");
  };

  const handlePrintPDF = () => {
    // TODO: Implement print functionality
    window.print();
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    toast.info("Share feature coming soon");
  };

  const formatCurrency = (amount: number) => {
    return `₹ ${amount.toFixed(2)}`;
  };

  const formatNumberInWords = (num: number) => {
    if (!Number.isFinite(num)) {
      return "Zero Rupees";
    }

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
      if (rest) {
        parts.push(threeDigits(rest));
      }

      return parts.join(" ");
    };

    const totalPaise = Math.round(Math.abs(num) * 100);
    if (totalPaise === 0) {
      return "Zero Rupees";
    }

    const rupees = Math.floor(totalPaise / 100);
    const paise = totalPaise % 100;

    let result = `${toIndianWords(rupees)} Rupees`;
    if (paise) {
      result += ` and ${toIndianWords(paise)} Paise`;
    }
    return result;
  };

  const getAuthBusinessInfo = () => {
    try {
      const authData = localStorage.getItem("OTOI-auth-v1.0.0.1");
      if (!authData) return null;
      const parsedAuth = JSON.parse(authData);
      const business =
        parsedAuth.business ||
        parsedAuth.business_profile ||
        parsedAuth.business_details ||
        parsedAuth.company ||
        parsedAuth.company_profile ||
        parsedAuth.businessInfo ||
        null;
      const user = parsedAuth.user || parsedAuth.profile || parsedAuth.data?.user || null;

      return {
        name:
          business?.company_name ||
          business?.business_name ||
          business?.name ||
          user?.companyName ||
          user?.company_name ||
          user?.company ||
          "XYZ",
        mobile: business?.mobile || business?.phone || business?.contact_number || user?.phone || user?.mobile,
        email: business?.email || user?.email,
        gstin: business?.gstin || business?.gst || business?.gst_number,
        pan: business?.pan || business?.pan_number,
        website: business?.website || business?.web || business?.url,
        address: business?.address || business?.billing_address || business?.registered_address || null,
        rawBusiness: business
      };
    } catch (error) {
      return null;
    }
  };

  const formatAddressLines = (address: any): string[] => {
    if (!address) return [];
    if (typeof address === "string") return [address];
    const lines: string[] = [];
    const line1 = address.address1 || address.address_line1 || address.line1 || address.street1;
    const line2 = address.address2 || address.address_line2 || address.line2 || address.street2;
    if (line1) lines.push(line1);
    if (line2) lines.push(line2);
    const cityStatePin = [address.city, address.state, address.pin || address.postal_code || address.zip]
      .filter(Boolean)
      .join(", ");
    if (cityStatePin) lines.push(cityStatePin);
    if (address.country) lines.push(address.country);
    return lines;
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

    if (!address) {
      const prefix = type === "shipping" ? "shipping_" : "";
      address = {
        address1: customer[`${prefix}address1`] || customer[`${prefix}address_line1`] || customer.address1 || customer.address_line1,
        address2: customer[`${prefix}address2`] || customer[`${prefix}address_line2`] || customer.address2 || customer.address_line2,
        city: customer[`${prefix}city`] || customer.city,
        state: customer[`${prefix}state`] || customer.state,
        pin: customer[`${prefix}pin`] || customer.pin,
        country: customer[`${prefix}country`] || customer.country
      };
    }

    return address;
  };

  const getMeasuringUnit = (unitId?: number) => {
    const units: { [key: number]: string } = {
      1: "PCS",
      2: "KG",
      3: "LTR",
      4: "MTR"
    };
    return units[unitId || 1] || "PCS";
  };

  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/quotes/list")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">
                Quotation/Estimate #{quotationData.quotationNo || "1"}
              </h1>
              <p className="text-sm text-gray-500">Preview</p>
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
            <Button
              className={`${isAlreadySaved ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"} text-white gap-2`}
              onClick={handleSaveQuotation}
              disabled={isSaving}
            >
              <FileText className="h-4 w-4" />
              {isSaving ? "Processing..." : isAlreadySaved ? "View Quotations List" : "Convert to Invoice"}
            </Button>
          </div>
        </div>
      </div>

      {/* Business Address Banner */}
      {/* {showBusinessAddressBanner && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900">Add Business Address</h3>
              <p className="text-sm text-blue-700 mt-1">
                Add your business address to showcase your business identity on all the invoices
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                Add Business Address
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBusinessAddressBanner(false)}
                className="text-blue-600 hover:text-blue-800"
              >
                ×
              </Button>
            </div>
          </div>
        </div>
      )} */}

      {/* Invoice Content */}
      <div className="max-w-4xl mx-auto p-6 bg-white">
        {/* Company Info */}
        <div className="mb-8">
          {(() => {
            const businessInfo = getAuthBusinessInfo();
            const addressLines = formatAddressLines(businessInfo?.address);
            return (
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-gray-900">{businessInfo?.name || "XYZ"}</h2>
                {businessInfo?.rawBusiness?.contact_person && (
                  <p className="text-gray-600">Contact: {businessInfo.rawBusiness.contact_person}</p>
                )}
                {addressLines.map((line, index) => (
                  <p key={index} className="text-gray-600">{line}</p>
                ))}
                {businessInfo?.gstin && <p className="text-gray-600">GSTIN: {businessInfo.gstin}</p>}
                {businessInfo?.pan && <p className="text-gray-600">PAN: {businessInfo.pan}</p>}
                {businessInfo?.mobile && <p className="text-gray-600">Mobile: {businessInfo.mobile}</p>}
                {businessInfo?.email && <p className="text-gray-600">Email: {businessInfo.email}</p>}
                {businessInfo?.website && <p className="text-gray-600">Website: {businessInfo.website}</p>}
              </div>
            );
          })()}
        </div>

        {/* Quotation Details */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div>
            <p className="text-sm text-gray-500">Quotation No.</p>
            <p className="font-semibold">{quotationData.quotationNo || "1"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Quotation Date</p>
            <p className="font-semibold">
              {new Date(quotationData.quotationDate).toLocaleDateString('en-IN')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Expiry Date</p>
            <p className="font-semibold">
              {new Date(quotationData.validityDate).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="mb-8">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">BILL TO</h3>
              <div className="space-y-1">
                <p className="font-medium">
                  {quotationData.selectedCustomer ? 
                    `${quotationData.selectedCustomer.first_name} ${quotationData.selectedCustomer.last_name}` : 
                    'No customer selected'
                  }
                </p>
                {quotationData.selectedCustomer?.company_name && (
                  <p className="text-gray-600">{quotationData.selectedCustomer.company_name}</p>
                )}
                {quotationData.selectedCustomer && (
                  <p className="text-gray-600">Mobile: {quotationData.selectedCustomer.mobile}</p>
                )}
                {quotationData.selectedCustomer?.email && (
                  <p className="text-gray-600">Email: {quotationData.selectedCustomer.email}</p>
                )}
                {quotationData.selectedCustomer?.gst && (
                  <p className="text-gray-600">GST: {quotationData.selectedCustomer.gst}</p>
                )}
                {quotationData.selectedCustomer && formatAddressLines(getCustomerAddress(quotationData.selectedCustomer as any, "billing")).map((line, index) => (
                  <p key={index} className="text-gray-600">{line}</p>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <h3 className="font-semibold text-gray-900 mb-2">SHIP TO</h3>
              <div className="space-y-1">
                <p className="font-medium">
                  {quotationData.selectedCustomer ? 
                    `${quotationData.selectedCustomer.first_name} ${quotationData.selectedCustomer.last_name}` : 
                    'No customer selected'
                  }
                </p>
                {quotationData.selectedCustomer?.company_name && (
                  <p className="text-gray-600">{quotationData.selectedCustomer.company_name}</p>
                )}
                {quotationData.selectedCustomer && (
                  <p className="text-gray-600">Mobile: {quotationData.selectedCustomer.mobile}</p>
                )}
                {quotationData.selectedCustomer?.email && (
                  <p className="text-gray-600">Email: {quotationData.selectedCustomer.email}</p>
                )}
                {quotationData.selectedCustomer?.gst && (
                  <p className="text-gray-600">GST: {quotationData.selectedCustomer.gst}</p>
                )}
                {quotationData.selectedCustomer && formatAddressLines(getCustomerAddress(quotationData.selectedCustomer as any, "shipping")).map((line, index) => (
                  <p key={index} className="text-gray-600">{line}</p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <h3 className="font-semibold text-gray-900 mb-4">ITEMS</h3>
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-sm">Item Description</th>
                <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-sm">QTY</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-sm">RATE</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-sm">DISC.</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-sm">TAX</th>
                <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-sm">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {quotationData.quotationItems?.map((item) => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2">
                    <div>
                      <p className="font-medium text-sm">{item.item_name}</p>
                      {item.description && (
                        <p className="text-xs text-gray-500">{item.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                    {item.quantity} {getMeasuringUnit(item.measuring_unit_id)}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-sm">{formatCurrency(item.price_per_item)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                    <div>
                      ₹ -{((item.price_per_item * item.quantity * item.discount) / 100).toFixed(2)}
                      {item.discount > 0 && (
                        <div className="text-xs text-gray-500">
                          ({item.discount.toFixed(0)}%)
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                    <div>
                      {formatCurrency(
                        (item.price_per_item *
                          item.quantity *
                          (1 - item.discount / 100) *
                          item.tax) /
                        100
                      )}
                      {item.tax > 0 && (
                        <div className="text-xs text-gray-500">
                          ({item.tax.toFixed(0)}%)
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-semibold text-sm">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={2} className="border border-gray-300 px-3 py-2 text-right text-sm">SUBTOTAL</td>
                <td className="border border-gray-300 px-3 py-2 text-right text-sm">-</td>
                <td className="border border-gray-300 px-3 py-2 text-right text-sm">₹ -{totals.totalDiscount.toFixed(2)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right text-sm">{formatCurrency(totals.totalTax)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right text-sm">{formatCurrency(totals.totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Notes Section */}
        {quotationData.notes && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-2">NOTES</h3>
            <p className="text-gray-600">{quotationData.notes}</p>
          </div>
        )}

        {/* Terms Section */}
        {quotationData.terms && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-900 mb-2">TERMS AND CONDITIONS</h3>
            <div className="text-gray-600">
              {quotationData.terms.split('\n').map((term, index) => (
                <p key={index} className="mb-1">• {term}</p>
              ))}
            </div>
          </div>
        )}

        {/* Summary Section */}
        <div className="border-t pt-6">
          <div className="space-y-2">
            {/* <div className="flex justify-between">
              <span className="text-gray-600">Packing charge</span>
              <span>₹ 0.00</span>
            </div> */}
            <div className="flex justify-between">
              <span className="text-gray-600">Taxable Amount</span>
              <span>{formatCurrency(totals.subtotal - totals.totalDiscount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">CGST @9%</span>
              <span>{formatCurrency(totals.totalTax / 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">SGST @9%</span>
              <span>{formatCurrency(totals.totalTax / 2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total Amount</span>
              <span>{formatCurrency(totals.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 pt-2">
              <span>Total Amount (in words)</span>
              <span>{formatNumberInWords(totals.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationPreviewPage;
