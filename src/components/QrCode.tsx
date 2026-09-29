import QRCode from 'qrcode';
import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

const QUIET_ZONE = 4; // modules of white border scanners expect

/** QR code as one SVG path (cheap to draw on the A06). Dark on white for scanners. */
export function QrCode({ value, size, label }: { value: string; size: number; label: string }) {
  const { d, dim } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: 'M' });
    let path = '';
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.data[y * modules.size + x]) path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
      }
    }
    return { d: path, dim: modules.size + QUIET_ZONE * 2 };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${dim} ${dim}`} accessibilityLabel={label}>
      <Rect width={dim} height={dim} fill={colors.surface} />
      <Path d={d} fill={colors.textPrimary} />
    </Svg>
  );
}
