import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../navbar/navbar";
import { expandLink } from "../fetches/expandLink";
import "./server.css";
import { io } from "socket.io-client";

import {
  Users, Plus, Edit3, Trash2, LogOut, KeyRound, RefreshCcw, ShieldCheck,
} from "lucide-react";

const DEFAULT_SERVER_ICON =
  "https://res.cloudinary.com/dcqhaa1ez/image/upload/v1716977307/default.png";

const API = {
  me:                () => `/api/user/me`,
  myServers:         (q=`?page=0&limit=100`) => `/api/server/myServers${q}`,
  channelsList:      () => `/api/channel/list`,
  channelCreate:     () => `/api/channel/create`,
  channelRename:     () => `/api/channel/change`,
  channelDelete:     () => `/api/channel/delete`,
  membersList:       () => `/api/server/list`,
  memberKick:        () => `/api/server/kick`,
  serverLeave:       () => `/api/server/leave`,
  codeShow:          () => `/api/server/code`,
  codeRegenerate:    () => `/api/server/regenerate-code`,
  msgRecent:         () => `/api/channel-message/recent`,
  msgSend:           () => `/api/channel-message/send`,
};

function normalizeMsg(raw, me) {
  const u = raw.user ?? raw.User ?? {};
  return {
    ID_Channel_message: raw.ID_Channel_message ?? raw.id ?? raw.ID,
    ID_Channel: raw.ID_Channel ?? raw.channelId,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    content: raw.content ?? raw.message ?? raw.text ?? "",
    user: {
      ID_USER: u.ID_USER ?? raw.ID_USER ?? null,
      username: u.username ?? raw.username ?? "unknown",
      avatar: u.avatar ?? raw.avatar ?? "",
    },
    _mine: Number((u.ID_USER ?? raw.ID_USER)) === Number(me?.ID_USER),
  };
}

