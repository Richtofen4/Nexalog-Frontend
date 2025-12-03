import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactDOM from "react-dom";
import axios from "axios";
import { io } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";

import Navbar from "../navbar/navbar";
import { expandLink } from "../fetches/expandLink";
import "./home.css";

import {
  Users, Hourglass, Ban, UserPlus, ChevronLeft, ChevronRight, Plus,
  X, Search, LogIn, Check, Clock, Unlock, KeyRound, ArrowLeft, Send, HelpCircle, 
} from "lucide-react";

function ErrorBoundary({ children }) {
  const [err, setErr] = useState(null);
  if (err) {
    return (
      <div style={{ padding: 20, color: "#f87171", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
        <b>Home crashed:</b>{"\n"}{String(err?.message || err)}
      </div>
    );
  }
  return <ErrorCatcher onError={setErr}>{children}</ErrorCatcher>;
}

class ErrorCatcher extends React.Component {
  componentDidCatch(error, info) {
    this.props.onError?.(error);
    console.error("Home error:", error, info);
  }
  render() { return this.props.children; }
}

// USTAWIENIA UI 
const SERVERS_PER_PAGE  = 9;
const FRIEND_PAGE_SIZE  = 5;
const FRIENDS_PER_PAGE  = 8;

const DEFAULT_SERVER_ICON =
  "https://res.cloudinary.com/dcqhaa1ez/image/upload/v1716977307/default.png";

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button className={`home-tab ${active ? "is-active" : ""}`} onClick={onClick} type="button">
      <Icon className="home-tab-ico" size={18} />
      <span>{children}</span>
    </button>
  );
}

