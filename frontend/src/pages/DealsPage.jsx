import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Handshake, Plus, Edit2, Trash2, Users, History, AlertCircle, Building2, User as UserIcon, UserPlus, Trash,
  ArrowRight, ArrowLeft, CheckCircle2, XCircle, RotateCcw, Lock, MessageSquare, Sparkles, UserCheck, UserMinus,
  Search, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, SlidersHorizontal, ChevronDown, Check,
  Download, FastForward
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { dealsAPI } from "../api/deals";
import { companiesAPI } from "../api/companies";
import { authAPI } from "../api/auth";
import ShimmerLoader from "../components/common/ShimmerLoader";

export default function DealsPage() {
  const { user, isManager } = useAuth();
  
  // Deals list and metadata
  const [deals, setDeals] = useState([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Dropdown reference data
  const [companies, setCompanies] = useState([]);
  const [reps, setReps] = useState([]);

  // Goal 7: Deal Multi-Selection & Bulk Actions state
  const [selectedDealIds, setSelectedDealIds] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);

  // Goal 7: Bulk Advance Modal state
  const [isBulkAdvanceOpen, setIsBulkAdvanceOpen] = useState(false);
  const [bulkAdvanceOutcome, setBulkAdvanceOutcome] = useState("SKIP"); // 'SKIP' | 'WON' | 'LOST'
  const [bulkAdvanceLoading, setBulkAdvanceLoading] = useState(false);

  // Goal 7: Bulk Reassign Modal state
  const [isBulkReassignOpen, setIsBulkReassignOpen] = useState(false);
  const [bulkTargetOwnerId, setBulkTargetOwnerId] = useState("");
  const [bulkKeepAsCollab, setBulkKeepAsCollab] = useState(true);
  const [bulkReassignLoading, setBulkReassignLoading] = useState(false);

  // Goal 7: Bulk Results Modal state
  const [isBulkResultsOpen, setIsBulkResultsOpen] = useState(false);
  const [bulkResultsData, setBulkResultsData] = useState(null);

  // Server-side Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState([]);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [companyFilterSearch, setCompanyFilterSearch] = useState("");
  const companyDropdownRef = useRef(null);

  const [filterStage, setFilterStage] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [viewMode, setViewMode] = useState("ALL"); // 'ALL' | 'MY_DEALS' | 'VIA_COMPANY'

  // Server-side Sorting state
  const [sortBy, setSortBy] = useState("updated_at"); // 'updated_at' | 'value' | 'expected_close_date'
  const [sortDir, setSortDir] = useState("desc"); // 'asc' | 'desc'

  // Server-side Pagination state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [keepPreviousOwner, setKeepPreviousOwner] = useState(true);
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

  // Close company dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 2. Fetch reference dropdown data on mount
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [companiesRes, repsRes] = await Promise.all([
          companiesAPI.getCompanies(true), // Fetch ALL companies including archived
          authAPI.getReps()
        ]);
        setCompanies(companiesRes.data.companies || []);
        setReps(repsRes.data.users || []);
      } catch (err) {
        console.error("Failed to load reference data:", err);
      }
    };
    fetchDropdownData();
  }, [isManager]);

  // 3. Reset page to 1 whenever search, filters, view mode, or sort change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCompanyIds, filterStage, filterOwner, viewMode, sortBy, sortDir]);

  // 4. Fetch deals from server whenever query params change
  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        per_page: perPage,
        sort_by: sortBy,
        sort_dir: sortDir,
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      if (selectedCompanyIds.length > 0) {
        params.company_id = selectedCompanyIds.join(',');
      }
      if (filterStage) {
        params.stage = filterStage;
      }
      if (filterOwner) {
        params.owner_id = filterOwner;
      }
      if (!isManager && viewMode !== "ALL") {
        params.view_mode = viewMode.toLowerCase();
      }

      const res = await dealsAPI.getDeals(params);
      console.log("[Deals API Response]", res.data);

      setDeals(res.data.deals || []);
      setTotalDeals(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
      window.dispatchEvent(new Event('deals-updated'));
    } catch (err) {
      console.error("Failed to fetch deals:", err);
      toast.error("Failed to load deals from server");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedSearch, selectedCompanyIds, filterStage, filterOwner, viewMode, sortBy, sortDir, isManager]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Toggle company in multi-select
  const toggleCompanySelection = (cid) => {
    setSelectedCompanyIds(prev => {
      if (prev.includes(cid)) {
        return prev.filter(id => id !== cid);
      } else {
        return [...prev, cid];
      }
    });
  };

  const handleSelectAllActive = () => {
    setSelectedCompanyIds(companies.filter(c => !c.archived_at).map(c => c.id));
  };

  const handleSelectAllArchived = () => {
    setSelectedCompanyIds(companies.filter(c => c.archived_at).map(c => c.id));
  };

  // Reset selected deals when search, filters, viewMode, or page change to avoid accidental "ghost" actions on invisible deals
  useEffect(() => {
    setSelectedDealIds([]);
  }, [debouncedSearch, selectedCompanyIds, filterStage, filterOwner, viewMode, page]);

  // Goal 7: Toggle deal selection
  const toggleDealSelect = (dealId) => {
    setSelectedDealIds(prev => {
      if (prev.includes(dealId)) {
        return prev.filter(id => id !== dealId);
      } else {
        return [...prev, dealId];
      }
    });
  };

  const toggleSelectAllCurrentPage = () => {
    if (deals.length === 0) return;
    const pageIds = deals.map(d => d.id);
    const allSelected = pageIds.every(id => selectedDealIds.includes(id));
    if (allSelected) {
      setSelectedDealIds([]);
    } else {
      setSelectedDealIds(pageIds);
    }
  };

  // Goal 7: Pipeline CSV Export Handler (supports active search & filters)
  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const params = {};
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedCompanyIds.length > 0) params.company_id = selectedCompanyIds.join(',');
      if (filterStage) params.stage = filterStage;
      if (filterOwner) params.owner_id = filterOwner;
      if (!isManager && viewMode !== "ALL") params.view_mode = viewMode.toLowerCase();

      const res = await dealsAPI.exportCSV(params);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      link.setAttribute('download', `pipeline_export_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success("Pipeline CSV exported successfully");
    } catch (err) {
      console.error("Failed to export pipeline CSV:", err);
      toast.error("Failed to export CSV file");
    } finally {
      setExportLoading(false);
    }
  };

  // Goal 7: Bulk Advance Submit Handler
  const handleBulkAdvanceSubmit = async () => {
    if (selectedDealIds.length === 0) return;
    setBulkAdvanceLoading(true);
    try {
      const outcome = bulkAdvanceOutcome === "SKIP" ? null : bulkAdvanceOutcome;
      const res = await dealsAPI.bulkAdvance(selectedDealIds, outcome);
      console.log("[Bulk Advance Response]", res.data);
      setBulkResultsData(res.data);
      setIsBulkAdvanceOpen(false);
      setIsBulkResultsOpen(true);
    } catch (err) {
      console.error("Failed to bulk advance deals:", err);
      toast.error(err.response?.data?.error?.message || "Bulk advance failed");
    } finally {
      setBulkAdvanceLoading(false);
    }
  };

  // Goal 7: Bulk Reassign Submit Handler
  const handleBulkReassignSubmit = async () => {
    if (selectedDealIds.length === 0 || !bulkTargetOwnerId) return;
    setBulkReassignLoading(true);
    try {
      const res = await dealsAPI.bulkReassign(
        selectedDealIds,
        parseInt(bulkTargetOwnerId, 10),
        bulkKeepAsCollab
      );
      console.log("[Bulk Reassign Response]", res.data);
      setBulkResultsData(res.data);
      setIsBulkReassignOpen(false);
      setIsBulkResultsOpen(true);
    } catch (err) {
      console.error("Failed to bulk reassign deals:", err);
      toast.error(err.response?.data?.error?.message || "Bulk reassign failed");
    } finally {
      setBulkReassignLoading(false);
    }
  };

  // Close Bulk Results Modal & Refresh
  const handleCloseBulkResults = () => {
    setIsBulkResultsOpen(false);
    setBulkResultsData(null);
    setSelectedDealIds([]);
    fetchDeals();
  };

  // Clear all filters handler
  const handleClearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedCompanyIds([]);
    setFilterStage("");
    setFilterOwner("");
    setViewMode("ALL");
    setSortBy("updated_at");
    setSortDir("desc");
    setPage(1);
    setSelectedDealIds([]);
  };

  const isFiltered = Boolean(
    searchQuery ||
    selectedCompanyIds.length > 0 ||
    filterStage ||
    filterOwner ||
    (!isManager && viewMode !== "ALL") ||
    sortBy !== "updated_at" ||
    sortDir !== "desc"
  );

  // Toggle sort direction or change sort column
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortDir("desc");
    }
  };

  const openNewModal = () => {
    if (companies.length === 0) {
      toast.error("You must create a company first before adding a deal.");
      return;
    }
    setEditingDeal(null);
    setKeepPreviousOwner(true);
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
    setKeepPreviousOwner(true);
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
      
      // if (!isManager) delete payload.owner_id;
      if (payload.owner_id) payload.owner_id = parseInt(payload.owner_id, 10);

      if (editingDeal) {
        const updatePayload = {
          title: payload.title,
          value: payload.value,
          expected_close_date: payload.expected_close_date
        };
        if (payload.owner_id) {
          updatePayload.owner_id = payload.owner_id;
          if (payload.owner_id !== editingDeal.owner_id) {
            updatePayload.keep_previous_owner_as_collaborator = keepPreviousOwner;
          }
        }
        await dealsAPI.updateDeal(editingDeal.id, updatePayload);
        toast.success("Deal updated successfully");
      } else {
        await dealsAPI.createDeal(payload);
        toast.success("Deal created successfully");
      }
      
      closeModal();
      fetchDeals();
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
      fetchDeals();
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
      fetchDeals();
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
      fetchDeals();
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
      fetchDeals();
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
      fetchDeals();
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
      fetchDeals();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to close deal");
    }
  };

  // Reopen Deal Handler (Sales Manager only)
  const handleReopenDeal = async (deal) => {
    const prev = deal.previous_stage || 'Negotiation';
    if (!window.confirm(`Reopen "${deal.title}"? It will restore to its pre-close stage (${prev}).`)) return;
    try {
      await dealsAPI.reopenDeal(deal.id);
      toast.success(`Deal reopened to ${prev}`);
      fetchDeals();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to reopen deal");
    }
  };

  // Dropdown Stage Selection Change Handler
  const handleStageSelectChange = async (deal, targetStage) => {
    if (!targetStage || targetStage === deal.stage) return;

    if (targetStage === 'REOPEN') {
      handleReopenDeal(deal);
      return;
    }

    // Check if target is a backward open stage - open modal to collect reason
    const stageOrder = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'];
    const currentIdx = stageOrder.indexOf(deal.stage);
    const targetIdx = stageOrder.indexOf(targetStage);

    if (currentIdx !== -1 && targetIdx !== -1 && targetIdx < currentIdx) {
      openBackwardModal(deal, targetStage);
      return;
    }

    // Direct transition attempt (backend strictly validates forward 1-step, closing rules, and closed deals)
    try {
      await dealsAPI.changeStage(deal.id, targetStage);
      toast.success(`Deal moved to ${targetStage}`);
      fetchDeals();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || "Failed to update deal stage");
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
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

  // Helper to determine why the current user sees this deal
  const getUserAccessBadge = (deal) => {
    if (deal.owner_id === user.id) {
      return (
        <div>
          <span className="badge badge-green">Deal Owner</span>
        </div>
      );
    }
    if (deal.collaborators && deal.collaborators.some(c => c.id === user.id)) {
      return (
        <div>
          <span className="badge badge-purple">Collaborator</span>
        </div>
      );
    }
    if (deal.company && deal.company.owner_id === user.id) {
      return (
        <div>
          <span className="badge badge-blue">Company Owner</span>
          <div className="text-xs text-muted" style={{ marginTop: '2px' }}>
            Via {deal.company?.name}
          </div>
        </div>
      );
    }
    if (isManager) {
      return (
        <div>
          <span className="badge badge-gray">Manager Access</span>
        </div>
      );
    }
    return <span className="badge badge-gray">Viewer</span>;
  };

  // Helper to escape regex special characters
  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Helper to highlight matching substrings in deal title and company name
  const highlightMatch = (text, query) => {
    if (!text) return "";
    if (!query || !query.trim()) return text;

    const cleanQuery = query.trim();
    const regex = new RegExp(`(${escapeRegExp(cleanQuery)})`, 'gi');
    const parts = String(text).split(regex);

    return parts.map((part, i) => {
      if (part.toLowerCase() === cleanQuery.toLowerCase()) {
        return (
          <mark
            key={i}
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.35)',
              color: '#ffffff',
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: '4px',
              borderBottom: '2px solid var(--color-primary-light)',
            }}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>All Deals</h2>
          <p className="text-muted">Manage and search your sales pipeline across all visible companies</p>
        </div>
        
        <div className="page-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportCSV}
            disabled={exportLoading}
            title="Export open pipeline deals to CSV"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} /> {exportLoading ? "Exporting..." : "Export CSV"}
          </button>
          <button className="btn btn-primary" onClick={openNewModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={18} /> New Deal
          </button>
        </div>
      </div>

      {/* Server-side View Mode Tabs for Sales Reps */}
      {!isManager && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button 
            className={`btn btn-sm ${viewMode === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('ALL')}
          >
            All Visible Deals
          </button>
          <button 
            className={`btn btn-sm ${viewMode === 'MY_DEALS' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('MY_DEALS')}
          >
            My Deals & Collaborations
          </button>
          <button 
            className={`btn btn-sm ${viewMode === 'VIA_COMPANY' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('VIA_COMPANY')}
          >
            Via Company Ownership
          </button>
        </div>
      )}

      {/* Server-side Search, Filter & Sort Controls Card */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '36px', paddingRight: searchQuery ? '32px' : '12px' }}
              placeholder="Search deal title or company name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '2px'
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
            
            {/* Multi-Company Selector Dropdown */}
            <div style={{ position: 'relative' }} ref={companyDropdownRef}>
              <button
                type="button"
                className={`btn ${selectedCompanyIds.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  fontSize: '0.85rem',
                  padding: '7px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  minWidth: '155px',
                  justifyContent: 'space-between'
                }}
                onClick={() => setCompanyDropdownOpen(prev => !prev)}
                title="Select one or multiple companies"
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Building2 size={14} />
                  <span>
                    {selectedCompanyIds.length === 0
                      ? "All Companies"
                      : selectedCompanyIds.length === 1
                      ? companies.find(c => c.id === selectedCompanyIds[0])?.name || "1 Company"
                      : `${selectedCompanyIds.length} Companies`}
                  </span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                  {selectedCompanyIds.length > 1 && (
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.25)',
                      padding: '0 6px',
                      borderRadius: '10px',
                      fontSize: '0.725rem',
                      fontWeight: 700
                    }}>
                      {selectedCompanyIds.length}
                    </span>
                  )}
                  <ChevronDown
                    size={14}
                    style={{
                      transform: companyDropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease'
                    }}
                  />
                </div>
              </button>

              {/* Multi-Company Dropdown Popover */}
              {companyDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: '280px',
                  maxHeight: '340px',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.55)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}>
                  {/* Search input inside dropdown */}
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '28px', paddingRight: '8px', fontSize: '0.8rem', padding: '5px 8px 5px 28px', width: '100%' }}
                        placeholder="Search companies..."
                        value={companyFilterSearch}
                        onChange={(e) => setCompanyFilterSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Action row: Select All / Clear Selection */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--color-border)',
                    background: 'var(--color-bg-tertiary)',
                  }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--color-primary-light)' }}
                      onClick={handleSelectAllActive}
                      title="Select all active companies"
                    >
                      All Active
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--color-primary-light)' }}
                      onClick={handleSelectAllArchived}
                      title="Select all archived companies"
                    >
                      All Archived
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '0.7rem', color: 'var(--color-primary-light)' }}
                      onClick={() => setSelectedCompanyIds(companies.map(c => c.id))}
                      title="Select every company"
                    >
                      All ({companies.length})
                    </button>
                    <div style={{ flex: 1 }}></div>
                    <button
                      type="button"
                      className="btn btn-ghost text-muted"
                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      onClick={() => setSelectedCompanyIds([])}
                    >
                      Clear
                    </button>
                  </div>

                  {/* Scrollable Company Checkbox List */}
                  <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0', maxHeight: '200px' }}>
                    {companies.filter(c => c.name.toLowerCase().includes(companyFilterSearch.toLowerCase().trim())).length === 0 ? (
                      <div className="text-muted text-xs text-center" style={{ padding: '16px 10px' }}>
                        No matching companies found
                      </div>
                    ) : (
                      companies
                        .filter(c => c.name.toLowerCase().includes(companyFilterSearch.toLowerCase().trim()))
                        .map(comp => {
                          const isSelected = selectedCompanyIds.includes(comp.id);
                          return (
                            <div
                              key={comp.id}
                              onClick={() => toggleCompanySelection(comp.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '0.825rem',
                                color: isSelected ? '#ffffff' : 'var(--color-text-secondary)',
                                background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                                transition: 'all 0.1s ease'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by parent container click
                                style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                              />
                              <span style={{
                                fontWeight: isSelected ? 600 : 400,
                                flex: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: comp.archived_at ? 'var(--color-text-muted)' : 'inherit'
                              }}>
                                {comp.name}
                                {comp.archived_at && (
                                  <span style={{ 
                                    fontSize: '0.65rem', 
                                    marginLeft: '6px', 
                                    background: 'rgba(255,255,255,0.1)', 
                                    padding: '2px 4px', 
                                    borderRadius: '4px',
                                    fontWeight: 500
                                  }}>Archived</span>
                                )}
                              </span>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Stage Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '140px', fontSize: '0.85rem' }}
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
            >
              <option value="">All Stages</option>
              <option value="NEW">New (10%)</option>
              <option value="QUALIFIED">Qualified (25%)</option>
              <option value="PROPOSAL">Proposal (50%)</option>
              <option value="NEGOTIATION">Negotiation (75%)</option>
              <option value="WON">Won (100%)</option>
              <option value="LOST">Lost (0%)</option>
            </select>

            {/* Owner Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '140px', fontSize: '0.85rem' }}
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="">All Owners</option>
              {reps.map(r => (
                <option key={r.id} value={r.id}>{r.full_name}</option>
              ))}
            </select>

            {/* Sort Field & Direction */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '150px', fontSize: '0.85rem' }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                title="Sort by"
              >
                <option value="updated_at">Last Updated</option>
                <option value="value">Deal Value</option>
                <option value="expected_close_date">Close Date</option>
              </select>

              <button
                className="btn btn-secondary"
                style={{ padding: '8px 10px' }}
                onClick={() => setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')}
                title={`Sorting ${sortDir.toUpperCase()} (Click to toggle)`}
              >
                {sortDir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              </button>
            </div>

            {/* Clear All Filters */}
            {isFiltered && (
              <button
                className="btn btn-ghost text-muted"
                style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                onClick={handleClearFilters}
                title="Reset all filters and sorting"
              >
                <RotateCcw size={14} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Selected Companies Multi-Pill Chips */}
        {selectedCompanyIds.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px dashed var(--color-border)',
            alignItems: 'center'
          }}>
            <span className="text-xs text-muted" style={{ marginRight: '4px', fontWeight: 500 }}>
              Filtered by ({selectedCompanyIds.length}):
            </span>
            {selectedCompanyIds.map(cid => {
              const comp = companies.find(c => c.id === cid);
              if (!comp) return null;
              return (
                <span
                  key={cid}
                  className="badge badge-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    background: 'rgba(99, 102, 241, 0.18)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    color: '#e0e7ff'
                  }}
                >
                  <Building2 size={11} />
                  {comp.name}
                  <X
                    size={13}
                    style={{ cursor: 'pointer', marginLeft: '3px', opacity: 0.7 }}
                    onMouseEnter={(e) => e.target.style.opacity = 1}
                    onMouseLeave={(e) => e.target.style.opacity = 0.7}
                    onClick={() => toggleCompanySelection(cid)}
                    title={`Remove ${comp.name} filter`}
                  />
                </span>
              );
            })}
            <button
              type="button"
              className="btn btn-ghost text-muted"
              style={{ fontSize: '0.725rem', padding: '2px 8px', marginLeft: '4px' }}
              onClick={() => setSelectedCompanyIds([])}
            >
              Clear companies
            </button>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="card table-container" style={{ padding: 0 }}>
        {loading ? (
          <ShimmerLoader
            type="table"
            rows={6}
            messages={[
              "Connecting to cloud database...",
              "Fetching deals pipeline & active records...",
              "Applying permissions and stage filters...",
              "Almost ready! Rendering your pipeline..."
            ]}
          />
        ) : deals.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Handshake size={48} className="text-muted mb-4" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
            <h3>No deals found</h3>
            <p className="text-muted" style={{ maxWidth: '420px', margin: '8px auto 20px' }}>
              {isFiltered
                ? "No deals matched your search and filter criteria. Try adjusting or clearing your filters."
                : viewMode === 'MY_DEALS'
                ? "You are not an owner or collaborator on any deals yet."
                : viewMode === 'VIA_COMPANY'
                ? "No deals belong to teammates under your owned companies."
                : "Get started by creating your first deal in the pipeline."}
            </p>
            {isFiltered ? (
              <button className="btn btn-secondary" onClick={handleClearFilters}>
                <RotateCcw size={14} /> Clear All Filters
              </button>
            ) : (
              <button className="btn btn-primary" onClick={openNewModal}>
                <Plus size={16} /> Create First Deal
              </button>
            )}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {isManager && (
                  <th style={{ width: '42px', textAlign: 'center', padding: '12px 10px' }}>
                    <input
                      type="checkbox"
                      checked={deals.length > 0 && deals.every(d => selectedDealIds.includes(d.id))}
                      onChange={toggleSelectAllCurrentPage}
                      style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                      title="Select / Deselect all deals on current page"
                    />
                  </th>
                )}
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortChange('title')}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    TITLE
                  </div>
                </th>
                <th>COMPANY</th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortChange('value')}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    VALUE
                    {sortBy === 'value' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSortChange('expected_close_date')}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    CLOSE DATE
                    {sortBy === 'expected_close_date' && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th>STAGE</th>
                <th>DEAL OWNER</th>
                <th>YOUR ACCESS</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => {
                const isOwner = deal.owner_id === user.id;
                const isCollab = deal.collaborators?.some(c => c.id === user.id);
                // const canEdit = isManager || isOwner || isCollab;
                // const canManageCollabs = isManager || isOwner;
                // const canDelete = isManager || isOwner;
                const canEdit = true;
                const canManageCollabs = true;
                const canDelete = true;
                const isSelected = selectedDealIds.includes(deal.id);
                
                return (
                  <tr key={deal.id} style={{ background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined }}>
                    {true && (
                      <td style={{ width: '42px', textAlign: 'center', padding: '12px 10px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDealSelect(deal.id)}
                          style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                        />
                      </td>
                    )}
                    <td className="font-medium text-white">{highlightMatch(deal.title, debouncedSearch)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-muted" />
                        {highlightMatch(deal.company?.name || "Unknown", debouncedSearch)}
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
                    <td>{new Date(deal.expected_close_date).toLocaleDateString()}</td>
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

                        {/* Interactive Stage Dropdown */}
                        <select
                          className="form-select"
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            background: 'var(--color-bg)',
                            border: '1px solid var(--color-border)',
                            color: 'var(--color-text)',
                            cursor: 'pointer',
                            width: '100%'
                          }}
                          value={deal.stage}
                          onChange={(e) => handleStageSelectChange(deal, e.target.value)}
                          title="Select target stage to advance, step back, close, or test transition rules"
                        >
                          <option value="NEW">NEW (10%)</option>
                          <option value="QUALIFIED">QUALIFIED (25%)</option>
                          <option value="PROPOSAL">PROPOSAL (50%)</option>
                          <option value="NEGOTIATION">NEGOTIATION (75%)</option>
                          <option value="WON">🏆 WON (100%)</option>
                          <option value="LOST">❌ LOST (0%)</option>
                          <option value="REOPEN">🔄 Reopen Deal</option>
                        </select>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div className="flex items-center gap-2 text-sm">
                          <UserIcon size={12} className="text-muted" />
                          <span>{deal.owner?.full_name || "Unknown"}</span>
                        </div>
                        {deal.collaborators && deal.collaborators.length > 0 && (
                          <div className="text-xs text-muted" title={deal.collaborators.map(c => c.full_name).join(', ')}>
                            +{deal.collaborators.length} collaborator{deal.collaborators.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {getUserAccessBadge(deal)}
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
                          <span className="text-muted text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} title="Read-only: You can view this deal because you own the parent company, but only the deal owner/collaborator can edit deal details.">
                            <AlertCircle size={14} /> Read-only
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

        {/* Server-Side Pagination Footer */}
        {deals.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {/* Range and Total Matches */}
            <div className="text-sm text-muted">
              {totalDeals === 1 ? (
                <>Showing <strong style={{ color: 'var(--color-text)' }}>1</strong> of <strong style={{ color: 'var(--color-text)' }}>1</strong> deal</>
              ) : (
                <>Showing <strong style={{ color: 'var(--color-text)' }}>{(page - 1) * perPage + 1}</strong> to <strong style={{ color: 'var(--color-text)' }}>{Math.min(page * perPage, totalDeals)}</strong> of <strong style={{ color: 'var(--color-text)' }}>{totalDeals}</strong> deals</>
              )}
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              
              {/* Per-Page Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px' }}>
                <span className="text-xs text-muted">Per page:</span>
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>

              {/* Prev Page Button */}
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                style={{ padding: '6px 10px' }}
                title="Previous page"
              >
                <ChevronLeft size={16} /> Prev
              </button>

              {/* Page Number Indicator */}
              <span className="text-sm" style={{ padding: '0 8px', fontWeight: 500, color: 'var(--color-text)' }}>
                Page {page} of {totalPages}
              </span>

              {/* Next Page Button */}
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                style={{ padding: '6px 10px' }}
                title="Next page"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
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
                  <label className="form-label">Value (₹) *</label>
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
                      <option value="1">🚨 TEST: Force Company ID 1 (Try creating a deal here)</option>
                      <option value="2">🚨 TEST: Force Company ID 2 (Try creating a deal here)</option>
                      <option value="3">🚨 TEST: Force Company ID 3 (Try creating a deal here)</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {true && (
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

                    {editingDeal && formData.owner_id && parseInt(formData.owner_id, 10) !== editingDeal.owner_id && (
                      <div style={{
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        marginTop: '10px'
                      }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text)' }}>
                          <input
                            type="checkbox"
                            checked={keepPreviousOwner}
                            onChange={(e) => setKeepPreviousOwner(e.target.checked)}
                          />
                          <span>Keep previous owner (<strong>{editingDeal.owner?.full_name}</strong>) as a collaborator</span>
                        </label>
                        <p className="text-xs text-muted" style={{ margin: '4px 0 0 24px' }}>
                          {keepPreviousOwner
                            ? `${editingDeal.owner?.full_name} will remain on this deal as an active collaborator.`
                            : `${editingDeal.owner?.full_name} will be removed from this deal entirely.`}
                        </p>
                      </div>
                    )}
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
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={20} />
                  Deal Timeline
                </h3>
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
                <div style={{ position: 'relative', padding: '8px 4px' }}>
                  {historyEvents.map((h, idx) => {
                    const isLast = idx === historyEvents.length - 1;
                    
                    let icon = <History size={14} style={{ color: '#818cf8' }} />;
                    let actionElement = null;
                    let badgeBg = 'rgba(99, 102, 241, 0.12)';
                    let badgeBorder = 'rgba(99, 102, 241, 0.3)';

                    if (h.event_type === 'DEAL_CREATED') {
                      icon = <Sparkles size={14} style={{ color: '#38bdf8' }} />;
                      badgeBg = 'rgba(56, 189, 248, 0.12)';
                      badgeBorder = 'rgba(56, 189, 248, 0.3)';
                      actionElement = (
                        <span>created deal in <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span> stage with value <strong>₹{Number(h.new_value?.value || 0).toLocaleString('en-IN')}</strong></span>
                      );
                    } else if (h.event_type === 'STAGE_CHANGED') {
                      icon = <ArrowRight size={14} style={{ color: '#818cf8' }} />;
                      badgeBg = 'rgba(129, 140, 248, 0.12)';
                      badgeBorder = 'rgba(129, 140, 248, 0.3)';
                      actionElement = (
                        <span>advanced stage from <span className={`badge badge-${h.old_value?.stage?.toLowerCase()}`}>{h.old_value?.stage}</span> to <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span></span>
                      );
                    } else if (h.event_type === 'STAGE_BACKWARD') {
                      icon = <RotateCcw size={14} style={{ color: '#fbbf24' }} />;
                      badgeBg = 'rgba(251, 191, 36, 0.12)';
                      badgeBorder = 'rgba(251, 191, 36, 0.3)';
                      actionElement = (
                        <span>moved stage backward from <span className={`badge badge-${h.old_value?.stage?.toLowerCase()}`}>{h.old_value?.stage}</span> to <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span></span>
                      );
                    } else if (h.event_type === 'DEAL_CLOSED') {
                      const isWon = h.new_value?.stage === 'WON';
                      icon = isWon ? <CheckCircle2 size={14} style={{ color: '#34d399' }} /> : <XCircle size={14} style={{ color: '#f87171' }} />;
                      badgeBg = isWon ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)';
                      badgeBorder = isWon ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)';
                      actionElement = (
                        <span>closed deal as <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span> <span className="text-muted text-xs">(last stage was {h.old_value?.stage})</span></span>
                      );
                    } else if (h.event_type === 'DEAL_REOPENED') {
                      icon = <RotateCcw size={14} style={{ color: '#a78bfa' }} />;
                      badgeBg = 'rgba(167, 139, 250, 0.12)';
                      badgeBorder = 'rgba(167, 139, 250, 0.3)';
                      actionElement = (
                        <span>reopened deal to <span className={`badge badge-${h.new_value?.stage?.toLowerCase()}`}>{h.new_value?.stage}</span> stage</span>
                      );
                    } else if (h.event_type === 'OWNER_CHANGED') {
                      icon = <UserCheck size={14} style={{ color: '#22d3ee' }} />;
                      badgeBg = 'rgba(34, 211, 238, 0.12)';
                      badgeBorder = 'rgba(34, 211, 238, 0.3)';
                      actionElement = (
                        <span>reassigned owner to <strong>{h.new_value?.owner_name || `User #${h.new_value?.owner_id}`}</strong> <span className="text-muted text-xs">(previous: {h.old_value?.owner_name || `User #${h.old_value?.owner_id}`})</span></span>
                      );
                    } else if (h.event_type === 'COLLABORATOR_ADDED') {
                      icon = <UserPlus size={14} style={{ color: '#2dd4bf' }} />;
                      badgeBg = 'rgba(45, 212, 191, 0.12)';
                      badgeBorder = 'rgba(45, 212, 191, 0.3)';
                      actionElement = (
                        <span>added collaborator <strong>{h.new_value?.user_name}</strong>{h.new_value?.note ? ` (${h.new_value.note})` : ''}</span>
                      );
                    } else if (h.event_type === 'COLLABORATOR_REMOVED') {
                      icon = <UserMinus size={14} style={{ color: '#94a3b8' }} />;
                      badgeBg = 'rgba(148, 163, 184, 0.12)';
                      badgeBorder = 'rgba(148, 163, 184, 0.3)';
                      actionElement = (
                        <span>removed collaborator <strong>{h.old_value?.user_name}</strong></span>
                      );
                    } else if (h.event_type === 'NOTE_ADDED') {
                      icon = <MessageSquare size={14} style={{ color: '#818cf8' }} />;
                      badgeBg = 'rgba(129, 140, 248, 0.12)';
                      badgeBorder = 'rgba(129, 140, 248, 0.3)';
                      actionElement = <span>added a note</span>;
                    }

                    const rawDate = h.created_at ? (h.created_at.endsWith('Z') || h.created_at.includes('+') ? h.created_at : h.created_at + 'Z') : new Date().toISOString();
                    const dateObj = new Date(rawDate);
                    const timeStr = dateObj.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
                    const dateStr = dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });

                    return (
                      <div key={h.id} style={{ position: 'relative', display: 'flex', gap: '14px', paddingBottom: isLast ? '6px' : '22px' }}>
                        {/* Connecting line */}
                        {!isLast && (
                          <div style={{
                            position: 'absolute',
                            left: '15px',
                            top: '30px',
                            bottom: '0',
                            width: '2px',
                            background: 'var(--color-border)'
                          }} />
                        )}

                        {/* Icon Node */}
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: badgeBg,
                          border: `1px solid ${badgeBorder}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          zIndex: 1
                        }}>
                          {icon}
                        </div>

                        {/* Content Area */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Fixed Header Row: Author on left, Timestamp on right */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                              {h.actor?.full_name || `User #${h.actor_id}`}
                            </span>
                            <span style={{ 
                              fontSize: '0.8rem', 
                              background: 'var(--color-bg-tertiary)', 
                              border: '1px solid var(--color-border)', 
                              padding: '2px 9px', 
                              borderRadius: '6px', 
                              whiteSpace: 'nowrap', 
                              marginLeft: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <strong style={{ color: 'var(--color-text)', fontSize: '0.825rem' }}>{timeStr}</strong>
                              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.725rem' }}>{dateStr}</span>
                            </span>
                          </div>

                          {/* Action Subtitle (for non-notes or lifecycle actions) */}
                          {h.event_type !== 'NOTE_ADDED' && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                              {actionElement}
                            </div>
                          )}

                          {/* Note Card */}
                          {h.event_type === 'NOTE_ADDED' && h.new_value?.note && (
                            <div style={{
                              marginTop: '4px',
                              background: 'var(--color-bg-card)',
                              border: '1px solid var(--color-border)',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              fontSize: '0.875rem',
                              color: 'var(--color-text)',
                              lineHeight: 1.5,
                              wordBreak: 'break-word',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                              {h.new_value.note}
                            </div>
                          )}

                          {/* Backward Stage Reason */}
                          {h.event_type === 'STAGE_BACKWARD' && h.reason && (
                            <div style={{
                              marginTop: '6px',
                              background: 'rgba(245, 158, 11, 0.08)',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                              fontSize: '0.825rem',
                              color: '#fbbf24',
                              fontStyle: 'italic',
                              lineHeight: 1.4
                            }}>
                              Reason: "{h.reason}"
                            </div>
                          )}
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

      {/* Goal 7: Floating Bulk Action Bar for Sales Managers */}
      {selectedDealIds.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '28px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 900,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-primary)',
          borderRadius: '12px',
          padding: '10px 22px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'var(--color-primary)',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.8rem'
            }}>
              {selectedDealIds.length}
            </span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              {selectedDealIds.length === 1 ? 'deal selected' : 'deals selected'}
            </span>
          </div>

          <div style={{ height: '20px', width: '1px', background: 'var(--color-border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setBulkAdvanceOutcome("SKIP");
                setIsBulkAdvanceOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <FastForward size={14} /> Bulk Advance
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setBulkTargetOwnerId(reps[0]?.id ? String(reps[0].id) : "");
                setBulkKeepAsCollab(true);
                setIsBulkReassignOpen(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserCheck size={14} /> Bulk Reassign
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-sm text-muted"
              onClick={() => setSelectedDealIds([])}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
              title="Clear selection"
            >
              <X size={14} /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Goal 7: Bulk Advance Confirmation Modal */}
      {isBulkAdvanceOpen && (() => {
        const selectedDealsList = deals.filter(d => selectedDealIds.includes(d.id));
        const negotiationDealsCount = selectedDealsList.filter(d => d.stage === 'NEGOTIATION').length;
        const earlyDealsCount = selectedDealsList.filter(d => ['NEW', 'QUALIFIED', 'PROPOSAL'].includes(d.stage)).length;
        const closedDealsCount = selectedDealsList.filter(d => ['WON', 'LOST'].includes(d.stage)).length;

        return (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsBulkAdvanceOpen(false); }}>
            <div className="modal" style={{ maxWidth: '490px' }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FastForward size={18} className="text-primary" />
                  <h3>Bulk Advance Deals</h3>
                </div>
                <button className="modal-close" onClick={() => setIsBulkAdvanceOpen(false)}>✕</button>
              </div>

              <div className="modal-body">
                <p className="text-muted" style={{ marginBottom: '14px', fontSize: '0.875rem' }}>
                  You have selected <strong>{selectedDealIds.length}</strong> {selectedDealIds.length === 1 ? 'deal' : 'deals'} to advance:
                </p>

                {/* Stage Breakdown Badges */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {earlyDealsCount > 0 && (
                    <span className="badge badge-indigo" style={{ fontSize: '0.75rem' }}>
                      {earlyDealsCount} in Early Pipeline
                    </span>
                  )}
                  {negotiationDealsCount > 0 && (
                    <span className="badge badge-amber" style={{ fontSize: '0.75rem' }}>
                      {negotiationDealsCount} in Negotiation
                    </span>
                  )}
                  {closedDealsCount > 0 && (
                    <span className="badge badge-gray" style={{ fontSize: '0.75rem' }}>
                      {closedDealsCount} Already Closed
                    </span>
                  )}
                </div>

                {/* Conditionally show Negotiation Resolution Box only if Negotiation deals exist */}
                {negotiationDealsCount > 0 ? (
                  <div style={{
                    background: 'var(--color-bg-secondary)',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    marginBottom: '16px'
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '10px' }}>
                      Deals in Negotiation ({negotiationDealsCount}):
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.825rem' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="negotiationOutcome"
                          value="SKIP"
                          checked={bulkAdvanceOutcome === 'SKIP'}
                          onChange={() => setBulkAdvanceOutcome('SKIP')}
                          style={{ marginTop: '2px', accentColor: 'var(--color-primary)' }}
                        />
                        <div>
                          <strong>Keep as it is</strong> <span className="text-muted">— Skip negotiation deals for now</span>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="negotiationOutcome"
                          value="WON"
                          checked={bulkAdvanceOutcome === 'WON'}
                          onChange={() => setBulkAdvanceOutcome('WON')}
                          style={{ marginTop: '2px', accentColor: 'var(--color-primary)' }}
                        />
                        <div>
                          <strong>Mark as WON</strong> <span className="text-muted">— Close Negotiation deals as Won (100% win probability)</span>
                        </div>
                      </label>

                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="negotiationOutcome"
                          value="LOST"
                          checked={bulkAdvanceOutcome === 'LOST'}
                          onChange={() => setBulkAdvanceOutcome('LOST')}
                          style={{ marginTop: '2px', accentColor: 'var(--color-primary)' }}
                        />
                        <div>
                          <strong>Mark as LOST</strong> <span className="text-muted">— Close Negotiation deals as Lost (0% win probability)</span>
                        </div>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--color-bg-secondary)',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    marginBottom: '16px',
                    fontSize: '0.825rem'
                  }}>
                    <div style={{ fontWeight: 600, color: 'var(--color-text-white)', marginBottom: '4px' }}>
                      Standard Sequential Progression:
                    </div>
                    <div className="text-muted" style={{ lineHeight: 1.5 }}>
                      Selected deals will advance one stage forward:<br />
                      • <code>NEW</code> → <code>QUALIFIED</code><br />
                      • <code>QUALIFIED</code> → <code>PROPOSAL</code><br />
                      • <code>PROPOSAL</code> → <code>NEGOTIATION</code>
                    </div>
                  </div>
                )}

                {closedDealsCount > 0 && (
                  <div className="text-xs text-muted" style={{ lineHeight: 1.4, marginTop: '8px' }}>
                    * Note: {closedDealsCount} {closedDealsCount === 1 ? 'deal is' : 'deals are'} already closed and will be safely skipped.
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setIsBulkAdvanceOpen(false)} disabled={bulkAdvanceLoading}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleBulkAdvanceSubmit} disabled={bulkAdvanceLoading}>
                  {bulkAdvanceLoading ? "Advancing..." : `Advance ${selectedDealIds.length} Deals`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Goal 7: Bulk Reassign Modal */}
      {isBulkReassignOpen && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setIsBulkReassignOpen(false); }}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={18} className="text-primary" />
                <h3>Bulk Reassign Owner</h3>
              </div>
              <button className="modal-close" onClick={() => setIsBulkReassignOpen(false)}>✕</button>
            </div>

            <div className="modal-body">
              <p className="text-muted" style={{ marginBottom: '16px', fontSize: '0.875rem' }}>
                Reassign <strong>{selectedDealIds.length}</strong> selected {selectedDealIds.length === 1 ? 'deal' : 'deals'} to a designated Sales Rep.
              </p>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Select New Owner *</label>
                <select
                  className="form-select"
                  value={bulkTargetOwnerId}
                  onChange={(e) => setBulkTargetOwnerId(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Select a Sales Rep --</option>
                  {reps.map(r => (
                    <option key={r.id} value={r.id}>{r.full_name} ({r.email})</option>
                  ))}
                </select>
              </div>

              <div style={{
                background: 'var(--color-bg-secondary)',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <input
                  type="checkbox"
                  id="bulkKeepAsCollab"
                  checked={bulkKeepAsCollab}
                  onChange={(e) => setBulkKeepAsCollab(e.target.checked)}
                  style={{ marginTop: '3px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <label htmlFor="bulkKeepAsCollab" style={{ fontSize: '0.825rem', cursor: 'pointer' }}>
                  <strong>Keep previous owner(s) as collaborator(s)</strong>
                  <div className="text-xs text-muted" style={{ marginTop: '2px', lineHeight: 1.4 }}>
                    Previous reps will automatically retain access to view and collaborate on their reassigned deals.
                  </div>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setIsBulkReassignOpen(false)} disabled={bulkReassignLoading}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleBulkReassignSubmit} disabled={bulkReassignLoading || !bulkTargetOwnerId}>
                {bulkReassignLoading ? "Reassigning..." : `Reassign ${selectedDealIds.length} Deals`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal 7: Bulk Operation Results Modal */}
      {isBulkResultsOpen && bulkResultsData && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleCloseBulkResults(); }}>
          <div className="modal" style={{ maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div>
                <h3>Bulk Operation Results</h3>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                  <span className="badge badge-green" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={12} />
                    {bulkResultsData.total_succeeded} Succeeded
                  </span>
                  {bulkResultsData.total_failed > 0 && (
                    <span className="badge badge-red" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <XCircle size={12} />
                      {bulkResultsData.total_failed} Ineligible / Rejected
                    </span>
                  )}
                  <span className="text-xs text-muted" style={{ marginLeft: '4px' }}>
                    Total Processed: {bulkResultsData.total_requested}
                  </span>
                </div>
              </div>
              <button className="modal-close" onClick={handleCloseBulkResults}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '12px 20px', overflowY: 'auto', flex: 1 }}>
              <table className="table" style={{ fontSize: '0.825rem', margin: 0 }}>
                <thead>
                  <tr>
                    <th>DEAL</th>
                    <th style={{ width: '105px' }}>STATUS</th>
                    <th>OUTCOME / REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkResultsData.results?.map((res, idx) => (
                    <tr key={idx}>
                      <td className="font-medium text-white" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {res.deal_title || `Deal #${res.deal_id}`}
                      </td>
                      <td>
                        {res.success ? (
                          <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> Success
                          </span>
                        ) : (
                          <span className="badge badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <XCircle size={12} /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="text-muted" style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                        {res.message || res.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={handleCloseBulkResults}>
                Close & Refresh Deals
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
