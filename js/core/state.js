export let currentUser = null;
export let currentUserData = null;
export let allUsersCache = [];
export let allFundRequestsCache = [];
export let unifiedHistoryCache = [];
export let unreadNotificationsCount = 0;
export let transactions = [];
export let pendingRequests = [];

export const setCurrentUser = (val) => currentUser = val;
export const setCurrentUserData = (val) => currentUserData = val;
export const setAllUsersCache = (val) => allUsersCache = val;
export const setAllFundRequestsCache = (val) => allFundRequestsCache = val;
export const setUnifiedHistoryCache = (val) => unifiedHistoryCache = val;
export const setUnreadNotificationsCount = (val) => unreadNotificationsCount = val;
export const setTransactions = (val) => transactions = val;
export const setPendingRequests = (val) => pendingRequests = val;
