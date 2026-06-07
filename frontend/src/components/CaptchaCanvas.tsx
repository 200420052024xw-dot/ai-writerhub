import { useCallback, useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const CAPTCHA_LENGTH = 5;
const CANVAS_W = 150;
const CANVAS_H = 50;

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

function randomColor(min = 0, max = 200): string {
  const r = min + Math.floor(Math.random() * (max - min));
  const g = min + Math.floor(Math.random() * (max - min));
  const b = min + Math.floor(Math.random() * (max - min));
  return `rgb(${r},${g},${b})`;
}

function generateCaptchaText(): string {
  let text = "";
  for (let i = 0; i < CAPTCHA_LENGTH; i++) text += randomChar();
  return text;
}

function drawCaptcha(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = randomColor(220, 245);
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = randomColor(100, 200);
    ctx.lineWidth = 1 + Math.random();
    ctx.beginPath();
    ctx.moveTo(Math.random() * CANVAS_W, Math.random() * CANVAS_H);
    ctx.lineTo(Math.random() * CANVAS_W, Math.random() * CANVAS_H);
    ctx.stroke();
  }

  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = randomColor(0, 255);
    ctx.beginPath();
    ctx.arc(Math.random() * CANVAS_W, Math.random() * CANVAS_H, 1 + Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }

  const charW = CANVAS_W / (CAPTCHA_LENGTH + 1);
  for (let i = 0; i < text.length; i++) {
    ctx.save();
    const x = charW * (i + 0.8);
    const y = CANVAS_H / 2;
    ctx.translate(x, y);
    ctx.rotate(((Math.random() - 0.5) * Math.PI) / 5);
    ctx.font = `bold ${22 + Math.floor(Math.random() * 8)}px monospace`;
    ctx.fillStyle = randomColor(0, 120);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text[i], 0, (Math.random() - 0.5) * 8);
    ctx.restore();
  }
}

type CaptchaCanvasProps = {
  onVerified: (verified: boolean) => void;
};

export function CaptchaCanvas({ onVerified }: CaptchaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [captchaText, setCaptchaText] = useState(generateCaptchaText);
  const [userInput, setUserInput] = useState("");

  const refresh = useCallback(() => {
    const newText = generateCaptchaText();
    setCaptchaText(newText);
    setUserInput("");
    onVerified(false);
    if (canvasRef.current) drawCaptcha(canvasRef.current, newText);
  }, [onVerified]);

  useEffect(() => {
    if (canvasRef.current) drawCaptcha(canvasRef.current, captchaText);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (value: string) => {
    setUserInput(value);
    onVerified(value.toUpperCase() === captchaText.toUpperCase());
  };

  return (
    <label>
      <span className="field-label">验证码</span>
      <span className="captcha-row">
        <span className="login-input captcha-input-wrapper">
          <input
            maxLength={CAPTCHA_LENGTH}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="请输入验证码"
            value={userInput}
            autoComplete="off"
          />
        </span>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="captcha-canvas"
          onClick={refresh}
          title="点击刷新验证码"
        />
      </span>
    </label>
  );
}
