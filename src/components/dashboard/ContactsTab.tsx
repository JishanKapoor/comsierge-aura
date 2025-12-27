import { useState } from "react";
import {
  Search,
  Plus,
  Phone,
  MessageSquare,
  Star,
  MoreVertical,
  ArrowLeft,
  Trash2,
  Ban,
  Share2,
  Calendar,
  X,
  Camera,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { mockContacts } from "./mockData";
import { Contact } from "./types";

type Sort = "az" | "recent" | "favorites" | "groups";

const availableTags = ["Family", "Work", "Friend", "VIP", "Business", "School", "Gym", "Medical"];

const ContactsTab = () => {
  const [contacts, setContacts] = useState<Contact[]>(mockContacts);
  const [sort, setSort] = useState<Sort>("az");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
    isFavorite: false,
    tags: [] as string[],
    photo: "",
  });

  const allTags = [...new Set(contacts.flatMap(c => c.tags))];

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

  const openEditModal = (contact: Contact) => {
    const [firstName, ...lastNameParts] = contact.name.split(" ");
    setEditForm({
      firstName,
      lastName: lastNameParts.join(" "),
      phone: contact.phone,
      email: contact.email || "",
      notes: contact.notes || "",
      isFavorite: contact.isFavorite,
      tags: contact.tags,
      photo: "",
    });
    setSelectedContact(contact);
    setShowEditModal(true);
  };

  const openAddModal = () => {
    setEditForm({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      notes: "",
      isFavorite: false,
      tags: [],
      photo: "",
    });
    setShowAddModal(true);
  };

  const saveContact = () => {
    if (!editForm.firstName || !editForm.phone) {
      toast.error("Name and phone are required");
      return;
    }

    if (selectedContact) {
      setContacts(contacts.map((c) =>
        c.id === selectedContact.id
          ? {
              ...c,
              name: `${editForm.firstName} ${editForm.lastName}`.trim(),
              phone: editForm.phone,
              email: editForm.email || undefined,
              notes: editForm.notes || undefined,
              isFavorite: editForm.isFavorite,
              tags: editForm.tags,
            }
          : c
      ));
      toast.success("Contact updated");
    } else {
      const newContact: Contact = {
        id: `new-${Date.now()}`,
        name: `${editForm.firstName} ${editForm.lastName}`.trim(),
        phone: editForm.phone,
        email: editForm.email || undefined,
        notes: editForm.notes || undefined,
        isFavorite: editForm.isFavorite,
        tags: editForm.tags,
      };
      setContacts([...contacts, newContact]);
      toast.success("Contact added");
    }

    setShowEditModal(false);
    setShowAddModal(false);
    setSelectedContact(null);
  };

  const deleteContact = (contact: Contact) => {
    setContacts(contacts.filter((c) => c.id !== contact.id));
    toast.success("Contact deleted");
    setShowEditModal(false);
    setSelectedContact(null);
  };

  const toggleTag = (tag: string) => {
    if (editForm.tags.includes(tag)) {
      setEditForm({ ...editForm, tags: editForm.tags.filter((t) => t !== tag) });
    } else {
      setEditForm({ ...editForm, tags: [...editForm.tags, tag] });
    }
  };

  const ContactCard = ({ contact }: { contact: Contact }) => (
    <div className="flex items-center gap-3 p-3 hover:bg-secondary/30 rounded-xl transition-colors cursor-pointer">
      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <span className="text-foreground font-medium">{contact.name.charAt(0)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate text-sm">{contact.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
          {contact.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-secondary/50 text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); toast.success(`Calling ${contact.name}...`); }}>
          <Phone className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditModal(contact); }}>
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-foreground">Contacts</h2>
        <Button size="sm" className="gap-1.5 rounded-lg" onClick={openAddModal}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-border"
        />
      </div>

      {/* Sort & Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(["az", "favorites"] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 ${
              sort === s ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "az" ? "A-Z" : "Favorites"}
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => setShowTagFilter(!showTagFilter)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors shrink-0 ${
              filterTag ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground"
            }`}
          >
            <Tag className="w-3 h-3" />
            {filterTag || "Filter"}
          </button>
          {showTagFilter && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTagFilter(false)} />
              <div className="absolute left-0 top-full mt-1 w-32 bg-card border border-border rounded-xl shadow-xl z-50 py-1">
                <button
                  onClick={() => { setFilterTag(null); setShowTagFilter(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/50 ${!filterTag ? "text-foreground font-medium" : "text-muted-foreground"}`}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { setFilterTag(tag); setShowTagFilter(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-secondary/50 ${filterTag === tag ? "text-foreground font-medium" : "text-muted-foreground"}`}
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
      <div className="bg-card/30 border border-border/50 rounded-xl overflow-hidden">
        {favorites.length > 0 && (
          <div className="border-b border-border/30">
            <div className="px-4 py-2 flex items-center gap-2 text-amber-500">
              <Star className="w-4 h-4 fill-current" />
              <span className="text-xs font-medium uppercase tracking-wider">Favorites</span>
            </div>
            {favorites.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}

        {Object.entries(groupByLetter(others)).map(([letter, contactList]) => (
          <div key={letter}>
            <div className="px-4 py-1.5 bg-secondary/30">
              <span className="text-xs font-medium text-muted-foreground">{letter}</span>
            </div>
            {contactList.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        ))}

        {sortedContacts.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No contacts found</div>
        )}
      </div>

      {/* Edit Contact Modal */}
      {showEditModal && selectedContact && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowEditModal(false)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <span className="font-medium text-foreground text-sm">Edit Contact</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={saveContact}>Save</Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Photo */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-xl text-foreground">{editForm.firstName.charAt(0) || "?"}</span>
                  </div>
                  <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center">
                    <Camera className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">First Name</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 rounded-full text-xs transition-colors ${
                        editForm.tags.includes(tag) ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Add notes..."
                  className="w-full mt-1 px-2.5 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground resize-none h-12 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.isFavorite}
                  onChange={(e) => setEditForm({ ...editForm, isFavorite: e.target.checked })}
                  className="accent-foreground"
                />
                <Star className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-foreground">Favorite</span>
              </label>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" className="gap-1 text-xs rounded-lg" onClick={() => toast.success("Calling...")}>
                  <Phone className="w-3 h-3" /> Call
                </Button>
                <Button variant="outline" size="sm" className="gap-1 text-xs rounded-lg" onClick={() => toast.info("Opening chat...")}>
                  <MessageSquare className="w-3 h-3" /> Text
                </Button>
                <Button variant="outline" size="sm" className="gap-1 text-xs rounded-lg" onClick={() => toast.info("Schedule...")}>
                  <Calendar className="w-3 h-3" /> Schedule
                </Button>
              </div>

              <Button variant="destructive" size="sm" className="w-full gap-1 text-xs" onClick={() => deleteContact(selectedContact)}>
                <Trash2 className="w-3 h-3" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-border/50 shrink-0">
              <span className="font-medium text-foreground text-sm">Add Contact</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">First Name *</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Phone *</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full mt-1 px-2.5 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTags.slice(0, 6).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-2 py-1 rounded-full text-xs transition-colors ${
                        editForm.tags.includes(tag) ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 p-3 border-t border-border/50 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1 rounded-lg" onClick={saveContact}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsTab;