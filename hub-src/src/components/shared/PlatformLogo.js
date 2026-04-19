import React from 'react';

export function PlatformLogo({ name, size = 24 }) {
  const n = (name || '').toLowerCase();
  if (n.includes('tiktok'))                            return <TikTokLogo size={size} />;
  if (n.includes('instagram'))                         return <InstagramLogo size={size} />;
  if (n.includes('youtube'))                           return <YouTubeLogo size={size} />;
  if (n === 'x' || n.includes('twitter'))              return <XLogo size={size} />;
  if (n.includes('snapchat'))                          return <SnapchatLogo size={size} />;
  if (n.includes('pinterest'))                         return <PinterestLogo size={size} />;
  if (n.includes('facebook'))                          return <FacebookLogo size={size} />;
  if (n.includes('linkedin'))                          return <LinkedInLogo size={size} />;
  if (n.includes('twitch'))                            return <TwitchLogo size={size} />;
  if (n.includes('podcast') || n.includes('spotify'))  return <SpotifyLogo size={size} />;
  return <GenericPlatformLogo size={size} label={(name || '?').slice(0, 2).toUpperCase()} />;
}

function TikTokLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#010101" rx="6"/>
      <rect x="15" y="11" width="9" height="20" rx="2" fill="white"/>
      <rect x="21" y="11" width="3" height="20" rx="1" fill="#69C9D0"/>
      <circle cx="17" cy="29" r="4" fill="#EE1D52"/>
      <circle cx="23" cy="26" r="4" fill="#69C9D0"/>
      <circle cx="20" cy="27.5" r="3" fill="white"/>
      <path d="M24 11 Q30 11 30 17" fill="none" stroke="#69C9D0" strokeWidth="3" strokeLinecap="round"/>
      <path d="M24 11 Q30 11 30 17" fill="none" stroke="#EE1D52" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/>
    </svg>
  );
}

function InstagramLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <defs>
        <linearGradient id="ig-grad-shared" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFDC80"/>
          <stop offset="25%" stopColor="#FCAF45"/>
          <stop offset="50%" stopColor="#F77737"/>
          <stop offset="75%" stopColor="#C13584"/>
          <stop offset="100%" stopColor="#833AB4"/>
        </linearGradient>
      </defs>
      <rect width="42" height="42" fill="url(#ig-grad-shared)" rx="6"/>
      <rect x="10" y="12" width="22" height="18" rx="4" fill="none" stroke="white" strokeWidth="2"/>
      <circle cx="21" cy="21" r="5" fill="none" stroke="white" strokeWidth="2"/>
      <circle cx="30" cy="14" r="1.5" fill="white"/>
    </svg>
  );
}

function YouTubeLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#FF0000" rx="6"/>
      <rect x="7" y="13" width="28" height="16" rx="4" fill="white" opacity="0.15"/>
      <polygon points="17,15 17,27 30,21" fill="white"/>
    </svg>
  );
}

function XLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#000000" rx="6"/>
      <path d="M10 10 L32 32 M32 10 L10 32" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  );
}

function SnapchatLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#FFFC00" rx="6"/>
      <path d="M21 8 C14 8 12 14 12 18 L12 26 L9 28 C10 29 12 29 14 28 C14 29 17 31 21 31 C25 31 28 29 28 28 C30 29 32 29 33 28 L30 26 L30 18 C30 14 28 8 21 8 Z" fill="#1a1a1a"/>
    </svg>
  );
}

function PinterestLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#E60023" rx="6"/>
      <text x="21" y="29" textAnchor="middle"
        style={{ fontSize: 24, fontWeight: 800, fill: 'white', fontFamily: 'Georgia, serif' }}>P</text>
    </svg>
  );
}

function FacebookLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1877F2" rx="6"/>
      <path d="M23 12 L20 12 C18 12 17 13 17 15 L17 18 L14 18 L14 22 L17 22 L17 32 L21 32 L21 22 L24 22 L25 18 L21 18 L21 16 C21 15 21.5 14.5 22.5 14.5 L25 14.5 Z" fill="white"/>
    </svg>
  );
}

function LinkedInLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#0A66C2" rx="6"/>
      <text x="21" y="28" textAnchor="middle"
        style={{ fontSize: 16, fontWeight: 700, fill: 'white', fontFamily: 'Arial, sans-serif', letterSpacing: -0.5 }}>in</text>
    </svg>
  );
}

function TwitchLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#9146FF" rx="6"/>
      <path d="M11 9 L11 27 L17 27 L17 31 L21 27 L27 27 L27 9 Z" fill="white" opacity="0.2"/>
      <rect x="17" y="14" width="3" height="7" rx="1" fill="white"/>
      <rect x="23" y="14" width="3" height="7" rx="1" fill="white"/>
    </svg>
  );
}

function SpotifyLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1DB954" rx="6"/>
      <path d="M11 18 Q21 14 31 18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M13 23 Q21 20 30 23" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M15 28 Q21 26 28 28" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

export function GenericPlatformLogo({ size = 24, label = '?' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" style={{ borderRadius: 6, flexShrink: 0 }}>
      <rect width="42" height="42" fill="#1e1e1e" rx="6"/>
      <text x="21" y="27" textAnchor="middle" fill="#555"
        style={{ fontSize: label.length > 1 ? 14 : 18, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{label}</text>
    </svg>
  );
}
