import { StyleSheet, Platform } from 'react-native';
import { COLORS } from './Colors';

const isWeb = Platform.OS === 'web';

export const SHARED = StyleSheet.create({
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: isWeb ? 8 : 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.primary,
  },
  textarea: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: isWeb ? 8 : 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.primary,
    height: 72,
    textAlignVertical: 'top' as const,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: COLORS.secondary,
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: isWeb ? 8 : 10,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: isWeb ? 8 : 10,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
  },
  secondaryButtonText: {
    color: COLORS.gradientStart,
    fontSize: 14,
    fontWeight: '600' as const,
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
