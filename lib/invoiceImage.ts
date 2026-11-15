// ============================================================
// رسم صورة الفاتورة (PNG) بـ Canvas: بتتبعت للعميل على واتساب كصورة بتصميم ثابت.
// الألوان بتيجي من هوية البراند (palette) فبتطلع بشكل مختلف لكل براند تلقائيًا.
// مفيش مكتبات خارجية: كله Canvas API في المتصفح.
// ============================================================

export interface InvoiceImagePalette {
  dark: string;
  c600: string;
  c500: string;
  c100: string;
  c50: string;
}

export interface InvoiceImageRow {
  label: string;
  value: string;
  danger?: boolean;
}

export interface InvoiceImageData {
  brandName: string;
  logoUrl: string;
  palette: InvoiceImagePalette;
  invoiceNumber: string; // جاهز للعرض (مثلًا ٢٠١)
  dateLabel: string;
  timeLabel: string;
  customerName: string;
  phone: string | null;
  paymentMethodLabel: string | null;
  paymentMethodKey?: string | null; // cash | instapay | wallet
  paymentLogoUrl?: string | null; // لوجو إنستا باي / فودافون كاش
  paymentStatusLabel: string;
  cancelled: boolean;
  items: { name: string; qty: string; unit: string; total: string }[];
  rowsBefore: InvoiceImageRow[]; // الإجمالي الفرعي / الخصم
  total: string;
  rowsAfter: InvoiceImageRow[]; // المدفوع / المتبقي
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

function wrapText(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || ctx.measureText(next).width <= maxWidth) {
      cur = next;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
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

/** بيرسم الفاتورة. draw=false بيحسب الارتفاع بس (من غير رسم). بيرجّع الارتفاع الكلي. */
function paint(
  ctx: Ctx,
  d: InvoiceImageData,
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
    ctx.fillText("فاتورة بيع", lx - 26, ly + 96);
    ctx.globalAlpha = 1;

    // رقم الفاتورة (يسار)
    const pillW = 200;
    const pillH = 78;
    const px = P;
    const py = 52;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, px, py, pillW, pillH, 22);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = font(800, 44);
    ctx.fillText(`#${d.invoiceNumber}`, px + pillW / 2, py + 54);

    // حالة الفاتورة
    const chipW = 200;
    const chipH = 50;
    const cy = py + pillH + 18;
    ctx.fillStyle = d.cancelled ? "#fde2df" : "#e3f5cc";
    roundRect(ctx, px, cy, chipW, chipH, 25);
    ctx.fill();
    ctx.fillStyle = d.cancelled ? DANGER : "#2b5a05";
    ctx.font = font(700, 26);
    ctx.fillText(d.cancelled ? "ملغاة" : "مكتملة", px + chipW / 2, cy + 35);
  }
  let y = HEADER_H + 40;

