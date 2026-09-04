import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { Building2, Plus, Edit2, Archive, RotateCcw, Link as LinkIcon, AlertCircle, ChevronDown, ChevronRight, User as UserIcon, Users, Handshake } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { companiesAPI } from '../api/companies';
import { authAPI } from '../api/auth';
import ShimmerLoader from '../components/common/ShimmerLoader';

export default function CompaniesPage() {
  const { user, isManager } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'OWNED' | 'VIA_DEALS'
  
  const isFetchingRef = useRef(false);
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
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
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
      isFetchingRef.current = false;
    }
  }, [showArchived, isManager]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormData({ name: '', industry: '', website: '', owner_id: '' });
    setDuplicateWarning(null);
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
    setDuplicateWarning(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e, allowDuplicate = false) => {
    if (e) e.preventDefault();
    setSubmitting(true);
    
    try {
      const payload = { ...formData };
      if (!payload.website) delete payload.website;
      if (!isManager) delete payload.owner_id;
      if (allowDuplicate) payload.allow_duplicate = true;

      if (editingCompany) {
        await companiesAPI.updateCompany(editingCompany.id, payload);
        toast.success("Company updated");
      } else {
        await companiesAPI.createCompany(payload);
        toast.success("Company created");
      }
      setDuplicateWarning(null);
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      if (isManager && err.response?.data?.error?.code === 'DUPLICATE_COMPANY_WARNING') {
        setDuplicateWarning(err.response.data.error.message);
      } else {
        const message = err.response?.data?.error?.message || "Failed to save company";
        toast.error(message);
      }
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

  // Helper to determine the user's relationship and access source for a company
  const getCompanyAccessBadge = (company) => {
    if (isManager) {
      return (
        <div>
          <span className="badge badge-gray">Manager Access</span>
        </div>
      );
    }

    const isCompanyOwner = company.owner_id === user.id;
    const ownedDeals = (company.deals || []).filter(d => d.owner_id === user.id);
    const collabDeals = (company.deals || []).filter(d => 
      d.collaborators && d.collaborators.some(c => c.id === user.id)
    );

    if (isCompanyOwner) {
      return (
        <div>
          <span className="badge badge-green">
            Company Owner
          </span>
          <div className="text-xs text-muted" style={{ marginTop: '2px' }}>
            Full company edit rights
          </div>
        </div>
      );
    }

    if (ownedDeals.length > 0 && collabDeals.length > 0) {
      return (
        <div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <span className="badge badge-blue">Deal Owner ({ownedDeals.length})</span>
            <span className="badge badge-purple">Collab ({collabDeals.length})</span>
          </div>
          <div className="text-xs text-muted" style={{ marginTop: '2px' }}>
            Implicit access via deals
          </div>
        </div>
      );
    }

    if (ownedDeals.length > 0) {
      return (
        <div>
          <span className="badge badge-blue">Via Deal Owner</span>
          <div className="text-xs text-muted" style={{ marginTop: '2px' }}>
            Owns {ownedDeals.length} deal{ownedDeals.length > 1 ? 's' : ''} in company
          </div>
        </div>
      );
    }

    if (collabDeals.length > 0) {
      return (
        <div>
          <span className="badge badge-purple">Via Collaboration</span>
          <div className="text-xs text-muted" style={{ marginTop: '2px' }}>
            Collaborates on {collabDeals.length} deal{collabDeals.length > 1 ? 's' : ''}
          </div>
        </div>
      );
    }

    return <span className="badge badge-gray">Read Only</span>;
  };

  const getFilteredCompanies = () => {
    if (isManager || filterMode === 'ALL') return companies;
    if (filterMode === 'OWNED') {
      return companies.filter(c => c.owner_id === user.id);
    }
    if (filterMode === 'VIA_DEALS') {
      return companies.filter(c => c.owner_id !== user.id);
    }
    return companies;
  };

  const filteredCompanies = getFilteredCompanies();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Companies</h1>
          <p className="page-subtitle">Manage client companies and view associated deals</p>
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

      {/* Filter Tabs for Sales Reps */}
      {!isManager && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button 
            className={`btn btn-sm ${filterMode === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('ALL')}
          >
            All Visible ({companies.length})
          </button>
          <button 
            className={`btn btn-sm ${filterMode === 'OWNED' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('OWNED')}
          >
            Owned by Me ({companies.filter(c => c.owner_id === user?.id).length})
          </button>
          <button 
            className={`btn btn-sm ${filterMode === 'VIA_DEALS' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterMode('VIA_DEALS')}
          >
            Via Deals / Collaborations ({companies.filter(c => c.owner_id !== user?.id).length})
          </button>
        </div>
      )}

      {loading ? (
        <ShimmerLoader
          type="table"
          rows={5}
          messages={[
            'Connecting to accounts database...',
            'Fetching company directories & owners...',
            'Calculating active and archived accounts...',
            'Almost ready! Assembling companies list...'
          ]}
        />
      ) : filteredCompanies.length === 0 ? (
        <div className="empty-state">
          <Building2 size={48} className="empty-state-icon" />
          <div className="empty-state-title">No companies found</div>
          <p className="empty-state-text">
            {filterMode === 'OWNED' 
              ? "You don't own any companies directly." 
              : filterMode === 'VIA_DEALS' 
              ? "You don't have any deals or collaborations under other reps' companies." 
              : showArchived ? "You don't have any companies." : "You don't have any active companies."}
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
                <th style={{ width: '32px' }}></th>
                <th>COMPANY NAME</th>
                <th>YOUR ACCESS / SOURCE</th>
                <th>INDUSTRY</th>
                <th>COMPANY OWNER</th>
                <th>WEBSITE</th>
                <th>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((company) => {
                const isCompanyOwner = company.owner_id === user.id;
                const canEdit = isManager || isCompanyOwner;
                const isExpanded = expandedCompanyId === company.id;
                const dealCount = company.deals?.length || 0;
                
                return (
                  <Fragment key={company.id}>
                    <tr 
                      style={{ opacity: company.archived_at ? 0.6 : 1, cursor: 'pointer' }}
                      onClick={() => setExpandedCompanyId(isExpanded ? null : company.id)}
                    >
                      <td style={{ paddingRight: '0' }}>
                        {isExpanded ? <ChevronDown size={16} className="text-primary" /> : <ChevronRight size={16} className="text-muted" />}
                      </td>
                      <td style={{ fontWeight: 600, color: 'white' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Building2 size={16} className="text-primary" />
                          <span>{company.name}</span>
                          {dealCount > 0 && (
                            <span className="badge badge-gray text-xs" style={{ fontSize: '10px' }}>
                              {dealCount} deal{dealCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {getCompanyAccessBadge(company)}
                      </td>
                      <td>{company.industry}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <UserIcon size={12} className="text-muted" />
                          <span>{company.owner?.full_name || <span className="text-muted text-danger">No Owner</span>}</span>
                          {isCompanyOwner && <span className="badge badge-green" style={{ fontSize: '9px', padding: '1px 4px' }}>You</span>}
                        </div>
                      </td>
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
                        {company.archived_at ? (
                          <span className="badge badge-archived">Archived</span>
                        ) : (
                          <span className="badge badge-won">Active</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {canEdit ? (
                            <>
                              <button 
                                className="btn btn-ghost btn-sm"
                                onClick={(e) => { e.stopPropagation(); openEditModal(company); }}
                                title="Edit company details"
                              >
                                <Edit2 size={16} />
                              </button>
                              {isManager && (
                                <button 
                                  className={`btn btn-ghost btn-sm ${company.archived_at ? 'text-success' : 'text-danger'}`}
                                  onClick={(e) => { e.stopPropagation(); toggleArchive(company); }}
                                  title={company.archived_at ? "Restore company" : "Archive company"}
                                >
                                  {company.archived_at ? <RotateCcw size={16} /> : <Archive size={16} />}
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="text-muted text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="You can view this company because you have deals inside it, but only the company owner can edit company details.">
                              <AlertCircle size={14} /> Read-only
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Deals Drawer */}
                    {isExpanded && (
                      <tr className="bg-darker">
                        <td colSpan="8" style={{ padding: '20px 24px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '14px', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Handshake size={16} className="text-primary" />
                                Deals for {company.name}
                              </h4>
                              <p className="text-xs text-muted mt-1">
                                {isManager || isCompanyOwner 
                                  ? "As company owner/manager, you see all deals in this company." 
                                  : "Showing deals you own or collaborate on inside this company."}
                              </p>
                            </div>
                          </div>

                          {(!company.deals || company.deals.length === 0) ? (
                            <div className="text-muted text-sm p-4 text-center" style={{ background: 'var(--color-bg)', borderRadius: '6px' }}>
                              No deals associated with this company yet.
                            </div>
                          ) : (
                            <table className="table" style={{ background: 'var(--color-bg)', borderRadius: '6px', overflow: 'hidden' }}>
                              <thead>
                                <tr>
                                  <th>DEAL TITLE</th>
                                  <th>VALUE</th>
                                  <th>STAGE</th>
                                  <th>EXPECTED CLOSE</th>
                                  <th>DEAL OWNER</th>
                                  <th>YOUR ROLE</th>
                                </tr>
                              </thead>
                              <tbody>
                                {company.deals.map(deal => {
                                  const isDealOwner = deal.owner_id === user?.id;
                                  const isDealCollab = deal.collaborators?.some(c => c.id === user?.id);

                                  return (
                                    <tr key={deal.id}>
                                      <td className="font-medium text-white">{deal.title}</td>
                                      <td className="font-medium">${deal.value}</td>
                                      <td><span className="badge badge-blue">{deal.stage}</span></td>
                                      <td>{new Date(deal.expected_close_date).toLocaleDateString()}</td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <UserIcon size={12} className="text-muted" />
                                          <span>{deal.owner?.full_name || "Unknown"}</span>
                                        </div>
                                      </td>
                                      <td>
                                        {isDealOwner ? (
                                          <span className="badge badge-green">Deal Owner</span>
                                        ) : isDealCollab ? (
                                          <span className="badge badge-purple">Collaborator</span>
                                        ) : isCompanyOwner ? (
                                          <span className="badge badge-gray">Company Owner View</span>
                                        ) : (
                                          <span className="badge badge-gray">Viewer</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
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
              {duplicateWarning && (
                <div style={{
                  background: 'rgba(234, 179, 8, 0.12)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '16px'
                }}>
                  <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} /> Duplicate Company Account
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                    {duplicateWarning}
                  </p>
                  <p className="text-xs text-muted" style={{ margin: '0 0 12px 0' }}>
                    As a Sales Manager, do you still want to create a separate company record with this name?
                  </p>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => setDuplicateWarning(null)}
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm" 
                      style={{ background: '#eab308', borderColor: '#eab308', color: '#000', fontWeight: 600 }}
                      onClick={(e) => handleSubmit(e, true)}
                      disabled={submitting}
                    >
                      {submitting ? 'Creating...' : 'Create Duplicate Anyway'}
                    </button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Company Name *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({...formData, name: e.target.value});
                    if (duplicateWarning) setDuplicateWarning(null);
                  }}
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
