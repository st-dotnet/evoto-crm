import { useParams, useNavigate } from "react-router-dom";
import { Lead } from "./lead-models";
import { useEffect, useState } from "react";
import axios from "axios";
import { SpinnerDotted } from 'spinners-react';
import { ModalLead } from "./ModalLead";

export const LeadEdit = () => {
    const { uuid } = useParams<{ uuid: string }>();
    const [lead, setLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchLead = async () => {
            try {
                const response = await axios.get<Lead>(
                    `${import.meta.env.VITE_APP_API_URL}/leads/${uuid}`
                );
                setLead(response.data);
            } catch (error) {
                console.error("Error fetching lead:", error);
            } finally {
                setLoading(false);
            }
        };
        if (uuid) {
            fetchLead();
        }
    }, [uuid]);

    const handleClose = (open: boolean) => {
        setModalOpen(open);
        if (!open) {
            // Navigate back to lead details after closing
            navigate(`/lead/${uuid}`);
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
            <ModalLead
                open={modalOpen}
                onOpenChange={handleClose}
                lead={lead}
            />
        </div>
    );
};