// PORTALOWY MODAL
function Modal({ open, onClose, children }) {
  if (!open) return null;

  const card = (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal card "
          initial={{ scale: .96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: .96, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return ReactDOM.createPortal(card, document.body);
}

function Home() {
  const navigate = useNavigate();
  function getSocketTarget() {
    const base = expandLink("/").replace(/\/+$/, "");
    const origin = base.replace(/\/api$/, "");
    const path   = base.endsWith("/api") ? "/api/socket.io" : "/socket.io";
    return { origin, path };
  }

  const token = localStorage.getItem("token") || "";
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}`, Accept: "application/json" }),
    [token]
  );

  // ---- FRIENDS
  const [friendTab, setFriendTab] = useState("all");
  const [friends, setFriends]           = useState([]);
  const [friendsTotal, setFriendsTotal] = useState(0);
  const [friendPage, setFriendPage]     = useState(0);
  const [pending, setPending] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [chatActionBusy, setChatActionBusy] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsErr, setFriendsErr]         = useState("");
  const [friendFilter, setFriendFilter] = useState("");

  // dodaj friend
  const [searchName, setSearchName] = useState("");
  const [addMsg, setAddMsg]         = useState("");
  const [addErr, setAddErr]         = useState("");
  const canAdd = searchName.trim().length >= 3;

  // SERVERS
  const [servers, setServers]       = useState([]);
  const [serversErr, setServersErr] = useState("");
  const [serverPage, setServerPage] = useState(0);

  // twórz serwer
  const [showCreate, setShowCreate] = useState(false);
  const [srvName, setSrvName]       = useState("");
  const [srvIcon, setSrvIcon]       = useState(null);
  const [srvBusy, setSrvBusy]       = useState(false);
  const srvIconUrl = useObjectUrl(srvIcon);

  // dołącz serwer
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinErr,  setJoinErr]  = useState("");
  const [joinMsg,  setJoinMsg]  = useState("");
  const [showServersHelp, setShowServersHelp] = useState(false);

  //SOCKET.IO
  const socketRef   = useRef(null);
  const chatListRef = useRef(null);
  const chatPeerRef = useRef(null);
  const convIdRef   = useRef(null);
  const myIdRef     = useRef(null);
  

  // DEBUG
const DEBUG = true;
const log = (...args) => DEBUG && console.log("[chat]", ...args);
const logEvt = (name, payload) =>
  DEBUG && console.log(`[socket:${name}]`, {
    id: payload?.ID_Message ?? payload?.id,
    cid: payload?.ID_Conversation ?? payload?.conversationId,
    from: payload?.ID_Sender ?? payload?.fromId,
    to: payload?.ID_Recipient ?? payload?.toId,
    createdAt: payload?.createdAt
  });

const myIdPromiseRef = useRef(null);

async function fetchMyId() {
  const r = await axios.get(expandLink("/api/user/me"), { headers });
  const id = Number(r.data?.user?.ID_USER ?? r.data?.ID_USER);
  if (!Number.isFinite(id)) throw new Error("Brak ID_USER w /api/user/me");
  setMyId(id);
  myIdRef.current = id;
  localStorage.setItem("myId", String(id));
  return id;
}

async function ensureMyId(force = false) {
  if (!force && Number.isFinite(myIdRef.current)) return myIdRef.current;
  if (myIdPromiseRef.current) return myIdPromiseRef.current;
  myIdPromiseRef.current = fetchMyId().finally(() => (myIdPromiseRef.current = null));
  return myIdPromiseRef.current;
}

useEffect(() => {
  localStorage.removeItem("myId");
  myIdRef.current = null;
  setMyId(null);
  ensureMyId(true).catch(e => console.warn("ensureMyId failed:", e?.message || e));
}, [token]);

  const convPeersRef = useRef(new Map());

  // Zmiana listy znajomych
  function bumpFriendById(otherUserId, ts = new Date().toISOString()) {
    if (!otherUserId) return;

    setFriends(prev => {
      const i = prev.findIndex(f => Number(f.user?.ID_USER) === Number(otherUserId));
      if (i < 0) return prev;
      const item = { ...prev[i], lastActivityAt: ts };
      return [item, ...prev.slice(0, i), ...prev.slice(i + 1)];
    });

    setFriendPage(0);

    const existsOnPage = friends.some(f => Number(f.user?.ID_USER) === Number(otherUserId));
    if (!existsOnPage && friendTab === "all") {
      loadAcceptedPage(0);
    }
  }

  // Wyciągnij ID drugiego user
  function deduceOtherId(evt) {
    const me   = Number(myIdRef.current);
    const from = Number(evt?.ID_Sender ?? evt?.fromId ?? evt?.senderId);
    const to   = Number(evt?.ID_Recipient ?? evt?.toId ?? evt?.recipientId);
    const cid  = Number(evt?.ID_Conversation ?? evt?.conversationId ?? evt?.ConversationId);

    if (Number.isFinite(from) && from !== me) return from;
    if (Number.isFinite(to)   && to   !== me) return to;

    if (Number.isFinite(cid) && convPeersRef.current.has(cid)) {
      return Number(convPeersRef.current.get(cid)?.ID_USER);
    }

    if (Number(convIdRef.current) === cid && chatPeerRef.current?.ID_USER) {
      return Number(chatPeerRef.current.ID_USER);
    }
    return null;
  }

  const [chatPeer, setChatPeer]     = useState(null);
  const [chatMsgs, setChatMsgs]     = useState([]);
  const [chatErr, setChatErr]       = useState("");
  const [chatText, setChatText]     = useState("");
  const [chatBusy, setChatBusy]     = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [myId, setMyId] = useState(null);

  useEffect(()=>{ chatPeerRef.current = chatPeer; }, [chatPeer]);
  useEffect(()=>{ convIdRef.current   = conversationId; }, [conversationId]);
  useEffect(()=>{ myIdRef.current     = myId; }, [myId]);

  const youBlockedThisPeer = React.useMemo(() => {
  if (!chatPeer) return false;
  return blocked.some(b => Number(b.user?.ID_USER) === Number(chatPeer.ID_USER) && b.youBlocked);
}, [blocked, chatPeer]);

const peerBlockedMe = React.useMemo(() => {
  if (!chatPeer) return false;
  return blocked.some(b => Number(b.user?.ID_USER) === Number(chatPeer.ID_USER) && !b.youBlocked);
}, [blocked, chatPeer]);

  // helpers do normalizacji
  const getConvId = (o) =>
    o?.ID_Conversation ?? o?.conversationId ?? o?.ConversationId ?? o?.convId ?? null;

  const getMsgId = (o) =>
    o?.ID_Message ?? o?.messageId ?? o?.MessageId ?? o?.id ?? null;

  const isTempId = (v) => typeof v === "string" && v.startsWith("tmp-");

  const normalizeMsg = (m) => ({
    ID_Message:      getMsgId(m) ?? `tmp-${Date.now()}`,
    ID_Conversation: getConvId(m) ?? convIdRef.current ?? null,
    ID_Sender:       m?.ID_Sender ?? m?.fromId ?? m?.senderId ?? null,
    content:         m?.content ?? m?.text ?? "",
    createdAt:       m?.createdAt ?? m?.timestamp ?? new Date().toISOString(),
    edited:          m?.edited ?? false,
    deleted:         m?.deleted ?? false,
  });

  const shouldDisplay = (raw) => {
    const cid = getConvId(raw);
    if (cid && convIdRef.current) return Number(cid) === Number(convIdRef.current);

    // fallback dla payloadów
    const otherId = chatPeerRef.current?.ID_USER;
    const from    = Number(raw?.ID_Sender ?? raw?.fromId ?? raw?.senderId);
    const to      = Number(raw?.ID_Recipient ?? raw?.toId ?? raw?.recipientId);
    const me      = Number(myIdRef.current);
    if (!otherId || !Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(me)) return false;
    return (from === otherId && to === me) || (from === me && to === otherId);
  };

  const upsertMsg = (raw) => {
  const msg = normalizeMsg(raw);
  setChatMsgs(prev => {
    const incomingId = getMsgId(msg);
    if (incomingId != null && prev.some(p => getMsgId(p) === incomingId)) {
      return prev;
    }

      // 1) Podmiana po identycznym ID
      if (incomingId != null) {
        const byId = prev.findIndex((p) => getMsgId(p) === incomingId);
        if (byId >= 0) {
          const copy = [...prev];
          copy[byId] = { ...copy[byId], ...msg, optimistic: false };
          return copy;
        }
      }

      // 2) Podmiana bąbelka tymczasowego
      const isDbId = typeof incomingId === "number" && Number.isFinite(incomingId);
      if (isDbId) {
        const iTmp = prev.findIndex(
          (p) =>
            isTempId(getMsgId(p)) &&
            Number(p.ID_Conversation) === Number(msg.ID_Conversation) &&
            Number(p.ID_Sender) === Number(msg.ID_Sender) &&
            p.content === msg.content
        );
        if (iTmp >= 0) {
          const copy = [...prev];
          copy[iTmp] = { ...copy[iTmp], ...msg, optimistic: false };
          return copy;
        }
      }
      return [...prev, msg];
    });

    requestAnimationFrame(() => {
      chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight });
    });
  };

useEffect(() => {
  ensureMyId().catch(e => console.warn("ensureMyId failed:", e?.message || e));
}, [headers]);


  // init socket
  useEffect(() => {
    const { origin, path } = getSocketTarget();

    const s = io(origin, {
      path,
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: localStorage.getItem("token") || "" },
      
    });
    socketRef.current = s;
    s.onAny((event, payload) => {
  logEvt(event, payload);
});

    s.on("connect",      () => console.log("[socket] connected", s.id, "path:", path));
    s.on("connect_error",(err)=> console.warn("[socket] connect_error:", err?.message || err));

    //Handlery czatu
    const onNew = (msg) => {
      if (shouldDisplay(msg)) upsertMsg(msg);

      const otherId = deduceOtherId(msg);
      if (otherId) bumpFriendById(otherId, msg?.createdAt ?? new Date().toISOString());
    };
    const onEdited = (msg) => {
      if (shouldDisplay(msg)) upsertMsg(msg);
    };
    const onDeleted = (msg) => {
      if (!shouldDisplay(msg)) return;
      const id = getMsgId(msg);
      setChatMsgs(prev =>
        prev.map(m => (getMsgId(m) === id ? { ...m, deleted: true } : m))
      );
    };
    s.on("message:new", onNew);
    s.on("message:edited", onEdited);
    s.on("message:deleted", onDeleted);

    const onInbox = (msg) => {
  const cid = getConvId(msg);
  if (Number(cid) === Number(convIdRef.current)) {
    return;
  }

  const otherId = deduceOtherId(msg);
  if (otherId) bumpFriendById(
    otherId,
    msg?.createdAt ?? new Date().toISOString()
  );
};

    s.on("inbox:new", onInbox);

    return () => {
      s.off("message:new", onNew);
      s.off("message:edited", onEdited);
      s.off("message:deleted", onDeleted);
      s.off("inbox:new", onInbox);
      s.disconnect();
    };
  }, [token]);

  // Dołącz/opuść pokój
  useEffect(() => {
    const s = socketRef.current;
    if (!s || !myId) return;
    s.emit("user:join", Number(myId));
    return () => { s.emit("user:leave", Number(myId)); };
  }, [myId]);

  useEffect(() => {
    const open = showCreate || showJoin || !!chatPeer;
    const prev = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : prev || "";
    return () => { document.body.style.overflow = prev; };
  }, [showCreate, showJoin, chatPeer]);

  useEffect(() => {
    refreshFriends();
    refreshServers();
  }, []);

  async function loadAcceptedPage(page = 0, search = "") {
    const q = search.trim();
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", FRIEND_PAGE_SIZE);
    if (q) params.set("q", q);

    const res = await axios.get(
      expandLink(`/api/friends/myFriends?${params.toString()}`),
      { headers }
    );

    setFriends(res.data?.friends ?? []);
    setFriendsTotal(
      typeof res.data?.totalItems === "number"
        ? res.data.totalItems
        : (res.data?.friends?.length ?? 0)
    );
    setFriendPage(page);
  }

  async function refreshFriends() {
    try {
      setLoadingFriends(true);
      setFriendsErr("");
      await loadAcceptedPage(0, friendFilter);

      const p = await axios.get(expandLink(`/api/friends/myFriendPending`), { headers });
      const incoming = Array.isArray(p.data?.incoming) ? p.data.incoming : [];
      const outgoing = Array.isArray(p.data?.outgoing) ? p.data.outgoing : [];
      setPending([
        ...incoming.map(item => ({ id: item.friendshipId ?? `${item.user?.ID_USER}-in`,  user: item.user, direction: "incoming", since: item.since })),
        ...outgoing.map(item => ({ id: item.friendshipId ?? `${item.user?.ID_USER}-out`, user: item.user, direction: "outgoing", since: item.since })),
      ]);

      const b = await axios.get(expandLink(`/api/friends/myFriendBlocked`), { headers });
      const blockedByMe = Array.isArray(b.data?.blockedByMe) ? b.data.blockedByMe : [];
      const blockedMe   = Array.isArray(b.data?.blockedMe)   ? b.data.blockedMe   : [];
      setBlocked([
        ...blockedByMe.map(item => ({ id: `${item.user?.ID_USER}-byme`, user: item.user, youBlocked: true,  since: item.since })),
        ...blockedMe.map(item   => ({ id: `${item.user?.ID_USER}-me`,   user: item.user, youBlocked: false, since: item.since })),
      ]);
    } catch (e) {
      setFriendsErr(e?.response?.data?.message || "Nie udało się pobrać znajomych.");
    } finally {
      setLoadingFriends(false);
    }
  }

  async function refreshServers() {
    try {
      setServersErr("");
      const res = await axios.get(expandLink(`/api/server/myServers?page=0&limit=100`), { headers });
      setServers(res.data?.servers ?? []);
      setServerPage(0);
    } catch (e) {
      setServersErr(e?.response?.data?.message || "Nie udało się pobrać serwerów.");
    }
  }

  // dodaj znajomego
  async function handleAddFriend(e) {
    e.preventDefault();
    setAddErr(""); setAddMsg("");
    if (!canAdd) return;
    try {
      await axios.post(
        expandLink(`/api/friends/sendRequest`),
        { username: searchName.trim() },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      setAddMsg("Wysłano zaproszenie.");
      setSearchName("");
      refreshFriends();
    } catch (e) {
      setAddErr(e?.response?.data?.message || "Nie udało się wysłać zaproszenia.");
    }
  }
  async function handleAccept(idUser) {
    try {
      await axios.post(
        expandLink(`/api/friends/acceptRequest`),
        { otherUserId: idUser },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      refreshFriends();
    } catch (e) {
      alert(e?.response?.data?.message || "Błąd podczas akceptacji.");
    }
  }
  async function handleReject(idUser) {
    try {
      await axios.post(
        expandLink(`/api/friends/rejectRequest`),
        { otherUserId: idUser },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      refreshFriends();
    } catch (e) {
      alert(e?.response?.data?.message || "Błąd podczas odrzucenia.");
    }
  }
async function handleUnban(idUser) {
  try {
    await axios.put(
      expandLink(`/api/friends/unblockUser`),
      { otherUserId: idUser },
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
    refreshFriends();
  } catch (e) {
    alert(e?.response?.data?.message || "Błąd podczas zdejmowania blokady.");
  }
}

async function handleBlock(idUser) {
  try {
    setChatActionBusy(true);
    await axios.put(
      expandLink(`/api/friends/blockUser`),
      { otherUserId: idUser },
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
    await refreshFriends();
    closeChat();
  } catch (e) {
    alert(e?.response?.data?.message || "Nie udało się zablokować użytkownika.");
  } finally {
    setChatActionBusy(false);
  }
}

  // Stwórz serwer
  async function handleCreateServer(e) {
    e.preventDefault();
    if (!srvName.trim()) return;
    try {
      setSrvBusy(true);
      const fd = new FormData();
      fd.append("name", srvName.trim());
      if (srvIcon) fd.append("icon", srvIcon);
      await axios.post(expandLink(`/api/server/createServer`), fd, { headers });
      setShowCreate(false);
      setSrvName("");
      setSrvIcon(null);
      refreshServers();
      socketRef.current?.emit("server:created");
    } catch (e) {
      alert(e?.response?.data?.message || "Nie udało się utworzyć serwera.");
    } finally {
      setSrvBusy(false);
    }
  }

  // Dołącz do serwera
  async function handleJoinServer(e) {
    e.preventDefault();
    setJoinErr(""); setJoinMsg("");
    const code = joinCode.trim();
    if (!code) { setJoinErr("Podaj kod zaproszenia."); return; }
    try {
      setJoinBusy(true);
      const res = await axios.post(
        expandLink(`/api/server/joinServer`),
        { code },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      setJoinMsg(res.data?.message || "Dołączono.");
      setShowJoin(false);
      setJoinCode("");
      refreshServers();
    } catch (e) {
      setJoinErr(e?.response?.data?.message || "Nie udało się dołączyć.");
    } finally {
      setJoinBusy(false);
    }
  }

  // Lewa kolumna(wygląd)
  const switchTab = (tab) => {
    setFriendTab(tab);
    if (tab === "all") {
      loadAcceptedPage(0, friendFilter);
    } else {
      setFriendPage(0);
    }
  };

  const activeFriends = friendTab === "all" ? friends : blocked;

  let filteredFriends = activeFriends;

  if (friendTab === "blocked") {
    const friendFilterNorm = friendFilter.trim().toLowerCase();
    filteredFriends = friendFilterNorm
      ? activeFriends.filter((f) =>
          (f.user?.username || "").toLowerCase().includes(friendFilterNorm)
        )
      : activeFriends;
  }

  const friendPages =
    friendTab === "all"
      ? Math.max(1, Math.ceil(friendsTotal / FRIEND_PAGE_SIZE))
      : Math.max(1, Math.ceil(filteredFriends.length / FRIENDS_PER_PAGE));

  const pageFriends =
    friendTab === "all"
      ? filteredFriends
      : filteredFriends.slice(
          friendPage * FRIENDS_PER_PAGE,
          friendPage * FRIENDS_PER_PAGE + FRIENDS_PER_PAGE
        );

  const friendsPrev = () => {
    if (friendPage === 0) return;
    if (friendTab === "all") loadAcceptedPage(friendPage - 1, friendFilter);
    else setFriendPage(p => Math.max(0, p - 1));
  };

  const friendsNext = () => {
    if (friendPage >= friendPages - 1) return;
    if (friendTab === "all") loadAcceptedPage(friendPage + 1, friendFilter);
    else setFriendPage(p => Math.min(friendPages - 1, p + 1));
  };

  useEffect(() => {
    if (friendTab !== "all") return;
    loadAcceptedPage(0, friendFilter);
  }, [friendFilter, friendTab]);

  // Prawa kolumna(wygląd)
  const serverPages = Math.max(1, Math.ceil(servers.length / SERVERS_PER_PAGE));
  const pageServers = servers.slice(
    serverPage * SERVERS_PER_PAGE,
    serverPage * SERVERS_PER_PAGE + SERVERS_PER_PAGE
  );
  const goPrev = () => setServerPage(p => Math.max(0, p - 1));
  const goNext = () => setServerPage(p => Math.min(serverPages - 1, p + 1));

  // CZAT
  async function openChat(user) {
    if (convIdRef.current) {
    socketRef.current?.emit("conv:leave", convIdRef.current);
  }
  await ensureMyId();

  setChatPeer(user);
  setChatMsgs([]);
  setChatErr("");
  try {
    setChatBusy(true);

      // 1) znajdź/utwórz konwersację
      const convRes = await axios.get(
        expandLink(`/api/chat/conversations/by-user/${user.ID_USER}`),
        { headers }
      );
      const convId = convRes.data?.conversationId ?? convRes.data?.ID_Conversation;
      if (!convId) throw new Error("Brak conversationId w odpowiedzi backendu.");

      setConversationId(convId);
      convIdRef.current = convId;

      // 2) wejdź do pokoju
      socketRef.current?.emit("conv:join", convId);

      convPeersRef.current.set(Number(convId), { ID_USER: Number(user.ID_USER) });

      // 3) Pobranie wiadomości
      const msgRes = await axios.get(
        expandLink(`/api/chat/conversations/${convId}/messages?limit=50`),
        { headers }
      );
      const items = Array.isArray(msgRes.data?.messages) ? msgRes.data.messages : [];
      setChatMsgs(items);

      requestAnimationFrame(() => {
        chatListRef.current?.scrollTo({ top: chatListRef.current.scrollHeight });
      });
    } catch (e) {
      setChatErr(e?.response?.data?.message || "Nie udało się pobrać wiadomości.");
    } finally {
      setChatBusy(false);
    }
  }

  function closeChat() {
    if (convIdRef.current) {
      socketRef.current?.emit("conv:leave", convIdRef.current);
    }
    setChatPeer(null);
    setChatMsgs([]);
    setChatErr("");
    setChatText("");
    setConversationId(null);
    convIdRef.current = null;
  }

  async function sendChat(e) {
  e.preventDefault();
  const content = chatText.trim();
  if (!content || !chatPeer || !convIdRef.current) return;

  const senderId = Number(await ensureMyId());
  if (!Number.isFinite(senderId)) {
    setChatErr("Nie ustalono mojego ID użytkownika – spróbuj ponownie.");
    return;
  }

  const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    setChatText("");

    if (chatPeer?.ID_USER) bumpFriendById(Number(chatPeer.ID_USER));
    upsertMsg({
      ID_Message: tmpId,
      ID_Conversation: convIdRef.current,
      ID_Sender: senderId,
      content,
      createdAt: new Date().toISOString(),
      edited: false,
      deleted: false,
      optimistic: true
    });

    await axios.post(
      expandLink(`/api/chat/conversations/${convIdRef.current}/messages`),
      { content },
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (e) {
    setChatErr(e?.response?.data?.message || "Nie udało się wysłać wiadomości.");
  }
}


  return (
    <div className="home-bg">
      <Navbar />
      <main className="home-page">
        {/* Lewa — znajomi */}
        <aside className="home-left card ">
          <header className="friends-head">
          <div className="friends-title">
            <Users size={18} />
            <h2>Zarejestrowani Użytkownicy</h2>
          </div>

          <div className="friends-pager pager">
          <button className="icon-btn" onClick={friendsPrev} disabled={friendPage === 0}>
            <ChevronLeft size={16} />
            <span className="pager-arrow">&lt;</span>
          </button>
          <span className="muted">Strona {friendPage + 1} / {friendPages}</span>
          <button className="icon-btn" onClick={friendsNext} disabled={friendPage >= friendPages - 1}>
            <span className="pager-arrow">&gt;</span>
            <ChevronRight size={16} />
          </button>
        </div>
        </header>

        <div className="home-tabs">
          <TabButton
            icon={Users}
            active={friendTab === "all"}
            onClick={() => switchTab("all")}
          >
            Wszyscy
          </TabButton>
          <TabButton
            icon={Ban}
            active={friendTab === "blocked"}
            onClick={() => switchTab("blocked")}
          >
            Zbanowani
          </TabButton>
        </div>

          <div className="search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Szukaj użytkownika…"
            value={friendFilter}
            onChange={(e) => setFriendFilter(e.target.value)}
          />
        </div>

          <div className="home-friends">
          {/* Wszyscy użytkownicy */}
          {friendTab === "all" && !loadingFriends && (
            friends.length === 0 ? (
              <p className="muted">Brak innych użytkowników.</p>
            ) : (
              pageFriends.map((f) => (
                <FriendRow
                  key={f.user?.ID_USER}
                  user={f.user}
                  onClick={() => openChat(f.user)}
                />
              ))
            )
          )}

          {/* Zbanowani */}
          {friendTab === "blocked" && !loadingFriends && (
            activeFriends.length === 0 ? (
              <p className="muted">Lista pusta</p>
            ) : (
              pageFriends.map((b) => (
                <FriendRow
                  key={b.id}
                  user={b.user}
                  disabled
                  rowClass={b.youBlocked ? "you-blocked" : "blocked-me"}
                  footer={
                    b.youBlocked ? (
                      <div className="actions">
                        <button
                          className="action-btn ok"
                          onClick={() => handleUnban(b.user.ID_USER)}
                        >
                          <Unlock size={16} /> Odblokuj
                        </button>
                      </div>
                    ) : (
                      <div className="status danger">
                        <Ban size={14} /> Zablokował Cię
                      </div>
                    )
                  }
                />
              ))
            )
          )}

          </div>
        </aside>

        {/* Prawa — serwery */}
        <section className="home-right card ">
          <div className="servers-head">
            <div className="servers-title">
            <h2>Twoje serwery</h2>
            <button
              type="button"
              className="help-icon"
              onClick={() => setShowServersHelp(v => !v)}
              aria-label="Co to są serwery?"
            >
              ?
            </button>

            {showServersHelp && (
              <div className="help-popover">
                <p>
                  Serwer to Twoja własna przestrzeń na Nexalogu. Na serwerze możesz:
                </p>
                <ul>
                  <li>tworzyć kanały tekstowe i głosowe dla różnych tematów,</li>
                  <li>zapraszać innych użytkowników za pomocą kodu serwera,</li>
                  <li>organizować rozmowy na czacie oraz wideokonferencje.</li>
                </ul>
                <p style={{ marginTop: 6 }}>
                  Możesz utworzyć nowy serwer przyciskiem <b>Stwórz serwer</b> lub
                  dołączyć do istniejącego, jeśli właściciel poda Ci kod zaproszenia
                  (przycisk <b>Dołącz</b>).
                </p>
              </div>
            )}
          </div>


            <div className="pager">
            <button className="icon-btn" onClick={goPrev} disabled={serverPage === 0}>
              <ChevronLeft size={16} />
              <span className="pager-arrow">&lt;</span>
            </button>
            <span className="muted">Strona {serverPage + 1} / {serverPages}</span>
            <button className="icon-btn" onClick={goNext} disabled={serverPage >= serverPages - 1}>
              <span className="pager-arrow">&gt;</span>
              <ChevronRight size={16} />
            </button>
          </div>

            <div className="servers-actions">
            <button
              className="btn sm"
              onClick={() => setShowCreate(true)}
              type="button"
            >
              <Plus size={16} />
              <span>Stwórz serwer</span>
            </button>

            <button
              className="btn sm ghost"
              onClick={() => setShowJoin(true)}
              type="button"
            >
              <KeyRound size={16} />
              <span>Dołącz</span>
            </button>
          </div>
          </div>


          {!!serversErr && <p className="err">{serversErr}</p>}

          {pageServers.length === 0 ? (
            <EmptyServers onCreate={() => setShowCreate(true)} />
          ) : (
            <div className="servers-grid">
              {pageServers.map(s => (
                <motion.div
                  key={s.ID_Server}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="server-card"
                >
                  <img src={s.icon_url || DEFAULT_SERVER_ICON} alt="" />
                  <div className="server-meta">
                    <h3 title={s.name || "(bez nazwy)"}>{s.name || "(bez nazwy)"}</h3>
                    <p className="muted">Utworzono: {new Date(s.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button className="btn sm ghost" onClick={() => navigate(`/server/${s.ID_Server}`)}>
                    <LogIn size={16} /> <span>Wejdź</span>
                  </button>
                </motion.div>
              ))}
            </div>
          )}

        </section>
      </main>

      {/* Model czatu */}
      <Modal open={!!chatPeer} onClose={closeChat}>
        <div className="chat-head">
          <button className="icon-btn" onClick={closeChat} title="Zamknij">
            <ArrowLeft size={18} />
          </button>

          <div className="chat-peer-wrap">
            <div className="chat-peer">
              <img className="pc-avatar" src={chatPeer?.avatar} alt="" />
              <h3 className="pc-name">{chatPeer?.username}</h3>
            </div>

            <div className="chat-actions">
              {youBlockedThisPeer ? (
                <button
                  className="pc-block-btn"
                  onClick={() => handleUnban(chatPeer.ID_USER)}
                  disabled={chatActionBusy}
                  type="button"
                >
                  <Unlock size={18} style={{ marginRight: 6 }} />
                  Odblokuj użytkownika
                </button>
              ) : (
                <button
                  className="pc-block-btn"
                  onClick={() => handleBlock(chatPeer.ID_USER)}
                  disabled={chatActionBusy}
                  type="button"
                >
                  <Ban size={18} style={{ marginRight: 6 }} />
                  Zablokuj użytkownika
                </button>
              )}
            </div>
          </div>
        </div>

        {chatErr && <p className="err" style={{ marginTop: 8 }}>{chatErr}</p>}

<div className="chat-body">
  {(youBlockedThisPeer || peerBlockedMe) && (
    <div className="status danger" style={{ margin: "4px 6px" }}>
      {youBlockedThisPeer
        ? "Masz tego użytkownika zablokowanego. Odblokuj, aby pisać."
        : "Nie możesz wysyłać — ten użytkownik zablokował Cię."}
    </div>
  )}

  {/* Lista wiadomości */}
  <div className="chat-list" ref={chatListRef}>
    {chatMsgs.map((m) => {
      const mine = Number(m.ID_Sender) === Number(myIdRef.current);

      return (
        <div
          key={m.ID_Message || m.id || `${m.createdAt}-${Math.random()}`}
          className={`chat-row ${mine ? "me" : "other"}`}
        >
          <div className="chat-bubble">
            <p>{m.deleted ? "🗑️ wiadomość usunięta" : m.content}</p>
            <span className="time">
              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      );
    })}
    {chatBusy && <p className="muted" style={{ padding: 8 }}>Ładowanie…</p>}
  </div>

  <form className="chat-input-row" onSubmit={sendChat}>
    <input
      type="text"
      maxLength={2000}
      placeholder={
        youBlockedThisPeer
          ? "Masz zablokowanego użytkownika…"
          : peerBlockedMe
          ? "Nie możesz pisać — zostałeś zablokowany"
          : "Napisz wiadomość…"
      }
      value={chatText}
      onChange={(e)=>setChatText(e.target.value)}
      disabled={youBlockedThisPeer || peerBlockedMe}
      autoFocus
    />
    <button
      className="btn sm"
      type="submit"
      disabled={!chatText.trim() || youBlockedThisPeer || peerBlockedMe}
    >
      <Send size={16}/> Wyślij
    </button>
  </form>
</div>

      </Modal>

      <Modal open={showCreate} onClose={() => setShowCreate(false)}>
        <button className="modal-close icon-btn" onClick={() => setShowCreate(false)} type="button">
          <X size={18} />
        </button>
        <h3>Stwórz serwer</h3>
        <form className="stack" onSubmit={handleCreateServer}>
          <label className="field">
            <span className="field-label">Nazwa</span>
            <input type="text" maxLength={255} value={srvName}
                   onChange={(e) => setSrvName(e.target.value)} placeholder="Mój serwer" />
          </label>
          <label className="field">
            <span className="field-label">Avatar (opcjonalnie)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp"
                   onChange={(e) => setSrvIcon(e.target.files?.[0] || null)} />
            {srvIconUrl && <div className="preview"><img src={srvIconUrl} alt="" /></div>}
          </label>
          <div className="row-right">
            <button className="btn" disabled={srvBusy || !srvName.trim()}>
              {srvBusy ? "Tworzenie…" : "Utwórz"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showJoin} onClose={() => setShowJoin(false)}>
        <button className="modal-close icon-btn" onClick={() => setShowJoin(false)} type="button">
          <X size={18} />
        </button>
        <h3>Dołącz do serwera</h3>
        <form className="stack" onSubmit={handleJoinServer}>
          <label className="field">
            <span className="field-label">Kod zaproszenia</span>
            <input type="text" value={joinCode}
                   onChange={(e)=>setJoinCode(e.target.value)}
                   placeholder="np. 7hQ9KxS1" maxLength={64} />
          </label>
          {joinErr && <p className="err">{joinErr}</p>}
          {joinMsg && <p className="ok">{joinMsg}</p>}
          <div className="row-right">
            <button className="btn" disabled={joinBusy || !joinCode.trim()}>
              {joinBusy ? "Dołączanie…" : "Dołącz"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StateTag({ kind, children }) {
  return <span className={`state-tag ${kind}`}>{children}</span>;
}

function FriendRow({ user, onClick, footer, disabled = false, rowClass }) {
  const handle = disabled ? undefined : onClick;
  return (
    <div className={`friend-card ${rowClass || ""}`} onClick={handle}>
      <img className="friend-avatar" src={user?.avatar} alt="" />
      <div className="friend-title">
        <div className="friend-name" title={user?.username}>{user?.username}</div>
      </div>
      {footer && <div className="friend-footer" onClick={(e)=>e.stopPropagation()}>{footer}</div>}
    </div>
  );
}

function EmptyServers({ onCreate }) {
  return (
    <div className="empty-servers">
      <p className="muted">Nie masz jeszcze żadnych serwerów.</p>
    </div>
  );
}

/* Podgląd pliku (avatar serwera) */
function useObjectUrl(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

export default function HomeWrapped() {
  return (
    <ErrorBoundary>
      <Home />
    </ErrorBoundary>
  );
}
