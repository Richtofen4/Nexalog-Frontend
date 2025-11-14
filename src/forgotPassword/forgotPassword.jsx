import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { expandLink } from "../fetches/expandLink";
import "./forgotPassword.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const navigate = useNavigate();
  const emailOk = /^\S+@\S+\.\S+$/.test(email);

  const canSubmit = emailOk && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError("");
    setSubmitError("");

    if (!emailOk) {
        setEmailError("Podaj prawidłowy adres e-mail.");
        return;
    }

    try {
        setLoading(true);

        await fetch(expandLink("/api/auth/remember"), {
            method: "POST",
            headers: { "Content-Type": "application/json"},
            body: JSON.stringify({ 
                email: email.trim()
        }),
        });
            setSent(true);
            setSentEmail(email.trim());
        } catch {
            setSubmitError("Błąd sieci. Spróbuj ponownie.");
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="forgot-container">
                <div className="forgot-form card-neon success-box">
                    <div className="success-icon" aria-hidden="true"></div>
                    <h1 className="forgot-title">Sprawdź swoją skrzynkę</h1>
                    <p className="success-text">
                        Wysłaliśmy wiadomość z linkiem do zresetowania hasła na {" "}
                        <strong>{sentEmail}</strong>. Jeśli nie widzisz maila, sprawdź
                        folder <em>Spam</em> lub <em>Oferty/Promocje</em>.
                    </p>

                    <div className="success-actions">
                        <button className="forgot-button" onClick={() => navigate("/login")}>
                            Przejdź do logowania
                        </button>
                    </div>
                </div>
            </div>
        );
    }
  
    return (
        <div className="forgot-container">
            <form onSubmit={handleSubmit} className="forgot-form card-neon">
                <h1 className="forgot-title">Odzyskiwanie hasła</h1>
                <div className="forgot-fields">
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
                                aria-invalid={!!emailError}
                            />
                        </div>
                        {emailError && <p className="field-error" role="alert">{emailError}</p>}
                    </div>
                </div>

                {submitError && <p className="forgot-error" role="alert">{submitError}</p>}

                <button type="submit" className="forgot-button" disabled={!canSubmit}>
                    {loading ? "Wysyłanie..." : "Wyślij link resetujący"}
                </button>

                <div className="forgot-links">
                    <Link to="/login">Pamiętasz hasło? <span>Zaloguj się</span></Link>
                </div>
            </form>
        </div>
    )


};