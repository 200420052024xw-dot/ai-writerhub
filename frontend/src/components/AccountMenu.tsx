import { FormEvent, useState } from "react";
import { ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react";
import { updatePassword, updateProfile, type AuthUser } from "../services/api";

type AccountMenuProps = {
  user: AuthUser;
  onLogout: () => Promise<void>;
  onUserChange: (user: AuthUser) => void;
};

export function AccountMenu({ user, onLogout, onUserChange }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"profile" | "password" | null>(null);
  const [nickname, setNickname] = useState(user.nickname);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const closeDialog = () => {
    setDialog(null);
    setError("");
    setOldPassword("");
    setNewPassword("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (dialog === "profile") {
        onUserChange(await updateProfile(nickname.trim()));
      } else {
        await updatePassword(oldPassword, newPassword);
      }
      closeDialog();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-menu">
      <button className="account-trigger" onClick={() => setOpen((value) => !value)} type="button">
        <UserRound size={17} />
        <span>{user.nickname}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="account-dropdown">
          <div className="account-identity"><strong>{user.nickname}</strong><span>@{user.username}</span></div>
          <button onClick={() => { setDialog("profile"); setOpen(false); setNickname(user.nickname); }} type="button">
            <UserRound size={16} />修改昵称
          </button>
          <button onClick={() => { setDialog("password"); setOpen(false); }} type="button">
            <KeyRound size={16} />修改密码
          </button>
          <button onClick={() => void onLogout()} type="button">
            <LogOut size={16} />退出登录
          </button>
        </div>
      )}
      {dialog && (
        <div className="account-modal-backdrop" onMouseDown={closeDialog}>
          <form className="account-modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
            <h2>{dialog === "profile" ? "修改昵称" : "修改密码"}</h2>
            {dialog === "profile" ? (
              <label>昵称<input maxLength={32} onChange={(event) => setNickname(event.target.value)} value={nickname} /></label>
            ) : (
              <>
                <label>旧密码<input autoComplete="current-password" onChange={(event) => setOldPassword(event.target.value)} type="password" value={oldPassword} /></label>
                <label>新密码<input autoComplete="new-password" maxLength={72} onChange={(event) => setNewPassword(event.target.value)} type="password" value={newPassword} /></label>
              </>
            )}
            {error && <div className="auth-error">{error}</div>}
            <div className="account-modal-actions">
              <button onClick={closeDialog} type="button">取消</button>
              <button disabled={saving} type="submit">{saving ? "保存中..." : "保存"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
