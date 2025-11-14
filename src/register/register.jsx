import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { expandLink } from "../fetches/expandLink";
import "./register.css";

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [submitError, setSubmitError] = useState("");
  
  const [loading, setLoading] = useState(false);
  
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const navigate = useNavigate();

  //Walidacje
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const usernameOk = /^[a-zA-Z0-9_]{3,24}$/.test(username);
  const pwLen = password.length >= 8;
  const pwUpper = /[A-Z]/.test(password);
  const pwLower = /[a-z]/.test(password);
  const pwDigit = /\d/.test(password);
  const passwordOk = pwLen && pwUpper && pwLower && pwDigit;

  const canSubmit = emailOk && usernameOk && passwordOk && 
        confirm === password && !loading;
  
  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setEmailError("");
    setUsernameError("");
    setPasswordError("");
    setConfirmError("");

    if(!emailOk) setEmailError ("Podaj prawidłowy adres e-mail.");
    if(!usernameOk) setUsernameError ("3-24 znaki: litery, cyfry lub _.");
    if(!passwordOk) setPasswordError ("Hasło nie spełnia wymagań.");
    if(confirm !== password) setConfirmError ("Hasła nie są takie same.");
    if (!canSubmit) return;

    try {
    setLoading(true);
      const res = await fetch(expandLink("/api/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json"},
      body: JSON.stringify({ 
        email: email.trim(),
        username: username.trim(),
        password }),
    });

    const data = await res.json();

    if (res.status === 201 || res.ok) {
      setRegistered(true);
      setRegisteredEmail(email.trim());
      return;
    }

    //Mapowanie komunikatów
    const msg = (data && data.message) ? String(data.message) : "Błąd rejestracji";
    const low = msg.toLowerCase();
    if (low.includes("email")) setEmailError(msg);
    else if (low.includes("username") || low.includes("nick")) setUsernameError(msg);
    else setSubmitError(msg);

    } catch {
      setSubmitError("Błąd sieci. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };
  
  if (registered) {
    return (
      <div className="register-container">
        <div className="register-form card-neon success-box">
          <div className="success-icon" aria-hidden="true"></div>
          <h1 className="register-title">Sprawdź swoją skrzynkę</h1>
          <p className="success-text">
            Wysłaliśmy link aktywacyjny na <strong>{registeredEmail}</strong>.
            Kliknij w link, aby potwierdzić konto. Jeśli nie widzisz wiadomości,
            sprawdź folder <em>Spam</em> lub <em>Oferty/Promocje</em>.
          </p>

          <div className="success-actions">
            <button className="register-button" onClick={() => navigate("/login")}>
              Przejdź do logowania
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="register-container">
      <form onSubmit={handleRegister} className="register-form card-neon">
        <h1 className="register-title">Rejestracja</h1>

        <div className="register-fields">

          <div className={`field ${emailError ? "invalid" : ""}`}>
            <label>Email</label>
            <div className="input-wrap">
              <input
                type="email"
                autoComplete="email"
                placeholder="twoj@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                />
            </div>
            {emailError && <p className="field-error" role="alert">{emailError}</p>}
          </div>

          <div className={`field ${usernameError ? "invalid" : ""}`}>
            <label>Nazwa użytkownika</label>
            <div className="input-wrap">
              <input
                type="text"
                autoComplete="username"
                placeholder="twój nick"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                />
            </div>
            <p className="field-hint">Dozwolone: litery, cyfry i "_", 3-24 znaków.</p>
            {usernameError && <p className="field-error" role="alert">{usernameError}</p>}
          </div>

          <div className={`field ${passwordError ? "invalid" : ""}`}>
            <label>Hasło</label>
            <div className="input-wrap password-field">
              <input
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={`eye-toggle ${showPass ? "shown" : ""}`}
                onClick={() => setShowPass(s => !s)}
                aria-label={showPass ? "Ukryj hasło" : "Pokaż hasło"}
                aria-pressed={showPass}
              >
                <span className="eye eye-open" aria-hidden="true" />
                <span className="eye eye-closed" aria-hidden="true" />
              </button>
            </div>

            <ul className="pw-criteria">
              <li className={pwLen ? "ok" : "bad"}>Minimum 8 znaków</li>
              <li className={pwUpper ? "ok" : "bad"}>Przynajmniej 1 duża litera</li>
              <li className={pwLower ? "ok" : "bad"}>Przynajmniej 1 mała litera</li>
              <li className={pwDigit ? "ok" : "bad"}>Minimum 1 cyfra</li>
            </ul>

            {passwordError && <p className="field-error" role="alert">{passwordError}</p>}
          </div>

          <div className={`field ${confirmError ? "invalid" : ""}`}>
            <label>Potwierdź hasło</label>
            <div className="input-wrap password-field">
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="********"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <button
                type="button"
                className={`eye-toggle ${showConfirm ? "shown" : ""}`}
                onClick={() => setShowConfirm(s => !s)}
                aria-label={showConfirm ? "Ukryj potwierdzenie hasła" : "Pokaż potwierdzenie hasła"}
                aria-pressed={showConfirm}
              >
                <span className="eye eye-open" aria-hidden="true" />
                <span className="eye eye-closed" aria-hidden="true" />
              </button>
            </div>
            {confirmError && <p className="field-error" role="alert">{confirmError}</p>}
          </div>
        </div>

        {submitError && <p className="register-error" role="alert">{submitError}</p>}
        
        <button type="submit" className="register-button" disabled={!canSubmit}>  
          {loading ? "Rejestrowanie..." : "Zarejestruj się"}
        </button>

        <div className="register-links">
          <Link to="/login">Masz już konto? <span>Zaloguj się</span></Link>
        </div>
      </form>
    </div>
  );
}