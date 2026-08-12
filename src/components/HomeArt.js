import React from 'react';
import Svg, { Circle, Rect, Path, Ellipse } from 'react-native-svg';

export function IconVacances({ size = 52 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Ellipse cx="32" cy="46" rx="20" ry="8" fill="#2BA3A8" />
      <Path d="M18 46 C20 30 28 22 32 18 C36 22 44 30 46 46 Z" fill="#E07A6A" />
      <Path d="M24 34 H40" stroke="#164E52" strokeWidth="2" />
      <Circle cx="48" cy="16" r="6" fill="#F4C7BE" />
    </Svg>
  );
}

export function IconFamille({ size = 52 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="24" cy="22" r="8" fill="#E07A6A" />
      <Circle cx="40" cy="22" r="8" fill="#2BA3A8" />
      <Path d="M12 48 C14 34 34 34 36 48 Z" fill="#164E52" />
      <Path d="M28 48 C30 36 50 36 52 48 Z" fill="#2BA3A8" />
    </Svg>
  );
}

export function IconBebe({ size = 52 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="28" r="14" fill="#F4C7BE" />
      <Circle cx="27" cy="27" r="2" fill="#164E52" />
      <Circle cx="37" cy="27" r="2" fill="#164E52" />
      <Path d="M27 34 Q32 38 37 34" stroke="#E07A6A" strokeWidth="2" fill="none" />
      <Rect x="20" y="42" width="24" height="12" rx="6" fill="#2BA3A8" />
    </Svg>
  );
}

export function IconSpecial({ size = 52 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 10 L36 24 H51 L39 33 L44 48 L32 39 L20 48 L25 33 L13 24 H28 Z" fill="#E07A6A" />
    </Svg>
  );
}

export function TabHome({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 11 L12 4 L20 11 V20 H15 V14 H9 V20 H4 Z" fill={color} />
    </Svg>
  );
}

export function TabBell({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 16 V11 A6 6 0 0 1 18 11 V16 L20 18 H4 Z" fill={color} />
      <Path d="M10 19 A2 2 0 0 0 14 19" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

export function TabUser({ color, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="8" r="4" fill={color} />
      <Path d="M5 20 C6 15 18 15 19 20 Z" fill={color} />
    </Svg>
  );
}
