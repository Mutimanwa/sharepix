import React from 'react';
import Svg, { Circle, Rect, Path, G, Ellipse } from 'react-native-svg';
import { colors } from '../theme';

const TEAL = colors.teal;
const DEEP = colors.tealDark;
const CORAL = colors.coral;
const CREAM = '#E8F4F4';

export function ArtShare({ size = 260 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260">
      <Circle cx="130" cy="130" r="118" fill={CREAM} />
      <Circle cx="48" cy="58" r="10" fill={CORAL} opacity="0.35" />
      <Circle cx="214" cy="72" r="7" fill={TEAL} opacity="0.4" />
      <Circle cx="222" cy="188" r="9" fill={CORAL} opacity="0.28" />
      <Rect x="58" y="62" width="108" height="132" rx="16" fill="#fff" stroke={DEEP} strokeWidth="4" />
      <Rect x="70" y="78" width="84" height="62" rx="8" fill="#BFE6E8" />
      <Circle cx="92" cy="104" r="10" fill="#F4C7BE" />
      <Circle cx="114" cy="100" r="12" fill={CORAL} />
      <Path d="M78 132 C86 118 126 118 134 132 Z" fill={DEEP} opacity="0.25" />
      <Rect x="74" y="150" width="54" height="8" rx="4" fill={TEAL} />
      <Rect x="74" y="164" width="36" height="6" rx="3" fill="#C9DEDE" />
      <G>
        <Rect x="128" y="96" width="86" height="108" rx="16" fill="#fff" stroke={CORAL} strokeWidth="4" />
        <Rect x="140" y="112" width="62" height="48" rx="8" fill="#FAD8D2" />
        <Circle cx="162" cy="132" r="11" fill={CORAL} />
        <Circle cx="182" cy="134" r="9" fill="#F4C7BE" />
        <Path d="M148 154 C156 142 192 142 200 154 Z" fill={DEEP} opacity="0.2" />
        <Rect x="144" y="172" width="44" height="7" rx="3.5" fill={CORAL} />
      </G>
      <Path
        d="M118 198 C118 186 138 186 138 198 C138 210 118 218 128 226 C138 218 118 210 118 198 Z"
        fill={CORAL}
      />
    </Svg>
  );
}

export function ArtPrivate({ size = 260 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260">
      <Circle cx="130" cy="130" r="118" fill={CREAM} />
      <Circle cx="130" cy="130" r="78" fill="#fff" stroke={TEAL} strokeWidth="4" />
      <Circle cx="130" cy="118" r="22" fill={CORAL} />
      <Path d="M98 168 C102 144 158 144 162 168 Z" fill={DEEP} />
      <Circle cx="78" cy="108" r="14" fill="#F4C7BE" />
      <Circle cx="182" cy="108" r="14" fill="#F4C7BE" />
      <Circle cx="94" cy="188" r="12" fill={TEAL} />
      <Circle cx="166" cy="188" r="12" fill={TEAL} />
      <G>
        <Rect x="176" y="48" width="52" height="44" rx="12" fill={DEEP} />
        <Path
          d="M188 48 C188 36 216 36 216 48"
          fill="none"
          stroke={TEAL}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <Circle cx="202" cy="70" r="6" fill={CORAL} />
      </G>
    </Svg>
  );
}

export function ArtQuality({ size = 260 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 260 260">
      <Circle cx="130" cy="130" r="118" fill={CREAM} />
      <Rect x="52" y="62" width="68" height="68" rx="12" fill={TEAL} />
      <Rect x="128" y="62" width="80" height="48" rx="12" fill={CORAL} />
      <Rect x="52" y="140" width="48" height="58" rx="12" fill="#F4C7BE" />
      <Rect x="110" y="122" width="98" height="76" rx="14" fill="#fff" stroke={DEEP} strokeWidth="4" />
      <Ellipse cx="148" cy="152" rx="10" ry="10" fill="#BFE6E8" />
      <Path d="M122 186 L148 158 L168 174 L184 160 L198 186 Z" fill={TEAL} />
      <Circle cx="198" cy="86" r="22" fill="#fff" stroke={CORAL} strokeWidth="4" />
      <Path d="M190 86 L196 92 L208 78" fill="none" stroke={CORAL} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}
