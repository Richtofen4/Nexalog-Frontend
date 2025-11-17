import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Navbar from "../navbar/navbar";
import { expandLink } from "../fetches/expandLink";
import "./AdminUsers.css";

import {
  Users,
  Ban,
  RefreshCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

const API = {
  me:        () => "/api/user/me",
  all:       () => "/api/user/getAllUser",
  banned:    () => "/api/user/getBanUser",
  unbanned:  () => "/api/user/getUnbanUser",
  ban:       () => "/api/user/banUser",
  unban:     () => "/api/user/unbanUser",
};

const PAGE_SIZE = 10;

export default function AdminUsers() {
  const token = localStorage.getItem("token") || "";
  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    }),
    [token]
  );

  const [me, setMe] = useState(null);
  const [checkingMe, setCheckingMe] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    async function loadMe() {
      try {
        setCheckingMe(true);
        const r = await axios.get(expandLink(API.me()), { headers });
        const u = r.data?.user ?? r.data ?? null;
        setMe(u);
        if (!u?.isAdmin) {
          setForbidden(true);
        }
      } catch (e) {
        setForbidden(true);
      } finally {
        setCheckingMe(false);
      }
    }
    loadMe();
  }, [headers]);

  useEffect(() => {
    if (forbidden || checkingMe) return;
    loadUsers(0);
  }, [filter]);

  useEffect(() => {
    if (forbidden || checkingMe) return;
    loadUsers(page);
  }, [page]);

  async function loadUsers(targetPage = 0) {
    try {
      setBusy(true);
      setErr("");

      let url;
      if (filter === "banned") url = API.banned();
      else if (filter === "unbanned") url = API.unbanned();
      else url = API.all();

      const q = `?page=${targetPage}&size=${PAGE_SIZE}`;
      const r = await axios.get(expandLink(url + q), { headers });

      const list = r.data?.users ?? r.data?.rows ?? [];
      const tp = r.data?.totalPages ?? 0;

      setUsers(list);
      setTotalPages(tp);
      setPage(r.data?.currentPage ?? targetPage);
    } catch (e) {
      setErr(e?.response?.data?.message || "Nie udało się pobrać użytkowników.");
      setUsers([]);
      setTotalPages(0);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleBan(u) {
    const targetId = u.ID_USER;
    if (!targetId || targetId === me?.ID_USER) return;

    const currentlyBanned = !!u.isBanned;
    const confirmText = currentlyBanned
      ? `Odbanować użytkownika "${u.username}"?`
      : `Zbanować użytkownika "${u.username}"?`;

    if (!window.confirm(confirmText)) return;

    try {
      setActionBusyId(targetId);
      const endpoint = currentlyBanned ? API.unban() : API.ban();

      await axios.post(
        expandLink(endpoint),
        { otherUserId: targetId },
        { headers: { ...headers, "Content-Type": "application/json" } }
      );
      await loadUsers(page);
    } catch (e) {
      alert(
        e?.response?.data?.message ||
          (u.isBanned ? "Nie udało się odbanować użytkownika." : "Nie udało się zbanować użytkownika.")
      );
    } finally {
      setActionBusyId(null);
    }
  }

  const filteredLocal = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  });

  if (checkingMe) {
    return (
      <>
        <Navbar />
        <div className="admin-page">
          <main className="admin-grid">
            <section className="card admin-card">
              <p className="muted">Sprawdzanie uprawnień…</p>
            </section>
          </main>
        </div>
      </>
    );
  }

  if (forbidden) {
    return (
      <>
        <Navbar />
        <div className="admin-page">
          <main className="admin-grid">
            <section className="card admin-card">
              <header className="sect-head admin-head">
                <h2>
                  <ShieldCheck size={18} /> Panel administratora
                </h2>
              </header>
              <p className="muted">
                Brak uprawnień do wyświetlenia tej strony.
              </p>
            </section>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="admin-page">
        <main className="admin-grid">
          <section className="card admin-card">
            <header className="sect-head admin-head">
              <div className="admin-title">
                <h2>
                  <ShieldCheck size={18} /> Panel administratora
                </h2>
                <p className="muted small">
                  Zarządzanie użytkownikami, banowanie oraz odbanowywanie.
                </p>
              </div>

              <div className="admin-filters">
                <button
                  className={
                    "btn sm ghost admin-filter-btn" +
                    (filter === "all" ? " is-active" : "")
                  }
                  onClick={() => setFilter("all")}
                >
                  <Users size={14} />
                  <span>Wszyscy</span>
                </button>
                <button
                  className={
                    "btn sm ghost admin-filter-btn" +
                    (filter === "unbanned" ? " is-active" : "")
                  }
                  onClick={() => setFilter("unbanned")}
                >
                  <RefreshCcw size={14} />
                  <span>Aktywni</span>
                </button>
                <button
                  className={
                    "btn sm ghost admin-filter-btn" +
                    (filter === "banned" ? " is-active" : "")
                  }
                  onClick={() => setFilter("banned")}
                >
                  <Ban size={14} />
                  <span>Zbanowani</span>
                </button>
              </div>
            </header>

            <div className="admin-toolbar">
              <div className="admin-search">
                <Search size={16} className="icon" />
                <input
                  type="text"
                  placeholder="Szukaj po nicku lub e-mailu…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="admin-pager">
                <span className="muted small">
                  Strona {totalPages === 0 ? 0 : page + 1} / {totalPages}
                </span>
                <button
                  className="icon-btn"
                  disabled={page <= 0 || busy}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-btn"
                  disabled={page + 1 >= totalPages || busy}
                  onClick={() =>
                    setPage((p) =>
                      totalPages === 0 ? 0 : Math.min(totalPages - 1, p + 1)
                    )
                  }
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {err && (
              <div className="admin-error">
                <p className="err">{err}</p>
              </div>
            )}

            <div className="admin-table-wrap">
              {busy && (
                <p className="muted small" style={{ marginBottom: 8 }}>
                  Ładowanie danych…
                </p>
              )}

              {filteredLocal.length === 0 ? (
                <p className="muted">Brak użytkowników do wyświetlenia.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Nick</th>
                      <th>E-mail</th>
                      <th>Rejestracja</th>
                      <th>Status</th>
                      <th style={{ width: 140 }}>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLocal.map((u) => {
                      const mine = Number(u.ID_USER) === Number(me?.ID_USER);
                      return (
                        <tr key={u.ID_USER}>
                          <td>{u.ID_USER}</td>
                          <td>{u.username}</td>
                          <td className="muted">{u.email}</td>
                          <td className="muted">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleString()
                              : "—"}
                          </td>
                          <td>
                            {u.isBanned ? (
                              <span className="badge badge-banned">
                                Zbanowany
                              </span>
                            ) : (
                              <span className="badge badge-ok">
                                Aktywny
                              </span>
                            )}
                          </td>
                          <td>
                            {mine ? (
                              <span className="muted small">To Ty</span>
                            ) : (
                              <button
                                className={
                                  "btn sm " +
                                  (u.isBanned ? "ghost" : "danger-btn")
                                }
                                disabled={busy || actionBusyId === u.ID_USER}
                                onClick={() => handleToggleBan(u)}
                              >
                                {actionBusyId === u.ID_USER
                                  ? "Przetwarzanie…"
                                  : u.isBanned
                                  ? "Odbanuj"
                                  : "Zbanuj"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
