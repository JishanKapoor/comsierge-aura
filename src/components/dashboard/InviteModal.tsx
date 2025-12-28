import { useState } from "react";
import { X, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InviteModal = ({ isOpen, onClose }: InviteModalProps) => {
  const [emails, setEmails] = useState(["", "", ""]);

  if (!isOpen) return null;

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const addMoreEmail = () => {
    setEmails([...emails, ""]);
  };

  const handleSendInvites = () => {
    const validEmails = emails.filter(e => e.trim() !== "");
    if (validEmails.length === 0) {
      toast.error("Please enter at least one email");
      return;
    }
    toast.success(`Invites sent to ${validEmails.length} people`);
    setEmails(["", "", ""]);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-start justify-center pt-20 z-50 pointer-events-none">
        <div 
          className="bg-[#F9F9F9] rounded-xl shadow-2xl w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800">Invite people</h2>
            <button 
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            <p className="text-xs text-gray-500 mb-4">
              Invite people to collaborate in Comsierge:
            </p>
            
            <div className="space-y-3">
              {emails.map((email, index) => (
                <input
                  key={index}
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(index, e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                />
              ))}
            </div>

            <div className="flex items-center justify-between mt-5">
              <button 
                onClick={addMoreEmail}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add more
              </button>
              <Button
                onClick={handleSendInvites}
                className="h-8 px-6 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Send Invites
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default InviteModal;
