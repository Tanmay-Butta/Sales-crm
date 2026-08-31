import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { 
  ListTodo, Plus, Edit2, Trash2, Users, History, AlertCircle, Building2, User as UserIcon, X, UserPlus, Trash,
  ArrowRight, ArrowLeft, CheckCircle2, XCircle, Lock
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { dealsAPI } from "../api/deals";
import { companiesAPI } from "../api/companies";
import { authAPI } from "../api/auth";

export default function MyDealsPage() {
  const { user, isManager } = useAuth();
  
  // If user is a Sales Manager, redirect to global Deals page since managers oversee the full pipeline
  if (isManager) {
    return <Navigate to="/deals" replace />;
  }
  
  const [deals, setDeals] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit / Create Modal state
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

  // Backward Reason Modal state
  const [backwardModalDeal, setBackwardModalDeal] = useState(null);
  const [backwardTargetStage, setBackwardTargetStage] = useState("");
  const [backwardReason, setBackwardReason] = useState("");
  const [backwardSubmitting, setBackwardSubmitting] = useState(false);

  // Collaborators Modal state
  const [collabModalDeal, setCollabModalDeal] = useState(null);
  const [selectedRepId, setSelectedRepId] = useState("");
  const [collabLoading, setCollabLoading] = useState(false);

  // History / Audit Trail Modal state
  const [historyModalDeal, setHistoryModalDeal] = useState(null);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [myDealsRes, companiesRes, repsRes] = await Promise.all([
        dealsAPI.getMyDeals(),
        companiesAPI.getCompanies(),
        authAPI.getReps()
      ]);
      
      setDeals(myDealsRes.data.deals);
      setCompanies(companiesRes.data.companies.filter(c => !c.archived_at));
      setReps(repsRes.data.users);
    } catch (err) {
      toast.error("Failed to load your deals");
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
      
      // Refresh modal deal and list
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
  const loadHistory = async (dealId) => {
    setHistoryLoading(true);
    try {
      const res = await dealsAPI.getHistory(dealId);
      setHistoryEvents(res.data.history || []);
    } catch (err) {
      console.error('History load error:', err);
      toast.error(err.response?.data?.error?.message || "Failed to load deal audit trail");
      setHistoryEvents([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = (deal) => {
    setHistoryModalDeal(deal);
    setNoteText("");
    loadHistory(deal.id);
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setNoteSubmitting(true);
    try {
      await dealsAPI.addNote(historyModalDeal.id, noteText.trim());
      toast.success("Note added to timeline");
      setNoteText("");
      loadHistory(historyModalDeal.id);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to add note");
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Stage Advance Handler
  const handleAdvanceStage = async (deal, nextStage) => {
    try {
      await dealsAPI.changeStage(deal.id, nextStage);
      toast.success(`Deal advanced to ${nextStage}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to advance stage");
    }
  };

  // Open Backward Reason Modal
  const openBackwardModal = (deal, targetStage) => {
    setBackwardModalDeal(deal);
    setBackwardTargetStage(targetStage);
    setBackwardReason("");
  };

  // Submit Backward Move
  const handleBackwardSubmit = async (e) => {
    e.preventDefault();
    if (!backwardReason.trim()) {
      toast.error("Please provide a reason for moving the deal backward.");
      return;
    }

    setBackwardSubmitting(true);
    try {
      await dealsAPI.changeStage(backwardModalDeal.id, backwardTargetStage, backwardReason.trim());
      toast.success(`Deal moved back to ${backwardTargetStage}`);
      setBackwardModalDeal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to move deal backward");
    } finally {
      setBackwardSubmitting(false);
    }
  };

  // Close Deal Handler (Won / Lost from Negotiation)
  const handleCloseDeal = async (deal, closeStage) => {
    if (!window.confirm(`Mark deal "${deal.title}" as ${closeStage}? This will close the deal.`)) return;
    try {
      await dealsAPI.changeStage(deal.id, closeStage);
      toast.success(`Deal marked as ${closeStage}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to close deal");
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

  const getProbabilityLabel = (stage) => {
    const probs = {
      NEW: '10%',
      QUALIFIED: '25%',
      PROPOSAL: '50%',
      NEGOTIATION: '75%',
      WON: '100%',
      LOST: '0%'
    };
    return probs[stage] || '0%';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2>My Deals</h2>
          <p className="text-muted">Deals where you are the Owner or an active Collaborator</p>
        </div>
        
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} /> New Deal
          </button>
        </div>
      </div>

      <div className="card table-container">
        {loading ? (
          <div className="p-8 text-center text-muted">Loading your deals...</div>
        ) : deals.length === 0 ? (
          <div className="empty-state">
            <ListTodo size={48} className="text-muted mb-4" />
            <h3>No assigned deals yet</h3>
            <p className="text-muted">You are not an owner or collaborator on any active deals.</p>
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
                <th>MY ROLE</th>
                <th>STAGE</th>
                <th>OWNER / TEAM</th>
                <th>CLOSE DATE</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => {
                const isOwner = deal.owner_id === user.id;
                const isCollab = deal.collaborators?.some(c => c.id === user.id);
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
                    <td className="font-medium">
                      <div className="font-medium text-white">{formatCurrency(deal.value)}</div>
                      {!deal.is_closed && (
                        <div className="text-xs text-muted" style={{ marginTop: '2px' }} title={`Weighted at ${getProbabilityLabel(deal.stage)} probability`}>
                          Wt: {formatCurrency(deal.weighted_value || (deal.value * (deal.win_probability || 0)))}
                        </div>
                      )}
                    </td>
                    <td>
                      {isOwner ? (
                        <span className="badge badge-green">Owner</span>
                      ) : isCollab ? (
                        <span className="badge badge-purple">Collaborator</span>
                      ) : (
                        <span className="badge badge-gray">Viewer</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={getStageBadge(deal.stage)}>
                            {deal.stage} ({getProbabilityLabel(deal.stage)})
                          </span>
                          {deal.is_closed && (
                            <span className="badge badge-gray text-xs" title={deal.closed_at ? `Closed on ${new Date(deal.closed_at).toLocaleDateString()}` : 'Closed'}>
                              <Lock size={10} style={{ marginRight: '3px' }} /> Closed
                            </span>
                          )}
                        </div>

                        {/* Quick Lifecycle Stage Transition Actions for Rep */}
                        {!deal.is_closed && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {deal.stage === 'NEW' && (
                              <button 
                                className="btn btn-xs btn-primary" 
                                style={{ padding: '2px 8px', fontSize: '11px' }}
                                onClick={(e) => { e.stopPropagation(); handleAdvanceStage(deal, 'QUALIFIED'); }}
                                title="Advance to Qualified"
                              >
                                Advance <ArrowRight size={12} />
                              </button>
                            )}

                            {deal.stage === 'QUALIFIED' && (
                              <>
                                <button 
                                  className="btn btn-xs btn-ghost text-muted" 
                                  style={{ padding: '2px 6px', fontSize: '11px' }}
                                  onClick={(e) => { e.stopPropagation(); openBackwardModal(deal, 'NEW'); }}
                                  title="Move back to New (requires reason)"
                                >
                                  <ArrowLeft size={12} /> Back
                                </button>
                                <button 
                                  className="btn btn-xs btn-primary" 
                                  style={{ padding: '2px 8px', fontSize: '11px' }}
                                  onClick={(e) => { e.stopPropagation(); handleAdvanceStage(deal, 'PROPOSAL'); }}
                                  title="Advance to Proposal"
                                >
                                  Advance <ArrowRight size={12} />
                                </button>
                              </>
                            )}

                            {deal.stage === 'PROPOSAL' && (
                              <>
                                <button 
                                  className="btn btn-xs btn-ghost text-muted" 
                                  style={{ padding: '2px 6px', fontSize: '11px' }}
                                  onClick={(e) => { e.stopPropagation(); openBackwardModal(deal, 'QUALIFIED'); }}
                                  title="Move back to Qualified (requires reason)"
                                >
                                  <ArrowLeft size={12} /> Back
                                </button>
                                <button 
                                  className="btn btn-xs btn-primary" 
                                  style={{ padding: '2px 8px', fontSize: '11px' }}
                                  onClick={(e) => { e.stopPropagation(); handleAdvanceStage(deal, 'NEGOTIATION'); }}
                                  title="Advance to Negotiation"
                                >
                                  Advance <ArrowRight size={12} />
                                </button>
                              </>
                            )}

                            {deal.stage === 'NEGOTIATION' && (
                              <>
                                <button 
                                  className="btn btn-xs btn-ghost text-muted" 
                                  style={{ padding: '2px 6px', fontSize: '11px' }}
                                  onClick={(e) => { e.stopPropagation(); openBackwardModal(deal, 'PROPOSAL'); }}
                                  title="Move back to Proposal (requires reason)"
                                >
                                  <ArrowLeft size={12} /> Back
                                </button>
                                <button 
                                  className="btn btn-xs" 
                                  style={{ background: '#10b981', color: '#fff', padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}
                                  onClick={(e) => { e.stopPropagation(); handleCloseDeal(deal, 'WON'); }}
                                  title="Mark deal Won"
                                >
                                  <CheckCircle2 size={12} /> Won
                                </button>
                                <button 
                                  className="btn btn-xs" 
                                  style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', fontSize: '11px', fontWeight: 600 }}
                                  onClick={(e) => { e.stopPropagation(); handleCloseDeal(deal, 'LOST'); }}
                                  title="Mark deal Lost"
                                >
                                  <XCircle size={12} /> Lost
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div className="flex items-center gap-2 text-sm">
                          <UserIcon size={12} className="text-muted" />
                          <span>{deal.owner?.full_name || "Unknown"}</span>
                        </div>
                        {deal.collaborators && deal.collaborators.length > 0 && (
                          <div className="text-xs text-muted">
                            +{deal.collaborators.length} collaborator{deal.collaborators.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{new Date(deal.expected_close_date).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Deal */}
                        <button 
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEditModal(deal)}
                          title="Edit Deal"
                        >
                          <Edit2 size={16} />
                        </button>

                        {/* Manage Collaborators (Owner or Manager) */}
                        {canManageCollabs && (
                          <button 
                            className="btn btn-ghost btn-sm text-primary"
                            onClick={() => openCollaboratorsModal(deal)}
                            title="Manage Collaborators"
                          >
                            <Users size={16} />
                          </button>
                        )}

                        {/* Audit Trail Timeline */}
                        <button 
                          className="btn btn-ghost btn-sm"
                          onClick={() => openHistoryModal(deal)}
                          title="View Deal Timeline"
                        >
                          <History size={16} />
                        </button>

                        {/* Delete Deal (Owner or Manager) */}
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
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h3>📋 Deal Timeline</h3>
                <p className="text-muted text-xs mt-1">{historyModalDeal.title} — Immutable audit trail</p>
              </div>
              <button className="modal-close" onClick={() => setHistoryModalDeal(null)}>✕</button>
            </div>
            
            {/* Add Note Input */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
              <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Add a note to this deal..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  maxLength={2000}
                  style={{ flex: 1 }}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={noteSubmitting || !noteText.trim()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {noteSubmitting ? 'Adding...' : 'Add Note'}
                </button>
              </form>
            </div>

            <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              {historyLoading ? (
                <div className="text-center p-4 text-muted">Loading timeline...</div>
              ) : historyEvents.length === 0 ? (
                <div className="text-muted text-center p-4">No timeline events yet. Add a note to get started.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {historyEvents.map(h => {
                    // Color-code the left border by event type
                    const borderColors = {
                      'DEAL_CREATED': '#10b981',
                      'STAGE_CHANGED': '#6366f1',
                      'STAGE_BACKWARD': '#f59e0b',
                      'DEAL_CLOSED': h.new_value?.stage === 'WON' ? '#10b981' : '#ef4444',
                      'DEAL_REOPENED': '#8b5cf6',
                      'OWNER_CHANGED': '#3b82f6',
                      'COLLABORATOR_ADDED': '#06b6d4',
                      'COLLABORATOR_REMOVED': '#f97316',
                      'NOTE_ADDED': '#a78bfa',
                    };
                    const borderColor = borderColors[h.event_type] || 'var(--color-primary)';

                    // Human-readable labels
                    const labelMap = {
                      'DEAL_CREATED': '🆕 Created',
                      'STAGE_CHANGED': '➡️ Stage Advanced',
                      'STAGE_BACKWARD': '⬅️ Stage Moved Back',
                      'DEAL_CLOSED': h.new_value?.stage === 'WON' ? '🏆 Deal Won' : '❌ Deal Lost',
                      'DEAL_REOPENED': '🔓 Reopened',
                      'OWNER_CHANGED': '👤 Owner Reassigned',
                      'COLLABORATOR_ADDED': '➕ Collaborator Added',
                      'COLLABORATOR_REMOVED': '➖ Collaborator Removed',
                      'NOTE_ADDED': '📝 Note',
                    };
                    const label = labelMap[h.event_type] || h.event_type;

                    return (
                      <div 
                        key={h.id} 
                        style={{ 
                          borderLeft: `3px solid ${borderColor}`, 
                          padding: '10px 14px', 
                          background: 'var(--color-bg)', 
                          borderRadius: '0 6px 6px 0' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: borderColor }}>{label}</span>
                          <span className="text-xs text-muted">{new Date(h.created_at).toLocaleString()}</span>
                        </div>
                        
                        <div className="text-sm" style={{ color: 'var(--color-text)' }}>
                          {h.event_type === 'DEAL_CREATED' && (
                            <span>Created with stage <strong>{h.new_value?.stage}</strong> and value <strong>${h.new_value?.value}</strong></span>
                          )}
                          {h.event_type === 'STAGE_CHANGED' && (
                            <span><strong>{h.old_value?.stage}</strong> → <strong>{h.new_value?.stage}</strong></span>
                          )}
                          {h.event_type === 'STAGE_BACKWARD' && (
                            <div>
                              <div><strong>{h.old_value?.stage}</strong> → <strong>{h.new_value?.stage}</strong></div>
                              <div style={{ marginTop: '4px', padding: '6px 10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px', fontSize: '0.8rem', color: '#f59e0b' }}>
                                Reason: {h.reason}
                              </div>
                            </div>
                          )}
                          {h.event_type === 'DEAL_CLOSED' && (
                            <span>Closed as <strong>{h.new_value?.stage}</strong> (was {h.old_value?.stage})</span>
                          )}
                          {h.event_type === 'DEAL_REOPENED' && (
                            <span>Reopened from <strong>{h.old_value?.stage}</strong> back to <strong>{h.new_value?.stage}</strong></span>
                          )}
                          {h.event_type === 'OWNER_CHANGED' && (
                            <span><strong>{h.old_value?.owner_name || `User #${h.old_value?.owner_id}`}</strong> → <strong>{h.new_value?.owner_name || `User #${h.new_value?.owner_id}`}</strong></span>
                          )}
                          {h.event_type === 'COLLABORATOR_ADDED' && (
                            <span>Added <strong>{h.new_value?.user_name}</strong>{h.new_value?.note ? ` — ${h.new_value.note}` : ''}</span>
                          )}
                          {h.event_type === 'COLLABORATOR_REMOVED' && (
                            <span>Removed <strong>{h.old_value?.user_name}</strong></span>
                          )}
                          {h.event_type === 'NOTE_ADDED' && (
                            <div style={{ padding: '6px 10px', background: 'rgba(167, 139, 250, 0.1)', borderRadius: '4px', fontStyle: 'italic' }}>
                              {h.new_value?.note}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
                          {h.actor?.full_name || `User #${h.actor_id}`}
                        </div>
                      </div>
                    );
                  })}
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

      {/* Backward Reason Modal */}
      {backwardModalDeal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setBackwardModalDeal(null); }}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <h3>Move Deal Backward</h3>
                <p className="text-muted text-xs mt-1">
                  Moving <strong>{backwardModalDeal.title}</strong> from {backwardModalDeal.stage} back to {backwardTargetStage}
                </p>
              </div>
              <button className="modal-close" onClick={() => setBackwardModalDeal(null)}>✕</button>
            </div>
            
            <form onSubmit={handleBackwardSubmit}>
              <div className="modal-body">
                <div style={{
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '16px'
                }}>
                  <p className="text-xs" style={{ color: '#facc15', margin: 0, lineHeight: 1.4 }}>
                    Per CRM policy, moving a deal backward requires a recorded explanation for the deal audit trail.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Moving Backward *</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    required
                    placeholder="e.g., Client requested revised proposal and additional pricing tiers..."
                    value={backwardReason}
                    onChange={(e) => setBackwardReason(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setBackwardModalDeal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={backwardSubmitting || !backwardReason.trim()}>
                  {backwardSubmitting ? "Moving..." : "Confirm Move Backward"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
