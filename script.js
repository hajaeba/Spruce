const DB_KEY = "pseudo_db_v1";
const loadDB = () => JSON.parse(localStorage.getItem(DB_KEY) || '{"users":[],"posts":[],"session":null}');
const saveDB = (db) => localStorage.setItem(DB_KEY, JSON.stringify(db));
const uid = () => Math.random().toString(36).slice(2, 9);

// ---------- AUTH ----------
const Auth = {
  me: () => loadDB().session,
  login(username, pw) {
    const db = loadDB();
    const user = db.users.find(u => (u.username === username || u.email === username) && u.password === pw);
    if (!user) throw Error("Invalid login");
    db.session = { id: user.id, username: user.username };
    saveDB(db);
  },
  logout() { const db = loadDB(); db.session = null; saveDB(db); },
  register({username,email,password,sq,sa}) {
    const db = loadDB();
    if (db.users.find(u => u.username===username||u.email===email)) throw Error("User exists");
    db.users.push({id:uid(),username,email,password,sq,sa,profile:{displayName:username,bio:""}});
    saveDB(db);
  },
  resetPassword({identity,sa,newPw}) {
    const db = loadDB();
    const user = db.users.find(u=>u.username===identity||u.email===identity);
    if(!user) throw Error("Not found");
    if(user.sa.toLowerCase()!==sa.toLowerCase()) throw Error("Wrong answer");
    user.password=newPw; saveDB(db);
  },
  updateProfile({displayName,bio}) {
    const db = loadDB();
    const me = db.session; if(!me) return;
    const u = db.users.find(u=>u.id===me.id);
    u.profile.displayName=displayName; u.profile.bio=bio;
    saveDB(db);
  }
};

// ---------- POSTS ----------
const Posts = {
  create(text) {
    const db = loadDB();
    if(!db.session) throw Error("Not logged in");
    db.posts.unshift({id:uid(),userId:db.session.id,username:db.session.username,text,ts:Date.now(),likes:[],comments:[]});
    saveDB(db);
  },
  all: () => loadDB().posts,
  mine() { const db=loadDB(); return db.posts.filter(p=>p.userId===db.session?.id); },
  like(id) {
    const db = loadDB(); const me=db.session; if(!me) return;
    const p=db.posts.find(p=>p.id===id); if(!p) return;
    const i=p.likes.indexOf(me.id); if(i==-1) p.likes.push(me.id); else p.likes.splice(i,1);
    saveDB(db);
  },
  comment(id,text) {
    const db=loadDB(); const me=db.session; if(!me) return;
    const p=db.posts.find(p=>p.id===id); if(!p) return;
    p.comments.push({id:uid(),username:me.username,text,ts:Date.now()}); saveDB(db);
  },
  del(id){ const db=loadDB(); db.posts=db.posts.filter(p=>p.id!==id); saveDB(db); }
};

// ---------- UI ----------
const $id=id=>document.getElementById(id);
const show=view=>{
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $id(view).classList.add("active");
};
const fmt=ts=>new Date(ts).toLocaleString();

function renderFeed(){
  const ul=$id("feedList"); ul.innerHTML="";
  Posts.all().forEach(p=>{
    const li=document.createElement("li"); li.className="post";
    li.innerHTML=`<strong>@${p.username}</strong> • ${fmt(p.ts)}<br>${p.text}
      <div>
        <button data-like="${p.id}">❤ ${p.likes.length}</button>
        <button data-del="${p.id}">Delete</button>
      </div>
      <ul>${p.comments.map(c=>`<li><b>@${c.username}</b>: ${c.text}</li>`).join("")}</ul>
      <form data-comment="${p.id}"><input name="text" placeholder="Comment..." /></form>`;
    ul.appendChild(li);
  });
}
function renderProfile(){
  const db=loadDB(); const me=db.session; if(!me) return;
  const u=db.users.find(u=>u.id===me.id);
  const f=$id("profileForm"); f.displayName.value=u.profile.displayName; f.bio.value=u.profile.bio;
  const ul=$id("myPosts"); ul.innerHTML="";
  Posts.mine().forEach(p=>{
    const li=document.createElement("li"); li.className="post"; li.innerHTML=`${p.text}`;
    ul.appendChild(li);
  });
}

// ---------- ROUTES ----------
const routes={
  "#/login":()=>{toggleNav(false);show("view-login");},
  "#/register":()=>{toggleNav(false);show("view-register");},
  "#/reset":()=>{toggleNav(false);show("view-reset");},
  "#/feed":()=>{guard();toggleNav(true);show("view-feed");renderFeed();},
  "#/profile":()=>{guard();toggleNav(true);show("view-profile");renderProfile();},
  "#/settings":()=>{guard();toggleNav(true);show("view-settings");}
};
function guard(){if(!Auth.me()) location.hash="#/login";}
function handleRoute(){(routes[location.hash]||routes["#/login"])();}
window.addEventListener("hashchange",handleRoute);
function toggleNav(on){$id("nav-auth").style.display=on?"flex":"none";}

// ---------- EVENTS ----------
$id("loginForm").onsubmit=e=>{
  e.preventDefault(); const fd=new FormData(e.target);
  try{Auth.login(fd.get("username"),fd.get("password"));location.hash="#/feed";}
  catch(err){alert(err.message);}
};
$id("registerForm").onsubmit=e=>{
  e.preventDefault(); const fd=new FormData(e.target);
  try{Auth.register({username:fd.get("username"),email:fd.get("email"),password:fd.get("password"),sq:fd.get("sq"),sa:fd.get("sa")});
  alert("Account created"); location.hash="#/login";}catch(err){alert(err.message);}
};
$id("logoutBtn").onclick=()=>{Auth.logout();location.hash="#/login";};
$id("postForm").onsubmit=e=>{
  e.preventDefault(); const fd=new FormData(e.target);
  Posts.create(fd.get("text")); e.target.reset(); renderFeed();
};
document.body.addEventListener("click",e=>{
  if(e.target.dataset.like){Posts.like(e.target.dataset.like);renderFeed();}
  if(e.target.dataset.del){Posts.del(e.target.dataset.del);renderFeed();}
});
document.body.addEventListener("submit",e=>{
  if(e.target.dataset.comment){
    e.preventDefault(); const fd=new FormData(e.target);
    if(fd.get("text")){Posts.comment(e.target.dataset.comment,fd.get("text"));renderFeed();}
  }
});
$id("profileForm").onsubmit=e=>{
  e.preventDefault(); const fd=new FormData(e.target);
  Auth.updateProfile({displayName:fd.get("displayName"),bio:fd.get("bio")});
  alert("Profile saved");
};
const resetState={};
$id("resetLookupForm").onsubmit=e=>{
  e.preventDefault(); const idt=new FormData(e.target).get("identity");
  const db=loadDB(); const u=db.users.find(u=>u.username===idt||u.email===idt);
  if(!u) return alert("Not found");
  resetState.identity=u.username; $id("sqText").textContent=u.sq;
  $id("resetConfirmForm").classList.remove("hidden");
};
$id("resetConfirmForm").onsubmit=e=>{
  e.preventDefault(); const fd=new FormData(e.target);
  try{Auth.resetPassword({identity:resetState.identity,sa:fd.get("sa"),newPw:fd.get("newPw")});
  alert("Password reset"); location.hash="#/login";}catch(err){alert(err.message);}
};

// ---------- INIT ----------
if(!location.hash) location.hash="#/login";
handleRoute();
