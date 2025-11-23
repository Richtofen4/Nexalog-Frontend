import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { expandLink } from "../fetches/expandLink";
import "./navbar.css";

export default function Navbar({ notifications: initialNotifications = 0 }) {
  const navigate = useNavigate();
  const username = localStorage.getItem("username") || "Użytkownik";
  const isAdmin = !!localStorage.getItem("admin");

  // licznik + lista powiadomień
  const [notifCount, setNotifCount] = useState(initialNotifications);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");

  const [notiOpen, setNotiOpen] = useState(false);
  const notiBtnRef = useRef(null);
  const notiPopoverRef = useRef(null);

  const token = localStorage.getItem("token") || "";
  const authHeaders =
    token
      ? {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        }
      : null;

  // wylogowanie
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("admin");
    setNotifCount(0);
    setNotifications([]);
    navigate("/login");
  };

  useEffect(() => {
    if (!notiOpen) return;

    const onDocClick = (e) => {
      const btn = notiBtnRef.current;
      const pop = notiPopoverRef.current;
      if (!btn || !pop) return;
      const target = e.target;
      if (btn.contains(target) || pop.contains(target)) return;
      setNotiOpen(false);
    };

    const onKey = (e) => {
      if (e.key === "Escape") setNotiOpen(false);
    };

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [notiOpen]);

  // pobieranie licznika
  useEffect(() => {
    if (!authHeaders) return;

    const fetchCounter = async () => {
      try {
        const r = await axios.get(
          expandLink("/api/notifications/counter"),
          { headers: authHeaders }
        );
        setNotifCount(Number(r.data?.count || 0));
      } catch (e) {
        console.warn("Nie udało się pobrać licznika powiadomień:", e?.message);
      }
    };

    fetchCounter();
    const id = setInterval(fetchCounter, 3000);
    return () => clearInterval(id);
  }, [authHeaders]);

  // otwieranie/zamykanie popovera z listą
  const handleToggleNotif = () => {
    setNotiOpen((prev) => {
      const opening = !prev;
      if (opening && !notifLoading) {
        loadNotifications();
      }
      return opening;
    });
  };

  // pobierz listę
  const loadNotifications = async () => {
    if (!authHeaders) return;
    try {
      setNotifLoading(true);
      setNotifError("");

      const r = await axios.get(
        expandLink("/api/notifications?limit=20"),
        { headers: authHeaders }
      );
      const list = r.data?.notifications || [];
      setNotifications(list);

      await axios.post(
        expandLink("/api/notifications/read-all"),
        {},
        { headers: { ...authHeaders, "Content-Type": "application/json" } }
      );

      setNotifCount(0);
    } catch (e) {
      console.error(e);
      setNotifError("Nie udało się wczytać powiadomień.");
    } finally {
      setNotifLoading(false);
    }
  };

  return (
    <header className="navbar">
      <div className="nav-left">
        <Link to="/home" className="brand" aria-label="Strona główna Nexalog">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <defs>
                <linearGradient id="g" x1="0" x2="1">
                  <stop offset="0" stopColor="#22c55e" />
                  <stop offset="1" stopColor="#16a34a" />
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="9" fill="url(#g)" />
              <path
                d="M7 13l3-3 2 2 4-4"
                stroke="#0a0a0a"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </span>
          <span className="brand-text">Nexalog</span>
        </Link>
      </div>

      <nav className="nav-right">
        {isAdmin && (
          <Link
            to="/admin"
            className="icon-btn"
            aria-label="Panel administratora"
            title="Panel administratora"
          >
            <svg viewBox="0 0 24 24" className="icon">
              <path
                d="M12 3l7 3v6c0 4.42-3.13 7.59-7 8-3.87-.41-7-3.58-7-8V6l7-3z"
                fill="currentColor"
              />
            </svg>
          </Link>
        )}

        {/* Powiadomienia */}
        <div className="notif">
          <button
            type="button"
            className={`icon-btn badge-btn ${notiOpen ? "active" : ""}`}
            aria-label="Powiadomienia"
            title="Powiadomienia"
            aria-haspopup="dialog"
            aria-expanded={notiOpen}
            aria-controls="notif-popover"
            onClick={handleToggleNotif}
            ref={notiBtnRef}
          >
            <svg viewBox="0 0 24 24" className="icon">
              <path
                d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-6V11a6 6 0 1 0-12 0v5l-2 2v1h18v-1l-2-2z"
                fill="currentColor"
              />
            </svg>
            {notifCount > 0 && (
              <span
                className="badge"
                aria-label={`${notifCount} nowych powiadomień`}
              >
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </button>

          {notiOpen && (
            <div
              className="notif-popover card-surface"
              id="notif-popover"
              role="dialog"
              aria-label="Powiadomienia"
              ref={notiPopoverRef}
            >
              <div className="notif-header">
                <span>Powiadomienia</span>
                <button
                  type="button"
                  className="notif-close"
                  aria-label="Zamknij powiadomienia"
                  onClick={() => setNotiOpen(false)}
                >
                  x
                </button>
              </div>

              {notifLoading ? (
                <div className="notif-empty">
                  <div className="notif-empty-text">Ładowanie…</div>
                </div>
                            ) : notifError ? (
                <div className="notif-empty">
                  <div className="notif-empty-text">{notifError}</div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="notif-empty">
                  <div className="notif-empty-icon" aria-hidden="true">
                    🔔
                  </div>
                  <div className="notif-empty-text">Brak powiadomień</div>
                </div>
              ) : (
                <div className="notif-list">
                  {notifications.map((n) => (
                    <div
                      key={n.ID_Notification || `${n.type}-${n.createdAt}`}
                      className="notif-item"
                    >
                      <div className="notif-item-header">
                        <div className="notif-title">{n.title}</div>
                        {n.createdAt && (
                          <div className="notif-meta">
                            {new Date(n.createdAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="notif-body">{n.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <Link
          to="/profile"
          className="icon-btn"
          aria-label={`Profil: ${username}`}
          title="Profil"
        >
          <svg viewBox="0 0 24 24" className="icon">
            <path
              d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-5 0-9 3-9 6v2h18v-2c0-3-4-6-9-6z"
              fill="currentColor"
            />
          </svg>
        </Link>

        <button
          type="button"
          className="icon-btn danger"
          aria-label="Wyloguj się"
          title="Wyloguj się"
          onClick={handleLogout}
        >
          <svg viewBox="0 0 24 24" className="icon">
            <path
              d="M10 17l-1.41-1.41L12.17 12 8.59 8.41 10 7l5 5-5 5z"
              fill="currentColor"
            />
            <path d="M4 4h7v3H7v10h4v3H4z" fill="currentColor" />
          </svg>
        </button>
      </nav>
    </header>
  );
}
