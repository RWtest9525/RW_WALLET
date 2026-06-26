const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const srcDir = path.join(__dirname, '..', 'src');
const mainJsPath = path.join(srcDir, 'main.js');

if (!fs.existsSync(mainJsPath)) {
  console.error('Error: src/main.js not found!');
  process.exit(1);
}

const content = fs.readFileSync(mainJsPath, 'utf8');
const ast = parser.parse(content, {
  sourceType: 'module'
});

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Ensure directory structures exist
ensureDir(path.join(srcDir, 'core'));
ensureDir(path.join(srcDir, 'utils'));
ensureDir(path.join(srcDir, 'pages'));
ensureDir(path.join(srcDir, 'pages', 'admin'));

function getTargetFile(funcName) {
  const name = funcName.toLowerCase();
  
  if (name.includes('admintask') || name.includes('admincreatetask')) {
    return 'pages/admin/admin-tasks.js';
  } else if (name.includes('adminsubmission') || name.includes('adminverify') || name.includes('ocr') || name.includes('reviewername')) {
    return 'pages/admin/admin-submissions.js';
  } else if (name.includes('adminrecharge')) {
    return 'pages/admin/admin-recharges.js';
  } else if (name.includes('adminwithdraw')) {
    return 'pages/admin/admin-withdrawals.js';
  } else if (name.includes('adminuser') || name.includes('adminban') || name.includes('adminflag')) {
    return 'pages/admin/admin-users.js';
  } else if (name.includes('adminchat')) {
    return 'pages/admin/admin-chats.js';
  } else if (name.includes('adminsync') || name.includes('audit') || name.includes('summary')) {
    return 'pages/admin/admin-audit.js';
  } else if (name.includes('adminnotification')) {
    return 'pages/admin/admin-notifications.js';
  } else if (name.includes('adminlist') || name.includes('dailylist')) {
    return 'pages/admin/admin-lists.js';
  } else if (name.includes('admin')) {
    return 'pages/admin/admin-dashboard.js';
  } else if (name.includes('recharge')) {
    return 'pages/recharge.js';
  } else if (name.includes('withdraw')) {
    return 'pages/withdraw.js';
  } else if (name.includes('loan')) {
    return 'pages/loan.js';
  } else if (name.includes('partner') || name.includes('investment')) {
    return 'pages/partner.js';
  } else if (name.includes('chat') || name.includes('support') || name.includes('revy')) {
    return 'pages/support.js';
  } else if (name.includes('gift') || name.includes('redeem')) {
    return 'pages/giftcard.js';
  } else if (name.includes('notification')) {
    return 'pages/notifications.js';
  } else if (name.includes('profile') || name.includes('settings') || name.includes('theme')) {
    return 'pages/profile.js';
  } else if (name.includes('auth') || name.includes('login') || name.includes('signout') || name.includes('register') || name.includes('resetlink')) {
    return 'pages/auth.js';
  } else if (name.includes('page') || name.includes('nav') || name.includes('transaction') || name.includes('history') || name.includes('menu')) {
    return 'pages/dashboard.js';
  }
  return 'utils/ui-utils.js';
}

const filesContent = {};
const globals = [];
const startup = [];
const localFunctionsByFile = {};
const allFunctionNames = new Set();

// Pass 1: Identify all function names defined in VariableDeclarations and window assignments
ast.program.body.forEach(node => {
  if (node.type === 'VariableDeclaration') {
    node.declarations.forEach(dec => {
      if (dec.init && (dec.init.type === 'ArrowFunctionExpression' || dec.init.type === 'FunctionExpression')) {
        allFunctionNames.add(dec.id.name);
      }
    });
  } else if (node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression') {
    const expr = node.expression;
    if (expr.left.type === 'MemberExpression' && expr.left.object.name === 'window') {
      const name = expr.left.property.name;
      if (expr.right.type === 'ArrowFunctionExpression' || expr.right.type === 'FunctionExpression') {
        allFunctionNames.add(name);
      }
    }
  }
});

