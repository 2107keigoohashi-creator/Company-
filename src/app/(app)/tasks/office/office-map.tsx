"use client";

import type { KeyboardEvent } from "react";

export type MemberStatus = "working" | "review" | "rejected" | "queued" | "idle" | "off";

export interface OfficeMember {
  id: string;
  key: string;
  name: string;
  role: string;
  responsibilities: string;
  enabled: boolean;
  status: MemberStatus;
  current: { id: string; title: string; progress: number; status: string } | null;
  open: { id: string; title: string; status: string; progress: number }[];
}

/** 状態は色・記号・文言の3点で区別する(色だけに頼らない) */
export const MEMBER_STATUS: Record<MemberStatus, { label: string; color: string; icon: string }> = {
  working: { label: "作業中", color: "#38bdf8", icon: "●" },
  review: { label: "承認待ち", color: "#fbbf24", icon: "◆" },
  rejected: { label: "差し戻し", color: "#fb7185", icon: "✕" },
  queued: { label: "着手待ち", color: "#a5b4c8", icon: "○" },
  idle: { label: "待機", color: "#64748b", icon: "–" },
  off: { label: "無効", color: "#475569", icon: "／" },
};

export const ROOMS = [
  { key: "exec", en: "EXECUTIVE", ja: "経営室", x: 20, y: 20, members: ["president", "secretary"] },
  { key: "studio", en: "CREATIVE STUDIO", ja: "制作室", x: 610, y: 20, members: ["writer", "designer"] },
  { key: "lab", en: "GROWTH & ENGINEERING", ja: "戦略・開発室", x: 20, y: 420, members: ["marketer", "engineer"] },
  { key: "admin", en: "OPERATIONS", ja: "管理部", x: 610, y: 420, members: ["accountant", "customer"] },
] as const;

export const ROOM_W = 570;
export const ROOM_H = 380;
export const VIEW_W = 1200;
export const VIEW_H = 820;

function truncate(text: string, max: number) {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}

