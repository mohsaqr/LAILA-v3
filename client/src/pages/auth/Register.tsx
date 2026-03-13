import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrainCircuit, Mail, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useLanguageStore } from '../../store/languageStore';
import { supportedLanguages, SupportedLanguage } from '../../i18n/config';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { authApi } from '../../api/auth';

export const Register = () => {
  const { t } = useTranslation(['auth', 'common']);
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verification state
  const [step, setStep] = useState<'register' | 'verify'>('register');
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { register, verifyCode } = useAuth();
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

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return t('password_too_short');
    if (!/[A-Z]/.test(pwd)) return t('password_requirements');
    if (!/[a-z]/.test(pwd)) return t('password_requirements');
    if (!/[0-9]/.test(pwd)) return t('password_requirements');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) return t('password_requirements');
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.endsWith('@uef.fi')) {
      toast.error(t('uef_email_only'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('password_mismatch'));
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(fullname, email, password);
      setVerifyEmail(result.email);
      setStep('verify');
      toast.success(t('verification_code_sent'));
    } catch (error: any) {
      if (error.details && Array.isArray(error.details) && error.details.length > 0) {
        toast.error(error.details[0].message);
      } else {
        toast.error(error.message || t('register_failed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-focus first digit input when entering verify step
  useEffect(() => {
    if (step === 'verify') {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const newDigits = [...codeDigits];
    newDigits[index] = value.slice(-1); // only last char
    setCodeDigits(newDigits);

    // Auto-advance to next input
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

  const handleVerify = async () => {
    const code = codeDigits.join('');
    if (code.length !== 6) {
      toast.error(t('enter_full_code'));
      return;
    }

    setIsVerifying(true);
    try {
      await verifyCode(verifyEmail!, code);
      toast.success(t('account_created'));
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || t('invalid_code'));
      setCodeDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await authApi.resendCode(verifyEmail!);
      toast.success(t('code_resent'));
      setCodeDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      toast.error(error.message || t('resend_failed'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl shadow-xl p-8" style={{ backgroundColor: colors.bgCard }}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center">
                {step === 'register' ? (
                  <BrainCircuit className="w-7 h-7 text-white" />
                ) : (
                  <ShieldCheck className="w-7 h-7 text-white" />
                )}
              </div>
            </div>
            {step === 'register' ? (
              <>
                <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{t('register_title')}</h1>
                <p className="mt-1" style={{ color: colors.textSecondary }}>{t('register_subtitle')}</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold" style={{ color: colors.textPrimary }}>{t('verify_email_title')}</h1>
                <p className="mt-1" style={{ color: colors.textSecondary }}>
                  {t('verify_email_subtitle', { email })}
                </p>
              </>
            )}
          </div>

          {step === 'register' ? (
            <>
              {/* Registration Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.textMuted }} />
                  <Input
                    type="text"
                    placeholder={t('fullname_placeholder')}
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    className="pl-11"
                    required
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.textMuted }} />
                  <Input
                    type="email"
                    placeholder={t('email_placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.textMuted }} />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('password_placeholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('confirm_password_placeholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-11"
                    required
                  />
                </div>

                <Button type="submit" className="w-full" loading={isLoading}>
                  {t('sign_up')}
                </Button>
              </form>

              {/* Footer */}
              <div className="mt-6 text-center">
                <p style={{ color: colors.textSecondary }}>
                  {t('have_account')}{' '}
                  <Link to="/login" className="font-medium hover:underline" style={{ color: colors.linkColor }}>
                    {t('login_link')}
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Verification Code Input */}
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

                <Button
                  className="w-full"
                  loading={isVerifying}
                  onClick={handleVerify}
                  disabled={codeDigits.some(d => !d)}
                >
                  {t('verify_code')}
                </Button>

                <div className="text-center">
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    {t('didnt_receive_code')}{' '}
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isResending}
                      className="font-medium hover:underline"
                      style={{ color: colors.linkColor }}
                    >
                      {isResending ? t('resending') : t('resend_code')}
                    </button>
                  </p>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setStep('register'); setCodeDigits(['', '', '', '', '', '']); }}
                    className="text-sm font-medium hover:underline"
                    style={{ color: colors.linkColor }}
                  >
                    {t('back_to_register')}
                  </button>
                </div>
              </div>
            </>
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
