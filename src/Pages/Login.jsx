import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../Components/Navbar';
import './Login.css';
export default function Login() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const { login, signup, confirmSignup, resendCode, configured, authError } = useAuth();
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (mode === 'signup') {
        await signup(username, password, email); setMode('confirm'); setMessage('Check your email for the verification code.');
      } else if (mode === 'confirm') {
        await confirmSignup(username, code); setMode('login'); setMessage('Email verified. Sign in with your password.');
      } else { await login(username, password); navigate('/profile'); }
    } catch (error) {
      if (error.code === 'UserNotConfirmedException') setMode('confirm'); setMessage(error.message);
    } finally { setBusy(false); }
  }
  return <div className="page"><Navbar /><div className="login-container"><div className="login-box">
    <h1>Arcade Hub</h1><h3>{mode === 'signup' ? 'Create Account' : mode === 'confirm' ? 'Verify Email' : 'Login'}</h3>
    {!configured && <p role="status">Player accounts are being set up. You can play all games as a guest.</p>}
    <form onSubmit={submit}>
      <input aria-label="Username" placeholder="Username" value={username} onChange={e => setUsername(e.target.value.toLowerCase())} required pattern="[a-z][a-z0-9_]{2,19}" title="3–20 characters; start with a letter, then letters, numbers or underscores" autoComplete="username" />
      {mode === 'signup' && <input aria-label="Email" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />}
      {mode !== 'confirm' && <input aria-label="Password" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === 'signup' ? 12 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />}
      {mode === 'signup' && <p>Use at least 12 characters, including uppercase, lowercase, a number and a symbol.</p>}
      {mode === 'confirm' && <input aria-label="Verification code" placeholder="Email verification code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} required />}
      {(message || authError) && <p role="status" className="error-message">{message || authError}</p>}
      <button disabled={busy || !configured} type="submit">{busy ? 'Please wait…' : mode === 'signup' ? 'Sign Up' : mode === 'confirm' ? 'Verify Email' : 'Login'}</button>
      {mode === 'confirm' && <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await resendCode(username); setMessage('A new code has been sent.'); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }}>Resend code</button>}
    </form>
    <p className="toggle-auth"><button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage(''); }}>{mode === 'login' ? 'Create an account' : 'Back to login'}</button></p>
  </div></div></div>;
}
