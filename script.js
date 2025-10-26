/* =========================
   Local "DB" (no server)
========================= */
const DB_KEY = "psocial_db_v3";
const loadDB = () =>
  JSON.parse(
    localStorage.getItem(DB_KEY) ||
      JSON.stringify({
        users: [],
        posts: [],
        session: null,
        metrics: { logins: 0 },
        seeded: false,
      })
  );
const saveDB = (db) => localStorage.setItem(DB_KEY, JSON.stringify(db));
const uid = () => Math.random().toString(36).slice(2, 10);

/* seed admin on first run */
(function seed() {
  const db = loadDB();
  if (db.seeded) return;
  const admin = {
    id: uid(),
    username: "admin",
    email: "admin@example.com",
    password: "admin123",
    sq: "code?",
    sa: "admin",
    role: "admin",
    deactivated: false,
    profile: { displayName: "Administrator", bio: "Site admin", avatar: "" },
    followers: [],
    following: [],
  };
  db.users.push(admin);
  db.seeded = true;
  saveDB(db);
})();

/* =========================
   Auth + Users
========================= */
const Auth = {
  me() { return loadDB().session; },
  login(identity, password) {
    const db = loadDB();
    const u = db.users.find(x => (x.username === identity || x.email === identity) && x.password === password);
    if (!u) throw new Error("Invalid credentials");
    if (u.deactivated) throw new Error("Account is deactivated by admin");
    db.session = { id: u.id, username: u.username };
    db.metrics.logins = (db.metrics.logins || 0) + 1;
    saveDB(db);
  },
  logout() { const db = loadDB(); db.session = null; saveDB(db); },
  register({ username, email, password, sq, sa }) {
    const db = loadDB();
    if (db.users.some(u => u.username === username || u.email === email)) throw new Error("User exists");
    db.users.push({
      id: uid(), username, email, password, sq, sa, role: "user", deactivated: false,
      profile: { displayName: username, bio: "", avatar: "" }, followers: [], following: []
    });
    saveDB(db);
  },
  findIdentity(identity) {
    const db = loadDB();
    return db.users.find(u => u.username === identity || u.email === identity);
  },
  resetPassword({ identity, sa, newPw }) {
    const db = loadDB();
    const u = db.users.find(x => x.username === identity || x.email === identity);
    if (!u) throw new Error("Account not found");
    if ((u.sa || "").trim().toLowerCase() !== sa.trim().toLowerCase()) throw new Error("Wrong answer");
    u.password = newPw; saveDB(db);
  },
  saveProfile({ displayName, bio, avatar }) {
    const db = loadDB();
    if (!db.session) return;
    const u = db.users.find(x => x.id === db.session.id);
    if (!u) return;
    u.profile.displayName = displayName;
    u.profile.bio = bio;
    if (typeof avatar === "string") u.profile.avatar = avatar;
    saveDB(db);
  },
  isAdmin() {
    const db = loadDB();
    const me = db.session && db.users.find(u => u.id === db.session.id);
    return !!me && me.role === "admin";
  },
};

const Users = {
  byId(id) { return loadDB().users.find(u => u.id === id); },
  byUsername(username) {
    const db = loadDB();
    return db.users.find(u => u.username.toLowerCase() === (username || "").toLowerCase());
  },
  list() { return loadDB().users; },
  follow(userId) {
    const db = loadDB(); if (!db.session) return;
    const me = db.users.find(u => u.id === db.session.id);
    const target = db.users.find(u => u.id === userId);
    if (!me || !target || me.id === target.id) return;
    if (!me.following.includes(target.id)) me.following.push(target.id);
    if (!target.followers.includes(me.id)) target.followers.push(me.id);
    saveDB(db);
  },
  unfollow(userId) {
    const db = loadDB(); if (!db.session) return;
    const me = db.users.find(u => u.id === db.session.id);
    const target = db.users.find(u => u.id === userId);
    if (!me || !target || me.id === target.id) return;
    me.following = me.following.filter(id => id !== target.id);
    target.followers = target.followers.filter(id => id !== me.id);
    saveDB(db);
  },
};

