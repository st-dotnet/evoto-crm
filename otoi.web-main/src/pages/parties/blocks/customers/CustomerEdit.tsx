import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { SpinnerDotted } from 'spinners-react';
import { ModalCustomer } from "./ModalCustomer";

interface Customer {
    uuid?: string;
    first_name: string;
    last_name: string;
    mobile: string;
    email: string;
    gst: string;
    person_type_id: string;
    status: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    country?: string;
    pin?: string;
}

export const CustomerEdit = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCustomer = async () => {
            try {
                const response = await axios.get<Customer>(
                    `${import.meta.env.VITE_APP_API_URL}/customers/${uuid}`
                );
                setCustomer(response.data);
            } catch (error) {
                console.error("Error fetching customer:", error);
            } finally {
                setLoading(false);
            }
        };
        if (uuid) {
            fetchCustomer();
        }
    }, [uuid]);

    const handleClose = (open: boolean) => {
        setModalOpen(open);
        if (!open) {
            // Navigate back to customer details after closing
            navigate(`/customer/${uuid}`);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center">
                <div className="text-[#0D0E12] dark:text-gray-700">
                    <SpinnerDotted color="currentColor" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0D0E12] p-4">
            <ModalCustomer
                open={modalOpen}
                onOpenChange={handleClose}
                customer={customer}
            />
        </div>
    );
};
