import { useEffect, useMemo, useState } from "react";
import Navbar from "../navbar/navbar";
import { expandLink } from "../fetches/expandLink";
import "./profile.css";

const DEFAULT_AVATAR =
  "https://res.cloudinary.com/dcqhaa1ez/image/upload/v1716977307/default.png";

// helper
async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { return await res.json(); } catch {}
  }
  return null;
}

export default function Profile() {
  const token = localStorage.getItem("token") || "";
  const initialUsername = localStorage.getItem("username") || "Użytkownik";
  const initialAvatar   = localStorage.getItem("avatar")   || DEFAULT_AVATAR;
  const initialAbout    = localStorage.getItem("about")    || "";

  const [username, setUsername] = useState(initialUsername);
  const [about, setAbout] = useState(initialAbout);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(initialAvatar);

  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const usernameOk = useMemo(
    () => /^[a-zA-Z0-9_]{3,24}$/.test(username.trim()),
    [username]
  );
  const aboutLeft = 300 - about.trim().length;

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileMsg(""); setProfileErr("");

    const wantUsername = username.trim();
    const wantAvatar   = !!avatarFile;

    if (!wantUsername && !wantAvatar && about === initialAbout) {
      setProfileErr("Wpisz nowy nick i/lub wybierz plik…");
      return;
    }
    if (wantUsername && !usernameOk) {
      setProfileErr('Nick musi mieć 3–24 znaki (litery, cyfry, „_”).');
      return;
    }
    if (about.trim().length > 300) {
      setProfileErr("Opis może mieć maks. 300 znaków.");
      return;
    }

    try {
      setProfileLoading(true);
      const fd = new FormData();
      if (wantUsername) fd.append("username", wantUsername);
      if (wantAvatar)   fd.append("avatar",   avatarFile);
      fd.append("about", about.trim());

      const res = await fetch(expandLink("/api/user/profile"), {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'accept': 'application/json',
        },
        body: fd,
      });

      const data = await safeJson(res);
      if (!res.ok) {
        setProfileErr(data?.message || `Błąd ${res.status}`);
        return;
      }

      setProfileMsg("Profil zaktualizowany.");
      if (data?.username) {
        localStorage.setItem("username", data.username);
        setUsername(data.username);
      }
      if (typeof data?.about === "string") {
        localStorage.setItem("about", data.about);
        setAbout(data.about);
      }
      if (data?.avatar) {
        localStorage.setItem("avatar", data.avatar);
        setAvatarPreview(data.avatar);
        setAvatarFile(null);
      }
    } catch (err) {
      console.error("PUT /api/user/profile failed:", err);
      setProfileErr("Błąd sieci. Spróbuj ponownie.");
    } finally {
      setProfileLoading(false);
    }
  }

  //zmiana hasła
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const pwLen = newPass.length >= 8;
  const pwUpper = /[A-Z]/.test(newPass);
  const pwLower = /[a-z]/.test(newPass);
  const pwDigit = /\d/.test(newPass);
  const pwOk = pwLen && pwUpper && pwLower && pwDigit;

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg(""); setPwErr("");

    if (!oldPass || !newPass || !confirmPass) {
      setPwErr("Podaj stare hasło, nowe hasło i potwierdzenie.");
      return;
    }
    if (newPass !== confirmPass) { setPwErr("Nowe hasło i potwierdzenie się nie zgadzają."); return; }
    if (oldPass === newPass)     { setPwErr("Nowe hasło nie może być takie samo jak stare."); return; }
    if (!pwOk) {
      setPwErr("Hasło musi mieć min. 8 znaków, 1 dużą, 1 małą literę i 1 cyfrę.");
      return;
    }

    try {
      setPwLoading(true);
      const res = await fetch(expandLink("/api/user/password"), {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
        body: JSON.stringify({
          oldPassword: oldPass,
          newPassword: newPass,
          confirmPassword: confirmPass,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) {
        setPwErr(data?.message || `Błąd ${res.status}`);
        return;
      }

      setPwMsg("Hasło zostało zmienione.");
      setOldPass(""); setNewPass(""); setConfirmPass("");
      setShowOld(false); setShowNew(false); setShowConfirm(false);
    } catch (err) {
      console.error("PUT /api/user/password failed:", err);
      setPwErr("Błąd sieci. Spróbuj ponownie.");
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <>
      <div className="profile-bg">
        <Navbar notifications={2} />

        <main className="profile-page">

          <section className="profile-left profile-card card-neon">
            <h1>Twój profil</h1>

            <form className="stack" onSubmit={handleSaveProfile}>
              <div className="avatar-row">
                <div className="avatar">
                  <img src={avatarPreview} alt="Avatar" />
                </div>

                <div className="avatar-ctrl">
                  <label className="field-label">Zmień avatar</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  />
                  <p className="hint">Dozwolone: PNG / JPG / WEBP (max 5 MB)</p>
                </div>
              </div>

              <div className={`field ${username && !usernameOk ? "invalid" : ""}`}>
                <label className="field-label">Nick</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Twój nick"
                  autoComplete="off"
                />
                <p className="hint">Litery, cyfry i „_”, 3–24 znaków.</p>
              </div>

              <div className="field">
                <label className="field-label">Opis (about)</label>
                <textarea
                  rows={4}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Napisz kilka słów o sobie…"
                  maxLength={300}
                />
                <div className="counter">{aboutLeft} / 300</div>
              </div>

              {profileErr && <p className="error" role="alert">{profileErr}</p>}
              {profileMsg && <p className="ok">{profileMsg}</p>}

              <button className="btn" disabled={profileLoading}>
                {profileLoading ? "Zapisywanie..." : "Zapisz profil"}
              </button>
            </form>
          </section>

          <section className="profile-right profile-card card-neon">
            <h2>Zmień hasło</h2>

            <form className="stack" onSubmit={handleChangePassword}>
              <div className="field">
                <label className="field-label">Stare hasło</label>
                <div className="input-wrap password-field">
                  <input
                    type={showOld ? "text" : "password"}
                    value={oldPass}
                    onChange={(e) => setOldPass(e.target.value)}
                    autoComplete="current-password"
                    placeholder="********"
                  />
                  <button
                    type="button"
                    className={`eye-toggle ${showOld ? "shown" : ""}`}
                    onClick={() => setShowOld((v) => !v)}
                    aria-label={showOld ? "Ukryj hasło" : "Pokaż hasło"}
                    aria-pressed={showOld}
                  >
                    <span className="eye eye-open" aria-hidden="true" />
                    <span className="eye eye-closed" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className={`field ${newPass && !pwOk ? "invalid" : ""}`}>
                <label className="field-label">Nowe hasło</label>
                <div className="input-wrap password-field">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    autoComplete="new-password"
                    placeholder="********"
                  />
                  <button
                    type="button"
                    className={`eye-toggle ${showNew ? "shown" : ""}`}
                    onClick={() => setShowNew((v) => !v)}
                    aria-label={showNew ? "Ukryj hasło" : "Pokaż hasło"}
                    aria-pressed={showNew}
                  >
                    <span className="eye eye-open" aria-hidden="true" />
                    <span className="eye eye-closed" aria-hidden="true" />
                  </button>
                </div>

                <ul className="pw-criteria">
                  <li className={pwLen ? "ok" : ""}>Minimum 8 znaków</li>
                  <li className={pwUpper ? "ok" : ""}>Przynajmniej 1 duża litera</li>
                  <li className={pwLower ? "ok" : ""}>Przynajmniej 1 mała litera</li>
                  <li className={pwDigit ? "ok" : ""}>Minimum 1 cyfra</li>
                </ul>
              </div>

              <div className="field">
                <label className="field-label">Potwierdź nowe hasło</label>
                <div className="input-wrap password-field">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    autoComplete="new-password"
                    placeholder="********"
                  />
                  <button
                    type="button"
                    className={`eye-toggle ${showConfirm ? "shown" : ""}`}
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Ukryj potwierdzenie" : "Pokaż potwierdzenie"}
                    aria-pressed={showConfirm}
                  >
                    <span className="eye eye-open" aria-hidden="true" />
                    <span className="eye eye-closed" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {pwErr && <p className="error" role="alert">{pwErr}</p>}
              {pwMsg && <p className="ok">{pwMsg}</p>}

              <button className="btn" disabled={pwLoading}>
                {pwLoading ? "Zapisywanie..." : "Zmień hasło"}
              </button>
            </form>
          </section>

        </main>
      </div>
    </>
  );
}
