"use client";

import {
  Dumbbell,
  Atom,
  FlaskConical,
  Flame,
  Milk,
  HeartPulse,
  Activity,
  TrendingUp,
  Pill,
  Fish,
  Zap,
  GlassWater,
  Tag,
  LucideIcon,
} from "lucide-react";

// Colors sampled directly from the user's reference design (the accent/
// underline color of each category card), so this matches their supplied
// palette exactly rather than an approximation.
interface Style {
  from: string;
  to: string;
  Icon: LucideIcon;
}

const STYLES: Record<string, Style> = {
  accessories: { from: "#1a2550", to: "#577AFF", Icon: Dumbbell },
  "amino acids": { from: "#0a2e33", to: "#03EEF8", Icon: Atom },
  aminoacids: { from: "#0a2e33", to: "#03EEF8", Icon: Atom },
  creatine: { from: "#1c1440", to: "#6932FD", Icon: FlaskConical },
  "fat burner": { from: "#3a1418", to: "#FF5539", Icon: Flame },
  fatburner: { from: "#3a1418", to: "#FF5539", Icon: Flame },
  "iso protein": { from: "#0e2140", to: "#3F8EFF", Icon: Milk },
  isoprotein: { from: "#0e2140", to: "#3F8EFF", Icon: Milk },
  "l-carnitine": { from: "#2c0f30", to: "#DA30AC", Icon: HeartPulse },
  lcarnitine: { from: "#2c0f30", to: "#DA30AC", Icon: HeartPulse },
  "l-citrulline": { from: "#0a2a33", to: "#03D1FF", Icon: Activity },
  lcitrulline: { from: "#0a2a33", to: "#03D1FF", Icon: Activity },
  "mass gainers": { from: "#2a2410", to: "#FFCF1D", Icon: TrendingUp },
  massgainers: { from: "#2a2410", to: "#FFCF1D", Icon: TrendingUp },
  multivitamins: { from: "#132a12", to: "#8FE94A", Icon: Pill },
  omega3: { from: "#0e2440", to: "#2E8FE0", Icon: Fish },
  "omega 3": { from: "#0e2440", to: "#2E8FE0", Icon: Fish },
  "pre workout": { from: "#3a1018", to: "#FF5E6E", Icon: Zap },
  preworkout: { from: "#3a1018", to: "#FF5E6E", Icon: Zap },
  "whey protein": { from: "#181640", to: "#6C63FF", Icon: GlassWater },
  wheyprotein: { from: "#181640", to: "#6C63FF", Icon: GlassWater },
  protein: { from: "#181640", to: "#6C63FF", Icon: GlassWater },
  // Arabic labels from the original seed data, mapped to the closest match.
  بروتين: { from: "#181640", to: "#6C63FF", Icon: GlassWater },
  كرياتين: { from: "#1c1440", to: "#6932FD", Icon: FlaskConical },
  "بري ورك أوت": { from: "#3a1018", to: "#FF5E6E", Icon: Zap },
  فيتامينات: { from: "#132a12", to: "#8FE94A", Icon: Pill },
  "أحماض أمينية": { from: "#0a2e33", to: "#03EEF8", Icon: Atom },
  "ماس جينر": { from: "#2a2410", to: "#FFCF1D", Icon: TrendingUp },
  "حارق دهون": { from: "#3a1418", to: "#FF5539", Icon: Flame },
};

const DEFAULT_STYLE: Style = { from: "#1e1b4b", to: "#302cb7", Icon: Tag };

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getCategoryStyle(name: string): Style {
  const key = normalize(name);
  const compact = key.replace(/[\s-]/g, "");
  return STYLES[key] ?? STYLES[compact] ?? DEFAULT_STYLE;
}

export default function CategoryTile({
  name,
  imageUrl,
  size = "h-10 w-10",
  iconSize = "h-5 w-5",
}: {
  name: string;
  imageUrl?: string | null;
  size?: string;
  iconSize?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${size} shrink-0 rounded-xl border border-gray-100 dark:border-gray-700 object-cover`}
      />
    );
  }

  const { from, to, Icon } = getCategoryStyle(name);
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-xl text-white`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <Icon className={iconSize} />
    </span>
  );
}
