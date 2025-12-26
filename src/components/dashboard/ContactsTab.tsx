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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { mockContacts } from "./mockData";
import { Contact } from "./types";

type Sort = "az" | "recent" | "favorites" | "groups";

const ContactsTab = () => {
  const [contacts, setContacts] = useState<Contact[]>(mockContacts);
  const [sort, setSort] = useState<Sort>("az");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    notes: "",
    isFavorite: false,
    tags: [] as string[],
  });

  const sortedContacts = [...contacts]
    .filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase())
    )
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

  const ContactCard = ({ contact }: { contact: Contact }) => (
    <div className="linear-list-item group">
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
        <span className="text-foreground text-sm font-medium">{contact.name.charAt(0)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">{contact.name}</p>
        <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); toast.success(`Calling ${contact.name}...`); }}>
          <Phone className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); toast.info("Opening chat..."); }}>
          <MessageSquare className="w-4 h-4" />
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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Contacts</h2>
        <Button size="sm" className="gap-1.5 h-8" onClick={openAddModal}>
          <Plus className="w-3.5 h-3.5" /> Add
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
          className="linear-input pl-9"
        />
      </div>

      {/* Sort */}
      <div className="flex gap-2 flex-wrap">
        {(["az", "recent", "favorites", "groups"] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`linear-btn ${
              sort === s ? "linear-btn-active" : "linear-btn-ghost"
            }`}
          >
            {s === "az" ? "A-Z" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Contacts List */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Favorites Section */}
        {favorites.length > 0 && (
          <div className="border-b border-border">
            <div className="px-3 py-2 flex items-center gap-2 bg-muted/50">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Favorites</span>
            </div>
            {favorites.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}

        {/* Other Contacts Grouped by Letter */}
        {Object.entries(groupByLetter(others)).map(([letter, contactList]) => (
          <div key={letter}>
            <div className="px-3 py-1.5 bg-muted/30">
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

      {/* Edit/View Contact Modal */}
      {showEditModal && selectedContact && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowEditModal(false)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h3 className="font-medium text-foreground">{selectedContact.name}</h3>
              </div>
              <Button size="sm" onClick={() => saveContact()}>
                Save
              </Button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-2">
                  <span className="text-2xl text-foreground">{selectedContact.name.charAt(0)}</span>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">First Name</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="linear-input mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="linear-input mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="linear-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="linear-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {["Family", "Work", "Friend"].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (editForm.tags.includes(tag)) {
                            setEditForm({ ...editForm, tags: editForm.tags.filter((t) => t !== tag) });
                          } else {
                            setEditForm({ ...editForm, tags: [...editForm.tags, tag] });
                          }
                        }}
                        className={`px-2 py-1 rounded text-xs transition-colors ${
                          editForm.tags.includes(tag)
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Notes</label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Add notes..."
                    className="linear-input mt-1 resize-none h-16"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.isFavorite}
                    onChange={(e) => setEditForm({ ...editForm, isFavorite: e.target.checked })}
                    className="accent-foreground"
                  />
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-foreground">Favorite</span>
                </label>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Actions</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success(`Calling ${selectedContact.name}...`)}>
                    <Phone className="w-3.5 h-3.5" /> Call
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Opening chat...")}>
                    <MessageSquare className="w-3.5 h-3.5" /> Message
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Share contact...")}>
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Schedule call...")}>
                    <Calendar className="w-3.5 h-3.5" /> Schedule
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Block contact...")}>
                    <Ban className="w-3.5 h-3.5" /> Block
                  </Button>
                </div>
              </div>

              {/* Delete Button */}
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => deleteContact(selectedContact)}
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Contact
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-lg w-full max-w-md p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-foreground">Add Contact</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">First Name *</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="linear-input mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="linear-input mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Phone Number *</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="linear-input mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="linear-input mt-1"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={() => saveContact()}>
                  Add Contact
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsTab;