// Pass 2: Partition code
ast.program.body.forEach(node => {
  const nodeCode = content.substring(node.start, node.end);
  
  if (node.type === 'ImportDeclaration') {
    return;
  }
  
  if (node.type === 'VariableDeclaration') {
    const isFunc = node.declarations.length === 1 && node.declarations[0].init && 
                   (node.declarations[0].init.type === 'ArrowFunctionExpression' || 
                    node.declarations[0].init.type === 'FunctionExpression');
                    
    const isAlias = node.declarations.length === 1 && node.declarations[0].init &&
                    node.declarations[0].init.type === 'Identifier' &&
                    allFunctionNames.has(node.declarations[0].init.name);
                    
    if (isFunc || isAlias) {
      const dec = node.declarations[0];
      const name = dec.id.name;
      const targetName = isFunc ? name : dec.init.name;
      const file = getTargetFile(targetName);
      
      if (!filesContent[file]) {
        filesContent[file] = [];
        localFunctionsByFile[file] = [];
      }
      filesContent[file].push(nodeCode);
      localFunctionsByFile[file].push(name);
    } else {
      node.declarations.forEach(dec => {
        const name = dec.id.name;
        const isAliasToFunc = dec.init && dec.init.type === 'Identifier' && allFunctionNames.has(dec.init.name);
        if (isAliasToFunc) {
          const file = getTargetFile(dec.init.name);
          if (!filesContent[file]) {
            filesContent[file] = [];
            localFunctionsByFile[file] = [];
          }
          filesContent[file].push(`const ${name} = ${dec.init.name};`);
          localFunctionsByFile[file].push(name);
        } else {
          let initStr = 'undefined';
          if (dec.init) {
            initStr = content.substring(dec.init.start, dec.init.end);
          }
          globals.push(`window.${name} = ${initStr};`);
        }
      });
    }
    return;
  }
  
  if (node.type === 'ExpressionStatement') {
    const expr = node.expression;
    if (expr.type === 'AssignmentExpression') {
      if (expr.left.type === 'Identifier') {
        const name = expr.left.name;
        if (allFunctionNames.has(name)) {
          const file = getTargetFile(name);
          if (!filesContent[file]) {
            filesContent[file] = [];
            localFunctionsByFile[file] = [];
          }
          filesContent[file].push(nodeCode);
          return;
        }
      } else if (expr.left.type === 'MemberExpression' && expr.left.object.name === 'window') {
        const name = expr.left.property.name;
        if (expr.right.type === 'ArrowFunctionExpression' || expr.right.type === 'FunctionExpression') {
          const file = getTargetFile(name);
          if (!filesContent[file]) {
            filesContent[file] = [];
            localFunctionsByFile[file] = [];
          }
          filesContent[file].push(nodeCode);
          // Note: we do NOT add it to localFunctionsByFile because it is already on window
          return;
        }
      }
    }
  }
  
  startup.push(nodeCode);
});

// 1. Write the core globals.js file
const globalsImports = `import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc, collection, collectionGroup, addDoc, onSnapshot, query, orderBy, Timestamp, writeBatch, runTransaction, deleteDoc, getDocs, serverTimestamp, where, arrayUnion, updateDoc, deleteField, increment, setLogLevel, limit as firestoreLimit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging.js";

// Mount Firebase imports to window
window.initializeApp = initializeApp;
window.getAuth = getAuth;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.sendPasswordResetEmail = sendPasswordResetEmail;
window.setPersistence = setPersistence;
window.browserLocalPersistence = browserLocalPersistence;
window.initializeFirestore = initializeFirestore;
window.persistentLocalCache = persistentLocalCache;
window.persistentMultipleTabManager = persistentMultipleTabManager;
window.doc = doc;
window.setDoc = setDoc;
window.getDoc = getDoc;
window.collection = collection;
window.collectionGroup = collectionGroup;
window.addDoc = addDoc;
window.onSnapshot = onSnapshot;
window.query = query;
window.orderBy = orderBy;
window.Timestamp = Timestamp;
window.writeBatch = writeBatch;
window.runTransaction = runTransaction;
window.deleteDoc = deleteDoc;
window.getDocs = getDocs;
window.serverTimestamp = serverTimestamp;
window.where = where;
window.arrayUnion = arrayUnion;
window.updateDoc = updateDoc;
window.deleteField = deleteField;
window.increment = increment;
window.setLogLevel = setLogLevel;
window.firestoreLimit = firestoreLimit;
window.getStorage = getStorage;
window.storageRef = storageRef;
window.uploadBytesResumable = uploadBytesResumable;
window.getDownloadURL = getDownloadURL;
window.getMessaging = getMessaging;
window.getToken = getToken;
window.onMessage = onMessage;

// Mount state variables & constants to window
`;

