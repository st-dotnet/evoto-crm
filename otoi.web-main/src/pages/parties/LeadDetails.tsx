import { useParams } from "react-router-dom";
import { Person } from "./blocks/persons/person-models";
import { useEffect, useState } from "react";
import axios from "axios";

export const LeadDetails = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [user, setUser] = useState<Person | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get<Person>(
          `${import.meta.env.VITE_APP_API_URL}/persons/${uuid}`
        );
        setUser(response.data);
      } catch (error) {
        console.error("Error fetching user details:", error);
      }
    };
    fetchUser();
  }, [uuid]);

  if (!user) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="flex">
      {/* Left Sidebar */}
      <div className="w-96 bg-white h-screen shadow-md p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-700">
            {user.first_name?.[0] || user.last_name?.[0] || "U"}
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {user.first_name || user.last_name ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "--"}
            </h1>
            <p className="text-gray-500">{user.email || "--"}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-6">
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">Note</button>
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">Email</button>
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">Call</button>
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">Task</button>
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200">Meeting</button>
        </div>

        {/* About Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">About this contact</h2>
          <div className="space-y-2 text-gray-700">
            <p><strong>Email:</strong> {user.email || "--"}</p>
            <p><strong>Mobile:</strong> {user.mobile || "--"}</p>
            <p><strong>GST:</strong> {user.gst || "--"}</p>
            <p><strong>Type:</strong> {user.person_type || "--"}</p>
            <p><strong>Created:</strong> {user.created_at || "--"}</p>
          </div>
        </div>

        {/* Extra Sections */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Communication subscriptions</h2>
          <p className="text-gray-500 mt-2">--</p>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold">Website activity</h2>
          <p className="text-gray-500 mt-2">--</p>
        </div>
      </div>

      {/* Right side content (placeholder) */}
      <div className="flex-1 p-6">
        <h2 className="text-2xl font-bold">Main Page Content</h2>
        <p className="text-gray-500">This is the rest of your app’s content area.</p>
      </div>
    </div>
  );
};
