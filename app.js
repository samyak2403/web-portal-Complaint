// Admin Web Portal JS
// Replace the config placeholders below with your Firebase Web App config values.
// NEVER hardcode secrets in code that will be shared publicly.

(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyCUeZkAyh1zHDWzDNT_Kiw6HO0Eb6Yz7II",
    authDomain: "complaint-and-suggestion.firebaseapp.com",
    databaseURL: "https://complaint-and-suggestion-default-rtdb.firebaseio.com",
    projectId: "complaint-and-suggestion",
    storageBucket: "complaint-and-suggestion.firebasestorage.app",
    messagingSenderId: "188969384619",
    appId: "1:188969384619:web:abab18f3c2cd7862d855ee",
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.database();

  // Elements
  const loginSection = document.getElementById('login-section');
  const registerSection = document.getElementById('register-section');
  const dashboard = document.getElementById('dashboard');
  const btnLogin = document.getElementById('btn-login');
  const btnRegister = document.getElementById('btn-register');
  const btnLogout = document.getElementById('btn-logout');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const currentUserEl = document.getElementById('current-user');
  const showRegisterLink = document.getElementById('show-register');
  const showLoginLink = document.getElementById('show-login');

  const navTabs = document.querySelectorAll('.nav-link');
  const adminsView = document.getElementById('admins-view');
  const complaintsView = document.getElementById('complaints-view');
  const analyticsView = document.getElementById('analytics-view');
  const chatView = document.getElementById('chat-view');
  const profileView = document.getElementById('profile-view');
  const breadcrumbText = document.getElementById('breadcrumb-text');

  // Admins UI
  const adminStatusFilter = document.getElementById('admin-status-filter');
  const adminSearch = document.getElementById('admin-search');
  const adminsTbody = document.getElementById('admins-tbody');
  const adminsEmpty = document.getElementById('admins-empty');
  const adminsTotal = document.getElementById('admins-total');
  const adminsPending = document.getElementById('admins-pending');
  const adminsApproved = document.getElementById('admins-approved');
  const adminsRejected = document.getElementById('admins-rejected');

  // Complaints UI
  const complaintStatusFilter = document.getElementById('complaint-status-filter');
  const complaintSearch = document.getElementById('complaint-search');
  const complaintsTbody = document.getElementById('complaints-tbody');
  const complaintsEmpty = document.getElementById('complaints-empty');
  const complaintModal = document.getElementById('complaint-modal');
  const modalBody = document.getElementById('modal-body');
  const modalSave = document.getElementById('modal-save');

  // Admin Details Modal
  const adminDetailsModal = document.getElementById('admin-details-modal');
  const adminModalBody = document.getElementById('admin-modal-body');

  // Analytics UI
  const analyticsPeriod = document.getElementById('analytics-period');
  const analyticsTotal = document.getElementById('analytics-total');
  const analyticsResolutionRate = document.getElementById('analytics-resolution-rate');
  const analyticsAvgTime = document.getElementById('analytics-avg-time');
  const analyticsPending = document.getElementById('analytics-pending');
  const urgentAlert = document.getElementById('urgent-alert');
  const urgentCount = document.getElementById('urgent-count');
  const statusChart = document.getElementById('status-chart');
  const categoryChart = document.getElementById('category-chart');
  const trendChart = document.getElementById('trend-chart');
  const priorityChart = document.getElementById('priority-chart');

  let adminsCache = [];
  let complaintsCache = [];
  let selectedComplaint = null;
  let currentAdminProfile = null;

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function formatDate(ms) {
    if (!ms) return '-';
    try { return new Date(ms).toLocaleString(); } catch { return '-'; }
  }
  function badge(text) {
    const t = (text || '').toLowerCase();
    const map = {
      'pending': 'pending',
      'approved': 'approved',
      'rejected': 'rejected',
      'in progress': 'progress',
      'resolved': 'resolved',
    };
    return `<span class="badge ${map[t] || 'pending'}">${text || '-'}</span>`;
  }

  // Navigation between views
  navTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      navTabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tgt = btn.getAttribute('data-target');
      [adminsView, complaintsView, analyticsView, chatView, profileView].forEach(v => v.classList.add('hidden'));
      document.getElementById(tgt).classList.remove('hidden');
      
      // Update breadcrumb if present
      const viewName = btn.textContent;
      if (breadcrumbText) breadcrumbText.textContent = viewName;
      
      // Load analytics when switching to analytics view
      if (tgt === 'analytics-view') {
        renderAnalytics();
      }
      
      // Load profile when switching to profile view
      if (tgt === 'profile-view') {
        renderProfile();
      }
      
      // Load chat when switching to chat view
      if (tgt === 'chat-view') {
        loadChatRequests();
      }
    });
  });

  // Navigation between login and register
  showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    hide(loginSection);
    show(registerSection);
    loginError.textContent = '';
    registerError.textContent = '';
  });

  showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    hide(registerSection);
    show(loginSection);
    loginError.textContent = '';
    registerError.textContent = '';
  });

  // Auth handling
  btnLogin.addEventListener('click', async () => {
    loginError.textContent = '';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) {
      loginError.textContent = 'Email and password are required.';
      return;
    }
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      const uid = cred.user.uid;
      // Check admin approval and active status
      const snap = await db.ref(`admins/${uid}`).get();
      if (!snap.exists()) throw new Error('Admin profile not found.');
      const admin = snap.val();
      if (admin.status !== 'Approved' || admin.isActive !== true) {
        await auth.signOut();
        throw new Error('Access denied. Admin is not approved/active.');
      }
      onLoggedIn(cred.user, admin);
    } catch (e) {
      loginError.textContent = e.message || 'Login failed';
    }
  });

  btnRegister.addEventListener('click', async () => {
    registerError.textContent = '';
    const fullName = document.getElementById('reg-fullname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const college = document.getElementById('reg-college').value.trim();
    const department = document.getElementById('reg-department').value.trim();
    const designation = document.getElementById('reg-designation').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (!fullName || !email || !college || !department || !designation || !password || !confirmPassword) {
      registerError.textContent = 'All fields are required.';
      return;
    }

    if (password !== confirmPassword) {
      registerError.textContent = 'Passwords do not match.';
      return;
    }

    if (password.length < 6) {
      registerError.textContent = 'Password must be at least 6 characters.';
      return;
    }

    try {
      // Create Firebase Auth user
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      const uid = cred.user.uid;

      // Store admin profile in RTDB with Pending status
      await db.ref(`admins/${uid}`).set({
        fullName,
        email,
        collegeName: college,
        department,
        designation,
        status: 'Approved',
        isActive: true,
        registrationTimestamp: Date.now()
      });

      // Sign out immediately after registration
      await auth.signOut();

      // Show success message and switch to login
      alert('Registration successful! Your account is pending approval. Please wait for an admin to approve your account.');
      hide(registerSection);
      show(loginSection);

      // Clear form
      document.getElementById('reg-fullname').value = '';
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-college').value = '';
      document.getElementById('reg-department').value = '';
      document.getElementById('reg-designation').value = '';
      document.getElementById('reg-password').value = '';
      document.getElementById('reg-confirm-password').value = '';
    } catch (e) {
      registerError.textContent = e.message || 'Registration failed';
    }
  });

  btnLogout.addEventListener('click', async () => {
    await auth.signOut();
  });

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      hide(dashboard);
      hide(registerSection);
      show(loginSection);
      return;
    }
    try {
      const snap = await db.ref(`admins/${user.uid}`).get();
      const admin = snap.exists() ? snap.val() : null;
      if (!admin || admin.status !== 'Approved' || admin.isActive !== true) {
        await auth.signOut();
        return;
      }
      onLoggedIn(user, admin);
    } catch {
      await auth.signOut();
    }
  });

  function onLoggedIn(user, adminProfile) {
    currentAdminProfile = { ...adminProfile, adminId: user.uid };
    currentUserEl.textContent = `${adminProfile.fullName || user.email} • ${user.email}`;
    hide(loginSection); show(dashboard);
    loadAdmins();
    loadComplaints();
  }

  // Admins list
  function loadAdmins() {
    db.ref('admins').on('value', (snap) => {
      adminsCache = [];
      if (snap.exists()) {
        snap.forEach(s => {
          const a = s.val();
          a.adminId = s.key;
          adminsCache.push(a);
        });
      }
      renderAdmins();
    });
  }

  function adminMatchesFilter(a) {
    const status = adminStatusFilter.value;
    const q = (adminSearch.value || '').toLowerCase();
    const matchesStatus = status === 'All' || (a.status === status);
    const text = `${a.fullName || ''} ${a.email || ''} ${a.collegeName || ''} ${a.department || ''}`.toLowerCase();
    const matchesQuery = !q || text.includes(q);
    return matchesStatus && matchesQuery;
  }

  function renderAdmins() {
    const total = adminsCache.length;
    const pending = adminsCache.filter(a => a.status === 'Pending').length;
    const approved = adminsCache.filter(a => a.status === 'Approved').length;
    const rejected = adminsCache.filter(a => a.status === 'Rejected').length;

    adminsTotal.textContent = total;
    adminsPending.textContent = pending;
    adminsApproved.textContent = approved;
    adminsRejected.textContent = rejected;

    const filtered = adminsCache.filter(adminMatchesFilter);
    adminsTbody.innerHTML = '';

    filtered.forEach(a => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${a.fullName || '-'}</td>
        <td>${a.email || '-'}</td>
        <td>${a.collegeName || '-'}</td>
        <td>${a.department || '-'}</td>
        <td>${a.designation || '-'}</td>
        <td>${badge(a.status)}</td>
        <td>${a.isActive ? 'Yes' : 'No'}</td>
        <td>${formatDate(a.registrationTimestamp)}</td>
        <td>
          <div class="actions">
            <button class="btn small primary btn-view-details">View</button>
            ${actionButtonsForAdmin(a)}
          </div>
        </td>
      `;
      attachAdminActions(tr, a);
      adminsTbody.appendChild(tr);
    });

    if (filtered.length === 0) {
      adminsEmpty.classList.remove('hidden');
    } else {
      adminsEmpty.classList.add('hidden');
    }
  }

  function actionButtonsForAdmin(a) {
    const canApprove = a.status === 'Pending' || a.status === 'Rejected';
    const canReject = a.status === 'Pending';
    const canDeactivate = a.status === 'Approved' && a.isActive === true;
    const canActivate = a.status === 'Approved' && a.isActive !== true;

    return `
      ${canApprove ? '<button class="btn small success btn-approve">Approve</button>' : ''}
      ${canReject ? '<button class="btn small danger btn-reject">Reject</button>' : ''}
      ${canDeactivate ? '<button class="btn small warning btn-deactivate">Deactivate</button>' : ''}
      ${canActivate ? '<button class="btn small success btn-activate">Activate</button>' : ''}
    `;
  }

  function attachAdminActions(tr, a) {
    const viewDetailsBtn = tr.querySelector('.btn-view-details');
    const approveBtn = tr.querySelector('.btn-approve');
    const rejectBtn = tr.querySelector('.btn-reject');
    const deactivateBtn = tr.querySelector('.btn-deactivate');
    const activateBtn = tr.querySelector('.btn-activate');

    if (viewDetailsBtn) {
      viewDetailsBtn.addEventListener('click', () => openAdminDetailsModal(a));
    }

    if (approveBtn) {
      approveBtn.addEventListener('click', async () => {
        const confirm = window.confirm(`Approve admin "${a.fullName || a.email}"?\n\nThis will grant them access to the portal.`);
        if (confirm) {
          await updateAdminStatus(a.adminId, 'Approved', true);
        }
      });
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', async () => {
        const reason = window.prompt(`Reject admin "${a.fullName || a.email}"?\n\nEnter rejection reason (optional):`);
        if (reason !== null) { // User clicked OK (even if empty string)
          await updateAdminStatus(a.adminId, 'Rejected', false, reason);
        }
      });
    }

    if (deactivateBtn) {
      deactivateBtn.addEventListener('click', async () => {
        const confirm = window.confirm(`Deactivate admin "${a.fullName || a.email}"?\n\nThey will lose access to the portal.`);
        if (confirm) {
          await setAdminActive(a.adminId, false);
        }
      });
    }

    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        const confirm = window.confirm(`Activate admin "${a.fullName || a.email}"?\n\nThey will regain access to the portal.`);
        if (confirm) {
          await setAdminActive(a.adminId, true);
        }
      });
    }
  }

  async function updateAdminStatus(adminId, status, active, reason = '') {
    const user = auth.currentUser;
    const approvedBy = user?.email || 'web-portal';
    const updates = {
      status,
      isActive: active,
      approvalTimestamp: Date.now(),
      approvedBy,
    };

    // Add rejection reason if provided
    if (status === 'Rejected' && reason) {
      updates.rejectionReason = reason;
    }

    await db.ref(`admins/${adminId}`).update(updates);
    // No need to reload - real-time listener will update automatically
  }

  async function setAdminActive(adminId, active) {
    await db.ref(`admins/${adminId}`).update({ isActive: active });
    // No need to reload - real-time listener will update automatically
  }

  adminStatusFilter.addEventListener('change', renderAdmins);
  adminSearch.addEventListener('input', renderAdmins);

  // Admin details modal
  function openAdminDetailsModal(a) {
    adminModalBody.innerHTML = `
      <div class="form-group">
        <label>Admin ID</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px; font-family: monospace; font-size: 12px;">${a.adminId || '-'}</div>
      </div>
      <div class="form-group">
        <label>Full Name</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${a.fullName || '-'}</div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${a.email || '-'}</div>
      </div>
      <div class="form-group">
        <label>College Name</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${a.collegeName || '-'}</div>
      </div>
      <div class="form-group">
        <label>Department</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${a.department || '-'}</div>
      </div>
      <div class="form-group">
        <label>Designation</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${a.designation || '-'}</div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <div style="padding: 8px;">${badge(a.status)}</div>
      </div>
      <div class="form-group">
        <label>Active</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${a.isActive ? 'Yes' : 'No'}</div>
      </div>
      <div class="form-group">
        <label>Registration Date</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${formatDate(a.registrationTimestamp)}</div>
      </div>
      ${a.approvalTimestamp ? `
        <div class="form-group">
          <label>Approval Date</label>
          <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${formatDate(a.approvalTimestamp)}</div>
        </div>
      ` : ''}
      ${a.approvedBy ? `
        <div class="form-group">
          <label>Approved By</label>
          <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${a.approvedBy}</div>
        </div>
      ` : ''}
      ${a.rejectionReason ? `
        <div class="form-group">
          <label>Rejection Reason</label>
          <div style="padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; color: #856404;">${a.rejectionReason}</div>
        </div>
      ` : ''}
    `;
    adminDetailsModal.showModal();
  }

  // Click stat cards to filter
  document.getElementById('admins-pending').parentElement.addEventListener('click', () => {
    adminStatusFilter.value = 'Pending';
    renderAdmins();
  });
  document.getElementById('admins-approved').parentElement.addEventListener('click', () => {
    adminStatusFilter.value = 'Approved';
    renderAdmins();
  });
  document.getElementById('admins-rejected').parentElement.addEventListener('click', () => {
    adminStatusFilter.value = 'Rejected';
    renderAdmins();
  });
  document.getElementById('admins-total').parentElement.addEventListener('click', () => {
    adminStatusFilter.value = 'All';
    renderAdmins();
  });

  // Complaints list
  let complaintsListener = null;
  let complaintsPath = 'complaints';

  async function loadComplaints() {
    // Be tolerant to different DB paths/field names used by the mobile app.
    const candidatePaths = ['complaints', 'Complaints', 'complaint'];
    
    // First, find which path has data
    for (const path of candidatePaths) {
      try {
        const snap = await db.ref(path).get();
        if (snap.exists()) {
          const list = [];
          snap.forEach(s => {
            list.push(s.val());
          });
          if (list.length) {
            complaintsPath = path;
            break;
          }
        }
      } catch (e) {
        // Ignore and try next path
      }
    }

    // Now set up real-time listener on the found path
    if (complaintsListener) {
      db.ref(complaintsPath).off('value', complaintsListener);
    }

    complaintsListener = (snap) => {
      complaintsCache = [];
      if (snap.exists()) {
        snap.forEach(s => {
          const c = s.val();
          c.id = s.key;
          complaintsCache.push(c);
        });
      }

      // Sort by best-effort timestamp field.
      complaintsCache.sort((a, b) => (b.timestamp || b.createdAt || b.created_on || b.createdOn || 0) - (a.timestamp || a.createdAt || a.created_on || a.createdOn || 0));

      renderComplaints();
      
      // Update analytics in real-time if analytics view is visible
      if (!analyticsView.classList.contains('hidden')) {
        renderAnalytics();
      }
    };

    db.ref(complaintsPath).on('value', complaintsListener);
  }

  function complaintMatchesFilter(c) {
    const status = complaintStatusFilter.value;
    const q = (complaintSearch.value || '').toLowerCase();
    const cStatus = c.status || c.state || c.complaintStatus || '';
    const title = c.title || c.problem || c.subject || '';
    const category = c.category || c.type || c.categoryName || '';
    const desc = c.description || c.details || '';
    const matchesStatus = status === 'All' || (cStatus === status);
    const text = `${title} ${category} ${desc}`.toLowerCase();
    const matchesQuery = !q || text.includes(q);
    return matchesStatus && matchesQuery;
  }

  function renderComplaints() {
    const filtered = complaintsCache.filter(complaintMatchesFilter);
    complaintsTbody.innerHTML = '';

    filtered.forEach(c => {
      const title = c.title || c.problem || c.subject || '-';
      const category = c.category || c.type || c.categoryName || '-';
      const cStatus = c.status || c.state || c.complaintStatus || '-';
      const priority = c.priority || c.level || '-';
      const ts = c.timestamp || c.createdAt || c.created_on || c.createdOn;
      const anon = c.anonymousId || c.anonId || c.userId || '-';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${title}</td>
        <td>${category}</td>
        <td>${badge(cStatus)}</td>
        <td>${priority}</td>
        <td>${formatDate(ts)}</td>
        <td>${anon}</td>
        <td>
          <button class="btn small primary btn-edit-complaint">Update</button>
        </td>
      `;
      tr.querySelector('.btn-edit-complaint').addEventListener('click', () => openComplaintModal(c));
      complaintsTbody.appendChild(tr);
    });

    complaintsEmpty.classList.toggle('hidden', filtered.length > 0);
  }

  complaintStatusFilter.addEventListener('change', renderComplaints);
  complaintSearch.addEventListener('input', renderComplaints);

  function openComplaintModal(c) {
    selectedComplaint = c;
    const currentStatus = c.status || c.state || c.complaintStatus || 'Pending';
    const currentPriority = c.priority || c.level || 'Medium';
    const title = c.title || c.problem || c.subject || '-';
    const category = c.category || c.type || c.categoryName || '-';
    const description = c.description || c.details || '-';
    const ts = c.timestamp || c.createdAt || c.created_on || c.createdOn;
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Title</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${title}</div>
      </div>
      <div class="form-group">
        <label>Category</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${category}</div>
      </div>
      <div class="form-group">
        <label>Description</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px; max-height: 150px; overflow-y: auto;">${description}</div>
      </div>
      <div class="form-group">
        <label>Submitted</label>
        <div style="padding: 8px; background: #f5f5f5; border-radius: 4px;">${formatDate(ts)}</div>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select id="modal-status">
          ${['Pending','In Progress','Resolved','Rejected'].map(s => `<option ${s===currentStatus?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Priority</label>
        <div style="display:flex; gap:8px">
          ${['Low','Medium','High'].map(p => `
            <label style="display:flex; gap:6px; align-items:center">
              <input type="radio" name="priority" value="${p}" ${p===currentPriority?'checked':''} />
              ${p}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>Admin Response</label>
        <textarea id="modal-response" rows="5" placeholder="Write response (min 10 chars)">${c.adminResponse||c.response||''}</textarea>
      </div>
    `;
    complaintModal.showModal();
  }

  modalSave.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    const status = document.getElementById('modal-status').value;
    const resp = document.getElementById('modal-response').value.trim();
    const priority = (document.querySelector('input[name="priority"]:checked') || {}).value || 'Medium';

    if (!resp || resp.length < 10) {
      alert('Response must be at least 10 characters.');
      return;
    }

    // Update using the detected path
    await db.ref(`${complaintsPath}/${selectedComplaint.id}`).update({
      status,
      adminResponse: resp,
      priority,
      responseTimestamp: Date.now(),
    });
    complaintModal.close();
    // No need to reload - real-time listener will update automatically
  });

  // Analytics
  analyticsPeriod.addEventListener('change', renderAnalytics);

  function getFilteredComplaints() {
    const period = analyticsPeriod.value;
    if (period === 'all') return complaintsCache;
    
    const days = parseInt(period);
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    return complaintsCache.filter(c => {
      const ts = c.timestamp || c.createdAt || c.created_on || c.createdOn || 0;
      return ts >= cutoff;
    });
  }

  function renderAnalytics() {
    const filtered = getFilteredComplaints();
    
    // Key metrics
    const total = filtered.length;
    const resolved = filtered.filter(c => (c.status || '').toLowerCase() === 'resolved').length;
    const pending = filtered.filter(c => (c.status || '').toLowerCase() === 'pending').length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    
    analyticsTotal.textContent = total;
    analyticsResolutionRate.textContent = resolutionRate + '%';
    analyticsPending.textContent = pending;
    
    // Average resolution time
    const resolvedWithTime = filtered.filter(c => {
      const status = (c.status || '').toLowerCase();
      return status === 'resolved' && c.responseTimestamp && (c.timestamp || c.createdAt);
    });
    
    if (resolvedWithTime.length > 0) {
      const totalTime = resolvedWithTime.reduce((sum, c) => {
        const created = c.timestamp || c.createdAt || 0;
        const resolved = c.responseTimestamp || 0;
        return sum + (resolved - created);
      }, 0);
      const avgMs = totalTime / resolvedWithTime.length;
      const avgHours = Math.round(avgMs / (1000 * 60 * 60));
      const avgDays = Math.floor(avgHours / 24);
      const remainingHours = avgHours % 24;
      
      if (avgDays > 0) {
        analyticsAvgTime.textContent = `${avgDays}d ${remainingHours}h`;
      } else {
        analyticsAvgTime.textContent = `${avgHours}h`;
      }
    } else {
      analyticsAvgTime.textContent = '-';
    }
    
    // Urgent complaints alert
    const urgent = filtered.filter(c => {
      const priority = (c.priority || '').toLowerCase();
      const status = (c.status || '').toLowerCase();
      return priority === 'high' && status !== 'resolved';
    });
    
    if (urgent.length > 0) {
      urgentCount.textContent = urgent.length;
      urgentAlert.classList.remove('hidden');
    } else {
      urgentAlert.classList.add('hidden');
    }
    
    // Status distribution
    renderStatusChart(filtered);
    
    // Category distribution
    renderCategoryChart(filtered);
    
    // Priority distribution
    renderPriorityChart(filtered);
    
    // Trend chart
    renderTrendChart(filtered);
  }

  function renderStatusChart(complaints) {
    const statuses = {};
    complaints.forEach(c => {
      const status = c.status || c.state || c.complaintStatus || 'Unknown';
      statuses[status] = (statuses[status] || 0) + 1;
    });
    
    const max = Math.max(...Object.values(statuses), 1);
    statusChart.innerHTML = '';
    
    const statusColors = {
      'Pending': 'warning',
      'In Progress': 'progress',
      'Resolved': 'success',
      'Rejected': 'danger'
    };
    
    Object.entries(statuses).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      const percent = (count / max) * 100;
      const color = statusColors[status] || 'primary';
      
      const item = document.createElement('div');
      item.className = 'chart-bar-item';
      item.innerHTML = `
        <div class="chart-bar-label">${status}</div>
        <div class="chart-bar-container">
          <div class="chart-bar-fill ${color}" style="width: ${percent}%"></div>
        </div>
        <div class="chart-bar-value">${count}</div>
      `;
      statusChart.appendChild(item);
    });
  }

  function renderCategoryChart(complaints) {
    const categories = {};
    complaints.forEach(c => {
      const category = c.category || c.type || c.categoryName || 'Uncategorized';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = Math.max(...sorted.map(e => e[1]), 1);
    categoryChart.innerHTML = '';
    
    sorted.forEach(([category, count]) => {
      const percent = (count / max) * 100;
      
      const item = document.createElement('div');
      item.className = 'chart-bar-item';
      item.innerHTML = `
        <div class="chart-bar-label">${category}</div>
        <div class="chart-bar-container">
          <div class="chart-bar-fill primary" style="width: ${percent}%"></div>
        </div>
        <div class="chart-bar-value">${count}</div>
      `;
      categoryChart.appendChild(item);
    });
    
    if (sorted.length === 0) {
      categoryChart.innerHTML = '<div class="empty">No data available</div>';
    }
  }

  function renderPriorityChart(complaints) {
    const priorities = {};
    complaints.forEach(c => {
      const priority = c.priority || c.level || 'Medium';
      priorities[priority] = (priorities[priority] || 0) + 1;
    });
    
    const max = Math.max(...Object.values(priorities), 1);
    priorityChart.innerHTML = '';
    
    const priorityColors = {
      'High': 'danger',
      'Medium': 'warning',
      'Low': 'success'
    };
    
    const order = ['High', 'Medium', 'Low'];
    order.forEach(priority => {
      const count = priorities[priority] || 0;
      const percent = (count / max) * 100;
      const color = priorityColors[priority] || 'primary';
      
      const item = document.createElement('div');
      item.className = 'chart-bar-item';
      item.innerHTML = `
        <div class="chart-bar-label">${priority}</div>
        <div class="chart-bar-container">
          <div class="chart-bar-fill ${color}" style="width: ${percent}%"></div>
        </div>
        <div class="chart-bar-value">${count}</div>
      `;
      priorityChart.appendChild(item);
    });
  }

  function renderTrendChart(complaints) {
    trendChart.innerHTML = '';
    
    if (complaints.length === 0) {
      trendChart.innerHTML = '<div class="trend-empty">No data available</div>';
      return;
    }
    
    // Group by date
    const period = analyticsPeriod.value;
    const days = period === 'all' ? 30 : parseInt(period);
    const dates = {};
    
    // Initialize dates
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dates[key] = 0;
    }
    
    // Count complaints per date
    complaints.forEach(c => {
      const ts = c.timestamp || c.createdAt || c.created_on || c.createdOn;
      if (ts) {
        const date = new Date(ts);
        const key = date.toISOString().split('T')[0];
        if (dates.hasOwnProperty(key)) {
          dates[key]++;
        }
      }
    });
    
    const values = Object.values(dates);
    const max = Math.max(...values, 1);
    
    // Render bars
    Object.entries(dates).forEach(([date, count]) => {
      const height = (count / max) * 100;
      const label = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const bar = document.createElement('div');
      bar.className = 'trend-bar';
      bar.style.height = height + '%';
      bar.innerHTML = `
        <div class="trend-bar-tooltip">${count} complaints</div>
        <div class="trend-bar-label">${label}</div>
      `;
      trendChart.appendChild(bar);
    });
  }

  // Profile View
  const profileDisplay = document.getElementById('profile-display');
  const profileEdit = document.getElementById('profile-edit');
  const btnEditProfile = document.getElementById('btn-edit-profile');
  const btnCancelProfile = document.getElementById('btn-cancel-profile');
  const btnUpdateProfile = document.getElementById('btn-update-profile');
  const profileUpdateError = document.getElementById('profile-update-error');
  const profileUpdateSuccess = document.getElementById('profile-update-success');

  function renderProfile() {
    if (!currentAdminProfile) return;

    // Display mode
    document.getElementById('profile-id-display').textContent = currentAdminProfile.adminId || '-';
    document.getElementById('profile-name-display').textContent = currentAdminProfile.fullName || '-';
    document.getElementById('profile-email-display').textContent = currentAdminProfile.email || '-';
    document.getElementById('profile-college-display').textContent = currentAdminProfile.collegeName || '-';
    document.getElementById('profile-department-display').textContent = currentAdminProfile.department || '-';
    document.getElementById('profile-designation-display').textContent = currentAdminProfile.designation || '-';
    document.getElementById('profile-status-display').innerHTML = badge(currentAdminProfile.status);
    document.getElementById('profile-reg-date-display').textContent = formatDate(currentAdminProfile.registrationTimestamp);

    // Edit mode
    document.getElementById('profile-name-edit').value = currentAdminProfile.fullName || '';
    document.getElementById('profile-college-edit').value = currentAdminProfile.collegeName || '';
    document.getElementById('profile-department-edit').value = currentAdminProfile.department || '';
    document.getElementById('profile-designation-edit').value = currentAdminProfile.designation || '';

    // Reset to display mode
    show(profileDisplay);
    hide(profileEdit);
    profileUpdateError.textContent = '';
    profileUpdateSuccess.textContent = '';
  }

  btnEditProfile.addEventListener('click', () => {
    hide(profileDisplay);
    show(profileEdit);
    profileUpdateError.textContent = '';
    profileUpdateSuccess.textContent = '';
  });

  btnCancelProfile.addEventListener('click', () => {
    renderProfile();
  });

  btnUpdateProfile.addEventListener('click', async () => {
    profileUpdateError.textContent = '';
    profileUpdateSuccess.textContent = '';

    const fullName = document.getElementById('profile-name-edit').value.trim();
    const collegeName = document.getElementById('profile-college-edit').value.trim();
    const department = document.getElementById('profile-department-edit').value.trim();
    const designation = document.getElementById('profile-designation-edit').value.trim();

    if (!fullName || !collegeName || !department || !designation) {
      profileUpdateError.textContent = 'All fields are required.';
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      await db.ref(`admins/${user.uid}`).update({
        fullName,
        collegeName,
        department,
        designation,
      });

      // Update local profile
      currentAdminProfile.fullName = fullName;
      currentAdminProfile.collegeName = collegeName;
      currentAdminProfile.department = department;
      currentAdminProfile.designation = designation;

      // Update header display
      currentUserEl.textContent = `${fullName} • ${user.email}`;

      profileUpdateSuccess.textContent = 'Profile updated successfully!';
      setTimeout(() => {
        renderProfile();
      }, 1500);
    } catch (e) {
      profileUpdateError.textContent = e.message || 'Failed to update profile';
    }
  });

  // ========================================
  // CHAT FUNCTIONALITY
  // ========================================
  
  let chatRequestsCache = [];
  let activeChatAdminId = null;
  let messagesListener = null;
  let typingListener = null;
  let typingTimeout = null;

  // Load chat requests and approved chats
  function loadChatRequests() {
    // Listen to chatRequests
    db.ref('chatRequests').on('value', (snap) => {
      chatRequestsCache = [];
      if (snap.exists()) {
        snap.forEach(s => {
          const req = s.val();
          req.adminId = s.key;
          chatRequestsCache.push(req);
        });
      }
      renderChatRequests();
    });

    // Listen to chatStatus for approved and ended chats
    db.ref('chatStatus').on('value', (snap) => {
      const approvedChats = [];
      const endedChats = [];
      if (snap.exists()) {
        snap.forEach(s => {
          const status = s.val();
          if (status.status === 'approved') {
            approvedChats.push({
              adminId: s.key,
              ...status
            });
          } else if (status.status === 'ended') {
            endedChats.push({
              adminId: s.key,
              ...status
            });
          }
        });
      }
      renderApprovedChats(approvedChats);
      renderEndedChats(endedChats);
    });
  }

  // Render pending requests
  function renderChatRequests() {
    const pendingRequests = chatRequestsCache.filter(r => r.status === 'pending');
    const container = document.getElementById('pending-requests-list');
    const emptyMsg = document.getElementById('no-pending-requests');
    
    container.innerHTML = '';
    
    if (pendingRequests.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }
    
    emptyMsg.classList.add('hidden');
    
    pendingRequests.forEach(req => {
      const card = document.createElement('div');
      card.className = 'chat-request-card';
      card.innerHTML = `
        <div class="chat-request-info">
          <h4>${req.adminEmail || 'Admin'}</h4>
          <p style="margin: 4px 0; color: var(--muted); font-size: 13px;">${req.message || 'Requesting chat approval'}</p>
          <p style="margin: 4px 0 0; color: var(--muted); font-size: 12px;">${formatDate(req.requestTime)}</p>
        </div>
        <div class="chat-request-actions">
          <button class="btn small success btn-approve-chat" data-admin-id="${req.adminId}">Approve</button>
          <button class="btn small danger btn-reject-chat" data-admin-id="${req.adminId}">Reject</button>
        </div>
      `;
      
      // Attach event listeners
      card.querySelector('.btn-approve-chat').addEventListener('click', () => approveChatRequest(req.adminId));
      card.querySelector('.btn-reject-chat').addEventListener('click', () => rejectChatRequest(req.adminId));
      
      container.appendChild(card);
    });
  }

  // Render approved chats
  function renderApprovedChats(approvedChats) {
    const container = document.getElementById('active-chats-list');
    const emptyMsg = document.getElementById('no-active-chats');
    
    container.innerHTML = '';
    
    if (approvedChats.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }
    
    emptyMsg.classList.add('hidden');
    
    // Get admin details for each approved chat
    approvedChats.forEach(async (chat) => {
      const adminSnap = await db.ref(`admins/${chat.adminId}`).get();
      const admin = adminSnap.exists() ? adminSnap.val() : {};
      
      const card = document.createElement('div');
      card.className = 'chat-request-card';
      card.innerHTML = `
        <div class="chat-request-info">
          <h4>${admin.fullName || admin.email || 'Admin'}</h4>
          <p style="margin: 4px 0; color: var(--muted); font-size: 13px;">${admin.email || ''}</p>
          <p style="margin: 4px 0 0; color: var(--success); font-size: 12px;">✓ Approved</p>
        </div>
        <div class="chat-request-actions">
          <button class="btn small primary btn-open-chat" data-admin-id="${chat.adminId}" data-admin-name="${admin.fullName || admin.email || 'Admin'}" data-admin-email="${admin.email || ''}">Chat</button>
          <button class="btn small danger btn-end-chat" data-admin-id="${chat.adminId}" data-admin-name="${admin.fullName || admin.email || 'Admin'}">End Chat</button>
        </div>
      `;
      
      // Attach event listeners
      card.querySelector('.btn-open-chat').addEventListener('click', (e) => {
        const adminId = e.target.getAttribute('data-admin-id');
        const adminName = e.target.getAttribute('data-admin-name');
        const adminEmail = e.target.getAttribute('data-admin-email');
        openChatWindow(adminId, adminName, adminEmail);
      });
      
      card.querySelector('.btn-end-chat').addEventListener('click', (e) => {
        const adminId = e.target.getAttribute('data-admin-id');
        const adminName = e.target.getAttribute('data-admin-name');
        endChatWithAdmin(adminId, adminName);
      });
      
      container.appendChild(card);
    });
  }

  // Approve chat request
  async function approveChatRequest(adminId) {
    try {
      // Update chatStatus
      await db.ref(`chatStatus/${adminId}`).set({
        status: 'approved',
        approvedTime: Date.now()
      });
      
      // Update chatRequests
      await db.ref(`chatRequests/${adminId}`).update({
        status: 'approved'
      });
      
      // Send welcome message
      sendMessageToAdmin(adminId, 'Welcome! Your chat has been approved. How can I help you today?');
      
      // Show success message
      alert('Chat request approved successfully! Welcome message sent.');
      
    } catch (e) {
      alert('Failed to approve: ' + e.message);
    }
  }

  // Render ended chats
  function renderEndedChats(endedChats) {
    const container = document.getElementById('ended-chats-list');
    const emptyMsg = document.getElementById('no-ended-chats');
    
    container.innerHTML = '';
    
    if (endedChats.length === 0) {
      emptyMsg.classList.remove('hidden');
      return;
    }
    
    emptyMsg.classList.add('hidden');
    
    // Get admin details for each ended chat
    endedChats.forEach(async (chat) => {
      const adminSnap = await db.ref(`admins/${chat.adminId}`).get();
      const admin = adminSnap.exists() ? adminSnap.val() : {};
      
      const card = document.createElement('div');
      card.className = 'chat-request-card ended';
      card.innerHTML = `
        <div class="chat-request-info">
          <h4>${admin.fullName || admin.email || 'Admin'}</h4>
          <p style="margin: 4px 0; color: var(--muted); font-size: 13px;">${admin.email || ''}</p>
          <p style="margin: 4px 0 0; color: var(--danger); font-size: 12px;">✗ Ended - ${formatDate(chat.endedTime)}</p>
        </div>
        <div class="chat-request-actions">
          <button class="btn small primary btn-view-history" data-admin-id="${chat.adminId}" data-admin-name="${admin.fullName || admin.email || 'Admin'}" data-admin-email="${admin.email || ''}">View History</button>
        </div>
      `;
      
      // Attach event listener
      card.querySelector('.btn-view-history').addEventListener('click', (e) => {
        const adminId = e.target.getAttribute('data-admin-id');
        const adminName = e.target.getAttribute('data-admin-name');
        const adminEmail = e.target.getAttribute('data-admin-email');
        openChatWindow(adminId, adminName, adminEmail, true); // true = read-only
      });
      
      container.appendChild(card);
    });
  }

  // Reject chat request
  async function rejectChatRequest(adminId) {
    try {
      // Update chatStatus
      await db.ref(`chatStatus/${adminId}`).set({
        status: 'rejected',
        rejectedTime: Date.now()
      });
      
      // Update chatRequests
      await db.ref(`chatRequests/${adminId}`).update({
        status: 'rejected'
      });
      
      // Show success message
      alert('Chat request rejected successfully.');
      
    } catch (e) {
      alert('Failed to reject: ' + e.message);
    }
  }

  // End chat with admin
  async function endChatWithAdmin(adminId, adminName) {
    const confirmed = confirm(`End chat with ${adminName}?\n\nThis will close the conversation and they will need to request approval again.`);
    
    if (!confirmed) return;
    
    try {
      // Update chatStatus to ended
      await db.ref(`chatStatus/${adminId}`).set({
        status: 'ended',
        endedTime: Date.now()
      });
      
      // Update chatRequests
      await db.ref(`chatRequests/${adminId}`).update({
        status: 'ended'
      });
      
      // Close chat window if open
      if (activeChatAdminId === adminId) {
        document.getElementById('chat-window-modal').close();
        stopTyping(adminId);
        activeChatAdminId = null;
      }
      
      // Show success message
      alert('Chat ended successfully. The admin will need to request approval again.');
      
    } catch (e) {
      alert('Failed to end chat: ' + e.message);
    }
  }

  // Open chat window
  function openChatWindow(adminId, adminName, adminEmail, readOnly = false) {
    activeChatAdminId = readOnly ? null : adminId;
    
    // Set header info
    document.getElementById('chat-admin-name').textContent = adminName + (readOnly ? ' (Ended)' : '');
    document.getElementById('chat-admin-email').textContent = adminEmail;
    
    // Clear messages
    document.getElementById('chat-messages').innerHTML = '';
    document.getElementById('chat-input').value = '';
    
    // Load messages
    loadMessages(adminId);
    
    // Get input container
    const inputContainer = document.querySelector('.chat-input-container');
    const typingIndicator = document.getElementById('typing-indicator');
    
    // Handle read-only mode
    if (readOnly) {
      if (inputContainer) inputContainer.style.display = 'none';
      if (typingIndicator) typingIndicator.style.display = 'none';
    } else {
      if (inputContainer) inputContainer.style.display = 'flex';
      if (typingIndicator) typingIndicator.style.display = 'block';
      // Listen for typing
      listenForAdminTyping(adminId);
    }
    
    // Show modal
    document.getElementById('chat-window-modal').showModal();
  }

  // Load messages
  function loadMessages(adminId) {
    // Remove previous listener if exists
    if (messagesListener) {
      db.ref(`adminChats/${adminId}`).off('child_added', messagesListener);
    }
    
    messagesListener = (snap) => {
      const message = snap.val();
      if (message) {
        displayMessage(message);
      }
    };
    
    db.ref(`adminChats/${adminId}`).on('child_added', messagesListener);
  }

  // Display a message in the chat
  function displayMessage(message) {
    const container = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    const isSuperAdmin = message.senderType === 'superadmin';
    
    messageDiv.className = `chat-message ${isSuperAdmin ? 'sent' : 'received'}`;
    messageDiv.innerHTML = `
      <div class="message-bubble">
        <p>${message.message}</p>
        <span class="message-time">${formatDate(message.timestamp)}</span>
      </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
  }

  // Send message
  async function sendMessageToAdmin(adminId, messageText) {
    if (!messageText || !messageText.trim()) return;
    
    const superAdminId = auth.currentUser?.uid || 'superadmin';
    
    const messageData = {
      senderId: superAdminId,
      message: messageText.trim(),
      timestamp: Date.now(),
      senderType: 'superadmin'
    };
    
    try {
      await db.ref(`adminChats/${adminId}`).push(messageData);
      stopTyping(adminId);
    } catch (e) {
      alert('Failed to send message: ' + e.message);
    }
  }

  // Listen for admin typing
  function listenForAdminTyping(adminId) {
    // Remove previous listener
    if (typingListener) {
      db.ref(`typing/${adminId}/admin`).off('value', typingListener);
    }
    
    typingListener = (snap) => {
      const isTyping = snap.val();
      const indicator = document.getElementById('typing-indicator');
      
      if (isTyping === true) {
        indicator.classList.remove('hidden');
      } else {
        indicator.classList.add('hidden');
      }
    };
    
    db.ref(`typing/${adminId}/admin`).on('value', typingListener);
  }

  // Start typing indicator
  function startTyping(adminId) {
    db.ref(`typing/${adminId}/superadmin`).set(true);
  }

  // Stop typing indicator
  function stopTyping(adminId) {
    db.ref(`typing/${adminId}/superadmin`).set(false);
  }

  // Chat input event listeners
  const chatInput = document.getElementById('chat-input');
  const btnSendMessage = document.getElementById('btn-send-message');
  const btnCloseChat = document.getElementById('btn-close-chat');
  
  chatInput.addEventListener('input', () => {
    if (!activeChatAdminId) return;
    
    startTyping(activeChatAdminId);
    
    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Stop typing after 2 seconds of inactivity
    typingTimeout = setTimeout(() => {
      stopTyping(activeChatAdminId);
    }, 2000);
  });
  
  btnSendMessage.addEventListener('click', () => {
    if (!activeChatAdminId) return;
    
    const message = chatInput.value.trim();
    if (message) {
      sendMessageToAdmin(activeChatAdminId, message);
      chatInput.value = '';
    }
  });
  
  // Send on Enter (Shift+Enter for new line)
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      btnSendMessage.click();
    }
  });
  
  btnCloseChat.addEventListener('click', () => {
    if (activeChatAdminId) {
      stopTyping(activeChatAdminId);
      
      // Remove listeners
      if (messagesListener) {
        db.ref(`adminChats/${activeChatAdminId}`).off('child_added', messagesListener);
      }
      if (typingListener) {
        db.ref(`typing/${activeChatAdminId}/admin`).off('value', typingListener);
      }
      
      activeChatAdminId = null;
    }
    
    document.getElementById('chat-window-modal').close();
  });
})();

