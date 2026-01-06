import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Search,
  Tag,
  ChevronRight,
  MessageSquare,
  Phone,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  Star,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { isValidUsPhoneNumber } from "@/lib/validations";
import { Contact } from "./types";
import { fetchContacts, createContact as createContactApi, updateContact as updateContactApi, deleteContact as deleteContactApi } from "./contactsApi";
import { useAuth } from "@/contexts/AuthContext";
import { ContactSkeleton } from "./LoadingSkeletons";

type View = "all" | "favorites";

const availableTags = ["Family", "Work", "Friend", "VIP", "Business", "School", "Gym", "Medical"];

interface ContactsTabProps {
  onNavigate?: (tab: string, contactPhone?: string) => void;
}

const ContactsTab = ({ onNavigate }: ContactsTabProps) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
    avatar: "" as string,
  });

  const [customTagInput, setCustomTagInput] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [showAddTagInFilter, setShowAddTagInFilter] = useState(false);
  const [newFilterTag, setNewFilterTag] = useState("");
  const filterTagInputRef = useRef<HTMLInputElement>(null);

  const allAvailableTags = [...new Set([...availableTags, ...customTags])];
  const allTags = [...new Set(contacts.flatMap(c => c.tags))];
  const filterTags = [...new Set([...availableTags, ...customTags, ...allTags])];

  const customTagsStorageKey = `comsierge.contacts.customTags.${user?.id || user?.email || "anon"}`;

  // Load persisted custom tags (per user)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(customTagsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCustomTags(parsed.filter((t) => typeof t === "string" && t.trim().length > 0));
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customTagsStorageKey]);

  // Persist custom tags (per user)
  useEffect(() => {
    try {
      localStorage.setItem(customTagsStorageKey, JSON.stringify(customTags));
    } catch {
      // ignore
    }
  }, [customTags, customTagsStorageKey]);

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

  // Reusable function to load contacts from API
  const loadContacts = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await fetchContacts();
      setContacts(data);
    } catch (error) {
      console.error("Error loading contacts:", error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Fetch contacts from API on mount
  useEffect(() => {
    loadContacts(true);
  }, [loadContacts]);

  // Poll for contact updates every 15 seconds (silent refresh)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadContacts(false);
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [loadContacts]);

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

  const visibleContacts = [...contacts]
    .filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q);
      const matchesView = view === "favorites" ? c.isFavorite : true;
      const matchesTags = selectedTags.length === 0 || selectedTags.some((t) => c.tags.includes(t));
      return matchesSearch && matchesView && matchesTags;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const filterLabel = selectedTags.length === 0
    ? "Filter"
    : selectedTags.length === 1
      ? selectedTags[0]
      : `${selectedTags[0]} +${selectedTags.length - 1}`;

  const toggleSelectedTag = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleAddFilterTag = () => {
    const tag = newFilterTag.trim();
    if (!tag) return;

    const normalized = tag.toLowerCase();
    const exists = filterTags.some((t) => t.toLowerCase() === normalized);
    if (exists) {
      toast.error("Tag already exists");
      return;
    }

    setCustomTags((prev) => [...prev, tag]);
    setSelectedTags((prev) => (prev.includes(tag) ? prev : [...prev, tag])); // Auto-select the new tag
    setNewFilterTag("");

    // Keep the add UI open for fast entry (e.g. adding many tags)
    setShowAddTagInFilter(true);
    setTimeout(() => filterTagInputRef.current?.focus(), 0);

    toast.success(`Tag "${tag}" added`);
  };

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
        avatar: "",
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
        avatar: selectedContact.avatar || "",
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

  const saveContact = async () => {
    if (!editForm.firstName.trim()) {
      toast.error("Name is required");
      return;
    }
    
    if (!editForm.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    if (!isValidUsPhoneNumber(editForm.phone)) {
      toast.error("Invalid phone number. Enter 10 digits (with optional +1).");
      return;
    }

    if (selectedContact) {
      // Update existing contact via API
      const updates = {
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        phone: editForm.phone,
        notes: editForm.notes || undefined,
        isFavorite: editForm.isFavorite,
        tags: editForm.tags,
        avatar: editForm.avatar || undefined,
      };
      const { success, error } = await updateContactApi(selectedContact.id, updates);
      if (success) {
        const updatedContact = { ...selectedContact, ...updates };
        setContacts(contacts.map((c) =>
          c.id === selectedContact.id ? updatedContact : c
        ));
        setSelectedContact(updatedContact);
        toast.success("Contact updated");
        setIsEditing(false);
      } else {
        toast.error(error || "Failed to update contact");
      }
    } else {
      // Create new contact via API
      const contactData = {
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        phone: editForm.phone,
        notes: editForm.notes || undefined,
        isFavorite: editForm.isFavorite,
        tags: editForm.tags,
        avatar: editForm.avatar || undefined,
      };
      const { contact: newContact, error } = await createContactApi(contactData);
      if (newContact) {
        setContacts([...contacts, newContact]);
        setSelectedContact(newContact);
        toast.success("Contact added");
        setIsEditing(false);
      } else {
        toast.error(error || "Failed to create contact");
      }
    }
  };

  const deleteContact = async (contactToDelete?: Contact) => {
    const target = contactToDelete || selectedContact;
    if (!target) return;
    const success = await deleteContactApi(target.id);
    if (success) {
      setContacts(contacts.filter((c) => c.id !== target.id));
      toast.success("Contact deleted");
      if (showModal) {
        setShowModal(false);
        setSelectedContact(null);
      }
    } else {
      toast.error("Failed to delete contact");
    }
    setOpenMenuId(null);
  };

  const toggleFavorite = async (contact: Contact) => {
    const { success, error } = await updateContactApi(contact.id, { isFavorite: !contact.isFavorite });
    if (success) {
      setContacts(contacts.map(c => 
        c.id === contact.id ? { ...c, isFavorite: !c.isFavorite } : c
      ));
      toast.success(contact.isFavorite ? "Removed from favorites" : "Added to favorites");
    } else {
      toast.error(error || "Failed to update favorite status");
    }
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
      avatar: contact.avatar || "",
    });
    setOpenMenuId(null);
  };

  const toggleTag = (tag: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
  };

  const deleteTagGlobally = async (tag: string) => {
    // Remove the tag from custom tags if it's a custom one
    setCustomTags(prev => prev.filter(t => t !== tag));
    
    // Update all contacts that have this tag via API
    const contactsWithTag = contacts.filter(c => c.tags.includes(tag));
    for (const contact of contactsWithTag) {
      await updateContactApi(contact.id, { tags: contact.tags.filter(t => t !== tag) });
    }
    
    // Update local state
    setContacts(prev => prev.map(c => ({
      ...c,
      tags: c.tags.filter(t => t !== tag)
    })));
    // Remove from selected tags filter
    setSelectedTags(prev => prev.filter(t => t !== tag));
    // Remove from current edit form if open
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
    toast.success(`Tag "${tag}" deleted from all contacts`);
    setTagToDelete(null);
  };

  return (
    <div className="space-y-3">
      {/* Search + Add button */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-8 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs placeholder:text-gray-400 focus:outline-none focus:border-gray-300"
          />
        </div>
        <Button size="sm" className="gap-1.5 h-8 text-xs rounded bg-indigo-500 hover:bg-indigo-600 text-white shrink-0" onClick={() => openModal()}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
      </div>

      {/* Sort & Filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* All / Favorites tabs */}
        <button
          onClick={() => {
            setView("all");
            setSelectedTags([]);
          }}
          className={cn(
            "px-2.5 py-1 rounded text-xs font-medium transition-colors",
            view === "all" && selectedTags.length === 0
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          All
        </button>
        <button
          onClick={() => {
            if (view === "favorites") {
              setView("all");
            } else {
              setView("favorites");
            }
          }}
          className={cn(
            "px-2.5 py-1 rounded text-xs font-medium transition-colors",
            view === "favorites" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          Favorites
        </button>

        {/* Filter dropdown toggle */}
        <button
          onClick={() => setShowTagFilter(!showTagFilter)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors",
            selectedTags.length > 0 ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          <Tag className="w-3 h-3" />
          {filterLabel}
          <ChevronRight className={cn("w-3 h-3 transition-transform", showTagFilter ? "rotate-90" : "rotate-0")} />
        </button>

        {/* Tag chips */}
        {showTagFilter && (
          <div className="flex items-center gap-1.5">
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto">
              {filterTags.map((tag) => {
                const canDelete = !availableTags.includes(tag);
                const isSelected = selectedTags.includes(tag);

                if (!canDelete) {
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleSelectedTag(tag)}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap",
                        isSelected ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {tag}
                    </button>
                  );
                }

                return (
                  <div key={tag} className="flex items-center gap-0.5">
                    <button
                      onClick={() => toggleSelectedTag(tag)}
                      className={cn(
                        "px-2.5 py-1 rounded-l text-xs transition-colors whitespace-nowrap",
                        isSelected ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {tag}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTagToDelete(tag);
                      }}
                      className={cn(
                        "px-1 py-1 rounded-r text-xs transition-colors flex items-center justify-center",
                        isSelected
                          ? "bg-gray-900 text-white/70 hover:text-white hover:bg-gray-950"
                          : "bg-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-300"
                      )}
                      title="Delete tag permanently"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              
              {/* Add new tag */}
              {showAddTagInFilter ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={filterTagInputRef}
                    type="text"
                    value={newFilterTag}
                    onChange={(e) => setNewFilterTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddFilterTag();
                      if (e.key === "Escape") {
                        setShowAddTagInFilter(false);
                        setNewFilterTag("");
                      }
                    }}
                    placeholder="Add tag"
                    className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                    autoFocus
                  />
                  <button
                    onClick={handleAddFilterTag}
                    className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setShowAddTagInFilter(false);
                      setNewFilterTag("");
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowAddTagInFilter(true);
                    setTimeout(() => filterTagInputRef.current?.focus(), 0);
                  }}
                  className="flex items-center justify-center w-6 h-6 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                  title="Add new tag"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
              
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contacts List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-visible">
        {loading && contacts.length === 0 ? (
          <div className="divide-y divide-gray-100">
            {/* Letter header skeleton */}
            <div className="px-3 py-1 bg-gray-50">
              <div className="w-4 h-3 bg-gray-200 rounded animate-pulse" />
            </div>
            {[...Array(4)].map((_, i) => (
              <ContactSkeleton key={i} />
            ))}
            {/* Another letter */}
            <div className="px-3 py-1 bg-gray-50">
              <div className="w-4 h-3 bg-gray-200 rounded animate-pulse" />
            </div>
            {[...Array(3)].map((_, i) => (
              <ContactSkeleton key={`b-${i}`} />
            ))}
          </div>
        ) : Object.entries(groupByLetter(visibleContacts)).length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            {contacts.length === 0 ? "No contacts yet. Add your first contact!" : "No contacts match your search."}
          </div>
        ) : (
          Object.entries(groupByLetter(visibleContacts)).map(([letter, contactList]) => (
          <div key={letter}>
            <div className="px-3 py-1 bg-gray-50">
              <span className="text-xs font-medium text-gray-500">{letter}</span>
            </div>
            {contactList.map((contact) => (
              <div
                key={contact.id}
                onClick={() => openModal(contact)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left cursor-pointer relative border-b border-gray-100 last:border-b-0",
                  openMenuId === contact.id && "z-30"
                )}
              >
                {contact.avatar ? (
                  <img 
                    src={contact.avatar} 
                    alt={contact.name} 
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <span className="text-gray-700 text-xs font-medium">{contact.name.charAt(0)}</span>
                  </div>
                )}
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
                      <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px] z-[60]">
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
        ))
        )}

        {!loading && visibleContacts.length === 0 && contacts.length > 0 && (
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
            
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {/* VIEW MODE */}
              {selectedContact && !isEditing ? (
                <div className="p-4 space-y-4">
                  {/* Contact Avatar & Name */}
                  <div className="flex flex-col items-center text-center">
                    {selectedContact.avatar ? (
                      <img 
                        src={selectedContact.avatar} 
                        alt={selectedContact.name} 
                        className="w-16 h-16 rounded-full object-cover mb-2"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                        <span className="text-2xl text-gray-700">{selectedContact.name.charAt(0)}</span>
                      </div>
                    )}
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
                      {editForm.avatar ? (
                        <img 
                          src={editForm.avatar} 
                          alt="Contact" 
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-lg text-gray-700">{editForm.firstName.charAt(0) || "?"}</span>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={photoInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setEditForm({ ...editForm, avatar: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <button 
                        onClick={() => photoInputRef.current?.click()}
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 transition-colors"
                      >
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
                    <label className="text-xs text-gray-500 mb-1.5 block">Tags (click X to delete)</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {allAvailableTags.map((tag) => (
                        <div key={tag} className="flex items-center gap-0.5">
                          <button
                            onClick={() => toggleTag(tag)}
                            className={cn(
                              "px-2 py-1 rounded text-xs transition-colors",
                              editForm.tags.includes(tag) ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                          >
                            {tag}
                            {editForm.tags.includes(tag) && (
                              <X className="w-3 h-3 ml-1 inline-block" />
                            )}
                          </button>
                        </div>
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

      {/* Delete Tag Confirmation Modal */}
      {tagToDelete && createPortal(
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[10000] p-4"
          onClick={() => setTagToDelete(null)}
        >
          <div 
            className="bg-[#F5F5F5] rounded-lg shadow-lg w-full max-w-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-sm font-medium">Delete Tag</h3>
              </div>
              <p className="text-xs text-gray-600">
                Are you sure you want to delete the tag "<span className="font-medium">{tagToDelete}</span>"? 
                This will remove it from all contacts.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 h-8 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  onClick={() => setTagToDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-8 text-xs bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => deleteTagGlobally(tagToDelete)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ContactsTab;
