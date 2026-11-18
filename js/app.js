"use strict";

const MAX_WISHES = 10;
const AVATARS = ["🎅", "🤶", "🧑\u200d🎄", "🦌", "⛄", "🌟", "🔔", "🍭", "🧦", "🎁", "🕯️", "❄️", "🛷", "🥧", "🌰", "🧸"];
const STORAGE_KEY = "secret-santa-manchester-v1";

let state = {
  participants: [],
  assignments: null,
  revealed: []
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* stockage indisponible : on continue en mémoire */ }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.participants)) {
        state = {
          participants: data.participants.map(p => ({
            id: p.id || uid(),
            name: String(p.name || "?").slice(0, 40),
            exclusions: Array.isArray(p.exclusions) ? p.exclusions : [],
            wishlist: Array.isArray(p.wishlist) ? p.wishlist.slice(0, MAX_WISHES) : []
          })),
          assignments: data.assignments && typeof data.assignments === "object" ? data.assignments : null,
          revealed: Array.isArray(data.revealed) ? data.revealed : []
        };
      }
    }
  } catch (e) {
    state = { participants: [], assignments: null, revealed: [] };
  }
}

function byId(id) {
  return state.participants.find(p => p.id === id);
}

/* ---------- Neige ---------- */
function initSnow() {
  const layer = document.getElementById("snowLayer");
  const count = Math.min(40, Math.floor(window.innerWidth / 10));
  for (let i = 0; i < count; i++) {
    const flake = document.createElement("div");
    flake.className = "snowflake";
    flake.textContent = Math.random() < 0.75 ? "❄" : "❅";
    flake.style.left = Math.random() * 100 + "vw";
    flake.style.fontSize = 8 + Math.random() * 14 + "px";
    flake.style.opacity = 0.35 + Math.random() * 0.55;
    flake.style.setProperty("--drift", (Math.random() * 80 - 40) + "px");
    flake.style.animationDuration = 6 + Math.random() * 10 + "s";
    flake.style.animationDelay = -(Math.random() * 16) + "s";
    layer.appendChild(flake);
  }
}

/* ---------- Participants ---------- */
function renderParticipants() {
  const list = document.getElementById("participantsList");
  const empty = document.getElementById("emptyState");
  list.innerHTML = "";
  empty.classList.toggle("hidden", state.participants.length > 0);

  state.participants.forEach((p, idx) => {
    const li = document.createElement("li");
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.textContent = AVATARS[idx % AVATARS.length];

    const name = document.createElement("span");
    name.className = "p-name";
    const meta = document.createElement("span");
    meta.className = "p-meta";
    const wished = p.wishlist.length;
    meta.textContent = `${p.exclusions.length === 1 ? "1 exclusion" : p.exclusions.length + " exclusions"} · ${wished}/${MAX_WISHES} cadeaux`;
    name.appendChild(document.createTextNode(p.name));
    name.appendChild(meta);

    const editBtn = document.createElement("button");
    editBtn.className = "mini-btn";
    editBtn.textContent = "✏️";
    editBtn.setAttribute("aria-label", "Modifier " + p.name);
    editBtn.addEventListener("click", () => openEditor(p.id));

    const delBtn = document.createElement("button");
    delBtn.className = "mini-btn danger";
    delBtn.textContent = "🗑️";
    delBtn.setAttribute("aria-label", "Supprimer " + p.name);
    delBtn.addEventListener("click", () => {
      if (confirm(`Supprimer ${p.name} du tirage ?`)) {
        state.participants = state.participants.filter(x => x.id !== p.id);
        state.participants.forEach(x => {
          x.exclusions = x.exclusions.filter(id => id !== p.id);
        });
        state.assignments = null;
        state.revealed = [];
        state.remote = null;
        save();
        renderParticipants();
        hideReveal();
      }
    });

    li.append(avatar, name, editBtn, delBtn);
    list.appendChild(li);
  });

  document.getElementById("drawBtn").disabled = state.participants.length < 2;
}

/* ---------- Éditeur ---------- */
let editingId = null;

