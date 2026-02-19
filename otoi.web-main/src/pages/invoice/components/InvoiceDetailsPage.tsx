import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Printer, Share, CreditCard, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getInvoiceById } from "../services/invoice.services";

interface InvoiceItem {
    uuid: string;
    item_id: string;
    product_name: string;
    description?: string | null;
    quantity: number;
    unit_price: number;
    discount_percentage: number;
    discount_amount: number;
    tax_percentage: number;
    tax_amount: number;
    total_price: number;
    measuring_unit_id?: number;
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

interface InvoiceData {
    uuid: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    status: string;
    payment_status: string;
    customer: Customer;
    items: InvoiceItem[];
    subtotal: number;
    tax_total: number;
    discount_total: number;
    additional_charges_total: number;
    round_off: number;
    total_amount: number;
    amount_paid: number;
    balance_due: number;
    notes?: string;
    terms_and_conditions?: string;
    payment_terms?: string;
}

const InvoiceDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchInvoiceData();
        }
    }, [id]);

    const fetchInvoiceData = async () => {
        setIsLoading(true);
        try {
            const response = await getInvoiceById(id!);
            if (response.success && response.data) {
                setInvoiceData(response.data);
            } else {
                toast.error(response.error || "Failed to load invoice");
                navigate("/invoices");
            }
        } catch (error) {
            console.error("Error fetching invoice:", error);
            toast.error("Failed to load invoice");
            navigate("/invoices");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadPDF = () => {
        toast.info("PDF download feature coming soon");
    };

    const handlePrintPDF = () => {
        window.print();
    };

    const handleShare = () => {
        toast.info("Share feature coming soon");
    };

    const handleRecordPayment = () => {
        navigate(`/invoices/${id}/payment`);
    };

    const handleEdit = () => {
        navigate(`/invoices/${id}/edit`);
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

    const getPaymentStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            paid: 'bg-green-100 text-green-800',
            partial: 'bg-yellow-100 text-yellow-800',
            unpaid: 'bg-red-100 text-red-800',
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            draft: 'bg-gray-100 text-gray-800',
            sent: 'bg-blue-100 text-blue-800',
            paid: 'bg-green-100 text-green-800',
            overdue: 'bg-red-100 text-red-800',
        };
        return styles[status] || 'bg-gray-100 text-gray-800';
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!invoiceData) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p>Invoice not found</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white px-6 py-4 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/invoices")}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-semibold">
                                Invoice #{invoiceData.invoice_number}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(invoiceData.status)}`}>
                                    {invoiceData.status.charAt(0).toUpperCase() + invoiceData.status.slice(1)}
                                </span>
                                <span className={`px-2 py-1 text-xs rounded-full ${getPaymentStatusBadge(invoiceData.payment_status)}`}>
                                    {invoiceData.payment_status.charAt(0).toUpperCase() + invoiceData.payment_status.slice(1)}
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
                            Print
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
                            variant="outline"
                            size="sm"
                            onClick={handleEdit}
                            className="gap-2"
                        >
                            <Edit className="h-4 w-4" />
                            Edit
                        </Button>
                        {invoiceData.balance_due > 0 && (
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                                onClick={handleRecordPayment}
                                size="sm"
                            >
                                <CreditCard className="h-4 w-4" />
                                Record Payment
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Invoice Content */}
            <div className="max-w-4xl mx-auto p-6 bg-white my-6 shadow-sm rounded-lg">
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

                {/* Invoice Details */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div>
                        <p className="text-sm text-gray-500">Invoice No.</p>
                        <p className="font-semibold">{invoiceData.invoice_number}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Invoice Date</p>
                        <p className="font-semibold">
                            {new Date(invoiceData.invoice_date).toLocaleDateString('en-IN')}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Due Date</p>
                        <p className="font-semibold">
                            {new Date(invoiceData.due_date).toLocaleDateString('en-IN')}
                        </p>
                    </div>
                </div>

                {/* Payment Status Summary */}
                {invoiceData.amount_paid > 0 && (
                    <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-gray-600">Total Amount</p>
                                <p className="font-semibold text-lg">{formatCurrency(invoiceData.total_amount)}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Amount Paid</p>
                                <p className="font-semibold text-lg text-green-600">{formatCurrency(invoiceData.amount_paid)}</p>
                            </div>
                            <div>
                                <p className="text-gray-600">Balance Due</p>
                                <p className="font-semibold text-lg text-red-600">{formatCurrency(invoiceData.balance_due)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bill To / Ship To */}
                <div className="mb-8">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">BILL TO</h3>
                            <div className="space-y-1">
                                <p className="font-medium">
                                    {invoiceData.customer ?
                                        `${invoiceData.customer.first_name} ${invoiceData.customer.last_name}` :
                                        'No customer'
                                    }
                                </p>
                                {invoiceData.customer?.company_name && (
                                    <p className="text-gray-600">{invoiceData.customer.company_name}</p>
                                )}
                                {invoiceData.customer && (
                                    <p className="text-gray-600">Mobile: {invoiceData.customer.mobile}</p>
                                )}
                                {invoiceData.customer?.email && (
                                    <p className="text-gray-600">Email: {invoiceData.customer.email}</p>
                                )}
                                {invoiceData.customer?.gst && (
                                    <p className="text-gray-600">GST: {invoiceData.customer.gst}</p>
                                )}
                                {invoiceData.customer && formatAddressLines(getCustomerAddress(invoiceData.customer as any, "billing")).map((line, index) => (
                                    <p key={index} className="text-gray-600">{line}</p>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-2">
                            <h3 className="font-semibold text-gray-900 mb-2">SHIP TO</h3>
                            <div className="space-y-1">
                                <p className="font-medium">
                                    {invoiceData.customer ?
                                        `${invoiceData.customer.first_name} ${invoiceData.customer.last_name}` :
                                        'No customer'
                                    }
                                </p>
                                {invoiceData.customer?.company_name && (
                                    <p className="text-gray-600">{invoiceData.customer.company_name}</p>
                                )}
                                {invoiceData.customer && (
                                    <p className="text-gray-600">Mobile: {invoiceData.customer.mobile}</p>
                                )}
                                {invoiceData.customer?.email && (
                                    <p className="text-gray-600">Email: {invoiceData.customer.email}</p>
                                )}
                                {invoiceData.customer?.gst && (
                                    <p className="text-gray-600">GST: {invoiceData.customer.gst}</p>
                                )}
                                {invoiceData.customer && formatAddressLines(getCustomerAddress(invoiceData.customer as any, "shipping")).map((line, index) => (
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
                            {invoiceData.items?.map((item) => (
                                <tr key={item.uuid} className="border-b hover:bg-gray-50">
                                    <td className="border border-gray-300 px-3 py-2">
                                        <div>
                                            <p className="font-medium text-sm">{item.product_name}</p>
                                            {item.description && (
                                                <p className="text-xs text-gray-500">{item.description}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-center text-sm">
                                        {item.quantity} {getMeasuringUnit(item.measuring_unit_id)}
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right text-sm">{formatCurrency(item.unit_price)}</td>
                                    <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                                        <div>
                                            ₹ -{item.discount_amount.toFixed(2)}
                                            {item.discount_percentage > 0 && (
                                                <div className="text-xs text-gray-500">
                                                    ({item.discount_percentage.toFixed(0)}%)
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                                        <div>
                                            {formatCurrency(item.tax_amount)}
                                            {item.tax_percentage > 0 && (
                                                <div className="text-xs text-gray-500">
                                                    ({item.tax_percentage.toFixed(0)}%)
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="border border-gray-300 px-3 py-2 text-right font-semibold text-sm">{formatCurrency(item.total_price)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-50 font-semibold">
                                <td colSpan={2} className="border border-gray-300 px-3 py-2 text-right text-sm">SUBTOTAL</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-sm">-</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-sm">₹ -{invoiceData.discount_total.toFixed(2)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-sm">{formatCurrency(invoiceData.tax_total)}</td>
                                <td className="border border-gray-300 px-3 py-2 text-right text-sm">{formatCurrency(invoiceData.total_amount)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Notes Section */}
                {invoiceData.notes && (
                    <div className="mb-8">
                        <h3 className="font-semibold text-gray-900 mb-2">NOTES</h3>
                        <p className="text-gray-600">{invoiceData.notes}</p>
                    </div>
                )}

                {/* Terms Section */}
                {invoiceData.terms_and_conditions && (
                    <div className="mb-8">
                        <h3 className="font-semibold text-gray-900 mb-2">TERMS AND CONDITIONS</h3>
                        <div className="text-gray-600">
                            {invoiceData.terms_and_conditions.split('\n').map((term, index) => (
                                <p key={index} className="mb-1">• {term}</p>
                            ))}
                        </div>
                    </div>
                )}

                {/* Payment Terms */}
                {invoiceData.payment_terms && (
                    <div className="mb-8">
                        <h3 className="font-semibold text-gray-900 mb-2">PAYMENT TERMS</h3>
                        <p className="text-gray-600">{invoiceData.payment_terms}</p>
                    </div>
                )}

                {/* Summary Section */}
                <div className="border-t pt-6">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-gray-600">Taxable Amount</span>
                            <span>{formatCurrency(invoiceData.subtotal - invoiceData.discount_total)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">CGST</span>
                            <span>{formatCurrency(invoiceData.tax_total / 2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-600">SGST</span>
                            <span>{formatCurrency(invoiceData.tax_total / 2)}</span>
                        </div>
                        {invoiceData.additional_charges_total > 0 && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Additional Charges</span>
                                <span>{formatCurrency(invoiceData.additional_charges_total)}</span>
                            </div>
                        )}
                        {invoiceData.round_off !== 0 && (
                            <div className="flex justify-between">
                                <span className="text-gray-600">Round Off</span>
                                <span>{formatCurrency(invoiceData.round_off)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t">
                            <span>Total Amount</span>
                            <span>{formatCurrency(invoiceData.total_amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 pt-2">
                            <span>Total Amount (in words)</span>
                            <span>{formatNumberInWords(invoiceData.total_amount)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoiceDetailsPage;
