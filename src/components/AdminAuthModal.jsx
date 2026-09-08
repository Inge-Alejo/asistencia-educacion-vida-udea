import React, { useState } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldAlert, CheckCircle2, ArrowLeft } from 'lucide-react';
import { authenticateAdmin } from '../services/auth';

export default function AdminAuthModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsVerifying(true);

    try {
      const res = await authenticateAdmin(password);
      if (res.success) {
        setPassword('');
        onSuccess();
      } else {
        setErrorMsg(res.message);
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
          <div className="auth-icon-circle">
            <Lock size={28} className="lock-icon" />
          </div>
          <span className="inst-badge">Facultad de Medicina • UdeA</span>
          <h2 className="auth-title">Acceso al Panel Administrativo</h2>
          <p className="auth-subtitle">
            Área restringida para moderadores y administradores de Educación a lo Largo de la Vida.
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
                className="form-input password-field"
                placeholder="Ingrese la contraseña..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
              <button
                type="button"
                className="btn-toggle-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Alternar visibilidad de contraseña"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="form-error-banner">
              <ShieldAlert size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="auth-security-notice">
            <p>
              🔒 <strong>Clave inicial institucional:</strong> <code>MedicinaUdeA2026*</code> (o <code>UdeA2026</code>)
            </p>
            <p style={{ marginTop: '0.35rem', fontSize: '0.72rem', opacity: 0.85 }}>
              Puedes cambiar esta contraseña en cualquier momento desde el panel administrativo.
            </p>
          </div>

          <div className="auth-actions-row">
            <button type="button" className="btn-secondary" onClick={onClose}>
              <ArrowLeft size={16} />
              <span>Regresar al Portal</span>
            </button>
            <button type="submit" className="btn-primary-action" disabled={isVerifying}>
              {isVerifying ? 'Verificando...' : 'Desbloquear Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