const Admin = {
  deactivate(userId, value) {
    const db = loadDB(); if (!Auth.isAdmin()) throw new Error("Admin only");
    const u = db.users.find(u => u.id === userId); if (u) u.deactivated = !!value; saveDB(db);
  },
  resetUserPassword(userId, newPw) {
    const db = loadDB(); if (!Auth.isAdmin()) throw new Error("Admin only");
    const u = db.users.find(u => u.id === userId); if (u) u.password = newPw; saveDB(db);
  },
  deletePost(postId) {
    const db = loadDB(); if (!Auth.isAdmin()) throw new Error("Admin only");
    db.posts = db.posts.filter(p => p.id !== postId); saveDB(db);
  },
  report() {
    const db = loadDB();
    const likes = db.posts.reduce((n, p) => n + p.likes.length, 0);
    const comments = db.posts.reduce((n, p) => n + p.comments.length, 0);
    const flagged = db.posts.filter(p => (p.flags || []).length > 0).length;
    return { users: db.users.length, posts: db.posts.length, likes, comments, logins: db.metrics.logins || 0, flaggedPosts: flagged };
  },
};

/* =========================
   Posts
========================= */
const Posts = {
  create(text) {
    const db = loadDB(); if (!db.session) throw new Error("Not logged in");
    db.posts.unshift({ id: uid(), userId: db.session.id, username: db.session.username, text, likes: [], comments: [], flags: [], ts: Date.now() });
    saveDB(db);
  },
  all() { return loadDB().posts; },
  mine() {
    const db = loadDB();
    return db.session ? db.posts.filter(p => p.userId === db.session.id) : [];
  },
  like(id) {
    const db = loadDB(); const me = db.session; if (!me) return;
    const p = db.posts.find(p => p.id === id); if (!p) return;
    const i = p.likes.indexOf(me.id);
    if (i === -1) p.likes.push(me.id); else p.likes.splice(i, 1);
    saveDB(db);
  },
  comment(id, text) {
    const db = loadDB(); const me = db.session; if (!me) return;
    const p = db.posts.find(p => p.id === id); if (!p) return;
    p.comments.push({ id: uid(), userId: me.id, username: me.username, text, ts: Date.now() });
    saveDB(db);
  },
  edit(id, text) {
    const db = loadDB(); const me = db.session;
    const p = db.posts.find(p => p.id === id); if (!p) return;
    if (p.userId !== me?.id) throw new Error("Can only edit your own post");
    p.text = text; saveDB(db);
  },
  remove(id) {
    const db = loadDB(); const me = db.session;
    const p = db.posts.find(p => p.id === id); if (!p) return;
    if (Auth.isAdmin() || p.userId === me?.id) {
      db.posts = db.posts.filter(p => p.id !== id); saveDB(db);
    }
  },
  flag(id, reason) {
    const db = loadDB(); const me = db.session; if (!me) return;
    const p = db.posts.find(p => p.id === id); if (!p) return;
    p.flags = p.flags || []; p.flags.push({ id: uid(), by: me.id, reason: reason || "Inappropriate" }); saveDB(db);
  },
};

/* =========================
   UI helpers & Routing
========================= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const $id = (id) => document.getElementById(id);
const fmt = (ts) => new Date(ts).toLocaleString();
const escapeHtml = (s="") => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function show(id) { $$(".view").forEach(v => v.classList.remove("active")); $id(id).classList.add("active"); }
function setNavState() {
  const authed = !!Auth.me();
  $("#logoutBtn").style.display = authed ? "inline-flex" : "none";
  $("#loginLink").style.display = authed ? "none" : "inline-flex";
}

const routes = {
  "#/feed": () => { guard(); setNavState(); show("view-feed"); renderFeed(); },
  "#/profile": () => { guard(); setNavState(); show("view-profile"); renderProfile(); },
  "#/user": () => { guard(); setNavState(); show("view-user"); renderUserFromHash(); },
  "#/search": () => { guard(); setNavState(); show("view-search"); renderSearch(); },
  "#/admin": () => { guard(); if (!Auth.isAdmin()) return (location.hash = "#/feed"); setNavState(); show("view-admin"); renderAdmin(); },
  "#/about": () => { setNavState(); show("view-about"); },
  "#/resources": () => { setNavState(); show("view-resources"); },
  "#/login": () => { setNavState(); show("view-landing"); },
  "#/reset": () => { setNavState(); show("view-reset"); },
  "#/landing": () => { setNavState(); show("view-landing"); },
};
function guard(){ if(!Auth.me()) location.hash = "#/landing"; }
function handleRoute(){ (routes[location.hash.split("?")[0]] || routes["#/landing"])(); }
window.addEventListener("hashchange", handleRoute);

/* =========================
   Renderers
========================= */
function userLink(username){ return `<a href="#/user?u=${encodeURIComponent(username)}" class="user-link">@${escapeHtml(username)}</a>`; }

