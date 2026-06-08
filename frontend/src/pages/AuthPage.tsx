import { FormEvent, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { loginUser, registerUser, resetPassword, type AuthUser } from "../services/api";
import { CaptchaCanvas } from "../components/CaptchaCanvas";

type AuthPageProps = {
  onAuthenticated: (user: AuthUser) => void;
};

function ProductBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`product-brand ${compact ? "compact" : ""}`}>
      <img alt="文枢 AI WriterHub" src="/logo-brand.png" />
    </div>
  );
}

export function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: "login" | "register" | "forgot") => {
    setMode(next);
    setError("");
    setSuccess("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setEmail("");
    setCaptchaVerified(false);
    setPasswordVisible(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    const cleanUsername = username.trim();

    if (mode === "login") {
      if (!/^[\u3400-\u9fffA-Za-z0-9_]{3,24}$/.test(cleanUsername)) {
        setError("用户名需为 3-24 位中文、字母、数字或下划线");
        return;
      }
      setSubmitting(true);
      try {
        const user = await loginUser({ username: cleanUsername, password });
        onAuthenticated(user);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "请求失败");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "register") {
      const cleanNickname = nickname.trim();
      const cleanEmail = email.trim();

      if (!/^[\u3400-\u9fffA-Za-z0-9_]{3,24}$/.test(cleanUsername)) {
        setError("用户名需为 3-24 位中文、字母、数字或下划线");
        return;
      }
      if (cleanNickname.length < 1 || cleanNickname.length > 32) {
        setError("昵称需为 1-32 个字符");
        return;
      }
      if (password.length < 8 || password.length > 72) {
        setError("密码需为 8-72 个字符");
        return;
      }
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致");
        return;
      }
      if (cleanEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
        setError("邮箱格式不正确");
        return;
      }
      if (!captchaVerified) {
        setError("请输入正确的验证码");
        return;
      }

      setSubmitting(true);
      try {
        const user = await registerUser({
          username: cleanUsername,
          nickname: cleanNickname,
          password,
          email: cleanEmail || null,
        });
        onAuthenticated(user);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "请求失败");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // mode === "forgot"
    const cleanEmail = email.trim();

    if (!/^[\u3400-\u9fffA-Za-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError("用户名需为 3-24 位中文、字母、数字或下划线");
      return;
    }
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError("新密码需为 8-72 个字符");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (!captchaVerified) {
      setError("请输入正确的验证码");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ username: cleanUsername, email: cleanEmail, new_password: password });
      setSuccess("密码重置成功，请使用新密码登录");
      setTimeout(() => switchMode("login"), 1500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "请求失败");
    } finally {
      setSubmitting(false);
    }
  };

  const modeTitle = mode === "login" ? "登录" : mode === "register" ? "注册" : "重置密码";

  return (
    <main className={`login-page auth-${mode}`}>
      <div className="login-page-glow login-page-glow-one" />
      <div className="login-page-glow login-page-glow-two" />

      <section className="login-hero">
        <ProductBrand compact />

        <div className="login-hero-copy">
          <h1>智能写作 · 翻译 · 排版 · 文档问答</h1>
          <p>新一代 AI 文档创作与知识助理，<br />让写作更高效，让知识更有价值。</p>
        </div>

        <div className="hero-illustration hero-illustration-image" aria-hidden="true">
          <img alt="" src="/left_picture.webp" />
        </div>
      </section>

      <section className="login-panel">
        <div className={`login-card auth-${mode}`}>

          {/* 仅登录显示 logo */}
          {mode === "login" && <ProductBrand />}

          {mode === "login" ? (
            <div className="login-tabs">
              <button
                className="active"
                onClick={() => switchMode("login")}
                type="button"
              >
                登录
              </button>
              <button
                onClick={() => switchMode("register")}
                type="button"
              >
                注册
              </button>
            </div>
          ) : mode === "forgot" ? (
            <h2 className="auth-card-title">{modeTitle}</h2>
          ) : null}

          <form className="login-form" onSubmit={submit}>
            {/* 用户名 — 三种模式都显示 */}
            <label>
              <span className="field-label">用户名</span>
              <span className="login-input">
                {mode === "login" && <UserRound size={20} />}
                <input
                  autoComplete={mode === "forgot" ? "off" : "username"}
                  maxLength={24}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="请输入用户名"
                  value={username}
                />
              </span>
            </label>

            {/* 昵称 — 仅注册 */}
            {mode === "register" && (
              <label>
                <span className="field-label">昵称</span>
                <span className="login-input">
                  <input
                    autoComplete="nickname"
                    maxLength={32}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="请输入昵称"
                    value={nickname}
                  />
                </span>
              </label>
            )}

            {/* 密码 — 登录和注册显示 */}
            {mode !== "forgot" && (
              <label>
                <span className="field-label">密码</span>
                <span className="login-input">
                  {mode === "login" && <LockKeyhole size={20} />}
                  <input
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    maxLength={72}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "login" ? "请输入密码" : "请输入 8-72 位密码"}
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                    className="login-password-toggle"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    type="button"
                  >
                    {passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </span>
              </label>
            )}

            {/* 确认密码 — 仅注册 */}
            {mode === "register" && (
              <label>
                <span className="field-label">确认密码</span>
                <span className="login-input">
                  <input
                    autoComplete="new-password"
                    maxLength={72}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="请再次输入密码"
                    type={passwordVisible ? "text" : "password"}
                    value={confirmPassword}
                  />
                </span>
              </label>
            )}

            {/* 邮箱 — 注册（选填）和找回密码（必填） */}
            {(mode === "register" || mode === "forgot") && (
              <label>
                <span className="field-label">
                  邮箱{mode === "register" && <span className="field-optional">（选填）</span>}
                </span>
                <span className="login-input">
                  {mode === "forgot" && <Mail size={20} />}
                  <input
                    autoComplete="email"
                    maxLength={191}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={mode === "register" ? "不填邮箱将无法找回密码" : "请输入注册时的邮箱"}
                    type="email"
                    value={email}
                  />
                </span>
              </label>
            )}

            {/* 新密码 — 仅找回密码 */}
            {mode === "forgot" && (
              <label>
                <span className="field-label">新密码</span>
                <span className="login-input">
                  <LockKeyhole size={20} />
                  <input
                    autoComplete="new-password"
                    maxLength={72}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="请输入 8-72 位新密码"
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                    className="login-password-toggle"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    type="button"
                  >
                    {passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </span>
              </label>
            )}

            {/* 确认新密码 — 仅找回密码 */}
            {mode === "forgot" && (
              <label>
                <span className="field-label">确认新密码</span>
                <span className="login-input">
                  <LockKeyhole size={20} />
                  <input
                    autoComplete="new-password"
                    maxLength={72}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="请再次输入新密码"
                    type={passwordVisible ? "text" : "password"}
                    value={confirmPassword}
                  />
                </span>
              </label>
            )}

            {/* 验证码 — 注册和找回密码 */}
            {(mode === "register" || mode === "forgot") && (
              <CaptchaCanvas onVerified={setCaptchaVerified} />
            )}

            {/* 记住我 + 忘记密码 — 仅登录 */}
            {mode === "login" && (
              <div className="login-options">
                <label className="remember-option">
                  <button
                    aria-pressed={remembered}
                    className={remembered ? "checked" : ""}
                    onClick={() => setRemembered((current) => !current)}
                    type="button"
                  >
                    {remembered && <Check size={13} strokeWidth={3} />}
                  </button>
                  记住我
                </label>
                <span className="forgot-password" onClick={() => switchMode("forgot")} style={{ cursor: "pointer" }}>
                  忘记密码？
                </span>
              </div>
            )}

            {error && <div className="login-error">{error}</div>}
            {success && <div className="login-success">{success}</div>}

            <button className="login-submit" disabled={submitting} type="submit">
              {submitting
                ? "提交中..."
                : mode === "login"
                  ? "登录"
                  : mode === "register"
                    ? "注册并登录"
                    : "重置密码"}
            </button>
          </form>

          {/* 模式切换链接 */}
          <p className="auth-switch-link">
            {mode === "login" && (
              <>
                还没有账号？
                <span onClick={() => switchMode("register")}>立即注册</span>
              </>
            )}
            {mode === "register" && (
              <>
                已有账号？
                <span onClick={() => switchMode("login")}>立即登录</span>
              </>
            )}
            {mode === "forgot" && (
              <>
                想起密码了？
                <span onClick={() => switchMode("login")}>返回登录</span>
              </>
            )}
          </p>

          <p className="login-agreement">
            登录或注册即表示您同意 <span>《用户协议》</span> 和 <span>《隐私政策》</span>
          </p>
        </div>
      </section>
    </main>
  );
}
