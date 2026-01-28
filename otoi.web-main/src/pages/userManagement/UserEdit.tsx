import { useParams, useNavigate } from "react-router-dom";
import { User } from "./user-models";
import { useEffect, useState } from "react";
import axios from "axios";
import { SpinnerDotted } from 'spinners-react';
import { ModalUser } from "./ModalUsers";

export const UserEdit = () => {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get<User>(
          `${import.meta.env.VITE_APP_API_URL}/users/${id}`
        );
        setUser(response.data);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };
    if (id) {
      fetchUser();
    }
  }, [id]);

  const handleClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      // Navigate back to users list after closing
      navigate("/user-management/users");
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
      <ModalUser 
        open={modalOpen} 
        onOpenChange={handleClose} 
        user={user}
      />
    </div>
  );
};