function renderFeed(){
  const list = $id("feedList"); list.innerHTML = "";
  Posts.all().forEach(p => {
    const canEdit = Auth.me()?.id === p.userId;
    const li = document.createElement("li"); li.className = "post";
    li.innerHTML = `
      <div class="meta"><strong>${userLink(p.username)}</strong> • <span>${fmt(p.ts)}</span></div>
      <div data-post-text="${p.id}">${escapeHtml(p.text)}</div>
      <div class="row" style="margin-top:8px">
        <button data-like="${p.id}" class="btn">❤ ${p.likes.length}</button>
        <form data-comment="${p.id}" class="row" style="flex:1"><input name="text" placeholder="Comment..." /></form>
        <button data-flag="${p.id}" class="btn">Flag</button>
        ${canEdit ? `<button data-edit="${p.id}" class="btn">Edit</button>` : ""}
        ${canEdit || Auth.isAdmin() ? `<button data-del="${p.id}" class="btn danger">Delete</button>` : ""}
      </div>
      <ul class="stack" style="margin-top:8px">
        ${(p.comments||[]).map(c=>`<li class="card"><span class="meta"><b>${userLink(c.username)}</b> • ${fmt(c.ts)}</span><div>${escapeHtml(c.text)}</div></li>`).join("")}
      </ul>`;
    list.appendChild(li);
  });
}

function renderProfile(){
  const db = loadDB();
  const me = db.session && db.users.find(u => u.id === db.session.id);
  if (!me) return;
  const f = $id("profileForm");
  f.displayName.value = me.profile.displayName || me.username;
  f.bio.value = me.profile.bio || "";
  if ($id("avatarPreview")) $id("avatarPreview").src = me.profile.avatar || "";
  $id("followerCount").textContent = (me.followers || []).length;
  $id("followingCount").textContent = (me.following || []).length;

  const mine = $id("myPosts"); mine.innerHTML = "";
  Posts.mine().forEach(p => {
    const li = document.createElement("li"); li.className = "post";
    li.innerHTML = `<div class="meta">${fmt(p.ts)}</div><div>${escapeHtml(p.text)}</div>`;
    mine.appendChild(li);
  });
}

function getQueryParam(name){
  const m = location.hash.split("?")[1]; if (!m) return "";
  const usp = new URLSearchParams(m); return usp.get(name) || "";
}
function renderUserFromHash(){
  const uname = getQueryParam("u");
  const u = Users.byUsername(uname);
  const me = Auth.me();
  const wrap = $id("userContainer"); wrap.innerHTML = "";
  if(!u) return wrap.innerHTML = `<div class="card">User not found.</div>`;
  const imFollowing = me && Users.byId(me.id).following.includes(u.id);
  const posts = Posts.all().filter(p => p.userId === u.id);
  wrap.innerHTML = `
    <div class="card">
      <div class="row" style="align-items:center; gap:12px">
        <img src="${u.profile.avatar || ""}" alt="" width="56" height="56" style="border-radius:50%;object-fit:cover;background:#222">
        <div>
          <h2 style="margin:0">${escapeHtml(u.profile.displayName || u.username)}</h2>
          <div class="muted">@${escapeHtml(u.username)}</div>
          <div class="muted">Followers: ${u.followers.length} • Following: ${u.following.length}</div>
        </div>
        <div style="margin-left:auto">
          ${me && me.id !== u.id ? `<button class="btn" data-follow="${u.id}">${imFollowing ? "Unfollow" : "Follow"}</button>` : ""}
        </div>
      </div>
      <p>${escapeHtml(u.profile.bio || "")}</p>
    </div>
    <h3>Posts</h3>
    <ul class="stack">
      ${posts.map(p=>`<li class="post"><div class="meta">${fmt(p.ts)}</div><div>${escapeHtml(p.text)}</div></li>`).join("")}
    </ul>`;
}

