import React from "react";

/**
 * Card
 * Maps to: background:var(--bg2); border:1px solid var(--border); border-radius:6px
 */
export function Card({ children, className = "", ...props }) {
  return (
    <div
      className={`bg-bg2 border border-border rounded-[6px] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Button
 * variant="primary" → gold gradient (btn-gold)
 * variant="ghost"   → transparent bordered (btn-ghost)
 * variant="danger"  → red bordered (btn-danger)
 */
const VARIANT = {
  primary:
    "bg-[linear-gradient(135deg,var(--gold),var(--gold2))] text-[#060a06] " +
    "px-6 py-2.5 text-sm font-display tracking-[1.5px] rounded-[3px] " +
    "border-none cursor-pointer transition-all duration-200 " +
    "hover:brightness-110 disabled:opacity-50",

  ghost:
    "bg-transparent border border-border2 text-t2 " +
    "px-[18px] py-2 text-[13px] font-display tracking-[1.5px] rounded-[3px] " +
    "cursor-pointer transition-all duration-200 " +
    "hover:border-green hover:text-text disabled:opacity-50",

  danger:
    "bg-transparent border border-[#3a1818] text-red " +
    "px-2.5 py-[5px] text-[11px] tracking-[1px] font-display rounded-[3px] " +
    "cursor-pointer transition-all duration-200 " +
    "hover:bg-[#3a181822] disabled:opacity-50",
};

export function Button({ variant = "primary", children, className = "", ...props }) {
  return (
    <button className={`${VARIANT[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

/**
 * Input
 * Maps to the global input rule in index.css:
 * background:var(--bg2); border:1px solid var(--border2); color:var(--text);
 * padding:8px 12px; border-radius:3px; font-size:14px; transition:border-color .2s
 * focus: border-color:var(--gold)
 */
export function Input({ className = "", ...props }) {
  return (
    <input
      className={[
        "bg-bg2 border border-border2 text-text",
        "px-3 py-2 rounded-[3px] text-sm outline-none",
        "font-[inherit] transition-[border-color] duration-200",
        "focus:border-gold",
        className,
      ].join(" ")}
      {...props}
    />
  );
}

/**
 * PageHeader
 * Props:
 *   title    {string}   — required, rendered in Bebas Neue
 *   onBack   {function} — optional, renders a ← button when provided
 *   children           — optional, rendered to the right of the title
 *                        (e.g. an action button)
 *
 * Maps to the recurring pattern across screens:
 *   <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
 *     <button onClick={onBack} style={{...text3, fontSize:18}}>←</button>
 *     <div style={{fontFamily:"Bebas Neue",fontSize:22,letterSpacing:2}}>{title}</div>
 *   </div>
 */
export function PageHeader({ title, onBack, children }) {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      {onBack && (
        <button
          onClick={onBack}
          className="bg-transparent border-none text-t3 text-lg leading-none cursor-pointer"
        >
          ←
        </button>
      )}
      <div className="font-display text-[22px] tracking-[2px] leading-none flex-1">
        {title}
      </div>
      {children}
    </div>
  );
}
