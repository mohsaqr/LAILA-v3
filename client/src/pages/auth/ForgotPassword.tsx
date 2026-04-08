import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useLanguageStore } from '../../store/languageStore';
import { supportedLanguages, SupportedLanguage } from '../../i18n/config';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { authApi } from '../../api/auth';

export const ForgotPassword = () => {
  const { t } = useTranslation(['auth', 'common']);
  const [step, setStep] = useState<'email' | 'verify' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Verification code state
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // New password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { resetPassword } = useAuth();
  const { isDark } = useTheme();
  const { language: currentLanguage, setLanguage } = useLanguageStore();
  const navigate = useNavigate();

  // Theme colors
  const colors = {
    bgCard: isDark ? '#1f2937' : '#ffffff',
    textPrimary: isDark ? '#f3f4f6' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    linkColor: isDark ? '#5eecec' : '#088F8F',
  };

  // Auto-focus first digit input when entering verify step
  useEffect(() => {
    if (step === 'verify') {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authApi.forgotPassword(email);
      setStep('verify');
      toast.success(t('verification_code_sent', { defaultValue: 'Verification code sent to your email' }));
    } catch (error: any) {
      toast.error(error.message || t('forgot_password_failed', { defaultValue: 'Failed to send verification code' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...codeDigits];
    newDigits[index] = value.slice(-1);
    setCodeDigits(newDigits);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCodeDigits(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const [codeError, setCodeError] = useState('');

  const handleVerifyCode = async () => {
    const code = codeDigits.join('');
    if (code.length !== 6) {
      setCodeError(t('enter_full_code', { defaultValue: 'Please enter the full 6-digit code' }));
      return;
    }

    setIsVerifying(true);
    setCodeError('');
    try {
      await authApi.verifyResetCode(email, code);
      setStep('reset');
    } catch (error: any) {
      setCodeError(error.message || t('invalid_code', { defaultValue: 'Invalid verification code' }));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await authApi.forgotPassword(email);
      toast.success(t('code_resent', { defaultValue: 'New verification code sent' }));
      setCodeDigits(['', '', '', '', '', '']);
      setCodeError('');
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      toast.error(error.message || t('resend_failed', { defaultValue: 'Failed to resend code' }));
    } finally {
      setIsResending(false);
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return t('password_too_short', { defaultValue: 'Password must be at least 8 characters' });
    if (!/[A-Z]/.test(pwd)) return t('password_requirements', { defaultValue: 'Password must include uppercase, lowercase, digit, and special character' });
    if (!/[a-z]/.test(pwd)) return t('password_requirements', { defaultValue: 'Password must include uppercase, lowercase, digit, and special character' });
    if (!/[0-9]/.test(pwd)) return t('password_requirements', { defaultValue: 'Password must include uppercase, lowercase, digit, and special character' });
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return t('password_requirements', { defaultValue: 'Password must include uppercase, lowercase, digit, and special character' });
    return null;
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(t('password_mismatch', { defaultValue: 'Passwords do not match' }));
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    const code = codeDigits.join('');
    setIsResetting(true);

    try {
      await resetPassword(email, code, newPassword);
      toast.success(t('password_reset_success', { defaultValue: 'Password reset successfully' }));
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      toast.error(error.message || t('password_reset_failed', { defaultValue: 'Failed to reset password' }));
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md" dir="ltr">
        <div className="rounded-2xl shadow-xl p-8 text-left" style={{ backgroundColor: colors.bgCard }}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center">
                {step === 'email' && <KeyRound className="w-7 h-7 text-white" />}
                {step === 'verify' && <ShieldCheck className="w-7 h-7 text-white" />}
                {step === 'reset' && <Lock className="w-7 h-7 text-white" />}
              </div>
            </div>
            {step === 'email' && (
              <>
                <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {t('forgot_password_title', { defaultValue: 'Forgot Password' })}
                </h1>
                <p className="mt-1" style={{ color: colors.textSecondary }}>
                  {t('forgot_password_subtitle', { defaultValue: 'Enter your email to receive a verification code' })}
                </p>
              </>
            )}
            {step === 'verify' && (
              <>
                <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {t('verify_code_title', { defaultValue: 'Enter Verification Code' })}
                </h1>
                <p className="mt-1" style={{ color: colors.textSecondary }}>
                  {t('code_sent_to', { defaultValue: 'Code sent to {{email}}', email })}
                </p>
              </>
            )}
            {step === 'reset' && (
              <>
                <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>
                  {t('reset_password_title', { defaultValue: 'Set New Password' })}
                </h1>
                <p className="mt-1" style={{ color: colors.textSecondary }}>
                  {t('reset_password_subtitle', { defaultValue: 'Choose a strong password for your account' })}
                </p>
              </>
            )}
          </div>

          {/* Step 1: Email */}
          {step === 'email' && (
            <>
              <form onSubmit={handleSendCode} className="space-y-5">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.textMuted }} />
                  <Input
                    type="email"
                    placeholder={t('email_placeholder', { defaultValue: 'Email address' })}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" loading={isLoading}>
                  {t('send_code', { defaultValue: 'Send Code' })}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm font-medium hover:underline" style={{ color: colors.linkColor }}>
                  <span className="inline-flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" />
                    {t('back_to_login', { defaultValue: 'Back to Login' })}
                  </span>
                </Link>
              </div>
            </>
          )}

          {/* Step 2: Verification Code */}
          {step === 'verify' && (
            <div className="space-y-6">
              <div className="flex justify-center gap-3" onPaste={handleDigitPaste}>
                {codeDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    className="w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 focus:outline-none focus:ring-2 transition-colors"
                    style={{
                      backgroundColor: isDark ? '#111827' : '#f9fafb',
                      borderColor: digit ? colors.linkColor : (isDark ? '#374151' : '#d1d5db'),
                      color: colors.textPrimary,
                    }}
                  />
                ))}
              </div>

              {codeError && (
                <p className="text-sm text-red-500 text-center">{codeError}</p>
              )}

              <Button
                className="w-full"
                loading={isVerifying}
                onClick={handleVerifyCode}
                disabled={codeDigits.some(d => !d)}
              >
                {t('verify_code', { defaultValue: 'Verify Code' })}
              </Button>

              <div className="text-center">
                <p className="text-sm" style={{ color: colors.textSecondary }}>
                  {t('didnt_receive_code', { defaultValue: "Didn't receive the code?" })}{' '}
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="font-medium hover:underline"
                    style={{ color: colors.linkColor }}
                  >
                    {isResending
                      ? t('resending', { defaultValue: 'Resending...' })
                      : t('resend_code', { defaultValue: 'Resend Code' })}
                  </button>
                </p>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setStep('email'); setCodeDigits(['', '', '', '', '', '']); }}
                  className="text-sm font-medium hover:underline"
                  style={{ color: colors.linkColor }}
                >
                  <span className="inline-flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" />
                    {t('back', { defaultValue: 'Back' })}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: New Password */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.textMuted }} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('new_password_placeholder', { defaultValue: 'New password' })}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-11 pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: colors.textMuted }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.textMuted }} />
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder={t('confirm_password_placeholder', { defaultValue: 'Confirm password' })}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-11 pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: colors.textMuted }}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password requirements hint */}
              <div className="text-xs space-y-1" style={{ color: colors.textMuted }}>
                <p>{t('password_hint', { defaultValue: 'Password must contain:' })}</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li style={{ color: newPassword.length >= 8 ? colors.linkColor : colors.textMuted }}>
                    {t('pwd_min_chars', { defaultValue: 'At least 8 characters' })}
                  </li>
                  <li style={{ color: /[A-Z]/.test(newPassword) ? colors.linkColor : colors.textMuted }}>
                    {t('pwd_uppercase', { defaultValue: 'One uppercase letter' })}
                  </li>
                  <li style={{ color: /[a-z]/.test(newPassword) ? colors.linkColor : colors.textMuted }}>
                    {t('pwd_lowercase', { defaultValue: 'One lowercase letter' })}
                  </li>
                  <li style={{ color: /[0-9]/.test(newPassword) ? colors.linkColor : colors.textMuted }}>
                    {t('pwd_digit', { defaultValue: 'One digit' })}
                  </li>
                  <li style={{ color: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? colors.linkColor : colors.textMuted }}>
                    {t('pwd_special', { defaultValue: 'One special character' })}
                  </li>
                </ul>
              </div>

              <Button type="submit" className="w-full" loading={isResetting}>
                {t('reset_password', { defaultValue: 'Reset Password' })}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  className="text-sm font-medium hover:underline"
                  style={{ color: colors.linkColor }}
                >
                  <span className="inline-flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" />
                    {t('back', { defaultValue: 'Back' })}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Language Selector */}
        <div className="flex justify-center gap-2 mt-4">
          {Object.entries(supportedLanguages).map(([code, { nativeName }]) => (
            <button
              key={code}
              onClick={() => setLanguage(code as SupportedLanguage)}
              className="px-3 py-1.5 text-sm rounded-lg transition-colors"
              style={{
                backgroundColor: currentLanguage === code
                  ? 'rgba(255, 255, 255, 0.25)'
                  : 'transparent',
                color: currentLanguage === code
                  ? '#ffffff'
                  : 'rgba(255, 255, 255, 0.7)',
                fontWeight: currentLanguage === code ? 600 : 400,
              }}
            >
              {nativeName}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
