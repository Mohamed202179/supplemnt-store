// ============================================================
// رسم صورة إيصال دفعة (PNG) بـ Canvas: إيصال استلام دفعة من عميل، أو سند سداد لمورد.
// بنفس تصميم صورة الفاتورة (lib/invoiceImage.ts) وبألوان البراند.
// ============================================================
import type { InvoiceImagePalette, InvoiceImageRow } from "@/lib/invoiceImage";

export interface ReceiptImageData {
  brandName: string;
  logoUrl: string;
  palette: InvoiceImagePalette;
  title: string; // إيصال استلام دفعة / سند سداد لمورد
  partyLabel: string; // العميل / المورد
  partyName: string;
  phone: string | null;
  dateLabel: string;
  timeLabel: string;
  paymentMethodLabel: string | null;
  paymentMethodKey?: string | null; // cash | instapay | wallet
  paymentLogoUrl?: string | null;
  amountLabel: string; // المبلغ المدفوع
  amount: string;
  rowsBefore: InvoiceImageRow[]; // المديونية قبل الدفعة
  rowsAfter: InvoiceImageRow[]; // المتبقي بعد الدفعة
  note: string | null;
}

const W = 900;
const P = 48;
const GRAY = "#566070";
const INK = "#0b0f06";
const DANGER = "#b42318";

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  const anyCtx = ctx as unknown as { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void };
  if (anyCtx.roundRect) {
    anyCtx.roundRect(x, y, w, h, r);
    return;
  }
  const rad = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

