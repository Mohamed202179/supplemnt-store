// ============================================================
// رسم صورة كشف حساب عميل (PNG) بـ Canvas بنفس تصميم الفاتورة والإيصال وبألوان البراند.
// الصورة بتتشارك (واتساب) أو بتتطبع من قايمة المشاركة.
// ============================================================
import type { InvoiceImagePalette } from "@/lib/invoiceImage";

export interface StatementImageRow {
  date: string;
  desc: string;
  debit: string; // عليه (فاتورة)، فاضي لو مفيش
  credit: string; // له (دفعة / مرتجع)، فاضي لو مفيش
  balance: string;
}

export interface StatementImageData {
  brandName: string;
  logoUrl: string;
  palette: InvoiceImagePalette;
  customerName: string;
  phone: string | null;
  periodLabel: string;
  printedAt: string;
  openingLabel: string | null; // "رصيد سابق" + قيمته، أو null لو صفر
  openingValue: string | null;
  rows: StatementImageRow[];
  totalDebit: string;
  totalCredit: string;
  closingLabel: string;
  closingValue: string;
  closingDanger: boolean;
  note: string | null; // مثلًا: عرض آخر N حركة بس
}

const W = 900;
const P = 48;
const GRAY = "#566070";
const INK = "#0b0f06";
const DANGER = "#b42318";
const OK = "#2b7a0b";
const ROW_H = 58;

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

