const fs = require('fs');
const path = require('path');

const mainJsPath = path.join(__dirname, '..', 'src', 'main.js');
const content = fs.readFileSync(mainJsPath, 'utf8');

function extractFunctions(content) {
  const functionRegex = /(?:const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|function\s+([a-zA-Z0-9_]+)\s*\([^)]*\))\s*\{/g;
  let match;
  const functions = [];
  while ((match = functionRegex.exec(content)) !== null) {
    const name = match[1] || match[2];
    const startIndex = match.index;
    const braceStartIndex = content.indexOf('{', startIndex);
    
    let braceCount = 1;
    let index = braceStartIndex + 1;
    while (braceCount > 0 && index < content.length) {
      const char = content[index];
      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }
      index++;
    }
    
    const body = content.substring(startIndex, index);
    functions.push({ name, body, start: startIndex, end: index });
  }
  return functions;
}

const funcs = extractFunctions(content);
const classification = {};

funcs.forEach(f => {
  let file = 'utils/ui-utils.js';
  const name = f.name.toLowerCase();
  
  if (name.includes('admintask') || name.includes('admincreatetask')) {
    file = 'pages/admin/admin-tasks.js';
  } else if (name.includes('adminsubmission') || name.includes('adminverify') || name.includes('ocr') || name.includes('reviewername')) {
    file = 'pages/admin/admin-submissions.js';
  } else if (name.includes('adminrecharge')) {
    file = 'pages/admin/admin-recharges.js';
  } else if (name.includes('adminwithdraw')) {
    file = 'pages/admin/admin-withdrawals.js';
  } else if (name.includes('adminuser') || name.includes('adminban') || name.includes('adminflag')) {
    file = 'pages/admin/admin-users.js';
  } else if (name.includes('adminchat')) {
    file = 'pages/admin/admin-chats.js';
  } else if (name.includes('adminsync') || name.includes('audit') || name.includes('summary')) {
    file = 'pages/admin/admin-audit.js';
  } else if (name.includes('adminnotification')) {
    file = 'pages/admin/admin-notifications.js';
  } else if (name.includes('adminlist') || name.includes('dailylist')) {
    file = 'pages/admin/admin-lists.js';
  } else if (name.includes('admin')) {
    file = 'pages/admin/admin-dashboard.js';
  } else if (name.includes('recharge')) {
    file = 'pages/recharge.js';
  } else if (name.includes('withdraw')) {
    file = 'pages/withdraw.js';
  } else if (name.includes('loan')) {
    file = 'pages/loan.js';
  } else if (name.includes('partner') || name.includes('investment')) {
    file = 'pages/partner.js';
  } else if (name.includes('chat') || name.includes('support') || name.includes('revy')) {
    file = 'pages/support.js';
  } else if (name.includes('gift') || name.includes('redeem')) {
    file = 'pages/giftcard.js';
  } else if (name.includes('notification')) {
    file = 'pages/notifications.js';
  } else if (name.includes('profile') || name.includes('settings') || name.includes('theme')) {
    file = 'pages/profile.js';
  } else if (name.includes('auth') || name.includes('login') || name.includes('signout') || name.includes('register') || name.includes('resetlink')) {
    file = 'pages/auth.js';
  } else if (name.includes('page') || name.includes('nav') || name.includes('transaction') || name.includes('history') || name.includes('menu')) {
    file = 'pages/dashboard.js';
  }
  
  if (!classification[file]) classification[file] = [];
  classification[file].push(f.name);
});

console.log(JSON.stringify(classification, null, 2));