export default function ServerView() {

  // Socket.IO
   const socketRef = useRef(null);
   const currentChRef = useRef(null);
 
   function getSocketTarget() {
     const base = expandLink("/").replace(/\/+$/, "");
     const origin = base.replace(/\/api$/, "");
     const path   = base.endsWith("/api") ? "/api/socket.io" : "/socket.io";
     return { origin, path };
   }

  const { id } = useParams();
  const serverId = Number(id);
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  }), [token]);

  // dane bazowe
  const [me, setMe] = useState(null);
  const [server, setServer] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // kanały
  const [channels, setChannels] = useState([]);
  const [activeCh, setActiveCh] = useState(null);
  const [busyCh, setBusyCh] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [renameDraft, setRenameDraft] = useState({ id: null, name: "" });

  // członkowie
  const [members, setMembers] = useState([]);
  const [busyMember, setBusyMember] = useState(false);

  // kod zaproszenia
  const [inviteCode, setInviteCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [busyCode, setBusyCode] = useState(false);

  // komunikaty
  const [err, setErr] = useState("");

  // chat (REST)
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore]   = useState(true);
  const [busyMsg, setBusyMsg]   = useState(false);
  const [composer, setComposer] = useState("");
  const listRef = useRef(null);
  const justAppendedMineRef = useRef(false);

  const [validated, setValidated] = useState(false);

    // łapanie połączenia
   useEffect(() => {
     const { origin, path } = getSocketTarget();
     const s = io(origin, {
       path,
       transports: ["websocket", "polling"],
       withCredentials: true,
       auth: { token: localStorage.getItem("token") || "" },
     });
     socketRef.current = s;
 
     // handler nowej wiadomości kanałowej
     const onNew = (msg) => {
       if (Number(msg?.ID_Channel) !== Number(currentChRef.current?.ID_Channel)) return;
       const n = normalizeMsg(msg, me);
       setMessages(prev => {
         if (prev.some(p => p.ID_Channel_message === n.ID_Channel_message)) return prev; // de-dupe
         return [...prev, n];
       });
       if (Number(n.user?.ID_USER) === Number(me?.ID_USER)) {
         justAppendedMineRef.current = true;
       }
     };
 
     s.on("channel-message:new", onNew);
     s.on("channel:new", onNew);
 
     s.on("connect", () => console.log("[socket] server.jsx connected", s.id, "path:", path));
      s.on("connect_error", (err) => console.warn("[socket] connect_error:", err?.message || err));
 
     return () => {
       s.off("channel-message:new", onNew);
       s.off("channel:new", onNew);
       s.disconnect();
     };
   }, [token, me?.ID_USER]);


  useEffect(() => {
    if (!Number.isInteger(serverId) || serverId <= 0) {
      navigate("/home");
      return;
    }
    bootstrap();
  }, [serverId]);
  
  useEffect(() => {
    if (!listRef.current) return;
    if (justAppendedMineRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      justAppendedMineRef.current = false;
    }
  }, [messages.length]);


  useEffect(() => {
    if (!activeCh?.ID_Channel) {
      setMessages([]); setHasMore(true);
      return;
    }
     currentChRef.current = activeCh;
     const s = socketRef.current;
     if (s) {
       s.emit("channel:join", Number(activeCh.ID_Channel));
     }
    loadRecent();
   setTimeout(() => {
     if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
   }, 0);
  }, [activeCh?.ID_Channel]);

  useEffect(() => {
    return () => {
      const s  = socketRef.current;
      const ch = currentChRef.current?.ID_Channel;
      if (s && ch) s.emit("channel:leave", Number(ch));
    };
  }, []);

  async function bootstrap() {
    try {
      setErr("");

      const meRes = await axios.get(expandLink(API.me()), { headers });
      const my = meRes.data?.user ?? meRes.data ?? null;
      setMe(my);

      const sRes = await axios.get(expandLink(API.myServers()), { headers });
      const s = (sRes.data?.servers || []).find(x => Number(x.ID_Server) === serverId);
      setServer(s || { ID_Server: serverId, name: "(serwer)" });

      const mRes = await axios.post(
        expandLink(API.membersList()),
        { serverId },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      const srv = mRes.data?.server || s || { ID_Server: serverId, name: "(serwer)" };
      setServer(srv);
      setMembers(mRes.data?.members || []);

      const ownerId = s?.ID_USER ?? null;
      const isOwn = Number(ownerId) === Number(my?.ID_USER);
      setIsOwner(isOwn);

      await reloadChannels();
      setValidated(true);
      if (isOwn) await fetchCode();
    } catch (e) {
      const code = e?.response?.status;
      if (code === 403 || code === 404) {
        navigate("/home", { replace: true });
        return;
      }
      setErr(e?.response?.data?.message || "Nie udało się wczytać serwera.");
    }
  }

  async function reloadChannels() {
    try {
      setBusyCh(true);
      const r = await axios.post(
        expandLink(API.channelsList()),
        { serverId },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      const list = r.data?.channels || r.data || [];
      setChannels(list);
      if (!activeCh && list.length > 0) {
        setActiveCh({ ID_Channel: list[0].ID_Channel, name: list[0].name });
      }
    } catch (e) {
      setErr(e?.response?.data?.message || "Nie udało się pobrać kanałów.");
    } finally {
      setBusyCh(false);
    }
  }

    async function loadRecent() {
    try {
      if (!activeCh?.ID_Channel) return;
      setBusyMsg(true);
      const r = await axios.post(
        expandLink(API.msgRecent()),
        { channelId: activeCh.ID_Channel, limit: 30 },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      const arr = r.data?.messages ?? [];
      const norm = arr.map(m => normalizeMsg(m, me))
                      .sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(norm);
      setHasMore(arr.length >= 30);
      
    } catch (e) {
      setErr(e?.response?.data?.message || "Nie udało się pobrać wiadomości.");
    } finally {
      setBusyMsg(false);
    }
  }

   async function loadOlder() {
    try {
      if (!activeCh?.ID_Channel || !hasMore || busyMsg || messages.length === 0) return;
      setBusyMsg(true);
      const oldest = messages[0];
      const r = await axios.post(
        expandLink(API.msgRecent()),
        { channelId: activeCh.ID_Channel, limit: 30, beforeId: oldest.ID_Channel_message },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      const arr = r.data?.messages ?? [];
      const norm = arr.map(m => normalizeMsg(m, me))
                      .sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));
      setMessages(prev => [...norm, ...prev]);
      setHasMore(arr.length >= 30);

    } catch (e) {
      setErr(e?.response?.data?.message || "Nie udało się załadować starszych wiadomości.");
    } finally {
      setBusyMsg(false);
    }
  }
 
  async function sendMessage(e) {
    e?.preventDefault?.();
    const txt = composer.trim();
    if (!txt || !activeCh?.ID_Channel) return;
    try {
      setBusyMsg(true);
      const r = await axios.post(
        expandLink(API.msgSend()),
        { channelId: activeCh.ID_Channel, content: txt },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      setComposer("");

    } catch (e) {
       alert(e?.response?.data?.message || "Nie udało się wysłać wiadomości.");
    } finally {
      setBusyMsg(false);
    }
  }


  //Kanały
  async function handleCreateChannel(e) {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    try {
      setBusyCh(true);
      await axios.post(
        expandLink(API.channelCreate()),
        { serverId, name: newChannelName.trim() },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      setNewChannelName("");
      await reloadChannels();
    } catch (e) {
      alert(e?.response?.data?.message || "Nie udało się utworzyć kanału.");
    } finally {
      setBusyCh(false);
    }
  }

  function startRename(ch) {
    setRenameDraft({ id: ch.ID_Channel, name: ch.name });
  }

  async function submitRename(e) {
    e.preventDefault();
    const { id: channelId, name } = renameDraft;
    if (!channelId || !name.trim()) return;
    try {
      setBusyCh(true);
      await axios.put(
        expandLink(API.channelRename()),
        { serverId, channelId, name: name.trim() },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      setRenameDraft({ id: null, name: "" });
      await reloadChannels();
    } catch (e) {
      alert(e?.response?.data?.message || "Nie udało się zmienić nazwy.");
    } finally {
      setBusyCh(false);
    }
  }

  async function deleteChannel(channelId) {
    if (!window.confirm("Usunąć ten kanał?")) return;
    try {
      setBusyCh(true);
      await axios.delete(
        expandLink(API.channelDelete()),
        {
          headers: { ...headers, "Content-Type": "application/json" },
          data: { serverId, channelId },
        }
      );
      await reloadChannels();
    } catch (e) {
      alert(e?.response?.data?.message || "Nie udało się usunąć kanału.");
    } finally {
      setBusyCh(false);
    }
  }

  //Członkowie
  async function kickUser(userId) {
    if (!window.confirm("Wyrzucić tego użytkownika z serwera?")) return;
    try {
      setBusyMember(true);
      await axios.post(
        expandLink(API.memberKick()),
        { serverId, userId },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      const mRes = await axios.post(
        expandLink(API.membersList()),
        { serverId },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      setMembers(mRes.data?.members || []);
    } catch (e) {
      alert(e?.response?.data?.message || "Nie udało się wyrzucić użytkownika.");
    } finally {
      setBusyMember(false);
    }
  }

  async function leaveServer() {
    if (!window.confirm("Na pewno opuścić serwer?")) return;
    try {
      await axios.delete(
        expandLink(API.serverLeave()),
        { headers: { ...headers, "Content-Type": "application/json" }, data: { serverId } }
      );
      navigate("/home");
    } catch (e) {
      alert(e?.response?.data?.message || "Nie udało się opuścić serwera.");
    }
  }

  //Kod zaproszenia
  async function fetchCode() {
    try {
      setBusyCode(true);
      const r = await axios.post(
        expandLink(API.codeShow()),
        { serverId },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      setInviteCode(r.data?.server?.code ?? "");
      setShowCode(true);
    } catch (e) {
      
    } finally {
      setBusyCode(false);
    }
  }

  async function regenerateCode() {
    if (!window.confirm("Wygenerować nowy kod zaproszenia? Poprzedni przestanie działać.")) return;
    try {
      setBusyCode(true);
      const r = await axios.put(
        expandLink(API.codeRegenerate()),
        { serverId },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      setInviteCode(r.data?.code || r.data?.inviteCode || "");
      setShowCode(true);
    } catch (e) {
      alert(e?.response?.data?.message || "Nie udało się wygenerować nowego kodu.");
    } finally {
      setBusyCode(false);
    }
  }

  const myId = Number(me?.ID_USER);

  const ui = (
      <><Navbar />
      <div className="server-page">
        <main className="server-grid">

          {/* lewa - kanały */}
          <aside className="server-left card card-neon">
            <header className="sect-head">
              <h2><Users size={18} /> Kanały</h2>
            </header>

            {/* tworzenie kanału */}
            {isOwner && (
              <form className="channel-new" onSubmit={handleCreateChannel}>
                <input
                  type="text"
                  maxLength={60}
                  placeholder="Nazwa kanału (np. chat)"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  disabled={busyCh} />
                <button className="btn sm" disabled={busyCh || !newChannelName.trim()}>
                  <Plus size={16} /> Dodaj
                </button>
              </form>
            )}

            {/* lista kanałów */}
            <div className="channels-list">
              {channels.length === 0 ? (
                <p className="muted">Brak kanałów.</p>
              ) : channels.map(ch => (
                <div key={ch.ID_Channel}
                  className={"channel-row" + (activeCh?.ID_Channel === ch.ID_Channel ? " is-active" : "")}
                  onClick={() => setActiveCh({ ID_Channel: ch.ID_Channel, name: ch.name })}>
                  {renameDraft.id === ch.ID_Channel ? (
                    <form className="rename-row" onSubmit={submitRename}>
                      <input
                        value={renameDraft.name}
                        onChange={(e) => setRenameDraft({ id: ch.ID_Channel, name: e.target.value })}
                        maxLength={60}
                        autoFocus />
                      <button className="btn sm" disabled={busyCh}>Zapisz</button>
                      <button className="btn sm ghost" type="button"
                        onClick={() => setRenameDraft({ id: null, name: "" })}>Anuluj</button>
                    </form>
                  ) : (
                    <>
                      <div className="ch-name" title={ch.name}>{ch.name}</div>
                      {isOwner && (
                        <div className="ch-actions">
                          <button className="icon-btn" title="Zmień nazwę"
                            onClick={() => startRename(ch)}><Edit3 size={18} /></button>
                          <button className="icon-btn danger" title="Usuń kanał"
                            onClick={() => deleteChannel(ch.ID_Channel)}><Trash2 size={18} /></button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </aside>

          {/* chat kanałowy */}
          <section className="server-center card card-neon">
            <header className="sect-head">
              <h2>Chat</h2>
            </header>
            {activeCh ? (
              <div className="chat-wrap">
                <div className="chat-header muted">Kanał: <b>{activeCh.name}</b></div>
                <div ref={listRef} className="chat-list" onScroll={(e)=> {
                  const el = e.currentTarget;
                  if (el.scrollTop < 40 && hasMore && !busyMsg) loadOlder();
                } }>
                  {hasMore && (
                    <button className="btn sm ghost load-older" onClick={loadOlder} disabled={busyMsg}>
                      {busyMsg ? "Ładowanie..." : "Załaduj starsze"}
                    </button>
                  )}
                  {messages.map(m => {
                  const mine = !!m._mine;
                  return (
                    <div key={m.ID_Channel_message} className={"msg-row" + (mine ? " mine" : "")}>
                      <img className="avatar" src={m.user?.avatar} alt="" />
                      <div className="bubble">
                        <div className="meta">
                          <span className="author">{m.user?.username}</span>
                          <span className="time">{new Date(m.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="text">{m.content}</div>
                      </div>
                    </div>
                  );
                })}

                </div>
                <form className="composer" onSubmit={sendMessage}>
                  <textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder={`Napisz na #${activeCh.name}…`}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { sendMessage(e); } } } />
                  <button className="btn" disabled={!composer.trim() || busyMsg}>Wyślij</button>
                </form>
              </div>
            ) : (
              <div className="center-placeholder"><p className="muted">Wybierz kanał po lewej.</p></div>
            )}
          </section>

          {/* Prawa - członkowie*/}
          <aside className="server-right card card-neon">
            <header className="sect-head">
              <div className="srv-title">
                <img src={server?.icon_url || DEFAULT_SERVER_ICON} alt="" />
                <div>
                  <h2 title={server?.name || "(serwer)"}>{server?.name || "(serwer)"}</h2>
                  {isOwner && <div className="owner-pill"><ShieldCheck size={14} /> Właściciel</div>}
                </div>
              </div>
            </header>

            {/* Kod zaproszenia */}
            {isOwner && (
              <div className="invite-box">
                <div className="row">
                  <KeyRound size={16} />
                  <code className="invite">
                    {busyCode ? "…" : (showCode ? (inviteCode || "(brak)") : "(brak)")}
                  </code>
                  <button
                  className="btn sm ghost"
                  disabled={busyCode}
                  onClick={async () => {
                    if (!inviteCode) { await fetchCode(); }
                    setShowCode(v => !v);
                  }}
                  >
                {showCode ? "Ukryj" : "Pokaż"}
                </button>
                  <button className="btn sm" onClick={regenerateCode} disabled={busyCode}>
                    <RefreshCcw size={16} /> Zmień
                  </button>
                </div>
              </div>
            )}

            {/* Lista członków */}
            <div className="members-list">
              {members.length === 0 ? (
                <p className="muted">Brak członków.</p>
              ) : members.map(m => (
                <div key={m.ID_USER} className="member-row">
                  <img src={m.avatar} alt="" className="avatar" />
                  <div className="name" title={m.username}>{m.username}</div>

                  {Number(m.ID_USER) === myId ? (
                    <button className="btn sm ghost" onClick={leaveServer}>
                      <LogOut size={16} /> Opuść
                    </button>
                  ) : isOwner ? (
                    <button className="btn sm danger" disabled={busyMember} onClick={() => kickUser(m.ID_USER)}>
                      <Trash2 size={16} /> Wyrzuć
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>
        </main>
        {err && <div style={{ maxWidth: 1200, margin: "8px auto", padding: "0 26px" }}><p className="err">{err}</p></div>}
      </div>
      </>
      
      );
if (!validated) {
  return (
    <>
      <Navbar />
      <div className="server-page">
        <main className="server-grid">
          <section className="server-center card card-neon">
            <header className="sect-head"><h2>Chat kanałowy</h2></header>
            <div className="center-placeholder">
              <p className="muted">Wczytywanie…</p>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

  return ui;
}

