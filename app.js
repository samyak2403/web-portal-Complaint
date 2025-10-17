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

  let adminsCache = [];
  let complaintsCache = [];
  let selectedComplaint = null;

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
      [adminsView, complaintsView].forEach(v => v.classList.add('hidden'));
      document.getElementById(tgt).classList.remove('hidden');
      
      // Update breadcrumb if present
      const viewName = btn.textContent;
      if (breadcrumbText) breadcrumbText.textContent = viewName;
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
    modalBody.innerHTML = `
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
})();