function renderSearch(){
  const q = ($id("globalSearchInput").value || "").trim().toLowerCase();
  const posts = Posts.all().filter(p => p.text.toLowerCase().includes(q));
  const users = Users.list().filter(u =>
    (u.profile.displayName||"").toLowerCase().includes(q) || (u.username||"").toLowerCase().includes(q)
  );
  $id("searchPosts").innerHTML = posts.map(p=>`<li class="post"><div class="meta">${userLink(p.username)} • ${fmt(p.ts)}</div><div>${escapeHtml(p.text)}</div></li>`).join("");
  $id("searchUsers").innerHTML = users.map(u=>`
    <li class="card">
      <div class="row" style="align-items:center;gap:10px">
        <img src="${u.profile.avatar || ""}" width="36" height="36" style="border-radius:50%;object-fit:cover;background:#222">
        <div><b>${escapeHtml(u.profile.displayName || u.username)}</b><div class="muted">@${escapeHtml(u.username)}</div></div>
        <a class="btn" href="#/user?u=${encodeURIComponent(u.username)}" style="margin-left:auto">View</a>
      </div>
    </li>`).join("");
}

function renderAdmin(){
  const db = loadDB();
  const flagged = db.posts.filter(p => (p.flags||[]).length > 0);
  $id("flaggedList").innerHTML = flagged.map(p=>`
    <li class="card">
      <div class="meta">${userLink(p.username)} • ${fmt(p.ts)}</div>
      <div>${escapeHtml(p.text)}</div>
      <div class="muted">Flags: ${(p.flags||[]).length}</div>
      <div class="row">
        <button class="btn danger" data-admin-del="${p.id}">Delete post</button>
        <button class="btn" data-admin-clear="${p.id}">Clear flags</button>
      </div>
    </li>`).join("");

  $id("adminUsers").innerHTML = db.users.map(u=>`
    <tr>
      <td>${escapeHtml(u.username)} ${u.role==="admin" ? "(admin)" : ""}</td>
      <td>${u.deactivated ? "deactivated" : "active"}</td>
      <td>${u.followers.length}</td>
      <td>${u.following.length}</td>
      <td class="row">
        <button class="btn" data-admin-toggle="${u.id}">${u.deactivated ? "Reactivate" : "Deactivate"}</button>
        <button class="btn" data-admin-reset="${u.id}">Reset PW</button>
      </td>
    </tr>`).join("");

  const r = Admin.report();
  $id("reportBlock").innerHTML = `
    <div class="card">
      <h3>Activity Report</h3>
      <div>Users: ${r.users}</div>
      <div>Posts: ${r.posts}</div>
      <div>Likes: ${r.likes}</div>
      <div>Comments: ${r.comments}</div>
      <div>Logins: ${r.logins}</div>
      <div>Flagged posts: ${r.flaggedPosts}</div>
    </div>`;
}

/* =========================
   Events
========================= */
document.body.addEventListener("click", (e) => {
  const a = e.target.closest("[data-route]"); if (a) location.hash = a.getAttribute("data-route");
});

$id("loginForm").addEventListener("submit", e => {
  e.preventDefault(); const fd = new FormData(e.target);
  try { Auth.login(fd.get("username").trim(), fd.get("password")); location.hash = "#/feed"; }
  catch (err) { alert(err.message); }
});
$("#logoutBtn").addEventListener("click", () => { Auth.logout(); location.hash = "#/landing"; });

$id("registerForm").addEventListener("submit", e => {
  e.preventDefault(); const fd = new FormData(e.target);
  try {
    Auth.register({ username: fd.get("username").trim(), email: fd.get("email").trim(), password: fd.get("password"), sq: fd.get("sq"), sa: fd.get("sa") });
    alert("Account created. Log in now."); location.hash = "#/landing";
  } catch(err){ alert(err.message); }
});

$id("postForm").addEventListener("submit", e => {
  e.preventDefault(); const fd = new FormData(e.target);
  try { Posts.create(fd.get("text").trim()); e.target.reset(); renderFeed(); }
  catch(err){ alert(err.message); }
});

document.body.addEventListener("click", e => {
  const like = e.target.closest("[data-like]"); if (like){ Posts.like(like.dataset.like); renderFeed(); }
  const del = e.target.closest("[data-del]"); if (del){ Posts.remove(del.dataset.del); renderFeed(); }
  const flag = e.target.closest("[data-flag]"); if (flag){ const reason = prompt("Reason for flag?", "Inappropriate"); if (reason!==null){ Posts.flag(flag.dataset.flag, reason); renderFeed(); } }
  const edit = e.target.closest("[data-edit]"); if (edit){ const id = edit.dataset.edit; const node = document.querySelector(`[data-post-text="${id}"]`); const current = node?.textContent || ""; const next = prompt("Edit post text:", current); if (next!==null){ try{ Posts.edit(id, next.trim()); renderFeed(); } catch(err){ alert(err.message); } } }
  const followBtn = e.target.closest("[data-follow]"); if (followBtn){ const targetId = followBtn.dataset.follow; const me = Users.byId(loadDB().session.id); if (me.following.includes(targetId)) Users.unfollow(targetId); else Users.follow(targetId); renderUserFromHash(); }
});

