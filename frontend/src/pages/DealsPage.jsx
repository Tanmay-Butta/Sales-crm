import { useState, useEffect } from "react";
import { 
  Handshake, Plus, Edit2, Trash2, AlertCircle, Building2, User as UserIcon 
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

  useEffect(() => {
    fetchData();
  }, [isManager]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dealsRes, companiesRes, repsRes] = await Promise.all([
        dealsAPI.getDeals(),
        companiesAPI.getCompanies(),
        isManager ? authAPI.getReps() : Promise.resolve({ data: { users: [] } })
      ]);
      
      setDeals(dealsRes.data.deals);
      // Only active companies can have deals created for them
      setCompanies(companiesRes.data.companies.filter(c => !c.archived_at));
      
      if (isManager) {
        setReps(repsRes.data.users);
      }
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
      
      // Convert to types
      payload.company_id = parseInt(payload.company_id, 10);
      payload.value = parseFloat(payload.value);
      
      if (!isManager) delete payload.owner_id;
      else if (payload.owner_id) payload.owner_id = parseInt(payload.owner_id, 10);

      if (editingDeal) {
        // Exclude company_id and owner_id for basic edit (Phase 3A limits)
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
      toast.error("Failed to delete deal");
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
          <p className="text-muted">Manage your sales pipeline</p>
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
                <th>OWNER</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => {
                const canEdit = isManager || deal.owner_id === user.id;
                
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
                      <div className="flex items-center gap-2">
                        <UserIcon size={14} className="text-muted" />
                        {deal.owner?.full_name || "Unknown"}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {canEdit ? (
                          <>
                            <button 
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEditModal(deal)}
                              title="Edit Deal"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              className="btn btn-ghost btn-sm text-red"
                              onClick={() => handleDelete(deal.id)}
                              title="Delete Deal"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <span className="text-muted text-xs" title="You don't have permission to edit this deal">
                            <AlertCircle size={16} />
                          </span>
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
                
                {(!editingDeal || isManager) && (
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
    </div>
  );
}




