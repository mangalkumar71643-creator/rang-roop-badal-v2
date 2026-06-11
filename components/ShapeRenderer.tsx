import React from 'react';
import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import { StyleProp, View, ViewStyle } from 'react-native';
import { GameShape } from '@/constants/gameConfig';

interface Props {
  shape: GameShape;
  color: string;
  size: number;
  strokeColor?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

function getStarPoints(cx: number, cy: number, outerR: number, innerR: number, numPoints: number): string {
  const pts: string[] = [];
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = (i * Math.PI) / numPoints - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function getHexagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 - Math.PI / 6;
    pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function ShapeRenderer({ shape, color, size, strokeColor, strokeWidth = 0, style }: Props) {
  const half = size / 2;
  const pad = strokeWidth + 2;
  const innerSize = size - pad * 2;
  const innerHalf = innerSize / 2;

  const svgContent = (() => {
    switch (shape) {
      case 'Circle':
        return (
          <Circle
            cx={half}
            cy={half}
            r={half - pad}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      case 'Square':
        return (
          <Rect
            x={pad}
            y={pad}
            width={innerSize}
            height={innerSize}
            rx={4}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      case 'Triangle':
        return (
          <Polygon
            points={`${half},${pad} ${size - pad},${size - pad} ${pad},${size - pad}`}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      case 'Star': {
        const pts = getStarPoints(half, half, half - pad, (half - pad) * 0.42, 5);
        return (
          <Polygon
            points={pts}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      }
      case 'Hexagon': {
        const pts = getHexagonPoints(half, half, half - pad);
        return (
          <Polygon
            points={pts}
            fill={color}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
        );
      }
      default:
        return null;
    }
  })();

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        {svgContent}
      </Svg>
    </View>
  );
}
