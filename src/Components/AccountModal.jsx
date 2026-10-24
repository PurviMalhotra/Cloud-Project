import { useMemo, useState } from "react";
import "./AccountModal.css";

const initialCreateState = {
  name: "",
  email: "",
  pin: "",
};

const initialLoginState = {
  email: "",
  pin: "",
};

export default function AccountModal({
  isOpen,
  onClose,
  accounts,
  onLogin,
  onCreateAccount,
}) {
  const [activeTab, setActiveTab] = useState("login");
  const [createState, setCreateState] = useState(initialCreateState);
  const [loginState, setLoginState] = useState(initialLoginState);
  const [message, setMessage] = useState("");

  const accountEmails = useMemo(
    () => new Set(accounts.map((account) => account.email.toLowerCase())),
    [accounts],
  );

  if (!isOpen) {
    return null;
  }

  const resetForms = () => {
    setCreateState(initialCreateState);
    setLoginState(initialLoginState);
    setMessage("");
  };

  const handleClose = () => {
    resetForms();
    onClose();
  };

  const handleLoginSubmit = (event) => {
    event.preventDefault();
    const email = loginState.email.trim().toLowerCase();
    const pin = loginState.pin.trim();

    const matchedAccount = accounts.find(
      (account) => account.email.toLowerCase() === email && account.pin === pin,
    );

    if (!matchedAccount) {
      setMessage(
        "We couldn't find a matching account. Double-check the email and PIN.",
      );
      return;
    }

    onLogin(matchedAccount);
    resetForms();
  };

  const handleCreateSubmit = (event) => {
    event.preventDefault();
    const name = createState.name.trim();
    const email = createState.email.trim().toLowerCase();
    const pin = createState.pin.trim();

    if (!name || !email || !pin) {
      setMessage("Please fill in all fields to create your account.");
      return;
    }

    if (accountEmails.has(email)) {
      setMessage("That email is already in use. Try signing in instead.");
      return;
    }

    const newAccount = {
      id: crypto.randomUUID(),
      name,
      email,
      pin,
      createdAt: new Date().toISOString(),
    };

    onCreateAccount(newAccount);
    resetForms();
  };

  return (
    <div className="account-modal-overlay" onClick={handleClose}>
      <div
        className="account-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="account-modal-header">
          <div>
            <h2>Player Accounts</h2>
            <p>Save your progress locally on this device.</p>
          </div>
          <button className="account-modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className="account-tabs">
          <button
            className={activeTab === "login" ? "active" : ""}
            onClick={() => {
              setActiveTab("login");
              setMessage("");
            }}
          >
            Sign In
          </button>
          <button
            className={activeTab === "create" ? "active" : ""}
            onClick={() => {
              setActiveTab("create");
              setMessage("");
            }}
          >
            Create Account
          </button>
        </div>

        {message && <div className="account-message">{message}</div>}

        {activeTab === "login" ? (
          <form className="account-form" onSubmit={handleLoginSubmit}>
            <label>
              Email
              <input
                type="email"
                value={loginState.email}
                onChange={(event) =>
                  setLoginState((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                placeholder="player@arcadehub.com"
                required
              />
            </label>
            <label>
              4-digit PIN
              <input
                type="password"
                value={loginState.pin}
                onChange={(event) =>
                  setLoginState((prev) => ({
                    ...prev,
                    pin: event.target.value,
                  }))
                }
                placeholder="••••"
                pattern="[0-9]{4}"
                maxLength={4}
                required
              />
            </label>
            <button type="submit" className="account-primary">
              Sign In
            </button>
          </form>
        ) : (
          <form className="account-form" onSubmit={handleCreateSubmit}>
            <label>
              Display name
              <input
                type="text"
                value={createState.name}
                onChange={(event) =>
                  setCreateState((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Sam Player"
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={createState.email}
                onChange={(event) =>
                  setCreateState((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
                placeholder="player@arcadehub.com"
                required
              />
            </label>
            <label>
              Create a 4-digit PIN
              <input
                type="password"
                value={createState.pin}
                onChange={(event) =>
                  setCreateState((prev) => ({
                    ...prev,
                    pin: event.target.value,
                  }))
                }
                placeholder="1234"
                pattern="[0-9]{4}"
                maxLength={4}
                required
              />
            </label>
            <button type="submit" className="account-primary">
              Create Account
            </button>
          </form>
        )}

        <div className="account-footer">
          <p>
            Accounts live in your browser storage only. Clearing site data will
            remove them.
          </p>
        </div>
      </div>
    </div>
  );
}
