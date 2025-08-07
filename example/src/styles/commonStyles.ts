import { StyleSheet } from 'react-native';
import { darkTheme } from './darkTheme';

/**
 * Common styles used across the application
 */
export const commonStyles = StyleSheet.create({
  // Layout styles
  container: {
    flex: 1,
    backgroundColor: darkTheme.background,
  },

  scrollContainer: {
    flexGrow: 1,
    padding: darkTheme.spacing.md,
  },

  section: {
    marginBottom: darkTheme.spacing.lg,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Card styles
  card: {
    backgroundColor: darkTheme.surface,
    borderRadius: darkTheme.borderRadius.lg,
    padding: darkTheme.spacing.md,
    marginBottom: darkTheme.spacing.md,
    ...darkTheme.shadow,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: darkTheme.spacing.md,
  },

  // Typography styles
  title: {
    fontSize: darkTheme.typography.fontSize.xl,
    fontWeight: darkTheme.typography.fontWeight.bold,
    color: darkTheme.text,
    marginBottom: darkTheme.spacing.md,
  },

  subtitle: {
    fontSize: darkTheme.typography.fontSize.lg,
    fontWeight: darkTheme.typography.fontWeight.semibold,
    color: darkTheme.text,
    marginBottom: darkTheme.spacing.sm,
  },

  bodyText: {
    fontSize: darkTheme.typography.fontSize.md,
    color: darkTheme.text,
    lineHeight: 24,
  },

  captionText: {
    fontSize: darkTheme.typography.fontSize.sm,
    color: darkTheme.textSecondary,
  },

  mutedText: {
    fontSize: darkTheme.typography.fontSize.sm,
    color: darkTheme.textMuted,
  },

  // Input styles
  input: {
    backgroundColor: darkTheme.inputBackground,
    borderColor: darkTheme.inputBorder,
    borderWidth: 1,
    borderRadius: darkTheme.borderRadius.md,
    padding: darkTheme.spacing.md,
    color: darkTheme.text,
    fontSize: darkTheme.typography.fontSize.md,
    marginBottom: darkTheme.spacing.md,
  },

  inputFocused: {
    borderColor: darkTheme.inputFocus,
  },

  // Button styles
  button: {
    borderRadius: darkTheme.borderRadius.md,
    padding: darkTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  buttonPrimary: {
    backgroundColor: darkTheme.buttonPrimary,
  },

  buttonSecondary: {
    backgroundColor: darkTheme.buttonSecondary,
  },

  buttonDanger: {
    backgroundColor: darkTheme.buttonDanger,
  },

  buttonSuccess: {
    backgroundColor: darkTheme.buttonSuccess,
  },

  buttonText: {
    fontSize: darkTheme.typography.fontSize.md,
    fontWeight: darkTheme.typography.fontWeight.semibold,
    color: darkTheme.text,
  },

  buttonIcon: {
    marginRight: darkTheme.spacing.sm,
  },

  // Status styles
  statusBadge: {
    paddingHorizontal: darkTheme.spacing.sm,
    paddingVertical: darkTheme.spacing.xs,
    borderRadius: darkTheme.borderRadius.sm,
    alignSelf: 'flex-start',
  },

  statusSuccess: {
    backgroundColor: darkTheme.success,
  },

  statusWarning: {
    backgroundColor: darkTheme.warning,
  },

  statusDanger: {
    backgroundColor: darkTheme.danger,
  },

  statusInfo: {
    backgroundColor: darkTheme.info,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: darkTheme.divider,
    marginVertical: darkTheme.spacing.md,
  },

  // Loading/Empty states
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyState: {
    padding: darkTheme.spacing.xl,
    alignItems: 'center',
  },

  emptyStateText: {
    fontSize: darkTheme.typography.fontSize.md,
    color: darkTheme.textMuted,
    textAlign: 'center',
    marginTop: darkTheme.spacing.md,
  },
});
