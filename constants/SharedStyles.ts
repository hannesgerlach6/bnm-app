import { StyleSheet, Platform } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING } from './Colors';

const isWeb = Platform.OS === 'web';

// Minimum Touch-Target-Größe (Material Design 48dp, Apple HIG 44pt)
export const MIN_TOUCH_TARGET = 48;

export const SHARED = StyleSheet.create({
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: isWeb ? 8 : 10,
    paddingHorizontal: 12,
    fontSize: TYPOGRAPHY.size.base,
    color: COLORS.primary,
    minHeight: MIN_TOUCH_TARGET,
  },
  textarea: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: isWeb ? 8 : 10,
    paddingHorizontal: 12,
    fontSize: TYPOGRAPHY.size.base,
    color: COLORS.primary,
    height: 72,
    textAlignVertical: 'top' as const,
  },
  label: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.medium,
    color: COLORS.secondary,
    marginBottom: SPACING.xs,
  },
  // Überschriften
  pageTitle: {
    fontSize: TYPOGRAPHY.size.xxl,
    fontWeight: TYPOGRAPHY.weight.extrabold,
    lineHeight: TYPOGRAPHY.lineHeight.loose,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.bold,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  bodyText: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.regular,
    lineHeight: TYPOGRAPHY.lineHeight.normal,
  },
  captionText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.regular,
    lineHeight: TYPOGRAPHY.lineHeight.tight,
  },
  labelCaps: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    letterSpacing: TYPOGRAPHY.letterSpacing.wider,
  },
  primaryButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: isWeb ? 8 : 10,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center' as const,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: isWeb ? 8 : 10,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center' as const,
  },
  secondaryButtonText: {
    color: COLORS.gradientStart,
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  goldCard: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldSpacing: {
    marginBottom: 10,
  },
  sectionSpacing: {
    marginBottom: 14,
  },
  screenPadding: {
    padding: 16,
  },
});
