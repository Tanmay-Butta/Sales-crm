import { useState, useEffect, Fragment } from 'react';
import { Building2, Plus, Edit2, Archive, RotateCcw, Link as LinkIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { companiesAPI } from '../api/companies';
import { authAPI } from '../api/auth';

export default function CompaniesPage() {
  const { user, isManager } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [expandedCompanyId, setExpandedCompanyId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    website: '',
    owner_id: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [showArchived, isManager]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [companiesRes, repsRes] = await Promise.all([
        companiesAPI.getCompanies(showArchived),
        isManager ? authAPI.getReps() : Promise.resolve({ data: { users: [] } })
      ]);
      setCompanies(companiesRes.data.companies);
      if (isManager) setReps(repsRes.data.users);
    } catch (err) {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormData({ name: '', industry: '', website: '', owner_id: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (company) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      industry: company.industry,
      website: company.website || '',
      owner_id: company.owner_id || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const payload = { ...formData };
      if (!payload.website) delete payload.website;
      if (!isManager) delete payload.owner_id;

      if (editingCompany) {
        await companiesAPI.updateCompany(editingCompany.id, payload);
        toast.success("Company updated");
      } else {
        await companiesAPI.createCompany(payload);
        toast.success("Company created");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      const message = err.response?.data?.error?.message || "Failed to save company";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleArchive = async (company) => {
    const action = company.archived_at ? 'restore' : 'archive';
    if (!window.confirm(`Are you sure you want to ${action} this company?`)) return;
    
    try {
      if (company.archived_at) {
        await companiesAPI.restoreCompany(company.id);
      } else {
        await companiesAPI.archiveCompany(company.id);
      }
      toast.success(`Company ${action}d successfully`);
      fetchData();
    } catch (err) {
      const message = err.response?.data?.error?.message || `Failed to ${action} company`;
      toast.error(message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="page-subtitle">Manage your client companies</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
            <input 
              type="checkbox" 
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} /> New Company
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner" /></div>
      ) : companies.length === 0 ? (
        <div className="empty-state">
          <Building2 size={48} className="empty-state-icon" />
          <div className="empty-state-title">No companies found</div>
          <p className="empty-state-text">
            {showArchived ? "You don't have any companies." : "You don't have any active companies."}
          </p>
          <button className="btn btn-secondary mt-4" onClick={openCreateModal}>
            Add your first company
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Industry</th>
                <th>Website</th>
                <th>Owner</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => {
                const canEdit = isManager || company.owner_id === user.id;
                
                return (
                  <Fragment key={company.id}>
                    <tr 
                      style={{ opacity: company.archived_at ? 0.6 : 1, cursor: 'pointer' }}
                      onClick={() => setExpandedCompanyId(expandedCompanyId === company.id ? null : company.id)}
                    >
                      <td style={{ fontWeight: 500 }}>{company.name}</td>
                      <td>{company.industry}</td>
                      <td>
                        {company.website ? (
                          <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                            <LinkIcon size={12} /> Link
                          </a>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {company.owner?.full_name || <span className="text-muted text-danger">ERROR: No Owner</span>}
                      </td>
                      <td>
                        {company.archived_at ? (
                          <span className="badge badge-archived">Archived</span>
                        ) : (
                          <span className="badge badge-won">Active</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {canEdit && (
                            <>
                              <button 
                                className="btn btn-ghost btn-sm"
                                onClick={(e) => { e.stopPropagation(); openEditModal(company); }}
                                title="Edit company"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                className={`btn btn-ghost btn-sm ${company.archived_at ? 'text-success' : 'text-danger'}`}
                                onClick={(e) => { e.stopPropagation(); toggleArchive(company); }}
                                title={company.archived_at ? "Restore company" : "Archive company"}
                              >
                                {company.archived_at ? <RotateCcw size={16} /> : <Archive size={16} />}
                              </button>
                            </>
                          )}
                          {!canEdit && (
                            <span className="text-muted text-xs" title="You don't have permission to edit this company">
                              <AlertCircle size={16} />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedCompanyId === company.id && (
                      <tr className="bg-darker">
                        <td colSpan="6" style={{ padding: '16px' }}>
                          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--color-text-muted)' }}>Deals for {company.name}</h4>
                          {(!company.deals || company.deals.length === 0) ? (
                            <div className="text-muted text-sm">No deals associated with this company yet.</div>
                          ) : (
                            <table className="table" style={{ background: 'var(--color-bg)' }}>
                              <thead>
                                <tr>
                                  <th>TITLE</th>
                                  <th>VALUE</th>
                                  <th>STAGE</th>
                                  <th>CLOSE DATE</th>
                                </tr>
                              </thead>
                              <tbody>
                                {company.deals.map(deal => (
                                  <tr key={deal.id}>
                                    <td className="font-medium text-white">{deal.title}</td>
                                    <td className="font-medium">${deal.value}</td>
                                    <td><span className="badge badge-blue">{deal.stage}</span></td>
                                    <td>{new Date(deal.expected_close_date).toLocaleDateString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editingCompany ? 'Edit Company' : 'New Company'}</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Industry *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={formData.industry}
                  onChange={(e) => setFormData({...formData, industry: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Website (optional)</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                />
              </div>

              {isManager && (
                <div className="form-group">
                  <label className="form-label">Assign Sales Rep Owner *</label>
                  <select 
                    className="form-select"
                    required
                    value={formData.owner_id}
                    onChange={(e) => setFormData({...formData, owner_id: e.target.value})}
                  >
                    <option value="" disabled>--- Select a Sales Rep ---</option>
                    {reps.map(rep => (
                      <option key={rep.id} value={rep.id}>{rep.full_name}</option>
                    ))}
                  </select>
                  <div className="form-error mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Managers cannot own companies. You must assign a Sales Rep.
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

