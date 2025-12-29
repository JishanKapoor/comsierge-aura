import { useAuth } from "@/contexts/AuthContext";
import { Copy, Check, Camera, Pencil } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ProfileTab = () => {
  const { user, updateProfile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "Demo User");
  const [email, setEmail] = useState(user?.email || "user@example.com");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phoneNumber = "+1 (437) 239-2448";

  const copyPhoneNumber = () => {
    navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatarUrl(ev.target?.result as string);
        toast.success("Photo updated");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    updateProfile({ name, email });
    setIsEditing(false);
    toast.success("Profile saved");
  };

  return (
    <div className="space-y-4">
      {/* Profile section */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl text-gray-500 font-medium">
                {(user?.name || "U").charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 hover:border-gray-300"
          >
            <Camera className="w-3 h-3" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:border-gray-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 bg-white border border-gray-200 rounded text-sm text-gray-700 focus:outline-none focus:border-gray-300"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="h-7 px-3 text-xs bg-gray-900 text-white rounded hover:bg-gray-800"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="h-7 px-3 text-xs text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-gray-800">{user?.name || "Demo User"}</h2>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{user?.email || "user@example.com"}</p>
              <button
                onClick={copyPhoneNumber}
                className="inline-flex items-center gap-1.5 mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                <span className="font-mono">{phoneNumber}</span>
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 mt-4" />

      {/* Plan */}
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Plan</span>
          <span className="text-xs text-gray-700">Free</span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Messages</span>
            <span className="text-gray-700">24 / 100</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-400 rounded-full" style={{ width: "24%" }} />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Calls</span>
            <span className="text-gray-700">5 / 10</span>
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gray-400 rounded-full" style={{ width: "50%" }} />
          </div>
        </div>
        <button className="mt-4 w-full h-8 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50">
          Upgrade Plan
        </button>
      </div>

      <div className="border-t border-gray-100 pt-4 mt-4" />

      {/* Stats */}
      <div>
        <span className="text-xs text-gray-500">This month</span>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-800">156</p>
            <p className="text-xs text-gray-500">Sent</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-800">243</p>
            <p className="text-xs text-gray-500">Received</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-800">2.4m</p>
            <p className="text-xs text-gray-500">Avg. reply</p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 mt-4" />

      {/* Account */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between py-1">
          <span className="text-gray-500">Member since</span>
          <span className="text-gray-700">Jan 2024</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-gray-500">Account ID</span>
          <span className="text-gray-700 font-mono">{user?.id || "usr_demo123"}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-gray-500">Status</span>
          <span className="text-green-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            Active
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
