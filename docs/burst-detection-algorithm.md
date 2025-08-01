# Industry-Standard Burst Photo Detection Algorithm

This document describes the enhanced burst detection algorithm implemented in Pictallion, based on Google HDR+ methodology and other industry standards.

## Overview

The burst detection system prevents visually similar photos taken in rapid succession from being incorrectly flagged as duplicates. This is crucial for modern photography where burst mode and HDR+ sequences are common.

## Algorithm Details

### 1. Timing Analysis (Primary Factor)
- **Threshold**: Photos taken within ±30 seconds are considered for burst grouping
- **Priority sources for timestamps**:
  1. EXIF `dateTimeOriginal`
  2. EXIF `dateTaken`
  3. EXIF `dateTime`
  4. Filename timestamp extraction (YYYYMMDD_HHMMSS pattern)
  5. File creation timestamp (fallback)

### 2. Filename Pattern Recognition
Recognizes common burst patterns from major camera manufacturers:

#### Google Pixel Pattern
- Format: `YYYYMMDD_HHMMSS_HEXID`
- Logic: Same timestamp prefix, different hex IDs = burst sequence

#### Sequential Numbering
- Pattern 1: `IMG_1234_BURST001.jpg` (iPhone)
- Pattern 2: `DSC_1234-5.jpg` (Professional cameras)
- Pattern 3: `IMG_1234_001.jpg` (General)
- Pattern 4: `IMG1234.jpg` → `IMG1235.jpg` (Traditional)

#### Brand-Specific Patterns
- iPhone: `IMG_XXXX_BURSTXXX`
- Sony: `DSCXXXX_BURST`
- Panasonic: `PXXXXXXX_BURST`
- HDR sequences: `_HDRX`
- Bracketing: `_BRACKETX`

### 3. Camera Metadata Analysis
Compares EXIF data for:
- Camera make/model consistency
- Lens information
- Camera settings (ISO, aperture, white balance)
- **Logic**: Same camera + similar settings + timing proximity = likely burst

### 4. Rapid Succession Detection
- Photos within 5 seconds are automatically considered burst sequences
- Based on typical camera burst rates (10-20 fps)

## Thresholds and Logic

### Similarity Thresholds
- **Detection threshold**: 98.0% visual similarity
- **Conflict creation**: Only for 99.9%+ non-burst photos
- **Burst photos**: Allowed up to 99% similarity without conflicts

### Decision Tree
1. **Check timing**: >30 seconds apart → not burst
2. **Pattern matching**: Known burst patterns → likely burst
3. **Metadata analysis**: Same camera + settings + timing → likely burst
4. **Rapid succession**: <5 seconds → definitely burst
5. **Final decision**: Create conflict only if not burst + very high similarity

## Industry Standards Reference

This implementation follows:
- **Google HDR+**: Burst capture and processing methodology
- **Real-time Burst Selection Networks**: Academic research on burst photo ranking
- **Mobile photography standards**: Typical burst intervals and patterns

## Benefits

1. **Reduces false positives** for burst photography
2. **Preserves photo sequences** that users intentionally captured
3. **Maintains duplicate detection** for actual duplicates
4. **Supports all major camera brands** and patterns
5. **Balances precision and recall** for better user experience

## Configuration

Current settings in `enhancedDuplicateDetection.ts`:
- Max burst interval: 30 seconds
- Rapid succession threshold: 5 seconds
- Sequential number gap: 1-10
- Similarity threshold: 98.0%
- Conflict threshold: 99.9% (non-burst only)

## Future Enhancements

Potential improvements:
1. Machine learning for pattern recognition
2. Visual content analysis for true burst detection
3. User preference learning
4. Cross-device burst detection
5. Cloud sync burst grouping