document.body.addEventListener("submit", e => {
  if (e.target.matches('form[data-comment]')) {
    e.preventDefault(); const fd = new FormData(e.target);
    const text = (fd.get("text") || "").trim(); if (!text) return;
    Posts.comment(e.target.getAttribute("data-comment"), text); renderFeed();
  }
});

$id("profileForm").addEventListener("submit", e => {
  e.preventDefault(); const fd = new FormData(e.target);
  Auth.saveProfile({ displayName: fd.get("displayName").trim(), bio: fd.get("bio").trim() });
  alert("Profile saved"); renderProfile();
});
$id("avatarInput")?.addEventListener("change", async e => {
  const file = e.target.files?.[0]; if (!file) return;
  const b64 = await fileToBase64(file);
  Auth.saveProfile({ displayName: $id("profileForm").displayName.value, bio: $id("profileForm").bio.value, avatar: b64 });
  renderProfile();
});
function fileToBase64(file){ return new Promise((res, rej)=>{ const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }

const resetState = { identity: null };
$id("resetLookupForm").addEventListener("submit", e => {
  e.preventDefault(); const idt = new FormData(e.target).get("identity").trim();
  const u = Auth.findIdentity(idt); if (!u) return alert("No account found");
  resetState.identity = (u.username || u.email);
  $id("sqText").textContent = `Security question: ${u.sq}`;
  $id("resetConfirmForm").classList.remove("hidden");
});
$id("resetConfirmForm").addEventListener("submit", e => {
  e.preventDefault(); const fd = new FormData(e.target);
  try { Auth.resetPassword({ identity: resetState.identity, sa: fd.get("sa"), newPw: fd.get("newPw") }); alert("Password updated"); location.hash = "#/landing"; }
  catch (err) { alert(err.message); }
});

const resetState2 = { identity: null };
$id("resetLookupForm2").addEventListener("submit", e => {
  e.preventDefault(); const idt = new FormData(e.target).get("identity").trim();
  const u = Auth.findIdentity(idt); if (!u) return alert("No account found");
  resetState2.identity = (u.username || u.email);
  $id("sqText2").textContent = `Security question: ${u.sq}`;
  $id("resetConfirmForm2").classList.remove("hidden");
});
$id("resetConfirmForm2").addEventListener("submit", e => {
  e.preventDefault(); const fd = new FormData(e.target);
  try { Auth.resetPassword({ identity: resetState2.identity, sa: fd.get("sa"), newPw: fd.get("newPw") }); alert("Password updated"); location.hash = "#/login"; }
  catch (err) { alert(err.message); }
});

$("#searchForm").addEventListener("submit", e => e.preventDefault());
$("#searchInput").addEventListener("input", () => {
  const q = $("#searchInput").value.trim().toLowerCase();
  if (location.hash !== "#/feed") return;
  const list = $id("feedList");
  [...list.children].forEach(li => { li.style.display = li.textContent.toLowerCase().includes(q) ? "" : "none"; });
});

$id("globalSearchForm")?.addEventListener("submit", e => { e.preventDefault(); renderSearch(); });
$id("globalSearchInput")?.addEventListener("input", renderSearch);

document.body.addEventListener("click", e => {
  if (!Auth.isAdmin()) return;
  const del = e.target.closest("[data-admin-del]"); if (del){ Admin.deletePost(del.dataset.adminDel); renderAdmin(); }
  const clear = e.target.closest("[data-admin-clear]"); if (clear){ const db = loadDB(); const p = db.posts.find(p => p.id === clear.dataset.adminClear); if (p) p.flags = []; saveDB(db); renderAdmin(); }
  const toggle = e.target.closest("[data-admin-toggle]"); if (toggle){ const db = loadDB(); const u = db.users.find(u => u.id === toggle.dataset.adminToggle); Admin.deactivate(u.id, !u.deactivated); renderAdmin(); }
  const reset = e.target.closest("[data-admin-reset]"); if (reset){ const npw = prompt("New password:"); if (npw){ Admin.resetUserPassword(reset.dataset.adminReset, npw); alert("Password reset"); } }
});

/* =========================
   Init
========================= */
if (!location.hash) location.hash = "#/landing";
setNavState();
handleRoute();
