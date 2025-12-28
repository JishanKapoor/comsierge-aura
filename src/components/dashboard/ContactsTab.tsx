import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Plus,
  Phone,
  MessageSquare,
  Star,
  MoreVertical,
  Trash2,
  Calendar,
  X,
  Camera,
  Tag,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mockContacts } from "./mockData";
import { Contact } from "./types";

type Sort = "az" | "favorites";

const availableTags = ["Family", "Work", "Friend", "VIP", "Business", "School", "Gym", "Medical"];

interface ContactsTabProps {
  onNavigate?: (tab: string, contactPhone?: string) => void;
}

const ContactsTab = ({ onNavigate }: ContactsTabProps) => {
  const [contacts, setContacts] = useState<Contact[]>(mockContacts);
  const [sort, setSort] = useState<Sort>("az");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    notes: "",
    isFavorite: false,
    tags: [] as string[],
  });

  const [customTagInput, setCustomTagInput] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);

  const allAvailableTags = [...new Set([...availableTags, ...customTags])];
  const allTags = [...new Set(contacts.flatMap(c => c.tags))];

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
      setOpenMenuId(null);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sortedContacts = [...contacts]
    .filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = !filterTag || c.tags.includes(filterTag);
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      if (sort === "az") return a.name.localeCompare(b.name);
      if (sort === "favorites") {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  const favorites = sortedContacts.filter((c) => c.isFavorite);
  const others = sortedContacts.filter((c) => !c.isFavorite);

  const groupByLetter = (contactList: Contact[]) => {
    const groups: Record<string, Contact[]> = {};
    contactList.forEach((c) => {
      const letter = c.name.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(c);
    });
    return groups;
  };

  const openModal = (contact?: Contact) => {
    if (contact) {
      // View existing contact
      setSelectedContact(contact);
      setIsEditing(false);
    } else {
      // Add new contact - go straight to edit mode
      setSelectedContact(null);
      setIsEditing(true);
      setEditForm({
        firstName: "",
        lastName: "",
        phone: "",
        notes: "",
        isFavorite: false,
        tags: [],
      });
    }
    setCustomTagInput("");
    setShowModal(true);
  };

  const startEditing = () => {
    if (selectedContact) {
      const [firstName, ...lastNameParts] = selectedContact.name.split(" ");
      setEditForm({
        firstName,
        lastName: lastNameParts.join(" "),
        phone: selectedContact.phone,
        notes: selectedContact.notes || "",
        isFavorite: selectedContact.isFavorite,
        tags: selectedContact.tags,
      });
    }
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (selectedContact) {
      // Go back to view mode
      setIsEditing(false);
    } else {
      // Was adding new contact, close modal
      setShowModal(false);
    }
  };

  const saveContact = () => {
    if (!editForm.firstName || !editForm.phone) {
      toast.error("Name and phone are required");
      return;
    }

    if (selectedContact) {
      // Update existing contact
      const updatedContact = {
        ...selectedContact,
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        phone: editForm.phone,
        notes: editForm.notes || undefined,
        isFavorite: editForm.isFavorite,
        tags: editForm.tags,
      };
      setContacts(contacts.map((c) =>
        c.id === selectedContact.id ? updatedContact : c
      ));
      setSelectedContact(updatedContact);
      toast.success("Contact updated");
      setIsEditing(false);
    } else {
      // Create new contact
      const newContact: Contact = {
        id: `new-${Date.now()}`,
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        phone: editForm.phone,
        notes: editForm.notes || undefined,
        isFavorite: editForm.isFavorite,
        tags: editForm.tags,
      };
      setContacts([...contacts, newContact]);
      setSelectedContact(newContact);
      toast.success("Contact added");
      setIsEditing(false);
    }
  };

  const deleteContact = (contactToDelete?: Contact) => {
    const target = contactToDelete || selectedContact;
    if (!target) return;
    setContacts(contacts.filter((c) => c.id !== target.id));
    toast.success("Contact deleted");
    if (showModal) {
      setShowModal(false);
      setSelectedContact(null);
    }
    setOpenMenuId(null);
  };

  const toggleFavorite = (contact: Contact) => {
    setContacts(contacts.map(c => 
      c.id === contact.id ? { ...c, isFavorite: !c.isFavorite } : c
    ));
    toast.success(contact.isFavorite ? "Removed from favorites" : "Added to favorites");
    setOpenMenuId(null);
  };

  const editContactFromList = (contact: Contact) => {
    openModal(contact);
    setIsEditing(true);
    const [firstName, ...lastNameParts] = contact.name.split(" ");
    setEditForm({
      firstName,
      lastName: lastNameParts.join(" "),
      phone: contact.phone,
      notes: contact.notes || "",
      isFavorite: contact.isFavorite,
      tags: contact.tags,
    });
    setOpenMenuId(null);
  };

  const toggleTag = (tag: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
  };

  return (
    <div className="space-y-3">
      {/* Actions */}
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5 h-7 text-xs rounded bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => openModal()}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 h-8 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-gray-300"
        />
      </div>

      {/* Sort & Filter */}
      <div className="flex gap-1.5">
        {(["az", "favorites"] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors",
              sort === s ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {s === "az" ? "A-Z" : "Favorites"}
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => setShowTagFilter(!showTagFilter)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors",
              filterTag ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"
            )}
          >
            <Tag className="w-3 h-3" />
            {filterTag || "Filter"}
          </button>
          {showTagFilter && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTagFilter(false)} />
              <div className="absolute left-0 top-full mt-1 w-28 bg-[#F9F9F9] border border-gray-200 rounded shadow-lg z-50 py-1">
                <button
                  onClick={() => { setFilterTag(null); setShowTagFilter(false); }}
                  className={cn("w-full text-left px-2.5 py-1.5 text-xs hover:bg-gray-50", !filterTag && "text-gray-800 font-medium")}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { setFilterTag(tag); setShowTagFilter(false); }}
                    className={cn("w-full text-left px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50", filterTag === tag && "text-gray-800 font-medium")}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contacts List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {favorites.length > 0 && (
          <div className="border-b border-gray-100">
            <div className="px-3 py-1.5 flex items-center gap-1.5 text-indigo-500">
              <Star className="w-3 h-3 fill-current" />
              <span className="text-xs font-medium uppercase tracking-wider">Favorites</span>
            </div>
            {favorites.map((contact) => (
              <div
                key={contact.id}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                onClick={() => openModal(contact)}
              >
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-gray-700 text-xs font-medium">{contact.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-xs truncate">{contact.name}</p>
                  <p className="text-xs text-gray-500 truncate">{contact.phone}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigate?.("inbox", contact.phone); }}
                    className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                    title="Send message"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigate?.("calls", contact.phone); }}
                    className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                    title="Call"
                  >
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <div className="relative" ref={openMenuId === contact.id ? menuRef : null}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === contact.id ? null : contact.id); }}
                      className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                      title="More options"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {openMenuId === contact.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px] z-20">
                        <button
                          onClick={(e) => { e.stopPropagation(); editContactFromList(contact); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteContact(contact); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {Object.entries(groupByLetter(others)).map(([letter, contactList]) => (
          <div key={letter}>
            <div className="px-3 py-1 bg-gray-50">
              <span className="text-xs font-medium text-gray-500">{letter}</span>
            </div>
            {contactList.map((contact) => (
              <div
                key={contact.id}
                onClick={() => openModal(contact)}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-gray-700 text-xs font-medium">{contact.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-xs truncate">{contact.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-xs text-gray-500 truncate">{contact.phone}</p>
                    {contact.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigate?.("inbox", contact.phone); }}
                    className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                    title="Send message"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onNavigate?.("calls", contact.phone); }}
                    className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                    title="Call"
                  >
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <div className="relative" ref={openMenuId === contact.id ? menuRef : null}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === contact.id ? null : contact.id); }}
                      className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                      title="More options"
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {openMenuId === contact.id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px] z-20">
                        <button
                          onClick={(e) => { e.stopPropagation(); editContactFromList(contact); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteContact(contact); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {sortedContacts.length === 0 && (
          <div className="p-6 text-center text-gray-400 text-xs">No contacts found</div>
        )}
      </div>

      {/* Contact Modal */}
      {showModal && createPortal(
        <div 
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-sm max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <span className="text-sm font-medium text-gray-800">
                {!selectedContact ? "New Contact" : isEditing ? "Edit Contact" : selectedContact.name}
              </span>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {/* VIEW MODE */}
              {selectedContact && !isEditing ? (
                <div className="p-4 space-y-4">
                  {/* Contact Avatar & Name */}
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                      <span className="text-2xl text-gray-700">{selectedContact.name.charAt(0)}</span>
                    </div>
                    <h3 className="text-base font-medium text-gray-800">{selectedContact.name}</h3>
                    <p className="text-sm text-gray-500">{selectedContact.phone}</p>
                    {selectedContact.isFavorite && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-500">
                        <Star className="w-3 h-3 fill-current" /> Favorite
                      </span>
                    )}
                  </div>

                  {/* Quick Action Buttons - [Call] [Message] */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => { setShowModal(false); onNavigate?.("calls", selectedContact.phone); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <Phone className="w-4 h-4 text-gray-700" />
                      <span className="text-sm font-medium text-gray-700">Call</span>
                    </button>
                    <button
                      onClick={() => { setShowModal(false); onNavigate?.("inbox", selectedContact.phone); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-gray-700" />
                      <span className="text-sm font-medium text-gray-700">Message</span>
                    </button>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    {selectedContact.tags.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Tags</label>
                        <div className="flex flex-wrap gap-1">
                          {selectedContact.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedContact.notes && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Notes</label>
                        <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded">{selectedContact.notes}</p>
                      </div>
                    )}
                    {selectedContact.lastMessage && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Last message</span>
                        <span className="text-gray-700">{selectedContact.lastMessage}</span>
                      </div>
                    )}
                    {selectedContact.lastCall && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Last call</span>
                        <span className="text-gray-700">{selectedContact.lastCall}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* EDIT MODE */
                <div className="p-4 space-y-3">
                  {/* Photo */}
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-lg text-gray-700">{editForm.firstName.charAt(0) || "?"}</span>
                      </div>
                      <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center">
                        <Camera className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">First Name *</label>
                      <input
                        type="text"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Last Name</label>
                      <input
                        type="text"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-indigo-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Phone *</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-indigo-300"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">Tags (select multiple)</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {allAvailableTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={cn(
                            "px-2 py-0.5 rounded text-xs transition-colors",
                            editForm.tags.includes(tag) ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          )}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                    {/* Custom tag input */}
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        placeholder="Add custom tag..."
                        className="flex-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-indigo-300"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && customTagInput.trim()) {
                            e.preventDefault();
                            const newTag = customTagInput.trim();
                            if (!allAvailableTags.includes(newTag)) {
                              setCustomTags([...customTags, newTag]);
                            }
                            if (!editForm.tags.includes(newTag)) {
                              setEditForm({ ...editForm, tags: [...editForm.tags, newTag] });
                            }
                            setCustomTagInput("");
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customTagInput.trim()) {
                            const newTag = customTagInput.trim();
                            if (!allAvailableTags.includes(newTag)) {
                              setCustomTags([...customTags, newTag]);
                            }
                            if (!editForm.tags.includes(newTag)) {
                              setEditForm({ ...editForm, tags: [...editForm.tags, newTag] });
                            }
                            setCustomTagInput("");
                          }
                        }}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Notes</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Add notes..."
                      className="w-full mt-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 resize-none h-14 focus:outline-none focus:border-indigo-300"
                    />
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <Star className={cn("w-4 h-4", editForm.isFavorite ? "text-indigo-500 fill-indigo-500" : "text-gray-400")} />
                    <span className="text-xs text-gray-700">Mark as favorite</span>
                    <input
                      type="checkbox"
                      checked={editForm.isFavorite}
                      onChange={(e) => setEditForm({ ...editForm, isFavorite: e.target.checked })}
                      className="sr-only"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 shrink-0">
              {isEditing ? (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" 
                    onClick={cancelEditing}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" 
                    onClick={saveContact}
                  >
                    Save
                  </Button>
                </div>
              ) : selectedContact && (
                <Button 
                  variant="outline" 
                  className="w-full h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" 
                  onClick={startEditing}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Contact
                </Button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ContactsTab;