const globalsContent = globalsImports + globals.join('\n') + '\n';
fs.writeFileSync(path.join(srcDir, 'core', 'globals.js'), globalsContent);
console.log('Created core/globals.js');

// 2. Write out all function page files
for (const [targetFile, snippets] of Object.entries(filesContent)) {
  const targetPath = path.join(srcDir, targetFile);
  let fileText = `// File: src/${targetFile}\n\n`;
  
  snippets.forEach(snippet => {
    fileText += `${snippet}\n\n`;
  });
  
  fileText += `// Expose functions to window for global access\n`;
  const uniqueLocals = [...new Set(localFunctionsByFile[targetFile] || [])];
  uniqueLocals.forEach(name => {
    fileText += `window.${name} = ${name};\n`;
  });
  
  fs.writeFileSync(targetPath, fileText);
  console.log(`Created src/${targetFile} with ${snippets.length} snippets.`);
}

// 3. Write core/firebase.js with Firebase startup code
const firebaseInitContent = `// File: src/core/firebase.js

const initFirebaseApp = () => {
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyBzF1agrBFFh4cC2DkmZKePf4-gjE05OQo",
            authDomain: "review-world-1312e.firebaseapp.com",
            projectId: "review-world-1312e",
            storageBucket: "review-world-1312e.firebasestorage.app",
            messagingSenderId: "372772434173",
            appId: "1:372772434173:web:bfeb08e0c96886ace94",
            measurementId: "G-X90GP8JTL8"
        };
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        
        // Initialize Firestore with Persistent Cache
        const db = initializeFirestore(app, {
            localCache: persistentLocalCache()
        });
        
        const storage = getStorage(app);
        let messaging = null;
        try {
            messaging = getMessaging(app);
        } catch(e) {
            console.warn("Messaging not supported on this browser.");
        }
        
        window.app = app;
        window.auth = auth;
        window.db = db;
        window.storage = storage;
        window.messaging = messaging;
        
        try {
            setLogLevel('error');
        } catch (e) {
            console.warn("Could not set Firebase log level:", e);
        }
        
        console.log("Firebase services initialized successfully with persistent cache.");
        
        // Start Auth state change listener
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                localStorage.setItem('lastLoggedInUser', user.uid);
                
                // Set persistence
                setPersistence(auth, browserLocalPersistence).catch(e => console.warn("Persistence set failed:", e));
                
                // Realtime user profile listener
                const userRef = doc(db, \`artifacts/\${appId}/public/data/users\`, user.uid);
                onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        currentUserData = userData;
                        localStorage.setItem(\`rw_wallet_user_cache_\${user.uid}\`, JSON.stringify(userData));
                        
                        // Hydrate UI elements
                        const balanceEl = document.getElementById('user-balance');
                        const adminBalanceEl = document.getElementById('admin-wallet-balance');
                        if (balanceEl && typeof formatCompactInr === 'function') balanceEl.textContent = formatCompactInr(userData.balance || 0);
                        if (adminBalanceEl && typeof formatCompactInr === 'function') adminBalanceEl.textContent = formatCompactInr(userData.balance || 0);
                        
                        if (userData.isFlagged || userData.isDisabled) {
                            if (typeof showBlockedAccountPage === 'function') showBlockedAccountPage(userData);
                        } else if (userData.approvalStatus === 'pending' || userData.signupApprovalStatus === 'pending' || userData.accountStatus === 'pending_approval') {
                            if (typeof showVerificationPendingPage === 'function') showVerificationPendingPage(userData);
                        } else if (userData.approvalStatus === 'rejected' || userData.signupApprovalStatus === 'rejected' || userData.accountStatus === 'rejected') {
                            if (typeof showVerificationPendingPage === 'function') showVerificationPendingPage(userData);
                        } else {
                            // If page was blocked/pending, return to dashboard
                            if (document.getElementById('verification-pending-container') || document.getElementById('dashboard-content')?.classList.contains('hidden')) {
                                document.getElementById('dashboard-content')?.classList.remove('hidden');
                                document.getElementById('bottom-nav')?.classList.remove('hidden');
                                const pageContainer = document.getElementById('page-container');
                                if (pageContainer) {
                                    pageContainer.innerHTML = '';
                                    pageContainer.classList.add('hidden');
                                }
                            }
                        }
                    }
                });
                
                // Realtime transactions history listener (for UI reactivity)
                const txQuery = query(
                    collection(db, \`artifacts/\${appId}/public/data/users/\${user.uid}/transactions\`),
                    orderBy('timestamp', 'desc'),
                    firestoreLimit(FIRESTORE_TRANSACTION_READ_LIMIT)
                );
                onSnapshot(txQuery, (snap) => {
                    const txs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    unifiedHistoryCache = txs;
                    if (typeof renderTransactionsList === 'function') {
                        renderTransactionsList(txs);
                    }
                });
                
                // Initialize messaging/notifications
                if (typeof setupPushNotifications === 'function') setupPushNotifications();
                if (typeof setupNotificationMessageListener === 'function') setupNotificationMessageListener();
                
                // Hydrate dashboard
                if (typeof showHomeMainPage === 'function') showHomeMainPage();
            } else {
                currentUser = null;
                currentUserData = null;
                localStorage.removeItem('lastLoggedInUser');
                if (typeof handleSignOut === 'function') handleSignOut();
            }
        });
        
    } catch (error) {
        console.error("Firebase startup failed:", error);
    }
};

window.initFirebaseApp = initFirebaseApp;

// Auto-run on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebaseApp, { once: true });
} else {
    initFirebaseApp();
}
`;

