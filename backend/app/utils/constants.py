"""
Constants for the Sales CRM application.
Single source of truth for stages, probabilities, error codes, roles, and state machine transitions.
"""


# --- Roles ---
class Roles:
    SALES_MANAGER = 'SALES_MANAGER'
    SALES_REP = 'SALES_REP'
    ALL = [SALES_MANAGER, SALES_REP]


# --- Deal Stages ---
class Stages:
    NEW = 'NEW'
    QUALIFIED = 'QUALIFIED'
    PROPOSAL = 'PROPOSAL'
    NEGOTIATION = 'NEGOTIATION'
    WON = 'WON'
    LOST = 'LOST'

    # Ordered open stages (for transition validation)
    OPEN_ORDERED = [NEW, QUALIFIED, PROPOSAL, NEGOTIATION]

    # Closed stages
    CLOSED = [WON, LOST]

    # All stages
    ALL = [NEW, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST]


# --- Win Probabilities (fixed per stage) ---
WIN_PROBABILITIES = {
    Stages.NEW: 0.10,
    Stages.QUALIFIED: 0.25,
    Stages.PROPOSAL: 0.50,
    Stages.NEGOTIATION: 0.75,
    Stages.WON: 1.00,
    Stages.LOST: 0.00,
}


# --- State Machine Transitions (Single declarative lookup table) ---
STAGE_TRANSITIONS = {
    Stages.NEW: {
        'forward': [Stages.QUALIFIED],
        'backward': [],
        'close': []
    },
    Stages.QUALIFIED: {
        'forward': [Stages.PROPOSAL],
        'backward': [Stages.NEW],
        'close': []
    },
    Stages.PROPOSAL: {
        'forward': [Stages.NEGOTIATION],
        'backward': [Stages.QUALIFIED],
        'close': []
    },
    Stages.NEGOTIATION: {
        'forward': [],
        'backward': [Stages.PROPOSAL],
        'close': [Stages.WON, Stages.LOST]
    },
    Stages.WON: {
        'forward': [],
        'backward': [],
        'close': []
    },
    Stages.LOST: {
        'forward': [],
        'backward': [],
        'close': []
    }
}


# --- Deal History Event Types ---
class EventTypes:
    DEAL_CREATED = 'DEAL_CREATED'
    STAGE_CHANGED = 'STAGE_CHANGED'
    STAGE_BACKWARD = 'STAGE_BACKWARD'
    DEAL_REOPENED = 'DEAL_REOPENED'
    DEAL_CLOSED = 'DEAL_CLOSED'
    OWNER_CHANGED = 'OWNER_CHANGED'
    COLLABORATOR_ADDED = 'COLLABORATOR_ADDED'
    COLLABORATOR_REMOVED = 'COLLABORATOR_REMOVED'
    NOTE_ADDED = 'NOTE_ADDED'

    ALL = [
        DEAL_CREATED, STAGE_CHANGED, STAGE_BACKWARD,
        DEAL_REOPENED, DEAL_CLOSED, OWNER_CHANGED,
        COLLABORATOR_ADDED, COLLABORATOR_REMOVED, NOTE_ADDED,
    ]


# --- Error Codes ---
class ErrorCodes:
    # Auth
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS'
    EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS'
    TOKEN_EXPIRED = 'TOKEN_EXPIRED'
    TOKEN_INVALID = 'TOKEN_INVALID'

    # Authorization
    NOT_AUTHORIZED = 'NOT_AUTHORIZED'
    MANAGER_REQUIRED = 'MANAGER_REQUIRED'

    # Validation
    VALIDATION_ERROR = 'VALIDATION_ERROR'

    # Business rules
    INVALID_STAGE_TRANSITION = 'INVALID_STAGE_TRANSITION'
    DEAL_CLOSED = 'DEAL_CLOSED'
    BACKWARD_REASON_REQUIRED = 'BACKWARD_REASON_REQUIRED'
    COMPANY_ARCHIVED = 'COMPANY_ARCHIVED'
    SELF_COLLABORATION = 'SELF_COLLABORATION'
    INVALID_COLLABORATOR = 'INVALID_COLLABORATOR'
    DUPLICATE_COMPANY_NAME = 'DUPLICATE_COMPANY_NAME'
    DUPLICATE_COMPANY_WARNING = 'DUPLICATE_COMPANY_WARNING'
    INVARIANT_VIOLATION = 'INVARIANT_VIOLATION'

    # Not found
    DEAL_NOT_FOUND = 'DEAL_NOT_FOUND'
    COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND'
    USER_NOT_FOUND = 'USER_NOT_FOUND'
    NOT_FOUND = 'NOT_FOUND'

    # Bulk
    BULK_PARTIAL_FAILURE = 'BULK_PARTIAL_FAILURE'


# --- Sort Field Allowlist (prevents SQL injection) ---
ALLOWED_DEAL_SORT_FIELDS = ['value', 'expected_close_date', 'updated_at']

# --- Pagination Defaults ---
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