function openEditor(id) {
  editingId = id;
  const p = byId(id);
  if (!p) return;
  document.getElementById("editorSection").classList.remove("hidden");
  document.getElementById("editorName").textContent = p.name;
  renderExclusionChips(p);
  renderWishlistEditor(p);
  document.getElementById("editorSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeEditor() {
  editingId = null;
  document.getElementById("editorSection").classList.add("hidden");
  renderParticipants();
}

function renderExclusionChips(p) {
  const box = document.getElementById("exclusionsChips");
  box.innerHTML = "";
  const others = state.participants.filter(x => x.id !== p.id);
  if (others.length === 0) {
    const hint = document.createElement("span");
    hint.className = "hint";
    hint.textContent = "Ajoutez d'abord d'autres participants.";
    box.appendChild(hint);
    return;
  }
  const current = byId(editingId);
  others.forEach(o => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (current.exclusions.includes(o.id) ? " active" : "");
    chip.textContent = o.name;
    chip.addEventListener("click", () => {
      if (current.exclusions.includes(o.id)) {
        current.exclusions = current.exclusions.filter(id => id !== o.id);
        o.exclusions = o.exclusions.filter(id => id !== current.id);
      } else {
        current.exclusions.push(o.id);
        if (!o.exclusions.includes(current.id)) o.exclusions.push(current.id);
      }
      save();
      renderExclusionChips(current);
      renderParticipants();
    });
    box.appendChild(chip);
  });
}