export function OfficeMap({
  members,
  viewBox,
  selectedId,
  showBubbles,
  showTags,
  onSelect,
}: {
  members: OfficeMember[];
  viewBox: string;
  selectedId: string | null;
  showBubbles: boolean;
  showTags: boolean;
  onSelect: (id: string) => void;
}) {
  const byKey = new Map(members.map((m) => [m.key, m]));

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label="オフィスの見取り図。社員ごとの作業状況"
      className="block h-auto w-full select-none"
      style={{ transition: "all .3s" }}
    >
      <defs>
        <pattern id="floor" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill="#0c111a" />
          <path d="M40 0H0V40" fill="none" stroke="#141c29" strokeWidth="1.5" />
        </pattern>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" stopOpacity=".35" />
          <stop offset=".5" stopColor="#22d3ee" stopOpacity=".05" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity=".25" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="pool" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#38bdf8" stopOpacity=".18" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#05070b" />
      {/* 廊下 */}
      <rect x="0" y="400" width={VIEW_W} height="20" fill="#0a0e15" />
      <rect x="590" y="0" width="20" height={VIEW_H} fill="#0a0e15" />

      {ROOMS.map((room) => (
        <g key={room.key}>
          <rect x={room.x} y={room.y} width={ROOM_W} height={ROOM_H} rx="6" fill="url(#floor)" />
          <rect x={room.x} y={room.y} width={ROOM_W} height={ROOM_H} rx="6" fill="none" stroke="#1d2737" strokeWidth="6" />
          <rect x={room.x + 3} y={room.y + 3} width={ROOM_W - 6} height={ROOM_H - 6} rx="4" fill="none" stroke="url(#glass)" strokeWidth="2" />
          {/* 入口(ガラス扉) */}
          <rect
            x={room.x + ROOM_W / 2 - 40}
            y={room.y < 400 ? room.y + ROOM_H - 4 : room.y - 2}
            width="80"
            height="6"
            fill="#22d3ee"
            opacity=".35"
          />
          <text x={room.x + 22} y={room.y + 30} fill="#475569" fontSize="13" letterSpacing="4" fontWeight="700">
            {room.en}
          </text>
          <text x={room.x + 22} y={room.y + 50} fill="#94a3b8" fontSize="15" fontWeight="700">
            {room.ja}
          </text>
          <RoomDecor room={room.key} x={room.x} y={room.y} />
          {room.members.map((key, i) => {
            const m = byKey.get(key);
            if (!m) return null;
            return (
              <Workstation
                key={key}
                member={m}
                cx={room.x + (i === 0 ? 145 : 425)}
                top={room.y}
                selected={selectedId === m.id}
                showBubble={showBubbles}
                showTag={showTags}
                onSelect={onSelect}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function Workstation({
  member,
  cx,
  top,
  selected,
  showBubble,
  showTag,
  onSelect,
}: {
  member: OfficeMember;
  cx: number;
  top: number;
  selected: boolean;
  showBubble: boolean;
  showTag: boolean;
  onSelect: (id: string) => void;
}) {
  const st = MEMBER_STATUS[member.status];
  const deskY = top + 150;
  const personY = top + 250;
  const active = member.status === "working";
  const dim = member.status === "idle" || member.status === "off";
  const screen = member.status === "off" ? "#111827" : dim ? "#1e293b" : st.color;

  function onKey(e: KeyboardEvent<SVGGElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(member.id);
    }
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${member.name}: ${st.label}${member.current ? `「${member.current.title}」` : ""}`}
      aria-pressed={selected}
      onClick={() => onSelect(member.id)}
      onKeyDown={onKey}
      className="cursor-pointer outline-none"
      data-testid={`member-${member.key}`}
      data-status={member.status}
      opacity={member.status === "off" ? 0.45 : 1}
    >
      {/* タップ領域 */}
      <rect x={cx - 140} y={top + 60} width="280" height="300" fill="transparent" />

      {/* 作業中の光だまり */}
      {active && <ellipse cx={cx} cy={deskY + 30} rx="150" ry="90" fill="url(#pool)" className="office-pulse" />}

      {/* デスク */}
      <rect x={cx - 100} y={deskY} width="200" height="64" rx="6" fill="#182131" stroke="#273348" strokeWidth="2" />
      <rect x={cx - 100} y={deskY} width="200" height="6" rx="3" fill="#212c40" />
      {/* モニター */}
      <rect
        x={cx - 48}
        y={deskY + 10}
        width="96"
        height="9"
        rx="2"
        fill={screen}
        opacity={dim ? 1 : 0.9}
        filter={dim ? undefined : "url(#glow)"}
        className={active ? "office-screen" : undefined}
      />
      <rect x={cx - 6} y={deskY + 19} width="12" height="8" fill="#273348" />
      {/* キーボード・ノートPC・カップ */}
      <rect x={cx - 34} y={deskY + 36} width="68" height="14" rx="2" fill="#0f1622" stroke="#2c3a52" />
      <rect x={cx + 52} y={deskY + 30} width="34" height="24" rx="2" fill="#0f1622" stroke="#2c3a52" />
      <circle cx={cx - 72} cy={deskY + 42} r="7" fill="#0f1622" stroke="#2c3a52" strokeWidth="2" />

      {/* 椅子と人物(上から見た図) */}
      <circle cx={cx} cy={personY + 6} r="34" fill="#0d121b" stroke="#232e40" strokeWidth="3" />
      {/* 腕(キーボードへ伸ばす) */}
      {[-1, 1].map((side) => (
        <g key={side}>
          <rect
            x={cx + side * 20 - 5}
            y={personY - 30}
            width="10"
            height="28"
            rx="5"
            fill="#1f2937"
            stroke={st.color}
            strokeWidth="2"
            transform={`rotate(${side * -12} ${cx + side * 20} ${personY - 4})`}
          />
          <circle cx={cx + side * 14} cy={personY - 31} r="4.5" fill="#cbd5e1" />
        </g>
      ))}
      {/* 肩(スーツ)と頭(上から見た髪) */}
      <ellipse cx={cx} cy={personY + 2} rx="30" ry="16" fill="#1f2937" stroke={st.color} strokeWidth="3" />
      <path d={`M${cx - 6} ${personY - 12} L${cx} ${personY + 4} L${cx + 6} ${personY - 12}`} fill="#e2e8f0" opacity=".85" />
      <circle cx={cx} cy={personY - 2} r="13" fill="#0b1020" stroke="#3b4a63" strokeWidth="2" />
      <ellipse cx={cx - 4} cy={personY - 7} rx="5" ry="3" fill="#ffffff" opacity=".12" />
      <circle cx={cx + 24} cy={personY - 12} r="6" fill={st.color} stroke="#05070b" strokeWidth="2" />
      {selected && (
        <circle cx={cx} cy={personY + 2} r="46" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="6 6" />
      )}

      {/* 名札 */}
      {showTag && (
        <g>
          <rect x={cx - 92} y={personY + 44} width="184" height="54" rx="8" fill="#080b11" fillOpacity=".92" stroke="#273348" />
          <rect x={cx - 92} y={personY + 44} width="4" height="54" rx="2" fill={st.color} />
          <text x={cx - 78} y={personY + 67} fill="#e8edf6" fontSize="18" fontWeight="700">
            {member.name}
          </text>
          <text x={cx - 78} y={personY + 89} fill={st.color} fontSize="14" fontWeight="700">
            {st.icon} {st.label}
            {member.status === "working" && member.current ? ` ${member.current.progress}%` : ""}
          </text>
        </g>
      )}

      {/* 吹き出し(今のタスク) */}
      {showBubble && member.current && (
        <g>
          <rect x={cx - 130} y={top + 62} width="260" height="70" rx="10" fill="#0b1220" fillOpacity=".96" stroke={st.color} strokeOpacity=".7" />
          <path d={`M${cx - 8} ${top + 132} L${cx} ${top + 144} L${cx + 8} ${top + 132}`} fill="#0b1220" stroke={st.color} strokeOpacity=".7" />
          <rect x={cx - 9} y={top + 128} width="18" height="5" fill="#0b1220" />
          <text x={cx - 116} y={top + 90} fill="#e8edf6" fontSize="16" fontWeight="700">
            {truncate(member.current.title, 14)}
          </text>
          <rect x={cx - 116} y={top + 106} width="180" height="8" rx="4" fill="#1e293b" />
          <rect
            x={cx - 116}
            y={top + 106}
            width={Math.max(4, (180 * member.current.progress) / 100)}
            height="8"
            rx="4"
            fill={st.color}
          />
          <text x={cx + 72} y={top + 115} fill={member.status === "working" ? "#94a3b8" : st.color} fontSize="13" fontWeight="700">
            {member.status === "working" ? `${member.current.progress}%` : st.label}
          </text>
        </g>
      )}
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="15" fill="#0f2a1e" />
      <circle cx={x - 7} cy={y - 4} r="8" fill="#14532d" />
      <circle cx={x + 6} cy={y - 6} r="7" fill="#166534" />
      <circle cx={x + 2} cy={y + 6} r="7" fill="#15803d" opacity=".8" />
    </g>
  );
}

function RoomDecor({ room, x, y }: { room: string; x: number; y: number }) {
  const shelf = (sx: number, sy: number, w: number) => (
    <g>
      <rect x={sx} y={sy} width={w} height="14" rx="2" fill="#141c29" stroke="#232e40" />
      {Array.from({ length: Math.floor(w / 12) }, (_, i) => (
        <rect key={i} x={sx + 4 + i * 12} y={sy + 3} width="7" height="8" fill={["#334155", "#475569", "#1e3a5f", "#3f3f46"][i % 4]} />
      ))}
    </g>
  );
  switch (room) {
    case "exec":
      return (
        <g>
          {shelf(x + 330, y + 18, 220)}
          {/* 会議テーブル */}
          <rect x={x + 247} y={y + 318} width="76" height="44" rx="12" fill="#141c29" stroke="#2a3649" strokeWidth="2" />
          {[0, 1].map((i) => (
            <circle key={i} cx={x + 268 + i * 34} cy={y + 312} r="7" fill="#0d121b" stroke="#232e40" />
          ))}
          <Plant x={x + 30} y={y + 350} />
          <Plant x={x + 540} y={y + 350} />
        </g>
      );
    case "studio":
      return (
        <g>
          {/* ホワイトボード */}
          <rect x={x + 330} y={y + 16} width="210" height="18" rx="3" fill="#cbd5e1" opacity=".85" />
          <path d={`M${x + 345} ${y + 26} h60 M${x + 420} ${y + 26} h40 M${x + 475} ${y + 26} h50`} stroke="#0ea5e9" strokeWidth="3" />
          <rect x={x + 248} y={y + 318} width="74" height="44" rx="6" fill="#141c29" stroke="#2a3649" strokeWidth="2" />
          <Plant x={x + 30} y={y + 350} />
          <Plant x={x + 540} y={y + 350} />
        </g>
      );
    case "lab":
      return (
        <g>
          {/* サーバーラック */}
          <rect x={x + 524} y={y + 290} width="38" height="74" rx="4" fill="#0b0f16" stroke="#273348" strokeWidth="2" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={x + 529} y={y + 298 + i * 16} width="28" height="10" rx="2" fill="#131b28" />
              <circle cx={x + 551} cy={y + 303 + i * 16} r="2.5" fill={i % 2 ? "#22c55e" : "#38bdf8"} className="office-led" style={{ animationDelay: `${i * 0.4}s` }} />
            </g>
          ))}
          {/* 大型モニター(ダッシュボード) */}
          <rect x={x + 330} y={y + 16} width="210" height="20" rx="3" fill="#0b1220" stroke="#1e3a5f" strokeWidth="2" />
          <path d={`M${x + 340} ${y + 30} l20 -8 l20 5 l20 -10 l20 7 l20 -4 l20 6`} fill="none" stroke="#38bdf8" strokeWidth="2" />
          <Plant x={x + 30} y={y + 350} />
        </g>
      );
    default:
      return (
        <g>
          {/* キャビネット */}
          {[0, 1, 2].map((i) => (
            <rect key={i} x={x + 380 + i * 54} y={y + 16} width="48" height="22" rx="2" fill="#141c29" stroke="#273348" />
          ))}
          <rect x={x + 248} y={y + 318} width="74" height="44" rx="6" fill="#141c29" stroke="#2a3649" strokeWidth="2" />
          <Plant x={x + 30} y={y + 350} />
          <Plant x={x + 540} y={y + 350} />
        </g>
      );
  }
}
