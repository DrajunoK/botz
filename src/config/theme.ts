/** Visual identity of Botz: palette + fonts, taken from the design mockups in specs/. */

export const COLORS = {
  // Backgrounds
  night: 0x141b31,
  panel: 0x0e1428,
  panelBorder: 0x2e3a5e,
  outline: 0x0d1226,
  rim: 0x24304f,
  crowdBase: 0x222c49,
  netBg: 0x1f2a44,
  netLine: 0x56658a,

  // Text
  textMain: "#e9edf7",
  textSoft: "#c9d2e8",
  textMuted: "#aeb8d0",
  textFaint: "#8fa0c4",
  ink: "#1f2438",

  // Teams
  red: 0xe8473f,
  redButton: 0xd63a33,
  redButtonEdge: 0x8f2621,
  yellow: 0xf6c234,
  yellowEdge: 0xb8861a,

  // Pitch
  turfA: 0x6dbd4c,
  turfB: 0x66b345,
  line: 0xf4f7fb,
  lineBorder: 0xeef2f7,

  // Pétanque: gravel court and wooden border
  gravel: 0xd9c49a,
  gravelPebble: 0xbfa97c,
  wood: 0xa8703a,
  woodDark: 0x7a4f26,

  // Survivant: lava lake and metal catwalk
  lava: 0xe8572a,
  lavaLight: 0xf28a3a,
  lavaGlow: 0xffb547,
  lavaDark: 0x7a2a14,
  catwalkEdge: 0x7b8499,
  catwalkRing: 0x5a6480,
  catwalkPlate: 0xaab3c8,
  catwalkGrid: 0x929cb4,

  // Botz
  botVisor: 0x1f2438,
  botEye: 0x8ff3ff,
  botOutline: 0x2b2233,
  botMetal: 0xb9c2d3,
  botMetalDark: 0x3a4152,
  botWheel: 0x2a2e3b,
  botWheelHub: 0x8a92a6,
  antennaTip: 0xff5d73,

  // Alarm clock
  clockBell: 0xf4b942,
  clockBellEdge: 0x8a5a12,
  clockBody: 0xff6f91,
  clockEdge: 0x7a2140,
  clockFace: 0xfff7ea,
  clockTick: 0xc9b9a6,
  clockInk: 0x2b2233,
  vibration: 0xffd36e,
  sweat: 0x8fd8ff,
  sweatEdge: 0x2b5d80,
  spark: 0xffe27a,

  // Panic gauge
  panicCalm: 0x7fd1ae,
  panicWarm: 0xf6c234,
  panicHot: 0xf28a3a,
  panicOff: 0x2e3a5e,
  smoke: 0x8fa0c4,
} as const;

export const FONTS = {
  title: "Bungee",
  body: "Fredoka",
} as const;