// بيقص النص بنقط (…) لو أطول من المساحة
function fit(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

/** بيرسم الكشف. draw=false بيحسب الارتفاع بس. بيرجّع الارتفاع الكلي. */
function paint(ctx: Ctx, d: StatementImageData, family: string, logo: HTMLImageElement | null, draw: boolean): number {
  const R = W - P;
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;
  ctx.direction = "rtl";
  ctx.textBaseline = "alphabetic";

  // ---------- الهيدر ----------
  const HEADER_H = 230;
  if (draw) {
    const g = ctx.createLinearGradient(0, 0, W, HEADER_H);
    g.addColorStop(0, d.palette.dark);
    g.addColorStop(0.62, d.palette.c600);
    g.addColorStop(1, d.palette.c500);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HEADER_H);

    const L = 104;
    const lx = R - L;
    const ly = (HEADER_H - L) / 2;
    if (logo) {
      ctx.save();
      roundRect(ctx, lx, ly, L, L, 24);
      ctx.clip();
      ctx.drawImage(logo, lx, ly, L, L);
      ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      roundRect(ctx, lx, ly, L, L, 24);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.font = font(800, 44);
    ctx.fillText(d.brandName, lx - 24, ly + 46);
    ctx.globalAlpha = 0.85;
    ctx.font = font(600, 28);
    ctx.fillText("كشف حساب", lx - 24, ly + 90);
    ctx.globalAlpha = 1;
  }
  let y = HEADER_H + 36;

  // ---------- بيانات العميل ----------
  const info: [string, string][] = [["العميل", d.customerName]];
  if (d.phone) info.push(["الهاتف", d.phone]);
  info.push(["الفترة", d.periodLabel], ["تاريخ الكشف", d.printedAt]);
  const infoH = 32 + info.length * 52;
  if (draw) {
    ctx.fillStyle = d.palette.c50;
    roundRect(ctx, P, y, W - 2 * P, infoH, 26);
    ctx.fill();
    info.forEach(([label, value], i) => {
      const by = y + 26 + 38 + i * 52 - 12;
      ctx.textAlign = "right";
      ctx.fillStyle = GRAY;
      ctx.font = font(600, 25);
      ctx.fillText(label, R - 28, by);
      ctx.fillStyle = INK;
      ctx.font = font(700, 27);
      ctx.fillText(fit(ctx, value, 520), R - 28 - 190, by);
    });
  }
  y += infoH + 32;

  // ---------- أعمدة الجدول (من اليمين لليسار) ----------
  const cols = [
    { key: "date", w: 140, align: "right" as const },
    { key: "desc", w: 270, align: "right" as const },
    { key: "debit", w: 122, align: "right" as const },
    { key: "credit", w: 122, align: "right" as const },
    { key: "balance", w: 150, align: "right" as const },
  ];
  const colRight: number[] = [];
  let acc = R;
  for (const c of cols) {
    colRight.push(acc - 8);
    acc -= c.w;
  }
  const heads = ["التاريخ", "البيان", "عليه", "له", "الرصيد"];

  // رأس الجدول
  if (draw) {
    ctx.fillStyle = d.palette.c600;
    roundRect(ctx, P, y, W - 2 * P, 56, 16);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = font(700, 23);
    heads.forEach((h, i) => {
      ctx.textAlign = "right";
      ctx.fillText(h, colRight[i], y + 37);
    });
  }
  y += 56;

  const drawRow = (cells: string[], opts: { bold?: boolean; zebra?: boolean; colors?: (string | null)[] }) => {
    if (draw) {
      if (opts.zebra) {
        ctx.fillStyle = "#f6f8f3";
        ctx.fillRect(P, y, W - 2 * P, ROW_H);
      }
      ctx.font = font(opts.bold ? 800 : 600, 22);
      cells.forEach((cell, i) => {
        if (!cell) return;
        ctx.textAlign = "right";
        ctx.fillStyle = opts.colors?.[i] || INK;
        ctx.fillText(fit(ctx, cell, cols[i].w - 14), colRight[i], y + 37);
      });
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(P, y + ROW_H);
      ctx.lineTo(W - P, y + ROW_H);
      ctx.stroke();
    }
    y += ROW_H;
  };

  if (d.openingLabel) {
    drawRow(["", d.openingLabel, "", "", d.openingValue || ""], { bold: true, zebra: true });
  }
  d.rows.forEach((r, i) => {
    drawRow([r.date, r.desc, r.debit, r.credit, r.balance], {
      zebra: i % 2 === (d.openingLabel ? 0 : 1),
      colors: [GRAY, null, r.debit ? DANGER : null, r.credit ? OK : null, null],
    });
  });
  if (d.rows.length === 0 && !d.openingLabel) {
    if (draw) {
      ctx.textAlign = "center";
      ctx.fillStyle = GRAY;
      ctx.font = font(600, 24);
      ctx.fillText("لا توجد حركات في هذه الفترة", W / 2, y + 40);
    }
    y += ROW_H;
  }

  if (d.note) {
    if (draw) {
      ctx.textAlign = "right";
      ctx.fillStyle = GRAY;
      ctx.font = font(600, 21);
      ctx.fillText(d.note, R - 4, y + 38);
    }
    y += 52;
  }

  // ---------- الملخص ----------
  y += 24;
  const sums: [string, string, string?][] = [
    ["إجمالي عليه (فواتير)", d.totalDebit, DANGER],
    ["إجمالي له (دفعات ومرتجع)", d.totalCredit, OK],
  ];
  sums.forEach(([label, value, color]) => {
    if (draw) {
      ctx.textAlign = "right";
      ctx.fillStyle = GRAY;
      ctx.font = font(600, 26);
      ctx.fillText(label, R - 6, y + 34);
      ctx.textAlign = "left";
      ctx.fillStyle = color || INK;
      ctx.font = font(700, 27);
      ctx.fillText(value, P + 6, y + 34);
    }
    y += 52;
  });
  y += 8;
  if (draw) {
    const g = ctx.createLinearGradient(P, y, W - P, y + 112);
    g.addColorStop(0, d.closingDanger ? "#b42318" : d.palette.c600);
    g.addColorStop(1, d.closingDanger ? "#d92d20" : d.palette.c500);
    ctx.fillStyle = g;
    roundRect(ctx, P, y, W - 2 * P, 112, 26);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.font = font(700, 30);
    ctx.fillText(d.closingLabel, R - 32, y + 68);
    ctx.textAlign = "left";
    ctx.font = font(800, 46);
    ctx.fillText(d.closingValue, P + 32, y + 72);
  }
  y += 112;

  // ---------- الفوتر ----------
  y += 20;
  if (draw) {
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(P, y);
    ctx.lineTo(W - P, y);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = d.palette.c600;
    ctx.font = font(700, 30);
    ctx.fillText("شكرًا لتعاملكم معنا", W / 2, y + 54);
    ctx.fillStyle = GRAY;
    ctx.font = font(600, 23);
    ctx.fillText(d.brandName, W / 2, y + 92);
  }
  y += 92 + 40;
  return y;
}

/** بيرجّع الكشف كصورة PNG. */
export async function renderStatementImage(d: StatementImageData): Promise<Blob> {
  const family = (typeof getComputedStyle !== "undefined" && getComputedStyle(document.body).fontFamily) || "sans-serif";
  try {
    await Promise.all([600, 700, 800].map((w) => document.fonts.load(`${w} 24px ${family}`)));
    await document.fonts.ready;
  } catch {
    /* بنكمل بأي خط متاح */
  }
  const logo = await loadImage(d.logoUrl);

  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = 10;
  const mctx = scratch.getContext("2d");
  if (!mctx) throw new Error("canvas unsupported");
  const H = Math.ceil(paint(mctx, d, family, logo, false));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unsupported");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  paint(ctx, d, family, logo, true);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}
