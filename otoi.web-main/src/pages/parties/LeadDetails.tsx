import { useParams } from "react-router-dom";
import { Person } from "./blocks/persons/person-models";
import { useEffect, useState } from "react";
import axios from "axios";
import { KeenIcon } from '@/components';

export const LeadDetails = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [user, setUser] = useState<Person | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "activities" | "intelligence">("overview");

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
      <div className="w-96 bg-white shadow-md p-6  overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-700">
            {user.first_name?.[0] + user.last_name?.[0] || "U"}
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
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="notepad-edit"  />
            Note
          </button>

          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="sms" />
            Email
          </button>

          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="call" />
            Call
          </button>

          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="note" />
            Task
          </button>

          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="calendar" />
            Meeting
          </button>
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
          <p className="text-gray-500 mt-2">Use subscription types to manage the communications this contact receives from you.</p>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold">Website activity</h2>
          <p className="text-gray-500 mt-2">Website activity shows you how many times a person has visited your site and viewed your pages.</p>
        </div>
      </div>

      {/* Right side content */}
      <div className="flex-1 p-6 bg-gray-50 overflow-y-auto">
        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-6 py-3 text-sm font-medium ${activeTab === "overview" ? "border-b-2 border-gray-600 text-gray-600" : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("activities")}
            className={`px-6 py-3 text-sm font-medium ${activeTab === "activities" ? "border-b-2 border-gray-600 text-gray-600" : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Activities
          </button>
          <button
            onClick={() => setActiveTab("intelligence")}
            className={`px-6 py-3 text-sm font-medium ${activeTab === "intelligence" ? "border-b-2 border-gray-600 text-gray-600" : "text-gray-500 hover:text-gray-700"
              }`}
          >
            Intelligence
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div>
            {/* Activity totals */}
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Activity totals</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">INBOUND EMAILS</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">CONNECTED CALLS</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">LIVE CHATS</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </div>

            {/* Data highlights */}
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Data highlights</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">CREATE DATE</p>
                  <p>{user.created_at || "--"}</p>
                </div>
                <div>
                  <p className="text-gray-500">LIFECYCLE STAGE</p>
                  <p>{user.person_type || "--"}</p>
                </div>
                <div>
                  <p className="text-gray-500">LAST ACTIVITY DATE</p>
                  <p className="font-medium">--</p>
                </div>
              </div>
            </div>

            {/* Recent activities */}
            <div className="bg-white rounded-xl shadow p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Recent activities</h3>
                <button className="text-sm text-gray-600 hover:underline">All time so far</button>
              </div>
              <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center text-gray-500">
                <svg className="w-12 h-12 mb-2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>No activities.</p>
              </div>
            </div>

            {/* Contacts */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Contacts</h3>
                <button className="px-3 py-1 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700">+ Add</button>
              </div>
              <p className="text-gray-500 mt-2">No contacts linked.</p>
            </div>
          </div>
        )}

        {activeTab === "activities" && (
          <div>
            {/* Search and Filters */}
            <div className="flex items-center justify-between mb-6">
              <input
                type="text"
                placeholder="Search activities"
                className="border rounded-lg px-3 py-2 text-sm w-1/3"
              />
              <button className="px-3 py-2 border rounded-lg text-sm">Collapse all</button>
            </div>

            {/* Activity Tabs */}
            <div className="flex gap-6 border-b mb-4 text-sm">
              {["Activity", "Notes", "Emails", "Whatsapp", "Calls", "Tasks", "Meetings"].map((tab) => (
                <button key={tab} className="pb-2 font-medium text-gray-600 hover:border-b hover:text-gray-800 border-gray-600">
                  {tab}
                </button>
              ))}
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <div className="text-gray-500 text-sm">August 2025</div>
              <div className="bg-white shadow rounded-lg p-4">
                <p className="font-semibold">Lifecycle change</p>
                <p className="text-sm"><span className="font-medium text-gray-600">{user.first_name || user.last_name ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : "--"}</span> updated the lifecycle stage for this contact to Lead. <span className="text-gray-600 cursor-pointer">View details</span></p>
                <p>{user.created_at || "--"}</p>
              </div>
              <div className="bg-white shadow rounded-lg p-4">
                <p className="text-sm">This contact was created from Offline Sources from CRM UI</p>
                <p>{user.created_at || "--"}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "intelligence" && (
          <div className="bg-white rounded-xl shadow p-6">
            <p className="text-gray-500">No intelligence data available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};