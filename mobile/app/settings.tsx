import React from 'react';
import { StyleSheet, Text, View, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../constants/theme';

export default function SettingsScreen() {
  const [saveHistory, setSaveHistory] = React.useState(true);
  const [metricUnits, setMetricUnits] = React.useState(true);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionHeader}>Preferences</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Save Scan History</Text>
            <Text style={styles.rowSubtitle}>Store photos and nutrition records locally</Text>
          </View>
          <Switch
            value={saveHistory}
            onValueChange={setSaveHistory}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
          />
        </View>

        <View style={[styles.row, styles.borderTop]}>
          <View>
            <Text style={styles.rowTitle}>Metric Units (g / kcal)</Text>
            <Text style={styles.rowSubtitle}>Use grams instead of ounces</Text>
          </View>
          <Switch
            value={metricUnits}
            onValueChange={setMetricUnits}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
          />
        </View>
      </View>

      <Text style={styles.sectionHeader}>Data & Privacy</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.actionRow}>
          <Text style={styles.actionText}>Clear Local History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionRow, styles.borderTop]}>
          <Text style={styles.actionText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>About NutriScan</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0 (Foundation)</Text>
        </View>
        <View style={[styles.infoRow, styles.borderTop]}>
          <Text style={styles.infoLabel}>Nutrition Source</Text>
          <Text style={styles.infoValue}>USDA FoodData Central</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.m,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textLight,
    textTransform: 'uppercase',
    marginBottom: SPACING.s,
    marginTop: SPACING.m,
    marginLeft: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.l,
    paddingHorizontal: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.s,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.m,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  rowSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  actionRow: {
    paddingVertical: SPACING.m,
  },
  actionText: {
    fontSize: 16,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.m,
  },
  infoLabel: {
    fontSize: 16,
    color: COLORS.text,
  },
  infoValue: {
    fontSize: 15,
    color: COLORS.textLight,
  },
});
