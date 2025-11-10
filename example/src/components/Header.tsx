import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface HeaderProps {
  readonly title: string;
  readonly subtitle: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle }) => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
  },
});

export default Header;
