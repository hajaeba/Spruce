/* =========================
   Simple client-side “DB”
========================= */
const DB_KEY = "psocial_db_v2";
const loadDB = () => JSON.parse(localStorage.getItem(DB_KEY) || '{"users":[],"posts":[],"session":null}');
const saveDB = (db) => localStorage.setItem(DB_KEY, JSON.stringify(db));
const uid = () => Math.random().toString(36).slice(2, 10);

/* =========================
   Auth + Users
========================= */
const Auth = {
  me() { return loadDB().session; },
  login(identity, password) {
    const db = loadDB();
    const u = db.users.find(x => (x.username === identity || x.email === identity) && x.password === password);
    if (!u) throw new Error("Invalid credentials");
    if (u.deactivated) throw new Error("Account is deactivated");
    db.session = { id: u.id, username: u.username };
    saveDB(db);
  },
  logout() { const db = loadDB(); db.session = null; saveDB(db); },
  register({ username, email, password, sq, sa }) {
    const db = loadDB();
    if (db.users.some(u => u.username === username || u.email === email)) throw new Error("User exists");
    db.users.push({ id: uid(), username, email, password, sq, sa, profile: { displayName: username, bio: "" }, followers: [], following: [] });
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
  saveProfile({ displayName, bio }) {
    const db = loadDB();
    if (!db.session) return;
    const u = db.users.find(x => x.id === db.session.id);
    u.profile.displayName = displayName; u.profile.bio = bio; saveDB(db);
  }
};

/* =========================
   Posts
========================= */
const Posts = {
  create(text) {
    const db = loadDB();
    if (!db.session) throw new Error("Not logged in");
    db.posts.unshift({ id: uid(), userId: db.session.id, username: db.session.username, text, likes: [], comments: [], ts: Date.now() });
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
  remove(id) {
    const db = loadDB(); db.posts = db.posts.filter(p => p.id !== id); saveDB(db);
  }
};

/* =========================
   UI helpers & Routing
========================= */
const $ = (sel) => document.querySelector(sel);
const $id = (id) => document.getElementById(id);
const fmt = (ts) => new Date(ts).toLocaleString();

function show(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $id(id).classList.add("active");
}

function setNavState() {
  const authed = !!Auth.me();
  $("#logoutBtn").style.display = authed ? "inline-flex" : "none";
  $("#loginLink").style.display = authed ? "none" : "inline-flex";
}

const routes = {
  "#/feed": () => { guard(); setNavState(); show("view-feed"); renderFeed(); },
  "#/profile": () => { guard(); setNavState(); show("view-profile"); renderProfile(); },
  "#/about": () => { setNavState(); show("view-about"); },
  "#/resources": () => { setNavState(); show("view-resources"); },
  "#/login": () => { setNavState(); show("view-landing"); },
  "#/reset": () => { setNavState(); show("view-reset"); },
  "#/landing": () => { setNavState(); show("view-landing"); }
};
function guard() { if (!Auth.me()) location.hash = "#/landing"; }
function handleRoute() { (routes[location.hash] || routes["#/landing"])(); }
window.addEventListener("hashchange", handleRoute);

/* =========================
   Renderers
========================= */
function renderFeed() {
  const list = $id("feedList"); list.innerHTML = "";
  Posts.all().forEach(p => {
    const li = document.createElement("li"); li.className = "post";
    li.innerHTML = `
      <div class="meta"><strong>@${p.username}</strong> • <span>${fmt(p.ts)}</span></div>
      <div>${escapeHtml(p.text)}</div>
      <div class="row" style="margin-top:8px">
        <button data-like="${p.id}" class="btn">❤ ${p.likes.length}</button>
        <form data-comment="${p.id}" class="row" style="flex:1">
          <input name="text" placeholder="Comment..." />
        </form>
        <button data-del="${p.id}" class="btn danger">Delete</button>
      </div>
      <ul class="stack" style="margin-top:8px">
        ${p.comments.map(c => `<li class="card"><span class="meta"><b>@${c.username}</b> • ${fmt(c.ts)}</span><div>${escapeHtml(c.text)}</div></li>`).join("")}
      </ul>
    `;
    list.appendChild(li);
  });
}

function renderProfile() {
  const db = loadDB(); const me = db.session; if (!me) return;
  const u = db.users.find(x => x.id === me.id);
  const f = $id("profileForm");
  f.displayName.value = u.profile.displayName || u.username;
  f.bio.value = u.profile.bio || "";
  const mine = $id("myPosts"); mine.innerHTML = "";
  Posts.mine().forEach(p => {
    const li = document.createElement("li"); li.className = "post";
    li.innerHTML = `<div class="meta">${fmt(p.ts)}</div><div>${escapeHtml(p.text)}</div>`;
    mine.appendChild(li);
  });
}

/* =========================
   Events
========================= */
// top nav route clicks
document.body.addEventListener("click", (e) => {
  const a = e.target.closest("[data-route]");
  if (a) { location.hash = a.getAttribute("data-route"); }
});

// login/logout
$id("loginForm").addEventListener("submit", e => {
  e.preventDefault(); const fd = new FormData(e.target);
  try { Auth.login(fd.get("username").trim(), fd.get("password")); location.hash = "#/feed"; }
  catch (err) { alert(err.message); }
});
$("#logoutBtn").addEventListener("click", () => { Auth.logout(); location.hash = "#/landing"; });

// register
$id("registerForm").addEventListener("submit", e => {
  e.preventDefault(); const fd = new FormData(e.target);
  try {
    Auth.register({
      username: fd.get("username").trim(),
      email: fd.get("email").trim(),
      password: fd.get("password"),
      sq: fd.get("sq"), sa: fd.get("sa")
    });
    alert("Account created. Log in now.");
    location.hash = "#/landing";
  } catch (err) { alert(err.message); }
});

// post create
$id("postForm").addEventListener("submit", e => {
  e.preventDefault(); const fd = new FormData(e.target);
  try { Posts.create(fd.get("text").t