/** بيرسم الإيصال. draw=false بيحسب الارتفاع بس. بيرجّع الارتفاع الكلي. */
function paint(
  ctx: Ctx,
  d: ReceiptImageData,
  family: string,
  logo: HTMLImageElement | null,
  payLogo: HTMLImageElement | null,
  draw: boolean
): number {
  const R = W - P;
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;
  ctx.direction = "rtl";
  ctx.textBaseline = "alphabetic";

  // ---------- الهيدر ----------
  const HEADER_H = 250;
  if (draw) {
    const g = ctx.createLinearGradient(0, 0, W, HEADER_H);
    g.addColorStop(0, d.palette.dark);
    g.addColorStop(0.62, d.palette.c600);
    g.addColorStop(1, d.palette.c500);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HEADER_H);

    const L = 112;
    const lx = R - L;
    const ly = (HEADER_H - L) / 2;
    if (logo) {
      ctx.save();
      roundRect(ctx, lx, ly, L, L, 26);
      ctx.clip();
      ctx.drawImage(logo, lx, ly, L, L);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      roundRect(ctx, lx, ly, L, L, 26);
      ctx.fill();
    }

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.font = font(800, 46);
    ctx.fillText(d.brandName, lx - 26, ly + 50);
    ctx.globalAlpha = 0.85;
    ctx.font = font(600, 28);
    ctx.fillText(d.title, lx - 26, ly + 96);
    ctx.globalAlpha = 1;

    // شارة "تم الدفع" (يسار)
    const chipW = 210;
    const chipH = 54;
    const cx = P;
    const cy = (HEADER_H - chipH) / 2;
    ctx.fillStyle = "#e3f5cc";
    roundRect(ctx, cx, cy, chipW, chipH, 27);
    ctx.fill();
    ctx.fillStyle = "#2b5a05";
    ctx.textAlign = "center";
    ctx.font = font(700, 27);
    ctx.fillText("تم الدفع", cx + chipW / 2, cy + 37);
  }
  let y = HEADER_H + 40;

  // ---------- البيانات ----------
  const info: [string, string, string?][] = [[d.partyLabel, d.partyName]];
  if (d.phone) info.push(["الهاتف", d.phone]);
  info.push(["التاريخ", d.dateLabel], ["الوقت", d.timeLabel]);
  if (d.paymentMethodLabel) info.push(["طريقة الدفع", d.paymentMethodLabel, "pay"]);
  const infoH = 36 + info.length * 54;
  if (draw) {
    ctx.fillStyle = d.palette.c50;
    roundRect(ctx, P, y, W - 2 * P, infoH, 28);
    ctx.fill();
    info.forEach(([label, value, kind], i) => {
      const by = y + 30 + 36 + i * 54 - 10;
      ctx.textAlign = "right";
      ctx.fillStyle = GRAY;
      ctx.font = font(600, 26);
      ctx.fillText(label, R - 30, by);
      let vx = R - 30 - 210;
      if (kind === "pay") {
        const S = 40;
        if (payLogo) {
          ctx.save();
          roundRect(ctx, vx - S, by - 31, S, S, 9);
          ctx.clip();
          ctx.drawImage(payLogo, vx - S, by - 31, S, S);
          ctx.restore();
          ctx.strokeStyle = "#cfd8c4";
          ctx.lineWidth = 2;
          roundRect(ctx, vx - S, by - 31, S, S, 9);
          ctx.stroke();
          vx -= S + 14;
        } else if (d.paymentMethodKey === "cash") {
          ctx.strokeStyle = d.palette.c600;
          ctx.lineWidth = 3.5;
          roundRect(ctx, vx - S, by - 26, S, 28, 6);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(vx - S / 2, by - 12, 6, 0, Math.PI * 2);
          ctx.stroke();
          vx -= S + 14;
        }
      }
      ctx.fillStyle = INK;
      ctx.font = font(700, 28);
      ctx.fillText(value, vx, by);
    });
  }
  y += infoH + 36;

  const drawRows = (rows: InvoiceImageRow[]) => {
    for (const r of rows) {
      if (draw) {
        ctx.textAlign = "right";
        ctx.fillStyle = r.danger ? DANGER : GRAY;
        ctx.font = font(600, 28);
        ctx.fillText(r.label, R - 8, y + 36);
        ctx.textAlign = "left";
        ctx.fillStyle = r.danger ? DANGER : INK;
        ctx.font = font(r.danger ? 800 : 700, 28);
        ctx.fillText(r.value, P + 8, y + 36);
      }
      y += 56;
    }
  };
  drawRows(d.rowsBefore);

  // ---------- بنر المبلغ المدفوع ----------
  y += 6;
  if (draw) {
    const g = ctx.createLinearGradient(P, y, W - P, y + 120);
    g.addColorStop(0, d.palette.c600);
    g.addColorStop(1, d.palette.c500);
    ctx.fillStyle = g;
    roundRect(ctx, P, y, W - 2 * P, 120, 28);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.font = font(700, 32);
    ctx.fillText(d.amountLabel, R - 34, y + 74);
    ctx.textAlign = "left";
    ctx.font = font(800, 52);
    ctx.fillText(d.amount, P + 34, y + 78);
  }
  y += 120 + 18;

  drawRows(d.rowsAfter);

  if (d.note) {
    if (draw) {
      ctx.textAlign = "right";
      ctx.fillStyle = GRAY;
      ctx.font = font(600, 26);
      ctx.fillText(`ملاحظة: ${d.note}`, R - 8, y + 36);
    }
    y += 56;
  }

  // ---------- الفوتر ----------
  y += 14;
  if (draw) {
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(P, y);
    ctx.lineTo(W - P, y);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = d.palette.c600;
    ctx.font = font(700, 32);
    ctx.fillText("شكرًا لتعاملكم معنا", W / 2, y + 58);
    ctx.fillStyle = GRAY;
    ctx.font = font(600, 24);
    ctx.fillText(d.brandName, W / 2, y + 100);
  }
  y += 100 + 44;
  return y;
}

/** بيرجّع الإيصال كصورة PNG. */
export async function renderReceiptImage(d: ReceiptImageData): Promise<Blob> {
  const family = (typeof getComputedStyle !== "undefined" && getComputedStyle(document.body).fontFamily) || "sans-serif";
  try {
    await Promise.all([600, 700, 800].map((w) => document.fonts.load(`${w} 24px ${family}`)));
    await document.fonts.ready;
  } catch {
    /* بنكمل بأي خط متاح */
  }
  const [logo, payLogo] = await Promise.all([
    loadImage(d.logoUrl),
    d.paymentLogoUrl ? loadImage(d.paymentLogoUrl) : Promise.resolve(null),
  ]);

  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = 10;
  const mctx = scratch.getContext("2d");
  if (!mctx) throw new Error("canvas unsupported");
  const H = Math.ceil(paint(mctx, d, family, logo, payLogo, false));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  paint(ctx, d, family, logo, payLogo, true);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}
