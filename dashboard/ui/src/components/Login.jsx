import React, { useState } from 'react';
import './Login.css';

const TRANSLATIONS = {
  vi: {
    langCode: 'vi',
    portalTitle: ['EduPulse', 'Xin Chào'],
    greeting: 'XIN CHÀO!',
    mssvPlaceholder: 'Nhập MSSV',
    passwordPlaceholder: 'Nhập mật khẩu',
    submitButton: 'ĐĂNG NHẬP',
    mssvInvalid: 'MSSV không hợp lệ',
    passwordLengthError: 'Mật khẩu phải từ 8 ký tự trở lên',
    passwordValid: 'Mật khẩu hợp lệ',
    switchLangTooltip: 'Switch to English',
    togglePasswordShow: 'Hiện mật khẩu',
    togglePasswordHide: 'Ẩn mật khẩu',
    loginSuccess: 'Đăng nhập thành công!',
  },
  en: {
    langCode: 'en',
    portalTitle: ['EduPulse', 'Welcome'],
    greeting: 'WELCOME!',
    mssvPlaceholder: 'Enter Student ID',
    passwordPlaceholder: 'Enter password',
    submitButton: 'LOG IN',
    mssvInvalid: 'Invalid Student ID',
    passwordLengthError: 'Password must be at least 8 characters',
    passwordValid: 'Valid password',
    switchLangTooltip: 'Chuyển sang Tiếng Việt',
    togglePasswordShow: 'Show password',
    togglePasswordHide: 'Hide password',
    loginSuccess: 'Login successful!',
  },
};

export default function Login() {
  const [lang, setLang] = useState('vi');
  const [mssv, setMssv] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mssvTouched, setMssvTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const t = TRANSLATIONS[lang];

  // Pre-emptive validation computations
  const isMssvValid = mssv.trim().length === 8;
  const isPasswordValid = password.length >= 8;
  const isFormValid = isMssvValid && isPasswordValid;

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'vi' ? 'en' : 'vi'));
  };

  const handleMssvChange = (e) => {
    // Restrict to max 8 characters or allow typing with validation
    const val = e.target.value.trim().slice(0, 8);
    setMssv(val);
    if (!mssvTouched) setMssvTouched(true);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (!passwordTouched) setPasswordTouched(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setMssvTouched(true);
    setPasswordTouched(true);

    if (isFormValid) {
      setSubmitted(true);
      setTimeout(() => {
        alert(`${t.loginSuccess} (MSSV: ${mssv})`);
        setSubmitted(false);
      }, 300);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        {/* Left Branding Section (Red) */}
        <div className="brand-panel">
          {/* Portal Title */}
          <div className="portal-title">
            {t.portalTitle.map((line, idx) => (
              <h1 key={idx} className="portal-title-line">
                {line}
              </h1>
            ))}
          </div>
        </div>

        {/* Right Form Section (White) */}
        <div className="form-panel">
          {/* Top-Right Language Switcher */}
          <div className="language-selector">
            <button
              type="button"
              className="flag-btn"
              onClick={toggleLanguage}
              title={t.switchLangTooltip}
              aria-label={t.switchLangTooltip}
            >
              {lang === 'vi' ? (
                /* UK Flag (switch to English) */
                <svg viewBox="0 0 60 30" className="flag-svg">
                  <clipPath id="uk-clip">
                    <path d="M0 0 v30 h60 v-30 z" />
                  </clipPath>
                  <g clipPath="url(#uk-clip)">
                    <path d="M0 0 v30 h60 v-30 z" fill="#012169" />
                    <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="6" />
                    <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="4" />
                    <path d="M30 0 v30 M0 15 h60" stroke="#fff" strokeWidth="10" />
                    <path d="M30 0 v30 M0 15 h60" stroke="#C8102E" strokeWidth="6" />
                  </g>
                </svg>
              ) : (
                /* Vietnam Flag (switch to Vietnamese) */
                <svg viewBox="0 0 60 40" className="flag-svg">
                  <rect width="60" height="40" fill="#DA251D" />
                  <polygon
                    points="30,8 33.7,19.4 45.7,19.4 36,26.4 39.7,37.8 30,30.8 20.3,37.8 24,26.4 14.3,19.4 26.3,19.4"
                    fill="#FFFF00"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Form Header */}
          <div className="form-header">
            <h2 className="greeting-title">{t.greeting}</h2>
          </div>

          {/* Login Form */}
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {/* MSSV Field */}
            <div className="form-group">
              <div
                className={`input-container ${
                  mssvTouched
                    ? isMssvValid
                      ? 'is-valid'
                      : 'is-invalid'
                    : ''
                }`}
              >
                <span className="input-prefix-icon">
                  {/* User icon */}
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  name="mssv"
                  id="mssv-input"
                  className="form-input"
                  placeholder={t.mssvPlaceholder}
                  value={mssv}
                  onChange={handleMssvChange}
                  onBlur={() => setMssvTouched(true)}
                  autoComplete="username"
                  maxLength={8}
                />
              </div>
              {/* Pre-emptive feedback */}
              {mssvTouched && !isMssvValid && (
                <div className="validation-hint error-text">
                  <span>⚠ {t.mssvInvalid}</span>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="form-group">
              <div
                className={`input-container ${
                  passwordTouched
                    ? isPasswordValid
                      ? 'is-valid'
                      : 'is-invalid'
                    : ''
                }`}
              >
                <span className="input-prefix-icon">
                  {/* Lock icon */}
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  id="password-input"
                  className="form-input"
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={() => setPasswordTouched(true)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-suffix-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? t.togglePasswordHide : t.togglePasswordShow}
                  aria-label={showPassword ? t.togglePasswordHide : t.togglePasswordShow}
                >
                  {showPassword ? (
                    /* Eye Off SVG */
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                        clipRule="evenodd"
                      />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  ) : (
                    /* Eye SVG */
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path
                        fillRule="evenodd"
                        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {/* Pre-emptive feedback */}
              {passwordTouched && (
                <div className={`validation-hint ${isPasswordValid ? 'valid-text' : 'error-text'}`}>
                  {isPasswordValid ? (
                    <span>✓ {t.passwordValid}</span>
                  ) : (
                    <span>⚠ {t.passwordLengthError}</span>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="submit-container">
              <button
                type="submit"
                className="submit-btn"
                disabled={submitted}
              >
                {submitted ? '...' : t.submitButton}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
