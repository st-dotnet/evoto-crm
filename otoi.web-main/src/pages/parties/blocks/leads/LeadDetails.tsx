import { useParams } from "react-router-dom";
import { Lead } from "./lead-models"; 
import { useEffect, useState } from "react";
import axios from "axios";
import { KeenIcon } from '@/components';
import { SpinnerDotted } from 'spinners-react';

export const LeadDetails = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "activities" | "intelligence">("overview");


  const STATUS_LABEL_TO_VALUE: Record<string, string> = {
  "1": "New",
  "2": "In-Progress",
  "3": "Quote Given",
  "4": "Win",
  "5": "Lose",
};

  useEffect(() => {
    const fetchLead = async () => {
      try {
        const response = await axios.get<Lead>(
          `${import.meta.env.VITE_APP_API_URL}/leads/${uuid}` 
        );
        setLead(response.data);
      } catch (error) {
        console.error("Error fetching lead details:", error);
      }
    };
    fetchLead();
  }, [uuid]);

  if (!lead) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-[#0D0E12] dark:text-gray-700">
          <SpinnerDotted color="currentColor" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      {/* Left Sidebar */}
      <div className="w-96 bg-white shadow-md p-6 overflow-y-auto dark:bg-[#0D0E12]">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-xl font-bold text-gray-700">
            {lead.first_name?.[0] + lead.last_name?.[0] || "U"}
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {lead.first_name || lead.last_name ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : "--"}
            </h1>
            <p className="text-gray-500">{lead.email || "--"}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-6">
          <button className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <KeenIcon icon="notepad-edit" />
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
          <h2 className="text-lg font-semibold mb-3">About this lead</h2>
          <div className="space-y-2 text-gray-700">
            <p><strong>Email:</strong> {lead.email || "--"}</p>
            <p><strong>Mobile:</strong> {lead.mobile || "--"}</p>
            <p><strong>GST:</strong> {lead.gst || "--"}</p>
            <p><strong>Status:</strong> {STATUS_LABEL_TO_VALUE[lead.status || ""] ||"--"}</p>
            <p><strong>Created:</strong> {lead.created_at || "--"}</p>
          </div>
        </div>

        {/* Extra Sections */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Communication subscriptions</h2>
          <p className="text-gray-500 mt-2">Manage the communications this lead receives from you.</p>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold">Website activity</h2>
          <p className="text-gray-500 mt-2">Shows how many times a lead has visited your site.</p>
        </div>
      </div>

      {/* Right side content */}
      <div className="flex-1 p-6 bg-gray-50 overflow-y-auto dark:bg-[#0D0E12]">
        {/* Tabs */}
        <div className="flex border-b mb-6">
          {["overview", "activities", "intelligence"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 text-sm font-medium ${activeTab === tab ? "border-b-2 border-gray-600 text-gray-600" : "text-gray-500 hover:text-gray-700"}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div>
            {/* Example activity totals */}
            <div className="bg-white rounded-xl shadow p-6 mb-6 dark:bg-[#0D0E12]">
              <h3 className="text-lg font-semibold mb-4">Activity totals</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm text-gray-600">EMAILS</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">CALLS</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">MEETINGS</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </div>

            {/* Data highlights */}
            <div className="bg-white rounded-xl shadow p-6 mb-6 dark:bg-[#0D0E12]">
              <h3 className="text-lg font-semibold mb-4">Data highlights</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">CREATE DATE</p>
                  <p>{lead.created_at || "--"}</p>
                </div>
                <div>
                  <p className="text-gray-500">STATUS</p>
                  <p>{STATUS_LABEL_TO_VALUE[lead.status || ""] ||"--"}</p>
                </div>
                <div>
                  <p className="text-gray-500">LAST ACTIVITY DATE</p>
                  <p className="font-medium">--</p>
                </div>
              </div>
            </div>

            {/* Recent activities */}
            <div className="bg-white rounded-xl shadow p-6 mb-6 dark:bg-[#0D0E12]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Recent activities</h3>
                <button className="text-sm text-gray-600 hover:underline">All time</button>
              </div>
              <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center text-gray-500">
                <p>No activities yet.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "activities" && (
          <div>
            <h3 className="text-lg font-semibold">Activities</h3>
            <p className="text-gray-500">No activities for this lead.</p>
          </div>
        )}

        {activeTab === "intelligence" && (
          <div className="bg-white rounded-xl shadow p-6 dark:bg-[#0D0E12]">
            <p className="text-gray-500">No intelligence data available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
