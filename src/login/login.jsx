import { useState} from "react";
import { Link, useNavigate } from "react-router-dom";
import { expandLink } from "../fetches/expandLink";
import "./login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);
      const res = await fetch(expandLink("/api/auth/signin"), {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        if (data.admin) {
          localStorage.setItem("admin", data.admin);
        } else {
          localStorage.removeItem("admin");
        }
        navigate("/home");
      } else {
        setError(data.message || "Błąd logowania");
      }
    } catch (err){
      setError("Błąd sieci, Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form ">
        <h1 className="login-title">Logowanie</h1>

        <div className="login-fields">

          <div>
            <label>Email</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="twoj@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              ></input>
          </div>

          <div className="password-field">
              <label>Hasło</label>
              <div className="input-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  ></input>

                <button
                type="button"
                className={`eye-toggle ${showPassword ? "shown" : ""}`}
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                aria-pressed={showPassword}
                >
                  <span className="eye eye-open" aria-hidden="true" />
                  <span className="eye eye-closed" aria-hidden="true" />
                </button>
            </div>
          </div>
        </div>

        {error && <p className="login-error" role="alert">{error}</p>}

        <button  type="submit" disabled={loading} className="login-button">
          {loading ? "Logowanie..." : "Zaloguj się"}
        </button>

        <div className="login-links">
          <Link to="/register">Nie masz konta? <span>Zarejestruj się</span></Link>
          <Link to="/forgot-password">Nie pamiętasz hasła?</Link>
        </div>
      </form>
    </div>
  );
}