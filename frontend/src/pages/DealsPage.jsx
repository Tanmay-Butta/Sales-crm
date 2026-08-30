import { useState, useEffect } from "react";
import { 
  Handshake, Plus, Edit2, Trash2, Users, History, AlertCircle, Building2, User as UserIcon, UserPlus, Trash
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { dealsAPI } from "../api/deals";
import { companiesAPI } from "../api/companies";
import { authAPI } from "../api/auth";

export default function DealsPage() {
  const { user, isManager } = useAuth();
  
  const [deals, setDeals] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    value: "",
    expected_close_date: "",
    company_id: "",
    owner_id: ""
  });
  const [submitting, setSubmitting] = useState(false);

  // Collaborators Modal state
  const [collabModalDeal, setCollabModalDeal] = useState(null);
  const [selectedRepId, setSelectedRepId] = useState("");
  const [collabLoading, setCollabLoading] = useState(false);

  // History / Audit Trail Modal state
  const [historyModalDeal, setHistoryModalDeal] = useState(null);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [isManager]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dealsRes, companiesRes, repsRes] = await Promise.all([
        dealsAPI.getDeals(),
        companiesAPI.getCompanies(),
        authAPI.getReps()
      ]);
      
      setDeals(dealsRes.data.deals);
      setCompanies(companiesRes.data.companies.filter(c => !c.archived_at));
      setReps(repsRes.data.users);
    } catch (err) {
      toast.error("Failed to load deals data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = () => {
    if (companies.length === 0) {
      toast.error("You must create a company first before adding a deal.");
      return;
    }
    setEditingDeal(null);
    setFormData({
      title: "",
      value: "",
      expected_close_date: "",
      company_id: "",
      owner_id: ""
    });
    setIsModalOpen(true);
  };

  const openEditModal = (deal) => {
    setEditingDeal(deal);
    setFormData({
      title: deal.title,
      value: deal.value,
      expected_close_date: deal.expected_close_date,
      company_id: deal.company_id,
      owner_id: deal.owner_id
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDeal(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const payload = { ...formData };
      payload.company_id = parseInt(payload.company_id, 10);
      payload.value = parseFloat(payload.value);
      
      if (!isManager) delete payload.owner_id;
      else if (payload.owner_id) payload.owner_id = parseInt(payload.owner_id, 10);

      if (editingDeal) {
        const updatePayload = {
          title: payload.title,
          value: payload.value,
          expected_close_date: payload.expected_close_date
        };
        if (isManager && payload.owner_id) {
           updatePayload.owner_id = payload.owner_id;
        }
        await dealsAPI.updateDeal(editingDeal.id, updatePayload);
        toast.success("Deal updated successfully");
      } else {
        await dealsAPI.createDeal(payload);
        toast.success("Deal created successfully");
      }
      
      closeModal();
      fetchData();
    } catch (err) {
      const message = err.response?.data?.error?.message || "Failed to save deal";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this deal?")) return;
    
    try {
      await dealsAPI.deleteDeal(id);
      toast.success("Deal deleted");
      fetchData();
    } catch (err) {
      const message = err.response?.data?.error?.message || "Failed to delete deal";
      toast.error(message);
    }
  };

  // Collaborators Management
  const openCollaboratorsModal = (deal) => {
    setCollabModalDeal(deal);
    setSelectedRepId("");
  };

  const handleAddCollaborator = async (e) => {
    e.preventDefault();
    if (!selectedRepId) return;

    setCollabLoading(true);
    try {
      await dealsAPI.addCollaborator(collabModalDeal.id, parseInt(selectedRepId, 10));
      toast.success("Collaborator added successfully");
      setSelectedRepId("");
      
      const updatedDealRes = await dealsAPI.getDeal(collabModalDeal.id);
      setCollabModalDeal(updatedDealRes.data.deal);
      fetchData();
    } catch (err) {
      const message = err.response?.data?.error?.message || "Failed to add collaborator";
      toast.error(message);
    } finally {
      setCollabLoading(false);
    }
  };

  const handleRemoveCollaborator = async (userId) => {
    if (!window.confirm("Remove this collaborator from the deal?")) return;
    
    setCollabLoading(true);
    try {
      await dealsAPI.removeCollaborator(collabModalDeal.id, userId);
      toast.success("Collaborator removed");
      
      const updatedDealRes = await dealsAPI.getDeal(collabModalDeal.id);
      setCollabModalDeal(updatedDealRes.data.deal);
      fetchData();
    } catch (err) {
      const message = err.response?.data?.error?.message || "Failed to remove collaborator";
      toast.error(message);
    } finally {
      setCollabLoading(false);
    }
  };

  // History / Audit Trail
  const openHistoryModal = async (deal) => {
    setHistoryModalDeal(deal);
    setHistoryLoading(true);
    try {
      const res = await dealsAPI.getHistory(deal.id);
      setHistoryEvents(res.data.history);
    } catch (err) {
      toast.error("Failed to load deal audit trail");
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(val);
  };

  const getStageBadge = (stage) => {
    const colors = {
      NEW: 'badge-blue',
      QUALIFIED: 'badge-purple',
      PROPOSAL: 'badge-orange',
      NEGOTIATION: 'badge-yellow',
      WON: 'badge-green',
      LOST: 'badge-red'
    };
    return `badge ${colors[stage] || 'badge-gray'}`;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>All Deals</h2>
          <p className="text-muted">Manage your sales pipeline across all visible companies</p>
        </div>
        
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} /> New Deal
          </button>
        </div>
      </div>

      <div className="card table-container">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading deals...</div>
        ) : deals.length === 0 ? (
          <div className="empty-state">
            <Handshake size={48} className="text-muted mb-4" />
            <h3>No deals found</h3>
            <p className="text-muted">Get started by creating a new deal in the pipeline.</p>
            <button className="btn btn-primary mt-4" onClick={openNewModal}>
              Create First Deal
            </button>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>TITLE</th>
                <th>COMPANY</th>
                <th>VALUE</th>
                <th>CLOSE DATE</th>
                <th>STAGE</th>
                <th>OWNER / TEAM</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => {
                const isOwner = deal.owner_id === user.id;
                const isCollab = deal.collaborators?.some(c => c.id === user.id);
                const canEdit = isManager || isOwner || isCollab;
                const canManageCollabs = isManager || isOwner;
                const canDelete = isManager || isOwner;
                
                return (
                  <tr key={deal.id}>
                    <td className="font-medium text-white">{deal.title}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-muted" />
                        {deal.company?.name || "Unknown"}
                      </div>
                    </td>
                    <td className="font-medium">{formatCurrency(deal.value)}</td>
                    <td>{new Date(deal.expected_close_date).toLocaleDateString()}</td>
                    <td>
                      <span className={getStageBadge(deal.stage)}>
                        {deal.stage}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div className="flex items-center gap-2 text-sm">
                          <UserIcon size={12} className="text-muted" />
                          <span>{deal.owner?.full_name || "Unknown"}</span>
                          {isOwner && <span className="badge badge-green text-xs" style={{ padding: '1px 4px', fontSize: '10px' }}>Owner</span>}
                          {isCollab && <span className="badge badge-purple text-xs" style={{ padding: '1px 4px', fontSize: '10px' }}>Collaborator</span>}
                        </div>
                        {deal.collaborators && deal.collaborators.length > 0 && (
                          <div className="text-xs text-muted" title={deal.collaborators.map(c => c.full_name).join(', ')}>
                            👥 {deal.collaborators.length} collaborator{deal.collaborators.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Deal (Manager, Owner, or Collaborator) */}
                        {canEdit ? (
                          <button 
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEditModal(deal)}
                            title="Edit Deal Details"
                          >
                            <Edit2 size={16} />
                          </button>
                        ) : (
                          <span className="text-muted text-xs" title="You don't have permission to edit this deal">
                            <AlertCircle size={16} />
                          </span>
                        )}

                        {/* Manage Collaborators (Manager or Owner only) */}
                        {canManageCollabs && (
                          <button 
                            className="btn btn-ghost btn-sm text-primary"
                            onClick={() => openCollaboratorsModal(deal)}
                            title="Manage Collaborators"
                          >
                            <Users size={16} />
                          </button>
                        )}

                        {/* View Audit Trail Timeline */}
                        <button 
                          className="btn btn-ghost btn-sm"
                          onClick={() => openHistoryModal(deal)}
                          title="View Deal Timeline"
                        >
                          <History size={16} />
                        </button>

                        {/* Delete Deal (Manager or Owner only) */}
                        {canDelete && (
                          <button 
                            className="btn btn-ghost btn-sm text-red"
                            onClick={() => handleDelete(deal.id)}
                            title="Delete Deal"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editingDeal ? "Edit Deal" : "New Deal"}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                
                <div className="form-group">
                  <label className="form-label">Deal Title *</label>
                  <input
                    type="text"
                    name="title"
                    className="form-input"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g. Enterprise License Q3"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Value ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="value"
                    className="form-input"
                    value={formData.value}
                    onChange={handleInputChange}
                    required
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Expected Close Date *</label>
                  <input
                    type="date"
                    name="expected_close_date"
                    className="form-input"
                    value={formData.expected_close_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                {!editingDeal && (
                  <div className="form-group">
                    <label className="form-label">Company *</label>
                    <select name="company_id" className="form-select"
                      value={formData.company_id}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select a company...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {isManager && (
                  <div className="form-group">
                    <label className="form-label">Assign Sales Rep Owner *</label>
                    <select
                      name="owner_id"
                      className="form-select"
                      value={formData.owner_id}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select a rep...</option>
                      {reps.map(r => (
                        <option key={r.id} value={r.id}>{r.full_name}</option>
                      ))}
                    </select>
                    <p className="form-hint">Managers cannot own deals. You must assign a Sales Rep.</p>
                  </div>
                )}
                
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Deal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collaborators Management Modal */}
      {collabModalDeal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCollabModalDeal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3>Manage Collaborators</h3>
                <p className="text-muted text-xs mt-1">{collabModalDeal.title}</p>
              </div>
              <button className="modal-close" onClick={() => setCollabModalDeal(null)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div className="mb-4">
                <label className="form-label text-xs text-muted">PRIMARY OWNER</label>
                <div style={{ padding: '8px 12px', background: 'var(--color-bg)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserIcon size={16} className="text-primary" />
                  <span className="font-medium text-white">{collabModalDeal.owner?.full_name}</span>
                  <span className="badge badge-green ml-auto">Owner</span>
                </div>
              </div>

              {/* Add Collaborator Form */}
              <form onSubmit={handleAddCollaborator} style={{ marginBottom: '20px' }}>
                <label className="form-label">Add Sales Rep Collaborator</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select 
                    className="form-select"
                    value={selectedRepId}
                    onChange={(e) => setSelectedRepId(e.target.value)}
                    required
                  >
                    <option value="">Select a sales rep...</option>
                    {reps
                      .filter(r => r.id !== collabModalDeal.owner_id && !collabModalDeal.collaborators?.some(c => c.id === r.id))
                      .map(rep => (
                        <option key={rep.id} value={rep.id}>{rep.full_name} ({rep.email})</option>
                      ))}
                  </select>
                  <button type="submit" className="btn btn-primary" disabled={collabLoading || !selectedRepId}>
                    <UserPlus size={16} /> Add
                  </button>
                </div>
              </form>

              {/* Active Collaborators List */}
              <div>
                <label className="form-label text-xs text-muted">CURRENT COLLABORATORS ({collabModalDeal.collaborators?.length || 0})</label>
                {(!collabModalDeal.collaborators || collabModalDeal.collaborators.length === 0) ? (
                  <div className="text-muted text-sm text-center p-4" style={{ background: 'var(--color-bg)', borderRadius: '6px' }}>
                    No collaborators added to this deal yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {collabModalDeal.collaborators.map(c => (
                      <div 
                        key={c.id} 
                        style={{ 
                          padding: '8px 12px', 
                          background: 'var(--color-bg)', 
                          borderRadius: '6px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between' 
                        }}
                      >
                        <div>
                          <div className="font-medium text-white">{c.full_name}</div>
                          <div className="text-xs text-muted">{c.email}</div>
                        </div>
                        <button 
                          className="btn btn-ghost btn-sm text-red"
                          onClick={() => handleRemoveCollaborator(c.id)}
                          disabled={collabLoading}
                          title="Remove Collaborator"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setCollabModalDeal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History / Audit Trail Timeline Modal */}
      {historyModalDeal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setHistoryModalDeal(null); }}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h3>Deal Audit Timeline</h3>
                <p className="text-muted text-xs mt-1">{historyModalDeal.title} (Immutable History)</p>
              </div>
              <button className="modal-close" onClick={() => setHistoryModalDeal(null)}>✕</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {historyLoading ? (
                <div className="text-center p-4 text-muted">Loading history...</div>
              ) : historyEvents.length === 0 ? (
                <div className="text-muted text-center p-4">No history records found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {historyEvents.map(h => (
                    <div 
                      key={h.id} 
                      style={{ 
                        borderLeft: '3px solid var(--color-primary)', 
                        padding: '8px 12px', 
                        background: 'var(--color-bg)', 
                        borderRadius: '0 6px 6px 0' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="badge badge-blue text-xs">{h.event_type}</span>
                        <span className="text-xs text-muted">{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                      
                      <div className="text-sm text-white">
                        {h.event_type === 'DEAL_CREATED' && (
                          <span>Created deal with initial stage <strong>{h.new_value?.stage}</strong> and value <strong>${h.new_value?.value}</strong></span>
                        )}
                        {h.event_type === 'OWNER_CHANGED' && (
                          <span>Reassigned owner from <strong>{h.old_value?.owner_name || h.old_value?.owner_id}</strong> to <strong>{h.new_value?.owner_name || h.new_value?.owner_id}</strong></span>
                        )}
                        {h.event_type === 'COLLABORATOR_ADDED' && (
                          <span>Added collaborator <strong>{h.new_value?.user_name}</strong></span>
                        )}
                        {h.event_type === 'COLLABORATOR_REMOVED' && (
                          <span>Removed collaborator <strong>{h.old_value?.user_name}</strong></span>
                        )}
                        {h.event_type === 'STAGE_CHANGED' && (
                          <span>Stage changed from {h.old_value?.stage} to {h.new_value?.stage}</span>
                        )}
                        {h.event_type === 'STAGE_BACKWARD' && (
                          <span>Stage moved back: {h.old_value?.stage} → {h.new_value?.stage} (Reason: {h.reason})</span>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted mt-1">
                        By: {h.actor?.full_name || `User #${h.actor_id}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setHistoryModalDeal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
