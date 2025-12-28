import { X, BookOpen, Keyboard, MessageCircle, HelpCircle, Send } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSupport: () => void;
}

interface HelpItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}

const HelpItem = ({ icon, title, description, onClick }: HelpItemProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-start gap-3 py-3 px-1 hover:bg-gray-50 rounded transition-colors text-left"
  >
    <div className="pt-0.5 text-gray-500">{icon}</div>
    <div className="flex-1 border-b border-gray-100 pb-3">
      <p className="text-sm text-gray-800 mb-0.5">{title}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  </button>
);

const HelpModal = ({ isOpen, onClose, onOpenSupport }: HelpModalProps) => {
  if (!isOpen) return null;

  const handleContactSupport = () => {
    onClose();
    onOpenSupport();
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
            <h2 className="text-sm font-semibold text-gray-800">Help & Feedback</h2>
            <button 
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-2">
            <HelpItem
              icon={<BookOpen className="w-4 h-4" />}
              title="User Guide"
              description="Learn about Comsierge's features"
              onClick={() => window.open("https://docs.comsierge.com", "_blank")}
            />
            <HelpItem
              icon={<Keyboard className="w-4 h-4" />}
              title="Keyboard shortcuts"
              description="Navigate faster with shortcuts"
              onClick={() => {}}
            />
            <HelpItem
              icon={<MessageCircle className="w-4 h-4" />}
              title="Join our community"
              description="Connect with other users"
              onClick={() => window.open("https://discord.gg/comsierge", "_blank")}
            />
            <HelpItem
              icon={<HelpCircle className="w-4 h-4" />}
              title="Contact support"
              description="Let us know if there's an issue"
              onClick={handleContactSupport}
            />
            <HelpItem
              icon={<Send className="w-4 h-4" />}
              title="Share feedback"
              description="Submit a feature request"
              onClick={handleContactSupport}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default HelpModal;
