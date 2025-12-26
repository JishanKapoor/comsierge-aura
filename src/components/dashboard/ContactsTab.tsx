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
    <div className="flex items-center gap-3 p-3 hover:bg-secondary/30 rounded-xl transition-colors cursor-pointer">
      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <span className="text-foreground font-medium">{contact.name.charAt(0)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate text-sm">{contact.name}</p>
        <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.success(`Calling ${contact.name}...`)}>
          <Phone className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex" onClick={() => toast.info("Opening chat...")}>
          <MessageSquare className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(contact)}>
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
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Contact</span>
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

      {/* Sort */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(["az", "recent", "favorites", "groups"] as Sort[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 ${
              sort === s
                ? "bg-foreground text-background"
                : "bg-secondary/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "az" ? "A-Z" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Contacts List */}
      <div className="bg-card/30 border border-border/50 rounded-xl overflow-hidden">
        {/* Favorites Section */}
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

        {/* Other Contacts Grouped by Letter */}
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

      {/* Edit/View Contact Modal */}
      {showEditModal && selectedContact && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-card">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowEditModal(false)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h3 className="font-medium text-foreground truncate">{selectedContact.name}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => saveContact()}>
                Save
              </Button>
            </div>
            
            <div className="p-5 space-y-5">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-2">
                  <span className="text-2xl text-foreground">{selectedContact.name.charAt(0)}</span>
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">First Name</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Last Name</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-border"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Phone Number</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Email (optional)</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tags</label>
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
                        className={`px-3 py-1 rounded-full text-xs transition-colors ${
                          editForm.tags.includes(tag)
                            ? "bg-foreground text-background"
                            : "bg-secondary/50 text-muted-foreground"
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
                    className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm placeholder:text-muted-foreground resize-none h-16 focus:outline-none focus:border-border"
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
                  <span className="text-sm text-foreground">Add to Favorites</span>
                </label>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => toast.success(`Calling...`)}>
                    <Phone className="w-3.5 h-3.5" /> Call
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => toast.info("Opening chat...")}>
                    <MessageSquare className="w-3.5 h-3.5" /> Message
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => toast.info("Schedule call...")}>
                    <Calendar className="w-3.5 h-3.5" /> Schedule
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => toast.info("Share...")}>
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={() => toast.info("Block...")}>
                  <Ban className="w-3.5 h-3.5" /> Block Contact
                </Button>
              </div>

              {/* Delete Button */}
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-2"
                onClick={() => deleteContact(selectedContact)}
              >
                <Trash2 className="w-4 h-4" /> Delete Contact
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-card">
              <h3 className="font-medium text-foreground">Add Contact</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAddModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">First Name *</label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-border"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Last Name</label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-border"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone Number *</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email (optional)</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none focus:border-border"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <Button variant="outline" className="flex-1 rounded-lg" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1 rounded-lg" onClick={saveContact}>
                  Save Contact
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
