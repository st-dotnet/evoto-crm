import { ScreenLoader } from "@/components/loaders";
import { useParams, useNavigate } from "react-router-dom";
import { Lead } from "./lead-models";
import { useEffect, useState } from "react";
import axios from "axios";
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
            <ScreenLoader />
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