  // ---------- بيانات العميل ----------
  const info: [string, string, string?][] = [["العميل", d.customerName]];
  if (d.phone) info.push(["الهاتف", d.phone]);
  info.push(["التاريخ", d.dateLabel], ["الوقت", d.timeLabel]);
  if (d.paymentMethodLabel) info.push(["طريقة الدفع", d.paymentMethodLabel, "pay"]);
  info.push(["حالة الدفع", d.paymentStatusLabel]);
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
          // إطار خفيف علشان لوجو إنستا باي الأبيض يبان على الخلفية الفاتحة
          ctx.strokeStyle = "#cfd8c4";
          ctx.lineWidth = 2;
          roundRect(ctx, vx - S, by - 31, S, S, 9);
          ctx.stroke();
          vx -= S + 14;
        } else if (d.paymentMethodKey === "cash") {
          // أيقونة كاش بسيطة (ورقة فلوس)
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

  // ---------- جدول الأصناف ----------
  const NAME_R = R - 24;
  const NAME_W = 330;
  const QTY_C = 430;
  const UNIT_R = 380;
  const TOTAL_L = P + 24;
  if (draw) {
    ctx.fillStyle = d.palette.c100;
    roundRect(ctx, P, y, W - 2 * P, 64, 18);
    ctx.fill();
    ctx.fillStyle = d.palette.dark;
    ctx.font = font(700, 25);
    ctx.textAlign = "right";
    ctx.fillText("الصنف", NAME_R, y + 42);
    ctx.textAlign = "center";
    ctx.fillText("الكمية", QTY_C, y + 42);
    ctx.textAlign = "right";
    ctx.fillText("السعر", UNIT_R, y + 42);
    ctx.textAlign = "left";
    ctx.fillText("الإجمالي", TOTAL_L, y + 42);
  }
  y += 64;

  for (const it of d.items) {
    ctx.font = font(600, 28);
    const lines = wrapText(ctx, it.name, NAME_W);
    const rowH = lines.length * 40 + 34;
    if (draw) {
      ctx.fillStyle = INK;
      ctx.font = font(600, 28);
      ctx.textAlign = "right";
      lines.forEach((ln, i) => ctx.fillText(ln, NAME_R, y + 44 + i * 40));
      ctx.textAlign = "center";
      ctx.font = font(600, 27);
      ctx.fillText(it.qty, QTY_C, y + 44);
      ctx.textAlign = "right";
      ctx.fillStyle = GRAY;
      ctx.font = font(600, 26);
      ctx.fillText(it.unit, UNIT_R, y + 44);
      ctx.textAlign = "left";
      ctx.fillStyle = INK;
      ctx.font = font(800, 28);
      ctx.fillText(it.total, TOTAL_L, y + 44);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(P, y + rowH);
      ctx.lineTo(W - P, y + rowH);
      ctx.stroke();
    }
    y += rowH;
  }
  y += 22;

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

  // ---------- بنر الإجمالي ----------
  y += 6;
  if (draw) {
    const g = ctx.createLinearGradient(P, y, W - P, y + 120);
    if (d.cancelled) {
      g.addColorStop(0, "#b42318");
      g.addColorStop(1, "#dc2626");
    } else {
      g.addColorStop(0, d.palette.c600);
      g.addColorStop(1, d.palette.c500);
    }
    ctx.fillStyle = g;
    roundRect(ctx, P, y, W - 2 * P, 120, 28);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.font = font(700, 32);
    ctx.fillText("الإجمالي", R - 34, y + 74);
    ctx.textAlign = "left";
    ctx.font = font(800, 52);
    ctx.fillText(d.total, P + 34, y + 78);
  }
  y += 120 + 18;

  drawRows(d.rowsAfter);

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

function paintStamp(ctx: Ctx, family: string, height: number) {
  ctx.save();
  ctx.translate(W / 2, height / 2);
  ctx.rotate(-0.3);
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = DANGER;
  ctx.fillStyle = DANGER;
  ctx.lineWidth = 12;
  roundRect(ctx, -210, -90, 420, 180, 30);
  ctx.stroke();
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 120px ${family}`;
  ctx.fillText("ملغاة", 0, 6);
  ctx.restore();
}

/** بيرجّع الفاتورة كصورة PNG. */
export async function renderInvoiceImage(d: InvoiceImageData): Promise<Blob> {
  const family = (typeof getComputedStyle !== "undefined" && getComputedStyle(document.body).fontFamily) || "sans-serif";
  try {
    // نتأكد إن أوزان الخط اللي هنرسم بيها اتحمّلت (Canvas مش بيحمّل الخطوط لوحده)
    await Promise.all([600, 700, 800].map((w) => document.fonts.load(`${w} 24px ${family}`)));
    await document.fonts.ready;
  } catch {
    /* بنكمل بأي خط متاح */
  }
  const [logo, payLogo] = await Promise.all([loadImage(d.logoUrl), d.paymentLogoUrl ? loadImage(d.paymentLogoUrl) : Promise.resolve(null)]);

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
  if (d.cancelled) paintStamp(ctx, family, H);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}
