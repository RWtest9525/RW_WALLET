const root = document.getElementById('rw-wallet-root');

if (!root) {
    throw new Error('RW Wallet root not found');
}

root.outerHTML = String.raw`
<!-- Loading Overlay -->
    <div id="loading-overlay" class="loading-overlay hidden">
        <div class="loading-spinner"></div>
    </div>
    <!-- Main App Container -->
    <div id="app" class="container mx-auto p-4 max-w-7xl relative">
        <!-- Auth Screen -->
        <div id="auth-screen" class="hidden fade-in">
            <div class="flex min-h-full items-center justify-center">
                <div class="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
                    <div class="flex justify-center items-center mb-6">
                        <!-- Logo with fallback -->
                        <div class="logo-placeholder mr-4" id="auth-logo-fallback">
                            RW
                        </div>
                        <img src="https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg" alt="Reviews World Logo"
                            class="w-12 h-12 rounded-full mr-4 hidden" loading="eager" fetchpriority="high" decoding="async" width="48"
                            height="48" id="auth-logo"
                            onload="this.classList.remove('hidden'); this.classList.add('loaded'); document.getElementById('auth-logo-fallback')?.classList.add('hidden');"
                            onerror="this.classList.add('hidden'); document.getElementById('auth-logo-fallback')?.classList.remove('hidden');">
                        <div>
                            <h2 class="text-2xl font-bold">Reviews World</h2>
                            <p class="text-xs text-gray-500 dark:text-gray-400">Official Companion App</p>
                        </div>
                    </div>
                    <h3 id="auth-title" class="text-xl font-bold text-center mb-2">Login to your Wallet</h3>
                    <div id="auth-error" class="text-red-500 text-sm mb-4 text-center"></div>
                    <form id="auth-form" data-auth-mode="login" class="space-y-4">
                        <div class="form-field-group space-y-4">
                            <input type="text" id="name" placeholder="Full Name"
                                class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <input type="tel" id="mobile" placeholder="Mobile Number"
                                class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <input type="text" id="referral_code" placeholder="Referral Code (Mandatory)"
                                class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <input type="email" id="email" placeholder="Email Address" required
                            class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <div class="relative">
                            <input type="password" id="password" placeholder="Password" required
                                class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <button type="button" id="password-toggle"
                                class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400">
                                <svg id="eye-open" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                    stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                                <svg id="eye-closed" xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                    stroke-linecap="round" stroke-linejoin="round" class="hidden">
                                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                    <path
                                        d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                    <line x1="2" x2="22" y1="2" y2="22" />
                                </svg>
                            </button>
                        </div>
                        <div id="forgot-password-row" class="text-right -mt-2">
                            <a href="#" id="forgot-password-link" class="text-sm font-semibold text-blue-500 hover:underline">Forgot Password?</a>
                        </div>
                        <button type="submit" id="auth-button"
                            class="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition duration-300 flex justify-center items-center h-[52px]">
                            <span class="button-text">Login</span>
                            <div class="loader hidden"></div>
                        </button>
                    </form>
                    <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
                        <span id="auth-prompt">Don't have an account?</span>
                        <a href="#" id="auth-toggle" class="font-semibold text-blue-500 hover:underline">Sign Up</a>
                    </p>
                    <div class="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 dark:hover:text-blue-300">Privacy</a>
                        <a href="/terms.html" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 dark:hover:text-blue-300">Terms</a>
                        <a href="/contact.html" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 dark:hover:text-blue-300">Contact</a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Forgot Password Modal (ADD THIS SECTION ONLY) -->
        <div id="forgot-password-modal" class="fixed inset-0 z-50 hidden items-center justify-center p-4">
            <div class="fixed inset-0 bg-black bg-opacity-50" onclick="window.closeForgotPasswordModal()"></div>
            <div
                class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 transform transition-all scale-95 opacity-0 animate-modal-in">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-semibold">Reset Password</h3>
                    <button onclick="window.closeForgotPasswordModal()"
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                <div class="space-y-4">
                    <p class="text-sm text-gray-500 dark:text-gray-400">Enter your email address and we'll send you a
                        password reset link.</p>
                    <input type="email" id="reset-email-input" placeholder="Enter your email"
                        class="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <div id="reset-error" class="text-red-500 text-sm"></div>
                </div>
                <div class="mt-6 flex justify-end space-x-3">
                    <button onclick="window.closeForgotPasswordModal()"
                        class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 rounded-lg">Cancel</button>
                    <button id="send-reset-btn" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">Send Reset
                        Link</button>
                </div>
            </div>
        </div>

        <!-- Main Content (Logged In) -->
        <div id="main-content" class="hidden fade-in">
            <!-- Header with Colorful Border -->
            <header
                class="flex justify-between items-center mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md header-border">
                <div class="flex items-center">
                    <!-- Logo with fallback -->
                    <div class="logo-placeholder small mr-4" id="header-logo-fallback">
                        RW
                    </div>
                    <img src="https://i.ibb.co/x8YBYwGG/6233389803554672153.jpg" alt="Reviews World Logo"
                        class="w-10 h-10 rounded-full mr-4 hidden" loading="eager" fetchpriority="high" decoding="async"
                        width="40" height="40" id="header-logo"
                        onload="this.classList.remove('hidden'); this.classList.add('loaded'); document.getElementById('header-logo-fallback')?.classList.add('hidden');"
                        onerror="this.classList.add('hidden'); document.getElementById('header-logo-fallback')?.classList.remove('hidden');">
                    <div>
                        <h1 class="text-xl font-bold">Reviews World</h1>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Official Companion App</p>
                    </div>
                </div>
                <button id="notification-header-btn" class="relative h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-2 shadow-sm hover:scale-105 transition" title="Notifications">
                    <img src="https://cdn-icons-png.flaticon.com/512/1827/1827370.png" alt="Notifications" class="h-full w-full object-contain" loading="eager" fetchpriority="high" decoding="async">
                    <span id="notification-unread-badge" class="hidden absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-red-600 px-1.5 text-center text-[10px] font-black leading-5 text-white shadow">0</span>
                </button>
            </header>
            <!-- Main Dashboard Area (Tabs) -->
            <div id="dashboard-content">
                <div id="tabs-container" class="hidden" aria-hidden="true">
                    <button data-tab="user-panel" class="tab-button" aria-selected="true">My Wallet</button>
                    <button data-tab="admin-panel" id="admin-tab-button" class="hidden tab-button" aria-selected="false">Admin Panel</button>
                </div>

                <!-- Admin Home -->
                <div id="admin-home-panel" class="tab-content hidden">
                    <div class="space-y-5">
                        <section class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-cyan-900 to-emerald-700 p-5 sm:p-6 text-white shadow-xl">
                            <div class="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/15"></div>
                            <div class="absolute right-5 bottom-5 h-14 w-14 rounded-2xl border border-white/15 bg-white/10"></div>
                            <div class="relative flex items-start justify-between gap-4">
                                <div>
                                    <p class="text-xs font-black uppercase tracking-wide text-white/65">Admin Home</p>
                                    <h2 class="mt-2 text-2xl font-black leading-tight">Task Command Center</h2>
                                    <p class="mt-2 max-w-md text-sm leading-5 text-white/75">Create work, review progress, and manage task activity from one place.</p>
                                </div>
                                <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 p-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/3176/3176366.png" alt="Tasks" class="h-full w-full object-contain">
                                </span>
                            </div>
                            <button id="admin-manage-tasks-btn" class="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-sm transition hover:bg-cyan-50 sm:w-auto">
                                <span>Manage Task</span>
                                <span aria-hidden="true">+</span>
                            </button>
                        </section>

                        <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p class="text-xs font-bold text-gray-500 dark:text-gray-400">Open Tasks</p>
                                <p class="mt-2 text-2xl font-black">0</p>
                            </div>
                            <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p class="text-xs font-bold text-gray-500 dark:text-gray-400">In Review</p>
                                <p class="mt-2 text-2xl font-black text-cyan-600">0</p>
                            </div>
                            <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p class="text-xs font-bold text-gray-500 dark:text-gray-400">Completed</p>
                                <p class="mt-2 text-2xl font-black text-emerald-600">0</p>
                            </div>
                            <div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                                <p class="text-xs font-bold text-gray-500 dark:text-gray-400">Issues</p>
                                <p class="mt-2 text-2xl font-black text-rose-600">0</p>
                            </div>
                        </section>

                        <section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <h3 class="text-lg font-bold">Task Layout</h3>
                                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">This is admin-only for testing before it is opened for users.</p>
                                </div>
                                <button id="admin-manage-tasks-secondary-btn" class="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900">Manage</button>
                            </div>
                            <div class="mt-4 grid gap-3 sm:grid-cols-3">
                                <div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                                    <p class="text-xs font-black uppercase text-gray-400">Step 1</p>
                                    <p class="mt-1 font-bold">Create task</p>
                                </div>
                                <div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                                    <p class="text-xs font-black uppercase text-gray-400">Step 2</p>
                                    <p class="mt-1 font-bold">Assign and track</p>
                                </div>
                                <div class="rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
                                    <p class="text-xs font-black uppercase text-gray-400">Step 3</p>
                                    <p class="mt-1 font-bold">Approve result</p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <!-- User Panel -->
                <div id="user-panel" class="tab-content">
                    <div class="grid grid-cols-1 gap-5">
                        <div class="space-y-5">
                            <div class="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-emerald-700 dark:from-gray-800 dark:via-blue-950 dark:to-emerald-900 p-6 rounded-2xl shadow-xl text-white">
                                <div class="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/15"></div>
                                <div class="absolute right-5 bottom-3 min-w-20 h-14 rounded-2xl bg-white/10 border border-white/15 flex flex-col items-center justify-center px-3 text-right">
                                    <span class="text-[9px] uppercase tracking-wide text-white/55">USD</span>
                                    <span id="user-balance-usd" class="text-sm font-bold text-white">$--</span>
                                </div>
                                <div class="relative">
                                    <div class="flex items-center justify-between">
                                        <h3 class="text-sm font-medium text-white/75">Your Balance</h3>
                                        <div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center p-2 shadow-sm">
                                            <img src="https://cdn-icons-png.flaticon.com/512/12449/12449036.png" alt="Top up" class="w-full h-full object-contain">
                                        </div>
                                    </div>
                                    <p id="user-balance" class="text-4xl font-bold mt-4 tracking-tight">₹0.00</p>
                                </div>
                            </div>
                            <div class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700">
                                <div class="mb-4 flex items-center justify-between gap-3">
                                    <h3 class="text-lg font-semibold">Actions</h3>
                                    <button id="wallet-history-action-btn"
                                        class="inline-flex w-44 shrink-0 items-center justify-start gap-2 whitespace-nowrap rounded-2xl border border-blue-100 bg-blue-50 px-2.5 py-2 text-xs font-black text-blue-700 shadow-sm transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/35">
                                        <span class="flex h-7 w-7 items-center justify-center rounded-full border border-blue-100 bg-white p-1.5 shadow-sm dark:border-blue-800 dark:bg-gray-800">
                                            <img src="https://cdn-icons-png.flaticon.com/512/3652/3652191.png" alt="History" class="h-full w-full rounded-full object-contain" loading="eager" fetchpriority="high" decoding="async">
                                        </span>
                                        <span class="leading-none">Transaction History</span>
                                    </button>
                                </div>
                                <div class="grid grid-cols-3 gap-2 sm:gap-3">
                                <button id="withdraw-fund-btn"
                                    class="relative group w-full min-h-28 flex flex-col items-center justify-between gap-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-200 font-semibold p-3 rounded-xl hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition border border-yellow-200 dark:border-yellow-800 text-center">
                                    <span class="absolute right-1.5 top-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">0% tax</span>
                                    <span class="w-12 h-12 rounded-xl bg-yellow-500 flex items-center justify-center shadow-sm p-2">
                                        <img src="https://cdn-icons-png.flaticon.com/512/7939/7939990.png" alt="Withdraw" class="w-full h-full object-contain">
                                    </span>
                                    <span class="text-xs sm:text-sm leading-tight">Withdraw Fund</span>
                                </button>
                                <button id="redeem-gift-card-btn"
                                    class="group w-full min-h-28 flex flex-col items-center justify-between gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-200 font-semibold p-3 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition border border-green-200 dark:border-green-800 text-center">
                                    <span class="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center shadow-sm p-2">
                                        <img src="https://cdn-icons-png.flaticon.com/512/2611/2611152.png" alt="Gift card" class="w-full h-full object-contain">
                                    </span>
                                    <span class="text-xs sm:text-sm leading-tight">Redeem Gift Card</span>
                                </button>
                                <button id="pay-to-wallet-btn"
                                    class="group w-full min-h-28 flex flex-col items-center justify-between gap-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-200 font-semibold p-3 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition border border-purple-200 dark:border-purple-800 text-center">
                                    <span class="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center shadow-sm p-2">
                                        <img src="https://cdn-icons-png.flaticon.com/512/33/33308.png" alt="Pay to wallet" class="w-full h-full object-contain">
                                    </span>
                                    <span class="text-xs sm:text-sm leading-tight">Pay to Wallet</span>
                                </button>
                                <button id="mobile-recharge-btn"
                                    class="relative group w-full min-h-28 flex flex-col items-center justify-between gap-2 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-200 font-semibold p-3 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/30 transition border border-sky-200 dark:border-sky-800 text-center">
                                    <span class="absolute right-1.5 top-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">1% off</span>
                                    <span class="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center shadow-sm p-2">
                                        <img src="https://cdn-icons-png.flaticon.com/512/4108/4108841.png" alt="Mobile recharge" class="w-full h-full object-contain">
                                    </span>
                                    <span class="text-xs sm:text-sm leading-tight">Mobile Recharge</span>
                                </button>
                                <button id="partner-btn"
                                    class="relative group w-full min-h-28 flex flex-col items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200 font-semibold p-3 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition border border-emerald-200 dark:border-emerald-800 text-center">
                                    <span class="absolute right-1.5 top-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">1% earn</span>
                                    <span class="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm p-2">
                                        <img src="https://cdn-icons-png.flaticon.com/512/3135/3135706.png" alt="Become Partner" class="w-full h-full object-contain">
                                    </span>
                                    <span class="text-xs sm:text-sm leading-tight">Become Partner</span>
                                </button>
                                </div>
                            </div>
                            <div class="pb-2 pt-1 text-center text-[11px] sm:text-xs font-semibold text-gray-400 dark:text-gray-500">
                                &copy; Reviews World. All Rights Reserved.
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Admin Panel Dashboard -->
                <div id="admin-panel" class="tab-content hidden">
                    <div class="relative overflow-hidden mb-6 bg-gradient-to-br from-gray-950 via-indigo-900 to-blue-700 dark:from-gray-800 dark:via-indigo-950 dark:to-blue-950 p-6 rounded-2xl shadow-xl text-white">
                        <div class="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-white/15"></div>
                        <div class="absolute right-7 bottom-6 h-16 w-16 rounded-2xl bg-white/10 border border-white/15"></div>
                        <h3 class="relative text-lg font-semibold mb-2 text-white/85">My Admin Wallet</h3>
                        <p id="admin-wallet-balance" class="relative text-4xl font-bold text-white">₹0.00</p>
                        <button id="manage-admin-wallet-btn"
                            class="relative mt-4 w-full sm:w-auto px-6 py-3 bg-white/15 text-white font-semibold rounded-xl hover:bg-white/25 transition border border-white/20">Add/Remove
                            My Funds</button>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                        <button id="analytics-total-users-card" class="text-left bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700/70 transition">
                            <h4 class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-semibold">Total Users</h4>
                            <p id="analytics-total-users" class="text-2xl sm:text-3xl font-black mt-1">0</p>
                            <p class="mt-1 text-[10px] font-bold uppercase text-gray-400">View all</p>
                        </button>
                        <button id="analytics-new-members-card" class="text-left bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                            <h4 class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-semibold">New Members</h4>
                            <p id="analytics-new-members" class="text-2xl sm:text-3xl font-black mt-1 text-blue-500">0</p>
                            <p class="mt-1 text-[10px] font-bold uppercase text-blue-400">15 days</p>
                        </button>
                        <button id="analytics-pending-withdrawals-card" class="text-left bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:bg-amber-50 dark:hover:bg-amber-900/20 transition">
                            <h4 class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-semibold">Pending Withdrawals</h4>
                            <p id="analytics-pending-reqs" class="text-2xl sm:text-3xl font-black mt-1">0</p>
                            <p id="analytics-pending-amount" class="mt-1 text-xs font-bold text-gray-600 dark:text-gray-300">&#8377;0.00</p>
                        </button>
                        <button id="analytics-minus-balance-card" class="text-left bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                            <h4 class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-semibold">Minus Balance User</h4>
                            <p id="analytics-minus-balance-users" class="text-2xl sm:text-3xl font-black mt-1 text-red-500">0</p>
                            <p id="analytics-minus-balance-total" class="mt-1 text-xs font-bold text-red-400">&#8377;0.00</p>
                        </button>
                        <button id="analytics-total-funds-card" class="text-left bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition">
                            <h4 class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-semibold">Members Wallet Fund</h4>
                            <p id="analytics-total-funds" class="text-2xl sm:text-3xl font-black mt-1">&#8377;0.00</p>
                            <p class="mt-1 text-[10px] font-bold uppercase text-emerald-500">View users</p>
                        </button>
                        <button id="analytics-gift-cards-card" class="text-left bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-0.5 hover:shadow-md hover:bg-purple-50 dark:hover:bg-purple-900/20 transition">
                            <h4 class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-semibold">Gift Cards Redeemed</h4>
                            <p id="analytics-gift-cards" class="text-2xl sm:text-3xl font-black mt-1">0</p>
                            <p class="mt-1 text-[10px] font-bold uppercase text-purple-400">Open gift codes</p>
                        </button>
                    </div>

                    <!-- Fixed Quick Actions Bar -->
                    <div class="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl shadow-md mb-6 border border-gray-100 dark:border-gray-700">
                        <h3 class="text-lg font-semibold mb-4">Quick Actions</h3>
                        <div class="grid grid-cols-3 lg:grid-cols-4 gap-3">
                            <button id="admin-withdrawals-btn"
                                class="relative flex flex-col items-center justify-center p-3 min-h-28 bg-blue-50 dark:bg-blue-900/20 rounded-2xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition border border-blue-200 dark:border-blue-800 shadow-sm">
                                <span id="admin-withdrawal-request-badge" class="admin-alert-badge hidden absolute right-2 top-2 min-w-6 h-6 rounded-full bg-red-600 px-2 text-center text-xs font-black leading-6 text-white shadow"></span>
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/7939/7939990.png" class="h-8 w-8 object-contain" alt="Withdrawals">
                                </span>
                                <span class="text-sm font-medium text-blue-700 dark:text-blue-300">Withdrawals</span>
                            </button>
                            <button id="admin-users-btn"
                                class="relative flex flex-col items-center justify-center p-3 min-h-28 bg-green-50 dark:bg-green-900/20 rounded-2xl hover:bg-green-100 dark:hover:bg-green-900/30 transition border border-green-200 dark:border-green-800 shadow-sm">
                                <span id="admin-signup-approval-badge" class="admin-alert-badge hidden absolute right-2 top-2 min-w-6 h-6 rounded-full bg-red-600 px-2 text-center text-xs font-black leading-6 text-white shadow"></span>
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/681/681494.png" class="h-8 w-8 object-contain" alt="Users">
                                </span>
                                <span class="text-sm font-medium text-green-700 dark:text-green-300">Users</span>
                            </button>
                            <button id="admin-manage-settings-btn"
                                class="flex flex-col items-center justify-center p-3 min-h-28 bg-purple-50 dark:bg-purple-900/20 rounded-2xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition border border-purple-200 dark:border-purple-800 shadow-sm">
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/3524/3524659.png" class="h-8 w-8 object-contain" alt="Manage Settings">
                                </span>
                                <span class="text-sm font-medium text-purple-700 dark:text-purple-300">Manage Settings</span>
                            </button>
                            <button id="admin-manage-admins-btn"
                                class="flex flex-col items-center justify-center p-3 min-h-28 bg-violet-50 dark:bg-violet-900/20 rounded-2xl hover:bg-violet-100 dark:hover:bg-violet-900/30 transition border border-violet-200 dark:border-violet-800 shadow-sm hidden">
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" class="h-8 w-8 object-contain" alt="Manage Admins">
                                </span>
                                <span class="text-sm font-medium text-violet-700 dark:text-violet-300">Manage Admins</span>
                            </button>
                            <button id="admin-gift-codes-btn"
                                class="flex flex-col items-center justify-center p-3 min-h-28 bg-purple-50 dark:bg-purple-900/20 rounded-2xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition border border-purple-200 dark:border-purple-800 shadow-sm">
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/2611/2611152.png" class="h-8 w-8 object-contain" alt="Gift Codes">
                                </span>
                                <span class="text-sm font-medium text-purple-700 dark:text-purple-300">Gift Codes</span>
                            </button>
                            <button id="admin-recharge-requests-btn"
                                class="flex flex-col items-center justify-center p-3 min-h-28 bg-sky-50 dark:bg-sky-900/20 rounded-2xl hover:bg-sky-100 dark:hover:bg-sky-900/30 transition border border-sky-200 dark:border-sky-800 shadow-sm">
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/4108/4108841.png" class="h-8 w-8 object-contain" alt="Recharge Requests">
                                </span>
                                <span class="text-sm font-medium text-sky-700 dark:text-sky-300">Recharge Requests</span>
                            </button>
                            <button id="admin-loans-btn"
                                class="relative flex flex-col items-center justify-center p-3 min-h-28 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition border border-indigo-200 dark:border-indigo-800 shadow-sm">
                                <span id="admin-loan-request-badge" class="hidden absolute right-2 top-2 min-w-6 h-6 rounded-full bg-red-600 px-2 text-center text-xs font-black leading-6 text-white shadow"></span>
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/9197/9197103.png" class="h-8 w-8 object-contain" alt="Manage Loan">
                                </span>
                                <span class="text-sm font-medium text-indigo-700 dark:text-indigo-300">Manage Loan</span>
                            </button>
                            <button id="admin-investments-btn"
                                class="flex flex-col items-center justify-center p-3 min-h-28 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition border border-emerald-200 dark:border-emerald-800 shadow-sm">
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/3135/3135706.png" class="h-8 w-8 object-contain" alt="Partner">
                                </span>
                                <span class="text-sm font-medium text-emerald-700 dark:text-emerald-300">Manage Partner</span>
                            </button>
                            <button id="admin-chats-btn"
                                class="relative flex flex-col items-center justify-center p-3 min-h-28 bg-rose-50 dark:bg-rose-900/20 rounded-2xl hover:bg-rose-100 dark:hover:bg-rose-900/30 transition border border-rose-200 dark:border-rose-800 shadow-sm">
                                <span id="admin-chat-unread-badge" class="hidden absolute right-2 top-2 min-w-6 h-6 rounded-full bg-red-600 px-2 text-center text-xs font-black leading-6 text-white shadow"></span>
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/5962/5962463.png" class="h-8 w-8 object-contain" alt="Manage Chat">
                                </span>
                                <span class="text-sm font-medium text-rose-700 dark:text-rose-300">Manage Chat</span>
                            </button>
                            <button id="admin-tasks-btn"
                                class="flex flex-col items-center justify-center p-3 min-h-28 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition border border-cyan-200 dark:border-cyan-800 shadow-sm">
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/3176/3176366.png" class="h-8 w-8 object-contain" alt="Home">
                                </span>
                                <span class="text-sm font-medium text-cyan-700 dark:text-cyan-300">Manage Task</span>
                            </button>
                            <button id="admin-settlement-btn"
                                class="flex flex-col items-center justify-center p-3 min-h-28 bg-amber-50 dark:bg-amber-900/20 rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition border border-amber-200 dark:border-amber-800 shadow-sm">
                                <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-gray-800 shadow-sm mb-2">
                                    <img src="https://cdn-icons-png.flaticon.com/512/584/584026.png" class="h-8 w-8 object-contain" alt="Settlement">
                                </span>
                                <span id="admin-settlement-btn-label" class="text-sm font-medium text-amber-700 dark:text-amber-300">Settlements</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <nav id="bottom-nav" class="fixed z-50">
                <div id="bottom-nav-grid" class="mx-auto grid w-full max-w-xl grid-cols-5 items-center px-2 pt-2 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400" style="--bottom-nav-count: 5;">
                    <button id="bottom-refer-btn" class="bottom-nav-btn flex flex-col items-center gap-1 py-1">
                        <span class="bottom-nav-icon flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 transition">
                            <img src="https://cdn-icons-png.flaticon.com/512/929/929610.png" alt="Refer" class="bottom-nav-img" loading="eager" fetchpriority="high" decoding="async">
                        </span>
                        <span>Refer</span>
                    </button>
                    <button id="bottom-home-btn" class="bottom-nav-btn active flex flex-col items-center gap-1 py-1">
                        <span class="bottom-nav-icon flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 transition">
                            <img src="https://cdn-icons-png.flaticon.com/512/1946/1946436.png" alt="Home" class="bottom-nav-img" loading="eager" fetchpriority="high" decoding="async">
                        </span>
                        <span id="bottom-home-label">Wallet</span>
                    </button>
                    <button id="bottom-admin-btn" hidden class="bottom-nav-btn hidden flex flex-col items-center gap-1 py-1">
                        <span class="bottom-nav-icon flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 transition">
                            <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" alt="Admin" class="bottom-nav-img" loading="eager" fetchpriority="high" decoding="async">
                        </span>
                        <span>Admin</span>
                    </button>
                    <button id="bottom-task-btn" class="bottom-nav-btn flex flex-col items-center gap-1 py-1">
                        <span class="bottom-nav-icon flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 transition">
                            <img src="https://cdn-icons-png.flaticon.com/512/3176/3176366.png" alt="Task" class="bottom-nav-img" loading="eager" fetchpriority="high" decoding="async">
                        </span>
                        <span>Task</span>
                    </button>
                    <button id="bottom-help-btn" class="bottom-nav-btn flex flex-col items-center gap-1 py-1">
                        <span class="bottom-nav-icon relative flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 transition">
                            <img src="https://cdn-icons-png.flaticon.com/512/5962/5962463.png" alt="Help" class="bottom-nav-img" loading="eager" fetchpriority="high" decoding="async">
                            <span id="bottom-help-unread-badge" class="hidden absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-red-600 px-1 text-[10px] font-black leading-5 text-white shadow"></span>
                        </span>
                        <span>Chat</span>
                    </button>
                    <button id="bottom-settings-btn" class="bottom-nav-btn flex flex-col items-center gap-1 py-1">
                        <span class="bottom-nav-icon flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 transition">
                            <img src="https://cdn-icons-png.flaticon.com/512/3524/3524659.png" alt="Settings" class="bottom-nav-img" loading="eager" fetchpriority="high" decoding="async">
                        </span>
                        <span>Settings</span>
                    </button>
                </div>
            </nav>

            <!-- Full Page Panel Container -->
            <div id="page-container" class="hidden bg-gray-100 dark:bg-gray-900">
                <!-- Full page content will be injected here -->
            </div>

        </div>
    </div>

    <!-- Footer -->
    <footer id="app-footer" class="hidden app-footer-hidden text-center p-4 text-sm text-gray-500 dark:text-gray-400">
        © Reviews world 2022. All rights reserved.
        <br>
        <span id="app-version" class="text-xs">v2.0</span>
    </footer>

    <!-- Modal Container -->
    <div id="modal-container"></div>

    <!-- Toast Container -->
    <div id="notification-toast">
        <!-- Toast content will be injected here -->
    </div>

    <!-- Slide-out Menu -->
    <div id="menu-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden transition-opacity duration-300"
        onclick="window.closeSlideMenu()"></div>
    <div id="slide-menu"
        class="fixed top-0 right-0 h-full w-full max-w-xs bg-white dark:bg-gray-800 shadow-xl z-50 transform translate-x-full transition-transform duration-300 ease-in-out">
        <!-- Content will be injected by JS -->
    </div>

`;