fs.writeFileSync(path.join(srcDir, 'core', 'firebase.js'), firebaseInitContent);
console.log('Created core/firebase.js');

// 4. Update src/main.js to serve as the entry module importing all components in sequence and running startup code
let entryPointContent = `// Entry Point: src/main.js
// Imports all modular components and pages in sequence

import './core/globals.js';
import './utils/ui-utils.js';
import './pages/auth.js';
import './pages/dashboard.js';
import './pages/recharge.js';
import './pages/withdraw.js';
import './pages/loan.js';
import './pages/partner.js';
import './pages/support.js';
import './pages/giftcard.js';
import './pages/notifications.js';
import './pages/profile.js';
import './pages/admin/admin-dashboard.js';
import './pages/admin/admin-tasks.js';
import './pages/admin/admin-submissions.js';
import './pages/admin/admin-users.js';
import './pages/admin/admin-recharges.js';
import './pages/admin/admin-withdrawals.js';
import './pages/admin/admin-chats.js';
import './pages/admin/admin-audit.js';
import './pages/admin/admin-lists.js';
import './pages/admin/admin-notifications.js';
import './core/firebase.js';

// Setup Event listeners and routing at DOM load
`;

startup.forEach(statement => {
  entryPointContent += `${statement}\n\n`;
});

fs.writeFileSync(mainJsPath, entryPointContent);
console.log('Successfully updated src/main.js to be the clean imports entry point!');
console.log('\nRefactoring complete!');