function renderWishlistEditor(p) {
  const wrap = document.getElementById("wishlistEditor");
  const counter = document.getElementById("wishCounter");
  const addBtn = document.getElementById("addWish");
  wrap.innerHTML = "";
  counter.textContent = `${p.wishlist.length}/${MAX_WISHES}`;
  counter.classList.toggle("warn", p.wishlist.length >= MAX_WISHES);

  p.wishlist.forEach((wish, i) => {
    const row = document.createElement("div");
    row.className = "wish-row";

    const label = document.createElement("input");
    label.type = "text";
    label.placeholder = "Cadeau " + (i + 1);
    label.maxLength = 60;
    label.value = wish.label || "";
    label.addEventListener("input", () => {
      wish.label = label.value;
      save();
    });

    const url = document.createElement("input");
    url.type = "url";
    url.placeholder = "https://lien-du-cadeau…";
    url.inputMode = "url";
    url.value = wish.url || "";
    url.addEventListener("input", () => {
      wish.url = url.value.trim();
      save();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "mini-btn danger del";
    del.textContent = "✖";
    del.addEventListener("click", () => {
      p.wishlist.splice(i, 1);
      save();
      renderWishlistEditor(p);
      renderParticipants();
    });

    row.append(label, url, del);
    wrap.appendChild(row);
  });

  addBtn.disabled = p.wishlist.length >= MAX_WISHES;
}

document.getElementById("addWish").addEventListener("click", () => {
  const p = byId(editingId);
  if (!p || p.wishlist.length >= MAX_WISHES) return;
  p.wishlist.push({ label: "", url: "" });
  save();
  renderWishlistEditor(p);
  renderParticipants();
  const rows = document.querySelectorAll(".wish-row");
  if (rows.length) rows[rows.length - 1].querySelector("input").focus();
});

document.getElementById("closeEditor").addEventListener("click", closeEditor);

/* ---------- Ajout participant ---------- */
document.getElementById("addForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("nameInput");
  const name = input.value.trim();
  if (!name) return;
  state.participants.push({ id: uid(), name: name.slice(0, 40), exclusions: [], wishlist: [] });
  state.assignments = null;
  state.revealed = [];
  state.remote = null;
  input.value = "";
  save();
  renderParticipants();
  hideReveal();
});

/* ---------- Tirage (backtracking avec exclusions) ---------- */
function drawAssignments() {
  const n = state.participants.length;
  const people = state.participants.map(p => p.id);

  const allowed = {};
  people.forEach(giver => {
    allowed[giver] = people.filter(rcv =>
      rcv !== giver &&
      !(byId(giver).exclusions.includes(rcv) || byId(rcv).exclusions.includes(giver))
    );
  });

  const order = [...people].sort((a, b) => allowed[a].length - allowed[b].length);
  const assignmentsMap = {};

  function backtrack(i, used) {
    if (i === n)
      return used.size === n;
    const giver = order[i];
    const targets = [...allowed[giver]].sort(() => Math.random() - 0.5);
    for (const target of targets) {
      if (used.has(target)) continue;
      used.add(target);
      assignmentsMap[giver] = target;
      if (backtrack(i + 1, used)) return true;
      delete assignmentsMap[giver];
      used.delete(target);
    }
    return false;
  }

  if (!backtrack(0, new Set())) return null;
  return assignmentsMap;
}

document.getElementById("drawBtn").addEventListener("click", () => {
  const err = document.getElementById("drawError");
  err.classList.add("hidden");

  const n = state.participants.length;
  if (n < 2) {
    err.textContent = "Il faut au moins 2 participants pour lancer le tirage.";
    err.classList.remove("hidden");
    return;
  }

  const result = drawAssignments();
  if (!result) {
    err.textContent = "Aucun tirage possible avec ces exclusions. Vérifiez les règles « 🚫 » (tout le monde doit pouvoir recevoir d'au moins une personne).";
    err.classList.remove("hidden");
    return;
  }

  state.assignments = result;
  state.revealed = [];
  state.remote = null;
  save();
  showReveal();
});

document.getElementById("resetDraw").addEventListener("click", () => {
  if (!confirm("Annuler le tirage en cours ?")) return;
  state.assignments = null;
  state.revealed = [];
  state.remote = null;
  save();
  hideReveal();
});

/* ---------- Révélation ---------- */
function showReveal() {
  const area = document.getElementById("revealArea");
  const cards = document.getElementById("revealCards");
  area.classList.remove("hidden");
  cards.innerHTML = "";

  state.participants.forEach((p, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reveal-card";
    if (state.revealed.includes(String(idx))) btn.classList.add("done");
    const ribbon = document.createElement("span");
    ribbon.className = "rc-ribbon";
    const label = document.createElement("span");
    label.className = "rc-label";
    label.textContent = AVATARS[idx % AVATARS.length] + " " + p.name;
    const sub = document.createElement("span");
    sub.className = "rc-sub";
    sub.textContent = state.revealed.includes(String(idx))
      ? "Carton ouvert ✔"
      : "Tapez pour ouvrir le carton 🎁";
    btn.append(ribbon, label, document.createElement("br"), sub);
    btn.addEventListener("click", () => openReveal(p.id));
    cards.appendChild(btn);
  });

  area.scrollIntoView({ behavior: "smooth", block: "nearest" });

  document.getElementById("remoteArea").classList.remove("hidden");
  renderRemoteLinks();
}

function hideReveal() {
  document.getElementById("revealArea").classList.add("hidden");
  document.getElementById("remoteArea").classList.add("hidden");
}

function openReveal(giverId) {
  const giver = byId(giverId);
  if (!giver || !state.assignments) return;
  const receiver = byId(state.assignments[giverId]);
  if (!receiver) return;

  const idx = state.participants.indexOf(giver);
  if (!state.revealed.includes(String(idx))) {
    state.revealed.push(String(idx));
    save();
  }

  document.getElementById("revealGiver").textContent = "Carton de " + giver.name;
  document.getElementById("revealReceiver").textContent = receiver.name;

  const wl = document.getElementById("revealWishlist");
  wl.innerHTML = "";
  const items = receiver.wishlist.filter(w => (w.label || "").trim() || (w.url || "").trim());
  const h4 = document.createElement("h4");
  h4.textContent = items.length
    ? "Liste de souhaits de " + receiver.name + " :"
    : receiver.name + " n'a pas encore renseigné de liste de souhaits.";
  wl.appendChild(h4);

  items.forEach(w => {
    const label = (w.label || "").trim() || "Cadeau mystère 🎁";
    const a = document.createElement("a");
    a.textContent = label;
    if ((w.url || "").trim() && /^https?:\/\//i.test(w.url.trim())) {
      a.href = w.url.trim();
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const gl = document.createElement("span");
      gl.className = "glink";
      gl.textContent = "🔗 ouvrir le lien";
      a.appendChild(gl);
    } else {
      a.href = "#";
      a.addEventListener("click", e => e.preventDefault());
    }
    wl.appendChild(a);
  });

  const note = document.createElement("p");
  note.className = "gift-note";
  note.textContent = "🤫 Chut — ne montrez pas l'écran aux autres !";
  wl.appendChild(note);

  document.getElementById("revealModal").classList.remove("hidden");
  showReveal();
}

document.getElementById("closeReveal").addEventListener("click", () => {
  document.getElementById("revealModal").classList.add("hidden");
});

/* ---------- Liens chiffrés à distance (WebCrypto AES-GCM) ---------- */
function b64urlEncode(bytes) {
  let bin = "";
  bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function deriveEncKey(rawKeyBytes, passphrase) {
  const passBytes = new TextEncoder().encode(passphrase || "");
  const material = new Uint8Array(rawKeyBytes.length + passBytes.length);
  material.set(rawKeyBytes, 0);
  material.set(passBytes, rawKeyBytes.length);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptPayload(obj, passphrase) {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const key = await deriveEncKey(rawKey, passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  return b64urlEncode(ct) + "." + b64urlEncode(iv) + "." + b64urlEncode(rawKey);
}

async function decryptToken(token, passphrase) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("format");
  const rawKey = b64urlDecode(parts[2]);
  const iv = b64urlDecode(parts[1]);
  const ct = b64urlDecode(parts[0]);
  const key = await deriveEncKey(rawKey, passphrase);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

function wishlistItems(receiver) {
  return receiver.wishlist.filter(w => (w.label || "").trim() || (w.url || "").trim());
}

function renderWishlistInto(container, receiver) {
  container.innerHTML = "";
  const items = wishlistItems(receiver);
  const h4 = document.createElement("h4");
  h4.textContent = items.length
    ? "Liste de souhaits de " + receiver.name + " :"
    : receiver.name + " n'a pas encore renseigné de liste de souhaits.";
  container.appendChild(h4);

  items.forEach(w => {
    const label = (w.label || "").trim() || "Cadeau mystère 🎁";
    const a = document.createElement("a");
    a.textContent = label;
    if ((w.url || "").trim() && /^https?:\/\//i.test(w.url.trim())) {
      a.href = w.url.trim();
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      const gl = document.createElement("span");
      gl.className = "glink";
      gl.textContent = "🔗 ouvrir le lien";
      a.appendChild(gl);
    } else {
      a.href = "#";
      a.addEventListener("click", e => e.preventDefault());
    }
    container.appendChild(a);
  });
}

function remoteBaseUrl() {
  return location.href.split("#")[0];
}

async function generateRemoteLinks() {
  const err = document.getElementById("remoteError");
  err.classList.add("hidden");
  if (!state.assignments) return;

  if (!window.crypto || !crypto.subtle) {
    err.textContent = "Le navigateur ne supporte pas le chiffrement (HTTPS requis).";
    err.classList.remove("hidden");
    return;
  }

  const passphrase = document.getElementById("remotePassphrase").value.trim();
  const links = [];
  try {
    for (const p of state.participants) {
      const receiver = byId(state.assignments[p.id]);
      if (!receiver) throw new Error("attribution introuvable pour " + p.name);
      const payload = {
        t: "santa",
        g: p.name,
        r: receiver.name,
        wl: wishlistItems(receiver).map(w => ({ l: (w.label || "").trim(), u: (w.url || "").trim() }))
      };
      links.push({ id: p.id, name: p.name, token: await encryptPayload(payload, passphrase) });
    }
  } catch (e) {
    err.textContent = "Chiffrement impossible : " + e.message;
    err.classList.remove("hidden");
    return;
  }

  state.remote = { hasPassphrase: passphrase.length > 0, links };
  save();
  document.getElementById("remotePassHint").classList.toggle("hidden", passphrase.length === 0);
  renderRemoteLinks();
}

function remoteLink(token) {
  return remoteBaseUrl() + "#c=" + token;
}

function remoteMessage(entry) {
  return "🎅 Secret Santa — Salut " + entry.name + " ! Ouvre ton carton secret ici 👉 " +
    remoteLink(entry.token) +
    (state.remote && state.remote.hasPassphrase
      ? "\n💬 Phrase secrète : je te l'envoie à part !"
      : "");
}

function renderRemoteLinks() {
  const box = document.getElementById("remoteLinks");
  box.innerHTML = "";
  if (!state.remote || !Array.isArray(state.remote.links)) return;

  state.remote.links.forEach(entry => {
    const p = byId(entry.id);
    if (!p) return;
    const row = document.createElement("div");
    row.className = "remote-row";

    const name = document.createElement("span");
    name.className = "r-name";
    name.textContent = p.name;

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "mini-btn";
    copyBtn.textContent = "📋 Message";
    copyBtn.setAttribute("aria-label", "Copier le message pour " + p.name);
    copyBtn.addEventListener("click", () => {
      copyText(remoteMessage(entry));
      copyBtn.textContent = "✔ Copié !";
      setTimeout(() => { copyBtn.textContent = "📋 Message"; }, 1600);
    });

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "mini-btn";
    openBtn.textContent = "🔗 Tester";
    openBtn.setAttribute("aria-label", "Tester le carton de " + p.name);
    openBtn.addEventListener("click", () => {
      window.open(remoteLink(entry.token), "_blank", "noopener");
    });

    row.append(name, openBtn, copyBtn);
    box.appendChild(row);
  });
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) { /* ancien navigateur */ }
  document.body.removeChild(ta);
}

document.getElementById("genRemote").addEventListener("click", generateRemoteLinks);

/* ---------- Mode « ouverture de carton » (lien distant) ---------- */

const DECRYPT = { token: "" };

function enterDecryptMode() {
  ["snowLayer", "hero", "participantsSection", "editorSection", "drawSection", "footer"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
  const section = document.getElementById("decryptSection");
  section.classList.remove("hidden");
  document.getElementById("decryptResult").classList.add("hidden");
  document.getElementById("decryptBox").classList.remove("hidden");
  document.getElementById("decryptPass").value = "";
  document.getElementById("decryptError").classList.add("hidden");
}

async function tryDecrypt() {
  const err = document.getElementById("decryptError");
  err.classList.add("hidden");

  if (!DECRYPT.token) {
    err.textContent = "❌ Aucun carton chiffré dans le lien.";
    err.classList.remove("hidden");
    return;
  }
  if (!window.crypto || !crypto.subtle) {
    err.textContent = "Ce navigateur ne supporte pas le déchiffrement (HTTPS requis).";
    err.classList.remove("hidden");
    return;
  }

  const passphrase = document.getElementById("decryptPass").value.trim();
  let payload;
  try {
    payload = await decryptToken(DECRYPT.token, passphrase);
    if (!payload || payload.t !== "santa" || !payload.r) throw new Error("contenu invalide");
  } catch (e) {
    const wrong = e.name === "OperationError" || e.message === "format";
    err.textContent = wrong
      ? "❌ Phrase secrète incorrecte ou lien invalide."
      : "❌ Ouverture impossible : " + e.message;
    err.classList.remove("hidden");
    return;
  }

  document.getElementById("decryptBox").classList.add("hidden");
  document.getElementById("decryptResult").classList.remove("hidden");
  document.getElementById("decryptReceiver").textContent = payload.r;
  renderWishlistInto(document.getElementById("decryptWishlist"), {
    name: payload.r,
    wishlist: (payload.wl || []).map(w => ({ label: w.l, url: w.u }))
  });
  history.replaceState(null, "", location.pathname + location.search);
}

document.getElementById("decryptBtn").addEventListener("click", tryDecrypt);
document.getElementById("decryptPass").addEventListener("keydown", e => {
  if (e.key === "Enter") tryDecrypt();
});
document.getElementById("redecrypt").addEventListener("click", () => {
  window.location.reload();
});

function setupDecryptMode() {
  if (!/^#c=/.test(location.hash)) return false;
  if (!window.crypto || !crypto.subtle) return false;
  DECRYPT.token = location.hash.replace(/^#c=/, "");
  enterDecryptMode();
  history.replaceState(null, "", location.pathname + location.search);
  return true;
}

/* ---------- Init ---------- */
load();
initSnow();
if (!setupDecryptMode()) {
  renderParticipants();
  if (state.assignments) showReveal();
}
