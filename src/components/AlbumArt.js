import React from 'react';
import Svg, { Rect, Circle, Path, Ellipse } from 'react-native-svg';
import { colors } from '../theme';

export function EmptyPhotos({ size = 140 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Circle cx="80" cy="80" r="72" fill="#E8F4F4" />
      <Rect x="42" y="38" width="76" height="88" rx="10" fill="#fff" stroke={colors.tealDark} strokeWidth="3" />
      <Rect x="52" y="50" width="56" height="40" rx="6" fill="#BFE6E8" />
      <Circle cx="68" cy="66" r="7" fill={colors.coral} />
      <Path d="M52 88 L70 72 L86 84 L96 76 L108 90 Z" fill={colors.teal} />
      <Path
        d="M118 118 C126 104 142 128 128 138"
        fill="none"
        stroke={colors.tealDark}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function EmptyFavs({ size = 140 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Circle cx="80" cy="80" r="72" fill="#F8E3DE" />
      <Path
        d="M80 42 L88 66 H114 L93 82 L101 108 L80 92 L59 108 L67 82 L46 66 H72 Z"
        fill={colors.coral}
      />
    </Svg>
  );
}

export function EmptyVideos({ size = 140 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Circle cx="80" cy="80" r="72" fill="#E8F4F4" />
      <Rect x="38" y="48" width="84" height="64" rx="14" fill={colors.tealDark} />
      <Path d="M74 68 L98 80 L74 92 Z" fill="#fff" />
      <Circle cx="118" cy="118" r="18" fill={colors.coral} />
      <Path d="M112 118 H124 M118 112 V124" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}
