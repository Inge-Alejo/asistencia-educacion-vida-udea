import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldAlert, CheckCircle2, ArrowLeft, Clock } from 'lucide-react';
import { authenticateAdmin, getLockoutRemainingSeconds } from '../services/auth';

export default function AdminAuthModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Monitorear bloqueo por fuerza bruta
  useEffect(() => {
    if (!isOpen) return;

    const checkLockout = () => {
      const remaining = getLockoutRemainingSeconds();
      setLockoutSeconds(remaining);
      if (remaining > 0) {
        setErrorMsg(`Acceso bloqueado temporalmente por seguridad. Espere ${remaining}s.`);
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const isLocked = lockoutSeconds > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLocked) return;

    setErrorMsg('');
    setIsVerifying(true);

    try {
      const res = await authenticateAdmin(password);
      if (res.success) {
        setPassword('');
        setErrorMsg('');
        onSuccess();
      } else {
        setErrorMsg(res.message);
        if (res.lockoutSeconds) {
          setLockoutSeconds(res.lockoutSeconds);
        }
      }
    } catch (err) {
      setErrorMsg('Ocurrió un error al verificar las credenciales.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container auth-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <img
            src="/logo-udea-vertical.png"
            alt="Escudo Oficial Universidad de Antioquia"
            className="auth-modal-udea-shield"
          />
          <span className="inst-badge">Facultad de Medicina • UdeA</span>
          <h2 className="auth-title">Acceso al Panel Administrativo</h2>
          <p className="auth-subtitle">
            Área restringida para moderadores y coordinadores de Educación a lo Largo de la Vida.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="admin-pwd">
              <KeyRound size={15} /> Contraseña Maestra de Administración
            </label>
            <div className="password-input-wrapper">
              <input
                id="admin-pwd"
                type={showPassword ? 'text' : 'password'}
                className={`form-input password-field ${isLocked ? 'input-locked' : ''}`}
                placeholder={isLocked ? `Bloqueado temporalmente (${lockoutSeconds}s)...` : "Ingrese la contraseña..."}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus={!isLocked}
                disabled={isLocked || isVerifying}
                required
              />
              <button
                type="button"
                className="btn-toggle-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Alternar visibilidad de contraseña"
                disabled={isLocked}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className={`form-error-banner ${isLocked ? 'locked-banner' : ''}`}>
              {isLocked ? <Clock size={16} /> : <ShieldAlert size={16} />}
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="auth-security-notice">
            <p>
              🔒 <strong>Acceso Seguro Institucional:</strong> Protegido con cifrado SHA-256 local y limitador contra intentos de fuerza bruta.
            </p>
          </div>

          <div className="auth-actions-row">
            <button type="button" className="btn-secondary" onClick={onClose}>
              <ArrowLeft size={16} />
              <span>Regresar al Portal</span>
            </button>
            <button
              type="submit"
              className="btn-primary-action"
              disabled={isVerifying || isLocked || !password}
            >
              {isVerifying ? 'Verificando...' : isLocked ? `Bloqueado (${lockoutSeconds}s)` : 'Desbloquear Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
